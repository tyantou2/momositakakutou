(function(root){
  "use strict";
  class Events {
    constructor(){this.handlers={};}
    on(name,fn){(this.handlers[name]||=[]).push(fn);return this;}
    emit(name,...args){for(const fn of this.handlers[name]||[])fn(...args);}
  }
  class Channel extends Events {
    constructor(peer){super();this.peer=peer;this.open=false;this.metadata={v:'dojo-3.9'};this.uuid=null;}
    send(data){if(!this.open||!this.peer.sdk.sendData({momoshita:data},this.uuid))throw Error('data channel unavailable');}
    close(){if(this.closed)return;this.closed=true;this.open=false;if(this.peer.channel===this)this.peer.channel=null;this.emit('close');}
  }
  class VdoPeer extends Events {
    constructor(id){
      super();this.id=id;this.destroyed=false;this.open=false;this.disconnected=false;this.channel=null;
      if(id)this.start(id);else queueMicrotask(()=>{if(!this.destroyed){this.open=true;this.emit('open');}});
    }
    connect(id){const c=this.channel=new Channel(this);this.start(id);return c;}
    async start(id){
      const sdk=this.sdk=new root.VDONinjaSDK({password:id,salt:'momoshita-v39'});
      sdk.addEventListener('dataChannelOpen',e=>{
        if(this.destroyed)return;
        let c=this.channel;
        if(c?.open||c?.closed)return;
        if(!c){c=this.channel=new Channel(this);this.emit('connection',c);}
        c.uuid=e.detail.uuid;c.open=true;c.emit('open');
      });
      sdk.addEventListener('dataReceived',e=>{
        const c=this.channel;if(c?.open&&e.detail.uuid===c.uuid&&e.detail.data?.momoshita)c.emit('data',e.detail.data.momoshita);
      });
      sdk.addEventListener('dataChannelClose',e=>{const c=this.channel;if(c?.open&&c.uuid===e.detail.uuid)c.close();});
      try{
        const controller=await sdk.autoConnect({room:id});
        if(this.destroyed){controller.stop();sdk.disconnect();return;}
        this.controller=controller;
        if(this.id){this.open=true;this.emit('open');}
      }catch(e){if(!this.destroyed)this.emit('error',{type:'network',cause:e});}
    }
    destroy(){this.destroyed=true;this.open=false;this.controller?.stop();this.channel?.close();this.sdk?.disconnect();}
  }
  root.VdoPeer=VdoPeer;
})(globalThis);

