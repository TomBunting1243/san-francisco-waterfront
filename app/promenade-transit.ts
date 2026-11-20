import {streetcarPose} from './streets.ts';
import {createWashingtonPlatforms,type WashingtonTramPose} from './washington-platform.ts';
import {createFerryPassenger} from './ferry-stop-passenger.ts';
import {ambientStreetcarCall} from './washington-call.ts';
import * as THREE from 'three';
import {museumReader} from './museum-gallery.ts';
import {taylorDiners} from './taylors-refresher.ts';
import {terreneDiners} from './terrene-diners.ts';
import {frostPlazaPhoto} from './frost-plaza.ts';
import {frostPlazaSurface} from './california-sidewalk.ts';
import {createCaliforniaCar} from './california-terminal.ts';
import {batchTraffic} from './traffic-batches.ts';
import {StreetAssembly,createStreetAmenities,streetPassenger} from './street-amenities.ts';
import routes from '../public/data/promenade-transit.json' with {type:'json'};

const scale=.06,steel='#848e8a',glass='#719099',red='#a84f48';
const clamp=(v:number)=>Math.min(1,Math.max(0,v));
const steuartYaw=.146;
type Point=number[];
function route(points:Point[]){
  // Trim the sampled centre-line corners to arcs. Never smooth through the boarding position.
  const samples=[points[0]];
  for(let i=1;i+1<points.length;i++){
    const a=points[i-1],b=points[i],c=points[i+1],ab=Math.hypot(a[0]-b[0],a[1]-b[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]);
    if(!ab||!bc)continue;
    const reach=Math.min(.28,ab*.36,bc*.36);
    const p=[b[0]+(a[0]-b[0])*reach/ab,b[1]+(a[1]-b[1])*reach/ab];
    const q=[b[0]+(c[0]-b[0])*reach/bc,b[1]+(c[1]-b[1])*reach/bc];
    for(let k=0;k<=4;k++){const t=k/4,u=1-t;samples.push([u*u*p[0]+2*u*t*b[0]+t*t*q[0],u*u*p[1]+2*u*t*b[1]+t*t*q[1]]);}
  }
  samples.push(points[points.length-1]);
  const ends=[0];
  for(let i=1;i<samples.length;i++)ends.push(ends[i-1]+Math.hypot(samples[i][0]-samples[i-1][0],samples[i][1]-samples[i-1][1]));
  const length=ends[ends.length-1];
  function pose(distance:number){
    const d=Math.max(0,Math.min(length,distance));let low=1,high=ends.length-1;
    while(low<high){const m=(low+high)>>1;if(ends[m]<d)low=m+1;else high=m;}
    const a=samples[low-1],b=samples[low],u=(d-ends[low-1])/(ends[low]-ends[low-1]||1);
    return {x:a[0]+u*(b[0]-a[0]),z:a[1]+u*(b[1]-a[1]),yaw:Math.atan2(a[1]-b[1],b[0]-a[0])};
  }
  return {length,pose};
}
const inbound=route(routes.inbound),outbound=route(routes.outbound);
const pace=.60,brake=3,layover=31;
const outboundTime=outbound.length/pace+brake*.5,inboundTime=inbound.length/pace+brake*.5;
const period=layover+outboundTime+inboundTime;
const kerbOffset=.81, longitudinalOffset=-.58, thresholdHeight=.365; // metres
const stopHeading=outbound.pose(0).yaw;
const travel=(t:number)=>pace*(t<brake?t*t/(2*brake):t-brake*.5);
export function busPose(time:number){
  const t=((time%period)+period)%period;
  const leaving=t<layover+outboundTime;
  const distance=t<=layover?0:travel(leaving?t-layover:period-t);
  const pose=t<=layover?outbound.pose(0):leaving?outbound.pose(distance):inbound.pose(inbound.length-distance);
  // GTFS marks the lane axis. Ease the last 22 metres onto the stopping line
  // measured against the Steuart curb. Keep the coach aligned during dwell.
  const u=clamp(1-distance/(22*scale)),blend=u*u*(3-2*u)*scale;
  const c=Math.cos(stopHeading),s=Math.sin(stopHeading);
  return {x:pose.x+blend*(longitudinalOffset*c+kerbOffset*s),
    z:pose.z+blend*(kerbOffset*c-longitudinalOffset*s),yaw:pose.yaw,t,stopped:t<=layover};
}

function shelter(){
  const a=new StreetAssembly();
  for(const x of [-1.88,1.88]){
    a.box(x,1.31,-.52,.084,2.62,.084,steel);
    a.box(x,1.23,-.04,.03,1.95,.89,'#9caeac');
    a.box(x,2.57,-.04,.065,.075,1.41,steel);
  }
  // Retain open views through the glazing between the panel rails.
  for(const x of [-1.22,0,1.22]){
    a.box(x,1.32,-.53,.035,2.43,.043,steel);
    a.box(x-.43,1.12,-.53,.73,.17,.019,'#9baba6');
  }
  a.box(0,.54,-.31,2.75,.095,.45,'#a4a696');
  for(const x of [-1,1])a.box(x,.25,-.31,.09,.50,.21,steel);
  a.box(1.60,1.61,-.55,.49,.82,.085,'#64746f');
  a.box(1.60,1.64,-.493,.42,.65,.022,'#c8c6aa');
  for(let i=0;i<14;i++){
    const x=-2.23+i*.318, h=(s:number)=>2.72+.11*Math.sin(s*1.40);
    const dh=h(x+.318)-h(x);
    a.box(x+.159,(h(x+.318)+h(x))/2,0,Math.hypot(.318,dh)+.013,.085,1.56,red).rotation.z=Math.atan2(dh,.318);
  }
  return a.bake('Muni shelter with wave roof, bench and information case');
}
function stop(name:string,x:number,z:number,yaw:number,covered:boolean,route2:boolean){
  const root=new THREE.Group();root.name=name;root.position.set(x,.045,z);root.rotation.y=yaw;root.scale.setScalar(scale);
  const a=new StreetAssembly();
  a.add(new THREE.CylinderGeometry(.044,.049,3.19,8),'#86928e',0,1.595,0);
  a.box(0,2.71,0,.34,.71,.058,'#e6d9bd');a.box(0,2.97,.035,.34,.19,.012,red);
  a.label('Muni',0,2.93,.044,.089,'#f1ddc2');
  if(route2)a.label('2',0,2.57,.037,.17,'#4a5660');
  a.box(0,1.38,0,.23,.36,.066,'#bcbbaa');root.add(a.bake('Muni stop flag'));
  if(covered){const canopy=shelter();canopy.position.set(-2.45,0,-.62);root.add(canopy);}
  return root;
}
// Local metres on the raised pad of the Steuart/Market shelter. The same
// rider checks its timetable and returns to the bench while waiting.
function shelterRider(){
  const {root}=streetPassenger('#987958','#ba947a');
  root.name='Market terminal timetable reader';
  const [torso,oldLeft,oldRight]=root.children;
  root.remove(oldLeft,oldRight);
  (oldLeft as THREE.Mesh).geometry.dispose();
  const upperLength=.405,lowerLength=.382;
  const legs=[-1,1].map(side=>{
    const thigh=new StreetAssembly(),shin=new StreetAssembly(),shoe=new StreetAssembly();
    thigh.box(0,-upperLength/2,0,.13,upperLength,.15,'#525d65');
    shin.box(0,-lowerLength/2,0,.113,lowerLength,.135,'#56636a');
    shoe.box(0,-.038,.045,.14,.076,.24,'#514d49');
    const hip=thigh.bake('Timetable reader thigh'),knee=shin.bake('Timetable reader shin'),foot=shoe.bake('Timetable reader shoe');
    hip.position.x=side*.087;knee.position.y=-upperLength;foot.position.y=-lowerLength;
    root.add(hip);hip.add(knee);knee.add(foot);
    return {side,hip,knee,foot};
  });
  // East end of the bench to the case, around the seat's front edge. Both
  // ends lie between the shelter's side screens; the path stays on the pad.
  const path=route([[-.52,.23],[-.52,.75],[-.28,.89],[1.28,.89],[1.58,.72],[1.58,.23]]);
  const ease=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
  function update(elapsed:number){
    const t=THREE.MathUtils.euclideanModulo(elapsed,62);
    // 0–4 approach the timetable, 4–12 study it, 12–16 walk back.
    // At the bench the rider turns, backs onto the seat, and plants both feet.
    const go=t<4,back=t>=12&&t<16,walking=go||back;
    const u=go?ease(t/4):t<12?1:back?1-ease((t-12)/4):0;
    const p=path.pose(u*path.length);
    let yaw=p.yaw+(back? -Math.PI/2:Math.PI/2);
    const turn=(from:number,to:number,w:number)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*w;
    if(t>=4&&t<12)yaw=turn(Math.PI,0,ease((t-10.9)/1.1));
    if(t>=16)yaw=turn(Math.PI,0,ease((t-16)/1.1));
    const seated=t<17.1?0:t<18.75?ease((t-17.1)/1.65):t<59.9?1:1-ease((t-59.9)/1.65);
    const gait=walking?Math.sin(Math.PI*(go?t:t-12)/4):0;
    root.position.set(p.x,0,p.z-.47*seated);root.rotation.y=yaw;
    const hips=.817-.192*seated,bob=.013*gait*Math.sin(5.6*t)**2;
    torso.position.y=hips-.817+bob;
    for(const {side,hip,knee,foot} of legs){
      const step=side*Math.sin(5.6*t)*gait;
      const ankleHeight=.076+.085*Math.max(0,step)*gait;
      const forward=.47*seated+.23*step,down=hips+bob-ankleHeight;
      const reach=Math.min(upperLength+lowerLength-.00001,Math.hypot(forward,down));
      const bend=Math.acos(THREE.MathUtils.clamp((reach**2-upperLength**2-lowerLength**2)/(2*upperLength*lowerLength),-1,1));
      const thigh=Math.atan2(forward,down)+Math.atan2(lowerLength*Math.sin(bend),upperLength+lowerLength*Math.cos(bend));
      hip.position.y=hips+bob;hip.rotation.x=-thigh;knee.rotation.x=bend;foot.rotation.x=thigh-bend;
    }
  }
  return {root,update};
}
// Friends take a picture in front of the heart, then look at it together.
// All four feet stay on the brick side of the terminal bollards.
function plazaPhotograph(){
  const {pose,photographer}=frostPlazaPhoto;
  const subject=streetPassenger('#c48656','#825f51','pose'),friend=streetPassenger('#547977','#bb9172','phone');
  const pair=new THREE.Group();pair.name='Frost Plaza photo visitors';
  subject.root.name='Visitor posing in the heart';friend.root.name='Friend taking the picture';
  for(const actor of [subject,friend]){actor.root.scale.setScalar(scale);pair.add(actor.root);}
  friend.root.position.set(photographer.x,photographer.y,photographer.z);
  const dx=Math.sin(pose.yaw),dz=Math.cos(pose.yaw);
  const reviewX=photographer.x-.047*dz-.017*dx,reviewZ=photographer.z+.047*dx-.017*dz;
  const yawToward=(x:number,z:number,targetX:number,targetZ:number)=>Math.atan2(targetX-x,targetZ-z);
  const departure=yawToward(pose.x,pose.z,reviewX,reviewZ);
  const review=yawToward(reviewX,reviewZ,photographer.x-.016*dx,photographer.z-.016*dz);
  const bend=(from:number,to:number,k:number)=>from+k*Math.atan2(Math.sin(to-from),Math.cos(to-from));
  const ease=(t:number)=>THREE.MathUtils.smoothstep(t,0,1);
  function update(elapsed:number){
    const t=THREE.MathUtils.euclideanModulo(elapsed,32);
    const outward=ease((t-7)/4.9),back=ease((t-20)/4.9),travel=outward-back;
    const x=THREE.MathUtils.lerp(pose.x,reviewX,travel),z=THREE.MathUtils.lerp(pose.z,reviewZ,travel);
    subject.root.position.set(x,frostPlazaSurface(x,z)??pose.y,z);
    let yaw=bend(pose.yaw,departure,ease((t-6.5)/.8));
    yaw=bend(yaw,review,ease((t-11.2)/1.1));
    yaw=bend(yaw,departure+Math.PI,ease((t-19)/1.3));
    subject.root.rotation.y=bend(yaw,pose.yaw,ease((t-24.4)/1.25));
    const walking=(t>7&&t<11.9)||(t>20&&t<24.9);
    subject.stride((t<12?outward:back)*4.49,walking);
    const posing=1-ease((t-5.8)/1.15)+ease((t-25.6)/1.15);
    subject.root.children[0].rotation.z=-.064*posing;
    subject.root.children[0].position.x=.027*posing;
    subject.root.children[2].position.z=.078*posing;
    const share=ease((t-7)/2)-ease((t-23)/2);
    friend.root.rotation.y=bend(photographer.yaw,photographer.yaw+.47,share);
    friend.cameraArms!.rotation.x=-.38+.97*share;
  }
  return {pair,update};
}

function coach(){
  const a=new StreetAssembly(),ink='#45565a',redBand='#bc4843',silver='#babcba';
  a.box(0,thresholdHeight-.09,0,11.98,.18,2.52,'#687373');a.box(0,2.85,0,12.12,.29,2.55,silver);
  a.box(-.92,3.18,0,6.24,.44,1.89,'#a3aba4');
  for(let i=0;i<10;i++)a.box(-3.68+i*.52,3.414,0,.11,.031,1.67,'#7f8b88');
  for(const side of [-1,1]){
    // Front and rear door openings interrupt the curbside wall all the way to the step.
    const sections=side<0?[[-6,6]]:[[-6,-2.55],[-1.31,4.00],[5.18,6.00]];
    for(const [lo,hi] of sections){
      const mid=(lo+hi)/2,w=hi-lo,z=side*1.245;
      a.box(mid,.81,z,w,.87,.071,silver);a.box(mid,.49,z+side*.015,w-.032,.24,.076,redBand);
      a.box(mid,2.82,z+side*.025,w,.16,.071,redBand);
      a.box(mid,2.00,z,w,1.52,.083,ink);
      const n=Math.max(1,Math.round(w/1.23));
      for(let k=0;k<n;k++)a.box(lo+(k+.5)*w/n,2.04,z+side*.05,w/n-.078,1.27,.027,glass);
    }
    for(const x of [-3.59,3.69]){
      const wheel=a.add(new THREE.CylinderGeometry(.495,.495,.19,16),'#444c4a',x,.495,side*1.24);wheel.rotation.x=Math.PI/2;
      const hub=a.add(new THREE.CylinderGeometry(.275,.275,.035,12),'#a0a59c',x,.495,side*1.345);hub.rotation.x=Math.PI/2;
    }
  }
  for(const x of [-6.01,6.01]){
    a.box(x,.95,0,.099,.97,2.50,silver);a.box(x,1.99,0,.095,1.23,2.49,ink);
    for(const s of [-1,1])a.box(x+Math.sign(x)*.057,2.00,s*.59,.019,1.08,1.08,glass);
    a.box(x,.54,0,.145,.16,2.54,'#717772');
    for(const s of [-1,1])a.box(x+Math.sign(x)*.068,.96,s*.95,.021,.15,.27,x>0?'#e8d7ab':'#af5a4a');
  }
  a.box(6.07,2.70,0,.055,.40,2.19,ink);
  a.label('2  SUTTER',6.104,2.59,0,.228,'#e3b367',Math.PI/2);
  // Folded front bicycle rack, paired mirror arms and upper clearance lamps.
  for(const y of [.70,.97])a.box(6.14,y,0,.075,.05,1.65,ink);
  for(const z of [-.74,-.24,.24,.74])a.box(6.14,.835,z,.075,.27,.036,ink);
  for(const side of [-1,1]){
    a.box(5.81,2.49,side*1.395,.064,.065,.27,ink);
    a.box(5.81,2.33,side*1.53,.095,.35,.14,ink);
    a.box(5.75,2.33,side*1.53,.018,.27,.11,glass);
    a.box(6.075,2.89,side*1.01,.026,.047,.115,'#dda652');
    // Rear powertrain access panel and louvers behind the last side window.
    a.box(-5.51,2.05,side*1.32,.85,1.26,.024,silver);
    for(let i=0;i<6;i++)a.box(-5.51,1.58+i*.17,side*1.339,.69,.055,.018,ink);
    a.label('Muni',.0,.81,side*1.296,.22,redBand,side>0?0:Math.PI);
  }
  a.box(2.93,2.42,1.319,1.70,.36,.032,ink);
  a.label('2 SUTTER',2.93,2.32,1.34,.15,'#dfae61');
  // Flush, stowed front ramp at the low-floor entry. Its nosing remains
  // inside the door sweep while the coach is underway.
  a.box(4.59,thresholdHeight+.006,.78,1.09,.012,.89,'#858c87');
  a.box(4.59,thresholdHeight+.015,1.20,1.09,.008,.052,'#d1ad54');
  const door=new StreetAssembly();door.box(0,1.52,0,.578,2.29,.061,ink);
  for(const h of [1.12,2.10])door.box(0,h,.04,.42,.82,.018,glass);
  const leaf=door.bake('Coach folding door leaf');
  return {body:a.bake('Forty-foot silver and red Muni coach'),leaf};
}

export function createPromenadeTransit(material?:THREE.MeshStandardMaterial){
  const poses=new THREE.Group();
  const california=createCaliforniaCar();poses.add(california.car);
  const washington=createWashingtonPlatforms();poses.add(washington.root);
  const ferryPassenger=createFerryPassenger();poses.add(ferryPassenger.rider);
  const photograph=plazaPhotograph();poses.add(photograph.pair);
  const museum=museumReader();poses.add(museum.frame);
  const diners=terreneDiners();poses.add(diners.root);
  const picnic=taylorDiners();poses.add(picnic.root);
  const conveniences=createStreetAmenities();poses.add(conveniences.root);
  // Curbside bus stops at the Steuart terminal. The F platforms occupy the waterfront median.
  // The red-roofed shelter at the Market end is visible at the curb in the 2024 city aerial.
  const market=stop('Steuart and Market sheltered terminal',-3.0284,-8.8519,Math.PI+steuartYaw,true,false);
  market.children[1].position.set(.98,0,-1.30);
  const reader=shelterRider();
  const readerAnchor=new THREE.Group();readerAnchor.position.copy(market.children[1].position);
  readerAnchor.add(reader.root);market.add(readerAnchor);
  const pad=new StreetAssembly();pad.box(.98,-.115,-1.2,5.9,.23,2.08,'#b8b5a2');
  market.add(pad.bake('Terminal sidewalk beneath the surveyed shelter'));poses.add(market);
  poses.add(stop('Steuart and Mission sheltered terminal',-12.2754,-8.6167,steuartYaw,true,false));
  poses.add(stop('2 Sutter terminal at Steuart and Don Chee',-8.9851,-7.942,Math.PI+steuartYaw,false,true));
  const model=coach(),coaches=Array.from({length:8},(_,i)=>{
    const group=new THREE.Group();group.name='2 Sutter coach '+(i+1);group.scale.setScalar(scale);
    group.add(model.body.clone());
    const leaves=[];
    for(const x of [-1.93,4.59])for(const side of [-1,1]){
      const pivot=new THREE.Group();pivot.position.set(x+side*.567,0,1.242);
      const leaf=model.leaf.clone();leaf.position.x=-side*.285;pivot.add(leaf);group.add(pivot);leaves.push({pivot,side});
    }
    poses.add(group);return {group,leaves};
  });
  const alight=streetPassenger('#90778a','#bb9277'),board=streetPassenger('#58867d','#c69c80');
  poses.add(alight.root,board.root);alight.root.name='Alighting passenger';board.root.name='Boarding passenger';
  board.root.scale.setScalar(scale);alight.root.scale.setScalar(scale);
  const terminal=busPose(0),forward=new THREE.Vector2(Math.cos(terminal.yaw),-Math.sin(terminal.yaw)),right=new THREE.Vector2(-forward.y,forward.x);
  function passenger(actor:typeof board,along:number,across:number,t:number,walking:boolean,heading:number){
    const x=terminal.x+scale*(along*forward.x+across*right.x),z=terminal.z+scale*(along*forward.y+across*right.y);
    // Low-floor threshold leads down to the surveyed sidewalk.
    const kerb=.040644;
    const walk=THREE.MathUtils.lerp(kerb,.045,clamp((across-1.60)/.34));
    const sill=.031+scale*(thresholdHeight+(along>3?.012:0));
    actor.root.position.set(x,THREE.MathUtils.lerp(walk,sill,clamp((1.50-across)/.25)),z);
    actor.root.rotation.y=terminal.yaw+heading;actor.stride(t,walking);
  }
  const paint=material??model.body.material.clone();
  const {batch,sync}=batchTraffic(poses,paint,'Batched Muni vehicles, passengers and street furniture');
  // Geometry ranges follow the rigid-parts traversal. A single tag byte covers
  // the cable car lamps and the two riders receiving local illumination.
  const geometries=new Set<THREE.BufferGeometry>();
  poses.traverse(part=>{if(part instanceof THREE.Mesh)geometries.add(part.geometry);});
  const packed=[...geometries];
  const range=batch.getGeometryRangeAt(packed.indexOf(california.body.geometry))!;
  const mask=new Uint8Array(batch.geometry.attributes.position.count);
  for(const {start,count,kind} of california.body.lightRanges){
    mask.fill(kind,range.vertexStart+start,range.vertexStart+start+count);
  }
  for(const [rider,tag] of [[washington.rider,4],[ferryPassenger.rider,5]] as const)rider.traverse(part=>{
    if(!(part instanceof THREE.Mesh))return;
    const region=batch.getGeometryRangeAt(packed.indexOf(part.geometry))!;
    mask.fill(tag,region.vertexStart,region.vertexStart+region.vertexCount);
  });
  batch.geometry.setAttribute('cableLight',new THREE.BufferAttribute(mask,1));
  const dusk={value:0},headlamp={value:california.headlamp},riderLamp={value:washington.light},exitLamp={value:ferryPassenger.light};
  const previous=paint.onBeforeCompile,program=paint.customProgramCacheKey();
  paint.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    shader.uniforms.cableDusk=dusk;shader.uniforms.cableHeadlamp=headlamp;shader.uniforms.washingtonLamp=riderLamp;shader.uniforms.exitLamp=exitLamp;
    // A plaza vignette can inherit the source shader hook, but owns its clock.
    if(shader.vertexShader.includes('attribute float cableLight;'))return;
    shader.vertexShader='attribute float cableLight; varying float vCableLight;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\nvCableLight=cableLight;');
    shader.fragmentShader='uniform vec4 washingtonLamp,exitLamp; uniform float cableDusk,cableHeadlamp; varying float vCableLight;\n'+shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      if(vCableLight>3.5){
        vec4 source=vCableLight>4.5?exitLamp:washingtonLamp;
        vec3 delta=((viewMatrix*vec4(source.xyz,1.)).xyz+vViewPosition)/.06;
        float d2=max(dot(delta,delta),.0001);
        float incidence=max(dot(normal,delta*inversesqrt(d2)),0.);
        float received=(.40+(1.60*incidence+.24)/(.90+d2))*source.w*cableDusk;
        totalEmissiveRadiance+=diffuseColor.rgb*vec3(1.,.88,.73)*received;
      }else if(vCableLight>0.5){
        vec3 lamp=vCableLight<1.5?vec3(.36,.22,.11):
          (abs(vCableLight-cableHeadlamp)<.5?vec3(2.2,1.92,1.49):vec3(0.));
        totalEmissiveRadiance+=lamp*cableDusk;
      }`);
  };
  paint.customProgramCacheKey=()=>program.endsWith('|cal49')?program:program+'|cal49';
  function setNight(amount:number){dusk.value=THREE.MathUtils.clamp(amount,0,1);}
  const root=new THREE.Group();root.name='Waterfront public transport and conveniences';root.add(batch);
  function update(elapsed:number,localMinutes=720,sheltered=false,date?:string,washingtonSeconds?:number,tram?:WashingtonTramPose,ferrySeconds?:number){
    const fallback=tram&&washingtonSeconds!==undefined?undefined:ambientStreetcarCall(elapsed);
    const car=tram??streetcarPose(fallback!.station);
    washington.update(washingtonSeconds??fallback!.t,car);
    ferryPassenger.update(ferrySeconds??fallback?.passengerTime??-Infinity,elapsed,car);
    museum.update(elapsed,localMinutes,date);
    diners.update(elapsed,localMinutes,sheltered);
    picnic.update(elapsed,sheltered);
    california.update(elapsed,localMinutes);headlamp.value=california.headlamp;
    photograph.update(elapsed);reader.update(elapsed);conveniences.update(elapsed);alight.root.visible=false;board.root.visible=false;
    for(const [i,{group,leaves}] of coaches.entries()){
      const pose=busPose(elapsed+7+i*period/coaches.length),t=pose.t;
      // Only the waterfront segment has modeled transit and road grades. Vehicles outside it retain their route phase.
      group.visible=pose.z>-68;if(!group.visible)continue;
      group.position.set(pose.x,.031,pose.z);group.rotation.y=pose.yaw;
      const opening=pose.stopped?Math.min(clamp((t-1)/1.3),clamp((29-t)/1.3)):0;
      for(const {pivot,side} of leaves)pivot.rotation.y=-side*opening*1.46;
      if(!pose.stopped)continue;
      if(t>=2.5&&t<15){
        alight.root.visible=true;
        const cross=clamp((t-2.5)/2.5),along=clamp((t-5)/10);
        passenger(alight,-1.93-along*10,.80+cross*2.09,t,true,t<5?0:-Math.PI/2);
      }
      if(t>=2&&t<22){
        board.root.visible=true;
        const approach=clamp((t-2)/12),cross=clamp((t-17.5)/4.5);
        // Pass the exiting rider on the sidewalk side, then turn to the front door.
        const lane=clamp((approach-.55)/.45);
        passenger(board,4.59-(1-approach)*8.8,3.90-lane-2.10*cross,t,t<14||t>=17.5,t<14?Math.PI/2:Math.PI);
      }
    }
    sync();
  }
  update(0);return {root,poses,batch,update,setNight};
}
