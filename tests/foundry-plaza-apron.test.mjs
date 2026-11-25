import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {FacadePanels} from '../app/facade-panels.ts';
import {addFoundryPlazaApron} from '../app/foundry-plaza-apron.ts';
import {createLandscape} from '../app/landscape.ts';

const plate=([u,v],h=0)=>[-27.00800104+.0012973094*u-.0084729829*v,.045+h*.06,-33.37263659+.0084728164*u+.001296584*v];
test('Foundry shop floors join existing walks, gardens and all four entrance thresholds',()=>{
  const {root}=createLandscape();root.updateMatrixWorld(true);
  const area=new T.Box3().setFromPoints([[-570,5],[-360,5],[-570,492],[-360,492]].flatMap(p=>[-1,2].map(h=>new T.Vector3(...plate(p,h)))));
  const meshes=[];
  root.traverse(m=>{
    if(m.isMesh&&new T.Box3().setFromObject(m).intersectsBox(area))meshes.push(m);
  });
  const ray=new T.Raycaster(undefined,new T.Vector3(0,-1,0),0,.18);
  const heights=(x,z)=>{
    ray.ray.origin.set(x,.18,z);
    return ray.intersectObjects(meshes,false).map(h=>h.point.y).filter(y=>y>.03);
  };
  for(const [u,v] of [[-460,470],[-472,141],[-378,444],[-554,440],[-550,25],[-380,100]]){
    const [x,,z]=plate([u,v]),hs=heights(x,z);
    assert.equal(hs.length,1,'one floor at '+[u,v]);
    assert.ok(hs[0]>=.04498&&hs[0]<=.04640);
  }
  for(const south of [true,false]){
    const f=new FacadePanels();addFoundryPlazaApron(f,south,plate);
    for(let i=0;i<f.indices.length;i+=3){
      const p=f.indices.slice(i,i+3).map(index=>new T.Vector3().fromArray(f.positions,index*3));
      const normal=new T.Triangle(...p).getNormal(new T.Vector3());
      // The 2 cm garden lip bevels down to parcel 221 over as little as 5.7 cm.
      const bevelTip=new T.Vector3(...plate([-553.39915,318.90411]));
      const narrowBevel=south&&p.some(v=>v.distanceTo(bevelTip)<.00001);
      assert.ok(normal.y>(narrowBevel?.94:.98),'upward paving and outer edge bevel');
      const middle=p[0].multiplyScalar(.33).addScaledVector(p[1],.28).addScaledVector(p[2],.39);
      const hs=heights(middle.x,middle.z);
      assert.equal(hs.length,1,'two owners at '+middle.toArray());
      assert.ok(Math.abs(hs[0]-middle.y)<.00002);
    }
    const walls=south?[[-393,311],[-394,466],[-552,466]]:[[-542,31],[-394,31],[-394,132]];
    for(let i=0;i<2;i++){
      const [a,b]=walls.slice(i,i+2),length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const n=Math.round(length/7/3.04),s=(Math.floor(n/2)+.5)*length/n+.17;
      for(const depth of [-3.38,-3.051,-3.049,-2.8,-1.2,-.20,.15]){
        const u=a[0]+(s*(b[0]-a[0])-depth*7*(b[1]-a[1]))/length;
        const v=a[1]+(s*(b[1]-a[1])+depth*7*(b[0]-a[0]))/length;
        const [x,,z]=plate([u,v]),hs=heights(x,z);
        assert.equal(hs.length,1,'ground to door '+[south,i,depth]);
        assert.ok(Math.abs(hs[0]-.0463)<.0014);
      }
    }
  }
});
