import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import font from '../app/harbor-font.json' with {type:'json'};
import {ferryHall,ferryPublicRealm} from '../app/ferry-architecture.ts';
import {createMarketPaving} from '../app/market-paving.ts';
import street from '../public/data/market-street.json' with {type:'json'};

test('each rooftop inscription has one opaque extrusion with enamel on its front and darker returns',()=>{
  const rack=ferryHall(new FontLoader().parse(font)).root.getObjectByName('PORT OF SAN FRANCISCO');
  const words=rack.children.filter(child=>child.geometry?.type==='TextGeometry');
  assert.deepEqual(words.map(w=>w.name),['PORT OF','SAN FRANCISCO']);
  for(const word of words){
    const {normal,color}=word.geometry.attributes;let paint,side;
    assert.equal(word.material.transparent,false);
    for(let i=0;i<normal.count;i++)if(normal.getZ(i)>.99)paint=color.getX(i);else if(Math.abs(normal.getZ(i))<.1)side=color.getX(i);
    assert.ok(paint>side,'the two finishes share one physical surface');
  }
});

test('only surface transit islands are built on Market, above the road and below the platforms’ shelters',()=>{
  const root=ferryPublicRealm();
  const surfaces=root.getObjectsByProperty('name','Mapped Muni boarding island');
  assert.equal(surfaces.length,street.platforms.length);assert.ok(surfaces.length>=5);
  for(const object of surfaces){
    const size=new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
    assert.ok(size.z<4&&size.x<1,'A subway platform must never become a slab on the street');
  }
  assert.equal(root.getObjectsByProperty('name','Market Street station entrance canopy').length,street.entrances.length);
  const iron=root.getObjectsByProperty('name','Path of Gold globe');
  assert.ok(iron.length>40&&iron.length%3===0);
  for(let i=0;i<iron.length;i+=3)assert.ok(iron[i+1].position.y>iron[i].position.y);
});

test('19 Market poster column stands on the surveyed public sidewalk clear of rail and accessible approaches',async()=>{
  const {default:survey}=await import('../public/data/survey-blocks.json',{with:{type:'json'}});
  const {buildApproachBillboards}=await import('../app/approach-billboards.ts');
  const root=ferryPublicRealm();
  buildApproachBillboards((g,c,x,y,z,parent)=>{
    const part=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:c}));
    part.position.set(x,y,z);parent.add(part);return part;
  },root,new FontLoader().parse(font));
  const post=root.getObjectByName('Market at Steuart');
  assert.ok(post.getObjectByName('Enamel column with domed cornice'));
  assert.equal(root.getObjectByName('Market and Steuart cast-iron poster column'),undefined);
  const {x,z}=post.position;
  function inside(p,ring){
    let hit=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const [a,b]=ring[i],[c,d]=ring[j];
      if((b>p[1])!==(d>p[1])&&p[0]<(c-a)*(p[1]-b)/(d-b)+a)hit=!hit;
    }return hit;
  }
  for(const dx of [-.038,.038])for(const dz of [-.038,.038]){
    assert.ok(survey.streets.sidewalk.some(([outer,...holes])=>inside([x+dx,z+dz],outer)&&holes.every(h=>!inside([x+dx,z+dz],h))));
  }
  function clearance(p){
    return Math.min(...p.slice(1).map(([b,d],i)=>{
      const [a,c]=p[i],u=THREE.MathUtils.clamp(((x-a)*(b-a)+(z-c)*(d-c))/((b-a)**2+(d-c)**2),0,1);
      return Math.hypot(x-a-u*(b-a),z-c-u*(d-c));
    }));
  }
  assert.ok(street.tracks.every(([, ,p])=>clearance(p)>.21));
  assert.ok(street.crossings.every(([,p])=>clearance(p)>.25));
  assert.ok(street.entrances.every(([,a,b])=>clearance([a,b])>.25));
  assert.equal(post.userData.commercialFaces.length,2);
  assert.ok(post.getObjectByName('Closed vending doors'));
});

test('the two pedestrian paving panels end at the Embarcadero curbs',()=>{
  const paving=createMarketPaving();
  const ray=new THREE.Raycaster();
  function surface(z,offset=0){
    ray.set(new THREE.Vector3(-.13+(z+1.813)*.177+offset,1,z),new THREE.Vector3(0,-1,0));
    return ray.intersectObject(paving).length>0;
  }
  assert.ok(surface(-4.7)&&surface(-8));
  assert.equal(surface(-5.75),false);
  assert.equal(surface(-8,1.1),false);
});
