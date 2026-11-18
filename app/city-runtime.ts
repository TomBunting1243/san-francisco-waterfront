/** Device-local motion preference shared by every city view. */
export const motionKey='tom-city-motion-paused';
export const motionEvent='tom-city-motion-change';
let sessionPaused:boolean|undefined;
export function readMotionPreference(){
  try{const stored=localStorage.getItem(motionKey);if(stored!==null)return stored==='true';}catch{/* Use the session override below. */}
  return sessionPaused??(typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
export function writeMotionPreference(paused:boolean){sessionPaused=paused;try{localStorage.setItem(motionKey,String(paused));}catch{/* Storage can be unavailable in private contexts. */}window.dispatchEvent(new Event(motionEvent));}
export const minZoom=.75, maxZoom=20;
export const clampZoom=(zoom:number)=>Math.max(minZoom,Math.min(maxZoom,zoom));
/** A slow dwell activates edge orbit; controls and the title are outside its vertical band. */
export function edgeOrbit(x:number,y:number){if(y<.22||y>.78)return 0;return x<.035?x/.035-1:x>.965?(x-.965)/.035:0;}
export function createQualityMonitor(initial=2){
  let level=initial,total=0,frames=0,cooldown=0;
  return {sample(ms:number,now:number,idle=false){
    if(ms<1||ms>1000)return level;
    // Subtract the intentional idle frame interval before assessing missed time.
    total+=Math.min(180,idle?Math.max(0,ms-1000/30)+1000/60:ms);
    frames++;
    const average=total/frames;
    if(frames>=120||(frames>=24&&average>55)){
      if(now>cooldown){
        const next=average>27?Math.max(0,level-1):average<18&&!idle?Math.min(initial,level+1):level;
        if(next!==level){level=next;cooldown=now+12000;}
      }
      total=0;frames=0;
    }
    return level;
  }};
}
/** Cumulative walk distance with a short, smooth pause, avoiding jumps at restarts. */
export function walkingTime(t:number,i:number){const period=24+i%4*3,rest=3+i%3,phase=i*5.17;const travel=(v:number)=>{const cycle=Math.floor(v/period),local=v-cycle*period;return cycle*(period-rest)+Math.min(local,period-rest);};return travel(t+phase)-travel(phase);}

/** Bound total samples on large displays while keeping ordinary Retina viewports native. */
export function drawingPixelRatio(width:number,height:number,dpr:number,economy:boolean,vignette=false,degradation=0) {
  const budget=economy?1_600_000:vignette?2_500_000:8_500_000;
  const scale=degradation===0?1:degradation===1?.80:.65;
  return Math.min(dpr,Math.max(1,dpr*scale),economy?1:3,Math.sqrt(budget*scale*scale/Math.max(1,width*height)));
}
