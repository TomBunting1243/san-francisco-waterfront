import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLandscape,createCityVignette} from '../app/landscape.ts';
import {waterSurface} from '../app/water-surface.ts';
import poles from '../public/data/promenade-lights.json' with {type:'json'};
import tides from '../public/data/harbor-tide-hours.json' with {type:'json'};
import shore from '../public/data/bay-shore-cut.json' with {type:'json'};

test('highest bundled tide leaves both curb rows dry while both slips, Pier 7 and the open bay stay wet',()=>{
  const world=createLandscape(),offset=(Math.max(...tides.cm)*.01-.951)*.06;
  assert.deepEqual(shore.grid,[waterSurface.size,waterSurface.columns,waterSurface.rows]);
  const caster=new THREE.Raycaster(),origin=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0);
  function hits(meshes,x,z,y=1){caster.set(origin.set(x,y,z),down);return caster.intersectObjects(meshes,false);}
  for(const scene of [world,createCityVignette('street'),createCityVignette('plaza')]){
    scene.updateTide(offset);scene.root.updateMatrixWorld(true);
    const water=scene.root.children.find(o=>o.material===scene.waterMaterial);
    assert.ok(water);
    assert.ok(Math.abs(water.position.y-waterSurface.level-offset)<1e-6);
    for(const [id,x,z] of [...poles.curb,...poles.inland]){
      assert.equal(hits([water],x,z).length,0,'dry SFPUC fixture '+id);
    }
    for(const [x,z] of [[-44.2305,.0495],[-11.7426,.636],[27.30,8.11],[2,12],[-29,3],[20,40]]){
      const wet=hits([water],x,z);
      assert.ok(wet.length,'open water or piling-supported deck '+[x,z]);
      assert.ok(Math.abs(wet[0].point.y-water.position.y)<1e-5);
    }
    if(scene===world){
      const surfaces=[water,...world.architectureChunks];
      world.root.traverse(o=>{if(o.isMesh&&o.parent?.name.endsWith(' elevation'))surfaces.push(o);});
      // Rays beside the six bayside and three inland Rincon standards where
      // the former uncut sheet rose through the low ground at high tide.
      const low=new Set([287051,282079,284944,281691,281690,281688,284943,281687,282992]);
      for(const [id,x,z] of [...poles.curb,...poles.inland].filter(p=>low.has(p[0]))){
        const h=hits(surfaces,x+.018,z,.13).find(h=>h.face.normal.y>.6);
        assert.ok(h&&h.object!==water,'actual pavement or terrain '+id);
        assert.equal(hits([water],x+.018,z).length,0,'dry across the fixture foot '+id);
      }
    }else{
      assert.ok(water.geometry.index.count/3<650);
      assert.equal(water.geometry.hasAttribute('bayWavePhase'),false);
      water.geometry.computeBoundingBox();
      assert.equal(water.geometry.boundingBox.min.x,-120);
      assert.equal(water.geometry.boundingBox.max.x,120);
    }
  }
});
