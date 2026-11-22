(function(D){
  'use strict';
  // A muted video remains eligible for inline mobile playback. Its original mix
  // follows the displayed media clock through the game's existing audio bus.
  let ctx,bus,load,session=null,epoch=0;
  const sounds=new Map();
  function ensure(src){
    if(!ctx||sounds.has(src))return;
    const entry={buffer:null,error:false};sounds.set(src,entry);
    Promise.resolve().then(()=>load(src)).then(buffer=>{entry.buffer=buffer;},()=>{entry.error=true;});
  }
  function position(s){return s.node?Math.min(s.buffer.duration,s.offset+Math.max(0,ctx.currentTime-s.started)):s.played;}
  function halt(){
    if(!session?.node)return;
    session.played=Math.max(session.played,position(session));
    const node=session.node;session.node=null;try{node.stop();}catch{}
  }
  function hold(){halt();if(session)session.running=false;}
  function stop(){halt();epoch++;session=null;}
  function sync(event,time,running){
    const clip=D.movieFor(event);if(!ctx||!clip?.soundtrack){if(session)stop();return;}
    const id=event.serial+':'+event.a.index+':'+event.key;
    if(session?.id!==id){stop();session={id,src:clip.soundtrack,buffer:null,node:null,offset:0,started:0,played:0,running:false,starts:0,corrections:0,epoch};}
    const s=session;ensure(s.src);s.buffer=sounds.get(s.src)?.buffer;
    s.running=!!running;s.media=Math.max(0,time-clip.start);
    if(!running||ctx.state!=='running'||!s.buffer){halt();return;}
    const desired=Math.min(s.buffer.duration,s.media);
    if(desired>=s.buffer.duration-.008){halt();return;}
    if(s.node&&Math.abs(position(s)-desired)>.09){halt();s.corrections++;}
    // A small backward network correction waits for the picture to catch up;
    // it must not replay a character hit or the final accent a second time.
    if(s.node||desired+.025<s.played)return;
    const offset=Math.max(desired,s.played);if(offset>=s.buffer.duration-.008)return;
    const node=ctx.createBufferSource(),gain=ctx.createGain();gain.gain.value=.78;
    node.buffer=s.buffer;node.assetUrl=s.src;node.connect(gain).connect(bus);
    s.node=node;s.offset=offset;s.started=ctx.currentTime;s.starts++;
    node.onended=()=>{gain.disconnect?.();if(session===s&&s.node===node){s.played=Math.max(s.played,s.buffer.duration);s.node=null;}};
    node.start(0,offset);
  }
  D.CutInSound={attach(context,output,loader){ctx=context;bus=output;load=loader;},
    prepare(fighters){for(const f of fighters){const src=D.cutins[f.id]?.soundtrack;if(src){if(sounds.get(src)?.error)sounds.delete(src);ensure(src);}}},
    ready:src=>!ctx||!!sounds.get(src)?.buffer||!!sounds.get(src)?.error,
    sync,hold,stop,status:()=>session?{id:session.id,src:session.src,running:session.running,playing:!!session.node,media:session.media,position:position(session),starts:session.starts,corrections:session.corrections,error:!!sounds.get(session.src)?.error}:{playing:false}};
})(Dojo);
