import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createLandscape} from '../app/landscape.ts';
import {curbRuns,museumWalkSeam} from '../app/curb-survey.ts';

test('the final museum corner shares one walking surface with the Steuart return, its lowered gutter and the track reservation',()=>{
  const {architectureChunks}=createLandscape(),surfaces=[];
  // Keep the final baked triangles, including the adjoining roadway and curb.
  // A short local index makes dense seam probes practical on the production mesh.
  for(const m of architectureChunks){
    const g=m.geometry,box=g.boundingBox;
    if(box.max.x< -8.90||box.min.x> -8.25||box.max.z< -8.13||box.min.z> -7.45)continue;
    const verts=g.attributes.position,idx=g.index,kept=[];
    for(let j=0;j<idx.count;j+=3){
      const ids=[idx.getX(j),idx.getX(j+1),idx.getX(j+2)];
      if(ids.every(i=>verts.getX(i)<-8.90)||ids.every(i=>verts.getX(i)>-8.25)||
         ids.every(i=>verts.getZ(i)<-8.13)||ids.every(i=>verts.getZ(i)>-7.45)||
         ids.every(i=>verts.getY(i)>.095)||ids.every(i=>verts.getY(i)<.020))continue;
      kept.push(...ids);
    }
    if(!kept.length)continue;
    const local=new THREE.BufferGeometry();local.setAttribute('position',verts);local.setIndex(kept);
    surfaces.push(new THREE.Mesh(local,m.material));
  }
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  function levels(x,z){
    ray.set(new THREE.Vector3(x,.09,z),down);ray.far=.075;
    return ray.intersectObjects(surfaces,false).filter(h=>h.face.normal.y>.2).map(h=>h.point.y);
  }
  function top(x,z){const [h]=levels(x,z);assert.ok(Number.isFinite(h),'hole at '+[x,z]);return h;}
  // In v17 this straight end rose from .045 to .0599 across a single pixel.
  for(const x of [-8.624,-8.621,-8.618])for(let z=-7.9537;z< -7.9432;z+=.00131){
    const h=levels(x,z).filter(y=>y>.035);
    assert.equal(h.length,1,'a second sidewalk overlays the surviving curb at '+[x,z]);
    assert.ok(h[0]>=.0405&&h[0]<=.0452);
  }
  const gaps=[];
  for(let x=-8.69;x< -8.36;x+=.00431)for(let z=-8.010;z< -7.843;z+=.00373){
    if(!levels(x,z).length)gaps.push([+x.toFixed(4),+z.toFixed(4)]);
  }
  assert.equal(gaps.length,0,'corner hole '+JSON.stringify(gaps.slice(0,40)));
  const path=curbRuns.find(([id])=>id===3818976)[2];
  for(let k=1;k<path.length-1;k++){
    const [a,b]=[path[k-1],path[k]];
    for(const f of [.24,.56,.83]){
      const at=(p,t)=>[p[0]+t*p[2],p[1]+t*p[3]];
      const join=(t)=>at(a,t).map((v,i)=>v*(1-f)+at(b,t)[i]*f);
      // Test both sides of the exact curved back-of-curb line, not its chord.
      for(const t of [-.0312,-.0308])assert.ok(Math.abs(top(...join(t))-.045)<.00025);
      const cap=top(...join(-.004)),gutter=top(...join(.005));
      assert.ok(cap-gutter>.0086&&cap-gutter<.0094);
    }
  }
  // From the municipal slab into the new oblique panel at the building corner.
  for(const f of [.15,.45,.77]){
    const x=-8.624+(museumWalkSeam[0]+8.624)*f,z=-7.844+(x+8.554)*(.340/-2.297);
    assert.ok(Math.abs(top(x,z-.00031)-top(x,z+.00031))<.00025);
  }
  const sidewalk=top(-8.4584,-7.709),railSide=top(-8.4576,-7.709);
  assert.ok(Math.abs(sidewalk-railSide)<.0004&&Math.abs(sidewalk-.04065)<.0004);
  // The shallow lip continues across a full chair-width opening.
  for(let z=-7.699;z<=-7.575;z+=.0095){
    const x=z< -7.61?-8.458+(z+7.709)*.058/.099:-8.40+(z+7.61)*.075/.58;
    assert.ok(Math.abs(top(x-.00036,z)-top(x+.00036,z))<.00045);
  }
  // A daytime visitor can follow the apron away from the dropped gutter
  // to the higher railbed without walking through a vertical shelf.
  let previous=railSide;
  for(let x=-8.456;x< -8.30;x+=.004){
    const h=top(x,-7.709);
    assert.ok(h>=previous-.0001&&h-previous<.0007);
    previous=h;
  }
  // The northern part of the opening rises gently all the way from the
  // reservation across the entrance landing. Probe both actual surface gradients.
  for(const crossingZ of [-7.583,-7.559,-7.535,-7.513]){
    let h=top(-8.37,crossingZ);
    for(let x=-8.372;x>=-8.565;x-=.002){
      const next=top(x,crossingZ);
      assert.ok(Math.abs(next-h)<.002/12+.00001,'door approach slope at '+[x,crossingZ]);
      h=next;
    }
  }
  for(const x of [-8.58,-8.55,-8.52])assert.ok(Math.abs(top(x,-7.602)-.068)<.0012,'level entrance landing');
});
