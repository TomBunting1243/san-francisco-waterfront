// The 301 Howard lobby is 1.068 units from the Beale chamfer. The two
// storefront walks stop on public paving; the other two stay on the opposite sidewalk and the surveyed Park Tower walk.
type Stop=readonly [alongHoward:number,outFromFrontage:number];
const walkers=[
  {from:[-.22,1.34],to:[1.99,1.34],travel:30,rest:1.8,phase:52,grade:.045,look:'street'},
  {from:[-2.55,1.34],to:[-5.30,1.34],travel:36,rest:2,phase:38,grade:.0451,look:'street'},
  {from:[2.04,.106],to:[1.068,.08],travel:15,rest:5,phase:7.5,grade:.045,look:'lobby'},
  {from:[.81,.105],to:[-.335,.077],travel:16,rest:3.5,phase:14.5,grade:.045,look:'corner'},
] as const satisfies ReadonlyArray<{from:Stop;to:Stop;travel:number;rest:number;phase:number;grade:number;look:string}>;
export const howardBealeWalkerCount=walkers.length;

// Modeled local attendance, in slot order. The late pedestrian uses the public
// sidewalk; the office and window visitors go home earlier.
export function howardBealeAttendance(hour:number){
  if(hour>=8&&hour<18)return 4;
  if(hour>=7&&hour<20)return 3;
  if(hour>=6&&hour<23)return 1;
  return 0;
}

const tx=-.15497796,tz=-.98791793,nx=-tz,nz=tx;
export function howardBealeWalkerPose(time:number,index:number){
  const {from,to,travel,rest,phase,grade,look}=walkers[index];
  const period=2*travel+rest+2,clock=((time+phase)%period+period)%period;
  const turn=clock>=travel+rest,elapsed=turn?clock-travel-rest:clock;
  const t=Math.min(travel,elapsed),ramp=1;
  let distance=t-ramp/2;
  if(t<ramp)distance=t*t/(2*ramp);
  else if(t>travel-ramp)distance=travel-ramp-(travel-t)**2/(2*ramp);
  const f=distance/(travel-ramp),progress=turn?1-f:f;
  const ds=to[0]-from[0],dd=to[1]-from[1];
  const s=from[0]+ds*progress,d=from[1]+dd*progress;
  const x=-28.700+tx*s+nx*d,z=-26.706+tz*s+nz*d;
  const bearing=Math.atan2(tz*ds+nz*dd,tx*ds+nx*dd);
  let heading=bearing+(turn?Math.PI:0);
  if(elapsed>=travel){
    const wait=elapsed-travel,duration=turn?2:rest;
    let target=heading+Math.PI/2;
    if(!turn&&look==='lobby')target=Math.atan2(-nz,-nx);
    if(!turn&&look==='corner')target=Math.atan2(-26.487-z,-28.830-x);
    const arc=(from:number,to:number)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
    heading+=arc(heading,target)*Math.min(1,wait/.7);
    heading+=arc(target,bearing+(turn?0:Math.PI))*Math.max(0,1-(duration-wait)/.7);
  }
  return {x,z,y:grade,heading,standing:t===travel};
}
