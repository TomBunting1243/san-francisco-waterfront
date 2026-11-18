import * as THREE from 'three';
import survey from '../public/data/roof-pitches.json' with {type:'json'};

type Plan=number[][];
type Plane=readonly [xSlope:number,zSlope:number,height:number];
type RecordRow=[x:number,z:number,planes:Plane[],samples:number,errorMetres:number];
export type RoofPitch={x:number;z:number;planes:readonly Plane[];eave:number};
const records=survey.pitches as unknown as Record<string,RecordRow>;

function height(p:number[],pitch:Pick<RoofPitch,'x'|'z'>,plane:Plane){
  return plane[2]+(p[0]-pitch.x)*plane[0]+(p[1]-pitch.z)*plane[1];
}
function roofY(p:number[],pitch:RoofPitch){
  return Math.min(...pitch.planes.map(plane=>height(p,pitch,plane)));
}
export function surveyedRoofPitch(b:{id:number;p:Plan;measured?:boolean;part?:boolean;minH?:number},nominal:number):RoofPitch|undefined{
  const row=records[b.id];
  if(!row||b.part||b.p.length<3)return;
  const [x,z,planes]=row;
  const pitch={x,z,planes,eave:Infinity};
  const ys=b.p.map(p=>roofY(p,pitch));
  pitch.eave=Math.min(...ys);
  const centerY=Math.min(...planes.map(p=>p[2]));
  if(pitch.eave<(b.minH??0)+.095||b.measured&&Math.abs(centerY-nominal)>Math.max(.30,nominal*.20))return;
  return pitch;
}

/** Clip the roof skin to the plane intersection. Only original exterior edges
 * receive vertical infill, so there is no wall down the ridge or between triangles. */
export function surveyedPitchGeometry(plan:Plan,pitch:RoofPitch,wallColor:THREE.ColorRepresentation,roofColor:THREE.ColorRepresentation){
  const points=plan.slice();
  if(points.length>1&&points[0][0]===points.at(-1)![0]&&points[0][1]===points.at(-1)![1])points.pop();
  const ring=points.map(([x,z])=>new THREE.Vector2(x,z));
  const clockwise=THREE.ShapeUtils.isClockWise(ring);
  const triangles=THREE.ShapeUtils.triangulateShape(ring,[]);
  const positions:number[]=[],colors:number[]=[];
  const wall=new THREE.Color(wallColor),roof=new THREE.Color(roofColor);
  function triangle(a:number[],b:number[],c:number[],color:THREE.Color){
    positions.push(...a,...b,...c);
    for(let k=0;k<3;k++)colors.push(color.r,color.g,color.b);
  }
  const [first,second]=pitch.planes;
  const delta=(p:number[])=>height(p,pitch,first)-height(p,pitch,second);
  function seam(a:number[],b:number[],d:number,e:number){
    const u=d/(d-e);return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
  }
  function clip(poly:Plan,sign:number){
    const out:Plan=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],d=delta(a),e=delta(b);
      if(sign*d<=0)out.push(a);
      if(d*e<0)out.push(seam(a,b,d,e));
    }
    return out;
  }
  for(const indices of triangles){
    const face=indices.map(i=>points[i]);
    pitch.planes.forEach((plane,k)=>{
      const side=second?clip(face,k===0?1:-1):face;
      const verts=side.map(p=>[p[0],height(p,pitch,plane),p[1]]);
      for(let i=1;i<verts.length-1;i++)triangle(verts[0],verts[i+1],verts[i],roof);
    });
  }
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],segments=[a];
    if(second&&delta(a)*delta(b)<0)segments.push(seam(a,b,delta(a),delta(b)));
    segments.push(b);
    for(let j=1;j<segments.length;j++){
      const [p,q]=clockwise?[segments[j-1],segments[j]]:[segments[j],segments[j-1]];
      const py=roofY(p,pitch),qy=roofY(q,pitch);
      const l=[p[0],pitch.eave,p[1]],r=[q[0],pitch.eave,q[1]],u=[p[0],py,p[1]],v=[q[0],qy,q[1]];
      if(qy>pitch.eave+1e-6)triangle(l,r,v,wall);
      if(py>pitch.eave+1e-6)triangle(l,v,u,wall);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();g.userData.paintVertices=true;
  return g;
}
