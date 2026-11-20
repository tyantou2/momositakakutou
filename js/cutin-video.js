(function(D) {
  "use strict";
  const CLIP_END=3.75;
  const TITLE_TIME=800;
  const LOAD_LIMIT=450;
  const STALL_LIMIT=500;
  const video=document.getElementById("crush-video");
  let shot=null, state="idle", lastTime=0, stalled=0, clock=null, suspended=false, titleTime=0;
  function eligible(candidate) {
    return candidate?.a.data.id==="momokage" && candidate.key==="crush";
  }
  function stop() {
    shot=null;
    state="idle";
    video.pause();
    clock=null;
    suspended=false;
  }
  function fallback() {
    if(state==="idle" || state==="done" || state==="title") return;
    state="fallback";
    video.pause();
  }
  function play(current) {
    try {
      const promise=video.play();
      if(promise) promise.catch(()=>{
        if(shot===current && !suspended) fallback();
      });
    } catch { fallback(); }
  }
  function start(candidate,animate=true) {
    stop();
    if(!eligible(candidate) || !animate) return;
    shot=candidate;
    state="title";
    titleTime=0;
    lastTime=0;
    stalled=0;
    try {
      video.currentTime=0;
      video.playbackRate=1;
    } catch { fallback(); }
  }
  function update(candidate,paused,now) {
    if(shot && candidate!==shot) stop();
    if(!shot || state==="fallback") return "fallback";
    if(paused) {
      if(!suspended) video.pause();
      suspended=true;
      clock=null;
      return "hold";
    }
    if(suspended) {
      suspended=false;
      if(state!=="title") play(shot);
    }
    const elapsed=clock===null?0:Math.min(100,now-clock);
    clock=now;
    if(state==="title") {
      titleTime+=elapsed;
      if(titleTime>=TITLE_TIME) {
        state="loading";
        play(shot);
      }
      return "hold";
    }
    if(video.error) fallback();
    if(state==="fallback") return "fallback";
    if(video.ended || video.currentTime>=CLIP_END) {
      state="done";
      video.pause();
      return "done";
    }
    if(video.currentTime>lastTime+.001) {
      lastTime=video.currentTime;
      stalled=0;
      state="playing";
    } else stalled+=elapsed;
    if(stalled>(state==="loading"?LOAD_LIMIT:STALL_LIMIT)) {
      fallback();
      return "fallback";
    }
    return "hold";
  }
  function holds(candidate) {
    return candidate===shot && ["title","loading","playing"].includes(state);
  }
  function isVideo(candidate) {
    return candidate===shot && (state==="loading" || state==="playing");
  }
  function draw(c,candidate) {
    if(!holds(candidate)) return false;
    if(state==="title") {
      D.Art.cinematic(c,{...candidate,age:Math.min(54,titleTime/TITLE_TIME*58)},true);
      return true;
    }
    if(video.readyState<2 || !video.videoWidth) {
      D.Art.cinematic(c,{...candidate,age:54},true);
      return true;
    }
    const scale=Math.min(1280/video.videoWidth,650/video.videoHeight);
    const width=video.videoWidth*scale, height=video.videoHeight*scale;
    c.save();
    c.fillStyle="#201326";
    c.fillRect(0,0,1280,650);
    if(candidate.a.face<0) {
      c.translate(1280,0);
      c.scale(-1,1);
    }
    try {
      c.drawImage(video,(1280-width)/2,(650-height)/2,width,height);
    } catch {
      c.restore();
      fallback();
      return false;
    }
    // The last few frames brighten into the return to the live camera.
    c.globalAlpha=Math.max(0,(video.currentTime-(CLIP_END-.12))/.12)*.65;
    c.fillStyle="#fff1f7";
    c.fillRect(0,0,1280,650);
    c.restore();
    return true;
  }
  video.addEventListener("error",fallback);
  D.VideoCutIn={start,stop,update,holds,isVideo,draw};
})(Dojo);
