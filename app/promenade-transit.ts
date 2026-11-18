import * as THREE from 'three';
import {batchTraffic} from './traffic-batches.ts';
import {StreetAssembly,createStreetAmenities,streetPassenger} from './street-amenities.ts';
import routes from '../public/data/promenade-transit.json' with {type:'json'};

const scale=.06,steel='#848e8a',glass='#719099',red='#a84f48',cream='#c6c7bb';
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
const travel=(t:number)=>pace*(t<brake?t*t/(2*brake):t-brake*.5);
export function busPose(time:number){
  const t=((time%period)+period)%period;
  if(t<=layover)return {...outbound.pose(0),t,stopped:true};
  return {...(t<layover+outboundTime?outbound.pose(travel(t-layover)):inbound.pose(inbound.length-travel(period-t))),t,stopped:false};
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
  a.box(0,2.71,0,.34,.71,.058,'#e6d9bd');a.box(0,2.97,.033,.34,.19,.012,red);
  a.label('Muni',0,2.93,.044,.089,'#f1ddc2');
  if(route2)a.label('2',0,2.57,.037,.17,'#4a5660');
  a.box(0,1.38,0,.23,.36,.066,'#bcbbaa');root.add(a.bake('Muni stop flag'));
  if(covered){const canopy=shelter();canopy.position.set(-2.45,0,-.62);root.add(canopy);}
  return root;
}
function coach(){
  const a=new StreetAssembly(),ink='#45565a',redBand='#ad504b';
  a.box(0,.45,0,11.98,.31,2.49,'#838c88');a.box(0,2.85,0,12.12,.29,2.51,cream);
  a.box(-.92,3.18,0,6.24,.44,1.89,'#a3aba4');
  for(let i=0;i<10;i++)a.box(-3.68+i*.52,3.414,0,.11,.031,1.67,'#7f8b88');
  for(const side of [-1,1]){
    // Front and rear door openings interrupt the curbside wall all the way to the step.
    const sections=side<0?[[-6,6]]:[[-6,-2.55],[-1.31,4.00],[5.18,6.00]];
    for(const [lo,hi] of sections){
      const mid=(lo+hi)/2,w=hi-lo,z=side*1.245;
      a.box(mid,.84,z,w,.67,.071,cream);a.box(mid,1.16,z+side*.010,w,.17,.075,redBand);
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
    a.box(x,.97,0,.099,.93,2.50,cream);a.box(x,1.99,0,.095,1.23,2.49,ink);
    for(const s of [-1,1])a.box(x+Math.sign(x)*.057,2.00,s*.59,.019,1.08,1.08,glass);
    a.box(x,.54,0,.145,.16,2.5,'#717772');
    for(const s of [-1,1])a.box(x+Math.sign(x)*.068,.96,s*.95,.021,.15,.27,x>0?'#e8d7ab':'#af5a4a');
  }
  a.box(6.07,2.70,0,.055,.40,2.19,ink);
  a.label('2  SUTTER',6.104,2.60,0,.179,'#e3b367',Math.PI/2);
  a.box(6.14,.81,0,.13,.14,1.57,'#929b93');
  a.box(-3.22,1.42,-1.302,1.01,.18,.015,redBand);a.label('Muni',-3.22,1.35,-1.32,.13,'#f2e2cd',Math.PI);
  const door=new StreetAssembly();door.box(0,1.58,0,.578,2.16,.061,ink);
  for(const h of [1.12,2.10])door.box(0,h,.04,.42,.82,.018,glass);
  const leaf=door.bake('Coach folding door leaf');
  return {body:a.bake('Forty-foot silver and red Muni coach'),leaf};
}

export function createPromenadeTransit(material?:THREE.MeshStandardMaterial){
  const poses=new THREE.Group();
  const conveniences=createStreetAmenities();poses.add(conveniences.root);
  // Surveyed curb points. The F-line islands have a separate builder in market-street.ts.
  // The red-roofed shelter at the Market end is visible at the curb in the 2024 city aerial.
  const market=stop('Steuart and Market sheltered terminal',-3.0284,-8.8519,Math.PI+steuartYaw,true,false);
  market.children[1].position.set(.98,0,-1.30);
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
  const terminal=outbound.pose(0),forward=new THREE.Vector2(Math.cos(terminal.yaw),-Math.sin(terminal.yaw)),right=new THREE.Vector2(-forward.y,forward.x);
  function passenger(actor:typeof board,along:number,across:number,t:number,walking:boolean,heading:number){
    const x=terminal.x+scale*(along*forward.x+across*right.x),z=terminal.z+scale*(along*forward.y+across*right.y);
    // Low-floor threshold leads down to the surveyed sidewalk.
    actor.root.position.set(x,.045+(.031+.50*scale-.045)*clamp((1.83-across)/.58),z);
    actor.root.rotation.y=terminal.yaw+heading;actor.stride(t,walking);
  }
  const {batch,sync}=batchTraffic(poses,material??model.body.material.clone(),'Batched Muni vehicles, passengers and street furniture');
  const root=new THREE.Group();root.name='Waterfront public transport and conveniences';root.add(batch);
  function update(elapsed:number){
    conveniences.update(elapsed);alight.root.visible=false;board.root.visible=false;
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
        passenger(board,4.59+(1-approach)*11.5,2.90-cross*2.10,t,t<14||t>=17.5,t<14?-Math.PI/2:Math.PI);
      }
    }
    sync();
  }
  update(0);return {root,poses,batch,update};
}
