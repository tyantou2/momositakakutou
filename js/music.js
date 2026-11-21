(function(D){
  "use strict";
  const tracks={battle:{src:"assets/music/battle-cut-and-run.mp3",title:"Cut and Run",artist:"Kevin MacLeod",source:"https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100851"},crush:{src:"assets/music/crush-volatile-reaction.mp3",title:"Volatile Reaction",artist:"Kevin MacLeod",source:"https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400039"},rush:{src:"assets/music/rush-rocket-power.mp3",title:"Rocket Power",artist:"Kevin MacLeod",source:"https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1600038"}};
  let ctx,output,battleGain,cueGain,battleNode=null,cueNode=null,active=false,epoch=0,serial=null,currentEvent=null,volume=.65,duckUntil=0,returnAt=0;
  function attach(context,bus){if(ctx)return;ctx=context;output=bus;battleGain=ctx.createGain();cueGain=ctx.createGain();battleGain.connect(output);cueGain.connect(output);battleGain.gain.value=0;cueGain.gain.value=0;if(active)battle();}
  function ramp(gain,target,seconds=.18){if(!ctx)return;gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(target,ctx.currentTime,Math.max(.01,seconds/3));}
  function stopNode(node,after=.1){if(node)try{node.stop(ctx.currentTime+after);}catch{}}
  function levels(){
    if(!ctx)return;const now=ctx.currentTime,duck=now<duckUntil?.22:1,base=volume*.34*duck;
    if(active&&returnAt>now){
      battleGain.gain.cancelScheduledValues(now);battleGain.gain.setValueAtTime(0,now);battleGain.gain.setTargetAtTime(volume*.34,Math.max(now,returnAt-.42),.14);
      cueGain.gain.cancelScheduledValues(now);cueGain.gain.setValueAtTime(base,now);cueGain.gain.linearRampToValueAtTime(0,returnAt);
    }else{ramp(battleGain,active&&serial===null?base:0,.32);ramp(cueGain,active?base:0,.1);}
  }
  async function battle(){
    active=true;serial=null;returnAt=0;const ticket=++epoch;stopNode(cueNode);cueNode=null;
    if(!ctx)return;
    const buffer=await D.Audio.loadBuffer(tracks.battle.src).catch(()=>null);
    if(!buffer||!active||ticket!==epoch)return;
    stopNode(battleNode);battleNode=ctx.createBufferSource();battleNode.buffer=buffer;battleNode.loop=true;battleNode.assetUrl=tracks.battle.src;battleNode.connect(battleGain);battleNode.start();levels();
  }
  async function cutin(event,age=0){
    const clip=D.movieFor(event);if(!ctx||!active||!clip)return;
    const id=event.serial+":"+event.a.index+":"+event.key;if(serial===id)return;
    serial=id;currentEvent=event;returnAt=0;ramp(battleGain,0,.14);ramp(cueGain,0,.08);stopNode(cueNode,.10);cueNode=null;
    const started=ctx.currentTime-age/60;
    const buffer=await D.Audio.loadBuffer(tracks[event.key].src).catch(()=>null);
    if(!buffer||!active||serial!==id)return;
    const offset=Math.min(Math.max(0,ctx.currentTime-started),buffer.duration-.05);cueNode=ctx.createBufferSource();cueNode.buffer=buffer;cueNode.assetUrl=tracks[event.key].src;cueNode.connect(cueGain);cueNode.start(0,offset);
    cueNode.onended=()=>{if(serial===null){returnAt=0;levels();}};levels();
  }
  function release(event){
    if(!ctx||!serial||!D.movieFor(event))return;
    serial=null;
    const tail=event.prepared?Math.min(1.15,Math.max(.25,(cueNode?.buffer?.duration||0)-(D.movieFor(event).frames/60))):.35;
    returnAt=ctx.currentTime+tail;
    levels();
    stopNode(cueNode,tail+.03);
  }
  function duck(seconds){if(!ctx)return;duckUntil=Math.max(duckUntil,ctx.currentTime+seconds);levels();}
  function update(shot){if(!ctx||!active)return;if(D.movieFor(shot)){const id=shot.serial+":"+shot.a.index+":"+shot.key;if(serial!==id)cutin(shot,shot.age);}else if(serial)release({...currentEvent,prepared:false});if(duckUntil&&ctx.currentTime>=duckUntil){duckUntil=0;levels();}if(returnAt&&ctx.currentTime>=returnAt){returnAt=0;levels();}}
  function setVolume(value){volume=D.clamp(value,0,1);levels();}
  function stop(fade=.4){active=false;epoch++;serial=null;returnAt=0;if(ctx){ramp(battleGain,0,fade);ramp(cueGain,0,fade);stopNode(battleNode,fade+.02);stopNode(cueNode,fade+.02);}battleNode=cueNode=null;}
  function preload(){for(const track of Object.values(tracks))D.Audio.loadBuffer(track.src).catch(()=>{});}
  D.Music={attach,battle,cutin,release,duck,update,setVolume,stop,preload,tracks,status:()=>({active,serial,returnAt,duckUntil,volume,battle:!!battleNode,cue:!!cueNode,contextTime:ctx?.currentTime||0})};
})(Dojo);
