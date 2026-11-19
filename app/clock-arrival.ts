import {clockArrivalDuration,clockArrivalFrame,clockArrivalFraming,openingLens} from './camera.ts';

let started:number|undefined,interrupted:number|undefined,atInterrupt=0;
const releaseDuration=220;
function enabled(){return document.documentElement.dataset.clockArrival==='on';}
export function arrivalProgress(now:number){
  if(!enabled())return 1;
  if(interrupted!==undefined)return Math.min(1,atInterrupt+(1-atInterrupt)*(now-interrupted)/releaseDuration);
  return started===undefined?0:Math.min(1,Math.max(0,(now-started)/clockArrivalDuration));
}
export function beginClockArrival(now:number){if(started===undefined&&enabled())started=now;}
export function finishClockArrival(){if(enabled())document.documentElement.dataset.clockArrival='done';}

// Two camera renders share one film plane. The close print supplies the dial
// detail while the wider print fills the opening edges as the focal length falls.
export function attachClockArrival(poster:HTMLElement){
  if(!enabled())return ()=>{};
  if('deferHarborPoster' in document.documentElement.dataset){
    let detach=()=>{};
    const observer=new MutationObserver(()=>{
      if('deferHarborPoster' in document.documentElement.dataset)return;
      observer.disconnect();detach=attachClockArrival(poster);
    });
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-defer-harbor-poster']});
    return ()=>{observer.disconnect();detach();};
  }
  const wide=poster.querySelector<HTMLElement>('.world-clock-wide'),detail=poster.querySelector<HTMLElement>('.world-clock-detail');
  if(!wide||!detail||typeof wide.animate!=='function'){finishClockArrival();return ()=>{};}
  let active=true,animations:Animation[]=[];
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  function redraw(){
    if(!active||!enabled()||!wide||!detail||(started===undefined&&interrupted===undefined))return;
    const now=performance.now(),t=arrivalProgress(now);
    if(t>=1){finishClockArrival();return;}
    for(const a of animations)a.cancel();
    const {width:w,height:h}=poster.getBoundingClientRect();
    if(!w||!h)return;
    const f=clockArrivalFraming(w,h),portrait=h>w;
    const rw=portrait?390:1440,rh=portrait?844:940,ref=clockArrivalFraming(rw,rh);
    const ratio=openingLens(w,h).focalLength*Math.max(w,h)/(openingLens(rw,rh).focalLength*Math.max(rw,rh));
    const cw=portrait?390:3456,ch=portrait?1050:1080;
    const scaleDetail=Math.min(w,h)/Math.min(cw,ch);
    for(const [layer,lw,lh,s] of [[wide,rw,rh,ratio],[detail,cw,ch,scaleDetail]] as const){
      layer.style.width=lw*s+'px';layer.style.height=lh*s+'px';
      layer.style.left=(w-lw*s)/2+'px';layer.style.top=(h-lh*s)/2+'px';
    }
    const wideFrames:Keyframe[]=[],closeFrames:Keyframe[]=[];
    for(let i=0;i<=48;i++){
      const progress=t+(1-t)*i/48;
      const {gain,shiftX,shiftY}=clockArrivalFrame(f,progress);
      const cx=gain*f.x+shiftX,cy=gain*f.y+shiftY;
      wideFrames.push({transform:`translate(${cx-gain*ref.x*ratio}px,${cy-gain*ref.y*ratio}px) scale(${gain})`});
      closeFrames.push({transform:`translate(${cx}px,${cy}px) scale(${gain/f.gain})`,
        opacity:Math.min(1,Math.max(0,(gain-1)/1.7))});
    }
    const duration=interrupted===undefined?(1-t)*clockArrivalDuration:Math.max(1,releaseDuration-(now-interrupted));
    animations=[wide.animate(wideFrames,{duration,fill:'both'}),detail.animate(closeFrames,{duration,fill:'both'})];
    detail.dataset.blend='';
    void animations[1].finished.then(()=>{
      if(!active)return;
      finishClockArrival();observer?.disconnect();
      for(const a of animations)a.cancel();
    },()=>{});
  }
  function interrupt(){
    if(!enabled()||interrupted!==undefined)return;
    const now=performance.now();atInterrupt=arrivalProgress(now);interrupted=now;redraw();
  }
  function preference(){
    let paused=false;try{paused=localStorage.getItem('tom-city-motion-paused')==='true';}catch{}
    if(paused||motion.matches)finishClockArrival();
  }
  preference();
  const surface=poster.closest('.world')??poster;
  for(const event of ['pointerdown','wheel','keydown'])surface.addEventListener(event,interrupt,{capture:true,passive:true});
  window.addEventListener('tom-city-motion-change',preference);window.addEventListener('storage',preference);
  motion.addEventListener('change',preference);
  let observer:ResizeObserver|undefined;
  const image=new Image();
  const source=getComputedStyle(detail).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
  if(source){
    image.fetchPriority='high';image.src=source;
    void image.decode().then(()=>{
      if(!active||!enabled())return;
      beginClockArrival(performance.now());redraw();
      observer=new ResizeObserver(redraw);observer.observe(poster);
    },()=>{if(active)finishClockArrival();});
  }else finishClockArrival();
  return ()=>{
    active=false;for(const a of animations)a.cancel();observer?.disconnect();
    for(const event of ['pointerdown','wheel','keydown'])surface.removeEventListener(event,interrupt,true);
    window.removeEventListener('tom-city-motion-change',preference);window.removeEventListener('storage',preference);
    motion.removeEventListener('change',preference);
  };
}
