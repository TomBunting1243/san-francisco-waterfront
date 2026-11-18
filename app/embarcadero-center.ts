import * as THREE from 'three';
import {insideBuilding} from './building-character.ts';
import {footprintGeometry} from './sf-map.ts';
import {waterfrontTree} from './waterfront-trees.ts';

type Point=number[];
type Tower={id:number;parent?:number;p:Point[];h:number;minH?:number};
type Area={id:number;kind:string;p:Point[]};
type BridgePath={id:number;p:Point[]};
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};

export const centerTowerIds=new Set([32612608,32612520,32612538,616812910]);
export const centerLobby=.49;
export const centerPromenade=.82;
const street=.075;
const precast='#c9c0ac', fascia='#dcd2bd', shade='#a49987', glass='#486269', bronze='#706f5f';
const brick='#a48671', mosaic='#c2af96', coping='#cfc5ad';

// Local u runs Battery to Drumm and v runs Clay to Sacramento. The reference
// corners and crossing lines are already surveyed in waterfront-landscape.json.
// Retail envelopes, voids and vertical circulation are traced at city-model
// detail from the owner’s Street, Lobby and Promenade plans (pp. 3–5):
// https://embarcaderocenter.com/wp-content/uploads/Brochure_Embarcadero-Center_47v3.pdf
// Concrete, railing and paving materials: https://portmanarchitects.com/project/embarcadero-center/
const blocks=[
  {id:32612730,origin:[17.934,-30.812],w:4.96,d:4.98,void:[1.38,2.82,3.56,4.81],stair:[.49,2.94],r:.34,
    street:[[.17,.12,2.04,2.05],[2.31,.14,4.82,1.97],[.21,3.12,1.18,4.76],[3.82,3.02,4.82,4.75]],
    lobby:[[.16,.31,1.83,2.18],[2.63,.19,4.82,1.97],[.22,3.46,1.26,4.82],[3.78,3.25,4.75,4.78]],
    upper:[[.13,.29,4.81,2.10],[.19,3.49,1.22,4.73],[3.78,3.47,4.71,4.73]],
    beds:[[.38,2.10,1.24,2.33],[3.59,2.11,4.21,2.35]],trees:[[.58,2.22,.49],[1.00,2.22,.44],[3.92,2.23,.65]]},
  {id:32612628,origin:[15.275,-25.043],w:5.13,d:5.20,void:[1.81,3.43,3.28,5.19],stair:[4.39,3.58],r:.35,
    street:[[.11,.14,4.89,2.31],[.20,3.35,1.68,4.99],[3.59,4.02,4.77,4.93]],
    lobby:[[.14,.16,4.94,2.33],[.14,3.49,1.64,5.03],[3.49,4.12,4.71,4.85]],
    upper:[[.13,.17,4.91,2.13],[.15,3.55,1.62,5.02],[3.69,4.27,4.76,4.96]],
    beds:[[.37,2.37,1.20,2.62],[1.80,2.51,2.38,2.77],[3.20,2.39,4.09,2.62]],trees:[[.68,2.50,.68],[2.11,2.64,.56],[3.63,2.51,.64]]},
  {id:32612692,origin:[12.388,-19.771],w:5.33,d:4.90,void:[2.03,3.42,3.47,4.86],stair:[.62,3.64],r:.34,
    street:[[.16,.14,5.13,2.31],[.21,4.11,1.77,4.73],[3.54,3.15,5.12,4.72]],
    lobby:[[.15,.15,5.16,2.32],[.17,3.98,1.64,4.75],[3.49,3.49,5.15,4.75]],
    upper:[[.21,.14,5.14,2.06],[.21,3.97,1.69,4.70],[3.54,3.39,5.13,4.69]],
    beds:[[.30,2.18,1.06,2.39],[1.42,2.42,2.11,2.68],[3.45,2.34,4.23,2.64]],trees:[[.67,2.30,.65],[1.68,2.54,.78],[3.78,2.48,.56]]},
  {id:32612700,origin:[9.278,-13.552],w:3.94,d:5.55,rotunda:[2.02,3.68],r:.52,stair:[.40,3.10],stairRadius:.30,
    street:[[.16,.13,3.79,2.16],[.14,3.26,1.46,4.83],[2.78,3.21,3.80,5.17],[3.79,4.53,4.63,5.36]],
    lobby:[[.13,.15,3.76,2.17],[.18,3.28,1.43,4.80],[2.73,3.21,3.79,5.16],[3.77,4.49,4.63,5.34]],
    upper:[[.15,.14,3.76,2.12],[.15,3.29,1.42,4.75],[2.72,3.21,3.79,5.11],[3.77,4.48,4.51,5.34]],
    beds:[[.60,2.21,1.20,2.40],[2.47,2.27,3.28,2.49],[4.13,5.06,4.51,5.25]],trees:[[.91,2.31,.55],[2.89,2.37,.56],[4.38,5.16,.58]]},
] as const;
type Block=(typeof blocks)[number];

function frame(block:Block,u:number,v:number):Point{
  return [block.origin[0]-.454*u-.891*v,block.origin[1]+.891*u-.454*v];
}
function rectangle(block:Block,[a,b,c,d]:readonly number[]){
  return [frame(block,a,b),frame(block,c,b),frame(block,c,d),frame(block,a,d),frame(block,a,b)];
}
function makeBuilder(){
  const root=new THREE.Group(),materials=new Map<string,THREE.MeshStandardMaterial>();
  function mesh(g:THREE.BufferGeometry,color:string,x=0,y=0,z=0,parent:THREE.Object3D=root){
    if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.88}));
    const object=new THREE.Mesh(g,materials.get(color)!);
    object.position.set(x,y,z);object.castShadow=object.receiveShadow=true;
    parent.add(object);return object;
  }
  const unitBox=new THREE.BoxGeometry();
  function box(w:number,h:number,d:number,x:number,y:number,z:number,color:string,parent:THREE.Object3D=root){
    // The city bake disposes source geometries only after copying every mesh.
    const object=mesh(unitBox,color,x,y,z,parent);object.scale.set(w,h,d);return object;
  }
  function bar(a:Point,b:Point,y:number,w:number,h:number,color:string,parent:THREE.Object3D=root){
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length<.001)return;
    const object=box(w,h,length,(a[0]+b[0])/2,y,(a[1]+b[1])/2,color,parent);
    object.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);return object;
  }
  return {root,mesh,box,bar};
}

function circle([x,z]:Point,r:number,count=32){
  return Array.from({length:count+1},(_,i)=>[x+r*Math.cos(i*2*Math.PI/count),z+r*Math.sin(i*2*Math.PI/count)]);
}
function slabGeometry(points:Point[],holes:Point[][],depth:number){
  const path=(ring:Point[])=>ring.map(([x,z])=>new THREE.Vector2(x,-z));
  const shape=new THREE.Shape(path(points.slice(0,-1)));
  for(const hole of holes)shape.holes.push(new THREE.Path(path(hole.slice(0,-1))));
  return new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}).rotateX(-Math.PI/2);
}

// Mapped paths spanning Front, Davis and Drumm, plus the Clay Street spur to
// Maritime Plaza and the Four-to-Hyatt link beside the Tulip. Davis has a
// separate north-side upper crossing. Street boundaries are never closed off.
const crossingLevels=new Map<number,readonly [number,number,string]>([
  [48211281,[centerLobby,.55,'Front Street']],
  [48211293,[centerLobby,.49,'Davis Street']],
  [944870402,[centerPromenade,.48,'Davis Street upper']],
  [944870404,[centerPromenade,.46,'Davis Street south']],
  [27146047,[centerLobby,.54,'Drumm Street']],
  [727134923,[centerLobby,.43,'Clay Street to Maritime Plaza']],
  [132121553,[centerLobby,.42,'Four Embarcadero to Hyatt']],
  [104682204,[centerLobby,.43,'Clay Street at One Embarcadero']],
  [462445107,[centerLobby,.43,'Battery Street']],
] as const);

export function createEmbarcaderoCenter(areas:Area[],paths:BridgePath[],towers:Tower[]){
  const {root,mesh,box,bar}=makeBuilder(),windows:Window[]=[];
  root.name='Embarcadero Center public levels';
  const bridges:{id:number;name:string;level:number;points:Point[]}[]=[];
  const courts:{id:number;center:Point;level:number}[]=[];
  const gardenAnchors:{id:number;x:number;z:number;y:number}[]=[];
  function rail(a:Point,b:Point,y:number,parent:THREE.Object3D,solid=false){
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length<.035)return;
    if(solid)bar(a,b,y+.042,.038,.085,precast,parent);
    bar(a,b,y+.11,.016,.016,bronze,parent);
    if(!solid)bar(a,b,y+.067,.010,.012,'#ada491',parent);
    const bays=Math.max(1,Math.ceil(length/.225));
    for(let i=0;i<bays;i++){
      const t=i/bays;
      box(.012,.109,.012,THREE.MathUtils.lerp(a[0],b[0],t),y+.055,THREE.MathUtils.lerp(a[1],b[1],t),bronze,parent);
    }
  }
  function spiral(at:Point,r:number,low:number,high:number,start:number,parent:THREE.Object3D){
    const [x,z]=at,segments=Math.ceil((high-low)/.012);
    const stair=new THREE.Group();stair.name='Curved public stair';parent.add(stair);
    const arc=(i:number,radius:number)=>[x+radius*Math.cos(start+i/segments*4.8),z+radius*Math.sin(start+i/segments*4.8)];
    for(let i=0;i<segments;i++){
      const y=low+(i+1)/segments*(high-low);
      const inner=r*.39,points=[arc(i,inner),arc(i,r),arc(i+1,r),arc(i+1,inner),arc(i,inner)];
      mesh(footprintGeometry(points,.034),mosaic,0,y-.034,0,stair);
      bar(points[1],points[2],y+.108,.014,.013,bronze,stair);
      if(i%4===0)box(.013,.11,.013,points[1][0],y+.053,points[1][1],bronze,stair);
    }
    const top=arc(segments,r*.63),landing=arc(segments+3,r*.63);
    bar(top,landing,high-.015,r*.72,.032,mosaic,stair);
  }
  function storefront(block:Block,bounds:readonly number[],y:number,height:number,solid:boolean,parent:THREE.Object3D){
    const p=rectangle(block,bounds);
    if(solid){mesh(footprintGeometry(p,height),precast,0,y,0,parent);return;}
    mesh(footprintGeometry(p,.06),fascia,0,y+height-.06,0,parent);
    for(let i=1;i<p.length;i++){
      const a=p[i-1],b=p[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const count=Math.max(1,Math.round(length/.37));
      const nx=(b[1]-a[1])/length,nz=(a[0]-b[0])/length;
      bar(a,b,y+(height-.063)/2,.024,height-.063,glass,parent);
      for(let k=0;k<count;k++){
        const t=(k+.5)/count,x=THREE.MathUtils.lerp(a[0],b[0],t),z=THREE.MathUtils.lerp(a[1],b[1],t);
        if(i===3||i===4)windows.push({x:x+nx*.018,y:y+(height-.063)/2,z:z+nz*.018,ry:Math.atan2(nx,nz),w:length/count*.80,h:height-.105});
        const edge=k/count;
        box(.041,height-.02,.041,THREE.MathUtils.lerp(a[0],b[0],edge),y+height/2,THREE.MathUtils.lerp(a[1],b[1],edge),precast,parent);
      }
    }
  }
  // The architect's close-up shows a fan-paved tessellation, with staggered
  // stone courses changing direction across each fan. Build the joint lines
  // as one small flat mesh per terrace.
  function fanPaving(block:Block,holes:Point[][],y:number,parent:THREE.Object3D){
    const vertices:number[]=[];
    for(const [uc,vc] of [[block.w*.39,2.64],[block.w*.61,2.64]]){
      for(let row=1;row<=6;row++){
        const radius=.097*row,segments=5+row;
        for(let segment=0;segment<segments;segment++){
          const start=Math.PI*(segment+(row%2)*.18)/segments,end=start+Math.PI*.92/segments;
          const point=(r:number,t:number)=>frame(block,uc+Math.cos(t)*r,vc+Math.sin(t)*r);
          const a=point(radius,start),b=point(radius+.010,start),c=point(radius+.010,end),d=point(radius,end);
          if([a,b,c,d].some(([x,z])=>holes.some(hole=>insideBuilding(x,z,hole))))continue;
          for(const [x,z] of [a,c,b,a,d,c])vertices.push(x,y,z);
        }
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.computeVertexNormals();
    mesh(geometry,'#a3967f',0,0,0,parent).name='Fan-paved mosaic joints';
  }

  for(const [index,block] of blocks.entries()){
    const area=areas.find(a=>a.id===block.id);
    if(!area)continue;
    const podium=new THREE.Group();podium.name=`Embarcadero Center ${index+1} podium`;root.add(podium);
    const court='void' in block?rectangle(block,block.void):circle(frame(block,...block.rotunda),block.r);
    const [stairU,stairV]=block.stair,stairAt=frame(block,stairU,stairV),stairRadius='stairRadius' in block?block.stairRadius:block.r;
    const stairOpening=circle(stairAt,stairRadius*.81);
    const courtyard='void' in block
      ?frame(block,(block.void[0]+block.void[2])/2,(block.void[1]+block.void[3])/2)
      :frame(block,...block.rotunda);
    courts.push({id:block.id,center:courtyard,level:street});

    const ground=mesh(footprintGeometry(area.p,.035),mosaic,0,street-.035,0,podium);ground.name='Street level paving';
    const groundCourt='void' in block?court:circle(courtyard,block.r*.98);
    mesh(footprintGeometry(groundCourt,.010),brick,0,street+.002,0,podium).name='Lower court paving';
    for(const [height,level,bounds,paint] of [
      [street,centerLobby,block.street,precast],
      [centerLobby,centerPromenade,block.lobby,brick],
      [centerPromenade,1.09,block.upper,mosaic],
    ] as const){
      if(height>street){
        const slab=mesh(slabGeometry(area.p,[court,stairOpening],.072),paint,0,height-.072,0,podium);
        slab.name=height===centerLobby?'Lobby level paving':'Promenade level paving';
        for(let i=1;i<court.length;i++)rail(court[i-1],court[i],height,podium,index!==3);
      }
      for(const [k,rect] of bounds.entries())storefront(block,rect,height,level-height-.016,height===centerPromenade&&index===0&&k===0,podium);
    }
    // Let street entrances and measured bridge mouths stay open on the fascia.
    for(let edge=1;edge<area.p.length;edge++){
      const a=area.p[edge-1],b=area.p[edge],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(length<.32)continue;
      const runs=Math.ceil(length/.19);
      let start=0;
      const at=(q:number)=>[THREE.MathUtils.lerp(a[0],b[0],q/runs),THREE.MathUtils.lerp(a[1],b[1],q/runs)];
      for(let k=0;k<=runs;k++){
        const [x,z]=at(k+.5);
        const opening=paths.some(path=>crossingLevels.has(path.id)&&path.p.some(([px,pz])=>Math.hypot(px-x,pz-z)<.70));
        if(k!==runs&&!opening)continue;
        if(k>start)for(const y of [centerLobby,centerPromenade]){
          bar(at(start),at(k),y-.034,.055,.091,fascia,podium);
          rail(at(start),at(k),y,podium,false);
        }
        start=k+1;
      }
    }
    spiral(stairAt,stairRadius*.90,street,centerLobby,index%2===0?.7:-1.4,podium);
    spiral(stairAt,stairRadius*.90,centerLobby,centerPromenade,index%2===0?5.49:3.39,podium);
    fanPaving(block,[court,stairOpening],centerPromenade+.004,podium);
    // Owner's photographs show clustered beds, small flowering trees and clear
    // runs of masonry paving. Bed positions are interpreted at this scale.
    for(const [bedIndex,bed] of block.beds.entries()){
      const p=rectangle(block,bed);
      for(const [height,pigment,depth] of [[centerPromenade+.005,coping,.095],[centerPromenade+.100,'#68774f',.015]] as const)
        mesh(footprintGeometry(p,depth),pigment,0,height,0,podium).name=bedIndex===0?'Promenade planter':'Raised planting bed';
      for(let k=0;k<11;k++){
        const u=THREE.MathUtils.lerp(bed[0]+.03,bed[2]-.03,(k+.35)/11),v=THREE.MathUtils.lerp(bed[1]+.035,bed[3]-.035,k%2*.67+.12);
        const [x,z]=frame(block,u,v),color=['#9f925d','#948760','#af885f','#758957'][k%4];
        mesh(new THREE.IcosahedronGeometry(.034+(k%3)*.007,0),color,x,centerPromenade+.126,z,podium);
      }
    }
    for(const [i,[u,v,h]] of block.trees.entries()){
      const [x,z]=frame(block,u,v);
      if(towers.some(t=>centerTowerIds.has(t.parent||t.id)&&insideBuilding(x,z,t.p)))continue;
      const y=centerPromenade+.105;
      gardenAnchors.push({id:block.id,x,z,y});
      waterfrontTree((g,c,px,py,pz)=>mesh(g,c,px,py,pz,podium),x,y,z,block.id+i,h,'');
    }
    if(index===2){
      // The arts guide puts Nevelson's dark vertical Sky Tree in a reflecting pool here.
      const basin=rectangle(block,[2.12,3.66,3.14,4.72]);
      mesh(footprintGeometry(basin,.049),shade,0,street+.018,0,podium).name='Sky Tree reflecting pool';
      mesh(footprintGeometry(rectangle(block,[2.17,3.71,3.09,4.67]),.013),'#5c817c',0,street+.058,0,podium);
      for(const [du,dv,h] of [[0,0,.57],[-.10,.03,.34],[.09,-.07,.43],[.14,.10,.31]]) {
        const [x,z]=frame(block,2.63+du,4.16+dv);
        box(.064,h,.075,x,street+.07+h/2,z,'#384440',podium).name='Sky Tree silhouette';
      }
    }
    if(index===3){
      // Portman's three-level Tulip occupies the round opening in Four EC.
      const [x,z]=courtyard;
      const form=[[.070,0],[.070,.19],[.102,.43],[.136,.57],[.209,.71],[.269,.79]]
        .map(([r,y])=>new THREE.Vector2(r,y));
      mesh(new THREE.LatheGeometry(form,20),fascia,x,street+.036,z,podium).name='The Tulip at Four Embarcadero';
      mesh(new THREE.TorusGeometry(.258,.019,5,24),'#d1bc93',x,street+.815,z,podium).rotation.x=-Math.PI/2;
    }
  }

  for(const path of paths){
    const info=crossingLevels.get(path.id);
    if(!info)continue;
    const [level,width,name]=info;
    const link=new THREE.Group();link.name=`Embarcadero Center bridge: ${name}`;root.add(link);
    const a=path.p[0],b=path.p.at(-1)!,dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    // The south Davis crossing continues past the two stair openings to its decks.
    const westPad=path.id===944870404?.54:.21,eastPad=path.id===944870404?.87:.21;
    const from=[a[0]-dx/length*westPad,a[1]-dz/length*westPad],to=[b[0]+dx/length*eastPad,b[1]+dz/length*eastPad];
    bar(from,to,level-.052,width,.104,precast,link);
    bar(from,to,level+.006,width*.85,.014,mosaic,link);
    for(const side of [-1,1]){
      const edge=(p:Point)=>[p[0]+dz/length*width*.49*side,p[1]-dx/length*width*.49*side];
      rail(edge(from),edge(to),level,link,true);
    }
    bridges.push({id:path.id,name,level,points:[from,to]});
  }
  return {root,windows,bridges,courts,gardenAnchors};
}

/** Tall precast piers and bronze-glass recesses in the as-built OSM tower envelope. */
export function centerTowerFacade(tower:Tower,buildings:Tower[]){
  const {root,box}=makeBuilder(),windows:Window[]=[];
  root.name='Embarcadero Center tower precast and glazing';
  const lower=Math.max(centerPromenade+.16,tower.minH||0),peers=buildings.filter(b=>(b.parent||b.id)===(tower.parent||tower.id)&&b.id!==tower.id);
  const floors=Math.max(1,Math.round((tower.h-lower)/.218)),story=(tower.h-lower-.055)/floors;
  if(story<=.02)return {root,windows};
  for(let edge=1;edge<tower.p.length;edge++){
    const a=tower.p[edge-1],b=tower.p[edge],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(len<.084)continue;
    const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
    let nx=(b[1]-a[1])/len,nz=(a[0]-b[0])/len;
    if(insideBuilding(x+nx*.016,z+nz*.016,tower.p)){nx=-nx;nz=-nz;}
    const face=new THREE.Group();face.position.set(x,0,z);face.rotation.y=Math.atan2(nx,nz);root.add(face);
    const clear=(u:number,y:number)=>{
      const px=x+nz*u+nx*.034,pz=z-nx*u+nz*.034;
      return !peers.some(p=>y>=(p.minH||0)&&y<p.h&&insideBuilding(px,pz,p.p));
    };
    const bays=Math.max(1,Math.round(len/.151)),w=len/bays;
    for(let i=0;i<bays;i++){
      const u=-len/2+(i+.5)*w;
      if(!clear(u,lower+story/2))continue;
      box(w*.79,tower.h-lower-.05,.024,u,(lower+tower.h-.05)/2,.014,glass,face);
      box(w*.26,tower.h-lower,.057,u-w*.455,(lower+tower.h)/2,.032,fascia,face);
      for(let f=0;f<floors;f++){
        const y=lower+(f+.5)*story;
        windows.push({x:x+nz*u+nx*.037,z:z-nx*u+nz*.037,y,ry:face.rotation.y,w:w*.66,h:story*.71});
      }
    }
    for(let f=1;f<floors;f++)if(clear(0,lower+f*story))box(len,.025,.027,0,lower+f*story,.031,shade,face);
    if(clear(0,tower.h-.026))box(len+.012,.056,.057,0,tower.h-.028,.037,precast,face);
  }
  return {root,windows};
}
