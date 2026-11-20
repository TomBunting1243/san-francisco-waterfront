import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import survey from '../public/data/sightline-streets.json' with {type:'json'};
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {northWaterfrontGrade} from '../app/north-quay-grade.ts';

const colors={cycle:'739983',lane:'e3dfcb',yellow:'d9bb79'};
const layers={street:survey.street,...survey.chestnutPaint};
const plans=Object.entries(layers).flatMap(([kind,polygons])=>polygons.map(rings=>{
  const xs=rings[0].map(p=>p[0]);
  return {kind,rings,left:Math.min(...xs),right:Math.max(...xs)};
})).filter(p=>p.right>=79.8&&p.left<=95);

function slices(x){
  const intervals=[];
  for(const {rings,left,right,kind} of plans){
    if(x<=left||x>=right)continue;
    const cuts=[];
    for(const ring of rings)for(let i=0;i<ring.length;i++){
      const [a,z]=ring[i],[b,w]=ring[(i+1)%ring.length];
      if((a>x)!==(b>x))cuts.push(z+(w-z)*(x-a)/(b-a));
    }
    cuts.sort((a,b)=>a-b);
    for(let j=0;j<cuts.length;j+=2)intervals.push([cuts[j],cuts[j+1],kind]);
  }
  return intervals.sort((a,b)=>a[0]-b[0]);
}

test('Chestnut asphalt and all three paint colors partition the surveyed street through its full bend',()=>{
  const cuts=[...new Set([79.8,95,...plans.flatMap(p=>p.rings.flat().map(v=>v[0])).filter(x=>x>79.8&&x<95)])].sort((a,b)=>a-b);
  let area=0;
  for(let i=1;i<cuts.length;i++){
    const low=cuts[i-1],high=cuts[i],mid=(low+high)/2;
    let previous=-Infinity;
    for(const [a,b] of slices(mid)){
      assert.ok(a>=previous-.000002,'overlap at '+mid);
      area+=(high-low)*(b-a);previous=b;
    }
  }
  // From the unsplit SFMTA street polygons, including the island and pier entry.
  assert.ok(Math.abs(area-33.586104955)<.000001);
  const expected=[
    [80.7,[-5.93046,-5.74862,-4.8951,-4.222,-3.91073,-3.50954,-3.31442,-2.12612]],
    [81.65,[-6.12677,-2.82168]],[83.23,[-5.42416,-3.13454]],
    [85.77,[-5.87399,-5.03263,-4.94237,-4.49833,-4.34284,-3.63834]],
    [90.11,[-6.71497,-6.08393,-5.83375,-5.38359,-5.21386,-4.49992]],
    [94.77,[-8.05784,-7.56106,-7.42629,-6.95883,-6.81845,-5.28875]],
  ];
  for(const [x,edges] of expected){
    const merged=[];
    for(const [a,b] of slices(x)){
      if(merged.length&&a-merged.at(-1)<.000002)merged[merged.length-1]=b;
      else merged.push(a,b);
    }
    assert.equal(merged.length,edges.length);
    merged.forEach((edge,i)=>assert.ok(Math.abs(edge-edges[i])<.00001));
  }
});

test('paint triangles follow the same grade as the asphalt and hit the photographed marks',()=>{
  const root=new T.Group();addSurveyBlocks(g=>{const m=new T.Mesh(g);root.add(m);return m;});
  const tile=root.getObjectByName('Northern Embarcadero street and pier approaches');
  const g=tile.geometry,p=g.attributes.position,c=g.attributes.color,rgb=new T.Color(),sum={};
  for(let i=0;i<g.index.count;i+=3){
    const ids=[0,1,2].map(j=>g.index.getX(i+j)),color=rgb.fromBufferAttribute(c,ids[0]).getHexString();
    if(!Object.values(colors).includes(color))continue;
    const [a,b,d]=ids.map(id=>new T.Vector3().fromBufferAttribute(p,id));
    for(const v of [a,b,d,a.clone().add(b).add(d).divideScalar(3)])
      assert.ok(Math.abs(v.y-northWaterfrontGrade(v.x))<.000001,'paint height at '+v.x);
    const area=((b.z-a.z)*(d.x-a.x)-(b.x-a.x)*(d.z-a.z))/2;
    assert.ok(area>=-.00000003,'reversed paint face');sum[color]=(sum[color]??0)+area;
  }
  const ringArea=ring=>Math.abs(ring.reduce((a,[x,z],i)=>a+x*ring[(i+1)%ring.length][1]-z*ring[(i+1)%ring.length][0],0))/2;
  for(const [key,color] of Object.entries(colors)){
    const area=survey.chestnutPaint[key].reduce((a,[shell,...holes])=>a+ringArea(shell)-holes.reduce((s,h)=>s+ringArea(h),0),0);
    assert.ok(Math.abs(sum[color]-area)<.00001,'triangulated footprint for '+key);
  }
  const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
  // Independent pixel picks on the sheared orthophoto, in each carriageway,
  // through the crossing, pier access gap, yellow panel and northern curve.
  for(const [u,v,kind] of [[155,58,'lane'],[196,246,'lane'],[326,116,'yellow'],
     [470,257,'lane'],[610,284,'cycle'],[1050,285,'cycle'],[1308,278.5,'cycle'],
     [1505,259,'cycle'],[304,284,'street'],[490,246,'street']]){
    const x=80+u/112,z=-11+(660+v-.2*u)/112;
    ray.ray.origin.set(x,2,z);const hits=ray.intersectObject(tile);
    assert.equal(hits.length,1,'surface count at '+[u,v]);
    assert.equal(rgb.fromBufferAttribute(c,hits[0].face.a).getHexString(),colors[kind]??'899692','ortho pick '+[u,v]);
  }
});
