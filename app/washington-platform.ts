import {pccCabDoorZ} from './pcc-layout.ts';
import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import {StreetAssembly} from './street-amenities.ts';
import {trackAt,trackCenterlines,streetcarPose} from './streets.ts';
import {washingtonStopX,pccDoorLead} from './washington-call.ts';

const curb=.067,saloon=.1146,steel='#667578',blue='#406469';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const sides=[
  {direction:1,access:13.73,end:16.105,shelter:14.825,ramp:15.30,id:14532},
  {direction:-1,access:11.08,end:8.76,shelter:10.09,ramp:9.56,id:14534},
];
type Side=typeof sides[number];
function rail(side:Side,x:number){return trackAt(x,trackCenterlines[side.direction===1?0:1]);}
// Coordinates follow the trackward edge rather than a bounding rectangle on
// the curved median. Offsets are positive away from the rail on either side.
function point(side:Side,x:number,d:number,y:number):FacadePoint{
  return [x,y,rail(side,x).z+side.direction*d];
}
function lowerGrade(side:Side,x:number){
  return THREE.MathUtils.lerp(.045,curb,clamp((x-side.access)*side.direction/.28));
}
function washingtonIsland(side:Side){
  const dir=side.direction,a=new StreetAssembly(),flat=new FacadePanels();
  const slab=(x0:number,x1:number,d0:number,d1:number,y0:number,y1:number,bottom:number,top:string,face:string)=>{
    const l=point(side,x0,d0,y0),r=point(side,x0,d1,y0),s=point(side,x1,d0,y1),t=point(side,x1,d1,y1);
    flat.quad(l,r,t,s,top);
    const low=(p:FacadePoint):FacadePoint=>[p[0],bottom,p[2]];
    for(const [v,w] of [[l,s],[t,r],[r,l],[s,t]])flat.quad(v,w,low(w),low(v),face);
  };
  const offset=.082,width=.293;
  const stages=[side.access,side.access+.28*dir,side.shelter,side.ramp,side.end-.23*dir,side.end];
  for(let i=1;i<stages.length;i++){
    const x=stages[i-1],xx=stages[i];
    slab(x,xx,offset,width,lowerGrade(side,x),lowerGrade(side,xx),.031,'#bfbcb0','#a49f92');
  }
  const high=side.end-.23*dir;
  slab(side.ramp,high,offset+.013,offset+.106,curb+.001,saloon,curb,'#a99d87','#897f70');
  slab(high,side.end,offset+.013,offset+.106,saloon,saloon,curb,'#afa794','#938978');
  slab(side.end-.057*dir,side.end,offset+.013,offset+.106,saloon+.0006,saloon+.0006,saloon,'#c4a547','#b59c59');
  function beam(p:FacadePoint,q:FacadePoint,thickness:number,ink:string){
    const begin=new THREE.Vector3(...p),axis=new THREE.Vector3(...q).sub(begin);
    const mid=begin.addScaledVector(axis,.5);
    a.box(mid.x,mid.y,mid.z,thickness,axis.length(),thickness,ink).quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
  }
  function railing(x0:number,x1:number,d:number,grade:(x:number)=>number){
    const n=Math.ceil(Math.abs(x1-x0)/.124);
    let last=x0;
    for(let i=0;i<=n;i++){
      const x=x0+(x1-x0)*i/n,h=grade(x);
      beam(point(side,x,d,h),point(side,x,d,h+.060),.0038,blue);
      // The posts remain at full spacing. Share each straight rail between
      // adjacent bays, with short chords following the track curvature.
      if(i>0&&(i%4===0||i===n)){
        for(const rise of [.060,.036])beam(point(side,last,d,grade(last)+rise),point(side,x,d,h+rise),.0038,blue);
        last=x;
      }
    }
  }
  railing(side.access+.22*dir,side.end,.286,x=>lowerGrade(side,x));
  const rampGrade=(x:number)=>curb+(saloon-curb)*clamp((x-side.ramp)/(high-side.ramp));
  railing(side.ramp,side.end,offset+.106,rampGrade);
  railing(side.ramp,high-.035*dir,offset+.014,rampGrade);
  // 2024 8 cm aerial gives the roof envelopes. The north/south station
  // photographs show a pale arched canopy, metal mesh seats and an end map.
  const x=side.shelter,y=curb+.155,d=.211,length=.395;
  for(const k of [-1,1])for(const depth of [d-.052,d+.052]){
    const u=x+k*.148;
    beam(point(side,u,depth,curb),point(side,u,depth,y+.003),.0057,steel);
  }
  const rise=(u:number)=>.019*(1-u*u);
  for(let i=0;i<8;i++){
    const t0=i/4-1,t1=(i+1)/4-1,lo=x+length*t0/2,hi=x+length*t1/2;
    const edge=(xx:number,t:number,depth:number,h:number)=>point(side,xx,depth,y+rise(t)+h);
    const near=d-.067*dir,far=d+.067*dir;
    const a0=edge(lo,t0,near,0),a1=edge(hi,t1,near,0),b0=edge(lo,t0,far,0),b1=edge(hi,t1,far,0);
    const c0=edge(lo,t0,near,-.0034),c1=edge(hi,t1,near,-.0034),e0=edge(lo,t0,far,-.0034),e1=edge(hi,t1,far,-.0034);
    flat.quad(a0,b0,b1,a1,'#c3ccc8');flat.quad(c1,e1,e0,c0,'#b0b9b3');
    flat.quad(a0,a1,c1,c0,steel);flat.quad(b1,b0,e0,e1,steel);
    if(i===0)flat.quad(b0,a0,c0,e0,steel);
    if(i===7)flat.quad(a1,b1,e1,c1,steel);
  }
  for(const depth of [d-.051,d+.051]){
    beam(point(side,x-.19,depth,y-.023),point(side,x+.19,depth,y-.023),.004,steel);
  }
  const header=point(side,x,d-.052,y-.024);
  a.box(x,header[1],header[2],.292,.017,.006,'#4b514b');
  a.label('WASHINGTON & THE EMBARCADERO',x,header[1]-.0037,header[2]-dir*.0036,.0076,'#d6cda9',dir>0?Math.PI:0);
  // Open bench frames and separate seats retain views between the columns.
  for(const u of [-.105,-.063,-.021,.021]){
    const pos=point(side,x+u,d+.020,curb);
    a.box(pos[0],curb+.025,pos[2],.038,.004,.026,'#8a9591');
    a.box(pos[0],curb+.042,pos[2]+dir*.013,.038,.028,.003,'#939e98');
    a.box(pos[0],curb+.012,pos[2],.006,.024,.011,steel);
  }
  const endX=x+.148*dir,center=point(side,endX,d,curb);
  a.box(endX,curb+.068,center[2],.007,.115,.087,'#9ba9a6');
  a.box(endX+.004*dir,curb+.078,center[2],.002,.080,.060,'#c3c6b8');
  a.box(endX+.0054*dir,curb+.113,center[2],.001,.007,.061,'#994c48');
  const flag=point(side,x-.19*dir,d+.020,curb);
  a.box(flag[0],curb+.140,flag[2],.011,.032,.056,'#404b4c');
  a.box(flag[0],curb+.134,flag[2]+dir*.029,.009,.002,.001,'#d2ae70');
  const panels=flat.mesh(new THREE.MeshStandardMaterial({vertexColors:true}));
  panels.geometry.userData.paintVertices=true;a.add(panels.geometry,'#ffffff',0,0,0);
  return a.bake('Washington F-line wayside platform '+side.id);
}

const parked=streetcarPose(washingtonStopX);
const cos=Math.cos(parked.heading),sin=Math.sin(parked.heading);
const door={x:parked.x+pccDoorLead*cos,z:parked.z-pccDoorLead*sin};
const threshold=.42*(8+4/12)*.3048*.06/.8835;
const outside=threshold+.065;
export type WashingtonTramPose=ReturnType<typeof streetcarPose>&{pitch?:number};
const aisleAcross=threshold+(.350-1.506)*.06;
const gripFromDoor=(pccCabDoorZ-2.961)*.06;
const nodes=[
    // One walker enters from the marked intersection, reads the end map and
    // moves to the waiting line. Seconds are relative to the actual dwell.
    [-30,13.74-door.x,.156,lowerGrade(sides[0],13.74)],
    [-26,14.02-door.x,.156,curb],[-13,14.93-door.x,.156,curb],
    [-5,14.93-door.x,.156,curb],[-1.5,0,outside,curb],[1.55,0,outside,curb],
    [2.5,0,threshold+.014,curb],[2.98,0,threshold-.003,.0798],
    [3.52,0,threshold-.017,.0936],[4.10,0,threshold-.031,.105],
    [4.68,0,threshold-.046,saloon],[5.48,-.011,aisleAcross,saloon],
    // Stay to the left of the front right seat. The hand naturally reaches its
    // aisle stanchion when the rider turns to face the front after boarding.
    [7.70,gripFromDoor,aisleAcross,saloon],

  ];
export function washingtonRiderPose(t:number,tram:WashingtonTramPose=parked){
  const i=nodes.findIndex(n=>n[0]>=t),a=nodes[Math.max(0,(i<0?nodes.length-1:i)-1)],b=nodes[i<0?nodes.length-1:i];
  const f=clamp((t-a[0])/(b[0]-a[0]||1)),along=a[1]+(b[1]-a[1])*f,across=a[2]+(b[2]-a[2])*f;
  const onboard=t>=2.98;
  const body=onboard?tram:parked,pitch=onboard?(tram.pitch??0):0;
  const rise=across>threshold+.008&&t< -13?lowerGrade(sides[0],door.x+along*cos+across*sin):a[3]+(b[3]-a[3])*f;
  const localY=rise-parked.y,localX=pccDoorLead+along,cp=Math.cos(pitch),sp=Math.sin(pitch);
  const projectedX=localX*cp-localY*sp,c=Math.cos(body.heading),s=Math.sin(body.heading);
  const x=body.x+projectedX*c+across*s,z=body.z-projectedX*s+across*c,y=body.y+localX*sp+localY*cp;
  const walking=(a[1]!==b[1]||a[2]!==b[2])&&t>a[0]&&t<b[0];
  let turn=walking?Math.atan2(b[1]-a[1],b[2]-a[2]):Math.PI;
  if(t>=5.48)turn=-Math.PI/2-Math.PI*THREE.MathUtils.smoothstep(t,7.70,8.65);
  const grip=THREE.MathUtils.smoothstep(t,8.10,9.00);
  return {x,z,y,walking,visible:t>=-30,yaw:body.heading+turn,bodyHeading:body.heading,turn,pitch,grip};
}

// The operator's camera passes within a metre of this rider. Shape the coat,
// jaw, cuffs and cap in the same four rigid pieces as the walking figure.
function washingtonPassenger(){
  const root=new THREE.Group(),torso=new StreetAssembly(),legs=new StreetAssembly(),arm=new StreetAssembly();
  const coat='#946e50',skin='#bd906d',wool='#564941',up=new THREE.Vector3(0,1,0);
  function rings(a:StreetAssembly,profile:number[][],depth:number,ink:string,x:number,y:number,z:number,n=8){
    const g=new THREE.LatheGeometry(profile.map(([radius,height])=>new THREE.Vector2(radius,height)),n);
    a.add(g.scale(1,1,depth),ink,x,y,z);
  }
  function sleeve(a:StreetAssembly,from:number[],to:number[],r0:number,r1:number){
    const start=new THREE.Vector3(...from),axis=new THREE.Vector3(...to).sub(start),mid=start.addScaledVector(axis,.5);
    const mesh=a.add(new THREE.CylinderGeometry(r1,r0,axis.length(),6,1,true),coat,mid.x,mid.y,mid.z);
    mesh.quaternion.setFromUnitVectors(up,axis.normalize());
  }
  function oval(a:StreetAssembly,x:number,y:number,z:number,w:number,h:number,d:number,ink:string){
    a.add(new THREE.SphereGeometry(1,6,3).scale(w,h,d),ink,x,y,z);
  }
  rings(torso,[[.143,.78],[.177,.89],[.185,1.20],[.212,1.285],[.088,1.36]],.69,coat,0,0,0);
  rings(torso,[[.082,1.332],[.076,1.425]],.88,'#89684f',0,0,0);
  rings(torso,[[.046,1.399],[.087,1.433],[.111,1.516],[.106,1.606],[.068,1.642]],.90,skin,0,0,.006);
  rings(torso,[[.111,1.563],[.116,1.593],[.091,1.647],[0,1.671]],1.02,wool,0,0,-.003);
  oval(torso,0,1.581,.081,.114,.019,.079,'#4a423c');
  // Just a nose plane and the shadow below the cap at this scale.
  torso.add(new THREE.ConeGeometry(.025,.067,4),'#b78967',0,1.512,.108).rotation.x=.29;
  for(const side of [-1,1])torso.add(new THREE.PlaneGeometry(.025,.005),'#725e50',side*.047,1.544,.095).rotation.y=side*.34;
  sleeve(torso,[.171,1.29,0],[.215,1.068,.012],.077,.056);
  sleeve(torso,[.215,1.068,.012],[.206,.884,.055],.056,.041);
  oval(torso,.206,.866,.060,.038,.055,.042,skin);
  sleeve(arm,[.026,.003,0],[-.10,-.195,.107],.075,.054);
  sleeve(arm,[-.10,-.195,.107],[-.125,-.060,.187],.054,.042);
  oval(arm,-.125,-.05,.201,.045,.051,.04,skin);
  legs.box(0,-.208,0,.13,.42,.15,'#4c5962');legs.box(0,-.58,0,.115,.36,.14,'#515c60');
  legs.box(0,-.772,.045,.135,.085,.24,'#514c46');
  const first=legs.bake('Walking leg'),second=first.clone(),gripping=arm.bake('Washington rider gripping arm');
  first.position.set(-.083,.817,0);second.position.set(.083,.817,0);gripping.position.set(-.195,1.28,0);
  root.add(torso.bake('Passenger in a brimmed cap'),first,second,gripping);
  function stride(t:number,walking:boolean,grip:number){
    first.rotation.x=walking?.37*Math.sin(5.6*t):.014;second.rotation.x=-first.rotation.x;
    gripping.rotation.x=(1-grip)*1.18;
  }
  return {root,stride};
}

export function createWashingtonPlatforms(){
  const root=new THREE.Group(),rider=washingtonPassenger();root.name='Washington F-line station';
  for(const side of sides)root.add(washingtonIsland(side));
  rider.root.name='Washington front-door passenger';rider.root.scale.setScalar(.06);root.add(rider.root);
  const basis=new THREE.Euler(0,0,0,'YXZ'),yaw=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
  const light=new THREE.Vector4(),shelter=point(sides[0],sides[0].shelter,.21,curb+.151);
  function update(t:number,tram?:WashingtonTramPose){
    const p=washingtonRiderPose(t,tram);rider.root.visible=p.visible;if(!p.visible)return;
    rider.root.position.set(p.x,p.y,p.z);
    rider.root.quaternion.setFromEuler(basis.set(0,p.bodyHeading,p.pitch,'YXZ')).multiply(yaw.setFromAxisAngle(up,p.turn));
    rider.stride(t,p.walking,p.grip);
    // The right bank of saloon lights sits at cab x=1.03 m, z=1.14+1.60n.
    // The curb receives spill as the car arrives. Inside, transition between
    // the two nearby fixtures as the rider walks rearward to the stanchion.
    const body=tram??parked;
    const c=Math.cos(body.heading),s=Math.sin(body.heading),pitch=tram?.pitch??0;
    const cp=Math.cos(pitch),sp=Math.sin(pitch);
    const bulbZ=1.14+1.60*THREE.MathUtils.smoothstep(t,5.48,7.70);
    const along=pccDoorLead+(pccCabDoorZ-bulbZ)*.06,across=threshold+(1.03-1.506)*.06;
    const height=(2.15+.896)*.06,projected=along*cp-height*sp;
    const spill=THREE.MathUtils.smoothstep(t,-1.5,2.35);
    light.set(THREE.MathUtils.lerp(shelter[0],body.x+projected*c+across*s,spill),
      THREE.MathUtils.lerp(shelter[1],body.y+height*cp+along*sp,spill),
      THREE.MathUtils.lerp(shelter[2],body.z-projected*s+across*c,spill),
      .13+.42*spill+.45*THREE.MathUtils.smoothstep(t,2.6,4.68));
  }
  update(-100);return {root,update,light,rider:rider.root};
}
