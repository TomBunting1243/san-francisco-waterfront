import * as THREE from 'three';
import {curbRuns} from './curb-survey.ts';
import {setPackedNormals} from './packed-normals.ts';

type P=[number,number,number];
type Section=[number,number,number,number]; // axle direction, bottom, top, half width (metres)
const C=.988686,S=.150004,metre=.06;
const world=(u:number,y:number,v:number):P=>[-25.894+C*u+S*v,y,-12.650-S*u+C*v];
const pixel=(u:number)=>(u-300)/200;
const asphalt=.031,curb=-.425;
// At this station the transition into the corner swivels the surveyed
// gutter normals slightly. Intersect the actual two toe vertices.
const curbPath=curbRuns.find(([id])=>id===3801021)![2];
const toeLine=curbPath.slice(1,3).map(([x,z,nx,nz])=>{
  const dx=x+.037*nx+25.894,dz=z+.037*nz+12.650,unit=C*C+S*S;
  return [(C*dx-S*dz)/unit,(S*dx+C*dz)/unit];
});
function toeAt(v:number){
  const [[a,start],[b,end]]=toeLine;
  return a+(b-a)*(v-start)/(end-start);
}
const gutter=(u:number)=>.0315+.0005*(u-curb-.0023)/(.037-.0023);
const grade=(u:number,v:number)=>u<toeAt(v)?gutter(u):asphalt;
// SF 2024 RGB 8 cm, 600 × 2800 rectification centred on Howard/Spear.
// Several ticks start partway out from the gutter. The last ends at the
// independently traced eastbound stop bar. Each interval is about 1.07 m.
const marks=[
  [1081,227,243],[1094,229,243],[1107,230,243],[1120,229,243],[1133,219,243],
  [1146,221,243],[1159,231,243],[1171,219,243],[1184,219,243],[1197,219,243],[1210,219,239.8],
];
// Five powered two-wheelers, including a silver step-through, are visible in
// Brett Norman's December 2022 Spear/Howard photographs. Individual contours,
// paint and occupied stall choices are interpretations. No branded vehicles.
const occupants=[
  {slot:0,kind:'standard',wheelbase:1.42,r:.32,angle:-.06,tank:'#833b33'},
  {slot:3,kind:'tourer',wheelbase:1.51,r:.33,angle:.045,tank:'#414d56'},
  {slot:5,kind:'roadster',wheelbase:1.41,r:.315,angle:-.045,tank:'#384d48'},
  {slot:7,kind:'cruiser',wheelbase:1.57,r:.325,angle:.03,tank:'#4d4641'},
  {slot:9,kind:'scooter',wheelbase:1.29,r:.253,angle:-.06,tank:'#b8bfbd'},
];
const steel='#929b9a',alloy='#bbc0b9',frame='#424a49',rubber='#282c2d',saddle='#373330';
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.77});

/** One static opaque mesh for the ten-space bank, its painted dividers and five vehicles. */
export function addHowardParking(root:THREE.Group){
  const xyz:number[]=[],rgb:number[]=[],indices:number[]=[];
  const pigments=new Map<string,THREE.Color>();
  function vertex(p:P,ink:string){
    let color=pigments.get(ink);if(!color){color=new THREE.Color(ink);pigments.set(ink,color);}
    rgb.push(color.r,color.g,color.b);xyz.push(...p);return xyz.length/3-1;
  }
  function quad(a:number,b:number,c:number,d:number){indices.push(a,b,c,a,c,d);}
  for(const [y,left,right] of marks){
    const u0=pixel(left),u1=pixel(right),v=(y-1400)/200;
    for(const onGutter of [true,false]){
      const corner=(edge:number,offset:number)=>{
        const station=v+offset,toe=toeAt(station);
        const u=onGutter?Math.min(edge,toe):Math.max(edge,toe);
        return vertex(world(u,(onGutter?gutter(u):asphalt)+.00024,station),'#dedbd0');
      };
      if(onGutter?u0>=toeAt(v):u1<=toeAt(v))continue;
      quad(corner(u0,-.005),corner(u0,.005),corner(u1,.005),corner(u1,-.005));
    }
  }
  const paintVertices=xyz.length/3;
  for(const {slot,kind,wheelbase,r,angle,tank} of occupants){
    const ca=Math.cos(angle),sa=Math.sin(angle),midU=-.348;
    const midV=((marks[slot][0]+marks[slot+1][0])*.5-1400)/200;
    const rear=-wheelbase/2,front=wheelbase/2;
    const yBack=grade(midU+ca*metre*rear,midV+sa*metre*rear),yFront=grade(midU+ca*metre*front,midV+sa*metre*front);
    function point(x:number,h:number,z:number):P{
      // The two axle contact heights define one rigid pitch. A small lean
      // towards the side stand keeps both tire contact patches on the surface.
      const lateral=z-h*.060;
      return world(midU+metre*(ca*x-sa*lateral),yBack+(yFront-yBack)*(x-rear)/wheelbase+h*metre,
        midV+metre*(sa*x+ca*lateral));
    }
    function loft(sections:Section[],ink:string,lateral=0){
      const first=xyz.length/3;
      for(const [x,b,t,w] of sections){
        const y=(t-b)*.20;
        for(const [h,z] of [[b,-w*.62],[b,w*.62],[b+y,w],[t-y,w],[t,w*.65],[t,-w*.65],[t-y,-w],[b+y,-w]]){
          vertex(point(x,h,z+lateral),ink);
        }
      }
      const end=first+8*(sections.length-1);
      for(let j=0;j<8;j++){
        const k=(j+1)%8;
        for(let n=first;n<end;n+=8)quad(n+j,n+j+8,n+k+8,n+k);
        if(j>0&&j<7)indices.push(first,first+j,first+k,end,end+k,end+j);
      }
    }
    function tube(a:P,b:P,radius:number,ink:string,facets=5){
      const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),axis=q.clone().sub(p).normalize();
      const n=new THREE.Vector3().crossVectors(axis,Math.abs(axis.y)>.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).normalize();
      const m=axis.clone().cross(n),start=xyz.length/3;
      for(const center of [p,q])for(let j=0;j<facets;j++){
        const t=j*2*Math.PI/facets;
        const v=center.clone().addScaledVector(n,radius*Math.cos(t)).addScaledVector(m,radius*Math.sin(t));
        vertex(point(v.x,v.y,v.z),ink);
      }
      for(let j=0;j<facets;j++){
        const k=(j+1)%facets;
        quad(start+j,start+k,start+k+facets,start+j+facets);
        if(j>0&&j<facets-1)indices.push(start,start+k,start+j,start+facets,start+facets+j,start+facets+k);
      }
    }
    for(const x of [rear,front]){
      const base=xyz.length/3,N=16;
      // Axial tire section continues into the visible alloy rim and open hub.
      const profile=[[r,0],[r-.014,.065],[r-.058,.084],[r-.070,.063],
        [r-.081,.058],[r-.081,-.058],[r-.070,-.063],[r-.058,-.084],[r-.014,-.065]];
      for(let j=0;j<N;j++){
        const a=2*Math.PI*j/N;
        for(const [k,[radius,lateral]] of profile.entries()){
          vertex(point(x+radius*Math.sin(a),r-radius*Math.cos(a),lateral),k>=3&&k<=6?alloy:rubber);
        }
      }
      const count=profile.length;
      for(let j=0;j<N;j++)for(let k=0;k<count;k++){
        const a=base+j*count,b=base+(j+1)%N*count,kk=(k+1)%count;
        quad(a+k,b+k,b+kk,a+kk);
      }
      tube([x,r,-.105],[x,r,.105],.064,steel,8);
      for(let j=0;j<5;j++){
        const a=j*2*Math.PI/5+.16;const radius=r-.073;
        tube([x,r,0],[x+radius*Math.sin(a),r+radius*Math.cos(a),0],.022,alloy,4);
      }
    }
    const scooter=kind==='scooter',cruiser=kind==='cruiser',tourer=kind==='tourer';
    const top=scooter?.88:cruiser?.91:.96;
    for(const side of [-1,1]){
      tube([front,r,side*.092],[front-.19,top,side*.092],.027,alloy);
      tube([rear,r,side*.108],[-.13,.43,side*.108],.037,frame);
    }
    // A short curved fender leaves daylight around the open front wheel.
    const guard=xyz.length/3;
    for(let j=0;j<=6;j++){
      const a=(-75+j*25)*Math.PI/180;
      for(const [radius,z] of [[r+.025,-.083],[r+.047,-.054],[r+.047,.054],[r+.025,.083]]){
        vertex(point(front+radius*Math.sin(a),r+radius*Math.cos(a),z),cruiser?alloy:tank);
      }
      if(j)for(let k=0;k<3;k++){
        const n=guard+4*j+k;quad(n-4,n-3,n+1,n);
      }
    }
    if(scooter){
      // Floorboard and front leg shield are separated from the rear shell by
      // an open knee space. The headset sits above the shield on the stem.
      loft([[rear-.14,.37,.65,.15],[rear+.08,.31,.74,.23],[-.27,.27,.71,.21],[-.17,.27,.46,.15]],tank);
      loft([[-.25,.25,.32,.18],[.35,.25,.32,.18]],'#606767');
      loft([[.26,.28,.39,.16],[.35,.28,.62,.22],[.43,.36,.87,.20],[.49,.57,.89,.14]],tank);
      loft([[rear-.04,.70,.765,.15],[-.52,.715,.79,.20],[-.22,.66,.75,.17]],saddle);
      loft([[.36,.92,1.03,.14],[.50,.90,1.02,.17],[.55,.92,1.00,.12]],tank);
    }else{
      tube([rear+.04,.55,0],[.35,.76,0],.043,frame);
      tube([.35,.76,0],[.15,.31,0],.043,frame);
      loft([[-.26,.31,.56,.17],[-.07,.26,.63,.185],[.17,.31,.56,.16]],'#737978');
      // Transverse fins catch the light on both exposed cylinder heads.
      for(const y of [.44,.49,.54])loft([[-.18,y,y+.019,.191],[.14,y,y+.019,.181]],frame);
      loft([[-.21,.59,.71,.13],[0,.57,cruiser?.79:.85,.235],[.23,.61,cruiser?.80:.86,.205],[.36,.67,.76,.12]],tank);
      loft([[rear-.12,.59,.68,.105],[rear+.06,.62,.75,.17],[-.38,.59,.72,.165],[-.16,.61,.68,.12]],saddle);
      tube([-.69,.34,.168],[-.19,.32,.18],.065,tourer?frame:steel,7);
      tube([-.19,.32,.18],[.13,.41,.16],.035,steel);
      if(tourer)for(const z of [-.205,.205]){
        loft([[rear-.11,.405,.64,.072],[rear+.21,.39,.65,.085]],'#555d63',z);
      }
    }
    if(tourer){
      loft([[.37,.79,.95,.20],[.48,.77,1.01,.225],[.58,.78,.91,.155]],tank);
      loft([[.37,1.00,1.24,.142],[.48,.96,1.025,.175]],'#718787');
    }else if(kind==='roadster'){
      loft([[.34,.74,.875,.155],[.48,.73,.84,.18],[.57,.75,.80,.095]],tank);
    }
    const steer=front-.18;
    tube([steer,top-.12,0],[steer-.035,top+.13,0],.035,frame);
    for(const side of [-1,1]){
      tube([steer-.035,top+.09,0],[steer-.13,top+.13,side*.32],.019,steel);
      tube([steer-.13,top+.13,side*.26],[steer-.15,top+.13,side*.36],.032,rubber);
      tube([steer-.09,top+.13,side*.20],[steer-.045,top+.32,side*.29],.011,steel,4);
      tube([steer-.069,top+.325,side*.295],[steer-.042,top+.325,side*.295],.059,'#838f93',8);
    }
    const lightX=scooter?.53:steer+.06,lightY=scooter?.965:top-.045;
    tube([lightX-.07,lightY,0],[lightX,lightY,0],scooter?.072:.102,frame,10);
    tube([lightX,lightY,0],[lightX+.015,lightY,0],scooter?.065:.092,'#d6d3b6',10);
    tube([rear-.09,.60,0],[rear-.12,.60,0],.046,'#823e32',7);
    const groundAtStand=(asphalt-yBack-(yFront-yBack)*(-.21-rear)/wheelbase)/metre;
    tube([-.10,.31,-.13],[-.21,groundAtStand+.020,-.245],.018,steel,4);
    loft([[-.24,groundAtStand+.001,groundAtStand+.017,.020],[-.18,groundAtStand+.001,groundAtStand+.017,.024]],steel,-.245);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
  const exposure=new Uint8Array(xyz.length/3);exposure.fill(1,0,paintVertices);
  g.setAttribute('roadExposure',new THREE.BufferAttribute(exposure,1));
  g.setIndex(indices);setPackedNormals(g);g.userData.paintVertices=true;
  const bank=new THREE.Mesh(g,material);bank.name='Howard motorcycle parking';bank.castShadow=bank.receiveShadow=true;
  root.add(bank);return bank;
}
