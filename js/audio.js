(function(D) {
  "use strict";
  let audio, noise, muted=false;
  const voices = new Set();
  const builtIn = new Set(["momokage","momonosuke"]);
  let introTimer=0;
  let lastCallout=new WeakMap();
  function init() {
    if (muted) return;
    try {
      if (!audio) audio = new AudioContext();
      if (audio.state==="suspended") audio.resume().catch(()=>{});
    } catch { /* Web Audio is optional for gameplay. */ }
  }
  function stopVoices() {
    for (const clip of voices) clip.pause();
    voices.clear();
  }
  function mute(value) {
    muted=value;
    if (value) {
      stopVoices();
      if (audio) audio.suspend().catch(()=>{});
    } else init();
  }
  async function voice(data) {
    if (muted || !data) return false;
    const clip=new Audio(data);
    clip.volume=data.startsWith("assets/")?.82:.66;
    const forget=()=>voices.delete(clip);
    clip.onended=forget;
    clip.onerror=forget;
    if (voices.size>=3) {
      const oldest=voices.values().next().value;
      oldest.pause();
      voices.delete(oldest);
    }
    voices.add(clip);
    try { await clip.play(); return true; } catch { forget(); return false; }
  }
  function tone(freq,end,length,amp,shape="sine",delay=0) {
    if (muted || !audio || audio.state!=="running") return;
    const t=audio.currentTime+delay;
    const osc=audio.createOscillator(), gain=audio.createGain();
    osc.type=shape;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(end,t+length);
    gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(amp,t+.009);gain.gain.exponentialRampToValueAtTime(.001,t+length);
    osc.connect(gain).connect(audio.destination);osc.start(t);osc.stop(t+length);
  }
  function thump(length,amp,freq) {
    if (muted || !audio || audio.state!=="running") return;
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
    src.connect(filter).connect(gain).connect(audio.destination);src.start(t);src.stop(t+length);
  }
  function characterVoice(f,tag) {
    return f.data.voice[tag]?.data || (builtIn.has(f.data.id)?"assets/"+f.data.id+"-"+tag+".mp3?v=2.3":null);
  }
  function callout(f,tag) {
    if(!f) return;
    const slow=tag==="attack" || tag==="damage";
    const now=performance.now();
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
    if (muted) return;

    switch(e.type) {
      case "fight": tone(415,622,.19,.13,"triangle"); break;
      case "swing": thump(.11,e.key==="heavy"?.11:.064,1800); callout(e.a,"attack"); break;
      case "special":
        if(e.key==="azure") {tone(180,1000,.35,.13,"sawtooth");tone(740,1480,.20,.08,"sine",.15);break;}
        if(e.a.data.id==="momokage" && e.key==="crush" && videoCutIn) {
          tone(80,210,.80,.11,"sine");thump(.18,.10,1000);break;
        }
        tone(220,659,.26,.14,"triangle");tone(440,932,.18,.09,"sine",.08);callout(e.a,"special");break;
      case "crushRelease": thump(.13,.12,1400);tone(145,360,.13,.11,"triangle");callout(e.a,"special");break;
      case "hit":
      case "break":
      case "counter":
        thump(e.crush?.23:e.heavy?.2:.105,.35,2150);
        tone(e.heavy?137:174,48,e.heavy?.18:.09,.28,"triangle");
        if(e.crush) { tone(76,28,.34,.28,"sine");tone(240,70,.11,.10,"triangle"); }
        if(e.azure) {tone(e.finisher?95:620,e.finisher?30:220,e.finisher?.29:.10,.15,"triangle");}
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
  D.Audio={init,mute,voice,event,intro,stopVoices};
})(Dojo);
