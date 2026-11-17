(function (root) {
  "use strict";
  const D = root.Dojo;
  const LIMIT = { left:100, right:1180, spawn:[440,840], round:60, ready:108, dt:1/60 };
  const passive = () => ({ axis:0, guard:false });
  function boxer(data, index) {
    const p = D.profile(data);
    return { data, p, index, x:LIMIT.spawn[index], hp:p.hp, stamina:p.staminaMax, meter:25, face:index ? -1 : 1, guard:false,
      attack:null, stun:0, dodge:0, dodgeDir:0, knock:0, recovery:0, buffer:null, moving:0, tally:{ hit:0, block:0, evade:0, dealt:0 } };
  }
  class Match {
    constructor({ fighters, mode, difficulty = "normal", dummy = "idle", random = Math.random }) {
      this.fighters = fighters.map(boxer);
      this.mode = mode;
      this.difficulty = difficulty;
      this.dummy = dummy;
      this.random = random;
      this.phase = "ready";
      this.ready = LIMIT.ready;
      this.seconds = LIMIT.round;
      this.freeze = 0;
      this.frame = 0;
      this.events = [];
      this.ai = { reconsider:0, command:passive() };
      this.result = null;
      if (mode === "practice") this.fighters[0].meter = 100;
    }
    emit(type, a, b = null, extra = {}) {
      this.events.push({ type, a, b, ...extra });
    }
    drain() {
      return this.events.splice(0);
    }
    tick(p1 = passive(), p2 = passive()) {
      if (this.phase === "over") return;
      if (this.phase === "ready") {
        this.ready -= 1;
        if (this.ready <= 0) {
          this.phase = "fight";
          this.emit("fight", this.fighters[0], this.fighters[1]);
        }
        return;
      }
      const [a,b] = this.fighters;
      if (this.freeze > 0) {
        this.capture(a,p1);
        if (this.mode === "local") this.capture(b,p2);
        this.freeze -= 1;
        return;
      }
      this.frame += 1;
      this.seconds = Math.max(0, LIMIT.round - this.frame * LIMIT.dt);
      const second = this.mode === "local" ? p2 : this.cpu(b,a);
      this.update(a,p1);
      this.update(b,second);
      this.separate();
      const hits = [this.strike(a,b), this.strike(b,a)].filter(Boolean);
      const countered = new Set(hits.filter(hit=>hit.kind==="counter").map(hit=>hit.a));
      for (const hit of hits) {
        if (!countered.has(hit.b)) this.apply(hit);
      }
      this.expire(a);
      this.expire(b);
      if (this.mode === "practice") {
        for (const f of this.fighters) {
          f.hp = Math.max(f.hp, 1);
          if (f.hp < 2) f.hp = f.p.hp;
          f.meter = 100;
        }
        return;
      }
      if (a.hp <= 0 || b.hp <= 0 || this.seconds === 0) this.finish();
    }
    capture(f, cmd) {
      if (cmd.action) f.buffer = { action:cmd.action, frames:8 };
    }
    update(f, cmd) {
      this.capture(f,cmd);
      const { p } = f;
      f.stun = Math.max(0, f.stun - 1);
      f.recovery = Math.max(0, f.recovery - 1);
      f.knock *= .81;
      f.x += f.knock * LIMIT.dt;
      f.moving = 0;
      f.guard = false;
      if (!f.attack && !f.stun && !f.dodge) {
        let action = f.buffer?.action;
        if (action && !this.begin(f,action,cmd.axis)) {
          this.emit(action==="special" ? "meter" : "tired", f);
          action = null;
        }
        f.buffer = null;
        if (!action) {
          f.guard = !!cmd.guard && f.stamina > 1;
          const speed = f.guard ? .41 : Math.sign(cmd.axis) === f.face ? 1 : .77;
          f.moving = cmd.axis || 0;
          f.x += f.moving * p.walk * speed * LIMIT.dt;
        }
      }
      if (f.attack) {
        f.attack.age += 1;
        if (f.attack.age <= f.attack.wind) f.x += f.face * f.attack.move.step * LIMIT.dt;
      }
      if (f.dodge > 0) {
        if (f.dodge > 5) f.x += f.dodgeDir * p.dodgeSpeed * LIMIT.dt;
        f.dodge -= 1;
      }
      if (f.buffer && --f.buffer.frames <= 0) f.buffer = null;
      if (!f.attack && !f.dodge && !f.recovery && !f.stun) {
        const recovery = f.guard ? .18 : 1;
        f.stamina = Math.min(p.staminaMax, f.stamina + p.regen * recovery * LIMIT.dt);
      }
    }
    begin(f, action, axis) {
      const key = action === "special" ? f.data.special : action;
      const move = D.moves[key];
      if (action === "special" && f.meter < 100) return false;
      const cost = action === "dodge" ? 15 : move.cost || 0;
      if (f.stamina < cost) return false;
      f.stamina -= cost;
      f.recovery = 22;
      if (action === "dodge") {
        f.dodge = f.p.inv + 9;
        f.dodgeDir = axis || -f.face;
        this.emit("step", f);
      } else {
        if (action === "special") f.meter = 0;
        const wind = action === "special" ? move.wind : Math.round(move.wind * f.p.wind);
        f.attack = { key, move, wind, age:0, spent:false };
        this.emit(action === "special" ? "special" : "swing", f, null, { key });
      }
      return true;
    }
    separate() {
      const [a,b] = this.fighters;
      const spacing = .98 * (a.p.hurt+b.p.hurt) + 12;
      const center = D.clamp((a.x+b.x)/2, LIMIT.left+spacing/2, LIMIT.right-spacing/2);
      if (b.x-a.x < spacing) {
        a.x = center-spacing/2;
        b.x = center+spacing/2;
      } else {
        a.x = D.clamp(a.x,LIMIT.left,LIMIT.right-spacing);
        b.x = D.clamp(b.x,LIMIT.left+spacing,LIMIT.right);
      }
    }
    strike(a,b) {
      const attack = a.attack;
      if (!attack || !attack.move.beats.includes(attack.age-attack.wind)) return null;
      const { move } = attack;
      const distance = Math.abs(a.x-b.x);
      if (distance > move.reach + a.p.reach + b.p.hurt) return { kind:"miss", a, b, move, point:a.x+a.face*(move.reach+a.p.reach) };
      if (b.dodge > 6) return { kind:"evade", a, b, move, point:b.x };
      if (b.attack?.key === "counter" && b.attack.age <= 19 && !b.attack.spent && distance <= D.moves.counter.reach+b.p.reach+a.p.hurt) {
        return { kind:"counter", a:b, b:a, move:D.moves.counter, point:a.x };
      }
      return { kind:b.guard ? "block" : "hit", a,b,move, point:b.x-a.face*b.p.hurt*.54 };
    }
    apply({ kind, a, b, move, point }) {
      if (kind === "miss") {
        this.emit("miss", a,b,{point});
        return;
      }
      if (kind === "evade") {
        b.tally.evade += 1;
        b.meter = Math.min(100,b.meter+13);
        this.emit(kind,b,a,{point});
        return;
      }
      let damage = move.damage * a.p.damage;
      let stun = move.stun;
      if (kind === "block") {
        b.stamina -= (move.damage*1.9+6)*b.p.guardCost*(move.guardScale || 1);
        if (b.stamina < 0) {
          kind = "break";
          b.stamina = 0;
          damage *= .62;
          stun = 37;
        } else {
          damage = Math.min(damage*b.p.chip,Math.max(0,b.hp-.5));
          b.tally.block += 1;
          stun = Math.round(move.stun*.46);
        }
      }
      if (kind === "counter") {
        if (a.attack) a.attack.spent = true;
        if (a.attack) a.attack.age = 23;
      }
      b.hp = Math.max(0,b.hp-damage);
      b.stun = Math.max(b.stun,stun);
      b.recovery = Math.max(b.recovery,21);
      b.attack = null;
      b.knock = a.face*move.push*(kind==="block" ? .57 : 1);
      if (kind !== "block") a.tally.hit += 1;
      a.tally.dealt += damage;
      if (move === D.moves.light || move === D.moves.heavy) a.meter = Math.min(100,a.meter+(kind==="block" ? 7 : 15));
      b.meter = Math.min(100,b.meter+(kind==="block" ? 10 : 11));
      this.freeze = Math.max(this.freeze, move.stop);
      this.emit(kind,a,b,{point,damage,heavy:move.stop>=6});
    }
    expire(f) {
      if (!f.attack) return;
      const { age, wind, move, key, spent } = f.attack;
      const last = move.beats.at(-1) || 0;
      const end = key==="counter" && spent ? 43 : wind+last+move.end;
      if (age >= end) {
        if (key==="counter" && !spent) this.emit("miss", f, null, {point:f.x});
        f.attack = null;
      }
    }
    cpu(f, other) {
      const idle = passive();
      if (this.mode === "practice" && this.dummy !== "active") {
        idle.guard = this.dummy === "guard";
        return idle;
      }
      const easy = this.difficulty === "easy" || this.mode === "practice";
      const distance = f.x-other.x;
      const danger = other.attack && other.attack.age < other.attack.wind+2 && distance < 158;
      let cmd = { ...this.ai.command, action:null };
      if (this.frame < this.ai.reconsider) return cmd;
      this.ai.reconsider = this.frame+(easy ? 13 : 7)+Math.floor(this.random()*8);
      const roll = this.random();
      cmd = passive();
      if (f.stamina < 20 && distance < 170) {
        cmd.axis = 1;
        cmd.guard = roll > .62;
      } else if (danger && !f.attack && roll < (easy ? .29 : .62)) {
        cmd.guard = roll > .2;
        if (!cmd.guard) cmd.action = "dodge";
        if (!easy && f.data.special==="counter" && f.meter===100) cmd.action = "special";
      } else if (!f.attack && !f.dodge && f.meter===100 && distance < (f.data.special==="comet" ? 240 : 121) && f.data.special!=="counter" && roll > .36) {
        cmd.action = "special";
      } else if (distance > 103) {
        cmd.axis = -1;
        if (distance < 133 && roll > .63 && !f.attack) cmd.action = "heavy";
      } else if (!f.attack && !f.stun) {
        if (roll < (easy ? .40 : .19)) {
          cmd.axis = roll < .1 ? 1 : 0;
          cmd.guard = roll > .11;
        } else cmd.action = roll > .75 ? "heavy" : "light";
      }
      this.ai.command = cmd;
      return cmd;
    }
    finish() {
      const [a,b] = this.fighters;
      const diff = a.hp/a.p.hp-b.hp/b.p.hp;
      const winner = Math.abs(diff) < 1e-7 ? null : diff > 0 ? 0 : 1;
      this.result = { winner, reason:Math.min(a.hp,b.hp)<=0 ? "KO" : "TIME UP" };
      this.phase = "over";
      this.emit("over",winner===null ? null : this.fighters[winner]);
    }
    resetPractice() {
      this.fighters = this.fighters.map(f=>boxer(f.data,f.index));
      this.fighters[0].meter = 100;
      this.freeze = 0;
      this.events.length = 0;
      this.ai = { reconsider:0, command:passive() };
    }
  }
  D.Match = Match;
  D.LIMIT = LIMIT;
})(globalThis);