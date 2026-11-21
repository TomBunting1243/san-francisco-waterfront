import * as THREE from 'three';
import {northWaterfrontGrade} from './north-quay-grade.ts';
import {addPlazaStreetLights} from './plaza-street-lights.ts';
import fixtures from '../public/data/promenade-lights.json' with {type:'json'};
import gradeData from '../public/data/promenade-light-grades.json' with {type:'json'};
const grades:Record<string,number>=gradeData;

const units=.06;
const iron='#37626c',cast='#427580',pierIron='#435555',cap='#6c6760',lens='#ebdcc2';
type Profile=[number,number][];

// The PUC records fluted steel poles, not head counts. SF General Plan 10.15
// specifies pairs between Pier 1 and Agriculture and singles outside. See
// https://generalplan.sfplanning.org/NE_Waterfront.htm and the curb photograph
// https://images.trvl-media.com/place/6151863/d85a7ab5-ebde-4738-b480-288445a8df95.jpg
// Pier 7's straight iron standards carry individual capped upright lanterns:
// https://www.afar.com/places/pier-7-san-francisco
// 2023 USGS 1.5 m first returns cluster at 5.5–5.6, 7.1–7.3 and 3.7–3.8 m
// above the respective curb or deck. Collar, bracket and globe profiles are
// estimated from the photographs. All returned halos use actual lens centers.
export function buildPromenadeLighting(root:THREE.Group):number[]{
  const positions:number[]=[],colors:number[]=[],indices:number[]=[],halos:number[]=[],glassLight:number[]=[];
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.76});
  const palette=new Map<string,THREE.Color>();
  let ox=0,oz=0,ground=0,cos=1,sin=0;
  function setOrigin(x:number,z:number,y:number,azimuth:number){
    ox=x;oz=z;ground=y;cos=Math.cos(azimuth);sin=Math.sin(azimuth);
  }
  function position(u:number,h:number,v:number):[number,number,number]{
    const x=ox+units*(cos*u+sin*v);
    // Two cast feet straddle the transition to the northern quay. Fit the
    // bottom course to its incline while the column and lantern stay plumb.
    const foot=h===0&&ox>35&&ox<36?northWaterfrontGrade(x)-northWaterfrontGrade(ox):0;
    return [x,ground+h*units+foot,oz+units*(-sin*u+cos*v)];
  }
  function vertex(u:number,h:number,v:number,tone:string){
    let color=palette.get(tone);
    if(!color){color=new THREE.Color(tone);palette.set(tone,color);}
    positions.push(...position(u,h,v));colors.push(color.r,color.g,color.b);
    glassLight.push(...(tone===lens?[230,153,75]:[0,0,0]));
  }
  // Hollow rotational profiles share each ring of indexed vertices. Radius and
  // height are in metres; a horizontal offset at each ring shapes curved arms.
  function rings(profile:Profile,tone:string,sides:number,offset:(height:number)=>number=()=>0){
    const first=positions.length/3;
    for(let j=0;j<profile.length;j++){
      const [h,r]=profile[j],cx=offset(h);
      for(let i=0;i<sides;i++){
        const a=i*2*Math.PI/sides;
        vertex(cx+Math.cos(a)*r,h,Math.sin(a)*r,tone);
        if(j===0)continue;
        const k=first+(j-1)*sides+i,next=first+(j-1)*sides+(i+1)%sides;
        indices.push(k,k+sides,next,next,k+sides,next+sides);
      }
    }
  }
  function lantern(cx:number,top:number,pier:boolean){
    const scale=pier?.82:1,base=top-.83*scale,at=()=>cx;
    const section=(profile:Profile,tone:string)=>rings(profile.map(([h,r])=>[base+h*scale,r*scale]),tone,6,at);
    section([[0,.095],[.065,.115],[.18,.137]],pier?pierIron:cast);
    section([[.18,.125],[.56,.204],[.64,.191]],lens);
    section([[.64,.194],[.68,.214],[.76,.090],[.77,.033],[.83,0]],pier?pierIron:cap);
    // Four narrow face bars follow the swell of the glass bowl.
    for(let k=0;k<4;k++){
      const a=Math.PI/4+k*Math.PI/2,start=positions.length/3;
      for(const [h,r] of [[.18,.127],[.35,.174],[.56,.206],[.64,.193]]){
        for(const side of [-.032,.032])vertex(cx+Math.cos(a+side)*r*scale,base+h*scale,Math.sin(a+side)*r*scale,pier?pierIron:cap);
      }
      for(let j=0;j<3;j++){const i=start+j*2;indices.push(i,i+2,i+1,i+1,i+2,i+3);}
    }
    halos.push(...position(cx,base+.43*scale,0));
  }
  function pedestal(pier:boolean,height:number){
    const tone=pier?pierIron:iron;
    if(pier)rings([[0,.20],[.09,.20],[.10,.16]],'#aba494',6);
    rings([[pier?.09:0,.22],[.23,.22],[.36,.151],[.68,.133],[.73,.15],[.83,.096],
      [height-.08,.072],[height-.045,.105],[height,.088]],tone,8);
    if(!pier){
      // Narrow raised ribs on the fluted lower pedestal, visible at street level.
      for(let k=0;k<8;k++){
        const a=k*Math.PI/4,base=positions.length/3;
        for(const [h,r] of [[.29,.171],[.37,.151],[.63,.133]]){
          for(const t of [-.06,.06])vertex(Math.cos(a+t)*(r+.009),h,Math.sin(a+t)*(r+.009),cast);
        }
        indices.push(base,base+2,base+1,base+1,base+2,base+3,base+2,base+4,base+3,base+3,base+4,base+5);
      }
    }
  }
  // The city bake assigns whole source meshes to spatial tiles. Keep each
  // pole's bounds local so a close view of Pier 7 can cull the bridge end.
  function finish(name:string){
    const geometry=new THREE.BufferGeometry();
    geometry.setIndex(indices);geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setAttribute('signLight',new THREE.Uint8BufferAttribute(glassLight,3,true));
    geometry.computeVertexNormals();geometry.userData.paintVertices=true;
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;
    root.add(mesh);positions.length=colors.length=indices.length=glassLight.length=0;
  }
  // SFPUC gives plan positions. Pin the complete fixture and its halo to the
  // local gutter, sidewalk or terrain sampled by survey-promenade-light-grades.
  for(const row of [fixtures.curb,fixtures.inland])for(const [id,x,z,yaw,heads] of row){
    setOrigin(x,z,grades[id]??.045,yaw);
    if(heads===1){pedestal(false,5.55-.83);lantern(0,5.55,false);finish('Single fluted promenade light');continue;}
    pedestal(false,6.36);
    rings([[6.36,.080],[6.42,.09],[6.50,.042],[6.62,0]],iron,8);
    for(const side of [-1,1]){
      const bend=(h:number)=>side*.37*Math.sin(Math.min(1,(h-5.71)/.55)*Math.PI/2);
      rings([[5.71,.052],[5.87,.058],[6.04,.055],[6.17,.050],[6.27,.067],[6.32,.085]],cast,7,bend);
      lantern(side*.37,7.15,false);
    }
    finish('Twin Ferry promenade light');
  }
  for(const [z,left,right] of fixtures.pier){
    for(const x of [left,right]){
      setOrigin(x,z,.060,0);pedestal(true,3.8-.83*.82);lantern(0,3.8,true);finish('Pier 7 iron lantern');
    }
  }
  // These five active SFPUC traction-pole pins carry twin acorns in the
  // HALS 2021 survey. The bronze plaza floods are a separate installation.
  // Mount the crossarm transversely as drawn on sheet 4.
  for(const [x,z,yaw] of [[.8039,-6.2693,0],[1.8534,-6.1706,-.10],
    [2.9043,-6.0028,-.19],[3.9791,-5.7823,-.20],[5.0524,-5.5607,-.20]]){
    setOrigin(x,z,.045,yaw+Math.PI/2);
    rings([[0,.16],[.16,.16],[.22,.105],[6.36,.078],[6.44,.080]],iron,8);
    for(const side of [-1,1]){
      const offset=(h:number)=>side*.49*Math.min(1,(h-5.89)/.42);
      rings([[5.89,.05],[6.10,.048],[6.32,.072]],cast,6,offset);
      lantern(side*.49,7.15,false);
    }
    finish('Plaza traction standard with twin acorns');
  }
  addPlazaStreetLights(root,halos);
  // Steuart's two SL-FluteSteel inventory points carry single upright
  // lanterns, distinct from the neighboring SL-StdSteel roadway masts.
  // Their supporting sidewalk and gutter were sampled on the final city mesh.
  for(const [id,x,z,y] of [[283133,-25.5965,-5.6721,.031],[283134,-27.074,-6.3699,.045]]){
    setOrigin(x,z,y,0);pedestal(false,5.55-.83);lantern(0,5.55,false);
    finish('Rincon fluted SFPUC '+id);
  }
  return halos;
}
