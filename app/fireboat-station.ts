import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {ferryWalkLens} from './ferry-walk-lights.ts';
import {floatingFirehouse} from './fireboat-house.ts';
import type {buildingCharacter} from './building-character.ts';
import {footprintGeometry,sfMap} from './sf-map.ts';
import {staticBoxes} from './static-boxes.ts';
import {collectTidalParts,markTidalPart} from './tidal-berths.ts';
import {harborDatum,waterSurface} from './water-surface.ts';

type Building=Parameters<typeof buildingCharacter>[0];
type Point=[number,number];
type MeshFactory=(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number,parent:THREE.Group)=>THREE.Mesh;
const historic=sfMap.buildings.find(b=>b.id===104599984)!;
// The surveyed 173 × 96 ft float is a separate, anonymous pier polygon.
export const firehouseFloat=sfMap.piers.find(p=>p.closed&&p.p.some(([x,z])=>x===-44.787&&z===4.9))!;
const foot=.3048*.06,shore=harborDatum.pierDeck,floatTop=waterSurface.level+5*foot;
const steel='#909d9a',dark='#495c5c',timber='#796f5c';

export function fireboatStation(b:Building,font:Font,mesh:MeshFactory){
  const root=new THREE.Group(),floating=new THREE.Group();
  root.name='Pier 22½ firehouses and access';floating.name='Station 35 steel float';
  root.add(floating);markTidalPart(floating,'Pier 22½');
  const box=staticBoxes(mesh,root);
  const slab=mesh(footprintGeometry(firehouseFloat.p,9*foot-.006),'#46515a',0,floatTop-9*foot,0,floating);
  slab.name='Station 35 floating hull';
  mesh(footprintGeometry(firehouseFloat.p,.006),'#a6aaa1',0,floatTop-.006,0,floating);
  const windows=floatingFirehouse(b.p,floatTop,floating,mesh,font);

  // Four fixed 48-inch guide piles; the steel deck and collars travel vertically.
  const corners=firehouseFloat.p.slice(0,4);
  const cx=corners.reduce((s,p)=>s+p[0]/4,0),cz=corners.reduce((s,p)=>s+p[1]/4,0);
  for(const [px,pz] of corners){
    const x=cx+(px-cx)*.948,z=cz+(pz-cz)*.948;
    const radius=2*foot;
    mesh(new THREE.CylinderGeometry(radius,radius,1,12),dark,x,-.20,z,root).name='Fixed firehouse guide pile';
    mesh(new THREE.ConeGeometry(radius,.039,12),'#b5c0b8',x,.3195,z,root);
    const collar=mesh(new THREE.TorusGeometry(radius+.008,.008,4,12),steel,x,floatTop+.022,z,floating);
    collar.rotation.x=Math.PI/2;
  }

  // Pin and roller centers traced on the 2024 municipal orthophoto. Both decks
  // overlie their landings; the historic timber pier stays at promenade level.
  function gangway(name:string,land:Point,bay:Point,width:number){
    const group=new THREE.Group();group.name=name;root.add(group);
    const dx=bay[0]-land[0],dz=bay[1]-land[1],run=Math.hypot(dx,dz);
    group.position.set(land[0],shore,land[1]);group.rotation.y=Math.atan2(dx,dz);
    const dy=floatTop-shore,length=Math.hypot(run,dy);
    const deck=box(width,.021,length,0,dy/2-.008,run/2,'#b6b8aa',group);
    deck.rotation.x=-Math.atan2(dy,run);deck.name=name+' deck';
    for(const side of [-1,1]){
      const x=side*(width/2-.006),posts=Math.ceil(run/.18);
      for(let i=0;i<=posts;i++){
        const t=i/posts;box(.008,.068,.008,x,dy*t+.035,run*t,steel,group);
        if(width>.3&&i%3===1){
          box(.014,.011,.025,x-side*.005,dy*t+.055,run*t,dark,group);
          const lens=box(.009,.003,.019,x-side*.009,dy*t+.048,run*t,'#d7dad0',group);
          ferryWalkLens(lens,'Station 35 ramp guardrail downlight',.36,.58);
        }
      }
      for(const y of [.036,.069]){
        const rail=box(.009,.009,length,x,dy/2+y,run/2,steel,group);
        rail.rotation.x=deck.rotation.x;
      }
    }
    markTidalPart(group,'Pier 22½',land,bay);
  }
  gangway('Station 35 broad access ramp',[-45.77,-.24],[-45.60,1.76],.335);
  gangway('Station 35 aluminum gangway',[-44.65,.755],[-44.85,1.83],.082);

  // The open overlook occupies the point southwest of the vehicle ramp.
  const edge:Point[]=[[-46.35,-.79],[-46.32,-.13],[-45.99,-.17]];
  for(let i=1;i<edge.length;i++){
    const [x,z]=edge[i-1],[bx,bz]=edge[i],dx=bx-x,dz=bz-z,l=Math.hypot(dx,dz);
    const rail=box(.011,.011,l,(x+bx)/2,shore+.066,(z+bz)/2,steel);
    rail.rotation.y=Math.atan2(dx,dz);
    const n=Math.ceil(l/.19);
    for(let j=0;j<=n;j++)box(.008,.064,.008,x+dx*j/n,shore+.032,z+dz*j/n,steel);
  }
  const bench=box(.20,.02,.065,-46.19,shore+.029,-.40,timber);
  bench.rotation.y=-.24;
  const marker=box(.10,.055,.018,-46.23,shore+.082,-.29,'#768a88');marker.rotation.x=-.28;
  box(.018,.067,.018,-46.23,shore+.033,-.29,steel);

  // OSM way 104599984 is smaller than the district's background-building cutoff.
  // The front surveyed edge defines both the orientation and width of the 1915 house.
  const [right,,left]=historic.p;
  const w=Math.hypot(right[0]-left[0],right[1]-left[1]);
  const depth=Math.hypot(historic.p[4][0]-left[0],historic.p[4][1]-left[1]);
  const house=new THREE.Group();house.name='Historic Engine 35 firehouse';root.add(house);
  house.position.set((right[0]+left[0])/2,shore,(right[1]+left[1])/2);
  house.rotation.y=-Math.atan2(right[1]-left[1],right[0]-left[0]);
  const plaster='#e5e1d4',trim='#c7c6b7',frame='#596661',glass='#667c7c',red='#984b3d';
  box(w,.42,depth,0,.21,depth/2,plaster,house);
  box(w+.045,.022,depth+.045,0,.427,depth/2,'#806c59',house);
  // Shallow clay-tile hips surround the light central flat roof seen in the ortho.
  const lower=[[-w/2-.026,-.025],[w/2+.026,-.025],[w/2+.026,depth+.025],[-w/2-.026,depth+.025]];
  const top=lower.map(([x,z])=>[x*.83,depth/2+(z-depth/2)*.70]);
  const roof:number[]=[];
  for(let i=0;i<4;i++){
    const next=(i+1)%4;
    for(const [ring,k,h] of [[lower,i,.438],[top,i,.50],[lower,next,.438],[lower,next,.438],[top,i,.50],[top,next,.50]] as const)
      roof.push(ring[k][0],h,ring[k][1]);
  }
  const hips=new THREE.BufferGeometry();hips.setAttribute('position',new THREE.Float32BufferAttribute(roof,3));hips.computeVertexNormals();
  mesh(hips,'#a3694b',0,0,0,house);
  box(top[1][0]-top[0][0],.009,top[2][1]-top[1][1],0,.497,depth/2,'#c4c5b8',house);

  // Paired casements and the divided, red apparatus doors face the Embarcadero.
  function windowBay(x:number,y:number,z:number,reverse=false){
    const facing=reverse?1:-1;
    box(.13,.105,.014,x,y,z,trim,house);
    box(.115,.09,.012,x,y,z+facing*.008,glass,house);
    box(.009,.09,.006,x,y,z+facing*.016,frame,house);
    box(.115,.006,.006,x,y+.009,z+facing*.016,frame,house);
  }
  for(const [z,reverse] of [[0,false],[depth,true]] as const){
    for(const x of [-.40,-.20,0,.20,.40])windowBay(x,.336,z,reverse);
    for(const x of [-.40,.40])windowBay(x,.146,z,reverse);
    if(reverse){
      box(.083,.165,.020,0,.084,z,frame,house);
      box(.060,.048,.026,0,.124,z,glass,house);
      continue;
    }
    for(const x of [-.085,.085]){
      box(.164,.179,.019,x,.092,z,red,house);
      box(.126,.049,.025,x,.134,z,glass,house);
    }
  }
  for(const side of [-1,1])for(const z of [depth*.26,depth*.74])for(const y of [.15,.33])
    box(.014,.089,.104,side*(w/2+.001),y,z,glass,house);
  for(const [label,x,height,size] of [['SFFD',0,.239,.045],['ENGINE 35',-.30,.22,.024],['FIREBOAT 1',.30,.22,.024]] as const){
    const sign=new TextGeometry(label,{font,size,depth:.002,curveSegments:2});
    sign.computeBoundingBox();sign.translate(-sign.boundingBox!.max.x/2,0,0);
    const letters=mesh(sign,red,x,height,-.012,house);letters.rotation.y=Math.PI;
  }
  collectTidalParts(root);
  return {root,windows};
}
