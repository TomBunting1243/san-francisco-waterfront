import {CircleGeometry,CylinderGeometry,QuadraticBezierCurve3,Shape,ShapeGeometry,Vector3} from 'three';
import fixtures from '../public/data/promenade-lights.json' with {type:'json'};
import grades from '../public/data/promenade-light-grades.json' with {type:'json'};
import type {StreetAssembly} from './street-amenities.ts';

// ET-14.0/14.1 (revised April 2025) identifies existing poles and mast
// lengths. The turn modules follow that drawing's design edition; the
// installation date of its revised indications has not been verified.
// https://bsm.sfdpw.org/EBD/912644/0000003295-Addendum%20No.%202%20Part%202%20of%203.pdf#page=205
// Pole feet are registered to the 2024 municipal 8 cm aerial; heads and
// the two Howard blades follow the field views and are dimensioned in metres.
const scale=.06,up=new Vector3(0,1,0);
function base(u:number,v:number,y=.045){return new Vector3(-56+u/132,y,2-v/132);}
export const howardPoles={
  1:base(4360,344,.0384),2:base(4085,334,.110),3:base(4068,476),5:base(4066,586),6:base(4056,636),
  7:base(4028,774),8:base(4073,819),9:base(4240,774),10:base(4305,702),14:base(4351,463),
};
type Pole=keyof typeof howardPoles;
const eastbound=Math.atan2(-.15,-.989),northbound=-Math.PI/2+.06,southbound=Math.PI/2+.26;
const mastColor='#536b73';
function station(p:Pole,x:number,y:number,z:number){
  return howardPoles[p].clone().add(new Vector3(x,y,z).multiplyScalar(scale));
}
type Face={pole:Pole;tip:Vector3;heading:number;section:'ball'|'left'|'rightYield';axis:0|1;arm:boolean};
// Orient the shafts/arms in world space. Do not infer the arm's direction
// from the lens heading: several of these shafts serve two movements.
function face(pole:Pole,offset:[number,number,number],heading:number,section:Face['section'],axis:0|1,arm=false):Face{
  return {pole,tip:station(pole,...offset),heading,section,axis,arm};
}
const faces=[
  face(1,[-.67,6.25,-7.58],northbound,'ball',0,true), // NB 24, existing 25 ft arm
  face(1,[-.48,3.85,-.12],northbound,'ball',0),face(2,[-.43,3.79,-.10],northbound,'ball',0),
  face(7,[1.45,6.25,7.47],southbound,'ball',0,true), // SB 64, existing 25 ft arm
  face(7,[.49,3.91,0],southbound,'ball',0),face(10,[.46,3.79,0],southbound,'ball',0),
  face(14,[-12.05,6.61,1.82],eastbound,'left',1,true), // 47, 40 ft arm
  face(1,[.06,4.75,-.49],eastbound,'left',1), // 42, replaced modules in existing housing
  face(6,[8.98,6.46,-1.36],eastbound,'rightYield',1,true), // 74, 30 ft arm
  face(5,[.07,4.36,-.49],eastbound,'rightYield',1), // 77
];
export const howardVehicleHeads=faces.map(f=>({
  x:f.tip.x,y:f.tip.y-(4.19+.64)*scale,z:f.tip.z,heading:f.heading,axis:f.axis,section:f.section,
  mount:{offset:0,rise:0,shared:true},surveyed:true,
}));
function pedestrian(from:Pole,to:Pole,clockOffset=0){
  const p=howardPoles[from],other=howardPoles[to];
  return {x:p.x,y:p.y,z:p.z,angle:Math.atan2(other.x-p.x,other.z-p.z),side:.028,clockOffset};
}
// The southern inland carriageway crossing may run with the yielding Howard
// right; the near Howard crossing runs with waterfront through traffic.
export const howardPedestrianHeads=[pedestrian(5,7),pedestrian(7,5),pedestrian(8,9,38),pedestrian(9,8,38)];
// SFMTA Sign Shop S269941 is snapped to the intersection. The closest
// existing single SFPUC lantern to the photographed far-curb position is
// 282996. The red faces are mounted directly on the two existing OCS poles.
const lampId=282996,lamp=fixtures.curb.find(p=>p[0]===lampId)!;
export const howardSigns=[
  {code:'R5-1',support:howardPoles[3],heading:Math.PI/2+.22,height:1.45,offset:.154},
  {code:'R5-1',support:howardPoles[14],heading:-Math.PI/2-.22,height:1.45,offset:.154},
  {code:'R6-1',support:new Vector3(lamp[1],grades[lampId],lamp[2]),heading:eastbound,height:2.55,offset:.099},
];
function addRegulatoryFaces(a:StreetAssembly){
  const pale='#f0efe3',black='#292d2c',back='#939690';
  for(const s of howardSigns){
    const n=new Vector3(Math.sin(s.heading),0,Math.cos(s.heading));
    const mid=s.support.clone().addScaledVector(up,s.height*scale).addScaledVector(n,s.offset*scale);
    function point(x:number,y:number,depth:number){
      return mid.clone().add(new Vector3(n.z*x+n.x*depth,y,-n.x*x+n.z*depth).multiplyScalar(scale));
    }
    function box(x:number,y:number,d:number,w:number,h:number,t:number,ink:string){
      const p=point(x,y,d);a.box(p.x,p.y,p.z,w*scale,h*scale,t*scale,ink).rotation.y=s.heading;
    }
    function text(word:string,y:number,height:number,ink:string,depth:number){
      const p=point(0,y,depth);a.label(word,p.x,p.y,p.z,height*scale,ink,s.heading);
    }
    for(const y of [-.12,.12])box(0,y,-.035,.055,.038,.078,back);
    if(s.code==='R5-1'){
      // Galvanized back, 30-inch red face, white horizontal bar and legends.
      const shell=a.add(new CylinderGeometry(.381*scale,.381*scale,.012*scale,24),back,mid.x,mid.y,mid.z);
      shell.rotation.set(Math.PI/2,s.heading,0,'YXZ');
      const p=point(0,0,.008);
      a.add(new CircleGeometry(.374*scale,24),'#bc302c',p.x,p.y,p.z).rotation.y=s.heading;
      box(0,0,.011,.55,.122,.003,pale);
      text('DO NOT',.104,.093,pale,.013);text('ENTER',-.194,.093,pale,.013);
    }else{
      // R6-1L: white left-pointing arrow and black lettering on black field.
      box(0,0,0,1.2192,.4064,.018,back);
      box(0,0,.010,1.209,.396,.002,pale);
      box(0,0,.013,1.180,.366,.002,black);
      const arrow=new Shape();
      for(const [i,[x,y]] of [[-.55,0],[-.31,.157],[-.31,.094],[.52,.094],[.52,-.094],[-.31,-.094],[-.31,-.157]].entries()){
        if(i===0)arrow.moveTo(x*scale,y*scale);else arrow.lineTo(x*scale,y*scale);
      }
      arrow.closePath();const p=point(0,0,.016);
      a.add(new ShapeGeometry(arrow),pale,p.x,p.y,p.z).rotation.y=s.heading;
      const label=point(.10,-.061,.018);a.label('ONE WAY',label.x,label.y,label.z,.111*scale,black,s.heading);
    }
  }
}
export function addHowardJunctionStandards(a:StreetAssembly){
  function tube(start:Vector3,end:Vector3,r0:number,r1=r0){
    const delta=end.clone().sub(start),m=start.clone().lerp(end,.5);
    a.add(new CylinderGeometry(r1*scale,r0*scale,delta.length(),8),mastColor,m.x,m.y,m.z)
      .quaternion.setFromUnitVectors(up,delta.normalize());
  }
  const heights:Record<Pole,number>={1:5.72,2:3.68,3:8.45,5:4.57,6:8.45,7:5.72,8:7.65,9:4.57,10:3.66,14:8.45};
  for(const [id,h] of Object.entries(heights)){
    const i=Number(id) as Pole,r=h>5?.145:.095;
    tube(howardPoles[i],station(i,0,h,0),r,r*.61);
  }
  for(const f of faces){
    const joint=station(f.pole,0,f.arm?4.95:Math.min(heights[f.pole]-.08,(f.tip.y-howardPoles[f.pole].y)/scale-.25),0);
    if(!f.arm){tube(joint,f.tip,.043);continue;}
    const middle=joint.clone().lerp(f.tip,.53);middle.y=f.tip.y+.055;
    const arc=new QuadraticBezierCurve3(joint,middle,f.tip);
    for(let k=0;k<5;k++)tube(arc.getPoint(k/5),arc.getPoint((k+1)/5),.105-k*.011,.094-k*.011);
    if(f.axis!==0)continue;
    const panel=arc.getPoint(.69),forward=new Vector3(Math.sin(f.heading),0,Math.cos(f.heading));
    panel.y-=.65*scale;
    a.box(panel.x,panel.y,panel.z,1.74*scale,.43*scale,.05*scale,'#35594e').rotation.y=f.heading;
    const text=panel.clone().addScaledVector(forward,.029*scale);
    a.label('Howard St',text.x,text.y-.095*scale,text.z,.188*scale,'#e6eade',f.heading);
    for(const k of [.63,.75]){
      const top=arc.getPoint(k),bottom=top.clone();bottom.y=panel.y+.20*scale;tube(bottom,top,.025);
    }
  }
  // Pole 3's transit housing presents its metal back to the rail opening.
  const transit=station(3,-.23,3.82,0);
  a.box(transit.x,transit.y,transit.z,.40*scale,.75*scale,.21*scale,'#525956').rotation.y=-Math.PI/2;
  addRegulatoryFaces(a);
}
