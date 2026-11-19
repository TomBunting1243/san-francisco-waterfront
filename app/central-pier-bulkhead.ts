import * as THREE from 'three';
import {entryX,apronStart,apronEnd,clearHalf,apronHalf,pierOneHalfFront as front} from './central-pier-access.ts';
export {pierOneHalfPassageHeight} from './central-pier-access.ts';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {footprintGeometry} from './sf-map.ts';
import {bakeRigidChunk} from './city-blocks.ts';

type XY=[number,number];
const cream='#d8c9af',stone='#c8baa1',cap='#e8dbc0',base='#a49b87',wood='#766951',iron='#495750',slate='#587071';
const cube=new THREE.BoxGeometry(1,1,1),inkPlane=new THREE.PlaneGeometry(1,1).rotateY(Math.PI);
const grade=.060;
const rect=(x:number,w:number,low:number,top:number):XY[]=>[[x-w/2,low],[x+w/2,low],[x+w/2,top],[x-w/2,top]];
function arc(x:number,w:number,spring:number,rise:number):XY[]{
  return Array.from({length:17},(_,i)=>[x+w/2*Math.cos(i*Math.PI/16),spring+rise*Math.sin(i*Math.PI/16)]);
}
const arch=(x:number,w:number,spring:number,rise:number):XY[]=>[[x-w/2,grade],[x+w/2,grade],...arc(x,w,spring,rise)];
const shape=(p:XY[])=>new THREE.Shape(p.map(([x,y])=>new THREE.Vector2(x,y)));

// OSM 25489470 is one outline containing the long bulkhead and BOTH wings.
// NPS Central Embarcadero Piers district, section 7 pp. 8–10; Port section 7
// pp. 141–143. SF 2024 orthophoto and USGS 2023 DSM locate the shed, canopy
// and pavilion. Piers 1½ and 3 share a single monumental street pavilion.
export function centralPierBulkhead(plan:number[][],font:Font){
  const root=new THREE.Group(),parts:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]=[],materials=new Map<string,THREE.MeshStandardMaterial>();
  const windows:{x:number;y:number;z:number;w:number;h:number;ry:number}[]=[];
  function part(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number){
    if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c}));
    const m=new THREE.Mesh(g,materials.get(c)!);m.position.set(x,y,z);parts.push(m);return m;
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,c:string){
    const m=part(cube,c,x,y,z);m.scale.set(w,h,d);return m;
  }
  function flat(x:number,y:number,z:number,w:number,h:number,c:string){
    const m=part(inkPlane,c,x,y,z);m.scale.set(w,h,1);return m;
  }
  function wall(p:XY[],holes:XY[][],z:number,depth:number,c:string){
    const face=shape(p);face.holes=holes.map(shape);
    return part(new THREE.ExtrudeGeometry(face,{depth,bevelEnabled:false}),c,0,0,z);
  }
  function sign(label:string,size:number,x:number,y:number,z:number){
    const g=new THREE.ShapeGeometry(font.generateShapes(label,size),2);
    g.computeBoundingBox();g.translate(-(g.boundingBox!.min.x+g.boundingBox!.max.x)/2,0,0);
    part(g,iron,x,y,z).rotation.y=Math.PI;
  }
  function room(x:number,w:number,low:number,high:number,z:number,door=false){
    // Mullions stand in front of the interior. A sill, side walls, warm back
    // panels and ceiling give the glass depth without transparent draw sorting.
    const back=z+.155,h=high-low;
    box(x,(low+high)/2,back,w+.008,h+.012,.017,slate);
    box(x,low+.006,z+.085,w,.012,.15,wood);
    box(x,high-.005,z+.085,w,.012,.15,'#b4a98b');
    for(const side of [-1,1])box(x+side*w*.49,(low+high)/2,z+.085,.011,h,.15,wood);
    flat(x-w*.24,low+h*.54,back-.017,w*.36,h*.70,'#a3987b');
    flat(x+w*.24,low+h*.30,back-.024,w*.36,h*.16,'#697364');
    box(x,(low+high)/2,z+.027,.009,h,.014,iron);
    box(x,low+h*(door?.74:.54),z+.026,w,.009,.016,wood);
    if(door){
      for(const side of [-1,1]){
        box(x+side*w*.25,low+.031,z+.03,w*.43,.06,.015,wood);
        box(x+side*.014,low+.075,z+.016,.005,.03,.009,cap);
      }
    }
    windows.push({x:x-w*.23,y:low+h*.55,z:back-.019,w:w*.30,h:h*.44,ry:Math.PI});
  }
  function archTrim(x:number,w:number,spring:number,rise:number,z:number,ring:number){
    const outer=arc(x,w+ring*2,spring,rise+ring),inner=arc(x,w,spring,rise);
    wall([...outer,...inner.reverse()],[],z-.024,.033,cap);
    for(const side of [-1,1])box(x+side*(w+ring)/2,(spring+grade)/2,z-.012,ring,spring-grade,.045,cap);
  }
  const left=plan[8][0],right=plan[0][0],pavilionLeft=plan[5][0],pavilionRight=plan[2][0];
  const pavilion=(pavilionLeft+pavilionRight)/2;
  function bay(lo:number,hi:number,kind:'pass'|'shop'|'lobby'|'pair'|'door'|'rail'){
    const w=hi-lo,x=(hi+lo)/2,z=front(x),h=.709,narrow=w<.35;
    const holes:XY[][]=[],high=kind==='rail',through=kind==='pass'||high;
    if(through||kind==='shop'||kind==='lobby'){
      const opening=w*(narrow?.69:.81),spring=high?.403:.277,rise=high?.131:.061;
      const openingShape=arch(x,opening,spring,rise);
      if(through){openingShape[0][1]=openingShape[1][1]=.019;}
      holes.push(openingShape);archTrim(x,opening,spring,rise,z,.020);
      if(through){
        for(const side of [-1,1])box(x+side*(opening+.018)/2,(grade+spring)/2,-1.46,.018,spring-grade,.61,stone);
        box(x,spring+rise+.016,-1.46,opening,.032,.61,stone);
      }else{
        room(x,opening,grade,spring,z+.051,kind==='lobby');
        wall([...arc(x,opening,spring,rise)],[],z+.086,.009,slate);
        for(const u of [-.67,-.33,0,.33,.67]){
          const top=spring+rise*Math.sqrt(1-u*u);
          box(x+u*opening/2,(top+grade)/2,z+.047,.009,top-grade,.011,wood);
        }
        if(kind==='lobby')sign('PIER 1 1/2',.034,x,.369,z-.006);
      }
    }else{
      const count=kind==='door'?1:2;
      for(let j=0;j<count;j++){
        const px=x+(j-(count-1)/2)*w*.36,ww=w*(count===1?.69:.29),bottom=kind==='door'?grade:.128;
        holes.push(rect(px,ww,bottom,.345));room(px,ww,bottom,.345,z+.024,kind==='door');
      }
    }
    if(!high){
      const count=narrow?2:4;
      for(let j=0;j<count;j++){
        const px=x+(j-(count-1)/2)*w*.77/count,ww=w*.54/count;
        holes.push(rect(px,ww,.456,.608));
        flat(px,.532,z+.063,ww,.152,slate);
        flat(px,.532,z+.046,ww,.008,wood);
        box(px,.451,z-.009,ww+.015,.012,.039,cap);
        if(j%2===0)windows.push({x:px,y:.564,z:z+.061,w:ww*.80,h:.060,ry:Math.PI});
      }
    }
    wall(rect(x,w+.001,through?0:grade-.005,h),holes,z,.049,cream);
    // Flat-roof wings share the cornice but have expressed bay piers and a stone base.
    box(x,h+.006,z+.297,w,.028,.595,stone);
    box(x,h-.019,z-.008,w,.030,.073,cap);
    box(x,h-.049,z-.005,w,.010,.052,base);
    for(const xx of [lo+.018,hi-.018]){
      box(xx,.373,z-.005,.037,.617,.039,stone);
      for(let y=.138;y<.646;y+=.072)flat(xx,y,z-.027,.039,.005,base);
    }
    if(!through)box(x,.382,-1.198,w,.642,.021,stone);
  }
  // The 2002 nomination counts seven south bays including the short bay
  // shared with Pier 1; the 2006 Port inventory groups it with the adjoining frontage.
  const south=[left,14.605,15.155,15.705,16.245,16.785,17.336,pavilionLeft];
  const kinds=['pass','shop','lobby','shop','pass','pair','door'] as const;
  kinds.forEach((k,i)=>bay(south[i],south[i+1],k));
  const north=[pavilionRight,19.405,20.050,20.705,right];
  (['door','pair','rail','pair'] as const).forEach((k,i)=>bay(north[i],north[i+1],k));
  const w=pavilionRight-pavilionLeft,z=front(pavilion)-.060,gate=.90,spring=.46,rise=.348;
  wall([[pavilionLeft,grade-.005],[pavilionRight,grade-.005],[pavilionRight,.854],[pavilion+.46,.854],
    [pavilion,.997],[pavilion-.46,.854],[pavilionLeft,.854]],[arch(pavilion,gate,spring,rise)],z,.165,cream);
  archTrim(pavilion,gate,spring,rise,z,.054);
  for(const side of [-1,1]){
    const x=pavilion+side*w*.423;
    wall([[x-.092,grade],[x+.092,grade],[x+.066,.844],[x-.066,.844]],[],z-.034,.114,stone);
    box(x,.857,z+.012,.20,.041,.16,cap);box(x,.117,z+.01,.202,.079,.151,base);
    const rake=box(pavilion+side*.23,.930,z+.014,.487,.023,.11,cap);rake.rotation.z=-side*.302;
  }
  sign('PIER 3',.066,pavilion,.838,z-.004);
  box(pavilion,1.155,z+.10,.009,.40,.009,base);
  room(pavilion,gate,grade,spring,z+.15,true);
  wall(arc(pavilion,gate,spring,rise),[],z+.156,.016,slate);
  for(let j=-3;j<=3;j++){
    const u=j/4,top=spring+rise*Math.sqrt(1-u*u);
    box(pavilion+gate*u*.5,(top+spring)/2,z+.146,.012,top-spring,.015,iron);
  }
  box(pavilion,.445,z+.144,gate,.027,.032,wood);
  box(pavilion,.734,-1.48,w,.053,.532,stone);
  wall([[pavilion-.55,.745],[pavilion+.55,.745],[pavilion+.55,.791],
    [pavilion,.921],[pavilion-.55,.791]],[],z+.10,.316,base);
  // Public cross passage joins the waiting-room breezeway. The solid upper
  // floor spans the route, leaving the pedestrian level open.
  box(15.54,.345,-1.067,2.95,.037,.259,'#958771');
  for(let x=14.20;x<16.86;x+=.42)box(x,.317,-1.065,.037,.025,.252,wood);
  // Slab carries the public passages where the old mapped solid formerly stood.
  const eastX=entryX+apronHalf,westX=entryX-apronHalf;
  const apronPlan=[...plan.slice(0,7),[eastX,front(eastX)],[eastX,apronEnd],
    [westX,apronEnd],[westX,front(westX)],...plan.slice(8)];
  part(footprintGeometry(apronPlan,.022),'#b3afa2',0,grade-.022,0);
  const ramp=new THREE.BufferGeometry(),v:number[]=[],idx:number[]=[];
  for(const u of [-apronHalf,-clearHalf,clearHalf,apronHalf]){
    for(const zz of [apronStart,apronEnd]){
      const outside=Math.abs(u)===apronHalf;
      v.push(entryX+u,zz===apronEnd&&!outside?grade:.031,zz);
    }
  }
  // Outer cheek splits follow the diagonal where the two slopes meet.
  idx.push(0,1,3,0,3,2, 2,3,4,3,5,4, 4,5,6,5,7,6);
  // Two small wedges at the inner corners finish flush with the full-width deck.
  for(const side of [-1,1]){
    const outer=entryX+side*apronHalf,inner=entryX+side*clearHalf,begin=v.length/3;
    v.push(outer,.031,apronEnd,outer,grade,apronEnd,inner,grade,apronEnd);
    idx.push(begin,begin+1,begin+2);
  }
  ramp.setAttribute('position',new THREE.Float32BufferAttribute(v,3));ramp.setIndex(idx);ramp.computeVertexNormals();
  part(ramp,'#bab1a0',0,0,0);
  for(const x of [left,right])box(x,.377,(front(x)-1.18)/2,.018,.635,-1.18-front(x),stone);
  // The OSM outline includes the breezeway canopy. Only the waiting room
  // itself reaches the wharf floor on the east side of the covered passage.
  const waiting=plan.slice(11,20).map(([x,z])=>[x,Math.max(-.905,z)]),shed=plan.slice(21,29);
  part(footprintGeometry(waiting,.360),'#c7bc9f',0,grade,0);
  part(footprintGeometry(shed,.663),'#abb3a9',0,grade,0);
  box(18.273,.775,.086,.43,.110,1.75,'#b8beb1');
  box(18.273,.836,.086,.49,.029,1.79,stone);
  function rearGlass(x:number,y:number,z:number,width:number,height:number){
    box(x,y,z,width,height,.014,slate);
    box(x,y,z+.011,.009,height,.012,wood);box(x,y+.014,z+.011,width,.009,.012,wood);
    windows.push({x:x-width*.25,y:y+.039,z:z+.009,w:width*.40,h:height*.21,ry:0});
  }
  box(15.30,.180,-.910,.184,.239,.018,wood);
  for(const x of [15.255,15.345]){
    box(x,.203,-.923,.076,.163,.009,slate);
    box(x,.221,-.931,.073,.007,.008,wood);
  }
  for(let i=0;i<5;i++)rearGlass(14.781+i*.245,.217,.58,.21,.259);
  for(let i=0;i<9;i++)for(const y of [.226,.524])rearGlass(17.29+i*.244,y,1.013,.190,.174);
  for(const [x,from,to,n,h] of [[14.65,-.57,.56,5,.21],[15.91,-.55,.56,5,.21],[17.164,-.52,.99,7,.49],[19.385,-.14,.99,5,.49]]){
    for(let j=0;j<n;j++){
      const zz=from+(j+.5)*(to-from)/n,side=x<14.7||Math.abs(x-17.164)<.01?-1:1;
      box(x+side*.006,h,zz,.015,.18,(to-from)/n*.79,slate);
      box(x+side*.016,h,zz,.011,.18,.009,wood);
    }
  }
  // Pier 1½'s white waterside canopy and outer tables appear on the 8 cm
  // 2024 city ortho. Preserve the outside PortWalk along both lateral aprons.
  box(15.28,.270,.829,1.12,.020,.482,'#eadfc9');
  for(const x of [14.737,15.821])for(const zz of [.618,1.043])box(x,.163,zz,.013,.206,.013,iron);
  for(const zz of [.815,1.17])for(const x of [14.91,15.26,15.61]){
    box(x,.111,zz,.064,.007,.060,'#b79972');box(x,.085,zz,.010,.052,.012,iron);
    for(const s of [-1,1]){
      const xx=x+s*.059;box(xx,.085,zz,.032,.006,.034,wood);
      box(xx+s*.015,.098,zz,.005,.030,.034,wood);box(xx,.072,zz,.014,.024,.020,iron);
    }
  }
  for(const mesh of parts)mesh.updateMatrixWorld();
  const batch=bakeRigidChunk('Historic Pier 1½ and 3 street front and bay wings',parts,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88}));
  const lights=[...south,...north];
  batch.userData.uplight=(p:THREE.Vector3,n:THREE.Vector3)=>{
    if(p.z>front(p.x)+.18||p.y<.095||n.y>.80)return 0;
    let edge=Infinity;for(const x of lights)edge=Math.min(edge,Math.abs(x-p.x));
    return Math.max(0,1-edge/.085)*(.27+.36*p.y);
  };
  root.add(batch);root.name='Pier 1½ and Pier 3';return {root,windows};
}
