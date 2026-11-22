(function(D){
  'use strict';
  function ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();}
  function world(c,m,ground){
    const t=m.frame;
    for(const w of m.world.walls){
      const rise=Math.min(1,w.age/10),h=w.height*rise,left=w.x-w.width/2;
      c.save();c.shadowColor='#1a2e28';c.shadowBlur=12;c.fillStyle='#b9b29c';c.fillRect(left,ground-h,w.width,h);c.shadowBlur=0;
      for(let r=0;r<5;r++)for(let col=0;col<2;col++){const y=ground-h+r*h/5;c.fillStyle=(r+col)%2?'#d4cbb4':'#aaa792';c.fillRect(left+col*18+1,y+1,16,h/5-2);}
      c.fillStyle='#efe1c2';c.fillRect(left-7,ground-h-6,w.width+14,9);c.fillStyle='#718b7b';c.fillRect(left+5,ground-h+13,w.width-10,6);
      c.strokeStyle='#7a725f';c.lineWidth=2;c.beginPath();c.arc(w.x,ground-h+42,11,Math.PI,0);c.lineTo(w.x+11,ground-h+70);c.lineTo(w.x-11,ground-h+70);c.closePath();c.stroke();
      c.fillStyle='#43675a';c.fillRect(left,ground-h-13,w.width,3);c.fillStyle='#b4f6d5';c.fillRect(left,ground-h-13,w.width*w.hp/28,3);
      for(let i=0;i<4;i++){const y=ground-h-12-((t*1.1+i*23)%57);ellipse(c,w.x+Math.sin(t*.07+i)*14,y,13+i*2,8+i*2,'#e8fff529');}c.restore();
    }
    for(const g of m.world.geysers){
      c.save();const warning=g.age<27,pulse=warning?g.age/27:1;
      ellipse(c,g.x,ground+1,56,10,warning?'#ffc76c44':'#c9ffff88');c.strokeStyle=warning?'#ffdb8b':'#b4ffff';c.lineWidth=2;c.beginPath();c.ellipse(g.x,ground,28+pulse*32,6+pulse*6,0,0,Math.PI*2);c.stroke();
      if(warning){for(let i=0;i<5;i++)ellipse(c,g.x-32+i*16,ground-5-Math.sin(g.age*.22+i)*6,3,3,'#e9fff599');}
      else{const life=Math.max(0,1-(g.age-27)/22),height=230*Math.min(1,(g.age-26)/4)*life;c.globalAlpha=life;
        for(let i=0;i<5;i++){c.beginPath();c.moveTo(g.x-30+i*15,ground);c.bezierCurveTo(g.x-45+i*18,ground-height*.6,g.x+Math.sin(t*.3+i)*36,ground-height,g.x+Math.sin(i*2)*45,ground-height);c.strokeStyle=i%2?'#efffff':'#89e2e8';c.lineWidth=12-i;c.stroke();}
        for(let i=0;i<12;i++)ellipse(c,g.x+Math.sin(t*.17+i*2.4)*(25+i*3),ground-((t*7+i*19)%Math.max(25,height)),3+i%3,5,'#ebffffbb');
      }c.restore();
    }
    for(const p of m.world.projectiles){c.save();c.strokeStyle='#ffeec1';c.lineWidth=4;c.beginPath();c.moveTo(p.x-p.face*23,ground-p.height);c.lineTo(p.x,ground-p.height);c.stroke();ellipse(c,p.x,ground-p.height,5,3,'#fff9df');c.restore();}
  }
  function pose(c,f,ground){
    if(f.attack?.key!=='shot')return;const s=D.Headman.look(f).sprite,h=f.p.bodyHeight,x=f.x+f.face*h*s.crop[2]/s.crop[3]*(s.glove[0]-s.align),y=ground-f.lift-h*(1-s.glove[1]);
    c.save();c.translate(x,y);c.scale(f.face,1);c.rotate(Math.atan(-(f.attack.aimSlope||0)));c.fillStyle='#23252f';c.fillRect(-8,-7,35,8);c.fillRect(-7,-2,9,15);c.strokeStyle='#c5cad6';c.lineWidth=2;c.strokeRect(-8,-7,35,8);
    if(Math.abs(f.attack.age-f.attack.wind)<3){c.fillStyle='#fff1b2';c.beginPath();c.moveTo(24,-5);c.lineTo(44,-18);c.lineTo(36,-4);c.lineTo(48,4);c.lineTo(24,1);c.fill();}c.restore();
  }
  function effects(c,fx,ground){
    for(const e of fx){if(e.age>30)continue;const fade=1-e.age/30,x=e.point??e.a?.x;if(x===undefined)continue;c.save();c.globalAlpha=fade;
      if(['wallBreak','wallFade'].includes(e.type)){for(let i=0;i<9;i++){c.fillStyle=i%2?'#d8cbae':'#979b87';c.fillRect(x+Math.sin(i*8)*e.age*2-4,ground-50+Math.cos(i)*e.age*2+e.age*e.age*.05,9,7);}}
      if(e.type==='transform'||e.type==='transformEnd'){const h=e.a.p.bodyHeight;for(let i=0;i<8;i++)ellipse(c,x+Math.sin(i*2.4+e.age*.08)*50,ground-h*.45-e.age*2-i*10,26,18,e.form==='thermae'?'#d9fff155':'#a6bbff44');}
      if(e.type==='skillImpact'){c.strokeStyle=e.blocked?'#fff2b3':e.key==='geyser'?'#caffff':'#ffe5ac';c.lineWidth=3;c.beginPath();c.arc(x,ground-(e.lift||0)-80,12+e.age*2,0,Math.PI*2);c.stroke();}
      c.restore();
    }
  }
  function transform(c,shot,animate){
    const age=shot.age,progress=Math.min(1,age/66),reveal=age>=32,form=shot.form||shot.a.shift?.pending||'thermae',spec=D.Headman.forms[form];
    c.save();const bg=c.createLinearGradient(0,0,1280,650);bg.addColorStop(0,'#152d2f');bg.addColorStop(.49,'#181b2e');bg.addColorStop(1,'#1d2448');c.fillStyle=bg;c.fillRect(0,0,1280,650);
    for(let i=0;i<18;i++){c.strokeStyle=i%2?'#b9d4ff20':'#c7f4d320';c.lineWidth=2;c.beginPath();c.moveTo(0,i*55-100+progress*95);c.lineTo(1280,i*55-280+progress*95);c.stroke();}
    if(!reveal){c.globalAlpha=.23;D.Art.draw(c,D.headmanForms.thermae,430-progress*50,620,510,1);D.Art.draw(c,D.headmanForms.nozaki,850+progress*50,620,510,-1);c.globalAlpha=1;}
    else{const x=shot.a.face>0?360:920;c.globalAlpha=Math.min(1,(age-31)/8);D.Art.draw(c,D.headmanForms[form],x,625,540,shot.a.face);c.globalAlpha=1;
      for(let i=0;i<12;i++)ellipse(c,x+Math.sin(i*2+age*.07)*140,610-i*34,45,20,form==='thermae'?'#caffef35':'#a7baff19');
      if(form==='thermae'){for(let i=0;i<5;i++){c.fillStyle='#c7c2a588';c.fillRect(x-130+i*57,596-i%2*15,49,20);}}
      else{c.strokeStyle='#b4ccff77';c.lineWidth=2;for(let i=0;i<4;i++)c.strokeRect(x-140+i*17,85+i*19,200,95);}
    }
    const textX=reveal?(shot.a.face>0?880:400):640;c.textAlign='center';c.fillStyle='#ffe9bd';c.font='700 19px system-ui';c.fillText('村長  /  SUPER ART',textX,220);c.fillStyle='#fff4e9';c.font='900 62px system-ui';c.fillText('二面変身',textX,300);c.fillStyle=spec.color;c.font='800 31px system-ui';c.fillText(reveal?spec.name:'二つの戦術が交差する',textX,365);c.fillStyle='#d8d4e5';c.font='17px system-ui';c.fillText(reveal?'12秒間  再使用1秒の専用技が解放':'50% / 50%',textX,408);
    if(animate&&age>58){c.globalAlpha=(age-58)/8*.65;c.fillStyle=spec.color;c.fillRect(0,0,1280,650);}c.restore();
  }
  D.HeadmanArt={world,pose,effects,transform};
})(Dojo);
