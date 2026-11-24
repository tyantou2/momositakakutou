(function(D) {
  "use strict";
  const VERSION="dojo-3.7",PREFIX="momoshita-v37-";
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>alphabet[n%alphabet.length]).join("");
  function fighter(record) {
    const built=D.cast.find(f=>f.id===record?.id);
    if(built)return built;
    if(!record || typeof record!=="object" || !String(record.id||"").startsWith("custom-"))throw Error("キャラクター情報が正しくありません。");
    // Voice uploads remain local. Only validated appearance and combat values travel.
    return D.normalize({...record,voice:{}});
  }
  class Online {
    constructor(callbacks={}) {
      this.callbacks=callbacks;this.peer=null;this.conn=null;this.code="";this.side=0;this.status="idle";this.rtt=0;this.localReady=false;this.remoteReady=false;
      this.remoteFighter=null;this.selfFighter=null;this.round=null;this.core=null;this.lastSeen=0;this.stallSince=0;this.disposed=false;
    }
    change(status,message) {this.status=status;this.message=message;this.callbacks.status?.(this);}
    send(message) {
      if(this.conn?.open)try{this.conn.send({...message,v:VERSION});}catch{this.fail("通信が切れました。もう一度部屋を作ってください。");}
    }
    async open(joinCode) {
      this.close();this.disposed=false;
      if(!globalThis.Peer || !globalThis.RTCPeerConnection){this.fail("このブラウザではオンライン対戦を開始できません。最新版のChromeまたはEdgeをお試しください。");return;}
      this.side=joinCode?1:0;this.code=joinCode||token();
      this.change("connecting",joinCode?"部屋に接続中…":"招待コードを発行中…");
      const peer=this.peer=new Peer(joinCode?undefined:PREFIX+this.code,{debug:0});
      const timeout=this.openTimer=setTimeout(()=>{if(this.peer===peer && this.status==="connecting")this.fail("接続に時間がかかっています。コードと回線を確認して接続し直してください。");},15000);
      peer.on("open",()=>{
        if(this.peer!==peer)return;
        clearTimeout(timeout);
        if(joinCode)this.attach(peer.connect(PREFIX+joinCode,{serialization:"json",reliable:true,metadata:{v:VERSION}}));
        else this.change("waiting","コードを相手に共有してください。");
      });
      peer.on("connection",c=>{
        if(this.peer!==peer || this.side!==0 || this.conn || c.metadata?.v!==VERSION){c.on("open",()=>c.close());return;}
        this.attach(c);
      });
      peer.on("error",e=>{
        if(this.peer!==peer || this.disposed)return;
        const message=e.type==="peer-unavailable"?"部屋が見つかりません。招待コードと、相手が待機中かを確認してください。":e.type==="unavailable-id"?"コードを発行できませんでした。もう一度部屋を作ってください。":"接続できませんでした。回線を確認してもう一度お試しください。";
        this.fail(message);
      });
      peer.on("disconnected",()=>{if(this.peer===peer && !this.conn?.open && !this.disposed)this.fail("接続サービスとの通信が切れました。もう一度お試しください。");});
    }
    attach(c) {
      this.conn=c;
      const timeout=this.connectTimer=setTimeout(()=>{if(!c.open && this.conn===c)this.fail("相手に接続できません。別の回線でお試しください。");},15000);
      c.on("open",()=>{
        if(this.conn!==c)return;
        clearTimeout(timeout);this.lastSeen=performance.now();
        this.change("connected","接続しました。ファイターを選び、双方が準備完了にしてください。");
        this.send({type:"hello"});this.setFighter(this.selfFighter||D.cast[0]);
        this.timer=setInterval(()=>{
          if(!c.open)return;
          const now=performance.now();this.send({type:"ping",at:now});
          if(now-this.lastSeen>10000)this.fail("相手との通信が途切れました。対戦結果は確定せず終了します。");
        },1000);
      });
      c.on("data",data=>{if(this.conn===c)this.receive(data);});
      c.on("close",()=>{if(this.conn===c && !this.disposed)this.fail("相手が退出したか、接続が切れました。");});
      c.on("error",()=>{if(this.conn===c && !this.disposed)this.fail("通信が切れました。接続し直してください。");});
    }
    setFighter(record) {
      if(!record)return;
      const next=fighter(record),changed=JSON.stringify(next)!==JSON.stringify(this.selfFighter);
      this.selfFighter=next;
      if(changed){this.localReady=false;this.remoteReady=false;}
      this.send({type:"fighter",fighter:next});this.callbacks.status?.(this);
    }
    ready() {
      if(this.status!=="connected" || !this.remoteFighter)return;
      this.localReady=true;this.send({type:"ready"});this.callbacks.status?.(this);this.maybeStart();
    }
    maybeStart() {
      if(this.side===0 && this.status==="connected" && this.localReady && this.remoteReady) {
        const delay=D.clamp(Math.ceil(this.rtt/2/16.667)+1,3,5);
        this.begin({type:"start",id:token(),fighters:[this.selfFighter,this.remoteFighter],delay,seed:crypto.getRandomValues(new Uint32Array(1))[0]},true);
      }
    }
    begin(message,broadcast=false) {
      if(this.status!=="connected" || !this.localReady || !this.remoteReady || !Number.isInteger(message.seed) || message.seed<0 || message.seed>0xffffffff)return;
      if(broadcast)this.send(message);
      this.round=message.id;this.change("battle","対戦中");
      const fighters=message.fighters.map(fighter);
      this.callbacks.start?.({fighters,side:this.side,delay:D.clamp(message.delay,3,5),seed:message.seed});
    }
    receive(data) {
      if(!data || typeof data!=="object" || data.v!==VERSION)return;
      this.lastSeen=performance.now();
      try {
        if(data.type==="ping"){this.send({type:"pong",at:data.at});return;}
        if(data.type==="pong"){if(Number.isFinite(data.at))this.rtt=Math.round(D.clamp(performance.now()-data.at,0,5000));this.callbacks.status?.(this);return;}
        if(data.type==="hello"){this.send({type:"fighter",fighter:this.selfFighter||D.cast[0]});return;}
        if(data.type==="fighter" && this.status==="connected") {
          const next=fighter(data.fighter),changed=JSON.stringify(next)!==JSON.stringify(this.remoteFighter);
          this.remoteFighter=next;if(changed){this.localReady=false;this.remoteReady=false;}this.callbacks.status?.(this);return;
        }
        if(data.type==="ready" && this.status==="connected"){this.remoteReady=true;this.callbacks.status?.(this);this.maybeStart();return;}
        if(data.type==="start" && this.side===1 && this.status==="connected" && Array.isArray(data.fighters) && data.fighters.length===2 && typeof data.id==="string") {this.begin(data);return;}
        if(data.round===this.round && this.status==="battle" && ["input","hash"].includes(data.type))this.core?.receive(data);
      }catch {this.fail("対戦情報を読み込めませんでした。接続し直してください。");}
    }
    attachMatch(match,options) {
      this.core=new D.Rollback(match,{side:this.side,delay:options.delay,send:p=>this.send({...p,round:this.round}),onEvents:options.onEvents,onError:m=>this.fail(m)});
      this.stallSince=0;return this.core;
    }
    health() {
      if(!this.core || this.status!=="battle")return;
      if(this.core.canAdvance())this.stallSince=0;
      else if(!this.stallSince)this.stallSince=performance.now();
      else if(performance.now()-this.stallSince>10000)this.fail("対戦の進行を同期できませんでした。接続し直してください。");
    }
    fail(message) {
      const wasBattle=this.status==="battle";
      this.close();this.change("error",message);this.callbacks.error?.(message,wasBattle);
    }
    close() {
      this.disposed=true;clearInterval(this.timer);clearTimeout(this.openTimer);clearTimeout(this.connectTimer);
      const conn=this.conn,peer=this.peer;this.conn=null;this.peer=null;
      conn?.close();peer?.destroy();
      this.core=null;this.round=null;this.localReady=false;this.remoteReady=false;this.remoteFighter=null;this.code="";this.stallSince=0;
      this.status="idle";
      this.message="";
    }
  }
  D.Online=Online;D.onlineFighter=fighter;
})(Dojo);

