import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {stationSites} from '../app/embarcadero-station-sites.ts';
import {addEmbarcaderoEntrance} from '../app/embarcadero-station.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {createMarketPaving} from '../app/market-paving.ts';
import {addCaliforniaSidewalk} from '../app/california-sidewalk.ts';
import {cableRailHead} from '../app/california-terminal.ts';

test('six registered Embarcadero wells expose eight real descending steps beneath the finished canopies',()=>{
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({vertexColors:true});
  const mesh=(g,c,x=0,y=0,z=0)=>{const m=new THREE.Mesh(g,material);m.position.set(x,y,z);root.add(m);return m;};
  addSurveyBlocks(mesh);
  root.add(createMarketPaving());
  addCaliforniaSidewalk(mesh,cableRailHead);
  assert.deepEqual([...stationSites.values()].map(s=>s.name).sort(),['Beale','Davis','Drumm','Main','Pine','Spear']);
  assert.equal(addEmbarcaderoEntrance(mesh,0),false);
  for(const [id,s] of stationSites){
    assert.equal(addEmbarcaderoEntrance(mesh,id),true);
    const canopy=root.children.at(-1);
    assert.ok(canopy.geometry.index.count/3<4000);
    root.updateMatrixWorld(true);
    const hit=(u,v,y=.065,dy=-1)=>{
      const [x,z]=s.point(u,v);
      return new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(0,dy,0)).intersectObjects(root.children)[0];
    };
    for(const side of [-1,1])for(let j=0;j<8;j++){
      const h=hit(side*1.12,.10+(j+.5)*.31);
      const expected=.045-.06*.153*(j+1);
      assert.ok(h&&Math.abs(h.point.y-expected)<.00002,s.name+' '+j+' '+side+' '+h?.object.name+' '+h?.point.y);
    }
    const roof=hit(0,(s.front+s.end)/2,.5);
    assert.equal(roof.object,canopy);
    assert.ok(Math.abs(roof.point.y-(.045+.06*4.34))<.00002);
    const end=hit(0,s.front+.8,.14,1),middle=hit(0,(s.front+s.end)/2,.14,1);
    assert.ok(end.point.y-middle.point.y>.020);
  }
});

test('the station name reads clockwise from each sidewalk and the visible front faces carry both BART colors',async()=>{
  const {FontLoader}=await import('three/addons/loaders/FontLoader.js');
  const font=(await import('../app/harbor-font.json',{with:{type:'json'}})).default;
  const reference=new THREE.ShapeGeometry(new FontLoader().parse(font).generateShapes('EMBARCADERO',1),2);
  const xy=reference.attributes.position,sourceIndex=reference.index;
  for(const [id,site] of stationSites){
    let entrance;
    addEmbarcaderoEntrance(g=>(entrance=new THREE.Mesh(g,new THREE.MeshBasicMaterial())),id);
    const {position,color}=entrance.geometry.attributes,index=entrance.geometry.index;
    const base=site.point(0,0),forwardPoint=site.point(0,1);
    const forward=new THREE.Vector3(forwardPoint[0]-base[0],0,forwardPoint[1]-base[1]).normalize();
    const right=forward.clone().cross(new THREE.Vector3(0,1,0));
    const inks=['303b40','232b2e','2379a0','b3423b'];
    const pigments=new Map(inks.map(ink=>[ink,[]]));
    for(let i=0;i<index.count;i+=3){
      const ink=new THREE.Color().fromBufferAttribute(color,index.getX(i)).getHexString();
      if(!pigments.has(ink))continue;
      const t=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(position,index.getX(i+k)));
      const triangle=new THREE.Triangle(...t),normal=triangle.getNormal(new THREE.Vector3());
      // Font triangulation includes almost-collinear slivers in Float32.
      if(triangle.getArea()>1e-9)assert.ok(normal.dot(forward)<0,site.name+' '+ink+' signed front area '+normal.dot(forward)+' '+triangle.getArea()+' '+i);
      pigments.get(ink).push(t);
    }
    const word=pigments.get(inks[0]).flat();
    assert.equal(word.length,sourceIndex.count);
    for(const [i,p] of word.entries()){
      // Clockwise from the readable horizontal font means +glyphY points
      // to the rider's right, while +glyphX points down the cabinet.
      const k=sourceIndex.getX(i),first=sourceIndex.getX(0),scale=.144*.06;
      assert.ok(Math.abs(p.clone().sub(word[0]).dot(right)-(xy.getY(k)-xy.getY(first))*scale)<.000003);
      assert.ok(Math.abs(p.y-word[0].y+(xy.getX(k)-xy.getX(first))*scale)<.000003);
    }
    for(const [ink,tris] of pigments){
      assert.ok(tris.length>0);
      const tri=tris.reduce((best,t)=>new THREE.Triangle(...t).getArea()>new THREE.Triangle(...best).getArea()?t:best);
      const center=new THREE.Triangle(...tri).getMidpoint(new THREE.Vector3());
      const ray=new THREE.Raycaster(center.clone().addScaledVector(forward,-.065),forward);
      const first=ray.intersectObject(entrance)[0];
      assert.equal(new THREE.Color().fromBufferAttribute(color,first.face.a).getHexString(),ink);
      assert.ok(Math.abs(first.distance-.065)<.00001);
    }
  }
});
