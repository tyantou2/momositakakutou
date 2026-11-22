(function(D) {
  "use strict";
  const actions=new Set(["light","heavy","jump","back","spot","special","skillA","skillB"]);
  const blank=()=>({axis:0,guard:false,action:null});
  const clean=c=>({axis:c?.axis===-1?-1:c?.axis===1?1:0,guard:c?.guard===true,action:actions.has(c?.action)?c.action:null});
  const same=(a,b)=>a.axis===b.axis && a.guard===b.guard && a.action===b.action;
  const save=m=>structuredClone({fighters:m.fighters,phase:m.phase,ready:m.ready,seconds:m.seconds,freeze:m.freeze,frame:m.frame,cinematics:m.cinematics,ai:m.ai,result:m.result,seed:m.seed,world:m.world});
  function restore(m,state){Object.assign(m,structuredClone(state));for(const f of m.fighters)if(f.attack)f.attack.move=D.moves[f.attack.key];m.events=[];}
  function hash(state) {
    const data=[state.phase,state.ready,state.frame,state.freeze,state.seconds,state.cinematics.map(c=>[c.serial,c.age]),state.fighters.map(f=>[
      f.x,f.lift,f.vy,f.hp,f.stamina,f.meter,f.used,f.guard,f.stun,f.exhaustion,f.landing,f.dodge,f.dodgeInputFrame,f.perfectLock,f.opening,f.knock,f.recovery,
      f.attack && [f.attack.key,f.attack.age,f.attack.spent,f.attack.connected?.index,f.attack.defense && [f.attack.defense.guard,f.attack.defense.dodge,f.attack.defense.perfect,f.attack.defense.resolved],f.attack.id,f.attack.travelFace,f.attack.targetX,f.attack.spawned],f.buffer,f.tally,f.shift]),state.seed,state.world];
    const str=JSON.stringify(data);let n=2166136261;
    for(let i=0;i<str.length;i++)n=Math.imul(n^str.charCodeAt(i),16777619);
    return (n>>>0).toString(16);
  }
  class Rollback {
    constructor(match,{side,delay=3,maxPrediction=8,send=()=>{},onEvents=()=>{},onError=()=>{}}) {
      Object.assign(this,{match,side,delay,maxPrediction,send,onEvents,onError});
      this.frame=0;this.confirmed=-1;this.remoteThrough=delay-1;this.rollbacks=0;
      this.local=new Map();this.remote=new Map();this.history=new Map();this.events=new Map();this.used=new Map();this.hashes=new Map();this.peerHashes=new Map();
      for(let i=0;i<delay;i++){this.local.set(i,blank());this.remote.set(i,blank());}
    }
    canAdvance() {return this.frame<=this.remoteThrough+this.maxPrediction;}
    predicted(frame) {
      for(let i=frame-1;i>=Math.max(0,frame-250);i--) {
        if(this.remote.has(i)) {const c=this.remote.get(i);return {...c,action:null};}
      }
      return blank();
    }
    simulate(frame) {
      this.history.set(frame,save(this.match));
      const a=this.local.get(frame)||blank(),b=this.remote.get(frame)||this.predicted(frame);
      this.used.set(frame,b);
      this.match.tick(this.side===0?a:b,this.side===0?b:a);
      this.events.set(frame,this.match.drain().map(e=>({...e,a:e.a?.index,b:e.b?.index})));
    }
    advance(input) {
      if(!this.canAdvance())return false;
      const target=this.frame+this.delay;
      this.local.set(target,clean(input));
      const entries=[];
      for(let f=Math.max(0,target-7);f<=target;f++)if(this.local.has(f))entries.push([f,this.local.get(f)]);
      this.send({type:"input",entries});
      this.simulate(this.frame++);this.commit();return true;
    }
    receive(packet) {
      if(packet?.type==="hash") {
        if(Number.isInteger(packet.frame) && typeof packet.hash==="string") {
          this.peerHashes.set(packet.frame,packet.hash);this.compareHash(packet.frame);
        }
        return;
      }
      if(packet?.type!=="input" || !Array.isArray(packet.entries) || packet.entries.length>8)return;
      let earliest=Infinity;
      for(const entry of packet.entries) {
        if(!Array.isArray(entry) || entry.length!==2)continue;
        const [f,raw]=entry;
        if(!Number.isInteger(f) || f<Math.max(0,this.frame-240) || f>this.frame+300)continue;
        const cmd=clean(raw),known=this.remote.get(f);
        if(known && !same(known,cmd)){this.onError("入力の整合性を確認できませんでした。もう一度接続してください。");return;}
        this.remote.set(f,cmd);
        if(f<this.frame && this.used.has(f) && !same(this.used.get(f),cmd))earliest=Math.min(earliest,f);
      }
      while(this.remote.has(this.remoteThrough+1))this.remoteThrough++;
      if(earliest<Infinity) {
        const snapshot=this.history.get(earliest);
        if(!snapshot || earliest<=this.confirmed){this.onError("同期を維持できませんでした。もう一度接続してください。");return;}
        restore(this.match,snapshot);
        for(let f=earliest;f<this.frame;f++)this.simulate(f);
        this.rollbacks++;
      }
      this.commit();
    }
    compareHash(frame) {
      if(this.hashes.has(frame) && this.peerHashes.has(frame) && this.hashes.get(frame)!==this.peerHashes.get(frame))this.onError("対戦の同期がずれました。対戦を終了して接続し直してください。");
    }
    commit() {
      const end=Math.min(this.frame-1,this.remoteThrough);
      while(this.confirmed<end) {
        const f=++this.confirmed;
        const events=(this.events.get(f)||[]).map(e=>({...e,a:this.match.fighters[e.a]||null,b:this.match.fighters[e.b]||null}));
        if(events.length)this.onEvents(events);
        if(f%60===59) {
          const state=this.history.get(f+1)||save(this.match),digest=hash(state);
          this.hashes.set(f,digest);this.send({type:"hash",frame:f,hash:digest});this.compareHash(f);
        }
      }
      const floor=this.confirmed-20;
      for(const map of [this.history,this.events,this.used])for(const f of map.keys())if(f<floor)map.delete(f);
      for(const map of [this.local,this.remote,this.hashes,this.peerHashes])for(const f of map.keys())if(f<this.frame-240)map.delete(f);
    }
  }
  D.Rollback=Rollback;D.netState={save,hash,clean,restore};
})(globalThis.Dojo);
