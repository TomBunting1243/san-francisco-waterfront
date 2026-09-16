/** Device-local motion preference shared by every city view. */
export const motionKey='tom-city-motion-paused';
export const motionEvent='tom-city-motion-change';
export function readMotionPreference(){try{return localStorage.getItem(motionKey)==='true';}catch{return false;}}
export function writeMotionPreference(paused:boolean){try{localStorage.setItem(motionKey,String(paused));}catch{/* Storage can be unavailable in private contexts. */}window.dispatchEvent(new Event(motionEvent));}
export const clampZoom=(zoom:number)=>Math.max(.75,Math.min(2.75,zoom));
/** A slow dwell activates edge orbit; controls and the title are outside its vertical band. */
export function edgeOrbit(x:number,y:number){if(y<.22||y>.78)return 0;return x<.035?x/.035-1:x>.965?(x-.965)/.035:0;}
export function createQualityMonitor(initial=2){
  let level=initial,total=0,frames=0,cooldown=0;
  return {sample(ms:number,now:number){if(ms>120||ms<1)return level;total+=ms;frames++;if(frames>=120){const average=total/frames;total=0;frames=0;if(now>cooldown){const next=average>27?Math.max(0,level-1):average<18?Math.min(initial,level+1):level;if(next!==level){level=next;cooldown=now+12000;}}}return level;}};
}
/** Cumulative walk distance with a short, smooth pause, avoiding jumps at restarts. */
export function walkingTime(t:number,i:number){const period=24+i%4*3,rest=3+i%3,phase=i*5.17;const travel=(v:number)=>{const cycle=Math.floor(v/period),local=v-cycle*period;return cycle*(period-rest)+Math.min(local,period-rest);};return travel(t+phase)-travel(phase);}
