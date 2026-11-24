import * as THREE from 'three';
import records from '../public/data/tree-wells.json' with {type:'json'};

type WellKind='pot'|'cutout'|'grate'|'yard';
type Entry=[WellKind,number,number];
type MakeMesh=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
const plot=records as unknown as Record<string,Entry>;
const foot=.3048*.06;
const soil=new THREE.Color('#5b5140'),mulch=new THREE.Color('#76694e'),stone=new THREE.Color('#ab9c83');
const bronze=new THREE.Color('#867858'),patina=new THREE.Color('#586358'),metalEdge=new THREE.Color('#a49472');
const terra=new THREE.Color('#ad8069'),potShade=new THREE.Color('#896852');
const forms=new Map<WellKind,THREE.BufferGeometry>();

// A single opaque surface per planting site. The grate slots and radial ribs
// share edges so close-up inspection cannot reveal overlapping drawing planes.
function wellForm(kind:WellKind){
  const cached=forms.get(kind);if(cached)return cached;
  const vertices:number[]=[],colors:number[]=[];
  const point=(r:number,a:number,y:number):[number,number,number]=>[r*Math.cos(a),y,r*Math.sin(a)];
  const face=(a:number[],b:number[],c:number[],t:THREE.Color)=>{
    vertices.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(t.r,t.g,t.b);
  };
  const strip=(inner:number,outer:number,y1:number,y2:number,n:number,tone:(i:number)=>THREE.Color,angle=0)=>{
    for(let i=0;i<n;i++){
      const a=i*2*Math.PI/n+angle,b=(i+1)*2*Math.PI/n+angle;
      const p=point(inner,a,y1),q=point(inner,b,y1),r=point(outer,b,y2),s=point(outer,a,y2);
      if(inner>0)face(p,q,r,tone(i));face(p,r,s,tone(i));
    }
  };
  if(kind==='grate'){
    strip(0,.15,0,0,24,()=>soil);
    strip(.15,.19,0,0,24,()=>metalEdge);
    for(const [r1,r2] of [[.19,.35],[.38,.475]]){
      for(let i=0;i<24;i++){
        const a=i*Math.PI/12,b=a+Math.PI/12,split=a+.063;
        for(const [start,end,t] of [[a,split,bronze],[split,b,soil]] as const){
          const p=point(r1,start,0),q=point(r1,end,0),r=point(r2,end,0),s=point(r2,start,0);
          face(p,q,r,t);face(p,r,s,t);
        }
      }
    }
    strip(.35,.38,0,0,24,()=>patina);strip(.475,.50,0,0,24,()=>metalEdge);
  }else if(kind==='pot'){
    // Flared masonry pot with a turned lip, dark inner return and exposed planting soil.
    strip(.43,.34,.04,0,20,()=>potShade);
    strip(.48,.43,.88,.04,20,()=>terra);
    strip(.50,.48,.96,.88,20,()=>stone);
    strip(.435,.50,.96,.96,20,()=>stone);
    strip(.422,.435,.80,.96,20,()=>potShade);
    strip(0,.422,.80,.80,20,()=>soil);
  }else{
    const angle=Math.PI/4,outer=Math.SQRT1_2;
    strip(0,outer*.88,0,0,4,i=>i%3===0?mulch:soil,angle);
    strip(outer*.88,outer*.975,0,0,4,()=>mulch,angle);
    strip(outer*.975,outer,0,0,4,()=>stone,angle);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.userData.paintVertices=true;geometry.computeVertexNormals();forms.set(kind,geometry);
  return geometry;
}

export function treeWell(mesh:MakeMesh,id:number|undefined,x:number,y:number,z:number,angle=0,median=false){
  const record=median?['cutout',5,5] as Entry:plot[id??''];
  if(!record||record[0]==='yard')return;
  return placedTreeWell(mesh,id,x,y,z,angle,record);
}

export function placedTreeWell(mesh:MakeMesh,id:number|undefined,x:number,y:number,z:number,angle:number,record:Entry){
  const [kind,width,depth]=record;
  const part=mesh(wellForm(kind),'#ffffff',x,y+.0009,z);
  part.name=kind==='pot'?'Inventory tree planter':kind==='grate'?'Bronze tree grate':'Tree cutout';
  part.userData.treeSite=id;part.rotation.y=angle;
  part.scale.set(width*foot,kind==='pot'?Math.min(.055,width*foot*.49):1,depth*foot);
  part.castShadow=kind==='pot';part.receiveShadow=true;
  return part;
}
