import {CatmullRomCurve3,MathUtils,Vector3} from 'three';
import {fremontExitDistance,westboundExitPose} from './approach-road.ts';
import {northWaterfrontGrade,streetPose} from './streets.ts';
import {crossStreetGreenStart,crossStreetGreenEnd,roadStopLines,signalPeriod,spearStopLine} from './waterfront-signals.ts';

// SF Public Works active centerlines (3psu-pn9h), with lane offsets.
// Howard is two-way east of Fremont. The eastbound left lane crosses the
// median at Howard to join the northbound Embarcadero carriageway.
const landing=westboundExitPose(fremontExitDistance);
const roads=[[landing.x,landing.z],
  [landing.x+.25*Math.cos(landing.heading),landing.z-.25*Math.sin(landing.heading)],
  [-33.95,-31.11],[-29.40,-31.79],[-29.10,-31.79],[-28.97,-31.70],[-28.90,-31.52],
  [-27.91,-25.54],[-26.93,-19.12],[-25.78,-10.90],[-24.96,-6.19],
  [-24.38,-2.95],[-24.21,-1.84],[-24.13,-1.43],[-24.02,-1.14],[-23.82,-1.02]];
const waterfrontEndX=82.53; // Stop on the approach to Chestnut, with continuous road ahead.
function northLane(x:number){
  const road=streetPose(x,1);
  return [x+.185*Math.sin(road.heading),road.z+.185*Math.cos(road.heading)];
}
for(let x=-23.58;x<waterfrontEndX+4;x+=.25)roads.push(northLane(x));
const route=new CatmullRomCurve3(roads.map(([x,z])=>new Vector3(x,0,z)));
route.arcLengthDivisions=Math.ceil(roads.length*8);
const length=route.getLength();
function atLine(x:number,z=0,nx=1,nz=0){
  let lo=0,hi=1;
  for(let i=0;i<26;i++){
    const mid=(lo+hi)/2,p=route.getPointAt(mid);
    if((p.x-x)*nx+(p.z-z)*nz<0)lo=mid;else hi=mid;
  }
  return (lo+hi)/2*length;
}
export function cityDrivePoint(s:number){
  const p=route.getPointAt(MathUtils.clamp(s/length,0,1));
  return {x:p.x,y:northWaterfrontGrade(p.x),z:p.z};
}

// A speed pair defines a constant-acceleration segment over a known distance.
// Separate corner speeds keep the sedan settled on the tight city turns.
export function bridgeJourney(bridgeStart:number,bridgeSpeed:number){
  const base=bridgeStart+fremontExitDistance,legs:{time:number;end:number;s:number;v:number;a:number}[]=[];
  let s=0,t=0,v=bridgeSpeed;
  function travel(end:number,next:number){
    const dt=2*(end-s)/(v+next);
    legs.push({time:t,end:t+dt,s,v,a:(next-v)/dt});s=end;t+=dt;v=next;
  }
  function hold(dt:number){legs.push({time:t,end:t+dt,s,v:0,a:0});t+=dt;}
  travel(bridgeStart+32,bridgeSpeed);
  travel(bridgeStart+42,.66);
  travel(base-3,.56);travel(base,.27);
  travel(base+.8,.40);travel(base+4.5,.44);travel(base+5.45,.26);travel(base+6.55,.26);
  travel(base+8.1,.55);
  // The passenger sees the Howard approach change from red to green at Spear.
  // Locate the bumper behind the photographed stop bar at rest. The ride and
  // the signal lenses share rideSeconds, including while the ride is paused.
  const spear=base+atLine(spearStopLine.x,spearStopLine.z,spearStopLine.nx,spearStopLine.nz)-.20;
  travel(spear-1.08,.55);
  const spearArrival=(t+1.08/.55)%signalPeriod;
  const lastEntry=crossStreetGreenEnd-4;
  if(spearArrival<crossStreetGreenStart||spearArrival>=lastEntry){
    travel(spear,0);
    const phase=t%signalPeriod;
    const alreadyGreen=phase>=crossStreetGreenStart&&phase<lastEntry;
    hold(.85+(alreadyGreen?0:(signalPeriod+crossStreetGreenStart-phase)%signalPeriod));
    travel(spear+1.7,.55);
  }else travel(spear,.55);
  const turn=base+atLine(-23.95);
  travel(turn-1.4,.55);travel(turn-.35,.26);travel(turn+.5,.26);travel(turn+2,.60);
  for(const line of [roadStopLines.north.mission,roadStopLines.north.market,roadStopLines.north.washington]){
    const stop=base+atLine(line-.19);
    travel(stop-1.8,.60);
    const arrivalPhase=(t+1.8/.60)%signalPeriod;
    if(arrivalPhase>27||arrivalPhase<1){
      travel(stop,0);
      hold((signalPeriod+1.5-t%signalPeriod)%signalPeriod);
      travel(stop+1.8,.60);
    }else travel(stop,.60);
  }
  const finish=base+atLine(waterfrontEndX);
  travel(finish-2,.60);travel(finish,0);hold(3);
  return {duration:t,station(seconds:number){
    const leg=legs.find(l=>seconds<l.end);
    if(!leg)return bridgeStart-finish;
    const dt=seconds-leg.time;
    return bridgeStart-(leg.s+leg.v*dt+.5*leg.a*dt*dt);
  }};
}
