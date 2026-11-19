import { getPosition } from 'suncalc';

const pacificClock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
type Wash = {
  altitude:number; sky:number; horizon:number; water:number; sun:number;
  fill:number; bounce:number; ambient:number; sunIntensity:number; litShare:number;
};
function wash(altitude:number,sky:number,horizon:number,water:number,sun:number,
  fill:number,bounce:number,ambient:number,sunIntensity:number,litShare:number):Wash{
  return {altitude,sky,horizon,water,sun,fill,bounce,ambient,sunIntensity,litShare};
}
// Ink in the upper sky, light on the horizon, then the water and the three light sources.
// The shared high-sun row lies below San Francisco’s winter solar noon. The two
// daily arcs therefore meet smoothly even on the shortest day of the year.
const night=wash(-15,0x0d1626,0x1c2a40,0x0b1422,0x9fb4d6,0x23324d,0x0f1a2b,.75,.12,.30);
const blue=wash(-6,0x23346a,0x6f6aa6,0x17264a,0xff8f66,0x46558f,0x1f2a52,.95,0,.40);
const highSun=wash(26,0x8fbfe0,0xdbe9ea,0x4a7d86,0xfff1d6,0xbcd3e8,0x7b8db3,1.10,2.20,0);
const morning=[night,blue,
  wash(6,0x8fa9cf,0xf6c9a8,0x4f6f8a,0xffc08f,0x8f9ce0,0x6a6fa3,.78,2.30,.03),highSun];
const evening=[night,blue,
  wash(6,0xa9b7dc,0xffc48e,0x47627f,0xff9d4d,0xd9a98c,0x5f5a96,.62,2.50,.05),highSun];
const clamp = (v:number) => Math.max(0,Math.min(1,v));
const toLinear=(c:number)=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
const toSrgb=(c:number)=>c<=.0031308?c*12.92:1.055*c**(1/2.4)-.055;
// OKLab's first step is a cube-root LMS transform; the remaining transform
// into L,a,b is linear and commutes with interpolation in Cartesian OKLab.
function pigmentSpace(hex:number){
  const r=toLinear((hex>>16)/255),g=toLinear(((hex>>8)&255)/255),b=toLinear((hex&255)/255);
  return [Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),
    Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),
    Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b)];
}
function mixColor(a:number,b:number,t:number){
  if(t===0||a===b)return a;
  if(t===1)return b;
  const start=pigmentSpace(a),end=pigmentSpace(b);
  const [l,m,s]=start.map((v,i)=>(v+(end[i]-v)*t)**3);
  const channel=(v:number)=>Math.round(255*toSrgb(clamp(v)));
  return channel(4.0767416621*l-3.3077115913*m+.2309699292*s)<<16|
    channel(-1.2684380046*l+2.6097574011*m-.3413193965*s)<<8|
    channel(-.0041960863*l-.7034186147*m+1.7076147010*s);
}
export function harborWash(altitude:number,azimuth:number){
  const stops=azimuth<180?morning:evening;
  const next=stops.findIndex(s=>altitude<s.altitude);
  const hi=next===-1?stops.length-1:next,lo=Math.max(0,hi-1);
  const a=stops[lo],b=stops[hi];
  const v=hi===lo?0:clamp((altitude-a.altitude)/(b.altitude-a.altitude)),t=v*v*(3-2*v);
  return {
    sky:mixColor(a.sky,b.sky,t),horizon:mixColor(a.horizon,b.horizon,t),water:mixColor(a.water,b.water,t),
    sun:mixColor(a.sun,b.sun,t),fill:mixColor(a.fill,b.fill,t),bounce:mixColor(a.bounce,b.bounce,t),
    litShare:a.litShare+(b.litShare-a.litShare)*t,
    ambient:a.ambient+(b.ambient-a.ambient)*t,sunIntensity:a.sunIntensity+(b.sunIntensity-a.sunIntensity)*t,
  };
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
  const night=clamp((5-altitude)/14);
  const parts=pacificClock.formatToParts(date);
  const hours=Number(parts.find(p=>p.type==='hour')!.value),minutes=Number(parts.find(p=>p.type==='minute')!.value);
  return {
    altitude,azimuth,night,hours,minutes,sunset:sunsetWeight(altitude,azimuth),direction:harborSunDirection(azimuth,altitude),
    ...harborWash(altitude,azimuth),
    phase:altitude>=10?'day':altitude>=0?'golden-hour':altitude>=-6?'twilight':'night',
  };
}

/** Fixed solar studies of the same waterfront. Live always follows the Pacific clock. */
export function sceneLighting(light:'live'|'day'|'sunset'|'night', now=new Date()) {
  if(light==='live')return pacificLighting(now);
  const hour={day:'20:00',sunset:'02:07',night:'06:00'}[light];
  return pacificLighting(new Date('2026-09-10T'+hour+':00Z'));
}
