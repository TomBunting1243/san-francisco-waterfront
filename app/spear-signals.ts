import {CylinderGeometry,QuadraticBezierCurve3,Vector3} from 'three';
import type {StreetAssembly} from './street-amenities.ts';

// Far curb from the eastbound Howard approach. KartaView 11605, frames 1542
// and 1543 (2016), show both curb lenses and the head above the Spear blade.
// Foliage in the 2024 ortho hides the shaft foot. Register the two supports to
// their paved corner landings and scale the shared mast from the street photo.
const curbY=.045,scale=.06;
const up=new Vector3(0,1,0);
const across=new Vector3(.988686,0,-.150004);
const facing=new Vector3(-.150004,0,-.988686);
const heading=Math.atan2(facing.x,facing.z);
function curbPoint(u:number,v:number){
  const a=(u-300)/200,b=(v-300)/200;
  return new Vector3(-25.894+.988686*a+.150004*b,curbY,-12.650-.150004*a+.988686*b);
}
const mast=curbPoint(171,429),farPole=curbPoint(438,432);
function station(base:Vector3,reach:number,rise:number){
  return base.clone().addScaledVector(across,reach*scale).addScaledVector(up,rise*scale);
}
const tips=[station(mast,6.8,6.65),station(mast,.34,3.98),station(farPole,-.34,3.98)];
export const spearVehicleHeads=tips.map(p=>({
  x:p.x,y:p.y-(4.19+.64)*scale,z:p.z,heading,axis:1 as const,
  mount:{offset:0,rise:0,shared:true},surveyed:true,
}));

export function addSpearStandards(a:StreetAssembly){
  const steel='#768380';
  function tube(from:Vector3,to:Vector3,base:number,tip:number){
    const d=to.clone().sub(from),mid=from.clone().lerp(to,.5);
    a.add(new CylinderGeometry(tip*scale,base*scale,d.length(),8),steel,mid.x,mid.y,mid.z)
      .quaternion.setFromUnitVectors(up,d.normalize());
  }
  for(const [i,pole] of [mast,farPole].entries()){
    tube(pole,station(pole,0,i===0?5.65:4.07),.139,i===0?.083:.071);
    const top=tips[i+1];
    tube(station(pole,0,3.90),top,.042,.042);
  }
  const arm=new QuadraticBezierCurve3(station(mast,0,5.0),station(mast,3.9,6.78),tips[0]);
  for(let i=0;i<4;i++)tube(arm.getPoint(i/4),arm.getPoint((i+1)/4),.105-i*.015,.090-i*.015);
  // The green blade hangs just inboard of the upper head and faces the driver.
  const panel=station(mast,5.10,5.85).addScaledVector(facing,.004);
  a.box(panel.x,panel.y,panel.z,1.95*scale,.46*scale,.048*scale,'#35584c').rotation.y=heading;
  const text=panel.clone().addScaledVector(facing,.0023);
  a.label('Spear',text.x,text.y-.098*scale,text.z,.228*scale,'#e5e8d7',heading);
  for(const reach of [4.5,5.7]){
    const attachment=arm.getPointAt(reach/6.8);
    const base=station(mast,reach,6.06).addScaledVector(facing,.0033);
    tube(base,attachment,.024,.024);
  }
}
