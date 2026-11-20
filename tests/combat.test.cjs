const assert = require("node:assert/strict");
const { test } = require("node:test");
const D = require("../js/data.js");
require("../js/combat.js");

const blank = { axis:0, guard:false };
const action = (key,axis=0) => ({ ...blank,axis,action:key });
const custom = (cfg={}) => D.normalize({ name:"テスト", ...D.presets.balanced, ...cfg });
function create(fighters=[custom(),custom()], mode="local", difficulty="normal", dummy="idle") {
  let seed=40;
  const random=()=>{
    seed=(seed*1664525+1013904223)>>>0;
    return seed/4294967296;
  };
  return new D.Match({fighters,mode,difficulty,dummy,random});
}
function tick(m,count=1,a=blank,b=blank) {
  for(let i=0;i<count;i++)m.tick(a,b);
}
function setup(fighters, distance=87, mode) {
  const m=create(fighters,mode);
  tick(m,D.LIMIT.ready);
  m.drain();
  m.fighters[1].x=m.fighters[0].x+distance;
  return m;
}
const types = m=>m.drain().map(e=>e.type);
const used = f=>Object.values(f.bonus).reduce((a,b)=>a+b,0);

test("roster presets, trade-offs, spend cap, and stat formulas",()=>{
  for(const p of Object.values(D.presets)) assert.equal(used(custom(p)),10);
  assert.equal(used(custom({bonus:{stamina:8,dodge:4,guard:3}})),10);
  assert.deepEqual(D.bonus({stamina:8,dodge:-3,guard:8}),{stamina:5,dodge:0,guard:5});
  const low=D.profile(custom({speed:1,power:1,bonus:{}}));
  const high=D.profile(custom({speed:10,power:10,bonus:{stamina:5,dodge:5}}));
  assert.equal(low.speed+low.toughness,11);
  assert.equal(high.power+high.tempo,11);
  assert.ok(high.walk>low.walk && high.hp<low.hp);
  assert.ok(high.damage>low.damage && high.wind>low.wind);
  assert.ok(high.staminaMax>low.staminaMax && high.regen>low.regen);
  assert.ok(high.inv>low.inv && high.dodgeSpeed>low.dodgeSpeed);
  const goodGuard=D.profile(custom({bonus:{guard:5}}));
  assert.ok(goodGuard.guardCost<low.guardCost && goodGuard.chip<low.chip);
});
test("movement and independent actions are bound to each side",()=>{
  const m=create();
  const [a,b]=m.fighters;
  tick(m,D.LIMIT.ready);
  const oldA=a.x,oldB=b.x;
  tick(m,12,action(null,1));
  assert.ok(a.x>oldA+30 && b.x===oldB);
  const movedA=a.x;
  tick(m,12,blank,action(null,-1));
  assert.equal(a.x,movedA);
  assert.ok(b.x<oldB-30);
  assert.equal(new Set(D.controls.flatMap(m=>Object.values(m))).size,18);
  assert.equal(D.controls[0].left,"ArrowLeft");
  assert.equal(D.controls[0].right,"ArrowRight");
  assert.equal(D.controls[0].spot,"KeyW");
  assert.equal(D.controls[0].light,"KeyS");
});
test("weak hits, heavy hits harder and later, distant punch misses",()=>{
  const light=setup(),heavy=setup(),miss=setup(undefined,400);
  light.tick(action("light"));heavy.tick(action("heavy"));miss.tick(action("heavy"));
  tick(light,12);tick(heavy,12);
  assert.ok(light.fighters[1].hp<light.fighters[1].p.hp && heavy.fighters[1].hp===heavy.fighters[1].p.hp);
  tick(heavy,30);tick(miss,55);
  assert.ok(heavy.fighters[0].tally.dealt>light.fighters[0].tally.dealt*1.9);
  assert.ok(types(miss).includes("miss"));
  assert.equal(miss.fighters[1].hp,miss.fighters[1].p.hp);
});
test("guard, guard break, stamina exhaustion, and dodge",()=>{
  const m=setup(),guard={axis:0,guard:true};
  m.tick(action("heavy"),guard);tick(m,33,blank,guard);
  assert.ok(types(m).includes("block"));
  assert.ok(m.fighters[1].hp>m.fighters[1].p.hp-3 && m.fighters[1].stamina<m.fighters[1].p.staminaMax);
  const low=setup();
  low.fighters[1].stamina=12;
  low.tick(action("heavy"),guard);tick(low,33,blank,guard);
  assert.ok(types(low).includes("break"));
  assert.ok(low.fighters[1].exhaustion>80);
  assert.ok(low.fighters[1].hp<low.fighters[1].p.hp-5);
  const dodged=setup();
  dodged.tick(action("light"),action("spot"));tick(dodged,15);
  assert.ok(types(dodged).includes("evade"));
  assert.equal(dodged.fighters[1].hp,dodged.fighters[1].p.hp);
  const tired=setup();
  tired.fighters[0].stamina=6;tired.tick(action("heavy"));
    assert.ok(types(tired).includes("tired"));
  const f=tired.fighters[0], x=f.x;
  tick(tired,D.RULES.exhaustion-1,action("light",1));
  assert.equal(f.x,x);
  assert.equal(f.attack,null);
  assert.equal(f.exhaustion,1);
  tired.tick();
  assert.equal(f.exhaustion,0);
  assert.ok(f.stamina >= f.p.staminaMax*.34);
});
test("height alters visuals and hit/reach geometry without runaway differences",()=>{
  const short=custom({height:1}),tall=custom({height:10}),regular=custom();
  assert.equal(D.cast[1].height,1);
  assert.equal(D.cast[0].height,8);
  assert.ok(Math.abs(D.profile(D.cast[1]).bodyHeight / D.profile(D.cast[0]).bodyHeight - .5)<.02);
  for(const f of [short,tall]) assert.equal(D.profile(f).hp,D.profile(regular).hp);
  for (const [a,b,distance,hit] of [
    [short,regular,147,false],[tall,regular,147,true],
    [regular,short,158,false],[regular,tall,158,true]
  ]) {
    const m=setup([a,b],distance);
    m.tick(action("light"));tick(m,15);
    assert.equal(types(m).includes("hit"),hit);
  }
});
test("all four supers carry out their effects, including a baited counter",()=>{
  for(const [key,distance,hits] of [["rush",72,4],["crush",114,1],["comet",231,1]]) {
    const m=setup([custom({special:key}),custom()],distance);
    m.tick(action("special"));
    assert.equal(m.fighters[0].attack,null);
    assert.ok(types(m).includes("meter"));
    m.fighters[0].meter=100;m.tick(action("special"));tick(m,D.RULES.cutIn+104);
    assert.ok(m.fighters[0].meter<1);
    assert.equal(m.fighters[0].tally.hit,hits,key);
    assert.ok(types(m).includes("special"));
    if(key==="comet")assert.ok(m.fighters[0].x>545);
  }
  const m=setup([custom({special:"counter"}),custom()]);
  const [a,b]=m.fighters;
  a.meter=100;m.tick(action("special"),action("light"));tick(m,D.RULES.cutIn+40);
  assert.ok(types(m).includes("counter"));
  assert.equal(a.hp,a.p.hp);
  assert.ok(b.hp<b.p.hp-18);
  const bait=setup([custom({special:"counter"}),custom()]);
  bait.fighters[0].meter=100;bait.tick(action("special"));tick(bait,D.RULES.cutIn+52);
  assert.ok(types(bait).includes("miss"));
  assert.equal(bait.fighters[1].hp,bait.fighters[1].p.hp);
});
test("KO, time-up bars compare ratios, and draw are resolved",()=>{
  const ko=setup();ko.fighters[1].hp=2;ko.tick(action("light"));tick(ko,22);
  assert.deepEqual(ko.result,{winner:0,reason:"KO"});
  const time=create([custom({speed:10}),custom({speed:1})]);
  tick(time,D.LIMIT.ready+60*D.LIMIT.round);
  assert.deepEqual(time.result,{winner:null,reason:"TIME UP"});
  const win=setup();win.fighters[0].hp*=.63;win.fighters[1].hp*=.48;tick(win,60*D.LIMIT.round);
  assert.deepEqual(win.result,{winner:0,reason:"TIME UP"});
  const trade=setup();trade.fighters.forEach(f=>f.hp=2);
  trade.tick(action("light"),action("light"));tick(trade,18);
  assert.deepEqual(trade.result,{winner:null,reason:"KO"});
});
test("both CPU levels approach, attack, and reach a result",()=>{
  for(const difficulty of ["normal","easy"]){
    const m=create(D.cast,"cpu",difficulty);
    tick(m,D.LIMIT.ready+75*60);
    assert.equal(m.result?.winner,1);
    assert.ok(m.fighters[1].tally.hit>0);
    assert.ok(m.fighters[1].x<D.LIMIT.spawn[1]);
  }
});
test("practice dummy styles and reset preserve unlimited practice",()=>{
  const m=setup(undefined,90,"practice");m.dummy="guard";
  m.tick(action("light"));tick(m,40);assert.ok(types(m).includes("block"));
  tick(m,62*60);
  assert.equal(m.phase,"fight");assert.equal(m.fighters[0].meter,100);
  m.resetPractice();
  assert.equal(m.fighters[0].stamina,m.fighters[0].p.staminaMax);
  assert.equal(m.fighters[0].x,D.LIMIT.spawn[0]);
});
test("saved records load with optional voices and normalized parts",()=>{
  const empty=custom({height:8,skin:5});
  assert.equal(empty.height,8);assert.deepEqual(empty.voice,{});
  assert.equal(D.normalize({id:"custom-legacy",height:3}).height,6);
  const configured=custom({id:"custom-test",heightScale:10,height:2,look:{hair:2,cloth:3},voice:{win:{name:"声.wav",data:"data:audio/wav;base64,AAAA"}}});
  assert.deepEqual(D.normalize(JSON.parse(JSON.stringify(configured))),configured);
  assert.deepEqual(custom({voice:{attack:{name:"bad",data:"https://example.org"}}}).voice,{});
});
test("spot dodge holds position, back dodge retreats, jump avoids a ground strike",()=>{
  const spot=setup(undefined,125), back=setup(undefined,125);
  const x=spot.fighters[0].x;
  spot.tick(action("spot"));back.tick(action("back"));
  tick(spot,21);tick(back,21);
  assert.equal(spot.fighters[0].x,x);
  assert.ok(back.fighters[0].x<x-80);
  const air=setup([D.cast[1],D.cast[0]],119);
  air.tick(action("jump"));
  tick(air,16);
  air.tick(blank,action("light"));
  tick(air,16);
  assert.ok(air.fighters[0].lift>110);
  assert.equal(air.fighters[0].hp,air.fighters[0].p.hp);
  assert.ok(types(air).includes("miss"));
  tick(air,55);
  assert.equal(air.fighters[0].lift,0);
});
test("the cut-in freezes the clock and attacks, and ranks regular matches at two uses",()=>{
  const m=setup([custom({special:"crush"}),custom()],95);
  const f=m.fighters[0];
  assert.equal(D.LIMIT.round,120);
  f.meter=100;
  m.tick(action("special"));
  const frame=m.frame,age=f.attack.age,seconds=m.seconds;
  assert.equal(f.used,1);
  assert.equal(m.cinematic.key,"crush");
  tick(m,D.RULES.cutIn-1);
  assert.equal(frame,m.frame);
  assert.equal(age,f.attack.age);
  assert.equal(seconds,m.seconds);
  assert.equal(m.fighters[1].hp,m.fighters[1].p.hp);
  tick(m,100);
  f.meter=100;
  m.tick(action("special"));
  assert.equal(f.used,2);
  tick(m,D.RULES.cutIn+90);
  m.drain();
  f.meter=100;
  m.tick(action("special"));
  assert.equal(f.used,2);
  assert.equal(m.cinematic,null);
  assert.ok(types(m).includes("spent"));
});

function dodgeAt(framesEarly, type="spot", distance=114, lockout=0) {
  const m=setup(undefined,distance);
  m.fighters[1].perfectLock=lockout;
  m.tick(action("light"));
  tick(m,m.fighters[0].attack.wind-2-framesEarly);
  m.tick(blank,action(type));
  tick(m,framesEarly);
  return m;
}
test("only a fresh dodge in the last three frames creates a punishable opening",()=>{
  for(const framesEarly of [0,1,2]) {
    const m=dodgeAt(framesEarly);
    const [a,b]=m.fighters;
    assert.ok(types(m).includes("perfect"));
    assert.equal(a.attack,null);
    assert.equal(a.stun,D.RULES.punishWindow);
    assert.equal(b.dodge,D.RULES.perfectRecovery);
    assert.equal(b.tally.perfect,1);
    assert.equal(b.hp,b.p.hp);
  }
  const m=dodgeAt(0,"back"), [a,b]=m.fighters;
  assert.ok(types(m).includes("perfect"));
  tick(m,D.RULES.perfectStop+D.RULES.perfectRecovery);
  assert.equal(b.dodge,0);
  const x=a.x;
  tick(m,8,action(null,1));
  assert.equal(a.x,x,"the attacker cannot move before that counterattack");
  m.tick(action("light",1),action("light"));
  tick(m,15,action(null,1));
  assert.ok(a.hp<a.p.hp,"the defender can land a counterattack");
});
test("an early dodge, a distant swing, or the cooldown cannot trigger a perfect dodge",()=>{
  for(const m of [dodgeAt(3),dodgeAt(0,"spot",114,40)]) {
    assert.ok(types(m).includes("evade"));
    assert.equal(m.fighters[0].stun,0);
    assert.equal(m.fighters[1].tally.perfect,0);
  }
  const distant=dodgeAt(0,"spot",225);
  assert.ok(types(distant).includes("miss"));
  assert.equal(distant.fighters[1].tally.evade,0);
});
test("a buffered dodge uses the actual input time",()=>{
  const m=setup(undefined,114), b=m.fighters[1];
  m.tick(action("light"));
  tick(m,m.fighters[0].attack.wind-7);
  b.stun=6;
  m.tick(blank,action("spot"));
  tick(m,5);
  assert.ok(types(m).includes("evade"));
  assert.equal(b.tally.perfect,0);
});

test("landing leaves twelve frames before movement or another action",()=>{
  const m=setup(undefined,400), a=m.fighters[0];
  m.tick(action("jump"));
  while(a.lift>0) m.tick();
  assert.equal(a.landing,12);
  const x=a.x;
  tick(m,11,action("light",1));
  assert.equal(a.x,x);
  assert.equal(a.attack,null);
  m.tick(action("light"));
  assert.equal(a.landing,0);
  assert.equal(a.attack.key,"light");
});

test("holding guard spends stamina steadily and empty guard causes exhaustion",()=>{
  const m=setup(undefined,400), a=m.fighters[0];
  const guard={axis:0,guard:true};
  const start=a.stamina;
  tick(m,300,guard);
  assert.ok(Math.abs(a.stamina-(start-D.RULES.guardDrain*5))<.001);
  a.stamina=.05;
  m.tick({axis:1,guard:true});
  const x=a.x;
  assert.equal(a.exhaustion,D.RULES.exhaustion);
  assert.equal(a.guard,false);
  tick(m,20,guard);
  assert.equal(a.x,x);
});

test("a connected rush guarantees all later hits through distance or defensive input",()=>{
  for(const defender of [action("spot"),{axis:1,guard:true},action("jump")]) {
    const m=setup([custom({special:"rush"}),custom()],100);
    const [a,b]=m.fighters;
    a.meter=100;m.tick(action("special"));
    while(a.tally.hit===0) m.tick();
    assert.equal(a.attack.connected,b);
    b.x=1000;
    tick(m,85,blank,defender);
    assert.equal(a.tally.hit,4);
    assert.equal(b.captured,null);
  }
});

test("guarding, dodging, or missing the first rush strike does not confirm it",()=>{
  const scenarios=[
    {distance:400,cmd:blank},
    {distance:110,cmd:{axis:0,guard:true}},
    {distance:110,cmd:action("spot")}
  ];
  for(const {distance,cmd} of scenarios) {
    const m=setup([custom({special:"rush"}),custom()],distance);
    const [a,b]=m.fighters;
    a.meter=100;m.tick(action("special"),cmd);
    tick(m,D.RULES.cutIn);
    while(a.attack && a.attack.age<a.attack.wind) m.tick(blank,cmd.guard?cmd:blank);
    assert.notEqual(a.attack?.connected,b);
    assert.equal(b.captured,null);
  }
});

test("video completion releases only its current shot and cannot double apply damage",()=>{
  const m=setup([D.cast[0],custom()],110);
  const [a,b]=m.fighters;
  a.meter=100;
  m.tick(action("special"));
  const shot=m.cinematic;
  const frame=m.frame, seconds=m.seconds, x=[a.x,b.x], age=a.attack.age;
  assert.equal(m.endCinematic({a,key:"crush"}),false);
  assert.equal(m.cinematic,shot);
  assert.equal(m.frame,frame);
  assert.equal(m.seconds,seconds);
  assert.deepEqual([a.x,b.x],x);
  assert.equal(a.attack.age,age);
  assert.equal(m.endCinematic(shot),true);
  assert.equal(m.endCinematic(shot),false);
  tick(m,95);
  assert.equal(a.used,1);
  assert.equal(a.tally.hit,1);
  assert.ok(Math.abs((b.p.hp-b.hp)-D.moves.crush.damage*a.p.damage)<1e-9);
  assert.equal(a.stamina,a.p.staminaMax);
  const hit=m.drain().find(e=>e.type==="hit");
  assert.equal(hit.b,b);
  assert.equal(hit.crush,true);
});

test("white peach crush retains its guard and dodge outcomes on either side",()=>{
  for(const side of [0,1]) {
    for(const defense of ["guard","spot"]) {
      const m=setup(side===0?[D.cast[0],custom()]:[custom(),D.cast[0]],110);
      const a=m.fighters[side], b=m.fighters[1-side];
      a.meter=100;
      const command=defense==="guard"?{axis:0,guard:true}:action("spot");
      m.tick(side===1?command:blank,side===0?command:blank);
      m.tick(side===0?action("special"):(defense==="guard"?command:blank),side===1?action("special"):(defense==="guard"?command:blank));
      m.endCinematic(m.cinematic);
      tick(m,40);
      const events=m.drain();
      assert.ok(events.some(e=>e.type===(defense==="guard"?"block":"perfect")));
      assert.ok(b.p.hp-b.hp < 4);
      assert.equal(a.tally.hit,0);
    }
  }
});

test("the cinematic wind-up connects in ten frames with the same damage and travel",()=>{
  const results=[];
  for(const prepared of [false,true]) {
    const m=setup([D.cast[0],custom()],220), a=m.fighters[0];
    a.meter=100;m.tick(action("special"));
    const shot=m.cinematic, before=a.x;
    m.endCinematic(shot,prepared);
    assert.equal(a.x,before);
    let frames=0;
    while(a.tally.hit===0 && frames<40) { m.tick();frames++; }
    results.push({frames,x:a.x,hp:m.fighters[1].hp,used:a.used,stamina:a.stamina,knock:m.fighters[1].knock});
  }
  assert.equal(results[1].frames,10);
  for(const key of ["x","hp","used","stamina","knock"]) {
    assert.ok(Math.abs(results[0][key]-results[1][key])<1e-8,key);
  }
});

test("a prepared crush still honors guard, dodge, and range without hit effects",()=>{
  for(const defense of ["guard","spot","miss"]) {
    const m=setup([D.cast[0],custom()],defense==="miss"?400:120), [a,b]=m.fighters;
    const cmd=defense==="guard"?{axis:0,guard:true}:defense==="spot"?action("spot"):blank;
    m.tick(blank,cmd);
    a.meter=100;m.tick(action("special"),defense==="guard"?cmd:blank);m.endCinematic(m.cinematic,true);
    tick(m,18);
    const events=m.drain();
    assert.ok(events.some(e=>e.type===(defense==="guard"?"block":defense==="spot"?"perfect":"miss")));
    assert.equal(events.some(e=>e.crush),false);
    assert.equal(b.impact,0);
    assert.equal(a.tally.hit,0);
  }
});

test("late cinematic and post-film inputs cannot defend the first super strike on either side",()=>{
  for(const side of [0,1]) for(const prepared of [false,true]) for(const late of ["guard","spot","back","jump"]) {
    const m=setup(side===0?[D.cast[0],custom()]:[custom(),D.cast[0]],120);
    const a=m.fighters[side], b=m.fighters[1-side];
    a.meter=100;
    m.tick(side===0?action("special"):blank,side===1?action("special"):blank);
    const shot=m.cinematic;
    const before={frame:m.frame,seconds:m.seconds,x:b.x,stamina:b.stamina};
    const cmd=late==="guard"?{axis:1,guard:true}:action(late,1);
    tick(m,35,side===1?cmd:blank,side===0?cmd:blank);
    assert.deepEqual({frame:m.frame,seconds:m.seconds,x:b.x,stamina:b.stamina},before);
    assert.equal(m.inputLocked(b),true);
    m.endCinematic(shot,prepared);
    while(a.attack && a.attack.age<a.attack.wind) m.tick(side===1?cmd:blank,side===0?cmd:blank);
    const events=m.drain();
    assert.equal(a.tally.hit,1,`${side}/${prepared}/${late}`);
    assert.equal(b.tally.evade,0);
    assert.equal(b.tally.block,0);
    assert.equal(b.buffer,null);
    assert.equal(events.some(e=>["step","jump"].includes(e.type) && e.a===b),false);
    assert.equal(m.inputLocked(b),false);
  }
});

test("pre-super dodge timing keeps the three-frame perfect window and original invulnerability",()=>{
  for(const side of [0,1]) for(const timing of [0,1,2,3,8,30]) for(const cooldown of [0,90]) {
    const m=setup(side===0?[D.cast[0],custom()]:[custom(),D.cast[0]],120);
    const a=m.fighters[side], b=m.fighters[1-side];
    if(timing>0) {
      m.tick(side===1?action("spot"):blank,side===0?action("spot"):blank);
      tick(m,timing-1);
    }
    b.perfectLock=cooldown;
    a.meter=100;
    m.tick(side===0?action("special"):timing===0?action("spot"):blank,
      side===1?action("special"):timing===0?action("spot"):blank);
    const expected=timing>=30?"hit":timing<3 && !cooldown?"perfect":"evade";
    tick(m,60); // Frozen cinema time must not age or refresh a defensive input.
    m.endCinematic(m.cinematic,true);
    tick(m,15);
    assert.ok(m.drain().some(e=>e.type===expected),`${side}/${timing}/${cooldown}/${expected}`);
    assert.equal(b.tally.perfect,expected==="perfect"?1:0);
    if(expected==="perfect")assert.ok(a.opening>0);
  }
});

test("guard eligibility still requires a ready grounded defender with enough stamina",()=>{
  for(const condition of ["stun","air","break"]) {
    const m=setup([D.cast[0],custom()],120),[a,b]=m.fighters;
    if(condition==="stun")b.stun=8;
    if(condition==="air"){b.lift=8;b.vy=0;}
    if(condition==="break")b.stamina=1;
    a.meter=100;m.tick(action("special"),{axis:0,guard:true});
    m.endCinematic(m.cinematic,true);tick(m,15);
    assert.ok(m.drain().some(e=>e.type===(condition==="break"?"break":"hit")),condition);
    assert.equal(b.tally.block,0);
  }
});

test("interruption releases the defender input lock and counter supers do not immobilize an opponent",()=>{
  const m=setup([D.cast[0],custom()],120),[a,b]=m.fighters;
  a.meter=100;m.tick(action("special"));m.endCinematic(m.cinematic,true);
  a.attack=null;
  assert.equal(m.inputLocked(b),false);
  m.tick(blank,action("spot"));assert.ok(b.dodge>0);
  const counter=setup([custom({special:"counter"}),custom()],120);
  counter.fighters[0].meter=100;counter.tick(action("special"));
  counter.endCinematic(counter.cinematic);
  assert.equal(counter.inputLocked(counter.fighters[1]),false);
  counter.tick(blank,action("light"));assert.equal(counter.fighters[1].attack.key,"light");
});

test("CPU cannot choose a new guard or dodge after the super is announced",()=>{
  const m=setup([D.cast[0],custom()],120,"cpu"),[a,b]=m.fighters;
  m.cpu=()=>blank;a.meter=100;m.tick(action("special"));
  m.cpu=()=>({axis:1,guard:true,action:"spot"});
  m.endCinematic(m.cinematic,true);tick(m,10);
  assert.equal(a.tally.hit,1);assert.equal(b.tally.evade,0);assert.equal(b.tally.block,0);
});
