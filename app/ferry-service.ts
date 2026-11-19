import {ferryCourses,type CoursePoint} from './ferry-course-data.ts';
import {pacificClock,routeDepartures,serviceDayCalls,shiftedServiceDate,type HarborCall} from './harbor-timetable.ts';
import {doradoBoardingFreeboard} from './dorado-ferry.ts';

type Course=keyof typeof ferryCourses;
export type ServiceBerth='E1'|'E2'|'F1'|'F2'|'G1'|'C'|'B';
export type FerryServiceClock={weekend:boolean;minutes:number;date?:string;tideOffset?:number};
export const defaultFerryClock:FerryServiceClock={weekend:false,minutes:7*60+15};
export const ferryClockAt=pacificClock;
export const vessels=[
  {name:'Pyxis',family:'pyxis',length:41,beam:12,sill:doradoBoardingFreeboard,door:.209,offset:6},
  {name:'Delphinus',family:'dorado',length:42,beam:10.5,sill:doradoBoardingFreeboard,door:.209,offset:142},
  {name:'Hydrus',family:'hydrus',length:41,beam:11.6,sill:doradoBoardingFreeboard,door:.209,offset:402},
  {name:'Dorado',family:'dorado',length:42,beam:10.5,sill:doradoBoardingFreeboard,door:.209,offset:250},
  {name:'Karl',family:'dorado',length:42,beam:10.5,sill:doradoBoardingFreeboard,door:.209,offset:317},
  {name:'Mendocino',family:'mendocino',length:43.00,beam:10.36,sill:.185,door:.209,offset:80},
  {name:'Marin',family:'spaulding',length:51.54,beam:10.44,sill:doradoBoardingFreeboard,door:.209,offset:190},
  {name:'Sammy J',family:'prop',length:16,beam:6,sill:.084,door:.095,offset:0},
] as const;
export const ferryFleet=vessels.map(v=>v.name);
const names:Record<Course,string>={vallejo:'Vallejo',richmond:'Richmond',richmondF:'Richmond',harborBay:'Harbor Bay',seaplane:'Alameda Seaplane Lagoon',oakland:'Oakland',mainStreet:'Main Street Alameda',larkspur:'Larkspur',sausalito:'Sausalito',angel:'Angel Island',tiburon:'Tiburon',treasure:'Treasure Island'};
const calls:readonly (readonly Course[])[]=[['vallejo'],['richmond'],['oakland','mainStreet'],['harborBay'],['seaplane'],['larkspur'],['sausalito','tiburon','angel'],['treasure']];
const homeBerth:Record<Course,ServiceBerth>={vallejo:'E1',richmond:'E2',richmondF:'F2',harborBay:'F2',seaplane:'F1',oakland:'G1',mainStreet:'G1',larkspur:'C',sausalito:'B',angel:'B',tiburon:'B',treasure:'B'};
const richmondTimes=[435,490,550,680,815,900,960,990,1045,1080,1135,1215];
const mod=(a:number,n:number)=>(a%n+n)%n;
function courseFor(index:number,visit:number,clock:FerryServiceClock):Course{
  const choices=calls[index],key=choices[mod(visit,choices.length)];
  if(key!=='richmond')return key;
  const first=richmondTimes.findIndex(t=>t>=clock.minutes);
  return clock.weekend||richmondTimes[mod(Math.max(0,first)+visit,richmondTimes.length)]===680?'richmondF':'richmond';
}
export const berthThresholds:Record<ServiceBerth,CoursePoint>={
  E1:[-7.819,7.080],E2:[-8.600,7.077],F1:[-10.811,7.135],F2:[-11.581,7.131],
  G1:[-13.831,7.137],C:[.061,5.436],B:[5.843,6.462],
};
const heading=(dx:number,dz:number)=>Math.atan2(-dz,dx);
const smooth=(t:number)=>t*t*(3-2*t);
function turn(a:number,b:number,t:number){return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*smooth(t);}
export const ferryCycle=480;
function berthPosition(index:number,berth:ServiceBerth){
  const v=vessels[index],small=v.family==='prop';
  const [stopX,stopZ]=small?[6.617,6.456]:berthThresholds[berth];
  const side=(!small&&berth==='B')||berth.endsWith('2')?-1:1;
  return {stopX,stopZ,x:stopX+side*(v.beam*.03+.155),z:stopZ+v.door};
}
type Path={points:CoursePoint[];dist:number[];length:number;duration:number};
// Distance progresses at waterfront scale near the terminal. Long distances
// beyond the breakwater use progressively compressed travel time.
const compressed=(d:number)=>42*Math.log1p(d/49);
function prepare(points:CoursePoint[]):Path{
  const dist=[0];
  for(let i=1;i<points.length;i++)dist.push(dist[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  const length=dist[dist.length-1];
  return {points,dist,length,duration:compressed(length)+7};
}
const cache=new Map<string,Path>();
function track(index:number,course:Course,berth:ServiceBerth,inbound:boolean){
  const key=index+'/'+course+'/'+berth+'/'+inbound,existing=cache.get(key);
  if(existing)return existing;
  const {x,z}=berthPosition(index,berth),source:readonly CoursePoint[]=ferryCourses[course][inbound?'back':'out'];
  const points:CoursePoint[]=[[x,z+7.5],[x,z+9.75],...source];
  // The GTFS stops are passenger reference points. Each approach follows its
  // numbered landing's fairway first and both directions meet one far endpoint.
  points[points.length-1]=ferryCourses[course].out.at(-1)!;
  const line=prepare(points);cache.set(key,line);return line;
}
function onPath(path:Path,d:number):CoursePoint{
  const s=Math.max(0,Math.min(path.length,d));
  let lo=0,hi=path.dist.length-1;
  while(lo+1<hi){const m=(lo+hi)>>1;if(path.dist[m]<=s)lo=m;else hi=m;}
  const a=path.points[lo],b=path.points[hi],t=(s-path.dist[lo])/(path.dist[hi]-path.dist[lo]||1);
  return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
}
function cruise(path:Path,time:number,inbound:boolean){
  const t=Math.max(0,Math.min(path.duration,time)),end=path.duration;
  // A short easing interval on either end keeps turns stationary at the far
  // landing and avoids an instantaneous launch out of the home turning basin.
  const s=t<7?t*t/14:t>end-7?end-7-(end-t)*(end-t)/14:t-3.5;
  const d=49*Math.expm1(s/42),[x,z]=onPath(path,d);
  const look=.9+.009*d,a=onPath(path,d-look),b=onPath(path,d+look),sign=inbound?-1:1;
  return {x,z,heading:heading((b[0]-a[0])*sign,(b[1]-a[1])*sign),wake:Math.min(.92,t/6,(end-t)/6),phase:inbound?'arriving':'departing'};
}
const operators=['VJO','RCH','OA','HB','SEA'];
function callCourse(call:HarborCall,index:number):Course{
  if(index===2)return call[3]==='7208'?'mainStreet':'oakland';
  if(index===1)return call[1]==='F'?'richmondF':'richmond';
  return calls[index][0];
}
function callBerth(call:HarborCall,index:number):ServiceBerth{
  if(call[1]==='G')return 'G1';
  if(call[1]==='E')return index===0?'E1':'E2';
  return index===1||index===3?'F2':'F1';
}
function timetablePlayback(clock:FerryServiceClock,index:number,elapsed:number){
  if(!clock.date||!operators[index])return;
  const age=clock.minutes+elapsed/6,day=Math.floor(age/1440);
  const date=shiftedServiceDate(clock.date,day);
  if(!date)return;
  const series=routeDepartures(date,operators[index]);
  if(index===0){
    // The modeled E1 visit is introductory even during a service suspension.
    const trip=series.find(c=>c[1]==='E'&&c[0]>=mod(age,1440));
    return {opening:true as const,trip};
  }
  if(!serviceDayCalls(date)?.some(c=>c[2]===operators[index]))return {off:true as const};
  // Hold the opening Vallejo call and its passenger timing. All other served
  // routes use six seconds per timetable minute; berth maneuvers run at their
  // ordinary local speed, with the offshore leg absorbing timetable compression.
  const minutes=mod(age,1440);
  // Same-block GTFS arrivals supply the dwell when the boat stays at its
  // platform. Long layovers use a six-minute terminal maneuver to keep the
  // limited model berths clear. Unpaired departures get a three-minute dwell.
  const arrival=(c:HarborCall)=>Math.max(c[0]-6,c[5]??c[0]-3);
  const i=series.findIndex(c=>arrival(c)*6-22>minutes*6);
  if(!i)return {off:true as const};
  const current=series[(i<0?series.length:i)-1],next=series[i]??current;
  if(!current)return {off:true as const};
  const begin=arrival(current)*6-22,depart=current[0]*6,now=minutes*6;
  let phase:number;
  if(now<begin+22)phase=now-begin;
  else if(now<depart)phase=22+18*(now-begin-22)/Math.max(1,depart-begin-22);
  else{
    const span=next===current?Infinity:Math.max(1,arrival(next)*6-22-depart);
    const since=now-depart,available=ferryCycle-40;
    // Leave long gaps at the far terminal. Short headways compress open water
    // while retaining the speed of the near-shore approach and backing turn.
    if(span>=available)phase=40+Math.min(since,available*.55)+Math.max(0,since-span+available*.45);
    else{
      const edge=Math.min(28,span*.20);
      phase=40+(since<edge?since:since>span-edge?available-span+since:
        edge+(since-edge)*(available-2*edge)/(span-2*edge));
    }
  }
  return {phase,current,next,previous:series[(i<0?series.length:i)-2]??current};
}
export function servicePose(elapsed:number,index:number,clock:FerryServiceClock=defaultFerryClock){
  const v=vessels[index],cycle=v.family==='prop'?ferryCycle/2:ferryCycle;
  const raw=(elapsed+v.offset)/cycle,visit=Math.floor(raw),scheduled=timetablePlayback(clock,index,elapsed);
  const s=scheduled&&'phase' in scheduled&&scheduled.phase!==undefined?scheduled:undefined;
  const t=s?.phase??mod(elapsed+v.offset,cycle);
  const course=s?callCourse(s.current,index):courseFor(index,visit,clock);
  const next=s?callCourse(s.next,index):courseFor(index,visit+1,clock);
  const previous=s?callCourse(s.previous,index):courseFor(index,visit-1,clock);
  const current=s?callBerth(s.current,index):homeBerth[course],nextBerth=s?callBerth(s.next,index):homeBerth[next];
  const away=track(index,course,current,false);
  const returnCourse=course==='richmond'||course==='richmondF'?next:course;
  const back=track(index,returnCourse,nextBerth,true),atFar=64+away.duration,returnAt=cycle-back.duration;
  const incoming=t>=returnAt,berth=incoming?nextBerth:current,gate=berth[0] as 'B'|'C'|'E'|'F'|'G';
  const home=berthPosition(index,berth);
  let state={x:home.x,z:home.z,heading:Math.PI/2,wake:0,phase:'alongside'},brow=0;
  if(scheduled?.off||(!scheduled&&clock.weekend&&(course==='seaplane'||course==='harborBay'))){
    state={...cruise(away,away.duration,false),phase:'off service',wake:0};
  }else if(t<22){
    const k=1-t/22;state.z+=7.5*k*k;state.wake=.5*k;state.phase='arriving';
  }else if(t<40){brow=smooth(Math.min(1,(t-22)/2,(40-t)/2));}
  else if(t<54){state.z+=7.5*smooth((t-40)/14);state.phase='backing';}
  else if(t<64){state.z+=7.5;state.heading+=Math.PI*smooth((t-54)/10);state.phase='turning';}
  else if(t<atFar){state=cruise(away,t-64,false);}
  else if(t<returnAt){
    const end=cruise(away,away.duration,false),start=cruise(back,back.duration,true);
    state={...end,heading:turn(end.heading,start.heading,Math.min(1,(t-atFar)/11)),phase:'remote layover',wake:0};
  }else{state=cruise(back,cycle-t,true);}
  return {...state,scheduledMinute:scheduled?.trip?.[0]??(s?(incoming?s.next:s.current)[0]:undefined),gate,berth,brow,stopX:home.stopX,stopZ:home.stopZ,hullHalfBeam:v.beam*.03,
    boardingFreeboard:v.sill,origin:t<22?names[previous]:incoming?names[course]:'San Francisco',
    destination:t<22||incoming?'San Francisco':names[course],route:names[t<22?previous:course]};
}
