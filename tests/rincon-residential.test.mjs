import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import sf from '../public/data/sf-waterfront.json' with {type:'json'};
import {addMetropolitanTowers,addBayCrestWings} from '../app/rincon-residential.ts';
const c=.98894,s=.14834;
const sites=[
  [288647269,-46.639,-34.1317,addMetropolitanTowers],
  [288647262,-43.2314,-35.1173,addMetropolitanTowers],
  [1487195805,-51.7872,-17.3172,addBayCrestWings],
  [260318802,-52.212,-20.1090,addBayCrestWings],
];
function model(index){
  const [id,x,z,make]=sites[index],root=new T.Group(),lights=[];
  const b=sf.buildings.find(b=>b.id===id);
  assert.equal(make(b,root,lights),true);root.updateMatrixWorld(true);
  const point=(u,v,y)=>new T.Vector3(x+c*u+s*v,y,z-s*u+c*v);
  const ray=(p,n)=>new T.Raycaster(p,n).intersectObject(root,true)[0];
  const height=(u,v)=>ray(point(u,v,10),new T.Vector3(0,-1,0))?.point.y/.06;
  return {root,lights,height,point,ray,b};
}
function near(a,b,eps=.02){assert.ok(Math.abs(a-b)<eps,`${a} vs ${b}`);}
test('Metropolitan has a stepped crown, two shoulder levels and lower returned street bays above its original podium',()=>{
  const a=model(0),b=model(1);
  near(a.height(0,0),81);near(a.height(.8,0),76.6);near(a.height(.27,-.99),65);
  near(a.height(.27,1.02),37);
  near(b.height(0,0),67.4);near(b.height(-.5,.54),62.9);near(b.height(1.09,.13),54);
  assert.ok(Number.isNaN(b.height(1.35,0)));
  for(const o of [a,b]){
    const bounds=new T.Box3().setFromObject(o.root);
    near(bounds.min.y,.60);assert.equal(o.root.children.length,1);
  }
});
test('BayCrest wing and courtyard traces retain distinct decks and registered rooftop masses',()=>{
  const a=model(2),b=model(3);
  near(a.height(-.6,0),28.5);near(a.height(.30,-.12),33.5);near(a.height(.60,.5),31.1);
  near(b.height(-.6,0),34.1);near(b.height(.30,.10),39);near(b.height(.60,-.43),37.1);
  for(const [o,v] of [[a,.65],[b,-.65]]){
    assert.ok(Number.isNaN(o.height(-.62,v)));
    near(new T.Box3().setFromObject(o.root).min.y,.42);
  }
});
test('residential glazing sits behind physical sills and every part emits outward-facing night panes',t=>{
  for(let i=0;i<sites.length;i++){
    const {root,lights,ray}=model(i);
    const triangles=root.children[0].geometry.index.count/3;
    t.diagnostic(sites[i][0]+': '+triangles+' triangles, '+lights.length+' window lights');
    assert.ok(lights.length>12);assert.ok(triangles<8000);
    let recessed=false;
    for(const w of lights){
      const n=new T.Vector3(Math.sin(w.ry),0,Math.cos(w.ry));
      const origin=new T.Vector3(w.x,w.y,w.z).addScaledVector(n,.05);
      const glass=ray(origin,n.clone().negate());
      if(!glass||Math.abs(glass.distance-.0513)>.001)continue;
      const lower=ray(origin.clone().add(new T.Vector3(0,-w.h*1.15,0)),n.negate());
      if(lower&&lower.distance<glass.distance-.004){recessed=true;break;}
    }
    assert.ok(recessed,'a lit pane is physically inset from its lower sill');
  }
});
test('base, low connector and unrelated parcel fall through without adding geometry',()=>{
  const root=new T.Group(),lights=[];
  for(const id of [945361247,288647265,1474571838,1487195806,192328858,260320985]){
    assert.equal(addMetropolitanTowers({id},root,lights),false);
    assert.equal(addBayCrestWings({id},root,lights),false);
  }
  assert.equal(root.children.length+lights.length,0);
});
