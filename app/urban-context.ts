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
    // Decode in native code where available. The fallback also avoids the
    // iterator and per-byte callbacks on older Safari versions.
    const type=Uint8Array as typeof Uint8Array & {fromBase64?:(text:string)=>Uint8Array};
    let bytes:Uint8Array;
    if(type.fromBase64)bytes=type.fromBase64(encoded);
    else{
      const raw=atob(encoded);bytes=new Uint8Array(raw.length);
      for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    }
    this.view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  }
  u8(){return this.view.getUint8(this.offset++);}
  u16(){const n=this.view.getUint16(this.offset,true);this.offset+=2;return n;}
  i16(){const n=this.view.getInt16(this.offset,true);this.offset+=2;return n;}
  path(x:number,z:number):XZ[]{
    const points:XZ[]=new Array(this.u16());
    for(let i=0;i<points.length;i++)points[i]=[x+this.i16()/100,z+this.i16()/100];
    return points;
  }
}

// Survey tiles always use packed Float32 xyz and a triangle index. Compute
// Three's area-weighted normals directly on those arrays. The city adds tens
// of thousands of faces at boarding, all sharing this one attribute layout.
function tileNormals(xyz:Float32Array,index:Uint16Array|Uint32Array){
  const normals=new Float32Array(xyz.length);
  for(let i=0;i<index.length;i+=3){
    const a=index[i]*3,b=index[i+1]*3,c=index[i+2]*3;
    const cx=xyz[c]-xyz[b],cy=xyz[c+1]-xyz[b+1],cz=xyz[c+2]-xyz[b+2];
    const ax=xyz[a]-xyz[b],ay=xyz[a+1]-xyz[b+1],az=xyz[a+2]-xyz[b+2];
    const nx=cy*az-cz*ay,ny=cz*ax-cx*az,nz=cx*ay-cy*ax;
    normals[a]+=nx;normals[a+1]+=ny;normals[a+2]+=nz;
    normals[b]+=nx;normals[b+1]+=ny;normals[b+2]+=nz;
    normals[c]+=nx;normals[c+1]+=ny;normals[c+2]+=nz;
  }
  for(let i=0;i<normals.length;i+=3){
    const x=normals[i],y=normals[i+1],z=normals[i+2];
    const inv=1/(Math.sqrt(x*x+y*y+z*z)||1);
    normals[i]=x*inv;normals[i+1]=y*inv;normals[i+2]=z*inv;
  }
  return normals;
}

class Surface {
  private xyz=new Float32Array(8192*3);
  private rgb=new Uint8Array(8192*3);
  private uv=new Float32Array(8192*2);
  private indices=new Uint32Array(16384);
  vertexCount=0;
  private indexCount=0;
  reset(){this.vertexCount=0;this.indexCount=0;}
  vertex(x:number,y:number,z:number,color:THREE.Color,u=-1,v=-1){
    const n=this.vertexCount++,p=n*3;
    if(p===this.xyz.length){
      const xyz=new Float32Array(p*2),rgb=new Uint8Array(p*2),uv=new Float32Array(n*4);
      xyz.set(this.xyz);rgb.set(this.rgb);uv.set(this.uv);
      this.xyz=xyz;this.rgb=rgb;this.uv=uv;
    }
    this.xyz[p]=x;this.xyz[p+1]=y;this.xyz[p+2]=z;
    this.rgb[p]=Math.round(color.r*255);this.rgb[p+1]=Math.round(color.g*255);this.rgb[p+2]=Math.round(color.b*255);
    this.uv[n*2]=u;this.uv[n*2+1]=v;
    return n;
  }
  triangle(a:number,b:number,c:number){
    const i=this.indexCount;
    if(i+3>this.indices.length){
      const indices=new Uint32Array(this.indices.length*2);indices.set(this.indices);this.indices=indices;
    }
    this.indices[i]=a;this.indices[i+1]=b;this.indices[i+2]=c;this.indexCount+=3;
  }
  quad(a:number,b:number,c:number,d:number){this.triangle(a,b,c);this.triangle(a,c,d);}
  geometry(){
    const g=new THREE.BufferGeometry(),n=this.vertexCount;
    // Retain exactly the finished tile's data. Every tile can then reuse the same
    // staging arrays without touching geometry that's already on the screen.
    const xyz=this.xyz.slice(0,n*3);
    g.setAttribute('position',new THREE.BufferAttribute(xyz,3));
    g.setAttribute('color',new THREE.BufferAttribute(this.rgb.slice(0,n*3),3,true));
    g.setAttribute('uv',new THREE.BufferAttribute(this.uv.slice(0,n*2),2));
    const used=this.indices.subarray(0,this.indexCount);
    const index=n>65535?new Uint32Array(used):new Uint16Array(used);
    g.setIndex(new THREE.BufferAttribute(index,1));
    g.setAttribute('normal',new THREE.BufferAttribute(tileNormals(xyz,index),3));
    g.computeBoundingSphere();
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
  const start=surface.vertexCount;
  const loop=rings.map(r=>r.map(p=>new THREE.Vector2(...p)));
  const faces=THREE.ShapeUtils.triangulateShape(loop[0],loop.slice(1));
  for(const [px,pz] of flats)surface.vertex(px,top,pz,roof);
  for(const [a,b,c] of faces)surface.triangle(start+c,start+b,start+a);
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

// Keep both stream cursors and the staging surface between boarding frames.
// A complete building (including its courtyard rings) is the smallest bake.
function tileReader(tile:Tile){
  const [x,z,buildings,roads]=tile;
  const b=new Reader(buildings),r=new Reader(roads);
  return (surface:Surface,deadline:number)=>{
    while(b.offset<b.view.byteLength){
      const height=b.u16()/100*scale,bottom=b.u16()/100*scale,tag=b.u8(),wall=b.u8(),roof=b.u8(),levels=b.u8();
      const rings=Array.from({length:b.u8()},()=>b.path(x,z));
      addBuilding(surface,rings,height,bottom,tag,wall,roof,levels);
      if(deadline!==Infinity&&performance.now()>=deadline)return false;
    }
    while(r.offset<r.view.byteLength){
      const kind=r.u8();addRoad(surface,r.path(x,z),kind);
      if(deadline!==Infinity&&performance.now()>=deadline)return false;
    }
    return true;
  };
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

type Cell={data:Tile;box:THREE.Box3;priority:number};
type UrbanContext=THREE.LOD & {
  prepareRideView:(camera:THREE.Camera,budgetMs:number)=>boolean;
  prepareOrbitView:(camera:THREE.Camera,budgetMs:number)=>boolean;
  endRideView:()=>void;
};

/** Orbit and ride views assemble visible survey tiles in bounded slices.
 * A tile enters the scene only after its geometry is complete. */
export function createUrbanContext():UrbanContext{
  const root=new THREE.LOD() as UrbanContext;root.name='San Francisco municipal neighborhood survey';
  const material=neighborhoodMaterial(),frustum=new THREE.Frustum();
  const projection=new THREE.Matrix4(),last=new THREE.Matrix4(),inverseRoot=new THREE.Matrix4();
  const eye=new THREE.Vector3(),center=new THREE.Vector3(),forward=new THREE.Vector3();
  const pending=new Set(tileData.map(data=>{
    const [xmin,zmin,xmax,zmax]=data[4];
    const box=new THREE.Box3(new THREE.Vector3(xmin-1,-4,zmin-1),new THREE.Vector3(xmax+1,32,zmax+1));
    return {data,box,priority:0};
  }));
  let queue:Cell[]=[],next=0,valid=false,surface:Surface|undefined;
  let current:{tile:Cell;read:ReturnType<typeof tileReader>}|undefined;
  let rideCamera:THREE.Camera|undefined,boarding=false;
  function advance(camera:THREE.Camera,deadline:number){
    if(!pending.size)return true;
    projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(root.matrixWorld);
    if(!valid||!projection.equals(last)){
      valid=true;last.copy(projection);frustum.setFromProjectionMatrix(projection);
      queue=[];next=0;
      inverseRoot.copy(root.matrixWorld).invert();
      eye.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverseRoot);
      forward.set(0,0,-1).transformDirection(camera.matrixWorld).transformDirection(inverseRoot);
      for(const tile of pending){
        if(!frustum.intersectsBox(tile.box))continue;
        if(rideCamera){
          tile.box.getCenter(center).sub(eye);
          const depth=center.dot(forward);
          // Nearby blocks and those directly along the driver's line of sight first.
          tile.priority=tile.box.distanceToPoint(eye)+.35*Math.sqrt(Math.max(0,center.lengthSq()-depth*depth));
        }
        queue.push(tile);
      }
      if(rideCamera)queue.sort((a,b)=>a.priority-b.priority);
      if(current){
        const i=queue.indexOf(current.tile);
        if(i<0)current=undefined;
        else queue.splice(i,1);
      }
    }
    while(current||next<queue.length){
      surface??=new Surface();
      if(!current){
        const tile=queue[next++];surface.reset();current={tile,read:tileReader(tile.data)};
      }
      if(!current.read(surface,deadline))return false;
      const mesh=new THREE.Mesh(surface.geometry(),material);
      mesh.name='Surveyed neighborhood roofs, facades and streets';mesh.matrixAutoUpdate=false;
      mesh.matrixWorld.copy(root.matrixWorld);root.add(mesh);
      pending.delete(current.tile);current=undefined;
      if(deadline!==Infinity&&performance.now()>=deadline)break;
    }
    if(!pending.size)surface=undefined;
    return !current&&next===queue.length;
  }
  root.prepareOrbitView=(camera,budgetMs)=>advance(camera,performance.now()+budgetMs);
  root.prepareRideView=(camera,budgetMs)=>{
    rideCamera=camera;boarding=true;
    const ready=advance(camera,performance.now()+Math.max(0,budgetMs));
    if(ready)boarding=false;
    return ready;
  };
  root.endRideView=()=>{
    if(!rideCamera)return;
    rideCamera=undefined;boarding=false;current=undefined;queue=[];next=0;valid=false;
  };
  root.update=camera=>{
    if(rideCamera&&(boarding||camera!==rideCamera))return;
    advance(camera,rideCamera?performance.now()+3:Infinity);
  };
  return root;
}
