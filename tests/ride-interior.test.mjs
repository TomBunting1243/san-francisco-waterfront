import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createRideInteriors} from '../app/ride-interior.ts';

test('cab foregrounds clear the eye near plane and leave the center view through both lenses open',t=>{
  const {root,show,dispose}=createRideInteriors();
  for(const [fov,aspect] of [[52,16/9],[71,390/844]]){
    const camera=new T.PerspectiveCamera(fov,aspect,.013,1800);
    camera.add(root);camera.updateMatrixWorld(true);
    const ray=new T.Raycaster(),ndc=new T.Vector2();
    for(const mode of ['sedan','tram']){
      show(mode);
      const mesh=root.children.find(m=>m.visible),position=mesh.geometry.getAttribute('position');
      assert.ok(mesh.geometry.index.count/3<(mode==='sedan'?145:365));
      for(let i=0;i<position.count;i++)assert.ok(Math.hypot(position.getX(i),position.getY(i),position.getZ(i))>camera.near);
      let covered=0,left=0,right=0,bottom=0;
      for(let row=0;row<48;row++)for(let col=0;col<48;col++){
        ndc.set((col+.5)/24-1,(row+.5)/24-1);
        ray.setFromCamera(ndc,camera);
        if(!ray.intersectObject(mesh,true).length)continue;
        covered++;
        assert.ok(Math.abs(ndc.x)>.24||ndc.y<-.45,'central street sightline');
        if(ndc.y<-.84)bottom++;
        if(ndc.x<-.1&&ndc.y<-.55)left++;
        if(ndc.x>.1&&ndc.y<-.55)right++;
      }
      const percent=100*covered/(48*48);
      t.diagnostic(mode+' '+fov+'°: foreground covers '+percent.toFixed(1)+'%');
      assert.ok(percent>4&&percent<30);
      assert.ok(bottom>10&&left>6&&right>6);
    }
  }
  dispose();
});
test('only the selected cab draws; shared GPU resources release once on teardown',()=>{
  const {root,show,dispose}=createRideInteriors();
  const scene=new T.Scene();scene.add(root);
  assert.equal(root.visible,false);
  const [car,tram]=root.children;assert.equal(car.material,tram.material);
  show('sedan');assert.deepEqual([root.visible,car.visible,tram.visible],[true,true,false]);
  show('tram');assert.deepEqual([root.visible,car.visible,tram.visible],[true,false,true]);
  show(null);assert.equal(root.visible,false);
  let releases=0;
  for(const resource of [car.geometry,tram.geometry,car.getObjectByName('Windshield wiper').geometry,tram.getObjectByName('Windshield wiper').geometry,car.material])resource.addEventListener('dispose',()=>releases++);
  dispose();dispose();show('sedan');assert.equal(releases,5);assert.equal(root.parent,null);assert.equal(root.visible,false);
});


test('each wiper turns on a sill-mounted spindle, freezes on pause and finishes its sweep when dry',()=>{
  const {root,show,updateRain,dispose}=createRideInteriors();
  for(const mode of ['sedan','tram']){
    show(mode);root.updateMatrixWorld(true);
    const cab=root.children.find(m=>m.visible),wiper=cab.getObjectByName('Windshield wiper');
    const hidden=root.children.find(m=>!m.visible).getObjectByName('Windshield wiper');
    const meshes=[];root.traverseVisible(o=>{if(o.isMesh)meshes.push(o)});
    assert.equal(meshes.length,2);
    const pivot=wiper.getWorldPosition(new T.Vector3());
    const axis=new T.Vector3(0,0,1).transformDirection(wiper.parent.matrixWorld);
    const ray=new T.Raycaster(pivot.clone().addScaledVector(axis,.004),axis.clone().negate(),0,.009);
    const hit=ray.intersectObject(cab,false)[0];
    assert.ok(hit&&hit.point.distanceTo(pivot)<.00012,'spindle intersects the actual cab sill within two millimetres');
    const cap=ray.intersectObject(wiper,false)[0];assert.ok(cap&&cap.distance<hit.distance);
    updateRain(0,1,false);updateRain(1,1,true);assert.equal(wiper.rotation.z,0);
    updateRain(.9,.42,false);
    const moving=wiper.rotation.z;assert.ok(moving<-.25&&moving>-1.22);
    updateRain(1,.8,true);updateRain(0,.6,true);assert.equal(wiper.rotation.z,moving);
    root.updateMatrixWorld(true);assert.ok(wiper.getWorldPosition(new T.Vector3()).distanceTo(pivot)<1e-9);
    assert.equal(hidden.rotation.z,0);
    for(let i=0;i<35;i++)updateRain(0,.06,false);
    assert.equal(Math.abs(wiper.rotation.z),0);updateRain(0,1,false);assert.equal(Math.abs(wiper.rotation.z),0);
    show(null);updateRain(1,.7,false);assert.equal(Math.abs(wiper.rotation.z),0);
  }
  dispose();
});

test('both cabs surround the seat and preserve exterior sightlines through both sides and the rear',()=>{
  const {root,show,dispose}=createRideInteriors();
  for(const mode of ['sedan','tram']){
    show(mode);
    const cab=root.children.find(child=>child.visible);
    const hit=(x,y,z)=>new T.Raycaster(new T.Vector3(),new T.Vector3(x,y,z).normalize()).intersectObject(cab,false)[0];
    for(const side of [-1,1]){
      assert.ok(!hit(side,.07,0),'eye-level side window');
      assert.ok(hit(side,-1,0),'door interior below glass');
      assert.ok(hit(side,2,.2),'headlining above side glass');
    }
    assert.ok(!hit(0,.015,1),'rear glass remains open towards the horizon');
    assert.ok(hit(0,-1,1),'seat or floor when turning back');
    if(mode==='tram'){
      const end=hit(.30,-.6,13.49);
      assert.ok(end&&end.distance>.79,'clear saloon aisle to rear bulkhead');
      assert.ok(hit(-.42,-.35,2.22).distance<.18,'first seat beside the aisle');
    }else{
      assert.ok(hit(.77,-.13,.38).distance<.06,'adjacent passenger headrest');
      assert.ok(hit(-.2,-.15,1.44),'rear seat below backlight');
    }
  }
  dispose();
});
