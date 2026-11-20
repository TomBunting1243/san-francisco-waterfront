import * as THREE from 'three';
import {StreetAssembly} from './street-amenities.ts';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import {streetcarTrack,trackAt,trackCenterlines} from './streets.ts';

// OSM ways 196670577/196670575 (ordinary platforms), 675498932/675498929
// (2 ft 10 in waysides), and 675572680/675572679 (connecting ramps).
// Roof limits and skin profiles: SF 2024 8 cm ortho and 2023 USGS laser
// sections. Architectural references: ROMA Ferry Building Area, Port plan C3,
// Pantoja's 2015 platform photo and the March 2019 photo of 1071 and 1815.
// https://www.sfport.com/media/9230/download
// https://www.romacollaborative.com/ferry-building-area
// https://commons.wikimedia.org/wiki/File:Ferry_Building_station,_San_Francisco_(21043433449).jpg
// https://commons.wikimedia.org/wiki/File:Muni_1071_and_1815_at_the_Ferry_Building,_March_2019.JPG
// The camera aisle is registered to the existing rail mesh. Its grade differs
// from the independently surveyed plaza paving, so blend over a 1:12 approach.
// Seat spacing, metal sections and lamp output are photographic estimates.
const platforms=[
  {id:14513,dir:1,entry:.415,low:.849,ramp:2.236,high:2.887,end:3.039,roof:[.72,3.08],lip:.132},
  {id:17283,dir:-1,entry:-.836,low:-1.270,ramp:-2.702,high:-3.327,end:-3.479,roof:[-1.23,-3.56],lip:.058},
] as const;
type Site=typeof platforms[number];
const canopyDepth=.248;
const curb=.067,grade=.031,highFloor=streetcarTrack.railTop+34*.0254*.06;
const clamp=(v:number)=>THREE.MathUtils.clamp(v,0,1);
function ground(s:Site,x:number){
  const entry=clamp((x-s.entry)/(s.low-s.entry)),ramp=clamp((x-s.ramp)/(s.high-s.ramp));
  return grade+(curb-grade)*entry+(highFloor-curb)*ramp;
}
export function ferryMarketBoardingHeight(x:number){return ground(platforms[0],x);}

// The ortho locates foliage well, but a crown can hide its tree well. Keep
// the two planting rows beside the measured metal roofs. High branches may
// overhang, while the trunk, boarders and lower branches clear the soffit.
export function fitStationTree(tree:THREE.Group){
  const {x,z}=tree.position;
  if(Math.abs(x)>4.2||z> -2.8||z< -4.6)return;
  const bounds=new THREE.Box3().setFromObject(tree,true);
  for(const s of platforms){
    const lo=Math.min(...s.roof),hi=Math.max(...s.roof);
    if(bounds.max.x<lo-.015||bounds.min.x>hi+.015)continue;
    const rail=trackCenterlines[s.dir===1?0:1];
    const signedRear=(u:number)=>s.dir*trackAt(u,rail).z+s.lip+canopyDepth;
    const rear=Math.max(signedRear(lo),signedRear(hi));
    if(s.dir*z<rear-.17||Math.min(s.dir*bounds.min.z,s.dir*bounds.max.z)>rear+.10)continue;
    tree.position.z=s.dir*Math.max(s.dir*z,rear+.093);
    tree.updateMatrixWorld(true);
    const world=new THREE.Vector3(),inverse=new THREE.Matrix4();
    tree.traverse(part=>{
      if(!(part instanceof THREE.Mesh))return;
      const g=part.geometry,pos=g.getAttribute('position');
      inverse.copy(part.matrixWorld).invert();
      for(let i=0;i<pos.count;i++){
        world.fromBufferAttribute(pos,i).applyMatrix4(part.matrixWorld);
        const reach=s.dir*(tree.position.z-world.z);
        if(reach<=0)continue;
        // This sloping clearance plane also holds between vertices.
        const room=s.dir*tree.position.z-rear-.018+(world.y-.350)*.17;
        const knee=room*.55;
        if(reach<=knee)continue;
        const spread=room-knee;
        world.z=tree.position.z-s.dir*(knee+spread*(1-Math.exp(-(reach-knee)/spread)));
        world.applyMatrix4(inverse);pos.setXYZ(i,world.x,world.y,world.z);
      }
      g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    });
    tree.userData.stationClearance=s.id;
    break;
  }
}

const metal='#87938e',rail='#4b5755',stone='#a49b8c';
function shelter(s:Site){
  const {dir}=s,a=new StreetAssembly(),panels=new FacadePanels();
  const pose=(x:number,d:number,y:number):FacadePoint=>[x,y,trackAt(x,trackCenterlines[dir===1?0:1]).z+d*dir];
  const xyz=(p:FacadePoint)=>new THREE.Vector3(...p);
  function tube(p:FacadePoint,q:FacadePoint,r:number,color:string){
    const start=xyz(p),axis=xyz(q).sub(start),center=start.addScaledVector(axis,.5);
    const part=a.add(new THREE.CylinderGeometry(r,r,axis.length(),r>.007?10:6,1,true),color,center.x,center.y,center.z);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
    return part;
  }
  function top(x0:number,x1:number,d0:number,d1:number,y0:number,y1:number,ink:string){
    const v=pose(x0,d0,y0),w=pose(x0,d1,y0),p=pose(x1,d1,y1),q=pose(x1,d0,y1);
    panels.quad(v,w,p,q,ink);
  }
  const stages=[s.entry,s.low,s.ramp,s.high,s.end];
  const lip=.082,back=dir===1?.327:.325;
  for(let i=1;i<stages.length;i++){
    const lo=stages[i-1],hi=stages[i],y0=ground(s,lo),y1=ground(s,hi);
    const third=(back-lip)/3;
    // The tactile strip replaces one band of the high landing at the same grade.
    const bands=lo===s.high?[lip,lip+.002,lip+.027,lip+third,lip+2*third,back]:[lip,lip+third,lip+2*third,back];
    // Subdivide the surface beneath the soffit downlights so their small
    // pools survive baking without a per-fragment lamp array or extra draw.
    const pieces=Math.ceil(Math.abs(hi-lo)/.085);
    for(let n=0;n<pieces;n++){
      const x=lo+(hi-lo)*n/pieces,next=lo+(hi-lo)*(n+1)/pieces;
      for(let k=1;k<bands.length;k++)top(x,next,bands[k-1],bands[k],ground(s,x),ground(s,next),lo===s.high&&k===2?'#b5a065':stone);
    }
    for(const d of [lip,back]){
      const p=pose(lo,d,y0),q=pose(hi,d,y1),u=pose(hi,d,grade-.003),v=pose(lo,d,grade-.003);
      if(d===lip)panels.quad(p,q,u,v,'#938978');else panels.quad(v,u,q,p,'#928b80');
    }
  }
  const end=s.end,head=ground(s,end);
  panels.quad(pose(end,lip,head),pose(end,back,head),pose(end,back,grade-.003),pose(end,lip,grade-.003),'#968c7b');
  const lowLevel=curb,span=s.roof[1]-s.roof[0],bays=8,depth=canopyDepth;
  const roofY=(f:number)=>lowLevel+.273-.091*Math.pow(f,2.65);
  const shell=(u:number,f:number,drop=0):FacadePoint=>{
    // Roof ends are softly rounded in plan, evident at each open approach.
    const cut=(Math.abs(f-.5)>.33?.032*(Math.abs(f-.5)-.33)/.17:0)*dir;
    const x=s.roof[0]+span*u+cut*(1-2*u);
    return pose(x,s.lip+depth*f,roofY(f)-drop);
  };
  // A high, almost level track-facing lip curves down to the plaza. The
  // alternating narrow matte bays are visible in the city ortho.
  for(let b=0;b<24;b++)for(let j=0;j<7;j++){
    const u=b/24,v=(b+1)/24,f=j/7,g=(j+1)/7;
    panels.quad(shell(u,f),shell(u,g),shell(v,g),shell(v,f),b%2?'#b1afa0':'#c2c0af');
    panels.quad(shell(u,f,.004),shell(v,f,.004),shell(v,g,.004),shell(u,g,.004),b%2?'#8e8373':'#a09885');
    if(j===0)panels.quad(shell(u,f),shell(v,f),shell(v,f,.004),shell(u,f,.004),metal);
    if(j===6)panels.quad(shell(u,g,.004),shell(v,g,.004),shell(v,g),shell(u,g),metal);
    if(b===0)panels.quad(shell(u,f,.004),shell(u,g,.004),shell(u,g),shell(u,f),metal);
    if(b===23)panels.quad(shell(v,f),shell(v,g),shell(v,g,.004),shell(v,f,.004),metal);
  }
  const supports:number[]=[];
  for(let b=0;b<bays;b++){
    const u=(b+.5)/bays,x=s.roof[0]+span*u,d=s.lip+depth*.49;
    supports.push(x);
    const foot=ground(s,x),knee=pose(x,d,lowLevel+.184);
    tube(pose(x,d,foot),knee,.0117,metal);
    tube(pose(x,d,foot),pose(x,d,foot+.023),.0127,'#818983');
    const elbow=pose(x,d-.011,lowLevel+.207),head=pose(x,d-.033,roofY(.36)-.012);
    tube(knee,elbow,.0117,metal);tube(elbow,head,.0114,metal);
    for(let j=0;j<5;j++)tube(shell(u,j/5,.006),shell(u,(j+1)/5,.006),.0047,'#89908a');
    const at=shell(u,.35,.010);
    a.box(at[0],at[1],at[2],.016,.003,.006,'#e0d9bb').userData.signLight=[.50,.42,.29];
  }
  for(const x of supports.slice(1,5)){
    // The seating is in the column line, keeping the platform edge open.
    const p=pose(x+.054*dir,s.lip+depth*.52,curb);
    if((p[0]-s.ramp)*dir>0)continue;
    for(let j=0;j<3;j++)a.box(p[0],curb+.027,p[2]+dir*(j-1)*.008,.117,.003,.006,'#6f7b77');
    for(const dx of [-.041,.041]){
      a.box(p[0]+dx,curb+.013,p[2],.004,.026,.018,rail);
      const bottom=.0175,backrestBottom=.045-.011/2;
      a.box(p[0]+dx,curb+(bottom+backrestBottom)/2,p[2]+dir*.013,.004,backrestBottom-bottom,.003,rail);
    }
    a.box(p[0],curb+.045,p[2]+dir*.013,.117,.011,.003,'#78847d');
  }
  // Railings enclose the ramp sides. Leave the track-facing boarding end of
  // the high platform clear for the portable bridge plate.
  for(const d of [lip+.009,back-.009]){
    const start=s.ramp+.078*dir,finish=d<.13?s.high:s.end;
    for(let j=0;j<=5;j++){
      const x=start+(finish-start)*j/5,h=ground(s,x);
      tube(pose(x,d,h),pose(x,d,h+.061),.0024,rail);
      if(j>0){
        const last=start+(finish-start)*(j-1)/5;
        for(const rise of [.036,.061])tube(pose(last,d,ground(s,last)+rise),pose(x,d,h+rise),.0023,rail);
      }
    }
  }
  // Hanging painted medallions show the ferry bow beneath the circular legend.
  // The small double-sided signs face along the platform, as in the 2015 photograph.
  for(const i of [0,3,6]){
    const x=supports[i],d=s.lip+depth*.27,p=pose(x,d,.239),r=.024;
    tube(p,pose(x,s.lip+depth*.47,.239),.0021,metal);
    const disc=a.add(new THREE.CylinderGeometry(r,r,.0029,24),'#b4ad91',...p);disc.rotation.z=Math.PI/2;
    for(const facing of [-1,1]){
      const sideX=x+facing*.0016,g=new THREE.CircleGeometry(r*.95,24);
      a.add(g,'#345452',sideX,p[1],p[2]).rotation.y=facing*Math.PI/2;
      const mark=(u:number,v:number):FacadePoint=>[sideX+facing*.00035,p[1]+v,p[2]-u*facing];
      panels.triangle(mark(-.012,.002),mark(0,-.006),mark(.012,.002),'#d0bea0');
      panels.quad(mark(-.008,.003),mark(.008,.003),mark(.006,.007),mark(-.005,.007),'#c5b093');
      a.label('FERRY',sideX+facing*.0005,p[1]+.010,p[2],.0044,'#dfc49c',facing*Math.PI/2);
      a.label('TERMINAL',sideX+facing*.0005,p[1]-.013,p[2],.0034,'#dfc49c',facing*Math.PI/2);
    }
  }
  const panelMesh=panels.mesh(new THREE.MeshStandardMaterial({vertexColors:true}));
  panelMesh.geometry.userData.paintVertices=true;
  const shellAndFloor=a.add(panelMesh.geometry,'#ffffff',0,0,0);
  shellAndFloor.userData.uplight=(p:THREE.Vector3,n:THREE.Vector3)=>{
    if(n.y<.5||p.y>highFloor+.001)return 0;
    let nearest=Infinity;
    for(const x of supports){
      const z=pose(x,s.lip+.35*depth,0)[2];
      nearest=Math.min(nearest,(p.x-x)**2+(p.z-z)**2);
    }
    return .54*Math.exp(-nearest/.012);
  };
  return a.bake('Ferry Terminal wayside platform '+s.id);
}
export function addFerryMarketPlatforms(root:THREE.Group){
  for(const site of platforms)root.add(shelter(site));
}
