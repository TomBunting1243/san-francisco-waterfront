import {waterHeight} from './water-surface.ts';
import {boardingStops} from './ferry-terminal.ts';
// The bow is local +X. WETA's three covered berths have straight side
// landings. Hold the passenger sill at the recorded boarding threshold.
const ferries=[
  {name:'Dorado',gate:'E',side:1,offset:9,outer:58,splay:-3},
  {name:'Delphinus',gate:'B',side:-1,offset:105,outer:65,splay:4},
  {name:'Karl',gate:'G',side:1,offset:60,outer:61,splay:-12},
] as const;
export const ferryFleet=ferries.map(({name})=>name);
export const ferryCycle=138;
const smooth=(t:number)=>t*t*(3-2*t);
const atanHeading=(dx:number,dz:number)=>Math.atan2(-dz,dx);
export function ferryPose(elapsed:number,index:number){
  const route=ferries[index%ferries.length];
  const time=((elapsed+route.offset)%ferryCycle+ferryCycle)%ferryCycle;
  const [stopX,stopZ]=boardingStops[route.gate],berthZ=stopZ+.209;
  let x=stopX+route.side*.47,z=berthZ,heading=Math.PI/2,wake=0,phase='alongside';
  // Final and initial maneuvers are stern-clear and parallel to the float.
  // The ferry backs off before rotating in the fairway under waterjet thrust.
  if(time<22){
    const t=1-time/22;z+=14*t*t;
    wake=.68*t;phase='arriving';
  }else if(time>=40&&time<55){
    const t=(time-40)/15;z+=8*smooth(t);
    phase='backing';
  }else if(time>=55&&time<64){
    const t=(time-55)/9;z+=8;heading+=Math.PI*smooth(t);
    phase='turning';
  }else if(time>=64&&time<96){
    const t=(time-64)/32,u=smooth(t);
    z+=8+(route.outer-berthZ-8)*u;
    x+=route.splay*u*u;
    heading=atanHeading(2*route.splay*u,route.outer-berthZ-8);
    wake=4*t*(1-t);phase='departing';
  }else if(time>=96&&time<103){
    const t=(time-96)/7;z=route.outer;x+=route.splay;
    const start=atanHeading(2*route.splay,route.outer-berthZ-8);
    const end=atanHeading(-2*route.splay,berthZ+14-route.outer);
    heading=start+Math.atan2(Math.sin(end-start),Math.cos(end-start))*smooth(t);
    phase='turning';
  }else if(time>=103){
    // Match the velocity at the start of the final approach across loop wrap.
    const t=(time-103)/(ferryCycle-103),length=route.outer-berthZ-14;
    const endSlope=28/22*(ferryCycle-103)/length;
    const u=t*t*((3-endSlope)+(endSlope-2)*t);
    z=route.outer-length*u;x+=route.splay*(1-u)*(1-u);
    heading=atanHeading(-2*route.splay*(1-u),-length);
    wake=Math.min(1,3*t)*(.68+.32*Math.sin(Math.PI*t));phase='arriving';
  }
  const brow=phase==='alongside'?smooth(Math.min(1,(time-22)/2,(40-time)/2)):0;
  return {x,z,y:waterHeight(x,z,elapsed),heading,wake,phase,gate:route.gate,brow};
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
