import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import map from '../public/data/sf-waterfront.json' with {type:'json'};
import {downtownBuilding} from '../app/downtown-buildings.ts';
import {surveyedShopfrontFactory} from '../app/surveyed-shopfronts.ts';
import {createLandscape,createCityVignette,rememberLandscape} from '../app/landscape.ts';
import {driverPose} from '../app/driver-rides.ts';
import {howardGlassName} from '../app/301-howard-front.ts';

function podium(changed){
  const root=new T.Group(),material=new T.MeshStandardMaterial({vertexColors:true});
  function mesh(g,c,x,y,z){const m=new T.Mesh(g,material);m.position.set(x,y,z);root.add(m);return m;}
  for(const id of [1309156966,192883917]){
    const b=map.buildings.find(b=>b.id===id);
    downtownBuilding(changed?surveyedShopfrontFactory(b,mesh):mesh,b,b.h,!b.part);
  }
  root.updateMatrixWorld(true);return root;
}
const before=podium(false),after=podium(true);
const howard=[[-28.700,-26.706],[-28.991,-28.561]],corner=[[-28.960,-26.268],[-28.700,-26.706]],beale=[[-28.960,-26.268],[-30.817,-25.974]];
function slice(group,[a,b],s,y){
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),sign=dz<0?-1:1;
  const outward=new T.Vector3(sign*dz/len,0,-sign*dx/len);
  const o=new T.Vector3(a[0]+s*dx/len,y,a[1]+s*dz/len).addScaledVector(outward,.30);
  return new T.Raycaster(o,outward.negate(),0,.65).intersectObjects(group.children,false);
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<.00004,[a,b].join(' vs '));
test('three mapped street faces admit seated-height sightlines through real glazing into recessed rooms',()=>{
  for(const [edge,station,label,leafDepth,roomDepth] of [
    [howard,1.068+.027,'Howard lobby and windows',.084,.13],
    [corner,Math.hypot(.260,.438)*.50-.016,'Corner café entrance',.058,.09],
    [beale,.5,'Beale café windows',.029,.09]
  ]){
    const first=slice(before,edge,station,.119)[0];near(first.distance,.30);
    const hits=slice(after,edge,station,.119),pane=hits[0],back=hits.find(hit=>hit.object.name.endsWith(label));
    assert.equal(pane.object.name,howardGlassName);near(pane.distance-first.distance,leafDepth);
    assert.ok(back.distance>first.distance+roomDepth);
    assert.ok(back.object.geometry.getAttribute('signLight').array.some(c=>c>0));
  }
  for(const [edge,station] of [[howard,.20],[corner,.254],[beale,.50]]){
    for(const y of [.03,.208,.40,1.2]){
      const a=slice(before,edge,station,y)[0],b=slice(after,edge,station,y)[0];
      near(a.distance,b.distance);assert.equal(a.object.name,b.object.name);
    }
  }
});
test('storefront parts stay inside the property line and retain a continuous threshold',()=>{
  const segments=[[howard,'Howard lobby and windows'],[corner,'Corner café entrance'],[beale,'Beale café windows']];
  for(const [edge,name] of segments){
    const p=after.getObjectByName('301 Howard · '+name).geometry.attributes.position;
    const [[ax,az],[bx,bz]]=edge,dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz),sign=dz<0?-1:1;
    let minY=Infinity,maxY=-Infinity;
    for(let i=0;i<p.count;i++){
      const offset=sign*((p.getX(i)-ax)*dz-(p.getZ(i)-az)*dx)/len;
      assert.ok(offset<.00001,'clear sidewalk');
      minY=Math.min(minY,p.getY(i));maxY=Math.max(maxY,p.getY(i));
    }
    near(minY,.045);near(maxY,.204);
  }
});
test('the city and street vignette preserve the combined glass draw and the bridge passenger sees each opening',()=>{
  const full=rememberLandscape(createLandscape()),street=createCityVignette('street');
  for(const world of [full,street]){
    const results=world.root.getObjectsByProperty('name',howardGlassName);assert.equal(results.length,1);
    const glass=results[0];assert.ok(glass.material.transparent&&!glass.material.depthWrite);
    assert.equal(glass.material.forceSinglePass,true);
    for(const [t,aim] of [[263.4,[-28.86548,.125,-27.76]],[266.2,[-28.86,.12,-27.68]],[267.9,[-28.83,.124,-26.535]]]){
      const eye=driverPose('bridge',t).eye,o=new T.Vector3(eye.x,eye.y,eye.z),d=new T.Vector3(...aim).sub(o).normalize();
      const target=new T.Raycaster(o,d,0,3),panes=target.intersectObject(glass),solid=target.intersectObjects(world.architectureChunks,false)[0];
      assert.ok(panes.length>0&&solid&&solid.distance>panes[0].distance,'unobstructed transparent pane from passenger eye at '+t);
    }
  }
});
