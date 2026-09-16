import { getPosition } from 'suncalc';

const pacificClock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const stops = [
  { altitude: -18, sky: 0x132536, water: 0x234857, sun: 0xaebfd5 },
  { altitude: -6, sky: 0x536780, water: 0x496b7e, sun: 0xe2af93 },
  { altitude: 0, sky: 0xd6b5a6, water: 0x849da8, sun: 0xffba7a },
  { altitude: 10, sky: 0xc5d6d8, water: 0x4e929f, sun: 0xffdfb0 },
  { altitude: 35, sky: 0xb9dce7, water: 0x4b9aa8, sun: 0xfff1d5 },
];
const clamp = (v:number) => Math.max(0,Math.min(1,v));
function mixColor(a:number,b:number,t:number){
  return [16,8,0].reduce((color,shift)=>color|(Math.round(((a>>shift)&255)*(1-t)+((b>>shift)&255)*t)<<shift),0);
}

/** SunCalc 2 reports degrees. Clock formatting always uses Pacific time, with DST. */
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
    altitude,azimuth,night,hours,minutes,
    sky:mixColor(a.sky,b.sky,blend),water:mixColor(a.water,b.water,blend),sun:mixColor(a.sun,b.sun,blend),
    ambient:2.3-night*1.65,sunIntensity:.15+2.9*clamp((altitude+4)/30),
    phase:altitude>=10?'day':altitude>=0?'golden-hour':altitude>=-6?'twilight':'night',
  };
}
