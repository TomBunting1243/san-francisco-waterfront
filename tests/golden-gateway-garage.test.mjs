import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import data from '../public/data/waterfront-landscape.json' with {type:'json'};
import {neighborhoodDetail} from '../app/neighborhood-detail.ts';
import {sfMap,footprintGeometry,polygonArea} from '../app/sf-map.ts';
import {addGoldenGatewayGarage,refineMaritimeLandings} from '../app/golden-gateway-garage.ts';

const root=new THREE.Group(),lights=[];
for(const id of [1177704958,104682205])assert.ok(addGoldenGatewayGarage(sfMap.buildings.find(b=>b.id===id),root,lights));
const garage=root.children[0],east=root.children[1];
const a=sfMap.buildings.find(b=>b.id===1177704958).p;
const den=Math.hypot(a[6][0]-a[1][0],a[6][1]-a[1][1]),ux=(a[6][0]-a[1][0])/den,uz=(a[6][1]-a[1][1])/den;
const p=(u,y,v)=>new THREE.Vector3(a[1][0]+u*ux-v*uz,y,a[1][1]+u*uz+v*ux);
const down=new THREE.Vector3(0,-1,0),ray=new THREE.Raycaster();
function grade(u,v,object=root){ray.set(p(u,2,v),down);return ray.intersectObject(object)[0]?.point.y}
const near=(v,w,t=.003)=>assert.ok(Math.abs(v-w)<t,JSON.stringify({observed:v,expected:w}));

test('deck receives the two existing Clay bridges, two Washington bridges and five mapped street stairs',()=>{
  for(const id of [727134923,104682204,104682192,104682199]){
    const path=data.paths.find(p=>p.id===id),points=path.p;
    const onClay=id===727134923||id===104682204;
    if(onClay){
      const u=id===727134923?2.42:8.50;
      near(grade(u,.225),.501,.004);near(grade(u,.84),.425);
      assert.equal(grade(u,-.82),undefined,'Existing crossing is owned by Embarcadero Center');
    }else{
      const [x,z]=points[0],last=points.at(-1);
      ray.set(new THREE.Vector3((x+last[0])/2,2,(z+last[1])/2),down);
      near(ray.intersectObject(garage)[0]?.point.y,id===104682192?.423:.437,.005);
      const u=id===104682192?1.85:8.44;near(grade(u,4.28),.426,.004);
    }
  }
  for(const [u,edge,direction] of [[4.28,0,1],[6.76,0,1],[4.24,4.261,-1],[6.69,4.261,-1]]){
    near(grade(u,edge+direction*.02),.044,.005);
    near(grade(u,edge+direction*.52),.234,.015);
    near(grade(u,edge+direction*1.05),.425);
  }
  near(grade(10.82,2.16),.045,.005);near(grade(10.82,1.28),.425,.008);
});

test('opposed pavilions frame the fountain and lawn, with a recessed garage opening on both street elevations',()=>{
  near(grade(1.45,2.2,east),.747);near(grade(10.12,2.2,garage),.747);
  near(grade(3.415,2.12),.477);near(grade(7.40,2.12),.439);
  for(const side of [0,4.261]){
    const sign=side?-1:1;
    const front=(u,y)=>{ray.set(p(u,y,side-.04*sign),new THREE.Vector3(-uz*sign,0,ux*sign));return ray.intersectObject(garage)[0]?.distance;};
    near(front(1.15,.142),.040,.004);near(front(3.11,.142),.220,.004);
    near(front(3.11,.29),.040,.004);
  }
});
test('only the garage and its mapped east pavilion are claimed and all night panes face glazing',()=>{
  for(const id of [28240176,1391009943,32612635])assert.equal(addGoldenGatewayGarage({id,p:[]},root,lights),false);
  assert.equal(root.children.length,2);assert.ok(lights.length>15);
  let cost=0;
  for(const m of root.children){cost+=m.geometry.index.count/3;assert.ok(m.geometry.attributes.position.array.every(Number.isFinite));}
  assert.ok(cost<11000,cost+' triangles');
  for(const w of lights){
    ray.set(new THREE.Vector3(w.x,w.y,w.z),new THREE.Vector3(-Math.sin(w.ry),0,-Math.cos(w.ry)));
    near(ray.intersectObject(root)[0]?.distance,.003);
  }
});

test('both far bridge landings enter the assembled residential podium at grade and preserve its remaining roof',()=>{
  const source=sfMap.buildings.find(b=>b.id===588365127),other=sfMap.buildings.find(b=>b.id===28240176);
  const [refined,same]=refineMaritimeLandings([source,other]);
  assert.equal(same,other);near(polygonArea(source.p)-polygonArea(refined.p),2*.358*1.42,.001);
  assert.equal(refined.p.length,source.p.length+6);assert.equal(refined.h,source.h);
  const combined=new THREE.Group();combined.add(root.clone(),
    new THREE.Mesh(footprintGeometry(refined.p,refined.h),new THREE.MeshStandardMaterial()),
    neighborhoodDetail([refined]).root);
  combined.updateMatrixWorld(true);
  for(const [u,v,y] of [[1.849,5.646,.421],[8.438,5.660,.448]]){
    for(const du of [-.052,0,.052]){
      near(grade(u+du,v-.025,combined),y,.002);
      near(grade(u+du,v+.10,combined),y);
      const samples=Array.from({length:105},(_,i)=>grade(u+du,v+.11+i*.016,combined));
      for(let i=1;i<samples.length;i++)assert.ok(Math.abs(samples[i]-samples[i-1])<.023,'Discontinuity at '+i+': '+samples.slice(i-1,i+1));
      near(samples.at(-1),.84,.004);
    }
    near(grade(u+.24,v+.6,combined),.84);
  }
});
