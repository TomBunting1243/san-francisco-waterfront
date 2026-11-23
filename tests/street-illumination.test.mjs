import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createLandscape,createCityVignette} from '../app/landscape.ts';
import {createStreetField,createStreetIllumination,createSignalHousings,signalLensCenter,waterfrontSignals,signalAspects} from '../app/street-illumination.ts';
import fixtures from '../public/data/promenade-lights.json' with {type:'json'};
import grades from '../public/data/promenade-light-grades.json' with {type:'json'};
import {northWaterfrontGrade} from '../app/north-quay-grade.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';

const channelAt=(field,x,z,c=0)=>{
  const {width,data}=field.image;
  const row=x>=78?674+Math.floor((z+6.5)/.12):Math.floor((z+64)/.12);
  const col=Math.floor((x-(x>=78?78:-56))/.12);
  return data[(row*width+col)*4+c];
};
const compile=mat=>{
  const lib=T.ShaderLib.standard,shader={vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader,uniforms:{}};
  mat.onBeforeCompile(shader,{});return shader;
};
test('representative SFMTA heads stand on the surveyed curb; main and cross traffic clear to all red',()=>{
  const parts=[];addSurveyBlocks(g=>{const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));parts.push(m);return m;});
  for(const head of waterfrontSignals.filter(h=>!h.mount)){
    const hit=new T.Raycaster(new T.Vector3(head.x,.12,head.z),new T.Vector3(0,-1,0),0,.13).intersectObjects(parts)[0];
    assert.ok(hit&&Math.abs(hit.point.y-head.y)<.0003);
  }
  assert.deepEqual([0,32,36,38,58,62,64].map(signalAspects),[[2,0],[1,0],[0,0],[0,2],[0,1],[0,0],[2,0]]);
});
test('both Market carriageways see the main aspect from upstream, including their overhead heads',()=>{
  const market=waterfrontSignals.filter(h=>h.mount&&!h.surveyed),housing=createSignalHousings();
  const lighting=createStreetIllumination(new T.Group(),[],new T.MeshBasicMaterial()),field=createStreetField([]);
  const lenses=lighting.lenses,colors=lenses.geometry.attributes.color;
  const aspectColors=['#ff4938','#ffc444','#65d98e'].map(c=>new T.Color(c));
  for(const [heading,roadZ] of [[-Math.PI/2,-2.95],[Math.PI/2,-5.75]]){
    const group=market.filter(h=>Math.sign(h.heading)===Math.sign(heading));
    assert.equal(group.length,3);
    assert.equal(group.filter(h=>h.mount.arm).length,1);
    for(const h of group){
      const origin=new T.Vector3(h.x+1.8*Math.sin(heading),.11,roadZ);
      for(const [time,aspect] of [[0,2],[33,1],[39,0],[60,0]]){
        lighting.update(time,1);
        const center=signalLensCenter(h,aspect),delta=center.clone().sub(origin);
        const ray=new T.Raycaster(origin,delta.clone().normalize(),0,delta.length()+.03);
        const face=ray.intersectObject(lenses)[0],back=ray.intersectObject(housing)[0];
        assert.ok(face&&back&&face.distance<back.distance,'clear lens ahead of casing '+[h.x,h.z,time]);
        assert.ok(face.point.distanceTo(center)<.00002);
        assert.ok(new T.Vector3().fromBufferAttribute(colors,face.face.a).distanceTo(new T.Vector3(...aspectColors[aspect].toArray()))<.000001);
        if(h.mount.arm)assert.ok(center.y-.04>4.8*.06,'clear height over traffic');
        assert.ok(channelAt(field,center.x,center.z,1)>110);
        assert.equal(channelAt(field,center.x,center.z,2),0);
      }
    }
  }
  field.dispose();lighting.dispose();housing.geometry.dispose();
});

test('field derives from the scene globes, is local, and reaches the same shader on buildings, people and buses',()=>{
  const scene=createLandscape(),globes=scene.streetGlobes,field=createStreetField(globes);
  const {shelterPools,ferryWalkPools}=scene.root.userData;
  const steuart=createStreetField(globes,ferryWalkPools,shelterPools),unlit=createStreetField(globes,ferryWalkPools);
  const emitters=[];
  for(const chunk of scene.architectureChunks){
    const glass=chunk.geometry.attributes.signLight,position=chunk.geometry.attributes.position;
    if(!glass)continue;
    for(let i=0;i<glass.count;i++){
      if(glass.getX(i)>.89&&glass.getY(i)>.87&&glass.getZ(i)>.75&&position.getZ(i)<-8)
        emitters.push(new T.Vector3().fromBufferAttribute(position,i));
    }
  }
  assert.equal(shelterPools.length,4);
  for(const name of ['Steuart and Market sheltered terminal','Steuart and Mission sheltered terminal']){
    const stop=scene.transit.poses.getObjectByName(name);
    const canopy=stop.getObjectByName('Muni shelter with wave roof, bench and information case');
    for(const side of [-1,1]){
      const lens=canopy.localToWorld(new T.Vector3(side*1.88,2.481,.06));
      const pool=shelterPools.find(p=>lens.distanceTo(new T.Vector3(p.x,p.y,p.z))<.00001);
      assert.ok(pool,'roof light registered to its final canopy offset at '+name);
      assert.ok(emitters.some(p=>lens.distanceTo(p)<.018),'night glass survives static architecture bake');
      const up=new T.Raycaster(lens,new T.Vector3(0,1,0),0,.005);
      assert.ok(up.intersectObject(canopy)[0],'housing reaches a roof support');
      assert.equal(channelAt(unlit,lens.x,lens.z,2),0);
      assert.ok(channelAt(steuart,lens.x,lens.z,2)>175);
      assert.ok(Math.abs(channelAt(steuart,lens.x,lens.z,1)/255-lens.y)<.003);
      assert.equal(channelAt(steuart,lens.x,lens.z),channelAt(unlit,lens.x,lens.z),'surrounding street illumination retained');
    }
    const bench=canopy.localToWorld(new T.Vector3(0,.54,-.31));
    assert.ok(channelAt(steuart,bench.x,bench.z,2)>70,'waiting area receives local light');
  }
  const flag=scene.transit.poses.getObjectByName('2 Sutter terminal at Steuart and Don Chee').position;
  assert.equal(channelAt(steuart,flag.x,flag.z,2),0,'no roof light at uncovered flag');
  // The shader decodes local roof lights only in this empty part of the signal field.
  for(let x=-13.16;x<=-2.34;x+=.06)for(let z=-9.46;z<=-7.94;z+=.06)
    for(const c of [1,2])assert.equal(channelAt(unlit,x,z,c),0);
  steuart.dispose();unlit.dispose();
  const plazaSamples=[
    ['Harry Bridges median',0,-4.65,150],['western carriageway',2,-5,190],
    ['palm walk curb',3,-6,230],['brick court',3,-8.8,200],
    ['fountain approach',6,-7.5,220],['Washington gate',12,-6,115],['northern approach',12,-9,25],
  ];
  for(const [label,x,z,minimum] of plazaSamples)assert.ok(channelAt(field,x,z)>=minimum,label);
  assert.equal(channelAt(field,10,-9),0,'no invented lamp in the interior of the park');
  const visible=scene.root.getObjectByName('Waterfront streetlamp halos').geometry.getAttribute('position');
  assert.deepEqual(visible.array,Float32Array.from(globes));
  for(const row of [fixtures.curb,fixtures.inland])for(const [,x,z] of row){
    assert.ok(channelAt(field,x,z)>220,'surface beneath mapped light at '+[x,z]);
  }
  for(const row of [fixtures.curb,fixtures.inland]){
    const [,x,z]=row.at(-1);
    assert.ok(channelAt(field,x+.46,z)>25,'Broadway pool extends north past its source');
  }
  const [tip,x0]=fixtures.pier.at(-1);
  assert.ok(channelAt(field,x0,tip+.36)>25,'Pier 7 tip pool retains its offshore side');
  const terrain=[];
  scene.root.traverse(node=>{if(node.isMesh&&node.parent?.name.endsWith(' elevation'))terrain.push(node);});
  const streetSurfaces=[...scene.architectureChunks,...terrain],down=new T.Vector3(0,-1,0);
  const rincon=[287051,282079,284944,281691,281690,281688,284943,281687,282992];
  const ground=(x,z)=>new T.Raycaster(new T.Vector3(x,.14,z),down,0,.30)
    .intersectObjects(streetSurfaces,false).find(hit=>hit.face.normal.y>.6)?.point.y;
  for(const [id,x,z,yaw] of [...fixtures.curb,...fixtures.inland].filter(([id])=>
    [...rincon,287068,287069,282128,282127,284096].includes(id))){
    assert.ok(Math.abs(grades[id]-ground(x,z))<.00002,'fixture sits on the final streetscape at '+id);
    if(id===282128||id===284096){
      for(let k=0;k<8;k++){
        const angle=k*Math.PI/4-yaw,r=.22*.06;
        const px=x+r*Math.cos(angle),pz=z+r*Math.sin(angle);
        assert.ok(ground(px,pz)>=northWaterfrontGrade(px)-.00002,'unsupported cast foot at '+id+' corner '+k);
      }
    }
    if(rincon.includes(id))for(let k=0;k<8;k++){
      const a=Math.PI*k/4,r=.22*.06;
      assert.ok(Math.abs(ground(x+r*Math.cos(a),z+r*Math.sin(a))-.045)<.0001,'whole pedestal supported at '+id+' azimuth '+k);
    }
  }
  // A transect across a real protected cycleway segment, including the
  // foreground carriageway and the soil shoulder behind the sidewalk.
  const aerial=(u,v)=>ground(-31.3+u/132,-v/132);
  for(const [v,y] of [[220,.031],[199-.9,.042],[182,.0361],[156,.045],[135,.045],[115,.0775]]){
    assert.ok(Math.abs(aerial(394,v)-y)<.0015,'Rincon transect at pixel row '+v);
  }
  assert.ok(aerial(370,204)<.04,'physical gap between two separator blocks');
  for(const [x,z] of [[-26.915,-4.501],[-27.319,-4.648],[-27.717,-4.79]]){
    assert.ok(Math.abs(ground(x+.018,z)-.040)<.0001,'inland tree soil stays exposed at '+x);
  }
  // Inspect the final material/geometry along each row, after the city bake.
  // Every halo must share a housing with vertices that the night shader lights.
  const vertices=new Map(),key=(x,z)=>Math.floor(x*4)+','+Math.floor(z*4);
  for(const chunk of scene.architectureChunks){
    const lights=chunk.geometry.attributes.signLight;
    if(!lights)continue;
    assert.match(compile(chunk.material).fragmentShader,/nightSignLight\s*\*\s*smoothstep/);
    const pos=chunk.geometry.attributes.position;
    for(let i=0;i<lights.count;i++)if(lights.getX(i)>.85&&lights.getY(i)>.52&&pos.getY(i)<.7){
      const p=new T.Vector3().fromBufferAttribute(pos,i),k=key(p.x,p.z);
      if(!vertices.has(k))vertices.set(k,[]);
      vertices.get(k).push(p);
    }
  }
  let index=0;
  for(const row of [fixtures.curb,fixtures.inland])for(const [id,,,,heads] of row)for(let j=0;j<heads;j++){
    const center=new T.Vector3().fromArray(globes,index);index+=3;
    const near=new Set();
    for(const dx of [-.02,0,.02])for(const dz of [-.02,0,.02])near.add(key(center.x+dx,center.z+dz));
    assert.ok([...near].some(k=>vertices.get(k)?.some(p=>p.distanceTo(center)<.018)),'emissive glass at municipal pole '+id);
  }
  // The static bake removes the source lenses. Check the four authored
  // globe positions independently of both the source array and the halo batch.
  for(const z of [-2.05,-7.45])for(const sign of [-1,1]){
    const x=-.13+z*.133+sign*.83;
    assert.ok(globes.some((v,i)=>i%3===0&&Math.abs(v-x)<.001&&Math.abs(globes[i+2]-z)<.001));
    assert.ok(channelAt(field,x,z)>220);
  }
  const market=[];
  for(let i=0;i<globes.length;i+=3)if(globes[i+2]<-10)market.push(globes.slice(i,i+3));
  assert.ok(market.length>=60);
  for(const [x,,z] of market)assert.ok(channelAt(field,x,z)>235);
  assert.ok(channelAt(field,14,-35)===0);
  scene.root.updateMatrixWorld(true);
  for(const h of waterfrontSignals){
    const p=signalLensCenter(h);
    assert.ok(channelAt(field,p.x,p.z,h.axis+1)>110);
    if(h.mount&&!h.surveyed){
      const base=new T.Raycaster(new T.Vector3(h.x+.009,.14,h.z),down,0,.2)
        .intersectObject(scene.root,true).find(hit=>hit.face?.normal.y>.7)?.point.y;
      assert.ok(Math.abs(base-h.y)<.003,'Market pole on actual landing '+[h.x,h.z,base,h.y]);
    }
  }
  const light=createStreetIllumination(scene.root,globes,scene.waterMaterial);
  const receiver=[scene.architectureChunks[0].material,scene.walkers.material,scene.transit.batch.material];
  for(const m of receiver){
    const shader=compile(m);
    assert.equal(shader.fragmentShader.match(/texture2D\(waterfrontStreetField/g).length,1);
    assert.ok(/batchingMatrix\*(lightSpace|harborWorld)/.test(shader.vertexShader)&&/instanceMatrix\*(lightSpace|harborWorld)/.test(shader.vertexShader));
    assert.ok(shader.fragmentShader.indexOf('outgoingLight+=waterfrontStreetNight')<shader.fragmentShader.indexOf('#include <opaque_fragment>'));
  }
  const u=compile(receiver[0]).uniforms,a=light.lenses.geometry.attributes.color;
  light.update(4,0);assert.equal(u.waterfrontStreetNight.value,0);
  assert.ok(a.getY(22)>a.getX(22)); // active green persists in daylight
  light.update(4,1);assert.equal(u.waterfrontStreetNight.value,1);const version=a.version;
  light.update(4,1);assert.equal(version,a.version); // paused frame
  light.update(39,1);assert.ok(a.getX(0)>a.getY(0));
  light.update(39,1,false);assert.equal(u.waterfrontStreetNight.value,0);assert.ok(a.getX(0)<.13);
  assert.ok(!compile(scene.waterMaterial).fragmentShader.includes('waterfrontStreetField'));
  const vignette=createCityVignette('plaza'),copy=createStreetIllumination(vignette.root,vignette.streetGlobes,vignette.waterMaterial);
  assert.deepEqual(vignette.root.getObjectByName('Waterfront streetlamp halos').geometry.attributes.position.array,Float32Array.from(vignette.streetGlobes));
  assert.notEqual(scene.lampGlow,vignette.lampGlow);
  const v=compile(vignette.walkers.material);copy.update(39,.85);
  assert.ok(v.uniforms.waterfrontStreetNight.value>.9&&u.waterfrontStreetNight.value===0);
  assert.equal(compile(vignette.architectureChunks[0].material).fragmentShader.match(/texture2D\(waterfrontStreetField/g).length,1);
  console.log(globes.length/3,'globes;',market.length,'Path of Gold;',field.image.data.byteLength,'field bytes');
  light.dispose();copy.dispose();field.dispose();
});

test('ride headlamp updates a fixed material cone without changing scene lights or material programs',()=>{
  const group=new T.Group(),road=new T.MeshStandardMaterial(),water=new T.MeshStandardMaterial();
  group.add(new T.Mesh(new T.PlaneGeometry(1,1),road));
  const city=createStreetIllumination(group,[],water,true),shader=compile(road),u=shader.uniforms;
  const key=road.customProgramCacheKey(),version=road.version;
  const position=new T.Vector3(13,4,-3),direction=new T.Vector3(2,-.1,-8);
  assert.equal(u.cabLampIntensity.value,0);
  city.setCabLamp(position,direction,1.4);
  assert.deepEqual(u.cabLampPosition.value.toArray(),position.toArray());
  assert.ok(u.cabLampDirection.value.distanceTo(direction.clone().normalize())<1e-12);
  assert.equal(u.cabLampIntensity.value,1.4);
  position.set(0,0,0);assert.equal(u.cabLampPosition.value.x,13);
  city.setCabLamp(position,direction,0);assert.equal(u.cabLampIntensity.value,0);
  assert.equal(road.version,version);assert.equal(road.customProgramCacheKey(),key);
  assert.equal(group.getObjectsByProperty('isLight',true).length,0);
  const cone=shader.fragmentShader.match(/getSpotAttenuation\(([\d.]+),([\d.]+),dot\(ray,cabLampDirection\)\)/);
  assert.ok(Math.abs(Number(cone[1])-Math.cos(.35))<1e-9&&Math.abs(Number(cone[2])-Math.cos(.35*.22))<1e-9);
  assert.ok(shader.fragmentShader.includes('getDistanceAttenuation(distanceToCab,5.4,0.)'));
  assert.ok(shader.fragmentShader.includes('RE_Direct(cab,geometryPosition,geometryNormal'));
  city.dispose();
  const vignette=createStreetIllumination(group,[],water);
  assert.ok(!compile(road).fragmentShader.includes('cabLampIntensity'));
  vignette.dispose();
});

test('the bayward passenger sees three matching Spear signal lenses in front of their hoods',async()=>{
  const {spearVehicleHeads}=await import('../app/spear-signals.ts');
  const {driverPose}=await import('../app/driver-rides.ts');
  const housing=createSignalHousings();
  const light=createStreetIllumination(new T.Group(),[],new T.MeshBasicMaterial());
  const shades=['#ff4938','#ffc444','#65d98e'].map(hex=>new T.Color(hex));
  assert.equal(spearVehicleHeads.length,3);
  for(const seconds of [293.8,294.5,315]){
    const {eye}=driverPose('bridge',293.8),origin=new T.Vector3(eye.x,eye.y,eye.z);
    light.update(seconds,1);
    for(const head of spearVehicleHeads){
      const active=signalAspects(seconds)[head.axis],center=signalLensCenter(head,active);
      const ray=new T.Raycaster(origin,center.clone().sub(origin).normalize(),0,4);
      const lens=ray.intersectObject(light.lenses)[0],shell=ray.intersectObject(housing)[0];
      assert.ok(lens&&shell&&lens.distance<shell.distance,'front lens is visible from the passenger seat');
      const shade=new T.Color().fromBufferAttribute(light.lenses.geometry.attributes.color,lens.face.a);
      nearSignalColor(shade,shades[active]);
    }
  }
  housing.geometry.dispose();light.dispose();
  function nearSignalColor(found,wanted){
    for(const channel of ['r','g','b'])assert.ok(Math.abs(found[channel]-wanted[channel])<.00001);
  }
});
