import {addPromenadeCrossings,walkPanelCoordinates} from './promenade-pavement.ts';
import {addSurveyCurbs,replacementPavement} from './curb-survey.ts';
import * as THREE from 'three';
import survey from '../public/data/survey-blocks.json' with {type:'json'};

type Plan=number[][][];
type Vertex=[number,number,number];
type Surface=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
type Front={plan:Plan;parapets:Plan[]};
const fronts:Record<string,Front>=survey.fronts;
export const outsideSurveyRoads=survey.outsideRoads;
const heights:Record<string,number>=survey.heights;
export function surveyedHeight(id:number){return heights[id];}

// Existing architecture is baked by spatial district. Pack the surveyed pieces
// into small tiles first, so city setup never allocates a mesh per pane or curb.
class Tile {
  positions:number[]=[];
  colors:number[]=[];
  indices:number[]=[];
  palette=new Map<string,THREE.Color>();
  vertices(points:Vertex[],color:string) {
    let pigment=this.palette.get(color);
    if(!pigment)this.palette.set(color,pigment=new THREE.Color(color));
    const first=this.positions.length/3;
    for(const p of points){this.positions.push(...p);this.colors.push(pigment.r,pigment.g,pigment.b);}
    return first;
  }
  quad(a:Vertex,b:Vertex,c:Vertex,d:Vertex,paint:string){
    const i=this.vertices([a,b,c,d],paint);
    this.indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  top(plan:Plan,height:number,color:string){
    const [outer,...holes]=plan.map(r=>r.map(([x,z])=>new THREE.Vector2(x,-z)));
    const faces=THREE.ShapeUtils.triangulateShape(outer,holes);
    const points=[outer,...holes].flat().map(({x,y}):Vertex=>[x,height,-y]);
    const i=this.vertices(points,color);
    for(const [a,b,c] of faces)this.indices.push(i+a,i+b,i+c);
  }
  geometry(){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    geo.setIndex(this.indices);geo.computeVertexNormals();
    geo.userData.paintVertices=true;
    return geo;
  }
}

const pavement:Record<string,[number,string]>={
  street:[.031,'#899692'],alley:[.032,'#a4a39a'],private:[.032,'#a39d90'],
  sidewalk:[.045,'#cac6b3'],curb:[.049,'#d1cbb6'],
  parking:[.013,'#a4a59b'],stall:[.017,'#d7d2b9'],
  garden:[.011,'#91a480'],courtyard:[.022,'#cab6a0'],pool:[.027,'#65b1b3'],
};

function walls(tile:Tile,plan:Plan,height:number,wall:string,front:boolean){
  for(const ring of plan)for(let i=0;i<ring.length;i++){
    const [x,z]=ring[i],[bx,bz]=ring[(i+1)%ring.length];
    const dx=bx-x,dz=bz-z,len=Math.hypot(dx,dz);
    if(len<.001)continue;
    const pt=(d:number,y:number,inset=0):Vertex=>[x+(dx*d-dz*inset)/len,y,z+(dz*d+dx*inset)/len];
    const panel=(start:number,end:number,bottom:number,top:number,color:string,depth=0)=>
      tile.quad(pt(start,bottom,depth),pt(start,top,depth),pt(end,top,depth),pt(end,bottom,depth),color);
    if(len<.22||height<.28){panel(0,len,-.015,height,wall);continue;}
    // A continuous recessed sash sits behind actual open strips of masonry.
    // At the courtyard scale the openings also have a deep sill and reveals.
    const depth=front?.032:.018;
    panel(0,len,-.012,height,'#637d7e',depth);
    const floors=Math.max(1,Math.round(height/(front?.197:.27)));
    const bays=Math.max(1,Math.round(len/(front?.31:.43)));
    const storey=height/floors,step=len/bays,jamb=step*(front?.29:.23);
    for(let f=0;f<floors;f++){
      const base=f*storey,low=base+storey*.28,high=base+storey*.86;
      panel(0,len,f===0?-.012:base,low,wall);
      panel(0,len,high,base+storey,wall);
      if(front){
        tile.quad(pt(0,low),pt(0,low,depth),pt(len,low,depth),pt(len,low),'#c6bfae');
        tile.quad(pt(len,high),pt(len,high,depth),pt(0,high,depth),pt(0,high),'#a59e91');
      }
      for(let j=0;j<=bays;j++){
        const left=Math.max(0,j*step-jamb/2),right=Math.min(len,j*step+jamb/2);
        panel(left,right,low,high,wall);
        if(front){
          tile.quad(pt(right,low),pt(right,low,depth),pt(right,high,depth),pt(right,high),'#b0a89a');
          tile.quad(pt(left,high),pt(left,high,depth),pt(left,low,depth),pt(left,low),'#b0a89a');
        }
      }
    }
  }
}

export function addSurveyFront(mesh:Surface,id:number,height:number){
  const front=fronts[id];
  if(!front)return false;
  const tile=new Tile(),warm=[125401311,125401316,125401320].includes(id);
  walls(tile,front.plan,height,warm?'#ac816b':'#d8cdb8',true);
  // The deck lies below the inner parapet. Courtyards and concave setbacks
  // survive both triangulation and the true parallel inset from the importer.
  tile.top(front.plan,height,warm?'#bc967a':'#c3c0ae');
  for(const parapet of front.parapets){
    tile.top(parapet,height+.052,'#e1d8bf');
    for(const r of parapet)for(let j=0;j<r.length;j++){
      const [x,z]=r[j],[a,b]=r[(j+1)%r.length];
      tile.quad([x,height,z],[x,height+.052,z],[a,height+.052,b],[a,height,b],'#c0b7a6');
    }
  }
  mesh(tile.geometry(),'#ffffff',0,0,0).name='Bayside Village and Brannan courtyard frontage';
  return true;
}

export function addSurveyBlocks(mesh:Surface){
  const tiles=new Map<string,Tile>();
  function at(plan:Plan){
    const [x,z]=plan[0][0],key=Math.floor(x/12)+','+Math.floor(z/12);
    let tile=tiles.get(key);
    if(!tile)tiles.set(key,tile=new Tile());
    return tile;
  }
  const walkTiles=new Map<number,Tile>();
  addSurveyCurbs(mesh);addPromenadeCrossings(mesh);
  for(const [kind,polygons] of Object.entries(survey.streets)){
    const [height,color]=pavement[kind];
    for(const [i,polygon] of polygons.entries())for(const piece of replacementPavement(kind,i,polygon)){
      if(kind==='sidewalk'&&piece[0].some(([x,z])=>x>=-56&&x<=30&&z>=-8&&z<=2)){
        const id=Math.floor(piece[0][0][0]/12);let tile=walkTiles.get(id);
        if(!tile)walkTiles.set(id,tile=new Tile());
        tile.top(piece,height,'#c4bdac');
      }else at(piece).top(piece,height,color);
    }
  }
  for(const [id,tile] of walkTiles){
    const geometry=tile.geometry();walkPanelCoordinates(geometry);
    mesh(geometry,'#ffffff',0,0,0).name='Promenade sidewalk slabs '+id;
  }
  const masonry=['#c0b59f','#b8b5a2','#c6b39e','#abae9f'];
  for(const [i,[height,plan]] of (survey.buildings as [number,Plan][]).entries()){
    const tile=at(plan);
    walls(tile,plan,height,masonry[i%masonry.length],false);
    tile.top(plan,height,'#afa998');
  }
  for(const [key,tile] of tiles)mesh(tile.geometry(),'#ffffff',0,0,0).name='Surveyed streets and buildings '+key;
}
