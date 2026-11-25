import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {addMedianBedSurface,medianBedSoilHeight} from '../app/median-bed-surface.ts';

function facets(bed){
  const faces=[];
  addMedianBedSurface({quad(a,b,c,d,color){
    for(const corners of [[a,b,c],[a,c,d]])faces.push({vertices:corners.map(v=>new THREE.Vector3(...v)),color});
  }},bed);
  return faces;
}
for(const raised of [false,true]){
  test((raised?'Raised concrete surround':'Flush sett course')+' has one receiving surface and a continuous recessed trunk seat',()=>{
    const bed={x:83.742,z:-6.89,angle:.73,halfLength:.077,halfWidth:.045,grade:.268,raised};
    const faces=facets(bed),rim=bed.grade+(raised?.009:0),soil=medianBedSoilHeight(bed);
    const rimWidth=raised?.0084:.0066;
    const up=new THREE.Vector3(0,-1,0),ray=new THREE.Ray(),hit=new THREE.Vector3();
    function hitsAt(a,b){
      const c=Math.cos(bed.angle),s=Math.sin(bed.angle);
      ray.set(new THREE.Vector3(bed.x+a*c-b*s,rim+.1,bed.z+a*s+b*c),up);
      return faces.filter(f=>ray.intersectTriangle(...f.vertices,true,hit));
    }
    let area=0,innerWalls=0,outerWalls=0;
    for(const {vertices:[a,b,c]} of faces){
      const n=b.clone().sub(a).cross(c.clone().sub(a));
      assert.ok(n.lengthSq()>1e-20,'no zero-area geometry');
      assert.ok(n.y>=-1e-12,'all horizontal faces point upward');
      area+=n.y*.5;
      if(Math.abs(n.y)<1e-12){
        const center=a.clone().add(b).add(c).multiplyScalar(1/3);
        if(n.x*(bed.x-center.x)+n.z*(bed.z-center.z)>0)innerWalls++;else outerWalls++;
      }
    }
    assert.ok(Math.abs(area-4*bed.halfLength*bed.halfWidth)<1e-10);
    assert.equal(innerWalls,8);assert.equal(outerWalls,raised?8:0);
    for(let i=0;i<33;i++)for(let j=0;j<27;j++){
      // Stay away from exact triangle diagonals when counting one top hit.
      const x=bed.halfLength*(2*(i+.413)/33-1),z=bed.halfWidth*(2*(j+.319)/27-1);
      const hits=hitsAt(x,z);assert.equal(hits.length,1);
      const inSoil=Math.abs(x)<bed.halfLength-rimWidth&&Math.abs(z)<bed.halfWidth-rimWidth;
      assert.ok(Math.abs(hits[0].vertices[0].y-(inSoil?soil:rim))<1e-12);
    }
    assert.equal(hitsAt(bed.halfLength+.0001,0).length,0);
    assert.ok(new Set(faces.filter(f=>f.vertices.every(v=>v.y===soil)).map(f=>f.color)).size>=5);
    assert.deepEqual(facets(bed),faces);
  });
}
