import type {createPeople} from './people.ts';
import {seatTravel,seatVisitMotion} from './pier14-visitors.ts';

// 405 Howard plaza, 2024 city ortho and 2023 lidar. The seat is inside
// the Howard edge of the grove. A quarter-circle around the last tree row
// links the central aisle to the opening between the arcade columns.
const grade=.0462,seatHeight=.045+.42*.06-grade,pixel=.06/7;
const straight=79,radius=18,arc=Math.PI*radius/2,finish=86;
const visit={facing:0,distance:(straight+arc+finish)*pixel-seatTravel-.004,rest:25,look:5,offset:21};
const duX=.0012973094,duZ=.0084728164,dvX=-.0084729829,dvZ=.0012965840;
const seatX=-27.00800104-504*duX+316*dvX,seatZ=-33.37263659-504*duZ+316*dvZ;
export function foundryVisitorPose(time:number){
  const motion=seatVisitMotion(visit,time),distance=motion.along/pixel;
  const a=Math.min(Math.PI/2,Math.max(0,(distance-straight)/radius));
  const u=radius*(1-Math.cos(a))+Math.max(0,distance-straight-arc);
  const v=Math.min(distance,straight)+radius*Math.sin(a);
  return {x:seatX+u*duX+v*dvX,z:seatZ+u*duZ+v*dvZ,y:grade,
    heading:Math.atan2(dvZ*Math.cos(a)+duZ*Math.sin(a),dvX*Math.cos(a)+duX*Math.sin(a))+motion.facing,
    pace:motion.pace,seated:motion.seated};
}
export function updateFoundryVisitor(people:ReturnType<typeof createPeople>,slot:number,time:number,hour:number,
  viewerX:number,viewerZ:number,hovered=-1){
  // Modeled daytime attendance. Skip figure and gait matrices when distant.
  if(hour<7||hour>=20||(viewerX-seatX)**2+(viewerZ-seatZ)**2>16**2){
    if(!people.isHidden(slot))people.hide(slot);
    return;
  }
  const sample=(dt:number)=>foundryVisitorPose(time+dt),p=sample(0);
  people.update(slot,p.x,p.z,time,1,p.y,hovered===slot?1:0,p.pace===0,p.heading,p.pace>0?sample:undefined,
    {amount:p.seated,height:seatHeight,footReach:seatTravel*p.seated,pace:p.pace});
}
