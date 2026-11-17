(function(D) {
  "use strict";
  let audio, noise, muted=false;
  const voices = new Set();
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
    clip.volume=.58;
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
  function event(e) {
    if (muted) return;
    const play=(f,tag)=>f && voice(f.data.voice[tag]?.data);
    switch(e.type) {
      case "fight": tone(415,622,.19,.13,"triangle"); play(e.a,"start"); play(e.b,"start"); break;
      case "swing": thump(.11,e.key==="heavy"?.11:.064,1800); play(e.a,"attack"); break;
      case "special": tone(220,659,.26,.14,"triangle"); tone(440,932,.18,.09,"sine",.08); play(e.a,"special"); break;
      case "hit":
      case "break":
      case "counter": thump(e.heavy?.2:.105,.35,2150);tone(e.heavy?137:174,48,e.heavy?.18:.09,.28,"triangle");play(e.b,"damage");break;
      case "block": thump(.1,.19,870);tone(790,480,.1,.14,"triangle");break;
      case "step": thump(.10,.080,1360); break;
      case "evade": tone(410,811,.13,.085,"sine");break;
      case "over": tone(233,392,.21,.12,"triangle");tone(349,523,.35,.13,"triangle",.12);play(e.a,"win");break;
    }
  }
  D.Audio={init,mute,voice,event,stopVoices};
})(Dojo);