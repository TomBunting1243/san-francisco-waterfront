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
      assert.ok(mesh.geometry.index.count/3<(mode==='sedan'?145:6000));
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
    if(mode==='tram')assert.ok(meshes.some(m=>m.isInstancedMesh&&m.count===4),'one draw for all four folding leaves');
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
    const hit=(x,y,z)=>new T.Raycaster(new T.Vector3(),new T.Vector3(x,y,z).normalize()).intersectObject(cab,false)[0];
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
    if(position.getZ(i)<-.70*.06&&position.getY(i)>-.40*.06&&position.getX(i)<.66*.06)front+=glow.getX(i);
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
