(function(D) {
  "use strict";
  const LOAD_LIMIT=450,STALL_LIMIT=500;
  const elements=Object.fromEntries(Object.values(D.cutins).map(clip=>[clip.element,document.getElementById(clip.element)]));
  const cached=document.createElement("canvas");cached.width=1280;cached.height=650;
  const cache=cached.getContext("2d");let hasFrame=false;
  let shot=null,clip=null,video=null,state="idle",lastTime=0,stalled=0,clock=null,suspended=false,titleTime=0,cueSent=false,dialogueSent=false,playEpoch=0;
  function pauseVideo(){playEpoch++;video?.pause();}
  function stop() {pauseVideo();shot=null;clip=null;state="idle";clock=null;suspended=false;hasFrame=false;}
  function fallback() {
    if(["idle","done","title"].includes(state))return;
    state="fallback";pauseVideo();
  }
  function play(current) {const ticket=++playEpoch;try{video.play()?.catch(error=>{if(shot===current && ticket===playEpoch && !suspended && error?.name!=="AbortError")fallback();});}catch{fallback();}}
  function start(candidate,animate=true) {
    stop();const definition=D.movieFor(candidate);
    if(!definition || !animate)return;
    shot=candidate;clip=definition;video=elements[clip.element];
    state="title";titleTime=0;lastTime=clip.start;stalled=0;cueSent=false;dialogueSent=false;
    if(!video){state="fallback";return;}
    try{video.currentTime=clip.start;video.playbackRate=1;}catch{fallback();}
  }
  function update(candidate,paused,now) {
    if(shot && candidate!==shot)stop();
    if(!shot || state==="fallback")return "fallback";
    if(paused){if(!suspended)pauseVideo();suspended=true;clock=null;return "hold";}
    if(suspended){suspended=false;if(state!=="title")play(shot);}
    const elapsed=clock===null?0:Math.min(100,now-clock);clock=now;
    if(state==="title") {
      titleTime+=elapsed;
      if(titleTime>=clip.title){state="loading";play(shot);}
      return "hold";
    }
    if(video.error)fallback();
    if(state==="fallback")return "fallback";
    if(!dialogueSent&&clip.dialogue&&video.currentTime>=clip.dialogue.time){dialogueSent=true;D.Audio.dialogueVoice(shot);}
    if(!cueSent && video.currentTime>=clip.end-clip.voiceLead){cueSent=true;D.Audio.superVoice(shot);}
    if(video.ended || video.currentTime>=clip.end){state="done";pauseVideo();return "done";}
    if(video.currentTime>lastTime+.001){lastTime=video.currentTime;stalled=0;state="playing";}else stalled+=elapsed;
    if(stalled>(state==="loading"?LOAD_LIMIT:STALL_LIMIT)){fallback();return "fallback";}
    return "hold";
  }
  function holds(candidate){return candidate===shot && ["title","loading","playing"].includes(state);}
  function isVideo(candidate){return candidate===shot && ["loading","playing"].includes(state);}
  function draw(c,candidate) {
    if(!holds(candidate))return false;
    if(state==="title" || video.readyState<2 || !video.videoWidth || video.seeking || video.currentTime<clip.start) {
      if(state!=="title" && hasFrame){c.drawImage(cached,0,0);return true;}
      const age=state==="title"?Math.min(54,titleTime/clip.title*58):54;
      D.Art.cinematic(c,{...candidate,duration:D.RULES.cutIn,age},true);return true;
    }
    const scale=Math.min(1280/video.videoWidth,650/video.videoHeight),width=video.videoWidth*scale,height=video.videoHeight*scale;
    c.save();c.fillStyle="#201326";c.fillRect(0,0,1280,650);
    if(candidate.a.face<0){c.translate(1280,0);c.scale(-1,1);}
    try{c.drawImage(video,(1280-width)/2,(650-height)/2,width,height);}catch{c.restore();fallback();return false;}
    c.globalAlpha=Math.max(0,(video.currentTime-(clip.end-.12))/.12)*.65;
    c.fillStyle="#fff1f7";c.fillRect(0,0,1280,650);c.restore();
    cache.drawImage(c.canvas,0,0,1280,650);hasFrame=true;return true;
  }
  for(const element of Object.values(elements))element?.addEventListener("error",()=>{if(element===video)fallback();});
  function online(candidate,animate,running=true) {
    if(!D.movieFor(candidate) || !animate){if(shot)stop();return;}
    if(!shot || shot.serial!==candidate.serial || shot.key!==candidate.key)start(candidate,true);else shot=candidate;
    titleTime=candidate.age/60*1000;
    if(state==="fallback")return;
    if(titleTime<clip.title){state="title";suspended=true;pauseVideo();return;}
    if(video.error){state="loading";fallback();return;}
    const target=Math.min(clip.end-.025,clip.start+(titleTime-clip.title)/1000);
    if(state==="title"){state="loading";try{video.currentTime=target;}catch{fallback();return;}}
    if(video.readyState>=2){if(!video.seeking && Math.abs(video.currentTime-target)>.12)video.currentTime=target;state="playing";}
    suspended=!running || target>=clip.end-.026;
    if(suspended)pauseVideo();else if(video.paused)play(candidate);
  }
  function canDialogue(event){return !!shot&&event.serial===shot.serial&&event.key===shot.key&&state==="playing"&&hasFrame&&video.readyState>=2&&!video.error&&Math.abs(video.currentTime-clip.dialogue.time)<.36;}
  D.VideoCutIn={start,stop,update,holds,isVideo,draw,online,canDialogue,dialogueOffset:()=>clip?.dialogue?Math.max(0,video.currentTime-clip.dialogue.time):0,status:()=>({state,hasFrame,time:video?.currentTime||0})};
})(Dojo);
