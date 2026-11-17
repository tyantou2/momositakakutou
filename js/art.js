(function (D) {
  "use strict";
  const images = {};
  for (const f of D.cast) {
    if (!f.image) continue;
    const img = new Image();
    img.src = f.image;
    images[f.id] = img;
  }
  const outline = "#281d38";
  function ellipse(c,x,y,rx,ry,fill,stroke=outline) {
    c.beginPath();
    c.ellipse(x,y,rx,ry,0,0,Math.PI*2);
    c.fillStyle=fill;
    c.fill();
    if (stroke) { c.strokeStyle=stroke; c.lineWidth=2; c.stroke(); }
  }
  function shape(c,fill,draw,stroke=outline) {
    c.beginPath(); draw(c); c.closePath(); c.fillStyle=fill; c.fill();
    if (stroke) { c.strokeStyle=stroke; c.lineWidth=2; c.stroke(); }
  }
  function paint(c, x,y, radius, bright,dark) {
    const g=c.createRadialGradient(x-radius*.28,y-radius*.33,1,x,y,radius);
    g.addColorStop(0,bright); g.addColorStop(1,dark);
    return g;
  }
  function blend(hex,target,amount) {
    const v=parseInt(hex.slice(1),16);
    const t=parseInt(target.slice(1),16);
    const channel=i=>Math.round(((v>>i)&255)*(1-amount)+((t>>i)&255)*amount);
    return "rgb("+[16,8,0].map(channel).join(",")+")";
  }
  function line(c,points,color,width) {
    c.beginPath(); c.moveTo(...points[0]);
    for (const point of points.slice(1)) c.lineTo(...point);
    c.strokeStyle=color; c.lineWidth=width; c.lineJoin="round"; c.lineCap="round"; c.stroke();
  }
  function glove(c,x,y,r,color) {
    ellipse(c,x-5,y+8,r*.67,r*.48,blend(color,"#451c39",.38));
    ellipse(c,x,y,r,r*.82,paint(c,x,y,r,blend(color,"#fff4e4",.40),blend(color,"#2e1534",.36)));
    ellipse(c,x-r*.28,y-r*.34,r*.30,r*.10,"#ffffff46",null);
    c.beginPath(); c.moveTo(x-r*.34,y+r*.67); c.quadraticCurveTo(x-r*.12,y+r*.19,x+r*.36,y+r*.26); c.lineWidth=1.6; c.strokeStyle="#4b264b82"; c.stroke();
  }
  function custom(c,f,walk,extension,guard) {
    const a=f.look;
    const skin=D.colors.skin[a.skin], hair=D.colors.hairColor[a.hairColor], cloth=D.colors.cloth[a.cloth], g=D.colors.glove[a.glove];
    const hg=paint(c,-17,-156,53,blend(hair,"#ffd7ec",.26),blend(hair,"#191225",.37));
    const cg=paint(c,-1,-57,48,blend(cloth,"#f9e3fc",.27),blend(cloth,"#301b42",.46));
    const sg=paint(c,-1,-130,53,blend(skin,"#fff8dc",.37),blend(skin,"#af496c",.37));
    if (a.hair>=2) {
      ellipse(c,-44,-138,17,a.hair===2?31:42,hg);
      if (a.hair===2) ellipse(c,38,-143,15,26,hg);
      ellipse(c,-38,-160,6,7,cloth);
    }
    for (const side of [-1,1]) {
      const x=side*18, stride=walk*side;
      line(c,[[x*.72,-44],[x+stride*.6,-27],[x+stride,-9]],outline,25);
      line(c,[[x*.72,-44],[x+stride*.6,-27],[x+stride,-9]],"#403958",21);
      ellipse(c,x+stride+5,-6-Math.max(0,stride*.18),17,8,"#2d243f");
      line(c,[[x+stride-5,-3],[x+stride+13,-3]],"#e0b3b3",2);
    }
    line(c,[[-20,-73],[-32,-57],[-26,-81]],outline,22);
    line(c,[[-20,-73],[-32,-57],[-26,-81]],cloth,18);
    glove(c,-25,-83-(guard?8:0),12,g);
    shape(c,cg,p=>{p.moveTo(-21,-85);p.quadraticCurveTo(2,-105,27,-84);p.quadraticCurveTo(42,-64,30,-37);p.quadraticCurveTo(3,-26,-28,-39);p.quadraticCurveTo(-37,-67,-21,-85);});
    ellipse(c,7,-91,15,14,skin);
    if (a.outfit===0) {
      line(c,[[-18,-81],[9,-56],[25,-82]],"#ffe2d2",5);
      line(c,[[-27,-47],[29,-44]],"#26213b",8);
      line(c,[[4,-47],[13,-43],[19,-33]],"#e6b6b9",3);
    } else if (a.outfit===1) {
      line(c,[[11,-81],[12,-44]],"#e7bccc",4);
      line(c,[[-23,-52],[-8,-51]],"#f7a4a9",3);
    } else {
      line(c,[[-17,-81],[-20,-67]],"#ffdbca",3);
      line(c,[[25,-82],[28,-68]],"#ffdbca",3);
      ellipse(c,2,-60,8,8,"#ffdbca",null);
    }
    ellipse(c,-36,-128,9,11,sg);
    shape(c,sg,p=>{p.moveTo(-36,-149);p.bezierCurveTo(-26,-178,35,-170,44,-146);p.bezierCurveTo(53,-108,28,-94,8,-97);p.bezierCurveTo(-15,-95,-42,-109,-36,-149);});
    shape(c,hg,p=>{
      p.moveTo(-39,-123);p.bezierCurveTo(-55,-147,-40,-177,-12,-181);p.bezierCurveTo(14,-191,41,-171,44,-151);
      if(a.hair===0){p.quadraticCurveTo(23,-146,5,-165);p.quadraticCurveTo(2,-145,-32,-139);}
      else if(a.hair===1){p.lineTo(30,-151);p.lineTo(24,-159);p.lineTo(11,-147);p.lineTo(3,-159);p.lineTo(-28,-143);}
      else{p.quadraticCurveTo(18,-145,11,-168);p.quadraticCurveTo(4,-144,-31,-138);}
    });
    line(c,[[-31,-159],[-20,-169],[-5,-174]],"#ffffff45",3);
    for (const x of [5,32]) {
      const y=x===5?-129:-130;
      const eyebrow=a.eyes===0 ? 4 : a.eyes===1 ? -1 : 2;
      line(c,[[x-7,y-12-eyebrow],[x+4,y-11]],blend(hair,"#1c1530",.44),3);
      ellipse(c,x,y,7.3,8.5,"#fff6e8");
      ellipse(c,x+2,y,4.6,6.8,"#382838",null);
      ellipse(c,x+3,y-3,1.6,2,"#ffffff",null);
    }
    ellipse(c,-13,-116,7.5,3.5,"#e8677299",null);
    ellipse(c,39,-118,5.5,3,"#e8677299",null);
    c.beginPath();c.moveTo(14,-112);c.quadraticCurveTo(22,a.eyes===2?-101:-107,29,-114);c.strokeStyle="#833c4e";c.lineWidth=2;c.stroke();
    const fore=[36+extension*.62,-78-extension*.16-(guard?14:0)];
    const shoulder=[16,-69];
    line(c,[shoulder,[25+extension*.22,-54],fore],outline,24);
    line(c,[shoulder,[25+extension*.22,-54],fore],a.outfit===2?skin:cloth,20);
    glove(c,fore[0],fore[1],15,g);
  }
  function mascot(c,f,height,extension,guard) {
    const img = images[f.id];
    if (!img?.complete || !img.naturalWidth) return;
    const { crop, align, glove:hand, shoulder } = f.sprite;
    const width=height*crop[2]/crop[3], left=-width*align;
    c.drawImage(img,...crop,left,-height,width,height);
    if (extension<=.5 && !guard) return;
    const end=[left+width*hand[0]+extension,-height*(1-hand[1])-extension*.18-(guard?12:0)];
    const start=[left+width*shoulder[0],-height*(1-shoulder[1])];
    const mitt=f.id==="momokage"?"#3e4876":"#eb7d9a";
    const radius=height*.063;
    line(c,[start,end],outline,radius*1.48);
    line(c,[start,end],f.arm,radius*1.29);
    glove(c,end[0],end[1],radius,mitt);
  }
  function draw(c,f,x,y,h,face,pose={}) {
    c.save();
    c.translate(x,y);
    c.scale(face,1);
    c.rotate(pose.tilt||0);
    const height=h*(pose.squash||1);
    if (f.image) mascot(c,f,height,pose.extend||0,pose.guard);
    else {
      c.scale(height/181,height/181);
      custom(c,f,pose.walk||0,(pose.extend||0)*181/height,pose.guard);
    }
    c.restore();
  }
  function portrait(canvas,f,icon=false) {
    const c=canvas.getContext("2d");
    c.clearRect(0,0,canvas.width,canvas.height);
    const p=D.profile(f);
    const h=canvas.height*(icon ? .77 : .69*p.visual);
    c.save();
    ellipse(c,canvas.width*.5,canvas.height*.93,canvas.width*.25,canvas.height*.031,"#100d1d64",null);
    draw(c,f,canvas.width*.49,canvas.height*.92,h,1);
    c.restore();
    const img=images[f.id];
    if (img && !img.complete) img.addEventListener("load",()=>portrait(canvas,f,icon),{once:true});
  }
  function stage(c,y) {
    for (const x of [D.LIMIT.left,D.LIMIT.right]) {
      c.save();
      c.translate(x,y+13);
      c.shadowColor="#ffafcc"; c.shadowBlur=8;
      line(c,[[-18,4],[14,-3]],"#ffd1b1a8",2);
      line(c,[[-10,8],[22,1]],"#f3a8ca65",1);
      c.restore();
    }
  }
  function fighter(c,f,t,ground) {
    const atk=f.attack;
    const y=ground-f.lift;
    const bob=f.lift ? 0 : f.moving ? Math.abs(Math.sin(t*.24+f.index))*6 : Math.sin(t*.075+f.index)*2;
    const active=atk && (atk.move.beats.some(beat=>Math.abs(atk.age-atk.wind-beat)<=4) || atk.spent && atk.age<32);
    const charge=atk && !active && atk.age<atk.wind;
    const evade=f.dodge>0;
    const lean=active?.14:charge?-.11:evade?-.20:f.exhaustion?.22:f.stun?-.13:0;
    const extend=active?Math.max(24,atk.move.reach*.54+f.p.reach):0;
    const h=f.p.bodyHeight;
    c.save();
    const shadow=c.createRadialGradient(f.x,ground,1,f.x,ground,82);
    shadow.addColorStop(0,"#120e1edf");shadow.addColorStop(1,"#120e1e00");
    c.globalAlpha=1-f.lift/250;
    ellipse(c,f.x,ground+4,Math.max(37,h*.38),Math.max(9,h*.065),shadow,null);
    c.globalAlpha=1;
    if (evade && f.dodgeType==="back") {
      c.globalAlpha=.20;
      draw(c,f.data,f.x+f.face*30,y,h,f.face,{tilt:lean});
      c.globalAlpha=1;
    }
    if (evade) c.globalAlpha=.70;
    if (charge && atk.key!=="counter") {
      c.strokeStyle=atk.move.color || "#ffd19c";c.lineWidth=atk.key==="light"?2:5;
      c.globalAlpha=.34+.46*(atk.age/atk.wind);
      c.beginPath();c.arc(f.x+f.face*21,y-h*.48,Math.max(30,h*.41),-.6,2.3);c.stroke();c.globalAlpha=1;
      if(atk.key==="heavy") {
        ellipse(c,f.x+f.face*(h*.29),y-h*.39,13,13,"#ffd0868c",null);
      }
    }
    if(f.hp<=0) c.globalAlpha=.64;
    const squash=f.exhaustion?.88:f.guard?.955:evade && f.dodgeType==="spot"?.91:1;
    draw(c,f.data,f.x,y-bob,h,f.face,{tilt:f.hp<=0?-.42:lean,squash,extend,guard:f.guard,walk:f.moving?Math.sin(t*.29)*9:0});
    if (f.guard || atk?.key==="counter" && atk.age<=20) {
      c.strokeStyle=f.guard?"#a3dcffcf":"#f3beffcb"; c.lineWidth=3;
      c.beginPath(); c.ellipse(f.x+f.face*25,y-h*.50,Math.max(43,h*.25),h*.44,0,-1.32,1.05,f.face===-1); c.stroke();
    }
    if (active) {
      c.globalAlpha=.75;c.strokeStyle=atk.move.color||"#fff0c8";c.lineWidth=atk.move.stop>=6?6:3;
      c.beginPath();c.ellipse(f.x+f.face*(36+h*.14),y-h*.45,41+extend*.42,16,0,.2,2.5,f.face<0);c.stroke();
      c.globalAlpha=1;
    }
    if (f.exhaustion) {
      const dx=Math.cos(t*.09)*9;
      ellipse(c,f.x-13+dx,y-h*.91,3.4,3.4,"#ffd68d",null);
      ellipse(c,f.x+8-dx,y-h*.97,4.6,4.6,"#ffae8a",null);
    }
    c.restore();
  }
  const accents = {
    rush:["#40122f","#ff90bf"], crush:["#431d17","#ffd297"],
    counter:["#2c164d","#d6b7ff"], comet:["#0e324c","#9deaff"]
  };
  function cinematic(c,shot,animate) {
    const {a,key,age}=shot;
    const f=a.data;
    const move=D.moves[key];
    const [dark,bright]=accents[key];
    const direction=a.face;
    const p=age/D.RULES.cutIn;
    const enter=Math.min(1,p*8);
    const exit=Math.min(1,(1-p)*9);
    const travel=animate?(1-enter)**2*205:0;
    const left=direction>0;
    const fighterX=(left?370:910)-direction*travel;
    const labelX=left?666:614;
    c.save();
    c.globalAlpha=Math.min(1,.62+enter*.38)*exit;
    const bg=c.createLinearGradient(0,0,1280,650);
    bg.addColorStop(0,dark);bg.addColorStop(.56,"#21132f");bg.addColorStop(1,"#0b0b1d");
    c.fillStyle=bg;c.fillRect(0,0,1280,650);
    c.save();c.translate(640,325);c.scale(direction,1);
    c.lineCap="butt";
    for(let i=0;i<12;i++){
      const span=animate?(p*(i%3+1)*97):0;
      c.globalAlpha=exit*(.065+i*.011);
      if(key==="crush" || key==="counter"){
        c.beginPath();c.ellipse(-216,16,86+i*36+span*.4,115+i*24,0,0,2*Math.PI);c.strokeStyle=bright;c.lineWidth=i%3===0?4:1;c.stroke();
      } else {
        const y=(i-6)*53;
        line(c,[[-700+span,y],[520+span,y-240]],bright,i%3===0?5:1.5);
      }
    }
    c.restore();
    c.save();
    c.globalAlpha=exit*.94;c.translate(fighterX+(animate?Math.sin(p*4)*11*direction:0),548);
    c.shadowColor=bright;c.shadowBlur=animate?27:14;
    draw(c,f,0,0,key==="crush"?394:371,direction,{tilt:direction>0?.065:.035,extend:key==="counter"?0:27,guard:key==="counter"});
    c.restore();
    c.globalAlpha=exit*enter;
    c.strokeStyle=bright;c.lineWidth=2;
    c.beginPath();c.moveTo(left?610:55,418);c.lineTo(left?1225:664,418);c.stroke();
    c.fillStyle=bright;c.textAlign=left?"left":"right";
    c.font="900 25px 'Yu Gothic UI',sans-serif";c.fillText("必殺技　/　"+move.type,labelX,274);
    c.fillStyle="#fff3f1";c.font="900 65px 'Yu Gothic UI',sans-serif";
    c.shadowColor=dark;c.shadowBlur=13;c.fillText(move.label,labelX,362,565);
    c.fillStyle="#ead3ed";c.shadowBlur=0;c.font="800 25px 'Yu Gothic UI',sans-serif";c.fillText(f.name,labelX,399,510);
    c.restore();
  }
  function effects(c,fx,y) {
    const colors={ hit:"#ffe6ae",block:"#9ce1ff",break:"#ff896e",evade:"#80ead7",perfect:"#ffe393",counter:"#e6acff",miss:"#e9d2ee",special:"#ffd7f3",tired:"#ffad88",spent:"#eed0e3" };
    const labels={hit:"HIT",block:"GUARD",break:"ガード崩し",evade:"DODGE",perfect:"ジャスト回避",counter:"COUNTER",miss:"空振り",step:"",special:"",meter:"ゲージ不足",tired:"スタミナ切れ",spent:"使用上限"};
    for (const e of fx) {
      const age=e.age/36;
      const color=colors[e.type]||"#f4cfeb";
      const x=e.point ?? e.a.x;
      const height=y-(e.lift || 0)-Math.min(126,(e.b || e.a).p.bodyHeight*.53);
      c.save();
      c.globalAlpha=Math.min(1,(1-age)*1.7);
      const impact=["hit","block","break","counter","perfect"].includes(e.type);
      if (impact && age<.61) {
        c.translate(x,height);
        for(let i=0;i<9;i++) {
          const angle=i*Math.PI*2/9+.2;
          const start=12+age*65, end=start+9+(1-age)*(e.heavy?29:18);
          line(c,[[Math.cos(angle)*start,Math.sin(angle)*start],[Math.cos(angle)*end,Math.sin(angle)*end]],color, e.heavy?4:2.5);
        }
        ellipse(c,0,0,16*(1-age),15*(1-age),color,null);
        c.translate(-x,-height);
      }
      const label=e.type==="special" ? D.moves[e.key].label : labels[e.type];
      if (label) {
        c.font="900 "+(e.heavy?32:24)+"px 'Yu Gothic UI', sans-serif";
        c.textAlign="center";c.lineWidth=6;c.strokeStyle="#23132d";c.fillStyle=color;
        const textX=D.clamp(x,115,1165), textY=height-35-age*44;
        c.strokeText(label,textX,textY);c.fillText(label,textX,textY);
      }
      c.restore();
    }
  }
  D.Art={draw,portrait,stage,fighter,cinematic,effects};
})(Dojo);
