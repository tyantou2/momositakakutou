(function(D) {
  "use strict";
  let audio, noise, muted=false,sfxBus,voiceBus,musicBus,masterGain,paused=false,hidden=false,generation=0;
  const buffers=new Map();
  let volumes={bgmVolume:.65,sfxVolume:.8,voiceVolume:1};
  const voices = new Set();
  const builtIn = new Set(["momokage","momonosuke"]);
  let introTimer=0;
  let duckUntil=0;
  const announced=new Set(),superClips=new Map();
  for(const clip of Object.values(D.cutins).filter(c=>c.voice)){const track=new Audio(clip.voice);track.preload="auto";superClips.set(clip.voice,track);}
  let lastCallout=new WeakMap();
  function init() {
    if (muted && !audio) return;
    try {
      if (!audio) {
        const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return;
        audio=new Context();const master=audio.createDynamicsCompressor();master.threshold.value=-5;master.knee.value=12;master.ratio.value=4;masterGain=audio.createGain();master.connect(masterGain).connect(audio.destination);
        sfxBus=audio.createGain();voiceBus=audio.createGain();musicBus=audio.createGain();sfxBus.connect(master);voiceBus.connect(master);musicBus.connect(master);
        D.Music?.attach(audio,musicBus);D.CutInSound?.attach(audio,sfxBus,loadBuffer);configure(volumes);
        for(const id of builtIn)for(const tag of Object.keys(D.voiceSlots))loadBuffer("assets/"+id+"-"+tag+".mp3?v=2.3").catch(()=>{});
        for(const clip of Object.values(D.cutins)){if(clip.voice)loadBuffer(clip.voice).catch(()=>{});if(clip.dialogue)loadBuffer(clip.dialogue.src).catch(()=>{});}
        D.Music?.preload();
      }
      if(audio.state==="suspended"&&!paused&&!hidden)audio.resume().catch(()=>{});
    } catch { /* Web Audio is optional for gameplay. */ }
  }
  function configure(options){volumes={...volumes,...options};if(sfxBus)sfxBus.gain.value=volumes.sfxVolume;if(voiceBus)voiceBus.gain.value=volumes.voiceVolume*1.25;D.Music?.setVolume(volumes.bgmVolume);}
  async function loadBuffer(src){
    if(buffers.has(src))return buffers.get(src);
    if(!audio)throw Error("Audio context not initialized");
    const pending=fetch(src).then(r=>{if(!r.ok)throw Error("Audio unavailable");return r.arrayBuffer();}).then(b=>audio.decodeAudioData(b));
    buffers.set(src,pending);pending.catch(()=>buffers.delete(src));
    if(buffers.size>40)for(const key of buffers.keys()){if(!key.includes('/music/')&&key!==src){buffers.delete(key);break;}}
    return pending;
  }
  function stopVoices() {
    generation++;
    clearTimeout(introTimer);
    for(const clip of voices){if(clip.stop){try{clip.stop();}catch{}}else clip.pause();}
    voices.clear();
  }
  function mute(value) {
    muted=value;
    if(masterGain)masterGain.gain.value=muted?0:1;
    if (value) {
      stopVoices();
    } else init();
  }
  async function voice(data,offset=0) {
    if (muted || !data) return false;
    const token=generation,requested=performance.now();
    if(audio && location.protocol!=="file:") {
      try {
        const buffer=await loadBuffer(data),late=offset+(performance.now()-requested)/1000;
        if(muted||hidden||token!==generation||late>buffer.duration-.08)return false;
        const clip=audio.createBufferSource();clip.buffer=buffer;clip.assetUrl=data;clip.connect(voiceBus);clip.onended=()=>voices.delete(clip);voices.add(clip);
        D.Music?.duck(buffer.duration-late+.08);clip.start(0,Math.max(0,late));return true;
      }catch{if(token!==generation||muted||hidden)return false;}
    }
    const clip=superClips.get(data)||new Audio(data);
    if(superClips.has(data)){clip.currentTime=0;clip.volume=.96*volumes.voiceVolume;}else clip.volume=(data.startsWith("assets/")?.82:.66)*volumes.voiceVolume;
    if(offset>0)try{clip.currentTime=offset;}catch{}
    const forget=()=>voices.delete(clip);
    clip.onended=forget;
    clip.onerror=forget;
    if (voices.size>=3) {
      const oldest=voices.values().next().value;
      if(oldest.stop){try{oldest.stop();}catch{}}else oldest.pause();
      voices.delete(oldest);
    }
    voices.add(clip);
    D.Music?.duck(1);
    try { await clip.play(); return true; } catch { forget(); return false; }
  }
  function tone(freq,end,length,amp,shape="sine",delay=0) {
    if (muted || !audio || audio.state!=="running") return;
    const t=audio.currentTime+delay;
    if(performance.now()<duckUntil)amp*=.38;
    const osc=audio.createOscillator(), gain=audio.createGain();
    osc.type=shape;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(end,t+length);
    gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(amp,t+.009);gain.gain.exponentialRampToValueAtTime(.001,t+length);
    osc.connect(gain).connect(sfxBus||audio.destination);osc.start(t);osc.stop(t+length);
  }
  function thump(length,amp,freq) {
    if (muted || !audio || audio.state!=="running") return;
    if(performance.now()<duckUntil)amp*=.38;
    if (!noise) {
      noise=audio.createBuffer(1, Math.floor(audio.sampleRate*.24), audio.sampleRate);
      const out=noise.getChannelData(0);
      for(let i=0;i<out.length;i++) out[i]=Math.random()*2-1;
    }
    const t=audio.currentTime;
    const src=audio.createBufferSource(), filter=audio.createBiquadFilter(), gain=audio.createGain();
    src.buffer=noise;filter.type="lowpass";filter.frequency.setValueAtTime(freq,t);
    filter.frequency.exponentialRampToValueAtTime(140,t+length);
    gain.gain.setValueAtTime(amp,t);gain.gain.exponentialRampToValueAtTime(.001,t+length);
    src.connect(filter).connect(gain).connect(sfxBus||audio.destination);src.start(t);src.stop(t+length);
  }
  function characterVoice(f,tag) {
    return f.data.voice[tag]?.data || (builtIn.has(f.data.id)?"assets/"+f.data.id+"-"+tag+".mp3?v=2.3":null);
  }
  function callout(f,tag) {
    if(!f) return;
    const slow=tag==="attack" || tag==="damage";
    const now=performance.now();
    if(slow && now<duckUntil)return;
    if(slow && now-(lastCallout.get(f) ?? -Infinity)<960) return;
    lastCallout.set(f,now);
    voice(characterVoice(f,tag));
  }
  function intro([a,b]) {
    if (muted) return;
    callout(a,"start");
    introTimer=setTimeout(()=>callout(b,"start"),characterVoice(a,"start")?1430:0);
  }
  function event(e,videoCutIn=false) {
    if(e.type==="cutinDialogue"){dialogueVoice(e);return;}
    if(e.type==="specialVoice"){superVoice(e);return;}
    if(e.type==='azureRelease'&&e.prepared&&D.movieFor(e)?.soundtrack)return;
    if(e.type==="crushRelease" || e.type==="rushRelease")superVoice(e);
    if (muted) return;

    switch(e.type) {
      case "fight": tone(415,622,.19,.13,"triangle"); break;
      case "swing": thump(.11,e.key==="heavy"?.11:.064,1800); callout(e.a,"attack"); break;
      case "special":
        if(videoCutIn&&D.movieFor(e)?.soundtrack)break;
        if(e.key==='morph'){tone(170,520,.42,.09,'triangle');tone(330,680,.32,.07,'sine',.18);break;}
        if(e.key==="azure") {tone(180,1000,.35,.13,"sawtooth");tone(740,1480,.20,.08,"sine",.15);break;}
        if(D.movieFor(e)) {
          tone(80,210,.80,.11,"sine");thump(.18,.10,1000);break;
        }
        tone(220,659,.26,.14,"triangle");tone(440,932,.18,.09,"sine",.08);callout(e.a,"special");break;
      case "crushRelease": thump(.13,.12,1400);tone(145,360,.13,.11,"triangle");break;
      case "rushRelease": thump(.10,.10,1900);tone(280,650,.10,.10,"triangle");break;
      case "azureRelease": thump(.10,.11,2100);tone(420,1080,.12,.10,"triangle");break;
      case 'transform': if(e.prepared)break;thump(.22,.12,e.form==='thermae'?700:1900);tone(e.form==='thermae'?240:520,e.form==='thermae'?520:230,.22,.09,'triangle');break;
      case 'transformEnd': thump(.17,.06,1000);break;
      case 'wallBuild': thump(.25,.16,400);tone(90,45,.22,.10,'triangle');break;
      case 'wallHit': thump(.10,.11,1100);break;
      case 'wallBreak': case 'wallFade': thump(.20,.09,1800);break;
      case 'geyserBurst': thump(.34,.15,3000);tone(220,430,.20,.06,'sine');break;
      case 'gunshot': thump(.075,.15,4300);tone(175,72,.10,.10,'triangle');break;
      case 'skill': if(e.key==='flank'){thump(.08,.07,2100);tone(160,620,.13,.06,'sine');}else if(e.key==='geyser')tone(280,360,.10,.05,'sine');else if(e.key==='shot')thump(.04,.05,2700);break;
      case "hit":
      case "break":
      case "counter":
        thump(e.crush?.23:e.heavy?.2:.105,.35,2150);
        tone(e.heavy?137:174,48,e.heavy?.18:.09,.28,"triangle");
        if(e.crush) { tone(76,28,.34,.28,"sine");tone(240,70,.11,.10,"triangle"); }
        if(e.azure) {tone(e.finisher?95:620,e.finisher?30:220,e.finisher?.29:.10,.15,"triangle");}
        if(e.rushFinish){tone(100,42,.18,.17,"triangle");thump(.13,.12,1800);}
        callout(e.b,"damage");break;
      case "block": thump(.1,.19,870);tone(790,480,.1,.14,"triangle");break;
      case "step": thump(.10,.080,e.key==="back"?1340:880); break;
      case "jump": tone(136,260,.10,.075,"triangle");break;
      case "tired": tone(216,86,.33,.15,"triangle");break;
      case "evade": tone(410,811,.13,.085,"sine");break;
      case "perfect": tone(410,822,.19,.12,"triangle");tone(690,1160,.19,.10,"sine",.075);break;
      case "over": tone(233,392,.21,.12,"triangle");tone(349,523,.35,.13,"triangle",.12);callout(e.a,"win");break;
    }
  }
  function superVoice(event) {
    const clip=D.movieFor(event);if(!clip?.voice)return;
    const key=event.serial+":"+event.a.index+":"+event.key;
    if(announced.has(key))return;
    announced.add(key);
    if(muted)return;
    stopVoices();duckUntil=performance.now()+clip.voiceDuration*1000+80;
    voice(clip.voice);
  }
  function resetSupers(){announced.clear();duckUntil=0;}
  function dialogueVoice(event){
    const clip=D.movieFor(event),line=clip?.dialogue;if(!line)return;
    const key=event.serial+":"+event.a.index+":dialogue";
    if(announced.has(key))return;announced.add(key);
    if(muted||!D.VideoCutIn?.canDialogue(event))return;
    const offset=D.VideoCutIn.dialogueOffset?.(event)||0;
    if(offset>line.duration-.08)return;
    duckUntil=performance.now()+(line.duration-offset)*1000+80;voice(line.src,offset);
  }
  function setPaused(value){paused=value;if(audio){if(paused)audio.suspend().catch(()=>{});else init();}}
  function visibility(value){hidden=!value;if(hidden){stopVoices();if(audio)audio.suspend().catch(()=>{});}else if(!paused)init();}
  D.Audio={init,mute,voice,event,intro,stopVoices,superVoice,dialogueVoice,resetSupers,configure,loadBuffer,setPaused,visibility,status:()=>({state:audio?.state||"uninitialized",voices:voices.size,cache:buffers.size,volumes,muted,paused,hidden,masterGain:masterGain?.gain.value??0})};
})(Dojo);
