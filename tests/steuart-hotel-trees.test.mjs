import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addSteuartHotelTrees} from '../app/steuart-hotel-trees.ts';
import {waterfrontLandscape} from '../app/waterfront-gardens.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {addGriffonFront} from '../app/griffon-front.ts';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import data from '../app/harbor-font.json' with {type:'json'};

const mat=new THREE.MeshBasicMaterial(),garden=new THREE.Group(),surfaces=new THREE.Group();
function make(root){return (g,_c,x,y,z)=>{const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);root.add(m);return m;};}
const anchors=addSteuartHotelTrees(make(garden));addSurveyBlocks(make(surfaces));
const facade=new THREE.Group();
facade.position.set((-18.883-18.064)/2,0,(-6.333-6.456)/2);facade.rotation.y=Math.atan2(-.123,-.819);
addGriffonFront(facade,Math.hypot(.819,.123),.891,new FontLoader().parse(data),[]);
for(const r of [garden,surfaces,facade])r.updateMatrixWorld(true);
const down=new THREE.Vector3(0,-1,0);
const hits=(x,z)=>new THREE.Raycaster(new THREE.Vector3(x,.12,z),down,0,.16).intersectObjects(surfaces.children);
const near=(a,b,t=.00004)=>assert.ok(Math.abs(a-b)<t,a+' vs '+b);

test('two identified 155 Steuart cutouts retain their observed longitudinal stations and have complete sidewalk support',()=>{
  assert.deepEqual(anchors.map(p=>p.id),[191655,191656]);
  const expected=[[-18.79160,-6.46086],[-18.25943,-6.58735]];
  for(const [i,a] of anchors.entries()){
    near(a.x,expected[i][0]);near(a.z,expected[i][1]);
    assert.ok(waterfrontLandscape.trees.every(t=>Math.hypot(t.p[0]-a.x,t.p[1]-a.z)>2));
    const well=garden.children.find(m=>m.userData.treeSite===a.id);
    near(well.scale.x,.9144*.06);near(well.scale.z,.9144*.06);near(a.y,well.position.y);
    for(const u of [-.495,0,.495])for(const v of [-.495,0,.495]){
      const p=well.localToWorld(new THREE.Vector3(u,0,v)),surface=hits(p.x,p.z);
      near(surface[0].point.y,.045);
      assert.equal(surface.some(s=>s.point.y>.0309&&s.point.y<.0449),false,'no buried roadway, gutter or old curb');
    }
  }
});

test('the two evergreen crowns match the height of the continuous lidar clusters and clear the hotel and its 155 canopy',()=>{
  for(const [index,a] of anchors.entries()){
    const trees=garden.children.filter(m=>m.userData.plantAnchor&&m.position.x===a.x);
    assert.equal(trees.length,2);
    const leaf=trees.find(m=>m.userData.plantCrown),wood=trees.find(m=>!m.userData.plantCrown);
    leaf.geometry.computeBoundingBox();const b=leaf.geometry.boundingBox;
    near(b.min.y/.06,[3.95,4.32][index],.01);near(b.max.y/.06,[9.74,11.35][index],.01);
    const trunk=wood.geometry.getAttribute('position'),diameter=[11,12][index]*.0254*.06;
    const ring=(j)=>Array.from({length:6},(_,i)=>new THREE.Vector3().fromBufferAttribute(trunk,j*6+i));
    const lowRing=ring(1),highRing=ring(2);
    const avgY=(points)=>points.reduce((sum,p)=>sum+p.y,0)/points.length;
    const fraction=(4.5*.3048*.06-avgY(lowRing))/(avgY(highRing)-avgY(lowRing));
    const diameterAt=(ring)=>ring[0].distanceTo(ring[3]);
    near(diameterAt(lowRing)+(diameterAt(highRing)-diameterAt(lowRing))*fraction,diameter,.00001);
    for(const tree of trees){
      const points=tree.geometry.getAttribute('position');
      for(let i=0;i<points.count;i++){
        const p=facade.worldToLocal(tree.localToWorld(new THREE.Vector3().fromBufferAttribute(points,i)));
        assert.ok(p.z>0,'inside hotel wall');
        if(p.x>=-.56*.06&&p.x<=2.47*.06&&p.y>.045+4.09*.06&&p.y<.045+13*.06)assert.ok(p.z>1.03*.06,'inside fire escape');
        assert.ok(!(p.y<.045+3.82*.06&&p.z<1.95*.06&&p.x> -2.36*.06&&p.x<.60*.06),'canopy and through-route must stay clear');
      }
    }
  }
});

test('the sidewalk reaches the entrance and the measured curb has a single rise from the road to each tree',()=>{
  const plate=(u,v)=>[-27.00800104+.0012973094*u-.0084729829*v,-33.37263659+.0084728164*u+.0012965840*v];
  for(const [v,u] of [[-536,3239],[-472,3243]]){
    const y=(t)=>hits(...plate(t,v))[0].point.y;
    near(y(u-5),.031);near(y(u+.5),.045);near(y(u+8),.045);
  }
  const threshold=facade.localToWorld(new THREE.Vector3(-.88*.06,.046,.001));
  near(hits(threshold.x,threshold.z)[0].point.y,.045);
});
