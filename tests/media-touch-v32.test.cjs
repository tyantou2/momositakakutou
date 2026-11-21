const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const D=require('../js/data.js');require('../js/combat.js');require('../js/touch.js');
test('touch holds independent pointers, consumes taps once, and drops stale or cancelled input',()=>{
 const t=new D.TouchState();t.down(1,'right',0);t.down(2,'light',1);t.down(3,'guard',2);
 assert.deepEqual(t.sample(30),{axis:1,guard:true,action:'light'});assert.equal(t.sample(31).action,undefined);
 t.up(2);assert.equal(t.sample(32).axis,1);t.up(1);assert.equal(t.sample(33).axis,0);
 t.down(4,'jump',40);assert.equal(t.sample(201).action,undefined);t.clear();assert.equal(t.pointers.size,0);assert.equal(t.sample(202).guard,false);
 t.down(5,'left',300);t.down(6,'right',301);assert.equal(t.sample(302).axis,0);assert.equal(t.down(5,'heavy',303),false);
 for(let i=0;i<20;i++){t.down(20+i,'spot',310+i);t.up(20+i);}assert.equal(t.edges.length,8);t.clearEdges();assert.equal(t.edges.length,0);
});
test('online super emits one mouth cue before its existing final voice on both sides',()=>{
 for(const data of D.cast.slice(0,2))for(const side of [0,1]){
  const fighters=side?[D.cast[2],data]:[data,D.cast[2]],m=new D.Match({fighters,mode:'local',online:true});m.phase='fight';m.fighters[side].meter=100;
  m.tick(side?{}:{action:'special'},side?{action:'special'}:{});let events=m.drain();
  for(let i=0;i<400;i++){m.tick();events.push(...m.drain());}
  const lines=events.filter(e=>e.type==='cutinDialogue'),final=events.filter(e=>e.type==='specialVoice');assert.equal(lines.length,1);assert.equal(final.length,1);assert.equal(lines[0].a.index,side);assert.ok(events.indexOf(lines[0])<events.indexOf(final[0]));
  const clip=D.movieFor(lines[0]);assert.ok(clip.dialogue.time+clip.dialogue.duration<clip.end-clip.voiceLead);
 }
});
function musicHarness(){
 const nodes=[],gains=[];const ctx={currentTime:0,createGain(){const events=[],gain={value:0,cancelScheduledValues(t){events.push(['cancel',t]);},setTargetAtTime(v,t,s){events.push(['target',v,t,s]);},setValueAtTime(v,t){events.push(['set',v,t]);},linearRampToValueAtTime(v,t){events.push(['linear',v,t]);}};const n={gain,events,connect(){return this;}};gains.push(n);return n;},createBufferSource(){const n={connect(){},start(...a){this.started=a;},stop(t){this.stopped=t;}};nodes.push(n);return n;}};
 const dojo={...D,Audio:{loadBuffer:async src=>({duration:src.includes('battle')?70.4587:6})}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/music.js'),'utf8'),{Dojo:dojo});dojo.Music.attach(ctx,{});return {ctx,nodes,gains,M:dojo.Music};
}
test('music keeps one loop, deduplicates super cues, ducks speech and fades back without affecting combat',async()=>{
 const {ctx,nodes,gains,M}=musicHarness();await M.battle();assert.equal(nodes.length,1);assert.equal(nodes[0].loop,true);
 const shot={serial:1,a:{index:0,data:D.cast[0]},key:'crush',age:0};await M.cutin(shot);await M.cutin({...shot});assert.equal(nodes.length,2);assert.ok(gains[0].events.some(e=>e[0]==='target'&&e[1]===0));
 M.duck(.5);assert.equal(M.status().duckUntil,.5);assert.ok(gains[1].events.some(e=>e[0]==='target'&&e[1]<.1));
 ctx.currentTime=.6;M.update(shot);assert.equal(M.status().duckUntil,0);M.release({...shot,prepared:true});assert.ok(M.status().returnAt>.6);ctx.currentTime=3;M.update(null);assert.equal(M.status().returnAt,0);assert.equal(M.status().serial,null);
 await M.battle();assert.ok(nodes[0].stopped!==undefined);assert.equal(nodes.filter(n=>n.loop&&n.stopped===undefined).length,1);
 M.stop(0);assert.equal(M.status().active,false);assert.ok(nodes.every(n=>n.stopped!==undefined));
});
test('a music download finishing after leaving battle cannot start an orphaned track',async()=>{
 let resolve;const {M}=musicHarness();M.stop();
 // A new isolated harness delays the decode, then leaves the screen before it resolves.
 const ctx={currentTime:0,createGain:()=>({connect(){},gain:{cancelScheduledValues(){},setTargetAtTime(){},setValueAtTime(){},linearRampToValueAtTime(){}}}),createBufferSource(){throw Error('orphaned start');}};
 const dojo={...D,Audio:{loadBuffer:()=>new Promise(r=>resolve=r)}};vm.runInNewContext(fs.readFileSync(require.resolve('../js/music.js'),'utf8'),{Dojo:dojo});dojo.Music.attach(ctx,{});const pending=dojo.Music.battle();dojo.Music.stop(0);resolve({duration:70});await pending;assert.equal(dojo.Music.status().battle,false);
});
