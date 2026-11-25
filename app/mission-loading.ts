// SFMTA's 2022 Central Embarcadero evaluation, pp. 15–16, documents the
// floating loading spaces and door aisle. This brief passenger call is staged,
// using the southern bay and its 2024 aerial pedestrian ladder (u6251–6276).
import {waterfrontCar,waterfrontLaneAt} from './waterfront-routes.ts';
import {streetVehicleTreadHeight} from './street-vehicles.ts';
export const loadingCarIndex=13;
const period=384,entry=84,parked=91,depart=113,joined=128;
const stopU=6170,stopV=567.25;
const mod=(t:number,n:number)=>((t%n)+n)%n;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
function smooth(t:number){const u=clamp(t);return u*u*(3-2*u);}
const world=(u:number,v:number)=>({x:-56+u/132,z:2-v/132});
const start=waterfrontCar(entry,loadingCarIndex),queue=waterfrontCar(joined,loadingCarIndex);
const startU=(start.x+56)*132,queueU=(queue.x+56)*132;
function laneV(u:number){return (2-waterfrontLaneAt(-56+u/132,true).z)*132;}
function parkingLine(u:number){return stopV+.073*(u-stopU);}
function routeV(u:number){
  const blend=smooth((u-5986)/178)*(1-smooth((u-6172)/121));
  // Keep both axles and the swinging nose clear of the rail-reserve gutter
  // during the merge, then settle into this car's normal inner-lane queue.
  const gutterAllowance=7*smooth((u-6200)/68)*(1-smooth((u-6380)/100));
  const lane=laneV(u)-gutterAllowance;
  return lane+(parkingLine(u)-lane)*blend;
}
// The time window admits a complete call. A car already rolling towards the
// bay finishes normally at closing. Seeking a city time/ride time is stateless.
export function loadingCallAllowed(time:number,localSeconds:number,frozen=false){
  const now=mod(localSeconds,86400);
  if(frozen)return now>=8*3600&&now<14*3600;
  const phase=mod(time,period),atEntry=mod(localSeconds-phase+entry,86400);
  return now>=8*3600&&now<14*3600&&atEntry>=8*3600&&atEntry<=14*3600-(joined-entry);
}
export function loadingVehicle(time:number){
  const t=mod(time,period);
  if(t<=entry||t>=joined)return waterfrontCar(time,loadingCarIndex);
  let u=stopU;
  if(t<parked){
    const f=(t-entry)/(parked-entry);
    // Hermite: match through traffic's .725 ground speed at entry, at rest at stop.
    u=startU+(stopU-startU)*smooth(f)+.725*132*(parked-entry)*f*(1-f)**2;
  }else if(t>depart)u=stopU+(queueU-stopU)*smooth((t-depart)/(joined-depart));
  const v=routeV(u);
  const bearing=waterfrontLaneAt(-56+u/132,true).heading;
  const curvature=smooth((u-5940)/38)*(1-smooth((u-6305)/38));
  const heading=bearing+curvature*(Math.atan((routeV(u+1)-routeV(u-1))/2)-bearing);
  return {...world(u,v),heading,y:.031-streetVehicleTreadHeight,grade:0,active:true};
}
export const loadingWait={...world(6264,502),y:.031};
// The shopper waits off the cycle track. They use the marked ladder, turn
// within the access aisle and approach the rear passenger door from the bay side.
// Alternate boarding and alighting so nobody reappears on the walk at a loop seam.
const path=[[6264,502],[6264,548],[6259,552.2],[6171,546.3],[6155.4,548.2],[6153.3,556.6],[6158.8,557.6],[6161.6,564.2]];
const lengths=path.slice(1).map(([u,v],i)=>Math.hypot(u-path[i][0],v-path[i][1]));
const total=lengths.reduce((a,b)=>a+b,0);
function footGrade(u:number,v:number){
  if(u<6262||v<513.59||v>522.57)return .031;
  if(v<516.25)return .04505-(v-513.6)*.001685;
  if(v<517.69)return .04064;
  if(v<518)return .04064-(v-517.69)*.0299;
  return .03146+(v-517.65)*.00011;
}
export function loadingPassenger(time:number){
  const phase=mod(time,period),pickup=mod(time,2*period)<period;
  const f=clamp((phase-92)/18);
  const boarding=pickup?f:1-f;
  let s=total*boarding,segment=0;
  while(segment<lengths.length-1&&s>lengths[segment])s-=lengths[segment++];
  const [a,b]=path[segment],[c,d]=path[segment+1],q=s/lengths[segment];
  const u=a+(c-a)*q,v=b+(d-b)*q;
  const turn=pickup?1:-1;
  // Ease the head beneath the roof as the person passes through the doorway.
  // The last portion is behind the opaque passenger-side panel.
  const duck=segment===lengths.length-1?smooth((q-.50)/.50):0;
  return {...world(u,v),y:footGrade(u,v),crouch:.043*duck,heading:Math.atan2((b-d)*turn,(c-a)*turn),
    standing:f===0||f===1,aboard:boarding===1};
}

export function loadingDoor(time:number){
  const t=mod(time,period),pickup=mod(time,2*period)<period;
  const a=pickup?105:91,b=pickup?110.4:95;
  return smooth((t-a)/.8)*(1-smooth((t-b)/1.05));
}
