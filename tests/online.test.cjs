const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../js/data.js');require('../js/combat.js');require('../js/netcode.js');require('../js/online.js');
const blank={axis:0,guard:false,action:null};
const make=(fighters=[D.cast[2],D.cast[0]])=>new D.Match({fighters,mode:'local',online:true});
test('yan is a standard balanced starter with an exclusive super, not a custom option',()=>{
  const yan=D.cast.find(f=>f.id==='yan');assert.equal(yan.name,'ゃん');assert.equal(yan.special,'azure');
  assert.equal(D.specials.includes('azure'),false);assert.equal(D.normalize({special:'azure'}).special,'rush');
  assert.equal(Object.values(yan.bonus).reduce((a,b)=>a+b,0),10);
  assert.equal(D.onlineFighter({id:'yan',power:10,special:'crush'}),yan);
  assert.equal(D.onlineFighter({id:'custom-test',special:'azure',voice:{start:{name:'secret',data:'data:audio/mp3;base64,AA=='}}}).special,'rush');
  assert.deepEqual(D.onlineFighter({id:'custom-test',voice:{}}).voice,{});
  assert.ok(D.moves.azure.damage*D.moves.azure.beats.length<D.moves.crush.damage);
});
test('azure confirms three real hits with one finisher and retains guard, dodge, and range',()=>{
  for(const defense of ['hit','guard','spot','miss']) {
    const defender=D.normalize({...D.presets.balanced,id:'custom-test'});
    const m=make([D.cast[2],defender]);m.phase='fight';const[a,b]=m.fighters;b.x=a.x+(defense==='miss'?500:115);a.meter=100;
    const cmd=defense==='guard'?{...blank,guard:true}:defense==='spot'?{...blank,action:'spot'}:blank;
    m.tick({...blank,action:'special'},cmd);
    for(let i=0;i<D.cutins.yan.frames+180;i++)m.tick(blank,defense==='guard'?cmd:blank);
    const events=m.drain(),hits=events.filter(e=>e.type==='hit');
    assert.equal(hits.length,defense==='hit'?3:0,defense);
    assert.equal(events.filter(e=>e.finisher).length,defense==='hit'?1:0);
    if(defense==='hit'){assert.ok(hits.every(e=>e.b===b));assert.ok(hits.at(-1).heavy);assert.equal(a.used,1);}
    if(defense==='guard')assert.equal(b.tally.block,3);
    if(defense==='spot')assert.equal(b.tally.perfect,1);
  }
});
test('online cinematic duration is deterministic and releases a prepared punch',()=>{
  const m=make([D.cast[0],D.cast[2]]);m.phase='fight';m.fighters[0].meter=100;m.tick({...blank,action:'special'});
  const shot=m.cinematic;assert.equal(shot.duration,255);
  const seconds=m.seconds,x=m.fighters.map(f=>f.x);
  for(let i=0;i<254;i++)m.tick();assert.equal(m.cinematic,shot);assert.equal(m.seconds,seconds);assert.deepEqual(m.fighters.map(f=>f.x),x);
  m.tick();assert.equal(m.cinematic,null);assert.equal(m.fighters[0].attack.age,m.fighters[0].attack.wind-10);
});
test('rollback converges with jitter, input loss, simultaneous specials and no repeated confirmed events',()=>{
  let seed=718;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const ms=[make(),make()],errors=[],eventSets=[[],[]],queue=[];let wall=0;
  for(const m of ms){m.fighters[1].x=m.fighters[0].x+135;m.fighters.forEach(f=>f.meter=100);}
  const cores=ms.map((m,side)=>new D.Rollback(m,{side,send:packet=>{
    if(packet.type==='input' && random()<.12)return;
    queue.push({side:1-side,at:wall+Math.floor(random()*9),packet:structuredClone(packet)});
  },onError:e=>errors.push(e),onEvents:events=>eventSets[side].push(...events.map(e=>[e.type,e.a?.index,e.b?.index,e.damage]))}));
  const input=(side,f)=>({...blank,axis:f<60?(side?-1:1):0,guard:f%170<25,action:f===140?'special':f%69===30?'heavy':f%53===17?'spot':f%85===40?'light':null});
  for(wall=0;wall<3000 && cores.some(c=>c.frame<1100);wall++) {
    queue.sort((a,b)=>a.at-b.at);
    while(queue.length && queue[0].at<=wall){const p=queue.shift();cores[p.side].receive(p.packet);}
    cores.forEach((c,i)=>{if(c.frame<1100)c.advance(input(i,c.frame));});
  }
  for(wall=3000;wall<3020;wall++)while(queue.length){const p=queue.shift();cores[p.side].receive(p.packet);}
  assert.deepEqual(errors,[]);assert.equal(cores[0].frame,1100);assert.equal(cores[1].frame,1100);
  assert.equal(cores[0].confirmed,1099);assert.equal(cores[1].confirmed,1099);
  assert.equal(D.netState.hash(D.netState.save(ms[0])),D.netState.hash(D.netState.save(ms[1])));
  assert.deepEqual(eventSets[0],eventSets[1]);assert.ok(cores.every(c=>c.rollbacks>0));
  assert.ok(cores.every(c=>c.history.size<=30 && c.local.size<=250));
});
test('prediction is bounded and stale, malformed, and contradictory inputs cannot corrupt the simulation',()=>{
  const errors=[],m=make(),c=new D.Rollback(m,{side:0,onError:e=>errors.push(e)});
  while(c.canAdvance())c.advance(blank);
  const frame=c.frame;assert.equal(c.advance({action:'special'}),false);assert.equal(c.frame,frame);
  c.receive({type:'input',entries:[[99999,{action:'special'}],[-1,{}],['x',{}]]});assert.equal(c.frame,frame);
  c.receive({type:'input',entries:[[3,{...blank,action:'light'}]]});
  c.receive({type:'input',entries:[[3,{...blank,action:'heavy'}]]});assert.equal(errors.length,1);
});
