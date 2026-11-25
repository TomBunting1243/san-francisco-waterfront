import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {addGriffonEastFront} from '../app/griffon-east-front.ts';

const scale=.06,grade=.045,roof=18.1,length=Math.hypot(.816,.128),half=length/scale/2;
const root=new T.Group(),windows=[];
root.position.set((-18.505-17.689)/2,0,(-3.827-3.955)/2);
root.rotation.y=Math.atan2(.128,.816);
addGriffonEastFront(root,length,grade+roof*scale,new FontLoader().parse(fontData),windows);
root.updateMatrixWorld(true);
const mesh=root.children[0],g=mesh.geometry,xyz=g.attributes.position,energy=g.attributes.signLight;
const local=(x,y,z)=>new T.Vector3(x*scale,grade+y*scale,z*scale);
const transform=v=>v.clone().applyMatrix4(root.matrixWorld);
const ray=(p,dir)=>new T.Raycaster(transform(p),dir.clone().transformDirection(root.matrixWorld)).intersectObject(mesh)[0];
const depth=(x,y)=>root.worldToLocal(ray(local(x,y,8),new T.Vector3(0,0,-1)).point).z/scale;
const height=(x,z)=> (root.worldToLocal(ray(local(x,20,z),new T.Vector3(0,-1,0)).point).y-grade)/scale;
const near=(a,b,e=.002)=>assert.ok(Math.abs(a-b)<e,`${a} vs ${b}`);

test('the two east pavilions, deep central notch and stepped cornice meet the shared shell elevations',()=>{
  assert.equal(root.children.length,1);assert.equal(mesh.name,'Hotel Griffon Embarcadero elevation');
  assert.ok(g.index.count/3<3700&&g.index.count/3>1400);
  for(const z of [-3.248,-2.0,-.12]){
    near(height(0,z),14.10);near(height(-3.1,z),roof);near(height(3.1,z),roof);
  }
  near(depth(.2,16.2),-3.25);
  near(depth(half-.35,14.0),.40);
  near(depth(half-.50,16.8),.015);
  assert.equal(ray(local(0,20,-3.27),new T.Vector3(0,-1,0)),undefined);
  for(const x of [-.88,.82])near(depth(x,12.0),0);
});

test('two rows of segmental windows, flat upper heads and the open stairs follow the field photograph',()=>{
  const x=-half*.8,ground=roof*.186,step=(roof*.725-ground)/3;
  for(const floor of [0,1]){
    const spring=ground+(floor+1)*step-.73;
    near(depth(x+.065,spring+.14),-.15);
    near(depth(x+.53,spring+.14),0);
  }
  const flatHead=ground+3*step-.73;near(depth(x+.065,flatHead+.14),0);
  const landing=ground+.37;
  near(depth(.48,landing+.447),.87);
  assert.ok(depth(.48,landing+.63)<.8);
  // The stringer rises toward photo-left and is visible in the gap between rails.
  near(depth(.035,landing+(.08+step)/2),.65,.03);
  assert.equal(windows.length,7);
  const normal=new T.Vector3(0,0,1).transformDirection(root.matrixWorld);
  for(const w of windows){
    assert.equal(w.ry,root.rotation.y);
    const start=new T.Vector3(w.x,w.y,w.z).addScaledVector(normal,.002);
    const hit=new T.Raycaster(start,normal.clone().negate(),0,.01).intersectObject(mesh)[0];
    assert.ok(hit&&hit.distance>=.002&&hit.distance<=.0034,'room light sits inside its real recessed sash');
  }
});

test('both sides of the corner blade carry 12 readable luminous letters and the separate brass griffon',()=>{
  const seen=new Map(),crest=new Set(),perry=new Set(),p=new T.Vector3(),normal=new T.Vector3();
  const centers=[...Array.from({length:5},(_,i)=>roof*.635-.07-(i+.5)*(roof*(.635-.466)-.14)/5),
    ...Array.from({length:7},(_,i)=>roof*.413-.07-(i+.5)*(roof*(.413-.251)-.14)/7)];
  for(let i=0;i<g.index.count;i+=3){
    const a=g.index.getX(i);
    if(energy.getX(a)<.54&&energy.getZ(a)<.40)continue;
    normal.fromBufferAttribute(g.attributes.normal,a);
    if(Math.abs(normal.x)<.99)continue;
    const dir=Math.sign(normal.x);
    const verts=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(xyz,g.index.getX(i+j)));
    p.copy(verts[0]).add(verts[1]).add(verts[2]).multiplyScalar(1/3);
    const y=(p.y-grade)/scale;
    if(energy.getX(a)>.5){
      assert.ok(Math.abs(p.x/scale-(half-.98))<.16);
      if(energy.getY(a)<.40){crest.add(dir);assert.ok(y>roof*.413&&y<roof*.466);continue;}
      const band=centers.findIndex(v=>Math.abs(y-v)<.215);
      assert.notEqual(band,-1);
      const k=dir+'/'+band;
      if(!seen.has(k)){
        const axis=new T.Vector3(dir,0,0);
        const hit=ray(p.clone().addScaledVector(axis,.006),axis.negate());
        assert.ok(hit&&energy.getX(hit.face.a)>.5,'letter is foremost on blade face');
        seen.set(k,true);
      }
    }else{perry.add(dir);assert.ok(p.x/scale< -half+.65&&energy.getZ(a)>energy.getX(a));}
  }
  assert.equal(seen.size,24);assert.equal(crest.size,2);assert.equal(perry.size,2);
  assert.equal(root.children.filter(c=>c.isLight).length,0);
  assert.equal(energy.getX(ray(local(-half+1,11.5,5),new T.Vector3(0,0,-1)).face.a),0);
});

test('the three café parasols occupy the sidewalk beside the restaurant with a clear through route',()=>{
  for(const x of [-half*.82,-half*.16,half*.35]){
    near(height(x+.3,3),2.37,.05);
    const base=ray(local(x, .07,3.25),new T.Vector3(0,0,-1));
    assert.ok(base);near(root.worldToLocal(base.point).z/scale,3.15);
  }
  g.computeBoundingBox();assert.ok(7.56-g.boundingBox.max.z/scale>3.3);
  assert.ok(grade===.045&&mesh.material.vertexColors);
});
