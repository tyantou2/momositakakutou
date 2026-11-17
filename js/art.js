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
  function portrait(canvas,f) {
    const c=canvas.getContext("2d");
    c.clearRect(0,0,canvas.width,canvas.height);
    const p=D.profile(f);
    const h=canvas.height*.78*p.visual*(f.id==="momonosuke"?.94:1);
    c.save();
    ellipse(c,canvas.width*.5,canvas.height*.93,canvas.width*.25,canvas.height*.031,"#100d1d64",null);
    draw(c,f,canvas.width*.49,canvas.height*.92,h,1);
    c.restore();
    const img=images[f.id];
    if (img && !img.complete) img.addEventListener("load",()=>portrait(canvas,f),{once:true});
  }
  function fighter(c,f,t,y) {
    const atk=f.attack;
    const bob=f.moving ? Math.abs(Math.sin(t*.24+f.index))*6 : Math.sin(t*.075+f.index)*2;
    const active=atk && (atk.move.beats.some(beat=>Math.abs(atk.age-atk.wind-beat)<=4) || atk.spent && atk.age<31);
    const charge=atk && !active && atk.age<atk.wind;
    const lean=active?.14:charge?-.087:f.dodge?-.16:f.stun?-.105:0;
    const extend=active ? Math.max(18,atk.move.reach-37+f.p.reach) : 0;
    const h=247*f.p.visual*(f.data.id==="momonosuke" ? .88 : 1);
    c.save();
    const shadow=c.createRadialGradient(f.x,y,1,f.x,y,82);
    shadow.addColorStop(0,"#120e1edf"); shadow.addColorStop(1,"#120e1e00");
    ellipse(c,f.x,y+4,94,18,shadow,null);
    if (f.dodge>6) {
      c.globalAlpha=.22;
      draw(c,f.data,f.x-f.dodgeDir*29,y-2,h,f.face,{tilt:lean});
      c.globalAlpha=.73;
    }
    if (charge && atk.key!=="counter") {
      c.strokeStyle=atk.move.color||"#ffc28e"; c.lineWidth=3; c.globalAlpha=.6;
      c.beginPath(); c.arc(f.x+f.face*21,y-h*.48,h*.38,-.6,2.3); c.stroke(); c.globalAlpha=1;
    }
    if (f.hp<=0) c.globalAlpha=.66;
    draw(c,f.data,f.x,y-bob-(f.dodge?7:0),h,f.face,{ tilt:f.hp<=0?-.42:lean, squash:f.guard?.955:1, extend, guard:f.guard, walk:f.moving ? Math.sin(t*.29)*9 : 0 });
    if (f.guard || atk?.key==="counter" && atk.age<=19) {
      c.strokeStyle=f.guard?"#a3dcffae":"#f3beffaa";c.lineWidth=3;
      c.beginPath(); c.ellipse(f.x+f.face*30,y-h*.49,65,h*.44,0,-1.32,1.05,f.face===-1); c.stroke();
    }
    if (active) {
      c.globalAlpha=.74; c.strokeStyle=atk.move.color||"#fff0c8"; c.lineWidth=atk.move.stop>=6?6:3;
      c.beginPath(); c.ellipse(f.x+f.face*59,y-h*.50,41+extend*.25,19,0,.2,2.5,f.face<0); c.stroke();
    }
    c.restore();
  }
  function effects(c,fx,y) {
    const colors={ hit:"#ffe6ae",block:"#9ce1ff",break:"#ff896e",evade:"#80ead7",counter:"#e6acff",miss:"#e9d2ee",special:"#ffd7f3" };
    const labels={hit:"HIT",block:"GUARD",break:"ガード崩し",evade:"DODGE",counter:"COUNTER",miss:"空振り",step:"",special:"",meter:"ゲージ不足",tired:"スタミナ不足"};
    for (const e of fx) {
      const age=e.age/36;
      const color=colors[e.type]||"#f4cfeb";
      const x=e.point ?? e.a.x;
      const height=y-126;
      c.save();
      c.globalAlpha=Math.min(1,(1-age)*1.7);
      const impact=["hit","block","break","counter"].includes(e.type);
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
  D.Art={draw,portrait,fighter,effects};
})(Dojo);