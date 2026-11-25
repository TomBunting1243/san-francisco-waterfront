import {courtyardPoint} from './howard-public-courtyard.ts';
import {pier14Visit,seatTravel} from './pier14-visitors.ts';
import type {createPeople} from './people.ts';

// Middle timber slat, leaving room behind the visitor for the backrest.
// From here the unobstructed east aisle leads straight to the Howard sidewalk.
const [seatX,grade,seatZ]=courtyardPoint(3.52,46.25);
const [mouthX,,mouthZ]=courtyardPoint(3.52,-.63);
const site={x:seatX,z:seatZ,facing:Math.atan2(mouthZ-seatZ,mouthX-seatX),
  distance:Math.hypot(mouthX-seatX,mouthZ-seatZ)-seatTravel-.004,
  seatHeight:.487*.06,rest:19,look:3,offset:60,pier:false};

export function courtyardVisitorOpen(weekend:boolean,minutes:number){
  return !weekend&&minutes>=8*60&&minutes<18*60;
}
export function courtyardVisitorPose(seconds:number){
  const pose=pier14Visit(site,seconds);
  return {...pose,y:grade};
}
export function updateCourtyardVisitor(people:ReturnType<typeof createPeople>,slot:number,time:number,open:boolean,wave=0){
  if(!open){people.hide(slot);return;}
  const at=(offset:number)=>courtyardVisitorPose(time+offset),p=at(0);
  people.update(slot,p.x,p.z,time,1,p.y,wave,p.pace===0,p.heading,p.pace>0?at:undefined,
    {amount:p.seated,height:site.seatHeight,footReach:seatTravel*p.seated,pace:p.pace});
}
