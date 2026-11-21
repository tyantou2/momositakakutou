(function(D) {
  "use strict";
  const heldActions=new Set(["left","right","guard"]),actions=new Set(["left","right","jump","guard","light","heavy","back","spot","special"]);
  class TouchState {
    constructor(){this.pointers=new Map();this.edges=[];}
    down(id,action,time=performance.now()){
      if(!actions.has(action)||this.pointers.has(id))return false;
      this.pointers.set(id,action);
      if(!heldActions.has(action)){this.edges.push({action,time});if(this.edges.length>8)this.edges.shift();}
      return true;
    }
    up(id){this.pointers.delete(id);}
    active(action){return [...this.pointers.values()].includes(action);}
    sample(time=performance.now(),consume=true){
      this.edges=this.edges.filter(e=>time-e.time<=160);
      return {axis:Number(this.active("right"))-Number(this.active("left")),guard:this.active("guard"),action:consume?this.edges.shift()?.action:null};
    }
    clearEdges(){this.edges=[];}
    clear(){this.pointers.clear();this.edges=[];}
  }
  D.TouchState=TouchState;
  if(typeof document==="undefined")return;
  const state=new TouchState(),pads=document.getElementById("touch-controls"),buttons=[...pads.querySelectorAll("[data-action]")];
  let callbacks={},setting="auto",shown=false;
  const supported=()=>matchMedia("(pointer:coarse)").matches||navigator.maxTouchPoints>0;
  const enabled=()=>setting==="on" || setting==="auto"&&supported();
  function paint(){for(const button of buttons){const active=state.active(button.dataset.action);button.classList.toggle("pressed",active);button.setAttribute("aria-pressed",String(active));}}
  function clear(){state.clear();paint();}
  for(const button of buttons){
    button.addEventListener("pointerdown",e=>{
      e.preventDefault();callbacks.gesture?.();
      if(!shown||!callbacks.canUse?.()||callbacks.locked?.())return;
      if(state.down(e.pointerId,button.dataset.action)){button.setPointerCapture(e.pointerId);paint();}
    });
    for(const event of ["pointerup","pointercancel","lostpointercapture"])button.addEventListener(event,e=>{e.preventDefault();state.up(e.pointerId);paint();});
    button.addEventListener("pointermove",e=>{
      if(!state.pointers.has(e.pointerId))return;
      const r=button.getBoundingClientRect();
      if(e.clientX<Math.max(0,r.left-20)||e.clientX>Math.min(innerWidth,r.right+20)||e.clientY<Math.max(0,r.top-20)||e.clientY>Math.min(innerHeight,r.bottom+20)){state.up(e.pointerId);paint();}
    });
    button.addEventListener("contextmenu",e=>e.preventDefault());
  }
  for(const name of ["blur","pagehide","orientationchange"])window.addEventListener(name,clear);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)clear();});
  window.addEventListener("resize",clear);
  function configure(options){
    setting=options.touchMode||"auto";
    document.documentElement.style.setProperty("--touch-scale",String((options.touchSize||100)/100));
    document.documentElement.style.setProperty("--touch-opacity",String((options.touchOpacity||90)/100));
  }
  function show(battle,mode){shown=battle&&enabled()&&mode!=="local";pads.hidden=!shown;document.body.classList.toggle("touch-play",shown);if(!shown)clear();}
  D.Touch={setup:c=>callbacks=c,configure,show,enabled,supported,clear,state,
    sample:(consume=true)=>{if(callbacks.locked?.())state.clearEdges();return state.sample(performance.now(),consume);},
    update:specialReady=>{pads.querySelector('[data-action="special"]').classList.toggle("ready",specialReady);}
  };
})(globalThis.Dojo);
