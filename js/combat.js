(function (root) {
  "use strict";
  const D = root.Dojo;
  const LIMIT = { left:154, right:1126, spawn:[410,870], round:180, ready:108, dt:1/60 };
  const RULES = {
    exhaustion:90, jump:665, gravity:1440, superLimit:2, cutIn:66, openingCharge:24,
    chargePerSecond:.40, hitCharge:3.2, receivedCharge:2, guardCharge:2.6, evadeCharge:4.5,
    perfectWindow:3, perfectCooldown:120, punishWindow:40, perfectRecovery:5, perfectStop:5
  };
  const passive = () => ({ axis:0, guard:false });
  const gap = (a,b) => Math.abs(a.x-b.x);
  const reach = (a,b,move) => move.reach+a.p.reach+b.p.hurt;
  function boxer(data, index) {
    const p = D.profile(data);
    return {
      data,p,index,x:LIMIT.spawn[index],lift:0,vy:0,hp:p.hp,stamina:p.staminaMax,meter:RULES.openingCharge,used:0,
      face:index?-1:1,guard:false,attack:null,stun:0,exhaustion:0,dodge:0,dodgeType:null,
      dodgeInputFrame:-Infinity,dodgeInvThreshold:0,perfectLock:0,opening:0,perfectFlash:0,
      knock:0,recovery:0,buffer:null,moving:0,tally:{hit:0,block:0,evade:0,perfect:0,dealt:0}
    };
  }
  class Match {
    constructor({ fighters, mode, difficulty = "normal", dummy = "idle", random = Math.random }) {
      this.fighters = fighters.map(boxer);
      this.mode=mode;
      this.difficulty=difficulty;
      this.dummy=dummy;
      this.random=random;
      this.phase="ready";
      this.ready=LIMIT.ready;
      this.seconds=LIMIT.round;
      this.freeze=0;
      this.frame=0;
      this.events=[];
      this.cinematics=[];
      this.ai={reconsider:0,command:passive()};
      this.result=null;
      if (mode==="practice") this.fighters.forEach(f=>{f.meter=100;});
    }
    get cinematic() {
      return this.cinematics[0] || null;
    }
    emit(type, a, b = null, extra = {}) {
      this.events.push({type,a,b,...extra});
    }
    drain() {
      return this.events.splice(0);
    }
    tick(p1 = passive(), p2 = passive()) {
      if (this.phase==="over") return;
      if (this.phase==="ready") {
        if (--this.ready<=0) {
          this.phase="fight";
          this.emit("fight",...this.fighters);
        }
        return;
      }
      if (this.cinematic) {
        if (++this.cinematic.age>=RULES.cutIn) {
          this.cinematics.shift();
          if (this.cinematic) this.announce(this.cinematic);
        }
        return;
      }
      const [a,b]=this.fighters;
      if (this.freeze>0) {
        this.capture(a,p1);
        if (this.mode==="local") this.capture(b,p2);
        this.freeze--;
        return;
      }
      this.frame++;
      this.seconds=Math.max(0,LIMIT.round-this.frame*LIMIT.dt);
      const second=this.mode==="local"?p2:this.cpu(b,a);
      const openings=[this.update(a,p1),this.update(b,second)].filter(Boolean);
      this.separate();
      const hits=[this.strike(a,b),this.strike(b,a)].filter(Boolean);
      const countered=new Set(hits.filter(hit=>hit.kind==="counter").map(hit=>hit.a));
      for (const hit of hits) if (!countered.has(hit.b)) this.apply(hit);
      this.expire(a);
      this.expire(b);
      if (this.mode==="practice") {
        for (const f of this.fighters) {
          if(f.hp<=0) f.hp=f.p.hp;
          f.meter=100;
        }
      } else if (a.hp<=0 || b.hp<=0 || this.seconds===0) {
        this.finish();
        return;
      }
      this.cinematics=openings.filter(shot=>shot.a.attack?.key===shot.key);
      if (this.cinematic) this.announce(this.cinematic);
    }
    announce(shot) {
      const {a,key}=shot;
      this.emit("special",a,null,{key});
    }
    capture(f,cmd) {
      if (cmd.action && !f.exhaustion) f.buffer={action:cmd.action,frames:9,inputFrame:this.frame};
    }
    grant(f,amount) {
      if (this.mode==="practice" || f.used<RULES.superLimit) f.meter=Math.min(100,f.meter+amount*(f.used===0?1:.38));
    }
    exhaust(f) {
      if(f.exhaustion) return;
      f.attack=null;
      f.guard=false;
      f.buffer=null;
      f.exhaustion=RULES.exhaustion;
      f.recovery=0;
      this.emit("tired",f);
    }
    update(f,cmd) {
      this.capture(f,cmd);
      const {p}=f;
      let shot=null;
      f.stun=Math.max(0,f.stun-1);
      f.perfectLock=Math.max(0,f.perfectLock-1);
      f.opening=Math.max(0,f.opening-1);
      f.perfectFlash=Math.max(0,f.perfectFlash-1);
      f.recovery=Math.max(0,f.recovery-1);
      if(f.exhaustion>0 && --f.exhaustion===0) f.stamina=Math.max(f.stamina,p.staminaMax*.34);
      this.grant(f,RULES.chargePerSecond*LIMIT.dt);
      f.knock*=.81;
      f.x+=f.knock*LIMIT.dt;
      f.moving=0;
      f.guard=false;
      if (!f.attack && !f.stun && !f.dodge && !f.exhaustion) {
        const action=f.buffer?.action;
        if (action) {
          const grounded=f.lift===0;
          if (grounded || action==="light" || action==="heavy") {
            shot=this.begin(f,action,f.buffer.inputFrame);
            f.buffer=null;
          }
        }
        if (!f.attack && !f.dodge && !f.exhaustion) {
          f.guard=!!cmd.guard && f.lift===0;
          f.moving=cmd.axis || 0;
          const speed=f.guard?.43:f.lift>0?.82:Math.sign(cmd.axis)===f.face?1:.78;
          f.x+=f.moving*p.walk*speed*LIMIT.dt;
        }
      }
      if (f.attack) {
        f.attack.age++;
        if (f.attack.age<=f.attack.wind) f.x+=f.face*f.attack.move.step*LIMIT.dt;
      }
      if(f.lift>0 || f.vy>0) {
        f.vy-=RULES.gravity*LIMIT.dt;
        f.lift=Math.max(0,f.lift+f.vy*LIMIT.dt);
        if (f.lift===0) f.vy=0;
      }
      if (f.dodge>0) {
        if (f.dodgeType==="back" && f.dodge>8) f.x-=f.face*p.dodgeSpeed*LIMIT.dt;
        f.dodge--;
      }
      if (f.buffer && --f.buffer.frames<=0) f.buffer=null;
      if (!f.attack && !f.dodge && !f.recovery && !f.stun && !f.exhaustion) {
        const recovery=f.guard?.16:f.lift>0?.40:1;
        f.stamina=Math.min(p.staminaMax,f.stamina+p.regen*recovery*LIMIT.dt);
      }
      return shot;
    }
    begin(f,action,inputFrame) {
      const special=action==="special";
      if (special && this.mode!=="practice" && f.used>=RULES.superLimit) {
        this.emit("spent",f);
        return null;
      }
      if (special && f.meter<100) {
        this.emit("meter",f);
        return null;
      }
      if (action==="jump") {
        f.vy=RULES.jump;
        this.emit("jump",f);
        return null;
      }
      const dodge=action==="back" || action==="spot";
      const key=special?f.data.special:action;
      const move=D.moves[key];
      if (!dodge && !move) return null;
      const cost=dodge?(action==="back"?22:16):(move.cost || 0);
      if (f.stamina<cost) {
        this.exhaust(f);
        return null;
      }
      f.stamina-=cost;
      f.recovery=22;
      if (dodge) {
        f.dodgeType=action;
        f.dodgeInputFrame=inputFrame;
        f.dodgeInvThreshold=action==="back"?15:11;
        f.dodge=f.p.inv+f.dodgeInvThreshold;
        this.emit("step",f,null,{key:action});
        return null;
      }
      const wind=special?move.wind:Math.round(move.wind*f.p.wind);
      f.attack={key,move,wind,age:0,spent:false};
      if (special) {
        f.meter=0;
        f.used++;
        return {a:f,key,age:0};
      }
      this.emit("swing",f,null,{key});
      return null;
    }
    separate() {
      const [a,b]=this.fighters;
      const spacing=.98*(a.p.hurt+b.p.hurt)+12;
      const center=D.clamp((a.x+b.x)/2,LIMIT.left+spacing/2,LIMIT.right-spacing/2);
      if (b.x-a.x<spacing) {
        a.x=center-spacing/2;
        b.x=center+spacing/2;
      } else {
        a.x=D.clamp(a.x,LIMIT.left,LIMIT.right-spacing);
        b.x=D.clamp(b.x,LIMIT.left+spacing,LIMIT.right);
      }
    }
    strike(a,b) {
      const attack=a.attack;
      if (!attack || !attack.move.beats.includes(attack.age-attack.wind)) return null;
      const {move}=attack;
      const distance=gap(a,b);
      const level=a.lift+a.p.bodyHeight*.40;
      const y=level-b.lift;
      if(distance>reach(a,b,move) || y < -24 || y > b.p.bodyHeight*.81+23) {
        return {kind:"miss",a,b,move,point:a.x+a.face*(move.reach+a.p.reach),lift:a.lift};
      }
      if (b.dodge>=b.dodgeInvThreshold && b.dodge>0) {
        const perfect=b.perfectLock===0 && this.frame-b.dodgeInputFrame<RULES.perfectWindow;
        return {kind:perfect?"perfect":"evade",a,b,move,point:b.x,lift:b.lift};
      }
      if (b.attack?.key==="counter" && b.attack.age<=20 && !b.attack.spent && distance<=reach(b,a,D.moves.counter)) {
        return {kind:"counter",a:b,b:a,move:D.moves.counter,point:a.x,lift:a.lift};
      }
      return {kind:b.guard?"block":"hit",a,b,move,point:b.x-a.face*b.p.hurt*.54,lift:b.lift};
    }
    apply({kind,a,b,move,point,lift}) {
      if (kind==="miss") {
        this.emit("miss",a,b,{point,lift});
        return;
      }
      if (kind==="evade" || kind==="perfect") {
        b.tally.evade++;
        this.grant(b,RULES.evadeCharge);
        if (kind==="perfect") {
          b.tally.perfect++;
          b.perfectLock=RULES.perfectCooldown;
          b.perfectFlash=26;
          b.dodge=RULES.perfectRecovery;
          // End the current move, including any remaining hits of a rush.
          a.attack=null;
          a.buffer=null;
          a.opening=RULES.punishWindow;
          a.stun=Math.max(a.stun,a.opening);
          this.freeze=Math.max(this.freeze,RULES.perfectStop);
        }
        this.emit(kind,b,a,{point,lift});
        return;
      }
      const normal=move===D.moves.light || move===D.moves.heavy;
      let damage=move.damage*a.p.damage;
      let stun=move.stun;
      if (kind==="block") {
        b.stamina-=(move.damage*1.9+6)*b.p.guardCost*(move.guardScale || 1);
        if (b.stamina<=0) {
          kind="break";
          b.stamina=0;
          damage*=.60;
          this.exhaust(b);
        } else {
          damage=Math.min(damage*b.p.chip,Math.max(0,b.hp-.5));
          b.tally.block++;
          stun=Math.round(move.stun*.44);
        }
      }
      if (kind==="counter" && a.attack) {
        a.attack.spent=true;
        a.attack.age=24;
      }
      b.hp=Math.max(0,b.hp-damage);
      b.stun=Math.max(b.stun,stun);
      b.recovery=Math.max(b.recovery,21);
      b.attack=null;
      b.knock=a.face*move.push*(kind==="block"?.57:1);
      if (kind!=="block") a.tally.hit++;
      a.tally.dealt+=damage;
      if (normal) this.grant(a,kind==="block"?1.4:RULES.hitCharge);
      this.grant(b,kind==="block"?RULES.guardCharge:RULES.receivedCharge);
      this.freeze=Math.max(this.freeze,move.stop);
      this.emit(kind,a,b,{point,lift,damage,heavy:move.stop>=6});
    }
    expire(f) {
      if (!f.attack) return;
      const {age,wind,move,key,spent}=f.attack;
      const last=move.beats.at(-1) || 0;
      const end=key==="counter" && spent?44:wind+last+move.end;
      if (age>=end) {
        if (key==="counter" && !spent) this.emit("miss",f,null,{point:f.x});
        f.attack=null;
      }
    }
    cpu(f,other) {
      const idle=passive();
      if (this.mode==="practice" && this.dummy!=="active") {
        idle.guard=this.dummy==="guard";
        return idle;
      }
      const easy=this.difficulty==="easy" || this.mode==="practice";
      const distance=gap(f,other);
      const light=reach(f,other,D.moves.light);
      const heavy=reach(f,other,D.moves.heavy);
      const danger=other.attack && other.attack.age<other.attack.wind+2 &&
        distance<reach(other,f,other.attack.move)+12;
      if (this.frame<this.ai.reconsider) return {...this.ai.command,action:null};
      this.ai.reconsider=this.frame+(easy?15:10)+Math.floor(this.random()*8);
      const roll=this.random();
      const cmd=passive();
      const ready=f.meter===100 && (this.mode==="practice" || f.used<RULES.superLimit);
      if (f.exhaustion || f.stamina<27) {
        cmd.axis=distance<heavy+30?1:0;
      } else if (danger && !f.attack && roll<(easy?.30:.60)) {
        if (!easy && ready && f.data.special==="counter") cmd.action="special";
        else if (roll<.065) cmd.action="back";
        else if (roll<.17) cmd.action="spot";
        else cmd.guard=true;
      } else if (!f.attack && !f.dodge && ready && f.data.special!=="counter" &&
        (distance<reach(f,other,D.moves[f.data.special])+28 || f.data.special==="comet" && distance<310) && roll>.38) {
        cmd.action="special";
      } else if (distance>light-10) {
        cmd.axis=-1;
        if (distance<heavy+20 && roll>.62 && !f.attack) cmd.action="heavy";
      } else if (!f.attack && !f.stun) {
        if (roll<(easy?.40:.21)) {
          cmd.axis=roll<.09?1:0;
          cmd.guard=roll>.11;
        } else cmd.action=roll>.72?"heavy":"light";
      }
      this.ai.command=cmd;
      return cmd;
    }
    finish() {
      const [a,b]=this.fighters;
      const diff=a.hp/a.p.hp-b.hp/b.p.hp;
      const winner=Math.abs(diff)<1e-7?null:diff>0?0:1;
      this.result={winner,reason:Math.min(a.hp,b.hp)<=0?"KO":"TIME UP"};
      this.phase="over";
      this.cinematics=[];
      this.emit("over",winner===null?null:this.fighters[winner]);
    }
    resetPractice() {
      this.fighters=this.fighters.map(f=>boxer(f.data,f.index));
      this.fighters.forEach(f=>{f.meter=100;});
      this.freeze=0;
      this.cinematics=[];
      this.events.length=0;
      this.ai={reconsider:0,command:passive()};
    }
  }
  D.Match=Match;
  D.LIMIT=LIMIT;
  D.RULES=RULES;
})(globalThis);
