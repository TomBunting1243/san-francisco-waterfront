import {CylinderGeometry,Vector3} from 'three';
import type {StreetAssembly} from './street-amenities.ts';
import {northWaterfrontGrade} from './north-quay-grade.ts';

// Registered shaft centers on the straightened 2024 city orthophoto. Elevations
// are measured from the pavement under each pole to its 2023 USGS returns.
function station(u:number,v:number,curb=0){
  const x=80+u/112;
  return {x,z:-11+(660+v-.2*u)/112,y:northWaterfrontGrade(x)+curb};
}
const poles=[station(130,30,.014),station(147,115),station(163,195),
  station(182,295,.018),station(417,295,.018),station(329,132)];
const crossingAngle=Math.atan2(poles[3].x-poles[0].x,poles[3].z-poles[0].z);
export const chestnutPedestrianHeads=poles.slice(0,4).map((p,i)=>({
  ...p,angle:crossingAngle+(i%2?Math.PI:0),side:i%2?-.033:.033,
}));
// The two median posts face back into their respective traffic crossings.
// Carry the bracket out toward the zebra, on the north side of all four shafts.
const northFacing=Math.atan2(1,-.20),southFacing=northFacing-Math.PI;
const attachments=[
  {pole:0,u:134,v:46,top:5.6,heading:northFacing},
  {pole:0,u:145,v:81,top:6.45,heading:northFacing},
  {pole:4,u:405,v:271,top:5.75,heading:southFacing},
  {pole:4,u:379,v:226,top:6.95,heading:southFacing},
  {pole:5,u:332,v:129,top:4.15,heading:Math.PI},
];
function crown(i:number){
  const {pole,u,v,top}=attachments[i],p=station(u,v);
  return new Vector3(p.x,poles[pole].y+top*.06,p.z);
}
export const chestnutVehicleHeads=attachments.map(({heading,pole},i)=>{
  const p=crown(i);
  // facePoint() positions the casing .06 m forward of this mounting plane.
  return {x:p.x,y:p.y-(4.19+.67)*.06,z:p.z,heading,axis:pole===5?1 as const:0 as const,
    mount:{offset:0,rise:0,shared:true},surveyed:true};
});
export function addChestnutStandards(a:StreetAssembly){
  const ink='#61716e';
  function strut(start:Vector3,end:Vector3,base:number,tip:number){
    const delta=end.clone().sub(start),mid=start.clone().lerp(end,.5);
    const m=a.add(new CylinderGeometry(tip,base,delta.length(),9),ink,mid.x,mid.y,mid.z);
    m.quaternion.setFromUnitVectors(new Vector3(0,1,0),delta.normalize());
  }
  for(const [i,p] of poles.entries()){
    const height=[8.4,5.1,3.6,8.4,8.4,4.5][i]*.06;
    a.add(new CylinderGeometry(.0038,height>.45?.009:.0064,height,10),ink,p.x,p.y+height/2,p.z);
  }
  for(const [pole,near,far] of [[0,0,1],[4,2,3]]){
    const p=poles[pole];
    strut(new Vector3(p.x,p.y+.30,p.z),crown(near),.0064,.0045);
    strut(crown(near),crown(far),.0045,.0034);
  }
  const island=poles[5];strut(new Vector3(island.x,island.y+.244,island.z),crown(4),.003,.0027);
  for(let i=0;i<attachments.length;i++){
    const top=crown(i);
    strut(top,top.clone().add(new Vector3(0,-.03*.06,0)),.002,.002);
  }
}
