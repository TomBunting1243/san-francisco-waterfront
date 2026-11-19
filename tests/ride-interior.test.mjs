import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createRideInteriors,placePassenger} from '../app/ride-interior.ts';
import {pccCabFront} from '../app/pcc-saloon.ts';

test('cab foregrounds clear the eye near plane and leave the center view through both lenses open',t=>{
  const {root,show,dispose}=createRideInteriors();
  for(const [fov,aspect] of [[52,16/9],[71,390/844]]){
    const camera=new T.PerspectiveCamera(fov,aspect,.013,1800);
    root.updateMatrixWorld(true);
    const ray=new T.Raycaster(),ndc=new T.Vector2();
    for(const mode of ['sedan','tram']){
      show(mode);camera.position.set(0,0,0);placePassenger(camera,mode);camera.updateMatrixWorld(true);
      const mesh=root.children.find(m=>m.visible),position=mesh.geometry.getAttribute('position');
      assert.ok(mesh.geometry.index.count/3-mesh.geometry.userData.driverFirstFace<800);
      for(let i=0;i<position.count;i++)assert.ok(new T.Vector3().fromBufferAttribute(position,i).distanceTo(camera.position)>camera.near);
      let covered=0,left=0,right=0,bottom=0;
      for(let row=0;row<48;row++)for(let col=0;col<48;col++){
        ndc.set((col+.5)/24-1,(row+.5)/24-1);
        ray.setFromCamera(ndc,camera);
        if(!ray.intersectObject(mesh,true).length)continue;
        covered++;
        if(Math.abs(ndc.x)<.06 && Math.abs(ndc.y)<.06)assert.fail(mode+' central passenger sightline');
        if(ndc.y<-.84)bottom++;
        if(ndc.x<-.1&&ndc.y<-.55)left++;
        if(ndc.x>.1&&ndc.y<-.55)right++;
      }
      const percent=100*covered/(48*48);
      t.diagnostic(mode+' '+fov+'°: foreground covers '+percent.toFixed(1)+'%');
      assert.ok(percent>4&&percent<(mode==='sedan'?44:85));
      assert.ok(bottom>10&&left>6&&right>6);
    }
  }
  dispose();
});
test('only the selected cab draws; shared GPU resources release once on teardown',()=>{
  const {root,show,dispose}=createRideInteriors();
  const scene=new T.Scene();scene.add(root);
  assert.equal(root.visible,false);
  assert.equal(root.children.length,0);
  show('sedan');const [car]=root.children;assert.equal(root.children.length,1);
  show('tram');const tram=root.children[1];assert.equal(car.material,tram.material);
  assert.deepEqual([root.visible,car.visible,tram.visible],[true,false,true]);
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
    const hidden=root.children.find(m=>!m.visible)?.getObjectByName('Windshield wiper');
    const meshes=[];root.traverseVisible(o=>{if(o.isMesh)meshes.push(o)});
    assert.equal(meshes.length,mode==='tram'?3:2);
    if(mode==='tram')assert.ok(meshes.some(m=>m.isInstancedMesh&&m.count===8),'one draw for both sets of four folding leaves');
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
    if(hidden)assert.equal(hidden.rotation.z,0);
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
    const hit=(x,y,z)=>new T.Raycaster(new T.Vector3(),new T.Vector3(x,y,z).normalize()).intersectObject(cab,false).find(h=>h.faceIndex<cab.geometry.userData.driverFirstFace);
    for(const side of [-1,1]){
      assert.ok(!hit(side,.07,0),'eye-level side window');
      if(side>0&&mode==='tram'){
        // The front entry beside the seat has low glazing between its kick plate and waist.
        const plate=new T.Raycaster(new T.Vector3(),new T.Vector3(1,-1.12,.18).normalize());
        assert.ok(plate.intersectObject(cab,true).length,'front folding door kick plate');
      }else assert.ok(hit(side,-1,0),'door interior below glass');
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

test('saloon lighting reaches the passenger compartment while the driving glass and sedan remain clear',()=>{
  const {root,show,setNight,dispose}=createRideInteriors();
  show('sedan');show('tram');
  const [car,tram]=root.children,glow=tram.geometry.getAttribute('cabLight'),position=tram.geometry.getAttribute('position');
  let front=0,litSides=0,globes=0;
  for(let i=0;i<glow.count;i++){
    if(position.getZ(i)<pccCabFront*.06-1e-7&&position.getY(i)>-.40*.06&&position.getX(i)<.66*.06)front+=glow.getX(i);
    if(glow.getX(i)>2){globes++;assert.ok(position.getY(i)>.80*.06);}
    if(Math.abs(position.getX(i))>.8*.06&&glow.getX(i)>.4)litSides++;
  }
  assert.equal(front,0);assert.ok(globes>=500&&litSides>1000);
  assert.ok(car.geometry.getAttribute('cabLight').array.every(n=>n===0));
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <emissivemap_fragment>'};
  tram.material.onBeforeCompile(shader,{});setNight(.82);assert.equal(shader.uniforms.interiorNight.value,.82);
  dispose();
});

test('boarding builds only the selected vehicle and binds PCC printing to an already compiled sedan program',t=>{
  let canvases=0,canPrint=true;
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
  const pen={};
  for(const op of ['arc','beginPath','fill','fillRect','fillText','lineTo','moveTo','restore','save','stroke','translate'])pen[op]=()=>{};
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(tag){
    assert.equal(tag,'canvas');canvases++;return {getContext:()=>canPrint?pen:null};
  }}});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
  for(const modes of [[],['sedan'],['tram'],['sedan','tram'],['tram','sedan']]){
    const {show,root,dispose}=createRideInteriors(),built=new Set(),resources=new Set();
    let program,material,releases=0;
    const initial=canvases;
    show(null);assert.equal(root.children.length,0);
    for(const mode of [...modes,...modes]){
      show(mode);built.add(mode);
      const cab=root.children.find(o=>o.visible);
      if(!program){
        material=cab.material;program={...T.ShaderLib.standard,uniforms:{}};
        material.onBeforeCompile(program,{});resources.add(material);
      }
      assert.equal(cab.material,material);assert.equal(root.children.length,built.size);
      resources.add(cab.geometry);resources.add(cab.getObjectByName('Windshield wiper').geometry);
      assert.equal(canvases-initial,Number(built.has('tram')));
      assert.equal(program.uniforms.cardsPrinted.value,built.has('tram'));
      if(built.has('tram'))resources.add(program.uniforms.carCards.value);
      else assert.equal(program.uniforms.carCards.value,null);
    }
    for(const r of resources)r.addEventListener('dispose',()=>releases++);
    dispose();dispose();show('tram');
    assert.equal(releases,resources.size);assert.equal(root.children.length,0);
    assert.equal(canvases-initial,Number(built.has('tram')));
  }
  canPrint=false;
  const fallback=createRideInteriors();fallback.show('tram');
  const shader={...T.ShaderLib.standard,uniforms:{}};
  fallback.root.children[0].material.onBeforeCompile(shader,{});
  assert.equal(shader.uniforms.cardsPrinted.value,false);assert.equal(shader.uniforms.carCards.value,null);
  fallback.dispose();
});

test('sedan wheel and instruments read through the open spokes with no separate cockpit draw',()=>{
  const {root,show,dispose}=createRideInteriors();show('sedan');
  const mesh=root.children[0];
  function sight(x,y,z){
    return new T.Raycaster(new T.Vector3(),new T.Vector3(x,y,z).normalize()).intersectObject(mesh,false).find(h=>h.faceIndex<mesh.geometry.userData.driverFirstFace);
  }
  // Top and right rim sit ahead of the dial binnacle, with a visible opening.
  const rim=sight(-.027,-.244,-.6445),right=sight(.149,-.419,-.578);
  for(const hit of [rim,right])assert.ok(hit&&hit.point.z>-.67*.06&&hit.point.z<-.56*.06);
  const gauge=sight(-.117,-.387,-.743);
  assert.ok(gauge&&gauge.point.z<-.70*.06);
  const vent=sight(.445,-.418,-.741);
  assert.ok(vent&&vent.point.z<-.72*.06);
  assert.ok(!sight(0,.05,-1));
  const draws=[];mesh.traverse(o=>{if(o.isMesh)draws.push(o);});
  assert.equal(draws.length,2,'combined body and original wiper');
  assert.ok(mesh.geometry.userData.driverFirstFace<=260);
  dispose();
});

test('both passenger eyes sit above their cushions with the seated operator at the controls',()=>{
  const interiors=createRideInteriors();
  for(const [mode,expected] of [['sedan',[.77,0,.035]],['tram',[1,0,2.49]]]){
    interiors.show(mode);interiors.root.updateMatrixWorld(true);
    const cab=interiors.root.children.find(c=>c.visible),eye=new T.PerspectiveCamera();
    placePassenger(eye,mode);
    assert.ok(eye.position.distanceTo(new T.Vector3(...expected).multiplyScalar(.06))<1e-8);
    const cushion=new T.Raycaster(eye.position,new T.Vector3(0,-1,0)).intersectObject(cab)[0];
    assert.ok(cushion && cushion.distance>.035 && cushion.distance<.047,'seated above the first row cushion');
    const toward=(x,y,z)=>new T.Raycaster(eye.position,new T.Vector3(x,y,z).multiplyScalar(.06).sub(eye.position).normalize()).intersectObject(cab)[0];
    for(const y of [-.049,-.28]){
      const operator=toward(-.032,y,0);
      assert.ok(operator && operator.faceIndex>=cab.geometry.userData.driverFirstFace,'operator visible from the occupied passenger seat');
    }
    assert.equal(new T.Raycaster(eye.position,new T.Vector3(0,0,-1)).intersectObject(cab,true).length,0,'forward view through glass');
  }
  interiors.dispose();
});
