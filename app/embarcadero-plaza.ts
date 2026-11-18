import * as THREE from 'three';
import {westMarketGround,westParkPlans} from './curb-survey.ts';
import {fountainPavingCut} from './remembered-waterfront.ts';
import {cutPavingAtBasin} from './vaillancourt-plan.ts';
import {waterfrontTree} from './waterfront-trees.ts';
import landscape from '../public/data/waterfront-landscape.json' with {type:'json'};

type Plan=[number,number];
type Grade=(x:number,z:number)=>number;
const point=(u:number,v:number):Plan=>[-8+u/80,-12+v/80];
const trace=(pixels:number[][])=>pixels.map(([u,v])=>point(u,v));
const level=(y:number):Grade=>()=>y;
// The 2024 pre-removal SF aerial (p2024_rgb8cm), in scene coordinates at
// 80 px/unit. A 2023 USGS 1.5 m DSM/ground transect gives ~3.4 m along the
// upper allée and 2.9–3.1 m in the brick room. Grades are relative to the
// adjacent Market pedestrian crossing in the miniature's waterfront datum.
// https://embarcaderoplaza.com/history
// https://sfmea.sfplanning.org/Appendix%206%20-%20Cultural%20Resources%20Supporting%20Material.pdf
const brickGrade:Grade=(x,z)=>.127-.0012*(x-2)+.0008*(z+8);
const stepFront=trace([[711,238],[731,198],[882,169],[895,134],[1006,114],[1162,184]]);
const brickBoundary=trace([[675,288],[711,238],[731,198],[882,169],[895,134],[1006,114],[1162,184],
  [1161,251],[1133,275],[1118,339],[1091,368],[973,385],[949,383],[851,357],
  [832,358],[816,368],[778,369],[761,354],[697,362],[680,359]]);
const sidewalk='#b5ac98',apron='#c0b6a0',granite='#bbad98',grass='#929f69',clay='#ad8273';
const sidewalkMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95});

class Paving{
  positions:number[]=[];colors:number[]=[];
  pigments=new Map<string,THREE.Color>();
  polygon(ring:number[][],height:Grade,color:string,cut=false){
    const shape=ring.map(([x,z])=>new THREE.Vector2(x,z));
    const triangles=THREE.ShapeUtils.triangulateShape(shape,[]);
    for(const ids of triangles){
      const face=ids.map(i=>ring[i]);
      const parts=cut?cutPavingAtBasin(face,fountainPavingCut):[face];
      for(const part of parts)for(let j=1;j<part.length-1;j++){
        const [a,b,c]=[part[0],part[j],part[j+1]];
        const area=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
        if(Math.abs(area)<1e-10)continue;
        let paint=this.pigments.get(color);if(!paint){paint=new THREE.Color(color);this.pigments.set(color,paint);}
        for(const [x,z] of area>0?[a,c,b]:[a,b,c]){
          this.positions.push(x,height(x,z),z);this.colors.push(paint.r,paint.g,paint.b);
        }
      }
    }
  }
  mesh(name:string,material:THREE.MeshStandardMaterial=sidewalkMat){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    geometry.userData.paintVertices=true;geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.receiveShadow=true;return mesh;
  }
}

function brickMaterial(){
  // Centimetre-scale joints fade below a pixel instead of turning into a distant checkerboard.
  const material=new THREE.MeshStandardMaterial({color:clay,roughness:.91});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 plazaPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nplazaPosition=position.xz;');
    shader.fragmentShader='varying vec2 plazaPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 q=mat2(.985,.172,-.172,.985)*plazaPosition/.0061;
      vec2 cell=floor(q);vec2 f=fract(q);float lane=mod(cell.x-cell.y,4.);
      vec2 p=lane<2.?vec2(.5*(lane+f.x),f.y):vec2(f.x,.5*(3.-lane+f.y));
      float lod=1.-smoothstep(.18,.85,max(fwidth(q.x),fwidth(q.y)));
      float edge=min(min(p.x,1.-p.x)*2.,min(p.y,1.-p.y));
      float joint=(1.-smoothstep(.014,.07,edge))*lod;
      diffuseColor.rgb*=1.+.13*joint;
      diffuseColor.rgb*=.975+.025*sin(plazaPosition.x*.97+plazaPosition.y*1.91);
    `);
  };
  return material;
}
function strip(field:Paving,a:Plan,b:Plan,width:number,height:Grade,paint:string){
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len*width/2,nz=dx/len*width/2;
  field.polygon([[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]],height,paint);
}
function circle(field:Paving,u:number,v:number,r:number,height:Grade,paint:string){
  field.polygon(Array.from({length:48},(_,i)=>point(u+r*Math.cos(i*Math.PI/24),v+r*Math.sin(i*Math.PI/24))),height,paint);
}
function upperTerrace(field:Paving){
  // The photographed flight turns twice near the restaurant. Continuous mitered
  // step bands connect the upper granite terrace to the open brick court.
  const end=trace([[703,236],[724,192],[876,163],[890,128],[1007,108],[1165,178]]);
  const back=trace([[1180,136],[1009,55],[818,78],[733,96]]);
  field.polygon([...end,...back],level(.163),sidewalk);
  for(let i=1;i<end.length;i++){
    const lerp=(a:Plan,b:Plan,t:number):Plan=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    for(let j=0;j<4;j++){
      const l=lerp(stepFront[i-1],end[i-1],j/4),r=lerp(stepFront[i],end[i],j/4);
      const lb=lerp(stepFront[i-1],end[i-1],(j+1)/4),rb=lerp(stepFront[i],end[i],(j+1)/4);
      const h=.134+j*.0095;field.polygon([l,r,rb,lb],level(h),j%2?apron:granite);
      // Vertical nose explicitly joins each tread to the one below.
      const paint=new THREE.Color('#a79884');
      for(const [p,y] of [[l,h],[r,h-.010],[r,h],[l,h],[l,h-.010],[r,h-.010]] as const){
        field.positions.push(p[0],y,p[1]);field.colors.push(paint.r,paint.g,paint.b);
      }
    }
  }
}

// Crown centers and group spacing are read from the same orthophoto. Heights
// (metres) sample nearby above-ground returns; individual species are uncertain.
const allee=[
  [772,138,5.1],[802,132,3.4],[832,127,4.8],[862,123,3.7],[891,119,4.9],[918,114,4.9],[949,109,4.6],[978,104,4.1],
  [780,116,4.4],[811,112,3.7],[840,107,4.9],[867,102,4.9],[898,96,4.6],[925,91,4.2],[951,86,4.6],[978,82,6.1],
];
const hyattRow=[[112,308,6.2],[145,302,6.0],[166,298,6.3],[197,292,9.9],[224,286,7.7],[254,281,9.9],[285,274,7.7],[323,269,6.0],[358,262,7.5]];
const crescentTrees=[[1180,239,20.9,7.1],[1155,291,19.8,6.4],[1120,369,13.1,6.2],[1092,403,6.1,5.1],[1062,411,5.5,4.3]];
function fountainWalk(field:Paving){
  // Long curved promenade wraps the sculpture's straight galleries. The thin
  // outside curb, inner planting beds and two access paths break at the lawn.
  const outer=trace([[1172,223],[1187,251],[1196,281],[1199,308],[1196,337],[1188,362],[1174,388],
    [1153,409],[1128,427],[1098,439],[1066,446],[1035,446],[997,437],[978,422],[961,394]]);
  const inner=trace([[1158,230],[1172,257],[1182,284],[1185,308],[1182,334],[1174,357],[1162,378],
    [1144,398],[1121,415],[1093,427],[1063,433],[1036,433],[1005,425],[990,415],[976,388]]);
  field.polygon([...outer,...[...inner].reverse()],level(.147),'#a6a193');
  for(let i=1;i<outer.length;i++)strip(field,outer[i-1],outer[i],.016,level(.151),'#c8c3ae');
  field.polygon([...inner,...trace([[972,371],[1105,360],[1149,249]])],level(.142),'#a5a48b',true);
}
function plantRows(root:THREE.Group,field:Paving){
  const materials=new Map<string,THREE.MeshStandardMaterial>();
  const rows=new THREE.Group();rows.name='Surveyed plaza tree rows';root.add(rows);
  for(const [i,[u,v,h]] of [...allee,...hyattRow,...crescentTrees].entries()){
    const [x,z]=point(u,v),edge=i-allee.length-hyattRow.length,top=i<allee.length?.163:edge<0?.139:.142;
    circle(field,u,v,2.2,level(top+.001),'#807b64');
    const group=new THREE.Group();group.position.set(x,top,z);rows.add(group);
    waterfrontTree((g,color,px,py,pz)=>{
      let mat=materials.get(color);if(!mat){mat=new THREE.MeshStandardMaterial({color,roughness:.95});materials.set(color,mat);}
      const mesh=new THREE.Mesh(g,mat);mesh.position.set(px,py,pz);group.add(mesh);return mesh;
    },0,0,0,-917100-i,h*.06,'');
    if(edge>=0){
      const size=new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
      const scale=crescentTrees[edge][3]*.06/Math.sqrt(size.x*size.z);
      group.scale.set(scale,1,scale);
    }
  }
}

// Sample the final paving, including the north terrace's separate sloped brick layer.
export function plazaStandingHeight(plaza:THREE.Group,x:number,z:number){
  const floor=plaza.children.filter(o=>o.name==='Granite terraces, lawns and walks'||o.name==='Halprin brick court');
  const ray=new THREE.Raycaster(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0));
  return ray.intersectObjects(floor,false)[0]?.point.y??westMarketGround(x,z)+.00035;
}

export function embarcaderoPlaza(){
  const root=new THREE.Group();root.name='Embarcadero Plaza before fountain removal';
  const field=new Paving(),bricks=new Paving();
  // The promenade occupies the cut between these two surveyed park polygons.
  // Its own sloped granite bands meet this surface at the cut boundary.
  for(const [outer] of westParkPlans)field.polygon(outer,level(outer.some(([x])=>x>0)?.116:.139),sidewalk,true);
  const marketEdge:Plan[]=[[.262,-6.548],[-.184,-9.066]];
  const [a,b]=marketEdge;
  const ramp=[a,b,[b[0]+.20,b[1]],[a[0]+.20,a[1]]];
  field.polygon(ramp,(x,z)=>.139-.023*Math.min(1,Math.max(0,(x-(a[0]+(z-a[1])*(b[0]-a[0])/(b[1]-a[1])))/.20)),sidewalk);
  bricks.polygon(brickBoundary,brickGrade,'#ffffff',true);
  upperTerrace(field);
  // The two green lawns flank the round stone landing, visible between Market
  // and the fountain. Their mapped edges preserve the diagonal access walks.
  for(const area of landscape.areas.filter(a=>[196670573,196670574,196670576].includes(a.id))){
    field.polygon(area.p,level(.140),grass);
    for(let i=1;i<area.p.length;i++)strip(field,area.p[i-1] as Plan,area.p[i] as Plan,.016,level(.142),apron);
  }
  circle(field,798,344,34,level(.143),apron);
  circle(field,798,344,27,level(.144),'#aaa592');
  // Rectangular lawn and long recessed rectangle beside the hotel, separate
  // from the clay plaza; pale walk encloses the grass on all four sides.
  field.polygon(trace([[143,319],[377,282],[395,387],[158,423]]),level(.141),apron);
  field.polygon(trace([[159,324],[373,294],[387,383],[169,414]]),level(.144),grass);
  field.polygon(trace([[221,330],[367,308],[377,361],[229,383]]),level(.146),'#c5c1b2');
  field.polygon(trace([[229,334],[363,314],[369,338],[234,359]]),level(.147),'#aaa99c');
  // Two courts appear together in the 2024 orthophoto. Mark their playing
  // surfaces at real size while retaining the surrounding brick pavement.
  for(const area of landscape.areas.filter(a=>[1442051147,1442051148].includes(a.id))){
    const [a,d,c,b]=area.p as Plan[];
    const at=(u:number,v:number):Plan=>[(1-v)*((1-u)*a[0]+u*b[0])+v*((1-u)*d[0]+u*c[0]),(1-v)*((1-u)*a[1]+u*b[1])+v*((1-u)*d[1]+u*c[1])];
    const surface=[a,b,c,d],top=.136;
    field.polygon(surface,level(top),'#859069');
    for(const u of [.10,.335,.665,.90])strip(field,at(u,.17),at(u,.83),.0035,level(top+.001),'#d4d6b9');
    for(const v of [.17,.83])strip(field,at(.1,v),at(.9,v),.0035,level(top+.001),'#d4d6b9');
    strip(field,at(.10,.5),at(.335,.5),.0035,level(top+.001),'#d4d6b9');
    strip(field,at(.665,.5),at(.90,.5),.0035,level(top+.001),'#d4d6b9');
  }
  fountainWalk(field);
  plantRows(root,field);
  root.add(field.mesh('Granite terraces, lawns and walks'),bricks.mesh('Halprin brick court',brickMaterial()));
  return root;
}
