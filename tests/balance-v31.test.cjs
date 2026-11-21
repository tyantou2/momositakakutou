const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../js/data.js');require('../js/combat.js');
const blank={axis:0,guard:false},custom=(name,bonus)=>D.normalize({name,height:6,speed:5,power:5,bonus});
const balanced=custom('標準',{stamina:4,dodge:3,guard:3}),highSta=custom('高持久',{stamina:5,dodge:3,guard:2}),highGuard=custom('高防御',{stamina:5,dodge:0,guard:5}),lowGuard=custom('低防御',{stamina:5,dodge:5,guard:0});
const pairs=[[D.cast[0],D.cast[1]],[D.cast[1],D.cast[0]],[D.cast[0],D.cast[0]],[D.cast[1],D.cast[1]],[D.cast[2],D.cast[2]],[balanced,balanced],[highSta,highSta],[balanced,highGuard],[balanced,lowGuard],[highGuard,highGuard]];
function match(a=balanced,b=balanced){const m=new D.Match({fighters:[a,b],mode:'local'});m.phase='fight';m.fighters[0].x=450;m.fighters[1].x=560;return m;}
function repeated(a,b,key){const m=match(a,b);let blocks=0;for(let i=0;i<3600;i++){m.tick({axis:1,action:key},{axis:0,guard:true});const events=m.drain();blocks+=events.filter(e=>['block','break'].includes(e.type)).length;const failure=events.find(e=>e.type==='break')||events.find(e=>e.type==='tired');if(failure)return {m,failure,blocks};}throw Error('No exhaustion');}
test('light spam exhausts the attacker first for all ten full-stamina matchups',()=>{
  for(const[a,b]of pairs){const r=repeated(a,b,'light');assert.equal(r.failure.type,'tired');assert.equal(r.failure.a.index,0);assert.ok(r.m.fighters[1].stamina>r.m.fighters[1].p.staminaMax*.45);assert.ok(r.blocks>=10);}
  assert.equal(D.moves.light.cost,10);
});
test('heavy pressure breaks guard in three or four blocked blows before attacker fatigue',()=>{
  for(const[a,b]of pairs){const r=repeated(a,b,'heavy');assert.equal(r.failure.type,'break',a.name+'/'+b.name);assert.ok(r.blocks>=3 && r.blocks<=4);assert.equal(r.m.fighters[0].exhaustion,0);assert.equal(r.m.fighters[1].exhaustion,D.RULES.exhaustion);}
  assert.equal(D.moves.heavy.cost,24);
});
test('guard impact costs use separate normal formulas and retain every super formula',()=>{
  for(const key of ['light','heavy','rush','crush','comet','azure']) {
    const m=match(),[a,b]=m.fighters,move=D.moves[key];
    a.attack={key,move,age:move.wind,wind:move.wind};
    const initial=b.stamina;
    m.apply({kind:'block',a,b,move,point:b.x,lift:0});
    const expected=(move.guardDamage ?? (move.damage*1.9+6)*(move.guardScale||1))*b.p.guardCost;
    assert.ok(Math.abs(initial-b.stamina-expected)<1e-8,key);
  }
});
test('passive guard costs four per second, regenerates only after release, and is finite',()=>{
  const m=match(),b=m.fighters[1],initial=b.stamina;
  for(let i=0;i<300;i++)m.tick(blank,{guard:true});
  assert.ok(Math.abs(b.stamina-(initial-20))<1e-8);
  m.tick();assert.ok(b.stamina>initial-20);
  for(let i=0;i<1800 && !b.exhaustion;i++)m.tick(blank,{guard:true});
  assert.ok(b.exhaustion>0);
});
test('a correctly timed heavy dodge wins while an early or repeated dodge does not',()=>{
  for(const action of ['spot','back']){
    const m=match();m.tick({action:'heavy'});
    while(m.fighters[0].attack.age<m.fighters[0].attack.wind-1)m.tick();
    m.tick(blank,{action});assert.equal(m.fighters[1].hp,m.fighters[1].p.hp);assert.equal(m.fighters[1].tally.perfect,1);assert.equal(m.fighters[0].opening,40);
  }
  const early=match();early.tick({action:'heavy'},{action:'spot'});for(let i=0;i<26;i++)early.tick();assert.ok(early.fighters[1].hp<early.fighters[1].p.hp);
  const spam=match();for(let i=0;i<400 && !spam.fighters[1].exhaustion;i++)spam.tick(blank,{action:'spot'});assert.ok(spam.fighters[1].exhaustion>0);
});
test('rush movie release keeps travel and all four real hits, damage, push and hitstop',()=>{
  const results=[];
  for(const prepared of [false,true]) {
    const m=match(D.cast[1],balanced),[a,b]=m.fighters;a.meter=100;m.tick({action:'special'});const before=a.x;
    m.endCinematic(m.cinematic,prepared);let frames=0;
    while(!a.tally.hit && frames<30){m.tick();frames++;}
    const firstTravel=a.x-before;
    for(let i=0;i<70;i++)m.tick();const events=m.drain().filter(e=>e.rush);
    assert.deepEqual(events.map(e=>e.rushBeat),[1,2,3,4]);assert.equal(events.filter(e=>e.rushFinish).length,1);
    assert.ok(events.every(e=>e.damage===D.moves.rush.damage*a.p.damage));assert.equal(a.tally.hit,4);
    assert.equal(D.moves.rush.stop,3);assert.equal(D.moves.rush.push,45);
    results.push({frames,firstTravel,hp:b.hp});
  }
  assert.equal(results[1].frames,6);assert.equal(results[0].hp,results[1].hp);assert.ok(Math.abs(results[0].firstTravel-results[1].firstTravel)<1e-8);
});
test('online rush has fixed duration and emits one confirmed voice cue and release',()=>{
  const m=new D.Match({fighters:[D.cast[1],balanced],mode:'local',online:true});m.phase='fight';m.fighters[0].meter=100;m.tick({action:'special'});
  assert.equal(m.cinematic.duration,289);for(let i=0;i<289;i++)m.tick();
  const events=m.drain();assert.equal(events.filter(e=>e.type==='specialVoice').length,1);assert.equal(events.filter(e=>e.type==='rushRelease').length,1);
  assert.equal(m.cinematic,null);assert.equal(m.fighters[0].attack.age,m.fighters[0].attack.wind-6);
});
test('super voice is deduplicated by activation across clones, respects mute and resets per match',()=>{
  const played=[];
  class Audio {constructor(src){this.src=src;this.paused=true;}play(){this.paused=false;played.push(this.src);return Promise.resolve();}pause(){this.paused=true;}}
  const dojo={...D};vm.runInNewContext(fs.readFileSync(require.resolve('../js/audio.js'),'utf8'),{Dojo:dojo,Audio,performance:{now:()=>0},setTimeout,clearTimeout});
  const shot={a:{data:D.cast[1],index:0},key:'rush',serial:20};
  dojo.Audio.superVoice(shot);dojo.Audio.superVoice(structuredClone(shot));dojo.Audio.event({...shot,type:'rushRelease'});assert.equal(played.length,1);
  dojo.Audio.mute(true);dojo.Audio.superVoice({...shot,serial:22});assert.equal(played.length,1);dojo.Audio.mute(false);dojo.Audio.event({...shot,serial:22,type:'rushRelease'});assert.equal(played.length,1);
  dojo.Audio.resetSupers();dojo.Audio.superVoice(shot);assert.equal(played.length,2);assert.ok(played[0].includes('momonosuke-super-v31'));
});
