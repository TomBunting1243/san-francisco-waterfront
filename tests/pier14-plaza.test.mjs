import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createPier14Plaza,createPier14Chairs,pier14Ground,pier14Seats,pier14Chairs} from '../app/pier14-plaza.ts';
import sf from '../public/data/sf-waterfront.json' with {type:'json'};
const down=(m,x,z,start=.25)=>new T.Raycaster(new T.Vector3(x,start,z),new T.Vector3(0,-1,0)).intersectObject(m).map(h=>h.point.y);
test('Mission plaza supports eight seat blocks and Corpus, keeps its waterfront recess open and joins both thresholds',()=>{
 const plaza=createPier14Plaza();
 const floor=(x,z)=>down(plaza,x,z)[0];
 assert.ok(Math.abs(floor(-15.1954,-.807)-.060)<.0001);
 assert.equal(pier14Seats.length,8);
 for(const [x,z] of pier14Seats){
   const levels=down(plaza,x,z);
   assert.ok(Math.abs(levels[0]-pier14Ground(x,z)-.465*.06)<.00015);
   assert.ok(levels.some(y=>Math.abs(y-pier14Ground(x,z))<.001));
   assert.ok(Math.hypot(x+15.1954,z+.807)>.245);
 }
 assert.ok(Math.abs(floor(-14.223,-.246)-.096)<.0003);
 assert.ok(Math.abs(floor(-16.766,-.11)-.06)<.0003);
 assert.equal(floor(-16.50,-.60),undefined);
 // Both public accesses remain clear at chair/rail height.
 for(const [x,z] of [[-16.766,0],[-14.22,-.26],[-14.21,-.40],[-15.2,-.48]])assert.ok(floor(x,z)<.10);
 assert.ok(plaza.geometry.index.count/3<1350);
});

test('eight pairs and five swivel chairs fit the mapped pier with a continuous through passage',()=>{
 const m=createPier14Chairs(),ring=sf.piers.find(p=>p.name==='Pier 14').p;
 function inside(x,z){
   let yes=false;for(let i=1;i<ring.length;i++){
     const a=ring[i-1],b=ring[i];if((a[1]>z)!==(b[1]>z)&&x<a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]))yes=!yes;
   }return yes;
 }
 assert.equal(pier14Chairs.length,21);
 for(const [x,z] of pier14Chairs){
   assert.ok(Math.abs(down(m,x,z)[0]-(.060+.445*.06))<.00005);
   for(let k=0;k<8;k++)assert.ok(inside(x+.021*Math.cos(k*Math.PI/4),z+.021*Math.sin(k*Math.PI/4)));
   assert.ok(down(m,x+.012,z,.065).some(y=>Math.abs(y-.0618)<.00012));
 }
 for(let z=.4;z<11.6;z+=.08)assert.ok(!down(m,-17.29,z).length);
 assert.ok(m.geometry.index.count/3<3350);
});

test('visitors can reach their seats, set both feet down and look out from the same pier',async()=>{
  const {pier14Visitors,pier14Visit,updatePier14Visitors}=await import('../app/pier14-visitors.ts');
  const {createPeople}=await import('../app/people.ts');
  const start=2,people=createPeople(start+pier14Visitors.length,pier14Visitors.length);
  const empty=createPeople(2),count=start+pier14Visitors.length;
  assert.equal(people.group.children.length,empty.group.children.length,'seated limbs share the existing instanced draws');
  const legs=people.group.getObjectByName('Contour trousers'),shoes=people.group.getObjectByName('Shoes');
  const shadows=people.group.getObjectByName('Foot contact shadows');
  assert.equal(legs.count,2*(count+pier14Visitors.length));
  const plaza=createPier14Plaza(),m=new T.Matrix4();
  const position=(obj,i)=>{obj.getMatrixAt(i,m);return new T.Vector3().setFromMatrixPosition(m);};
  const pier=sf.piers.find(p=>p.name==='Pier 14').p;
  function onPier(x,z){
    let inside=false;
    for(let i=1;i<pier.length;i++){
      const [a,b]=pier.slice(i-1,i+1);
      if((a[1]>z)!==(b[1]>z)&&x<a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]))inside=!inside;
    }
    return inside;
  }
  for(const [index,site] of pier14Visitors.entries()){
    const phases=new Set();let prev=pier14Visit(site,0);
    for(let frame=1;frame<2200;frame++){
      const now=frame/20,p=pier14Visit(site,now);
      assert.ok(Math.hypot(p.x-prev.x,p.z-prev.z)<.0042,'continuous walking or settling at human speed');
      prev=p;
      if(frame%8)continue;
      phases.add(p.seated===1?'sit':p.seated>0?'settle':p.pace>0?'walk':'stand');
      if(site.pier)assert.ok(onPier(p.x,p.z),'inside the pier footprint');
      else{
        assert.ok(down(plaza,p.x,p.z).some(h=>Math.abs(h-p.y)<.001),'paving beneath the visitor');
        assert.ok(Math.hypot(p.x+15.1954,p.z+.807)>.24,'clear of the sculpture');
      }
      if(p.seated!==1)continue;
      people.setViewer(site.x+3,site.z-2);
      updatePier14Visitors(people,start,pier14Visitors,now);
      const i=start+index,head=position(people.heads,i);
      assert.ok(head.y-p.y>.066&&head.y-p.y<.091,'seated head has a plausible height');
      for(const side of [0,1]){
        const foot=position(shoes,2*i+side),shadow=position(shadows,2*i+side);
        const reach=(foot.x-site.x)*Math.cos(site.facing)+(foot.z-site.z)*Math.sin(site.facing);
        assert.ok(reach>.036&&reach<.056,'shoes clear the front edge of the stone or chair');
        assert.ok(Math.abs(shadow.y-p.y)<.001&&Math.abs(foot.y-p.y)<.006);
        const thigh=position(legs,2*(i+pier14Visitors.length)+side);
        assert.ok(Math.abs(thigh.y-p.y-site.seatHeight)<.005,'thigh meets the cap');
      }
    }
    assert.deepEqual([...phases].sort(),['settle','sit','stand','walk']);
  }
});
