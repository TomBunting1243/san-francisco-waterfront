// JackPav's bayward Howard sequence (KartaView 11605/1542) shows a small
// group at the crossing. The paths use the same 200 px/unit registered 2024
// city orthophoto as the paint. The three individuals and timings are modeled.
import {signalPeriod} from './waterfront-signals.ts';

type Curb=[number,number,number,number,number];
type Lane={across:boolean;offset:number;start:number;end:number;leave:number;arrive:number;near:Curb;far:Curb};
const lanes:Lane[]=[
  {across:true,offset:171,start:168,end:434,leave:2.2,arrive:19.3,
    near:[197.1,201.2,203.35,203.82,210.7],far:[415.9,412.0,409.78,409.32,402.5]},
  {across:true,offset:448,start:151,end:452,leave:10.3,arrive:28.8,
    near:[194.9,199.0,201.27,201.75,208.7],far:[431.0,421.6,421.5,402.0,392.3]},
  {across:false,offset:188,start:152,end:468,leave:38.7,arrive:56.5,
    near:[193.9,199.4,202.52,203.14,211.5],far:[430.5,423.8,420.31,419.68,409.9]},
];
export const spearWalkerCount=lanes.length;

// Sidewalk, back of curb, curb lip, gutter toe and outer gutter edge, sampled
// along each lane against the rendered SFMTA curb profile. The opposite edge
// has the same section in reverse station order.
function ground(station:number,edge:Curb){
  const [walk,cap,lip,toe,gutter]=edge,direction=Math.sign(gutter-walk);
  if((station-walk)*direction<=0)return .045;
  if((station-cap)*direction<0)return .045+(.04064-.045)*(station-walk)/(cap-walk);
  if((station-lip)*direction<0)return .04064;
  if((station-toe)*direction<0)return .04064+(.0315-.04064)*(station-lip)/(toe-lip);
  if((station-gutter)*direction<0)return .0315+.0005*(station-toe)/(gutter-toe);
  return .031;
}

export function spearWalkerPose(time:number,index:number){
  const lane=lanes[index],cycle=Math.floor(time/signalPeriod),phase=time-cycle*signalPeriod;
  const forward=(cycle+(lane.across?index:1))%2===0,duration=lane.arrive-lane.leave;
  const t=Math.max(0,Math.min(duration,phase-lane.leave)),ease=.65;
  let distance=t-ease/2;
  if(t<ease)distance=t*t/(2*ease);
  else if(t>duration-ease)distance=duration-ease-(duration-t)**2/(2*ease);
  const progress=distance/(duration-ease);
  const station=lane.start+(lane.end-lane.start)*(forward?progress:1-progress);
  const u=((lane.across?station:lane.offset)-300)/200,v=((lane.across?lane.offset:station)-300)/200;
  const x=-25.894+.988686*u+.150004*v,z=-12.650-.150004*u+.988686*v;
  const turn=Math.max(0,Math.min(1,(phase-lane.arrive-1.2)/2.4));
  const heading=Math.atan2(lane.across?-.150004:.988686,lane.across?.988686:.150004)
    +(forward?0:Math.PI)+Math.PI*turn;
  return {x,z,y:ground(station,station<300?lane.near:lane.far),heading,standing:t===0||t===duration};
}
