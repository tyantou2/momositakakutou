(function(D) {
  "use strict";
  // Readiness/seek and actual decoded frames are separate from permission to play.
  const LIMIT={metadata:4000,seek:2200,start:2800,stall:2400,total:8000};
  const elements=Object.fromEntries(Object.values(D.cutins).map(c=>[c.element,document.getElementById(c.element)]));
  const records=new Map(),history=[];
  const cached=document.createElement("canvas");cached.width=1280;cached.height=650;
  const cache=cached.getContext("2d");
  let shot=null,clip=null,video=null,state="idle",reason=null,clock=null,titleTime=0;
  let epoch=0,request=0,pending=false,playResolved=false,externalPause=false,suspended=false;
  let hasFrame=false,seenFrame=false,frameTime=-1,frameCallback=null,frames=0,lastTime=0,maxTime=0;
  let seekTarget=null,needsSeek=false,lastSeek=-Infinity,wait=0,totalWait=0,retries=0,reloads=0,stallRetries=0,lastAttempt=-Infinity;
  let dialogueSent=false,cueSent=false,onlineAge=-1,ageIdle=0,reported=false;
  const active=()=>!!shot&&!['idle','done','fallback'].includes(state);
  const same=s=>!!shot&&!!s&&s.serial===shot.serial&&s.key===shot.key&&s.a.index===shot.a.index&&s.a.data.id===shot.a.data.id;
  function attributes(v){v.muted=true;v.defaultMuted=true;v.playsInline=true;v.setAttribute?.('muted','');v.setAttribute?.('playsinline','');v.setAttribute?.('webkit-playsinline','');v.disablePictureInPicture=true;}
  function pause(){request++;pending=false;playResolved=false;video?.pause();}
  function cancelFrames(){if(frameCallback!==null)video?.cancelVideoFrameCallback?.(frameCallback);frameCallback=null;}
  function report(outcome){if(!shot||reported)return;reported=true;history.push({character:shot.a.data.id,key:shot.key,serial:shot.serial,outcome,reason,frames,maxTime,retries,reloads,position:video?.currentTime,requestedSeek:seekTarget,seeking:video?.seeking,readyState:video?.readyState});if(history.length>30)history.shift();}
  function stop(){if(active())report(onlineAge>=0&&onlineAge>=clip.frames-8&&hasFrame&&maxTime>=clip.end-.20?'completed':'interrupted');cancelFrames();pause();epoch++;shot=clip=video=null;state='idle';clock=null;hasFrame=seenFrame=false;}
  function fail(why){if(!active())return;reason=why;state='fallback';cancelFrames();pause();report('fallback');}
  function progress(){wait=0;}
  function watchFrames(token){
    if(!video?.requestVideoFrameCallback)return;
    frameCallback=video.requestVideoFrameCallback((_,meta)=>{
      frameCallback=null;if(token!==epoch||!active())return;
      if(!video.seeking&&meta.mediaTime>=clip.start-.05&&meta.mediaTime<clip.end+.05){
        if(meta.mediaTime!==frameTime){frames++;progress();}frameTime=meta.mediaTime;seenFrame=true;maxTime=Math.max(maxTime,meta.mediaTime);
      }
      watchFrames(token);
    });
  }
  function attempt(now){
    if(!active()||pending||suspended||externalPause||now-lastAttempt<150)return;
    const token=epoch,ticket=++request;lastAttempt=now;pending=true;attributes(video);
    function rejected(error){
      if(token!==epoch||ticket!==request||!active())return;pending=false;
      if(error?.name==='AbortError'){if(++retries>3)fail('play-aborted');return;}
      if(error?.name==='NotAllowedError'&&retries++===0){attributes(video);return;}
      fail('play-'+(error?.name||'error'));
    }
    try{const promise=video.play();if(promise?.then)promise.then(()=>{if(token!==epoch||ticket!==request||!active())return;pending=false;playResolved=true;},rejected);else{pending=false;playResolved=true;}}catch(error){rejected(error);}
  }
  function seek(target,now){
    if(video.readyState<1||video.seeking)return false;
    if(Math.abs(video.currentTime-target)<.025&&!video.ended){needsSeek=false;return true;}
    try{seekTarget=target;lastSeek=now;seenFrame=false;frameTime=-1;playResolved=false;lastTime=target;video.currentTime=target;needsSeek=false;progress();return true;}catch{return false;}
  }
  function elapsed(now){const ms=clock===null?0:Math.min(100,Math.max(0,now-clock));clock=now;return ms;}
  function pump(target,now,ms,online=false){
    if(!active())return;
    if(video.error){
      if(video.error.code===2&&reloads++===0){pause();video.load();needsSeek=true;seekTarget=null;state='preparing';progress();}
      else{fail('media-'+video.error.code);return;}
    }
    if(needsSeek&&video.readyState>=1)seek(target,now);
    if(seekTarget!==null&&!video.seeking&&video.readyState>=2&&(Math.abs(video.currentTime-seekTarget)<.10||!video.paused&&video.currentTime>=seekTarget)){seekTarget=null;state='starting';progress();}
    if(video.readyState<1||needsSeek||seekTarget!==null||video.seeking){
      wait+=ms;totalWait+=ms;
      if(wait>(video.readyState<1?LIMIT.metadata:LIMIT.seek)||totalWait>LIMIT.total)fail(video.readyState<1?'metadata-timeout':'seek-timeout');
      return;
    }
    if(state==='preparing')state='starting';
    if((!online||!suspended)&&!playResolved&&!pending)attempt(now);
    const moved=video.currentTime>lastTime+.002;
    if(!video.requestVideoFrameCallback&&video.readyState>=2&&(playResolved||moved)){seenFrame=true;if(moved)frames++;}
    if(moved){lastTime=video.currentTime;maxTime=Math.max(maxTime,video.currentTime);progress();}
    if(seenFrame&&video.readyState>=2){if(!online||!suspended)state=video.readyState>=3?'playing':'buffering';}
    if(!online&&hasFrame&&seenFrame&&!video.seeking&&(video.currentTime>=clip.end-.012||video.ended&&video.currentTime>=clip.end-.08)){
      state='done';cancelFrames();pause();report('completed');return;
    }
    if(!suspended&&!externalPause){
      if(!moved)wait+=ms;
      if(!seenFrame||video.readyState<3)totalWait+=ms;
      const limit=seenFrame?LIMIT.stall:LIMIT.start;
      if(wait>limit||totalWait>LIMIT.total){fail(seenFrame?'buffer-timeout':'first-frame-timeout');return;}
      if(wait>900&&video.paused&&!pending&&stallRetries++===0)attempt(now);
    }
    if(!online&&hasFrame&&seenFrame){
      if(!dialogueSent&&clip.dialogue&&video.currentTime>=clip.dialogue.time){dialogueSent=true;D.Audio.dialogueVoice(shot);}
      if(!cueSent&&clip.voice&&video.currentTime>=clip.end-clip.voiceLead){cueSent=true;D.Audio.superVoice(shot);}
    }
  }
  function start(candidate,animate=true){
    stop();const definition=D.movieFor(candidate);if(!definition||!animate)return;
    shot=candidate;clip=definition;video=elements[clip.element];state='title';reason=null;titleTime=0;clock=null;
    suspended=false;hasFrame=seenFrame=false;frameTime=-1;frames=0;maxTime=lastTime=clip.start;
    seekTarget=null;needsSeek=true;lastSeek=lastAttempt=-Infinity;wait=totalWait=retries=reloads=stallRetries=0;
    dialogueSent=cueSent=reported=playResolved=false;onlineAge=-1;ageIdle=0;
    if(!video){fail('missing-element');return;}
    const record=records.get(video);if(record)record.prime++;
    attributes(video);video.playbackRate=1;pause();watchFrames(epoch);
    // The name card supplies time for metadata and the initial seek, without playing the film.
    seek(clip.start,0);
  }
  function update(candidate,paused,now){
    if(shot&&!same(candidate))stop();else if(shot)shot=candidate;
    if(!active())return state==='done'?'done':'fallback';
    if(paused||externalPause){if(!suspended)pause();suspended=true;clock=null;return 'hold';}
    if(suspended){suspended=false;clock=null;}
    const ms=elapsed(now);
    if(state==='title'){
      titleTime+=ms;if(needsSeek&&video.readyState>=1)seek(clip.start,now);
      if(titleTime<clip.title)return 'hold';state='preparing';progress();
    }
    pump(clip.start,now,ms);
    return state==='done'?'done':state==='fallback'?'fallback':'hold';
  }
  function online(candidate,animate,running=true){
    if(!D.movieFor(candidate)||!animate){if(shot)stop();return;}
    if(!same(candidate))start(candidate,true);else shot=candidate;
    if(!active())return;
    const now=performance.now(),ms=elapsed(now);titleTime=candidate.age/60*1000;
    if(externalPause){if(!suspended)pause();suspended=true;clock=null;return;}
    if(candidate.age!==onlineAge){onlineAge=candidate.age;ageIdle=0;}else ageIdle+=ms;
    if(titleTime<clip.title){state='title';if(!suspended)pause();suspended=true;if(needsSeek&&video.readyState>=1)seek(clip.start,now);return;}
    const target=Math.min(clip.end-.025,clip.start+(titleTime-clip.title)/1000);
    if(state==='title'){state='preparing';needsSeek=true;seekTarget=null;progress();}
    // Brief prediction waits must not repeatedly abort a pending native play().
    const hold=(!running&&(ageIdle>150||video.currentTime>target+.10))||target>=clip.end-.026;
    if(hold&&!suspended)pause();suspended=hold;
    const buffered=!video.buffered||Array.from({length:video.buffered.length},(_,i)=>[video.buffered.start(i),video.buffered.end(i)]).some(([a,b])=>a<=target&&b>=Math.min(clip.end,target+.12));
    if(!hold&&!needsSeek&&seekTarget===null&&!video.seeking&&video.readyState>=2&&buffered&&Math.abs(video.currentTime-target)>.40&&now-lastSeek>450){seek(target,now);}
    pump(target,now,ms,true);
  }
  function holds(candidate){return same(candidate)&&active();}
  function isVideo(candidate){return holds(candidate)&&state!=='title'&&(hasFrame||seenFrame&&video.readyState>=2&&!video.seeking&&seekTarget===null);}
  function draw(c,candidate){
    if(!holds(candidate))return false;
    const valid=state!=='title'&&seenFrame&&video.readyState>=2&&!video.seeking&&seekTarget===null&&video.currentTime>=clip.start-.015&&video.currentTime<clip.end+.05;
    if(!valid){
      if(state!=='title'&&hasFrame){c.drawImage(cached,0,0);return true;}
      D.Art.cinematic(c,{...candidate,duration:D.RULES.cutIn,age:state==='title'?Math.min(54,titleTime/clip.title*58):54},true);return true;
    }
    const scale=Math.min(1280/video.videoWidth,650/video.videoHeight),w=video.videoWidth*scale,h=video.videoHeight*scale;
    if(!w||!h)return false;
    c.save();c.fillStyle='#201326';c.fillRect(0,0,1280,650);
    if(candidate.a.face<0){c.translate(1280,0);c.scale(-1,1);}
    try{c.drawImage(video,(1280-w)/2,(650-h)/2,w,h);}catch{c.restore();fail('draw-error');return false;}
    c.globalAlpha=Math.max(0,(video.currentTime-(clip.end-.12))/.12)*.65;
    c.fillStyle=candidate.key==='azure'?'#dfffff':'#fff1f7';c.fillRect(0,0,1280,650);c.restore();
    cache.drawImage(c.canvas,0,0,1280,650);hasFrame=true;return true;
  }
  function prepare(fighters,gesture=false){
    const needed=new Set(fighters.map(f=>D.cutins[f.id]?.element).filter(Boolean));
    for(const [id,element]of Object.entries(elements)){
      if(!element||!needed.has(id))continue;
      const record=records.get(element);attributes(element);element.preload='auto';
      if(!record.loaded||element.error){record.loaded=true;if(!shot||video!==element)element.load();}
      if(!gesture||record.primed||shot&&video===element)continue;
      record.primed=true;const token=++record.prime;
      try{element.play()?.then(()=>{if(token===record.prime&&(!shot||video!==element))element.pause();},()=>{if(token===record.prime)record.primed=false;});}catch{record.primed=false;}
    }
  }
  for(const element of Object.values(elements))if(element){
    records.set(element,{loaded:false,primed:false,prime:0});attributes(element);
    for(const name of ['loadedmetadata','loadeddata','canplay','seeked','progress'])element.addEventListener(name,()=>{if(element!==video||!active())return;if(name==='seeked'&&seekTarget!==null){seekTarget=null;if(state!=='title')state='starting';}if(!seenFrame||element.readyState<3||name==='seeked')progress();});
  }
  function suspend(value){externalPause=value;clock=null;if(value&&active()){pause();suspended=true;}}
  function canDialogue(event){return same(event)&&state==='playing'&&hasFrame&&seenFrame&&!video.seeking&&video.readyState>=2&&!video.error&&Math.abs(video.currentTime-clip.dialogue.time)<.36;}
  D.VideoCutIn={start,stop,update,online,holds,isVideo,draw,prepare,suspend,canDialogue,
    dialogueOffset:()=>clip?.dialogue?Math.max(0,video.currentTime-clip.dialogue.time):0,
    status:()=>({state,key:shot?.key,reason,hasFrame,seenFrame,time:video?.currentTime||0,frames,retries,seekPending:seekTarget!==null}),history:()=>history.map(x=>({...x}))};
})(Dojo);
