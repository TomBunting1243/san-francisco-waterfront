import {howardMissionAsphalt} from './howard-mission-bikeway.ts';
import {cutCurbPalmBed,curbPalmBeds,medianPalmBeds,openMedianSidewalk} from './median-palm-sites.ts';
import {addMedianBedSurface} from './median-bed-surface.ts';
import {setPackedNormals} from './packed-normals.ts';
import {northWaterfrontGrade} from './north-quay-grade.ts';
import {addFolsomPortal,folsomPavement} from './folsom-portal.ts';
import {addRinconCurbEdge} from './rincon-curb-edge.ts';
import {addDonCheeVent} from './don-chee-vent.ts';
import {stationPavingCut} from './embarcadero-station-sites.ts';
import {addPromenadeCrossings,walkPanelCoordinates} from './promenade-pavement.ts';
import {addTransbayCrossings} from './transbay-crossings.ts';
import {addFremontApproachCurbs,fremontPavingRemainder} from './fremont-approach-curbs.ts';
import {addHowardBealeThroughPaint,addHowardBealeWalk,cutHowardBealeWalk} from './howard-beale-through.ts';
import {addHowardPublicCourtyard} from './howard-public-courtyard.ts';
import {addFremontMarkings} from './fremont-markings.ts';
import {addSurveyCurbs,bealeBeds,bealeSidewalk,howardSidewalk,howardStreet,replacementPavement} from './curb-survey.ts';
import * as THREE from 'three';
import survey from '../public/data/survey-blocks.json' with {type:'json'};
import extensions from '../public/data/sightline-streets.json' with {type:'json'};

type Plan=number[][][];
type Vertex=[number,number,number];
type Surface=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
type Front={plan:Plan;parapets:Plan[]};
const fronts:Record<string,Front>=survey.fronts;
const remaining:Record<string,number[][][]>=extensions.remaining;
export const outsideSurveyRoads=survey.outsideRoads.flatMap((road,i)=>
  (remaining[i]??[road.p]).map(p=>({...road,p})));

const heights:Record<string,number>=survey.heights;
export function surveyedHeight(id:number){return heights[id];}

// Existing architecture is baked by spatial district. Pack the surveyed pieces
// into small tiles first, so city setup never allocates a mesh per pane or curb.
class Tile {
  positions:number[]=[];
  colors:number[]=[];
  indices:number[]=[];
  roadExposure:number[]=[];
  roadClass=0;
  palette=new Map<string,THREE.Color>();
  vertices(points:Vertex[],color:string) {
    let pigment=this.palette.get(color);
    if(!pigment)this.palette.set(color,pigment=new THREE.Color(color));
    const first=this.positions.length/3;
    for(const p of points){this.roadExposure.push(this.roadClass);this.positions.push(...p);this.colors.push(pigment.r,pigment.g,pigment.b);}
    return first;
  }
  quad(a:Vertex,b:Vertex,c:Vertex,d:Vertex,paint:string){
    const i=this.vertices([a,b,c,d],paint);
    this.indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  top(plan:Plan,height:number,color:string,grade?:(x:number)=>number){
    // The graded quay includes centimetre-scale paint clipped to the curb.
    // Triangulate its final Float32 corners so thin faces retain their winding.
    const [outer,...holes]=plan.map(r=>r.map(([x,z])=>grade?
      new THREE.Vector2(Math.fround(x),-Math.fround(z)):new THREE.Vector2(x,-z)));
    const faces=THREE.ShapeUtils.triangulateShape(outer,holes);
    const points=[outer,...holes].flat().map(({x,y}):Vertex=>[x,height+(grade?grade(x):0),-y]);
    const i=this.vertices(points,color);
    for(const [a,b,c] of faces){
      const cut=height>=.025&&height<=.06?(stationPavingCut(points[a],points[b],points[c])??cutCurbPalmBed(points[a],points[b],points[c])??(this.roadClass===1&&height===.031?cutHowardBealeWalk(points[a],points[b],points[c]):undefined)):undefined;
      if(!cut){this.indices.push(i+a,i+b,i+c);continue;}
      for(const tri of cut){
        const first=this.vertices(tri,color);
        this.indices.push(first,first+1,first+2);
      }
    }
  }
  geometry(){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    if(this.roadExposure.some(Boolean))geo.setAttribute('roadExposure',new THREE.Uint8BufferAttribute(this.roadExposure,1));
    geo.setIndex(this.indices);setPackedNormals(geo);
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

// From the ferry tower, the Market canyon and the north quay both lead out
// of the detailed waterfront survey. Continue the same measured curb/ROW
// surfaces only along those two corridors. One static batch per corridor.
function addSightlineStreets(mesh:Surface){
  const market=new Tile(),quay=new Tile();
  for(const kind of ['street','sidewalk','curb','bars'] as const){
    const [height,color]=kind==='bars'?[.034,'#d6d0b9']:pavement[kind];
    for(const plan of extensions[kind]){
      const tile=plan[0][0][0]>0?quay:market;
      tile.roadClass=kind==='street'||kind==='bars'?1:0;
      tile.top(kind==='sidewalk'?openMedianSidewalk(plan):plan,height,color,tile===quay?x=>northWaterfrontGrade(x)-.031:undefined);
    }
  }
  market.roadClass=0;quay.roadClass=1;
  const markingColors={cycle:'#739983',lane:'#e3dfcb',yellow:'#d9bb79'} as const;
  for(const key of ['cycle','lane','yellow'] as const){
    for(const plan of extensions.chestnutPaint[key])quay.top(plan,0,markingColors[key],northWaterfrontGrade);
  }
  // The Port-side promenade meets the bay edge of the street curb. Its
  // perimeter and the street facets were cut together by the importer.
  quay.roadClass=0;
  for(const plan of extensions.pierWalk)quay.top(plan,.018,'#c9c7b9',northWaterfrontGrade);
  // Give the formerly flat survey curb an exposed stone face toward the
  // roadway. The top and bottom share its measured grade stations.
  for(let i=1;i<extensions.pierRoadEdge.length;i++){
    const [a,z]=extensions.pierRoadEdge[i-1],[b,w]=extensions.pierRoadEdge[i];
    const h=northWaterfrontGrade(a),k=northWaterfrontGrade(b);
    quay.quad([a,h,z],[a,h+.018,z],[b,k+.018,w],[b,k,w],'#a5a293');
  }
  // Close the two short ends against the adjoining ROW surface.
  for(const [index,back] of [[0,-2.19],[extensions.pierWalkEdge.length-1,-4.36]]){
    const [x,z]=extensions.pierRoadEdge[index],y=northWaterfrontGrade(x);
    const [front,wall]=index===0?[back,z]:[z,back];
    quay.quad([x,y,front],[x,y+.018,front],[x,y+.018,wall],[x,y,wall],'#a5a293');
  }
  // OSM F-line center tracks. Both running rails and their gauge meet the
  // detailed track exactly where its importer clipped the lower corridor.
  for(const [,path] of extensions.rails as [number,number[][]][]){
    for(let i=1;i<path.length;i++){
      const [ax,az]=path[i-1],[bx,bz]=path[i],length=Math.hypot(bx-ax,bz-az);
      if(length===0)continue;
      const nx=(bz-az)/length,nz=(ax-bx)/length;
      for(const sign of [-1,1]){
        const offset=sign*1.435*.06/2,half=.068*.06/2;
        const edge=(x:number,z:number,d:number):Vertex=>[x+nx*d,.062,z+nz*d];
        market.quad(edge(ax,az,offset-half),edge(bx,bz,offset-half),edge(bx,bz,offset+half),edge(ax,az,offset+half),'#a9aaa0');
      }
    }
  }
  // Public Works fixes each trunk center and DBH. A low-poly crown retains
  // the cadence of the avenue without adding draw calls or individual leaves.
  const crown=new THREE.IcosahedronGeometry(1,0).getAttribute('position');
  const leaves=['#71865e','#7e9067','#778b6d','#889774'];
  for(const [id,x,z,dbh] of extensions.trees){
    const h=.06*Math.min(12.5,Math.max(3.5,3+Math.sqrt(dbh||9)*1.45));
    const r=Math.max(.007,dbh*.0254*.03),base=.045;
    for(let side=0;side<4;side++){
      const t=side*Math.PI/2,u=t+Math.PI/2;
      const trunk=(angle:number,y:number):Vertex=>[x+r*Math.cos(angle),y,z+r*Math.sin(angle)];
      market.quad(trunk(t,base),trunk(t,base+h*.55),trunk(u,base+h*.55),trunk(u,base),'#847965');
    }
    const radius=h*(.24+(id%5)*.012),phase=id%31;
    const dx=Math.cos(phase)*radius,dz=Math.sin(phase)*radius;
    for(let i=0;i<crown.count;i+=3){
      const corners:Vertex[]=[];
      for(let j=i;j<i+3;j++){
        const u=crown.getX(j),v=crown.getZ(j);
        corners.push([x+u*dx-v*dz,base+h*(.68+.32*crown.getY(j)),z+u*dz+v*dx]);
      }
      const index=market.vertices(corners,leaves[id%leaves.length]);
      market.indices.push(index,index+1,index+2);
    }
  }
  mesh(market.geometry(),'#ffffff',0,0,0).name='Market Street beyond Montgomery';
  mesh(quay.geometry(),'#ffffff',0,0,0).name='Northern Embarcadero street and pier approaches';
}

export function addSurveyBlocks(mesh:Surface){
  addSightlineStreets(mesh);
  const tiles=new Map<string,Tile>();
  function tileAt(x:number,z:number){
    const key=Math.floor(x/12)+','+Math.floor(z/12);
    let tile=tiles.get(key);
    if(!tile)tiles.set(key,tile=new Tile());
    return tile;
  }
  const at=(plan:Plan)=>tileAt(plan[0][0][0],plan[0][0][1]);
  for(const bed of medianPalmBeds.values())addMedianBedSurface(tileAt(bed.x,bed.z),bed);
  // These four holes run across the sloping back of curb. Their stone
  // outer faces meet the original, varying street finish along the cut.
  for(const bed of curbPalmBeds){
    const tile=tileAt(bed.x,bed.z);
    for(let i=0;i<4;i++){
      const [x,z]=bed.outline[i],[u,v]=bed.outline[(i+1)%4];
      tile.quad([x,bed.grade,z],[u,bed.grade,v],[u,.030,v],[x,.030,z],'#898477');
    }
  }
  addRinconCurbEdge(tileAt(-28,-2));
  const warnings=new Tile(),warningUV=addFremontApproachCurbs(tileAt(-30,-32),warnings);
  const warningGeometry=warnings.geometry();
  warningGeometry.setAttribute('walkPanel',new THREE.Float32BufferAttribute(warningUV,2));
  mesh(warningGeometry,'#ffffff',0,0,0).name='Fremont and Howard detectable warnings';
  addHowardBealeWalk(tileAt(-27,-22));
  addHowardPublicCourtyard(mesh);
  addFolsomPortal(mesh);
  for(const plan of [...bealeSidewalk,...howardSidewalk])at(plan).top(plan,pavement.sidewalk[0],pavement.sidewalk[1]);
  for(const plan of howardStreet)at(plan).top(plan,pavement.street[0],pavement.street[1]);
  // Broad planted beds visible in the registered Beale transit-block aerial.
  // A shallow raised crown darkens their edges without adding leaf cutouts.
  for(const [index,bed] of bealeBeds.entries()){
    const tile=at(bed),ring=bed[0],count=ring.length;
    const cx=ring.reduce((sum,p)=>sum+p[0],0)/count,cz=ring.reduce((sum,p)=>sum+p[1],0)/count;
    const inner=ring.map(([x,z])=>[cx+(x-cx)*.80,cz+(z-cz)*.74]);
    const leaf=['#718062','#788569','#64775e'][index%3];
    for(let i=0;i<count;i++){
      const j=(i+1)%count,a=ring[i],b=ring[j],c=inner[i],d=inner[j];
      tile.quad([a[0],.043,a[1]],[c[0],.061,c[1]],[d[0],.061,d[1]],[b[0],.043,b[1]],'#586c55');
    }
    tile.top([inner],.061,leaf);
  }
  const walkTiles=new Map<number,Tile>();
  addSurveyCurbs(mesh);addPromenadeCrossings(mesh);addTransbayCrossings(mesh);addFremontMarkings(mesh);addHowardBealeThroughPaint(mesh);
  for(const [kind,polygons] of Object.entries(survey.streets)){
    const [height,color]=pavement[kind];
    for(const [i,polygon] of polygons.entries())for(const piece of fremontPavingRemainder(kind,i)??folsomPavement[kind]?.[i]??replacementPavement(kind,i,polygon)){
      if(kind==='sidewalk'&&piece[0].some(([x,z])=>x>=-56&&x<=30&&z>=-8&&z<=2)){
        const id=Math.floor(piece[0][0][0]/12);let tile=walkTiles.get(id);
        if(!tile)walkTiles.set(id,tile=new Tile());
        tile.top(openMedianSidewalk(piece),height,'#c4bdac');
      }else{
        const tile=at(piece);
        tile.roadClass=kind==='street'?1:kind==='alley'||kind==='private'?2:0;
        if(kind==='street'&&i===91){
          tile.top([...piece,howardMissionAsphalt],height,color);
          tile.top([howardMissionAsphalt],height,'#707e7d');
        }else tile.top(kind==='sidewalk'?openMedianSidewalk(piece):piece,height,color);
        tile.roadClass=0;
      }
    }
  }
  for(const [id,tile] of walkTiles){
    const geometry=tile.geometry();walkPanelCoordinates(geometry);
    mesh(geometry,'#ffffff',0,0,0).name='Promenade sidewalk slabs '+id;
  }
  const masonry=['#c0b59f','#b8b5a2','#c6b39e','#abae9f'];
  for(const [i,[height,plan]] of (survey.buildings as [number,Plan][]).entries()){
    if(addDonCheeVent(mesh,plan[0]))continue;
    const tile=at(plan);
    walls(tile,plan,height,masonry[i%masonry.length],false);
    tile.top(plan,height,'#afa998');
  }
  for(const [key,tile] of tiles)mesh(tile.geometry(),'#ffffff',0,0,0).name='Surveyed streets and buildings '+key;
}
