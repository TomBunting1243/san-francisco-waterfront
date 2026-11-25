import * as THREE from 'three';

const griffon = 193054133, harborCourt = 193054138;
const grade = .045, scale = .06;
export const griffonStreetRoof = grade + 14.1 * scale;
const setback = 11 * scale;
const eastPavilionDepth = 3.25 * scale;

export function steuartHotelRoof(id:number) {
  if (id === griffon) return grade + 18.1 * scale;
  if (id === harborCourt) return grade + 17.5 * scale;
}

type Hotel = { id:number; p:number[][]; h:number };
export function steuartHotelPlan(b:Hotel) {
  if (steuartHotelRoof(b.id) === undefined) return;
  const ring = b.p.slice(0, -1);
  // Both mapped street walls follow Steuart. The nearest edge to the street
  // in its local survey axes is the full-width entrance elevation.
  let edge = 0, eastEdge = 0, minimum = Infinity, maximum = -Infinity;
  for (let i=0; i<ring.length; i++) {
    const p=ring[i], q=ring[(i+1)%ring.length];
    const score=(p[1]+q[1]+.15*(p[0]+q[0]))/2;
    if (score>maximum) { eastEdge=i; maximum=score; }
    if (score<minimum) { edge=i; minimum=score; }
  }
  const a=ring[edge], end=ring[(edge+1)%ring.length];
  const x=(a[0]+end[0])/2, z=(a[1]+end[1])/2;
  const length=Math.hypot(end[0]-a[0],end[1]-a[1]);
  const iz=Math.abs(end[0]-a[0])/length, ix=-(end[1]-a[1])/(end[0]-a[0])*iz;
  const depth=(px:number,pz:number)=>(px-x)*ix+(pz-z)*iz;
  const ea=ring[eastEdge],eb=ring[(eastEdge+1)%ring.length];
  const ex=(ea[0]+eb[0])/2,ez=(ea[1]+eb[1])/2;
  const eastLength=Math.hypot(eb[0]-ea[0],eb[1]-ea[1]);
  const dx=Math.sign(eb[0]-ea[0])*(eb[1]-ea[1])/eastLength;
  const dz=-Math.abs(eb[0]-ea[0])/eastLength;
  const fromBay=(p:number[])=>dx*(p[0]-ex)+dz*(p[1]-ez);
  const height=(px:number,pz:number)=>b.id===griffon && depth(px,pz)<setback ? griffonStreetRoof : b.h;
  return {edge,eastEdge,ring,x,z,ex,ez,depth,height,fromBay};
}

// The facade owns its front wall and door reveals. This mesh supplies only
// roof plates, the step between them and the remaining perimeter walls.
export function steuartHotelShell(b:Hotel, plan:NonNullable<ReturnType<typeof steuartHotelPlan>>) {
  const {ring,edge,eastEdge,depth,fromBay}=plan, vertices:number[]=[];
  const westDistance=(p:number[])=>depth(p[0],p[1])-setback;
  const eastDistance=(p:number[])=>fromBay(p)-eastPavilionDepth;
  function clip(poly:number[][],distance:(p:number[])=>number) {
    const result:number[][]=[],cuts:number[][]=[];
    for(let i=0;i<poly.length;i++) {
      const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b);
      if(da>=0)result.push(a);
      if((da>=0)!==(db>=0)){
        const t=da/(da-db),p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
        result.push(p);cuts[da>=0?0:1]=p;
      }
    }
    return {result,cuts};
  }
  const area=ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
  function wall(p:number[],q:number[],bottom:number,top:number) {
    if(area<0) [p,q]=[q,p];
    const a=[p[0],bottom,p[1]],c=[q[0],bottom,q[1]],d=[q[0],top,q[1]],f=[p[0],top,p[1]];
    vertices.push(...a,...f,...d,...a,...d,...c);
  }
  function plate(poly:number[][],y:number) {
    const outline=poly.map(([px,pz])=>new THREE.Vector2(px,pz));
    for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(outline,[])) {
      for(const index of [i,k,j]) vertices.push(poly[index][0],y,poly[index][1]);
    }
  }
  for(let i=0;i<ring.length;i++) {
    if(i===edge||b.id===griffon&&i===eastEdge)continue;
    const p=ring[i],q=ring[(i+1)%ring.length];
    if(b.id!==griffon){wall(p,q,0,b.h);continue;}
    const ts=[0,1];
    for(const distance of [westDistance,eastDistance]){
      const dp=distance(p),dq=distance(q);
      if((dp>0)!==(dq>0))ts.push(dp/(dp-dq));
    }
    ts.sort((a,b)=>a-b);
    const at=(t:number)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
    for(let j=1;j<ts.length;j++){
      const mid=at((ts[j]+ts[j-1])/2);
      const high=westDistance(mid)>=0&&eastDistance(mid)>=0;
      wall(at(ts[j-1]),at(ts[j]),0,high?b.h:griffonStreetRoof);
    }
  }
  if(b.id===griffon) {
    const high=clip(ring,westDistance);
    plate(clip(ring,p=>-westDistance(p)).result,griffonStreetRoof);
    plate(clip(high.result,eastDistance).result,b.h);
    wall(high.cuts[0],high.cuts[1],griffonStreetRoof,b.h);
    // The two photographed bay pavilions own their roof caps, sidewalls
    // and the recessed center terrace in the final 3.25 metres.
  } else plate(ring,b.h);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  return geometry;
}
