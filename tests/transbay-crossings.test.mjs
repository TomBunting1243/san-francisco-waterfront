import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {addTransbayCrossings,transbayCrossings} from '../app/transbay-crossings.ts';

const data=name=>JSON.parse(readFileSync(new URL('../public/data/'+name+'.json',import.meta.url)));
const roads=data('survey-blocks').streets,curbs=data('curb-survey');
const c=.988686,s=-.150004,root=new THREE.Group();
addTransbayCrossings((g,paint,x,y,z)=>{const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:paint}));mesh.position.set(x,y,z);root.add(mesh);return mesh;});
function at(name,x,y){
  const site=transbayCrossings.find(site=>site.name===name),u=(x-300)/200,v=(y-300)/200;
  return [site.center[0]+c*u-s*v,site.center[1]+s*u+c*v];
}
function painted(name,x,y){
  const [X,Z]=at(name,x,y);
  const ray=new THREE.Raycaster(new THREE.Vector3(X,.06,Z),new THREE.Vector3(0,-1,0));
  return ray.intersectObjects(root.children).length>0;
}
test('five registered intersections retain twenty independently traced approaches',()=>{
  assert.equal(root.children.length,5);
  assert.deepEqual(transbayCrossings.map(site=>site.legs.map(leg=>leg.marks.length)),
    [[11,10,9,10],[11,12,9,10],[10,11,10,9],[12,10,9,8],[13,11,9,13]]);
  for(const site of transbayCrossings){
    assert.deepEqual(site.legs.map(l=>l.side),['inland','bay','south','north']);
    for(const leg of site.legs){
      assert.ok(leg.marks.length>=8&&leg.marks.length<=13);
      const [a,b]=leg.axis,span=Math.hypot(a[0]-b[0],a[1]-b[1])/.06;
      assert.ok(span>10&&span<18);
    }
  }
});
test('actual bright bars and observed gaps include the diagonal ramp approach and bus occlusion',()=>{
  for(const [site,x,y] of [['Mission / Main',196,177],['Mission / Main',172,282],['Mission / Beale',181,270],['Howard / Main',250,175],['Howard / Beale',449,269]])
    assert.ok(painted(site,x,y),site+' expected '+x+','+y);
  for(const [site,x,y] of [['Mission / Main',204,177],['Mission / Main',172,289],['Mission / Beale',449,261],['Howard / Main',260,175],['Howard / Beale',449,280]])
    assert.equal(painted(site,x,y),false,site+' gap '+x+','+y);
});
test('Howard and Spear retains narrow shadowed bars, wide approach bars and unpainted gaps',()=>{
  const site='Howard / Spear';
  for(const [x,y] of [[235,176],[356.8,177],[275.5,428],[400,427],[194,274],[201,378.7],[448,231],[451,341]]){
    assert.ok(painted(site,x,y),site+' observed paint '+x+','+y);
  }
  for(const [x,y] of [[244,175],[335,177],[273,428],[194,342],[451,235],[480,341],[300,300]]){
    assert.equal(painted(site,x,y),false,site+' observed gap '+x+','+y);
  }
});
test('the three observed limit lines have their own extents outside the 46 crossing bars',()=>{
  const name='Howard / Spear',site=transbayCrossings.find(s=>s.name===name);
  assert.equal(site.legs.reduce((n,leg)=>n+leg.marks.length,0),46);
  assert.deepEqual(site.stopBars.map(b=>b.approach),['Howard eastbound','Howard westbound','Spear southbound']);
  for(const [x,y] of [[241,111.9],[260,111],[277,112],[281,494],[310,494],[345,495],[514,221],[514,260],[515,326],[515,345]])
    assert.equal(painted(name,x,y),true,'missing limit line '+x+','+y);
  for(const [x,y] of [[238,112],[280,112],[260,108],[260,115],[278,494],[348,494],[312,490],[312,498],[511,258],[518,259],[515,217],[515,349]])
    assert.equal(painted(name,x,y),false,'paint beyond traced limit '+x+','+y);
});
function inside(x,z,ring){
  let hit=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [a,b]=ring[i],[c,d]=ring[j];if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)hit=!hit;
  }
  return hit;
}
function polygons(kind){
  return roads[kind].flatMap((p,i)=>curbs.overrides[kind]?.[i]??[p]).map(([r,...holes])=>{
    const xs=r.map(a=>a[0]),zs=r.map(a=>a[1]);return {r,holes,box:[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)]};
  }).filter(({box:[x,z,X,Z]})=>x<-13&&X>-30&&z<-11&&Z>-30);
}
function covers(x,z,list){return list.some(({r,holes,box:[l,t,R,B]})=>x>=l&&x<=R&&z>=t&&z<=B&&inside(x,z,r)&&!holes.some(h=>inside(x,z,h)));}
test('paint triangles sit on surveyed roadway and avoid sidewalk and curb polygons',()=>{
  const street=polygons('street'),raised=[...polygons('sidewalk'),...polygons('curb')];
  let count=0;
  for(const m of root.children){
    const {position:p,normal:n}=m.geometry.attributes;
    for(let i=0;i<p.count;i+=3){
      const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
      assert.ok(covers(x,z,street));assert.equal(covers(x,z,raised),false);
      for(let k=i;k<i+3;k++){
        assert.ok(p.getY(k)>=.031239&&p.getY(k)<=.032241);assert.ok(n.getY(k)>.98);
      }
      count++;
    }
  }
  assert.ok(count>280&&count<1500);
});

test('at Howard and Spear each marked bar is exposed over the assembled municipal road surface',async()=>{
  const {addSurveyBlocks}=await import('../app/survey-blocks.ts');
  const survey=new THREE.Group();
  addSurveyBlocks((g,tint,x,y,z)=>{
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:tint}));
    m.position.set(x,y,z);survey.add(m);return m;
  });
  survey.updateMatrixWorld(true);
  const name='Howard / Spear',paint=survey.getObjectByName('Crosswalk paint · '+name);
  const site=transbayCrossings.find(s=>s.name===name);
  const area=([a,b,c])=>Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
  const ray=new THREE.Raycaster();ray.ray.direction.set(0,-1,0);
  function checkSurface(tri,label){
    ray.ray.origin.set(tri.reduce((sum,v)=>sum+v[0],0)/3,.055,tri.reduce((sum,v)=>sum+v[1],0)/3);
    const hits=ray.intersectObjects(survey.children,false);
    assert.equal(hits[0]?.object.name,paint.name,label+' paint occluded');
    assert.equal(hits.filter(h=>h.object===paint).length,1,label+' overlapping paint');
    const support=hits.find(hit=>hit.object!==paint);
    assert.ok(support&&Math.abs(hits[0].point.y-support.point.y-.00024)<.00002,label+' paint has no matching surface');
  }
  for(const leg of site.legs)for(const mark of leg.marks)
    checkSurface(mark.reduce((best,t)=>area(t)>area(best)?t:best),leg.side);
  for(const bar of site.stopBars)for(const tri of bar.triangles)checkSurface(tri,bar.approach);
});
