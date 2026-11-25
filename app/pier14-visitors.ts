import {pier14Chairs,pier14Ground,pier14Seats} from './pier14-plaza.ts';
import {harborDatum} from './water-surface.ts';
import {pedestrianPace} from './waterfront-routes.ts';
import type {createPeople} from './people.ts';

type Visit={x:number;z:number;facing:number;seatHeight:number;distance:number;rest:number;look:number;offset:number;pier:boolean};
const benchFacing=Math.atan2(.995,.100);
function bench(index:number,distance:number,rest:number,look:number,offset:number):Visit{
  const [x,z]=pier14Seats[index];
  return {x,z,facing:benchFacing,seatHeight:.465*.06,distance,rest,look,offset,pier:false};
}
const [chairX,chairZ,chairYaw]=pier14Chairs[6];
export const pier14Visitors:Visit[]=[
  bench(0,.38,24,7,11),
  bench(4,.53,16,13,31),
  {x:chairX,z:chairZ,facing:chairYaw-Math.PI/2,seatHeight:.445*.06,distance:.125,rest:34,look:17,offset:8,pier:true},
];

const ease=(t:number)=>t*t*(3-2*t);
const settle=1.25,turn=1.65;
// The hips move back over the seat while the feet stay on the paving in front.
export const seatTravel=.037;
export function seatVisitMotion(site:Pick<Visit,'facing'|'distance'|'rest'|'look'|'offset'>,elapsed:number){
  const ramp=.55,walking=site.distance/pedestrianPace+ramp;
  function stride(t:number){
    if(t<ramp)return .5*pedestrianPace*t*t/ramp;
    if(t>walking-ramp)return site.distance-.5*pedestrianPace*(walking-t)**2/ramp;
    return pedestrianPace*(t-ramp*.5);
  }
  const stand=site.rest,walkOut=stand+settle,look=walkOut+walking;
  const turnBack=look+site.look,walkBack=turnBack+turn,faceSeat=walkBack+walking;
  const sit=faceSeat+turn,period=sit+settle;
  const t=((elapsed+site.offset)%period+period)%period;
  let seated=0,travel=0,facing=site.facing,pace=0;
  if(t<stand){
    seated=1;
  }else if(t<walkOut){
    seated=1-ease((t-stand)/settle);
  }else if(t<look){
    const step=t-walkOut;
    travel=stride(step);pace=Math.min(1,step/ramp,(walking-step)/ramp);
  }else if(t<walkBack){
    travel=site.distance;
    if(t>=turnBack)facing+=Math.PI*ease((t-turnBack)/turn);
  }else if(t<faceSeat){
    const step=t-walkBack;
    travel=site.distance-stride(step);pace=Math.min(1,step/ramp,(walking-step)/ramp);
    facing+=Math.PI;
  }else if(t<sit){
    facing+=Math.PI*(1-ease((t-faceSeat)/turn));
  }else{
    seated=ease((t-sit)/settle);
  }
  const along=.004+seatTravel*(1-seated)+travel;
  return {along,facing,pace,seated};
}
export function pier14Visit(site:Visit,elapsed:number){
  const {along,facing,pace,seated}=seatVisitMotion(site,elapsed);
  const x=site.x+along*Math.cos(site.facing),z=site.z+along*Math.sin(site.facing);
  return {x,z,y:site.pier?harborDatum.pierDeck:pier14Ground(x,z),heading:facing,pace,seated};
}

export function updatePier14Visitors(people:ReturnType<typeof createPeople>,start:number,sites:Visit[],time:number,hovered=-1){
  sites.forEach((site,j)=>{
    const at=(offset:number)=>pier14Visit(site,time+offset);
    const p=at(0);
    people.update(start+j,p.x,p.z,time,1,p.y,hovered===start+j?1:0,p.pace===0,p.heading,p.pace>0?at:undefined,
      {pace:p.pace,amount:p.seated,height:site.seatHeight,footReach:seatTravel*p.seated});
  });
}
