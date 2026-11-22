(function(D){
  "use strict";
  const duration=720,forms={
    thermae:{name:"テルマエ形態",color:"#a4e6d7",a:"bathwall",b:"geyser",cooldownA:60,cooldownB:60},
    nozaki:{name:"野崎形態",color:"#bdcaff",a:"shot",b:"flank",cooldownA:60,cooldownB:60}
  };
  const is=f=>f?.id==='headman';
  function initial(seed,index){return {form:null,pending:null,remaining:0,ending:false,cooldownA:0,cooldownB:0,ammo:0,rolls:0,rng:((seed>>>0)^Math.imul(index+1,0x9e3779b9))>>>0};}
  function next(state){state.rng=(state.rng+0x6D2B79F5)>>>0;let n=state.rng;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return (n^(n>>>14))>>>0;}
  function drawForm(f){const s=f.shift;s.pending=next(s)<0x80000000?'thermae':'nozaki';s.rolls++;return s.pending;}
  function complete(m,f){const s=f.shift;if(!s?.pending)return;s.form=s.pending;s.pending=null;s.remaining=duration;s.ending=false;s.cooldownA=s.cooldownB=0;s.ammo=s.form==='nozaki'?2:0;f.attack=null;m.emit('transform',f,null,{form:s.form});}
  function usable(f){return !!f.shift?.form&&f.shift.remaining>0&&!f.shift.ending;}
  function look(f){return f.shift?.form?D.headmanForms[f.shift.form]:f.data;}
  function finish(m,f){const old=f.shift.form;f.shift.form=null;f.shift.ending=false;f.shift.ammo=0;f.shift.cooldownA=f.shift.cooldownB=0;m.emit('transformEnd',f,null,{form:old});}
  function beforeFrame(m){
    for(const f of m.fighters){f.prevX=f.x;const s=f.shift;if(!s)continue;
      s.cooldownA=Math.max(0,s.cooldownA-1);s.cooldownB=Math.max(0,s.cooldownB-1);
      if(s.form&&s.remaining>0&&--s.remaining===0)s.ending=true;
      if(s.ending&&!f.attack&&!f.captured)finish(m,f);
    }
  }
  function skill(m,f,action){
    const s=f.shift;if(!usable(f)){m.emit('skillUnavailable',f);return null;}
    const slot=action==='skillA'?'A':'B',spec=forms[s.form],key=spec[slot==='A'?'a':'b'];
    if(s['cooldown'+slot]>0||key==='shot'&&s.ammo===0){m.emit('skillUnavailable',f);return null;}
    return {key,slot,cooldown:spec['cooldown'+slot]};
  }
  function accepted(m,f,info,attack){
    f.shift['cooldown'+info.slot]=info.cooldown;if(info.key==='shot')f.shift.ammo--;
    attack.id=++m.world.serial;
    if(info.key==='shot')attack.aimSlope=weapon(f,m.fighters[1-f.index]).slope;
    if(info.key==='flank'){
      const other=m.fighters[1-f.index];attack.travelFace=f.face;attack.targetX=D.clamp(other.x+f.face*94,D.LIMIT.left,D.LIMIT.right);
    }
    if(info.key==='geyser'){
      const x=D.clamp(f.x+f.face*170,D.LIMIT.left+35,D.LIMIT.right-35);
      m.world.geysers.push({id:attack.id,owner:f.index,x,age:0,attackId:attack.id,hit:false});m.emit('geyserTell',f,null,{point:x});
    }
    m.emit('skill',f,null,{key:info.key});
  }
  function invulnerable(f){return f.attack?.key==='flank'&&f.attack.age>=4&&f.attack.age<=9;}
  function crossing(m){return m.fighters.some(f=>f.attack?.key==='flank'&&f.attack.age<=f.attack.wind);}
  function move(f){const a=f.attack;if(a?.key!=='flank')return false;const delta=a.targetX-f.x;f.x+=Math.sign(delta)*Math.min(Math.abs(delta),a.move.step/60);return true;}
  function constrain(m){
    for(const f of m.fighters){f.x=D.clamp(f.x,D.LIMIT.left,D.LIMIT.right);
      for(const w of m.world.walls){if(w.ttl<=0||f.lift>=w.height)continue;const r=w.width/2+12,previous=f.prevX??f.x;
        if(previous<=w.x-r&&f.x>w.x-r)f.x=w.x-r;
        else if(previous>=w.x+r&&f.x<w.x+r)f.x=w.x+r;
        else if(Math.abs(f.x-w.x)<r)f.x=w.x+(f.x<w.x?-r:r);
      }
    }
  }
  function damageWall(m,w,amount,a){if(w.hp<=0)return;w.hp=Math.max(0,w.hp-amount);m.emit(w.hp?'wallHit':'wallBreak',a,null,{point:w.x,entity:w.id});}
  function weapon(f,other){const s=look(f).sprite,h=f.p.bodyHeight,handX=h*s.crop[2]/s.crop[3]*(s.glove[0]-s.align),handH=f.lift+h*(1-s.glove[1]),distance=Math.max(100,Math.abs(other.x-(f.x+f.face*handX)));return {handX,handH,slope:(other.lift+other.p.bodyHeight*.43-handH)/distance};}
  function blockStrike(m,a,b,move){
    if(a.lift>112||!move.damage)return false;
    const w=m.world.walls.find(w=>w.ttl>0&&(w.x-a.x)*a.face>0&&Math.abs(w.x-a.x)<move.reach+a.p.reach+w.width/2&&Math.abs(w.x-a.x)<Math.abs(b.x-a.x));
    if(!w)return false;damageWall(m,w,move.damage*a.p.damage,a);return true;
  }
  function release(m,a){
    const attack=a.attack;if(!attack||attack.spawned||attack.age!==attack.wind)return;
    if(attack.key==='bathwall'){
      attack.spawned=true;const candidates=[145,185,225,265].map(d=>D.clamp(a.x+a.face*d,D.LIMIT.left+42,D.LIMIT.right-42));
      const x=candidates.find(x=>(x-a.x)*a.face>55&&m.fighters.every(f=>Math.abs(f.x-x)>55)&&m.world.walls.every(w=>w.owner===a.index||Math.abs(w.x-x)>135));
      if(x===undefined){m.emit('wallBlocked',a);return;}
      m.world.walls=m.world.walls.filter(w=>w.owner!==a.index);const wall={id:attack.id,owner:a.index,x,width:36,height:112,hp:28,ttl:150,age:0};m.world.walls.push(wall);m.emit('wallBuild',a,null,{point:x,entity:wall.id});
    }else if(attack.key==='shot'){
      attack.spawned=true;const aim=weapon(a,m.fighters[1-a.index]),x=a.x+a.face*(aim.handX+30),height=aim.handH+aim.slope*30;attack.aimSlope=aim.slope;
      m.world.projectiles.push({id:attack.id,owner:a.index,x,height,face:a.face,slope:aim.slope,travel:0,age:0});m.emit('gunshot',a,null,{point:x,lift:height});
    }
  }
  function collision(m,a,b,move,point,height,kind){
    if(b.hp<=0)return;
    const normalDodge=b.dodge>0&&b.dodge>=b.dodgeInvThreshold;
    if(normalDodge||invulnerable(b)){
      const perfect=normalDodge&&!b.perfectLock&&m.frame-b.dodgeInputFrame<D.RULES.perfectWindow;
      m.apply({kind:perfect?'perfect':'evade',a,b,move,point,lift:b.lift});return;
    }
    const guarded=b.guard&&b.lift===0;const before=b.hp;
    m.apply({kind:guarded?'block':'hit',a,b,move,point,lift:b.lift});
    if(kind==='geyser'&&b.hp<before&&!guarded)b.vy=385;
    m.emit('skillImpact',a,b,{key:kind,point,lift:b.lift,blocked:guarded});
  }
  function afterFrame(m){
    for(const w of m.world.walls){w.age++;if(--w.ttl===0)m.emit('wallFade',m.fighters[w.owner],null,{point:w.x,entity:w.id});}
    m.world.walls=m.world.walls.filter(w=>w.ttl>0&&w.hp>0);
    for(const g of m.world.geysers){
      const a=m.fighters[g.owner],b=m.fighters[1-g.owner];g.age++;
      if(g.age<27&&a.attack?.id!==g.attackId){g.age=99;continue;}
      if(g.age===27)m.emit('geyserBurst',a,null,{point:g.x});
      if(g.age>=27&&g.age<35&&!g.hit&&Math.abs(b.x-g.x)<65+b.p.hurt*.35&&b.lift<195){g.hit=true;collision(m,a,b,D.moves.geyser,g.x,b.lift,'geyser');}
    }
    m.world.geysers=m.world.geysers.filter(g=>g.age<49);
    for(const p of m.world.projectiles){
      const a=m.fighters[p.owner],b=m.fighters[1-p.owner],from=p.x,step=800/60;p.age++;p.x+=p.face*step;p.height+=p.slope*step;p.travel+=step;
      const wall=m.world.walls.find(w=>Math.min(from,p.x)-4<w.x+w.width/2&&Math.max(from,p.x)+4>w.x-w.width/2&&p.height<w.height+5);
      if(wall){damageWall(m,wall,D.moves.shot.damage*a.p.damage,a);p.dead=true;continue;}
      const y=p.height-b.lift;
      if(Math.min(from,p.x)-b.p.hurt<=b.x&&Math.max(from,p.x)+b.p.hurt>=b.x&&y>=-14&&y<=b.p.bodyHeight*.81+23){collision(m,a,b,D.moves.shot,b.x,p.height,'shot');p.dead=true;}
    }
    m.world.projectiles=m.world.projectiles.filter(p=>!p.dead&&p.travel<420&&p.height>5&&p.x>D.LIMIT.left-30&&p.x<D.LIMIT.right+30);
    for(const f of m.fighters)if(f.shift?.ending&&!f.attack&&!f.captured)finish(m,f);
  }
  function cpu(m,f,other,roll){
    if(!f.shift)return null;const distance=Math.abs(f.x-other.x),s=f.shift;
    if(!s.form&&f.meter===100&&(m.mode==='practice'||f.used<D.RULES.superLimit)&&!f.attack&&!f.stun&&f.lift===0&&roll>.30)return 'special';
    if(!usable(f)||f.attack||f.stun||f.lift>0)return null;
    if((m.difficulty==='easy'||m.mode==='practice')&&roll<.58)return null;
    if(other.attack&&other.attack.age<other.attack.wind&&distance<200&&roll<.70)return null;
    if(s.form==='thermae'){
      if(s.cooldownB===0&&f.stamina>=24&&distance>105&&distance<265&&roll>.24)return 'skillB';
      if(s.cooldownA===0&&f.stamina>=18&&distance>150&&distance<380&&roll>.60)return 'skillA';
    }else{
      if(s.cooldownA===0&&s.ammo>0&&f.stamina>=18&&distance>180&&distance<410&&roll>.38)return 'skillA';
      if(s.cooldownB===0&&f.stamina>=22&&distance>105&&distance<275&&roll>.26)return 'skillB';
    }
    return null;
  }
  const world=()=>({serial:0,walls:[],geysers:[],projectiles:[]});
  D.Headman={forms,duration,is,initial,next,drawForm,complete,usable,look,beforeFrame,afterFrame,skill,accepted,invulnerable,crossing,move,constrain,blockStrike,release,cpu,world};
})(globalThis.Dojo);
