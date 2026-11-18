import { getPosition } from 'suncalc';

const pacificClock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const stops = [
  { altitude: -18, sky: 0x132536, water: 0x234857, sun: 0xaebfd5 },
  { altitude: -6, sky: 0x536780, water: 0x496b7e, sun: 0xe2af93 },
  { altitude: 0, sky: 0xd5b7a9, water: 0x849da8, sun: 0xffba7a },
  { altitude: 10, sky: 0xc3d3d5, water: 0x4e929f, sun: 0xffdbab },
  { altitude: 35, sky: 0xb8d5df, water: 0x4b9aa8, sun: 0xffedcd },
];
const clamp = (v:number) => Math.max(0,Math.min(1,v));
function mixColor(a:number,b:number,t:number){
  return [16,8,0].reduce((color,shift)=>color|(Math.round(((a>>shift)&255)*(1-t)+((b>>shift)&255)*t)<<shift),0);
}

const surveyBearing=Math.atan2(.03552029735,.04836012986);
const northX=Math.cos(surveyBearing),northZ=Math.sin(surveyBearing);

/** Rotate true-north solar bearings into the same east/north basis as the city survey. */
export function harborSunDirection(azimuth:number,altitude:number):[number,number,number]{
  const bearing=azimuth*Math.PI/180,elevation=altitude*Math.PI/180;
  const east=Math.sin(bearing)*Math.cos(elevation),north=Math.cos(bearing)*Math.cos(elevation);
  return [-northZ*east+northX*north,Math.sin(elevation),northX*east+northZ*north];
}

/** SunCalc 2 reports degrees. Clock formatting always uses Pacific time, with DST. */
export function sunsetWeight(altitude:number,azimuth:number){
  if(azimuth<=180)return 0;
  // Afterglow builds before the solar disc reaches the water and fades through civil twilight.
  return clamp((altitude+8)/6)*clamp((14-altitude)/10);
}

/** A continuous loss of cast-shadow contrast as the marine layer covers the sun. */
export function directSunVisibility(altitude:number,cloud:number,fog:number){
  return clamp(altitude/3)*clamp((.98-cloud)/.30)*(1-fog)**2;
}

export function pacificLighting(date = new Date()) {
  const { altitude, azimuth } = getPosition(date,37.7955,-122.3937);
  const next = stops.findIndex(stop=>altitude<stop.altitude);
  const high = next===-1 ? stops.length-1 : next;
  const low = Math.max(0,high-1);
  const a=stops[low],b=stops[high];
  const blend=low===high?0:clamp((altitude-a.altitude)/(b.altitude-a.altitude));
  const night=clamp((5-altitude)/14);
  const parts=pacificClock.formatToParts(date);
  const hours=Number(parts.find(p=>p.type==='hour')!.value),minutes=Number(parts.find(p=>p.type==='minute')!.value);
  return {
    altitude,azimuth,night,hours,minutes,sunset:sunsetWeight(altitude,azimuth),direction:harborSunDirection(azimuth,altitude),
    sky:mixColor(a.sky,b.sky,blend),water:mixColor(a.water,b.water,blend),sun:mixColor(a.sun,b.sun,blend),
    ambient:2.10-night*1.39,sunIntensity:.15+3.04*clamp((altitude+4)/30),
    phase:altitude>=10?'day':altitude>=0?'golden-hour':altitude>=-6?'twilight':'night',
  };
}

/** Fixed solar studies of the same waterfront. Live always follows the Pacific clock. */
export function sceneLighting(light:'live'|'day'|'sunset'|'night', now=new Date()) {
  if(light==='live')return pacificLighting(now);
  const hour={day:'20:00',sunset:'02:07',night:'06:00'}[light];
  return pacificLighting(new Date('2026-09-10T'+hour+':00Z'));
}
