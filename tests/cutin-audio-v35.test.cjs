const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../js/data.js');require('../js/combat.js');
const event=(serial=1)=>({serial,key:'azure',a:{index:0,data:D.cast[2]}});
function harness(loader=async()=>({duration:4.7})){
 const nodes=[],ctx={currentTime:0,state:'running',createGain(){return {gain:{value:0},connect(){return this;},disconnect(){}};},createBufferSource(){const n={connect(){return this;},start(t,offset){this.offset=offset;},stop(){this.stopped=true;this.onended?.();}};nodes.push(n);return n;}};
 const dojo={...D};vm.runInNewContext(fs.readFileSync(require.resolve('../js/cutin-audio.js'),'utf8'),{Dojo:dojo});dojo.CutInSound.attach(ctx,{},loader);return{S:dojo.CutInSound,ctx,nodes};
}
const loaded=async h=>{h.S.prepare([D.cast[2]]);for(let i=0;i<5;i++)await Promise.resolve();};
test('the A movie owns its name, flash and audio while combat damage and six-frame lunge are preserved',()=>{
 assert.equal(D.cutins.yan.title,0);assert.equal(D.cutins.yan.end,4.7);assert.equal(D.cutins.yan.frames,282);assert.equal(D.cutins.yan.mirror,false);assert.equal(D.moves.azure.damage,15);assert.deepEqual(D.moves.azure.beats,[0,7,14]);
 const m=new D.Match({fighters:[D.cast[2],D.cast[0]],mode:'local',online:true});m.phase='fight';m.fighters[0].meter=100;m.tick({action:'special'});const seconds=m.seconds;for(let i=0;i<281;i++)m.tick();assert.equal(m.seconds,seconds);assert.ok(m.cinematic);m.tick();assert.equal(m.cinematic,null);assert.equal(m.fighters[0].attack.wind-m.fighters[0].attack.age,6);
});
test('one original soundtrack follows video time, pauses, and resumes without duplicate playback',async()=>{
 const h=harness();await loaded(h);h.S.sync(event(),.04,true);assert.equal(h.nodes.length,1);assert.equal(h.nodes[0].offset,.04);h.ctx.currentTime=1;h.S.sync(event(),1.04,true);assert.equal(h.nodes.length,1);h.S.hold();assert.ok(h.nodes[0].stopped);h.ctx.currentTime=5;h.S.sync(event(),1.04,true);assert.equal(h.nodes.length,2);assert.ok(Math.abs(h.nodes[1].offset-1.04)<1e-8);assert.equal(h.S.status().playing,true);h.S.stop();assert.ok(h.nodes.every(n=>n.stopped));
});
test('network or buffering holds stop the mix; backward correction cannot repeat the final accent',async()=>{
 const h=harness();await loaded(h);h.S.sync(event(),4.40,true);h.ctx.currentTime=.08;h.S.sync(event(),4.48,false);assert.ok(h.nodes[0].stopped);h.S.sync(event(),4.2,true);assert.equal(h.nodes.length,1);h.S.sync(event(),4.49,true);assert.equal(h.nodes.length,2);assert.ok(h.nodes[1].offset>=4.48);h.ctx.currentTime=.15;h.S.sync(event(),4.7,false);assert.ok(h.nodes[1].stopped);
});
test('a late download after stop cannot start audio, and a new activation has its own clock',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>resolve=r));h.S.prepare([D.cast[2]]);await Promise.resolve();h.S.sync(event(),0,true);h.S.stop();resolve({duration:4.7});for(let i=0;i<5;i++)await Promise.resolve();assert.equal(h.nodes.length,0);h.S.sync(event(2),.03,true);assert.equal(h.nodes.length,1);assert.equal(h.nodes[0].offset,.03);h.S.sync({serial:3,key:'crush',a:{index:1,data:D.cast[0]}},.3,true);assert.equal(h.S.status().playing,false);
});
test('an audio download failure cannot leave playback pending or keep the video waiting forever',async()=>{
 let attempts=0;const h=harness(async()=>{if(attempts++===0)throw Error('unavailable');return {duration:4.7};});await loaded(h);assert.equal(h.S.ready(D.cutins.yan.soundtrack),true);h.S.sync(event(),.5,true);assert.equal(h.nodes.length,0);assert.equal(h.S.status().error,true);h.S.stop();assert.equal(h.S.status().playing,false);await loaded(h);h.S.sync(event(2),.02,true);assert.equal(h.S.status().playing,true);assert.equal(attempts,2);
});
test('the standalone mix mutes old azure music and battle music returns after release',async()=>{
 const gains=[],nodes=[],ctx={currentTime:0,createGain(){const events=[],g={gain:{cancelScheduledValues(){},setValueAtTime(v){events.push(v);},setTargetAtTime(v){events.push(v);},linearRampToValueAtTime(v){events.push(v);}},connect(){},events};gains.push(g);return g;},createBufferSource(){const n={connect(){},start(){},stop(){this.stopped=true;}};nodes.push(n);return n;}};
 const loads=[],dojo={...D,Audio:{loadBuffer:async src=>{loads.push(src);return {duration:70};}}};vm.runInNewContext(fs.readFileSync(require.resolve('../js/music.js'),'utf8'),{Dojo:dojo});const M=dojo.Music;M.attach(ctx,{});await M.battle();await M.cutin(event());assert.equal(nodes.length,1);assert.ok(gains[0].events.includes(0));assert.ok(!loads.some(s=>s.includes('azure-five')));ctx.currentTime=4.7;M.release({...event(),prepared:true});assert.equal(M.status().serial,null);ctx.currentTime=5.1;M.update(null);assert.ok(gains[0].events.at(-1)>0);
});
