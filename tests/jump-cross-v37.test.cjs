const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../js/data.js');require('../js/combat.js');require('../js/netcode.js');
const blank={axis:0,guard:false},guard={axis:0,guard:true};
const spacing=(a,b)=>.98*(a.p.hurt+b.p.hurt)+12;
function match(fighters=[D.cast[2],D.cast[0]],side=0,edge=false){const m=new D.Match({fighters,mode:'local',seed:77});m.phase='fight';const a=m.fighters[side],b=m.fighters[1-side],dir=side?-1:1;a.x=edge?(side?D.LIMIT.right:D.LIMIT.left):(side?800:450);b.x=a.x+dir*spacing(a,b);m.separate();return m;}
function command(m,side,c,other=guard){m.tick(side?other:c,side?c:other);}
function jump(m,side=0){const a=m.fighters[side],b=m.fighters[1-side],dir=side?-1:1,trace=[];command(m,side,{axis:dir,action:'jump'});let landed=false;for(let i=0;i<80;i++){const before=m.fighters.map(f=>f.x);command(m,side,{axis:dir});trace.push(m.fighters.map((f,j)=>Math.abs(f.x-before[j])));assert.ok(m.fighters.every(f=>f.x>=D.LIMIT.left&&f.x<=D.LIMIT.right));if(a.lift===0){landed=true;break;}}assert.ok(landed);return {a,b,dir,trace};}
test('all starters and extreme custom sizes can jump across either side, including near a stage edge',()=>{
 const customs=[D.normalize({id:'custom-small',height:1,speed:1,power:5}),D.normalize({id:'custom-tall',height:10,speed:10,power:5})],fighters=[...D.cast,...customs];for(const a of fighters)for(const b of fighters)for(const side of [0,1]){const m=match(side?[b,a]:[a,b],side),r=jump(m,side);assert.ok((r.a.x-r.b.x)*r.dir>0,a.id+'/'+b.id+'/'+side);assert.equal(r.a.face,-r.dir);assert.equal(r.b.face,r.dir);assert.equal(r.a.landing,12);assert.ok(Math.abs(r.a.x-r.b.x)>=spacing(r.a,r.b)-1e-8);assert.ok(r.trace.every(d=>Math.max(...d)<20),'smooth descent');}
 for(const side of [0,1]){const m=match([D.cast[3],D.cast[3]],side,true),r=jump(m,side);assert.ok((r.a.x-r.b.x)*r.dir>0);}
});
test('ground, low altitude and equal-height airborne bodies cannot tunnel through each other',()=>{
 for(const height of [0,20,63]){const m=match(),[a,b]=m.fighters;a.lift=height;a.vy=height?D.RULES.gravity/60:0;a.knock=12000;m.tick(blank,blank);assert.ok(a.x<b.x);assert.equal(a.face,1);assert.equal(b.face,-1);}
 const m=match(),[a,b]=m.fighters;a.lift=b.lift=100;a.vy=b.vy=D.RULES.gravity/60;a.knock=12000;m.tick(blank,blank);assert.ok(a.x<b.x);
});
test('a cross-up reverses facing and guard correctly while landing retains all twelve recovery frames',()=>{
 for(const side of [0,1]){const m=match([D.cast[2],D.cast[0]],side),{a,b}=jump(m,side),x=a.x;for(let i=0;i<11;i++){command(m,side,{axis:side?-1:1,action:'light'});assert.equal(a.x,x);assert.equal(a.attack,null);}assert.equal(a.landing,1);command(m,side,{action:'light'});assert.equal(a.attack.key,'light');for(let i=0;i<20;i++)command(m,side,blank);assert.equal(b.tally.block,1);assert.equal(a.tally.hit,0);assert.equal(b.face,-a.face);while(a.attack||m.freeze)command(m,side,blank);const bx=a.x;command(m,side,{action:'back'});for(let i=0;i<8;i++)command(m,side,blank);assert.ok((a.x-bx)*a.face<0);}
});
test('jump crossing adds no invulnerability: a correctly placed ground punch can hit the airborne fighter',()=>{
 const m=match([D.cast[1],D.cast[3]]),[a,b]=m.fighters;a.lift=72;a.vy=0;const hp=a.hp;m.begin(b,'light',m.frame);b.attack.age=b.attack.wind-1;m.tick(blank,blank);assert.ok(a.hp<hp);assert.equal(b.tally.hit,1);assert.equal(D.Headman.invulnerable(a),false);
});
test('air crossing does not let a low jumper pass through a bath wall',()=>{
 const m=match([D.cast[1],D.cast[3]]),[a,b]=m.fighters;a.x=450;b.x=700;m.world.walls.push({id:1,owner:1,x:535,width:36,height:112,hp:28,ttl:150,age:0});m.tick({axis:1,action:'jump'},blank);let crossed=false;for(let i=0;i<60;i++){m.tick({axis:1},blank);if(a.x>535+30){crossed=true;assert.ok(a.lift>=112);break;}}assert.ok(crossed);
});
test('late jump and guard inputs roll back to the same crossed positions, facing and damage on both peers',()=>{
 const make=()=>{const m=match([D.cast[1],D.cast[3]]);m.online=true;return m;},ms=[make(),make()],queue=[],errors=[];let wall=0,sawCross=false;const cores=ms.map((m,side)=>new D.Rollback(m,{side,send:p=>queue.push({side:1-side,p:structuredClone(p),at:wall+(wall*3+side*5)%10}),onError:e=>errors.push(e)}));const input=(side,f)=>side?{axis:0,guard:true}:{axis:f<80?1:f<180?-1:0,guard:false,action:f===5||f===110?'jump':f===78||f===185?'light':null};for(wall=0;wall<900;wall++){for(const c of cores)if(c.frame<500&&c.canAdvance())c.advance(input(c.side,c.frame));for(const q of queue.filter(q=>q.at<=wall))cores[q.side].receive(q.p);for(let i=queue.length-1;i>=0;i--)if(queue[i].at<=wall)queue.splice(i,1);if(ms[0].fighters[0].x>ms[0].fighters[1].x)sawCross=true;}assert.ok(sawCross);assert.deepEqual(errors,[]);assert.ok(cores.every(c=>c.frame===500));assert.ok(cores.some(c=>c.rollbacks>0));assert.equal(D.netState.hash(D.netState.save(ms[0])),D.netState.hash(D.netState.save(ms[1])));
});

