const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const D=require('../js/data.js');require('../js/combat.js');
function harness(){
 let now=0,sourceFrames=0;const pending=[];
 const videos=Object.fromEntries(Object.values(D.cutins).map(c=>[c.element,{currentTime:0,readyState:0,seeking:false,paused:true,ended:false,videoWidth:1280,videoHeight:720,loads:0,play(){this.paused=false;return new Promise((resolve,reject)=>pending.push({resolve,reject}));},pause(){this.paused=true;},load(){this.loads++;this.error=null;this.readyState=0;},addEventListener(){},setAttribute(){}}]));
 const canvas={width:1280,height:650},ctx={canvas,save(){},restore(){},fillRect(){},translate(){},scale(){},drawImage(source){if(Object.values(videos).includes(source))sourceFrames++;}};canvas.getContext=()=>ctx;
 const dojo={...D,Audio:{dialogueVoice(){},superVoice(){}},Art:{cinematic(){}}};
 const document={getElementById:id=>videos[id],createElement:()=>canvas};vm.runInNewContext(fs.readFileSync(require.resolve('../js/cutin-video.js'),'utf8'),{Dojo:dojo,document,performance:{now:()=>now}});
 const V=dojo.VideoCutIn;const make=(id='momokage',serial=1)=>({serial,key:D.cutins[id].key,age:0,a:{index:0,face:1,data:D.cast.find(f=>f.id===id)}});
 return {V,videos,pending,ctx,make,frames:()=>sourceFrames,advance:(s,ms=100,paused=false)=>{now+=ms;const r=V.update(s,paused,now);V.draw(ctx,s);return r;},setNow:n=>now=n};
}
test('a cold movie waits for real metadata and seek readiness beyond the old 450ms deadline',async()=>{
 const h=harness(),s=h.make(),v=h.videos['crush-video'];h.V.start(s);for(let i=0;i<20;i++)h.advance(s);
 assert.equal(h.V.holds(s),true);assert.equal(h.V.status().state,'preparing');assert.equal(h.pending.length,0);assert.equal(v.currentTime,0);
 v.readyState=1;v.seeking=true;v.ended=true;v.currentTime=3.75;h.advance(s);assert.equal(h.V.holds(s),true);assert.equal(h.frames(),0);
 v.seeking=false;v.readyState=4;v.ended=false;h.advance(s);v.currentTime=.3;h.advance(s);assert.equal(h.pending.length,1);h.pending[0].resolve();await Promise.resolve();v.currentTime=.35;h.advance(s);assert.ok(h.frames()>0);assert.equal(h.V.status().state,'playing');
 v.currentTime=3.75;v.ended=true;assert.equal(h.advance(s),'done');assert.equal(h.V.history()[0].outcome,'completed');
});
test('a previous ended frame and pending seek cannot complete a repeated activation',async()=>{
 const h=harness(),v=h.videos['azure-video'];v.readyState=4;v.currentTime=D.cutins.yan.end;v.ended=true;v.seeking=true;const s=h.make('yan');h.V.start(s);for(let i=0;i<12;i++)h.advance(s);assert.equal(h.V.holds(s),true);assert.equal(h.V.history().length,0);assert.equal(h.frames(),0);
 v.seeking=false;v.ended=false;h.advance(s);v.currentTime=0;h.advance(s);h.pending[0].resolve();await Promise.resolve();v.currentTime=.05;h.advance(s);assert.ok(h.frames()>0);h.V.stop();const next=h.make('yan',2);v.currentTime=D.cutins.yan.end;v.ended=true;v.seeking=true;h.V.start(next);h.advance(next,1000);assert.equal(h.V.holds(next),true);assert.equal(h.V.status().hasFrame,false);
});
test('a bounded missing-data fallback reports the cause, and pause time does not spend its load budget',()=>{
 const h=harness(),s=h.make();h.V.start(s);for(let i=0;i<12;i++)h.advance(s);h.advance(s,100000,true);h.advance(s,100000,false);assert.equal(h.V.holds(s),true);
 for(let i=0;i<45;i++)h.advance(s);assert.equal(h.V.status().state,'fallback');assert.equal(h.V.history()[0].reason,'metadata-timeout');assert.equal(h.V.history()[0].frames,0);
});
test('an obsolete rejected play cannot affect a different character, and only selected videos preload',async()=>{
 const h=harness();h.V.prepare([D.cast[2]]);assert.equal(h.videos['azure-video'].loads,1);assert.equal(h.videos['crush-video'].loads,0);h.V.prepare([D.cast[2]]);assert.equal(h.videos['azure-video'].loads,1);
 const a=h.make();h.videos['crush-video'].readyState=4;h.V.start(a);for(let i=0;i<12;i++)h.advance(a);assert.equal(h.pending.length,1);const b=h.make('yan',2);h.videos['azure-video'].readyState=4;h.V.start(b);h.pending[0].reject(Object.assign(new Error('stale'),{name:'NotSupportedError'}));await Promise.resolve();assert.equal(h.V.holds(b),true);assert.equal(h.V.status().key,'azure');
});
test('play promises resolving without time or decoded-frame progress cannot keep a stalled movie alive forever',async()=>{
 const h=harness(),s=h.make('yan'),v=h.videos['azure-video'];v.readyState=4;h.V.start(s);for(let i=0;i<12;i++)h.advance(s);h.pending[0].resolve();await Promise.resolve();v.currentTime=.05;h.advance(s);v.paused=true;
 for(let i=0;i<40;i++){h.advance(s);for(const p of h.pending)p.resolve();await Promise.resolve();}
 assert.equal(h.V.status().state,'fallback');assert.equal(h.V.history()[0].reason,'buffer-timeout');assert.ok(h.pending.length<=2);
});
test('online correction does not seek into missing data and accepts a completed seek whose playback already advanced',async()=>{
 const h=harness(),v=h.videos['azure-video'],s=h.make('yan');v.readyState=4;s.age=49;h.V.online(s,true,true);h.pending[0].resolve();await Promise.resolve();v.currentTime=.05;
 let position=.05,seeks=0,bufferEnd=.5;Object.defineProperty(v,'currentTime',{get:()=>position,set:t=>{position=t;seeks++;v.seeking=true;}});v.buffered={length:1,start:()=>0,end:()=>bufferEnd};s.age=100;h.setNow(500);h.V.online(s,true,true);assert.equal(seeks,0);
 bufferEnd=D.cutins.yan.end;s.age=101;h.setNow(600);h.V.online(s,true,true);assert.equal(seeks,1);assert.equal(h.V.status().seekPending,true);
 position=1.1;v.seeking=false;v.paused=false;s.age=110;h.setNow(700);h.V.online(s,true,true);assert.equal(h.V.status().seekPending,false);assert.notEqual(h.V.status().state,'fallback');
});
test('a late prewarm promise cannot pause the same element after a real cut-in has taken ownership',async()=>{
 const h=harness(),v=h.videos['azure-video'];h.V.prepare([D.cast[2]],true);assert.equal(h.pending.length,1);v.readyState=4;const s=h.make('yan');h.V.start(s);for(let i=0;i<12;i++)h.advance(s);assert.equal(h.pending.length,2);h.pending[0].resolve();await Promise.resolve();assert.equal(v.paused,false);assert.equal(h.V.holds(s),true);
});
test('azure video preparation preserves attack travel, damage, guard, dodge, range and all three beats on either side',()=>{
 assert.deepEqual({wind:D.moves.azure.wind,beats:D.moves.azure.beats,damage:D.moves.azure.damage,reach:D.moves.azure.reach,push:D.moves.azure.push,stop:D.moves.azure.stop,end:D.moves.azure.end,step:D.moves.azure.step},{wind:21,beats:[0,7,14],damage:13,reach:134,push:35,stop:4,end:36,step:225});
 for(const side of [0,1])for(const defense of ['hit','guard','spot','miss']){
  const outcomes=[];for(const prepared of [false,true]){
   const custom=D.normalize({id:'custom-proof',name:'判定確認',bonus:{stamina:4,dodge:3,guard:3}}),m=new D.Match({fighters:side?[custom,D.cast[2]]:[D.cast[2],custom],mode:'local'});m.phase='fight';const a=m.fighters[side],b=m.fighters[1-side];a.x=side?650:450;b.x=a.x+a.face*(defense==='miss'?550:120);a.meter=100;
   const cmd=defense==='guard'?{guard:true}:defense==='spot'?{action:'spot'}:{};m.tick(side?cmd:{action:'special'},side?{action:'special'}:cmd);m.endCinematic(m.cinematic,prepared);let events=m.drain();for(let i=0;i<130;i++){m.tick(side?cmd:{},side?{}:cmd);events.push(...m.drain());}
   const hits=events.filter(e=>e.type==='hit');outcomes.push({hp:b.hp,hit:a.tally.hit,blocks:b.tally.block,evade:b.tally.evade,perfect:b.tally.perfect,used:a.used,beats:hits.map(e=>e.azureBeat),damage:hits.map(e=>e.damage),finish:hits.filter(e=>e.finisher).length});
  }assert.deepEqual(outcomes[1],outcomes[0],`${side}/${defense}`);if(defense==='hit')assert.deepEqual(outcomes[1].beats,[1,2,3]);
 }
});
test('all three online movies freeze identical combat state for their fixed duration, irrespective of presentation',()=>{
 for(const data of D.cast.filter(f=>D.cutins[f.id])){const m=new D.Match({fighters:[data,D.cast[0]],mode:'local',online:true});m.phase='fight';m.fighters[0].meter=100;m.tick({action:'special'});const before={frame:m.frame,time:m.seconds,x:m.fighters.map(f=>f.x),stamina:m.fighters.map(f=>f.stamina)};const clip=D.cutins[data.id];for(let i=0;i<clip.frames-1;i++)m.tick();assert.deepEqual({frame:m.frame,time:m.seconds,x:m.fighters.map(f=>f.x),stamina:m.fighters.map(f=>f.stamina)},before);assert.ok(m.cinematic);m.tick();assert.equal(m.cinematic,null);assert.equal(m.fighters[0].attack.wind-m.fighters[0].attack.age,clip.lunge);assert.equal(m.drain().filter(e=>e.type===clip.release).length,1);}
});
