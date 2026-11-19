import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {ferryPublicRealm} from '../app/ferry-architecture.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {frostPlazaSurface,frostWalkHeight,frostCrossings,registeredMarketTracks,marketRailTop} from '../app/california-sidewalk.ts';
import {createCaliforniaCar,cableRailHead,californiaIslandTop} from '../app/california-terminal.ts';
import {streetcarTrack} from '../app/streets.ts';

const root=ferryPublicRealm(),mat=new T.MeshBasicMaterial({side:T.DoubleSide});
const street=new T.Group();
addSurveyBlocks((g,color,x,y,z)=>{const m=new T.Mesh(g,mat);m.position.set(x,y,z);street.add(m);return m;});
root.add(street);root.updateMatrixWorld(true);
const plaza=root.getObjectByName('Frost Plaza landings and rail approach');
const brick=root.getObjectByName('Market granite and herringbone promenade');
const paint=root.getObjectByName('Market and Drumm crosswalk paint');
const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
const pix=(u,v)=>[-5+u/210,-21+v/210];
const at=(x,z,meshes,start=.09)=>{
  ray.set(new T.Vector3(x,start,z),down);return ray.intersectObjects(meshes,false)[0]?.point.y;
};
const ground=[...street.children,brick,plaza,paint];
const close=(n,expected,tol=.0005)=>assert.ok(Math.abs(n-expected)<tol,JSON.stringify({n,expected,tol}));

test('the red herringbone Frost Plaza supports the statue approach and clears the general sidewalk and road',()=>{
  for(const [x,z] of [[-1.858,-17.747],[-2.015,-17.435],[-1.902,-17.659],pix(802,525)]){
    const top=frostPlazaSurface(x,z);
    close(top,.04535);close(at(x,z,[brick]),top);assert.ok((at(x,z,street.children)??0)<.04,'obsolete survey sidewalk removed here');
  }
  assert.equal(frostPlazaSurface(...pix(936,541)),undefined);
  assert.equal(at(...pix(936,541),[brick]),undefined);
});

test('the Drumm short crossing meets two real flush, gently rising landings with inset warning panels',()=>{
  for(const [outer,back] of [[[881,462],[842,457]],[[944,495],[977,518]]]){
    const a=pix(...outer),b=pix(...back),length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    let previous;
    for(let j=1;j<=9;j++){
      const t=j/10,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,y=at(x,z,ground);
      close(y,frostWalkHeight(x,z),.00085);
      if(previous!==undefined)assert.ok(Math.abs(y-previous)<length/10/12+.00023,'walkable longitudinal slope');
      previous=y;
    }
    close(at(...a,ground),.031,.001);
  }
  for(const p of [pix(864,462),pix(953,493)])close(at(...p,[plaza]),frostWalkHeight(...p),.0008);
});
test('registered stripe fields follow the asphalt with upward faces and share the biased paint batch',()=>{
  assert.deepEqual(Object.keys(frostCrossings),['Drumm south','California east','Drumm north','Market at Spear','Spear at Market','Market east of Spear','California west']);
  assert.equal(paint.geometry.userData.roadPaint,'Market and Drumm crossings');
  const pos=paint.geometry.attributes.position,n=paint.geometry.attributes.normal;
  for(let i=0;i<pos.count;i++){close(pos.getY(i),.03112,.00001);assert.ok(n.getY(i)>.999);}
  const axis=frostCrossings['Drumm south'];
  for(const tri of axis){
    const x=tri.reduce((s,p)=>s+p[0]/3,0),z=tri.reduce((s,p)=>s+p[1]/3,0);
    close(at(x,z,[plaza]),.031);close(at(x,z,ground),.03112,.00009);
  }
});
test('F running rails and contact wire use the measured roadway through Spear; the cable rider retains the raised island and 3ft 6in gauge',()=>{
  const rails=root.getObjectsByProperty('name','Market running rail'),wire=root.getObjectsByProperty('name','F line contact wire');
  for(const path of Object.values(registeredMarketTracks)){
    for(let i=1;i<path.length;i++){
      const [a,b]=path[i-1],[c,d]=path[i],z=-16.95;
      if((z<b)===(z<d))continue;
      const t=(z-b)/(d-b),x=a+t*(c-a),len=Math.hypot(c-a,d-b);
      for(const s of [-1,1]){
        const xx=x+s*.04305*(d-b)/len,zz=z-s*.04305*(c-a)/len;
        close(at(xx,zz,[plaza]),.031);close(at(xx,zz,rails),marketRailTop(zz));
      }
      close(at(x,z,wire,1),marketRailTop(z)+streetcarTrack.wireRise+.0015);
    }
  }
  const {car,update}=createCaliforniaCar(),rail=root.getObjectByName('Lower California cable rails and crossover');
  update(0,720);car.updateMatrixWorld(true);
  const island=root.getObjectsByProperty('name','Mapped Muni boarding island');
  const rider=car.children[1].localToWorld(new T.Vector3());close(at(rider.x,rider.z,island),californiaIslandTop);
  const axles=car.getObjectsByProperty('name','California car wheelset');
  const steelColor=new T.Color('#acaca0');
  assert.equal(axles.length,4);
  for(const [start,end] of [[30,41],[587,599.99]])for(let t=start;t<=end;t+=.125){
    update(t,720);car.updateMatrixWorld(true);
    for(const axle of axles)for(const s of [-1,1]){
      // Local y=0 is the actual bottom tread vertex of each cylinder.
      const p=axle.localToWorld(new T.Vector3(0,0,s*.5335));
      ray.set(new T.Vector3(p.x,.09,p.z),down);
      const hit=ray.intersectObject(rail)[0];
      assert.ok(hit,'wheel over track at '+t);
      close(rail.geometry.attributes.color.getX(hit.face.a),steelColor.r,.0001);
      close(p.y,hit.point.y,.000075); // 1.25 mm at full scale
    }
  }
  // Check the actual steel in the graded section between the two level
  // streets. A rigid car's geometric center is not a wheel on a turnout.
  const g=rail.geometry,pos=g.attributes.position,color=g.attributes.color;
  const steel=new T.Color('#acaca0');let probes=0;
  for(let i=0;i<g.index.count;i+=3){
    const n=g.index.getX(i);
    if(Math.abs(color.getX(n)-steel.r)>.001)continue;
    const v=new T.Vector3();
    for(let j=0;j<3;j++)v.add(new T.Vector3().fromBufferAttribute(pos,g.index.getX(i+j)));
    v.divideScalar(3);
    if(v.z<=-19.68||v.z>=-19.22||v.x< -1.72||v.x>-.24)continue;
    const base=at(v.x,v.z,[plaza]);
    close(v.y-base,.0021,.00036);
    close(v.y,cableRailHead(v.z),.00035);probes++;
  }
  assert.ok(probes>=8,'both railheads cross the graded threshold');
});
