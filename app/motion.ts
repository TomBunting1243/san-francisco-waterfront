import {waterHeight} from './water-surface.ts';
import {servicePose,type FerryServiceClock} from './ferry-service.ts';
export {ferryFleet,ferryCycle} from './ferry-service.ts';
export function ferryPose(elapsed:number,index:number,clock?:FerryServiceClock){
  const p=servicePose(elapsed,index,clock);
  return {...p,y:waterHeight(p.x,p.z,elapsed)};
}
export function birdPose(elapsed:number,index:number){
  const t=elapsed*(.085+(index%3)*.01)+index*1.7;
  return {x:5+Math.sin(t)*(19+index*1.5),y:13+index*.55+Math.sin(t*2.1)*1.3,z:9+Math.cos(t)*(3+index*.35),heading:Math.atan2(Math.sin(t)*(3+index*.35),Math.cos(t)*(19+index*1.5)),flap:Math.sin(elapsed*(5.5+index*.15)+index)*.5};
}

export function sailingPose(seconds:number, index:number) {
  const t=seconds*.018 + index*2.8;
  const x=23+Math.sin(t)*9, z=17.4+index*4.2+Math.cos(t)*.58;
  return {x,z,y:waterHeight(x,z,seconds),heading:Math.atan2(.58*Math.sin(t),9*Math.cos(t)),heel:.055+Math.sin(seconds*.72+index)*.035};
}
