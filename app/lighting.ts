import { getPosition } from 'suncalc';

const pacificClock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
type Wash = {
  altitude:number; sky:number; horizon:number; water:number; sun:number;
  fill:number; bounce:number; ambient:number; sunIntensity:number;
};
function wash(altitude:number,sky:number,horizon:number,water:number,sun:number,
  fill:number,bounce:number,ambient:number,sunIntensity:number):Wash{
  return {altitude,sky,horizon,water,sun,fill,bounce,ambient,sunIntensity};
}
// Ink in the upper sky, light on the horizon, then the water and the three light sources.
// The shared high-sun row lies below San Francisco’s winter solar noon. The two
// daily arcs therefore meet smoothly even on the shortest day of the year.
const night=wash(-15,0x152139,0x27364a,0x263f50,0xa9bedc,0xa9b8d1,0x737886,.83,.16);
const highSun=wash(26,0x92b8d4,0xdde8e4,0x458c98,0xffedd4,0xd4e1e7,0xb2a699,1.82,3.28);
const morning=[
  night,
  wash(-6,0x45567c,0xb8a5ae,0x4b6179,0xffc89b,0xb7beda,0x918c9b,1.08,.22),
  wash(0,0x8da9c6,0xf3cfac,0x628191,0xffb779,0xc1cee3,0xb79f97,1.25,1.30),
  wash(6,0x9ab8cf,0xf5dec0,0x6797a0,0xffc187,0xc4d3e9,0xbfa89b,1.27,3.96),
  wash(14,0x9ac0d7,0xe6eadd,0x4a929b,0xffdeb4,0xcbd9e7,0xbbae9f,1.54,3.61),
  highSun,
];
const evening=[
  night,
  wash(-6,0x42476b,0x947f9f,0x434f68,0xffaa82,0xb0abd0,0x9d8597,1.06,.20),
  wash(0,0x8393b7,0xedb4a4,0x67788b,0xffad75,0xbdb9da,0xbfa398,1.20,1.25),
  wash(6,0xa3b1ca,0xf5d0a7,0x738e9c,0xffb56e,0xc9c8df,0xc6aa9c,1.31,3.67),
  wash(14,0xa1b9d1,0xf3dfca,0x58909a,0xffd6a6,0xd1d5e2,0xbfae9e,1.54,3.57),
  highSun,
];
const clamp = (v:number) => Math.max(0,Math.min(1,v));
const toLinear=(c:number)=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
const toSrgb=(c:number)=>c<=.0031308?c*12.92:1.055*c**(1/2.4)-.055;
function mixColor(a:number,b:number,t:number){
  if(t===0||a===b)return a;
  if(t===1)return b;
  return [16,8,0].reduce((result,shift)=>{
    const start=toLinear(((a>>shift)&255)/255),end=toLinear(((b>>shift)&255)/255);
    return result|(Math.round(toSrgb(start+(end-start)*t)*255)<<shift);
  },0);
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
