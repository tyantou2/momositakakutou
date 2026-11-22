const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../js/data.js');require('../js/combat.js');require('../js/netcode.js');require('../js/online.js');
const head=D.cast.find(f=>f.id==='headman'),blank={axis:0,guard:false},custom=D.normalize({id:'custom-wall-proof',name:'検証',bonus:{stamina:4,dodge:3,guard:3}});
function match(seed=1,side=0){const m=new D.Match({fighters:side?[custom,head]:[head,custom],mode:'local',seed});m.phase='fight';m.fighters[0].x=400;m.fighters[1].x=800;return m;}
function tick(m,n,a=blank,b=blank){for(let i=0;i<n;i++)m.tick(a,b);}
function cast(m,side=0){m.fighters[side].meter=100;m.tick(side?blank:{action:'special'},side?{action:'special'}:blank);const shot=m.cinematic;assert.ok(shot);m.endCinematic(shot);return shot.form;}
const seeds={};for(let seed=1;Object.keys(seeds).length<2;seed++){const m=match(seed);seeds[cast(m)]=seed;}
function formed(form,side=0){const m=match(seeds[form],side);if(cast(m,side)!==form){for(let seed=1;;seed++){const x=match(seed,side);if(cast(x,side)===form)return x;}}return m;}
test('headman is a tall fourth starter with ten bonus points and a non-selectable transformation',()=>{
 assert.deepEqual([head.height,head.speed,head.power,head.bonus],[9,4,6,{stamina:4,dodge:2,guard:4}]);assert.equal(D.specials.includes('morph'),false);assert.equal(D.normalize({special:'morph'}).special,'rush');assert.equal(D.onlineFighter({id:'headman',power:10,special:'azure'}),head);
 assert.equal(new Set(Object.values(D.controls[0]).concat(Object.values(D.controls[1]))).size,22);assert.equal(D.netState.clean({action:'skillB'}).action,'skillB');
});
test('the seeded independent 50/50 draws permit repeats and ignore the opponent draw order',()=>{
 const a=D.Headman.initial(923,0),counts={thermae:0,nozaki:0};let repeats=0,last;
 for(let i=0;i<20000;i++){const f={shift:a};const form=D.Headman.drawForm(f);counts[form]++;if(last===form)repeats++;last=form;}
 assert.ok(counts.thermae>9500&&counts.thermae<10500);assert.ok(repeats>9000&&repeats<11000);
 const one=D.Headman.initial(77,0),two=D.Headman.initial(77,0),opponent=D.Headman.initial(77,1);for(let i=0;i<100;i++){D.Headman.drawForm({shift:opponent});D.Headman.drawForm({shift:opponent});assert.equal(D.Headman.drawForm({shift:one}),D.Headman.drawForm({shift:two}));}
});
test('transformation spends exactly one full gauge, cannot reroll while active, never heals and obeys the two-use limit',()=>{
 const m=match(),a=m.fighters[0];a.hp-=75;a.meter=99;m.tick({action:'special'});assert.equal(m.cinematic,null);a.meter=100;m.tick({action:'special'});assert.equal(a.meter,0);assert.equal(a.used,1);const choice=m.cinematic.form;m.endCinematic(m.cinematic);assert.equal(a.shift.form,choice);assert.equal(a.shift.remaining,720);assert.equal(a.hp,a.p.hp-75);
 const rng=a.shift.rng;a.meter=100;m.tick({action:'special'});assert.equal(a.shift.rng,rng);assert.equal(a.used,1);assert.equal(m.cinematic,null);
 tick(m,720);assert.equal(a.shift.form,null);a.meter=100;m.tick({action:'special'});m.endCinematic(m.cinematic);a.shift.remaining=1;m.tick();a.meter=100;m.tick({action:'special'});assert.equal(a.used,2);assert.equal(m.cinematic,null);
});
test('form timers, cooldowns and entities use combat ticks and pause for hitstop and all cinematics',()=>{
 const m=formed('thermae'),a=m.fighters[0];m.tick({action:'skillA'});tick(m,30);const wall=m.world.walls[0];assert.ok(wall);const state=[a.shift.remaining,a.shift.cooldownA,wall.ttl];m.freeze=20;tick(m,20);assert.deepEqual([a.shift.remaining,a.shift.cooldownA,wall.ttl],state);
 m.fighters[1].data=D.cast[0];m.fighters[1].meter=100;m.fighters[1].attack=null;m.fighters[1].stun=0;m.tick(blank,{action:'special'});const frozen=[a.shift.remaining,a.shift.cooldownA,wall.ttl];tick(m,40);assert.deepEqual([a.shift.remaining,a.shift.cooldownA,wall.ttl],frozen);
});
test('a started skill completes before visual reversion while new skills become unavailable at zero time',()=>{
 const m=formed('thermae'),a=m.fighters[0];a.shift.remaining=5;m.tick({action:'skillB'});tick(m,6);assert.equal(a.shift.remaining,0);assert.equal(a.shift.ending,true);assert.equal(a.shift.form,'thermae');tick(m,23);assert.ok(m.drain().some(e=>e.type==='geyserBurst'));tick(m,50);assert.equal(a.shift.form,null);a.stamina=a.p.staminaMax;m.tick({action:'skillA'});assert.equal(a.attack,null);assert.equal(m.world.walls.length,0);
});
test('bath walls block both players, are jumpable, break to heavy strikes and cannot spawn inside fighters or outside the stage',()=>{
 const m=formed('thermae'),a=m.fighters[0],b=m.fighters[1];m.tick({action:'skillA'});tick(m,23);const wall=m.world.walls[0];assert.ok(wall);assert.ok(m.fighters.every(f=>Math.abs(f.x-wall.x)>30));a.attack=null;a.x=wall.x-38;b.x=wall.x+120;tick(m,12,{axis:1},{axis:-1});assert.ok(a.x<=wall.x-30&&b.x>=wall.x+30);
 b.x=1000;a.attack=null;a.recovery=0;a.landing=0;m.tick({axis:1,action:'jump'});tick(m,54,{axis:1});assert.ok(a.x>wall.x+30,'jump clears the wall');
 const h=formed('thermae'),ha=h.fighters[0],hb=h.fighters[1];h.tick({action:'skillA'});tick(h,24);const w=h.world.walls[0];ha.attack=null;ha.x=w.x-200;hb.x=w.x+110;h.tick(blank,{action:'heavy'});tick(h,62);h.tick(blank,{action:'heavy'});tick(h,32);assert.equal(h.world.walls.length,0);assert.ok(h.drain().some(e=>e.type==='wallBreak'));assert.equal(ha.tally.hit,0);
 const edge=formed('thermae');edge.fighters[0].x=D.LIMIT.right-1;edge.fighters[1].x=D.LIMIT.right-150;edge.separate();edge.tick({action:'skillA'});tick(edge,30);assert.ok(edge.world.walls.every(w=>w.x>D.LIMIT.left&&w.x<D.LIMIT.right));
});
test('a wall times out after 150 combat ticks and skill cooldown prevents duplication',()=>{
 const m=formed('thermae'),a=m.fighters[0];m.tick({action:'skillA'});tick(m,23);assert.equal(m.world.walls.length,1);const count=m.world.serial;tick(m,80,{action:'skillA'});assert.equal(m.world.serial,count);tick(m,100);assert.equal(m.world.walls.length,0);
});
test('geyser has a visible 27-frame warning and one guardable, dodgeable launch',()=>{
 for(const defense of ['hit','guard','dodge']){const m=formed('thermae'),a=m.fighters[0],b=m.fighters[1];b.x=a.x+170;const hp=b.hp;m.tick({action:'skillB'},defense==='guard'?{guard:true}:blank);tick(m,23,blank,defense==='guard'?{guard:true}:blank);assert.equal(b.hp,hp);assert.equal(m.world.geysers[0].age,24);m.tick(blank,defense==='dodge'?{action:'spot'}:defense==='guard'?{guard:true}:blank);tick(m,5,blank,defense==='guard'?{guard:true}:blank);const events=m.drain();
  if(defense==='hit'){assert.equal(a.tally.hit,1);assert.ok(b.vy>0);assert.ok(hp-b.hp>20);}if(defense==='guard'){assert.equal(b.tally.block,1);assert.ok(hp-b.hp<4);}if(defense==='dodge'){assert.equal(a.tally.hit,0);assert.equal(b.tally.evade,1);assert.equal(b.tally.perfect,1);}assert.equal(events.filter(e=>e.type==='geyserBurst').length,1);
 }
});
test('Nozaki has exactly two shots per transformation with costs, range, guard and dodge counterplay',()=>{
 for(const defense of ['hit','guard','dodge','range']){const m=formed('nozaki'),a=m.fighters[0],b=m.fighters[1];b.x=a.x+(defense==='range'?650:280);m.tick({action:'skillA'},defense==='guard'?{guard:true}:blank);assert.equal(a.shift.ammo,1);tick(m,22,blank,defense==='guard'?{guard:true}:blank);if(defense==='dodge')m.tick(blank,{action:'spot'});tick(m,25,blank,defense==='guard'?{guard:true}:blank);if(defense==='hit')assert.equal(a.tally.hit,1);if(defense==='guard')assert.equal(b.tally.block,1);if(defense==='range')assert.equal(a.tally.hit,0);if(defense==='dodge')assert.equal(a.tally.hit,0);
 }
 const m=formed('nozaki'),a=m.fighters[0];for(let i=0;i<2;i++){m.tick({action:'skillA'});tick(m,215);}assert.equal(a.shift.ammo,0);const rng=a.shift.rng;m.tick({action:'skillA'});assert.equal(a.attack,null);assert.equal(a.shift.rng,rng);assert.equal(m.world.projectiles.length,0);
});
test('flank is real movement with only six invulnerable frames, can cross sides, and whiffs with recovery',()=>{
 const m=formed('nozaki'),a=m.fighters[0],b=m.fighters[1];b.x=a.x+120;const start=a.x;m.tick({action:'skillB'});assert.ok(a.x>start&&a.x-start<=15);tick(m,6);assert.equal(D.Headman.invulnerable(a),true);tick(m,4);assert.equal(D.Headman.invulnerable(a),false);tick(m,10,blank,{guard:true});assert.ok(a.x>b.x);assert.equal(a.face,-1);assert.equal(b.face,1);assert.equal(b.tally.block,1);
 const far=formed('nozaki');far.fighters[1].x=1050;far.tick({action:'skillB'});tick(far,18);assert.equal(far.fighters[0].tally.hit,0);assert.equal(far.fighters[0].attack.key,'flank');assert.ok(far.fighters[0].attack.age<far.fighters[0].attack.wind+34);
});
test('practice reset clears form, terrain and ammunition while preserving the random stream for new draws',()=>{
 const m=formed('thermae'),a=m.fighters[0];m.mode='practice';m.tick({action:'skillA'});tick(m,30);const rng=a.shift.rng;m.resetPractice();assert.equal(m.fighters[0].shift.rng,rng);assert.equal(m.fighters[0].shift.form,null);assert.equal(m.world.walls.length,0);assert.equal(m.fighters[0].meter,100);assert.equal(m.fighters[0].used,0);
});
test('snapshots restore transformation RNG, cooldowns, walls, projectiles and canonical attack definitions',()=>{
 const m=formed('nozaki');m.fighters[1].x=850;m.tick({action:'skillA'});tick(m,18);assert.ok(m.world.projectiles.length);const snapshot=D.netState.save(m),hash=D.netState.hash(snapshot);tick(m,90);D.netState.restore(m,snapshot);assert.equal(D.netState.hash(D.netState.save(m)),hash);assert.equal(m.fighters[0].attack.move,D.moves.shot);assert.equal(m.world.projectiles.length,1);
});
test('restoring a confirmed multi-hit attack preserves capture aliases and the original finisher behavior',()=>{
 const run=restore=>{const m=new D.Match({fighters:[D.cast[2],custom],mode:'local'});m.phase='fight';m.fighters[0].x=450;m.fighters[1].x=570;m.fighters[0].meter=100;m.tick({action:'special'});m.endCinematic(m.cinematic,true);while(m.fighters[0].tally.hit===0)m.tick();if(restore){D.netState.restore(m,D.netState.save(m));assert.equal(m.fighters[1].captured.attack,m.fighters[0].attack);assert.equal(m.fighters[0].attack.move,D.moves.azure);}let events=m.drain();while(m.fighters[0].tally.hit<3){m.tick();events.push(...m.drain());}return {hp:m.fighters[1].hp,freeze:m.freeze,knock:m.fighters[1].knock,finisher:events.filter(e=>e.finisher).length};};assert.deepEqual(run(true),run(false));
});
test('CPU uses both forms through the same cooldown, stamina and ammunition checks as players',()=>{
 for(const form of ['thermae','nozaki']){const m=formed(form,1);m.mode='cpu';m.fighters[0].x=500;m.fighters[1].x=800;let seed=91;m.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const events=[];for(let i=0;i<900;i++){m.tick();events.push(...m.drain());}const used=events.filter(e=>e.type==='skill').map(e=>e.key);if(form==='thermae'){assert.ok(used.includes('bathwall'));assert.ok(used.includes('geyser'));}else{assert.ok(used.includes('shot'));assert.ok(used.includes('flank'));assert.ok(events.filter(e=>e.type==='gunshot').length<=2);}assert.ok(m.fighters[1].stamina>=0);}
});
test('rollback with delayed skill inputs reproduces independent transformation draws and terrain state',()=>{
 const make=()=>{const m=new D.Match({fighters:[head,head],mode:'local',online:true,seed:713});m.phase='fight';m.fighters.forEach(f=>f.meter=100);return m;},matches=[make(),make()],events=[[],[]],errors=[],queue=[];let wall=0;
 const cores=matches.map((m,side)=>new D.Rollback(m,{side,send:p=>queue.push({side:1-side,p:structuredClone(p),at:wall+(p.type==='input'?(wall*7+side*3)%10:2)}),onEvents:e=>events[side].push(...e.map(x=>[x.type,x.a?.index,x.form,x.key])),onError:e=>errors.push(e)}));
 const command=(side,f)=>({axis:f>90&&f<120?(side?-1:1):0,guard:f%210>180,action:f===4||f===930?'special':f%170===40?'skillA':f%230===80?'skillB':f%63===30?'light':null});
 for(wall=0;wall<2200;wall++){for(const c of cores)if(c.frame<1800&&c.canAdvance())c.advance(command(c.side,c.frame));for(const item of queue.filter(q=>q.at<=wall))cores[item.side].receive(item.p);for(let i=queue.length-1;i>=0;i--)if(queue[i].at<=wall)queue.splice(i,1);}
 assert.deepEqual(errors,[]);assert.equal(cores[0].frame,1800);assert.equal(cores[1].frame,1800);assert.equal(D.netState.hash(D.netState.save(matches[0])),D.netState.hash(D.netState.save(matches[1])));assert.deepEqual(events[0],events[1]);assert.ok(cores.some(c=>c.rollbacks>0));assert.ok(events[0].some(e=>e[0]==='transform'));assert.ok(events[0].some(e=>['wallBuild','gunshot','geyserBurst'].includes(e[0])));
});
