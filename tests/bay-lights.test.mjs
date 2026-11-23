import test from 'node:test';
import assert from 'node:assert/strict';
import {compileFunction} from 'node:vm';
import {MathUtils,MeshStandardMaterial,Raycaster,ShaderLib,Vector3,Vector4} from 'three';
import {createLandscape} from '../app/landscape.ts';
import {bridgeLayout} from '../app/bridge-layout.ts';
import {configureBayWater} from '../app/bay-water.ts';
import {createBayLights,addBayLightStrand,bayLightPattern} from '../app/bay-lights.ts';

test('the installation follows the outer face of each north suspender from road to cable',()=>{
  const positions=[];
  addBayLightStrand(positions,-.75,45,8);
  assert.equal(positions.length,0);
  addBayLightStrand(positions,.75,45,8);
  assert.ok(positions.length>100);
  for(let i=0;i<positions.length;i+=3){
    assert.ok(positions[i]>.75&&positions[i]<.78);
    assert.equal(positions[i+2],45);
    assert.ok(positions[i+1]>4.24&&positions[i+1]<8);
  }
});
test('one night draw has a pausable shader clock and drops out of the daytime render',()=>{
  const {lights,update}=createBayLights([.772,7.1,45]);
  const shader={...ShaderLib.points,uniforms:{}};
  lights.material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/diffuseColor\.a\*=bayLightLevel/);
  assert.equal(lights.visible,false);
  update(.5,8.25);
  assert.ok(lights.visible&&lights.material.opacity>.5);
  assert.equal(shader.uniforms.bayLightTime.value,8.25);
  update(1,8.25);assert.equal(shader.uniforms.bayLightTime.value,8.25);
  update(1,9.5);assert.equal(shader.uniforms.bayLightTime.value,9.5);
  update(0,12);assert.equal(lights.visible,false);assert.equal(lights.material.opacity,0);
});

test('nearby strands resolve at their projected scale and only shine toward the northern waterfront',()=>{
  const {lights}=createBayLights([.772,7.1,45]),shader={...ShaderLib.points,uniforms:{}};
  lights.material.onBeforeCompile(shader);
  const vertex=shader.vertexShader;
  assert.ok(vertex.includes('isPerspectiveMatrix(projectionMatrix)?normalize(-mvPosition.xyz):vec3(0.,0.,1.)'));
  assert.ok(vertex.includes('normalize(mat3(modelViewMatrix)*vec3(1.,0.,0.))'));
  assert.ok(vertex.includes('scale*projectionMatrix[1][1]/depth'));
  const fieldOfView=32*Math.PI/180;
  const pixelsPerUnit=distance=>352/Math.tan(fieldOfView/2)/distance;
  const sizeExpr=vertex.match(/gl_PointSize=(size\*clamp\([^;]+);/)[1];
  const diameter=compileFunction('return '+sizeExpr,['size','pixelsPerUnit','clamp']);
  const at=distance=>diameter(lights.material.size,pixelsPerUnit(distance),MathUtils.clamp);
  assert.equal(at(150),2);
  assert.ok(at(30)>4&&at(30)<5,'near waterfront groups resolve individually');
  assert.equal(at(5),8,'close tower sample stays bounded');
  const lobe=vertex.match(/bayLightLevel\*=smoothstep\(([-.\d]+),([.\d]+),dot\(outward,toEye\)\)/);
  const facing=cosine=>MathUtils.smoothstep(cosine,Number(lobe[1]),Number(lobe[2]));
  assert.equal(facing(-.1),0);
  assert.ok(facing(.03)>0&&facing(.03)<1);
  assert.equal(facing(.2),1,'oblique shoreline retains the primary display');
});

test('the assembled western crossing carries moving light through every 100 m of its six spans',()=>{
  const city=createLandscape(), {lights}=city.bayLights;
  city.root.updateMatrixWorld(true);
  const position=lights.geometry.getAttribute('position'), strands=new Map();
  for(let i=0;i<position.count;i++){
    const z=position.getZ(i);
    if(!strands.has(z))strands.set(z,[]);
    strands.get(z).push(position.getY(i)-bridgeLayout.upperDeck);
  }
  const stations=[...strands.keys()].sort((a,b)=>a-b);
  assert.equal(stations.length,308);
  const [w2,w3,w5,w6]=bridgeLayout.towers;
  const limits=[15.64,w2,w3,bridgeLayout.anchor,w5,w6,bridgeLayout.length];
  const spans=limits.slice(1).map((end,i)=>stations.filter(z=>z>limits[i]&&z<end));
  assert.deepEqual(spans.map(span=>span.length),[38,75,38,38,75,44]);
  assert.ok(stations.every((z,i)=>!i||z-stations[i-1]<1.2));
  assert.equal(lights.material.depthTest,true);
  assert.equal(lights.material.depthWrite,false);
  assert.equal(lights.material.sizeAttenuation,false);

  const outward=new Vector3(1,0,0).transformDirection(lights.matrixWorld);
  for(const span of spans){
    const z=span[Math.floor(span.length/2)],levels=strands.get(z),height=levels[Math.min(2,levels.length-1)]+bridgeLayout.upperDeck;
    const emitter=lights.localToWorld(new Vector3(position.getX(0),height,z));
    const outside=emitter.clone().addScaledVector(outward,.05);
    const hit=new Raycaster(outside,outward.clone().negate(),0,.1).intersectObjects(city.architectureChunks)[0];
    assert.ok(hit&&hit.distance>.05&&hit.distance<.065,'the outer lens sits directly on its suspender');
  }

  // Run the scalar GLSL expression used by both the artwork and its reflection.
  const body=bayLightPattern.slice(bayLightPattern.indexOf('{')+1,bayLightPattern.lastIndexOf('}'));
  const level=compileFunction(body.replaceAll('float ','const '),['z','h','t','sin','smoothstep']);
  const smoothstep=(low,high,x)=>MathUtils.smoothstep(x,low,high);
  let minimum=1,maximum=0,largestChange=0,previous=[];
  for(let t=0;t<240;t+=1){
    const means=stations.map(z=>{
      const heights=strands.get(z);
      return heights.reduce((sum,h)=>sum+level(z,h,t,Math.sin,smoothstep),0)/heights.length;
    });
    for(let i=0;i<means.length;i++){
      minimum=Math.min(minimum,means[i]);maximum=Math.max(maximum,means[i]);
      if(previous.length)largestChange=Math.max(largestChange,Math.abs(previous[i]-means[i]));
      if(i<10)continue;
      // Eleven adjacent suspenders span roughly 100 m. Give each an equal vote.
      const average=means.slice(i-10,i+1).reduce((a,b)=>a+b,0)/11;
      assert.ok(average>.18,`dark run near station ${stations[i]} at ${t}s`);
    }
    previous=means;
  }
  assert.ok(minimum<.16&&maximum>.90&&largestChange>.10,'bright crests and moving shadows survive');
});

test('Ferry Building night reflections follow lit architectural features and skip the terminal decks',()=>{
  const material=new MeshStandardMaterial(),night={value:0};
  configureBayWater(material,{value:0},Array.from({length:5},()=>new Vector4()),night,{value:0});
  const shader={...ShaderLib.standard,uniforms:{}};
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.bayNight,night);
  const {width,height,data}=shader.uniforms.ferryReflectionWater.value.image;
  const water=(x,z)=>data[Math.floor(z*height/24)*width+Math.floor((x+16)*width/32)];
  for(const [x,z] of [[-3.7,6.2],[6.22,5.52],[-4.13,9.58]])assert.equal(water(x,z),0,'under wharf or float');
  for(const [x,z] of [[3.6,5],[-4,13],[1,4]])assert.equal(water(x,z),255,'open water');
  assert.match(shader.fragmentShader,/if\(bayNight>\.001 && p.y>1\.64/);
  assert.match(shader.fragmentShader,/ty-2\.035/);
  assert.match(shader.fragmentShader,/23\.\/12\.101/);
  assert.ok(shader.fragmentShader.includes('totalEmissiveRadiance+=strokes'));
  material.dispose();
});

test('both cable valleys carry four 2¼-inch suspender legs per band down to the shoulder tread',async()=>{
  const {Group,Mesh}=await import('three');
  const {addWestSpanSuspenders}=await import('../app/west-span-suspenders.ts');
  const {westMainCableRadius,westTowerCableX}=await import('../app/west-span-towers.ts');
  const g=new Group(),material=new MeshStandardMaterial();
  const lights=addWestSpanSuspenders(g,(geom,_color,x,y,z,parent)=>{
    const part=new Mesh(geom,material);part.position.set(x,y,z);parent.add(part);return part;
  });
  g.updateMatrixWorld(true);
  const steel=g.children.filter(o=>o.name==='Cable bands and four-legged suspenders');
  for(const [a,b] of [[bridgeLayout.towers[0],bridgeLayout.towers[1]],[bridgeLayout.towers[2],bridgeLayout.towers[3]]]){
    const mid=(a+b)/2,tread=bridgeLayout.upperDeck+.0755+.015;
    for(const side of [-1,1])for(const dz of [-.015,.015]){
      const y=tread+.043,ray=new Raycaster(new Vector3(side*westTowerCableX+.045,y,mid+dz),new Vector3(-1,0,0),0,.1);
      const hits=ray.intersectObjects(steel).map(h=>h.point.x).filter((v,i,arr)=>i===0||Math.abs(v-arr[i-1])>.0001);
      assert.equal(hits.length,2,'two legs in each longitudinal rope plane');
      for(const [i,x] of hits.entries())
        assert.ok(Math.abs(x-(side*westTowerCableX+(i?-1:1)*westMainCableRadius+2.25*.0254*.06/2))<.0001);
    }
    const line=g.children.filter(o=>o.name==='Wrapped main cable');
    const hit=new Raycaster(new Vector3(westTowerCableX,9,mid),new Vector3(0,-1,0)).intersectObjects(line)[0];
    assert.ok(hit&&Math.abs((hit.point.y-westMainCableRadius-tread)/.06-1.42)<.05);
    assert.ok(lights.some((n,i)=>i%3===2&&Math.abs(n-(mid+.015))<.001));
  }
  for(const shape of new Set(g.children.map(c=>c.geometry)))shape.dispose();
  material.dispose();
});
