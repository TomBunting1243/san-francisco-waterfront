import * as THREE from 'three';
import mapped from '../public/data/urban-context.json' with {type:'json'};
import approach from '../public/data/approach-soma.json' with {type:'json'};
import {approachLengths,approachPose} from './approach-road.ts';
import {bayReliefGround} from './bay-relief.ts';

type Tile = [number, number, string, string, number[]];
type XZ = [number, number];
const tileData = mapped.tiles as Tile[];
const scale = .06;
const walls = ['#c2b6a1','#9cadae','#b3917f','#c4c1ae','#9daaaa','#bda98d','#b1aca3','#c9c3af'].map(s=>new THREE.Color(s));
const roofs = ['#bdb8ab','#a9afb0','#aaa49a','#c4c2b5','#adb4ae','#b9afa0'].map(s=>new THREE.Color(s));
const taggedColors=mapped.colors.map(s=>new THREE.Color(s));
const streetPaint=new THREE.Color('#9b9e96'), alleyPaint=new THREE.Color('#b8b5a8');
const deckPaint=new THREE.Color('#849493'), beamPaint=new THREE.Color('#929e98');
const joins=[mapped.joins.west[0],mapped.joins.east[0]];
const approachDecks=approachLengths.map((length,i)=>approachPose(i===1,length,0).y+.01375);

class Reader {
  view: DataView;
  offset=0;
  constructor(encoded:string){
    this.view=new DataView(Uint8Array.from(atob(encoded),s=>s.charCodeAt(0)).buffer);
  }
  u8(){return this.view.getUint8(this.offset++);}
  u16(){const n=this.view.getUint16(this.offset,true);this.offset+=2;return n;}
  i16(){const n=this.view.getInt16(this.offset,true);this.offset+=2;return n;}
  path(x:number,z:number):XZ[]{
    return Array.from({length:this.u16()},()=>[x+this.i16()/100,z+this.i16()/100]);
  }
}

class Surface {
  positions:number[]=[];colors:number[]=[];indices:number[]=[];uv:number[]=[];
  vertex(x:number,y:number,z:number,color:THREE.Color,u=-1,v=-1){
    const n=this.positions.length/3;
    this.positions.push(x,y,z);
    this.colors.push(Math.round(color.r*255),Math.round(color.g*255),Math.round(color.b*255));
    this.uv.push(u,v);
    return n;
  }
  quad(a:number,b:number,c:number,d:number){this.indices.push(a,b,c,a,c,d);}
  geometry(){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));
    g.setAttribute('color',new THREE.Uint8BufferAttribute(this.colors,3,true));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));
    g.setIndex(this.indices);g.computeVertexNormals();g.computeBoundingSphere();
    return g;
  }
}

function addBuilding(surface:Surface,rings:XZ[][],height:number,bottom:number,tag:number,wallTone:number,roofTone:number,levels:number){
  const ring=rings[0],x=ring[0][0],z=ring[0][1];
  const hash=Math.abs(Math.round(x*137+z*91));
  const wall=wallTone?taggedColors[wallTone-1]:walls[tag||hash%walls.length];
  const roof=roofTone?taggedColors[roofTone-1]:roofs[hash%roofs.length];
  const bays=.155+(hash%5)*.022;
  const storeys=levels||Math.max(1,Math.round(height/(height>1.65?.218:.186)));
  const floor=height/storeys;
  const flats=rings.flat();
  const ground=flats.map(([px,pz])=>bayReliefGround(px,pz));
  const base=ground.reduce((sum,h)=>sum+h,0)/ground.length;
  const top=base+height;
  const start=surface.positions.length/3;
  const loop=rings.map(r=>r.map(p=>new THREE.Vector2(...p)));
  const faces=THREE.ShapeUtils.triangulateShape(loop[0],loop.slice(1));
  for(const [px,pz] of flats)surface.vertex(px,top,pz,roof);
  for(const [a,b,c] of faces)surface.indices.push(start+c,start+b,start+a);
  let offset=0;
  for(const r of rings){
    for(let i=0;i<r.length;i++){
      const j=(i+1)%r.length,[ax,az]=r[i],[bx,bz]=r[j];
      const width=Math.max(1,Math.round(Math.hypot(bx-ax,bz-az)/bays));
      const lowA=bottom?base+bottom:ground[offset+i]-.05,lowB=bottom?base+bottom:ground[offset+j]-.05;
      const a=surface.vertex(ax,lowA,az,wall,0,(lowA-base)/floor);
      const b=surface.vertex(bx,lowB,bz,wall,width,(lowB-base)/floor);
      const c=surface.vertex(bx,top,bz,wall,width,storeys);
      const d=surface.vertex(ax,top,az,wall,0,storeys);
      surface.quad(b,a,d,c);
    }
    offset+=r.length;
  }
}

function roadHeight(x:number,z:number,elevated:boolean){
  const ground=bayReliefGround(x,z);
  if(!elevated)return ground+.025;
  // Both SF Public Works carriageways continue into the same US-101 interchange.
  // Keep the measured approach surface tangent in grade through the dataset boundary.
  let y=ground+.72;
  for(const [i,[jx,jz]] of joins.entries()){
    const k=THREE.MathUtils.smoothstep(Math.hypot(x-jx,z-jz),0,7);
    y=THREE.MathUtils.lerp(approachDecks[i],y,k);
  }
  return y;
}

function addRoad(surface:Surface,path:XZ[],kind:number){
  const elevated=[1,6,7,8].includes(kind);
  const half=({1:.483,2:.58,3:.51,4:.44,5:.32,6:.17,7:.483,8:.483,9:.10,10:.18} as Record<number,number>)[kind];
  const points:XZ[]=[path[0]];
  for(let i=1;i<path.length;i++){
    const [ax,az]=path[i-1],[bx,bz]=path[i],n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/2));
    for(let j=1;j<=n;j++)points.push([ax+(bx-ax)*j/n,az+(bz-az)*j/n]);
  }
  const color=elevated?deckPaint:kind>=9?alleyPaint:streetPaint;
  let previous:number[]=[],station=0,nextPier=3.4;
  const existing=kind===7?approach.west.points:kind===8?approach.east.points:undefined;
  for(let i=0;i<points.length;i++){
    const [x,z]=points[i],[ax,az]=!i&&existing?existing[existing.length-2]:points[Math.max(0,i-1)];
    const [bx,bz]=!i&&existing?points[0]:points[Math.min(points.length-1,i+1)];
    if(i)station+=Math.hypot(x-points[i-1][0],z-points[i-1][1]);
    const len=Math.hypot(bx-ax,bz-az)||1,dx=-(bz-az)/len*half,dz=(bx-ax)/len*half;
    const ly=roadHeight(x+dx,z+dz,elevated),ry=roadHeight(x-dx,z-dz,elevated);
    const l=surface.vertex(x+dx,ly,z+dz,color),r=surface.vertex(x-dx,ry,z-dz,color);
    const current=[l,r];
    if(elevated){
      current.push(surface.vertex(x+dx,ly-.14,z+dz,beamPaint),surface.vertex(x-dx,ry-.14,z-dz,beamPaint));
      // Continuous concrete edge parapets read at skyline scale.
      current.push(surface.vertex(x+dx,ly+.04,z+dz,beamPaint),surface.vertex(x-dx,ry+.04,z-dz,beamPaint));
      if(station>=nextPier){
        nextPier=station+3.8;
        const ground=bayReliefGround(x,z)-.03,head=(ly+ry)*.5-.13;
        const corners=[[x-.09,z-.12],[x+.09,z-.12],[x+.09,z+.12],[x-.09,z+.12]];
        for(let j=0;j<4;j++){
          const [px,pz]=corners[j],[qx,qz]=corners[(j+1)%4];
          surface.quad(surface.vertex(qx,ground,qz,beamPaint),surface.vertex(px,ground,pz,beamPaint),
            surface.vertex(px,head,pz,beamPaint),surface.vertex(qx,head,qz,beamPaint));
        }
      }
    }
    if(i){
      surface.quad(previous[0],l,r,previous[1]);
      if(elevated){
        surface.quad(previous[2],current[2],current[4],previous[4]);
        surface.quad(previous[5],current[5],current[3],previous[3]);
      }
    }
    previous=current;
  }
}

function buildTile(tile:Tile,material:THREE.Material){
  const [x,z,buildings,roads]=tile;
  const surface=new Surface();
  const b=new Reader(buildings),r=new Reader(roads);
  while(b.offset<b.view.byteLength){
    const height=b.u16()/100*scale,bottom=b.u16()/100*scale,tag=b.u8(),wall=b.u8(),roof=b.u8(),levels=b.u8();
    const rings=Array.from({length:b.u8()},()=>b.path(x,z));
    addBuilding(surface,rings,height,bottom,tag,wall,roof,levels);
  }
  while(r.offset<r.view.byteLength){
    const kind=r.u8();
    addRoad(surface,r.path(x,z),kind);
  }
  const mesh=new THREE.Mesh(surface.geometry(),material);
  mesh.name='Surveyed neighborhood roofs, facades and streets';
  return mesh;
}

function neighborhoodMaterial(){
  const material=new THREE.MeshLambertMaterial({vertexColors:true});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 facadeUV;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nfacadeUV=uv;');
    // Fade individual bays below pixel resolution. UVs run along each measured facade.
    shader.fragmentShader='varying vec2 facadeUV;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      if(facadeUV.x>=0.0){
        vec2 cell=facadeUV;
        vec2 fw=max(fwidth(cell),vec2(.002));
        vec2 edge=abs(fract(cell)-.5);
        vec2 aperture=1.-smoothstep(vec2(.23,.28)-fw*.5,vec2(.23,.28)+fw*.5,edge);
        float coverage=aperture.x*aperture.y;
        coverage=mix(coverage,.258,smoothstep(.23,.85,max(fw.x,fw.y)));
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.58,.71,.77),coverage*.80);
      }`);
  };
  return material;
}

/** Municipal survey tiles are decoded only when their world bounds enter the camera frustum. */
export function createUrbanContext(){
  const root=new THREE.Group();root.name='San Francisco municipal neighborhood survey';
  const material=neighborhoodMaterial(),frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),last=new THREE.Matrix4();
  for(const data of tileData){
    const [x,z]=data;
    const node=new THREE.LOD();
    node.name=`Neighborhood survey ${x},${z}`;
    const [xmin,zmin,xmax,zmax]=data[4];
    const box=new THREE.Box3(new THREE.Vector3(xmin-1,-4,zmin-1),new THREE.Vector3(xmax+1,32,zmax+1));
    node.update=camera=>{
      if(node.children.length)return;
      projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      if(!projection.equals(last)){frustum.setFromProjectionMatrix(projection);last.copy(projection);}
      if(frustum.intersectsBox(box))node.add(buildTile(data,material));
    };
    root.add(node);
  }
  return root;
}
