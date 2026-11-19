import {cityDate} from './city-conditions.ts';
import predictions from '../public/data/harbor-tide-hours.json' with {type:'json'};
import {nextHarborDeparture,pacificClock} from './harbor-timetable.ts';

type Observation={time:number;meters:number};
const epoch=Date.parse(predictions.start),msl=.951;
const url='https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=9414290&product=water_level&date=latest&datum=MLLW&units=metric&time_zone=gmt&format=json&application=WaterfrontCity';
let observed:Observation|undefined,lastAttempt=-Infinity,inFlight:Promise<void>|undefined;

export function refreshHarborTide(date:Date){
  if(inFlight)return inFlight;
  if(Math.abs(date.getTime()-lastAttempt)<360000)return Promise.resolve();
  lastAttempt=date.getTime();
  inFlight=(async()=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6000);
    try{
      const response=await fetch(url,{signal:controller.signal});
      if(!response.ok)return;
      const payload=await response.json() as {data?:{t?:string;v?:string}[]};
      const item=payload.data?.at(-1);
      if(typeof item?.v!=='string'||!item.v.trim()||typeof item.t!=='string')return;
      const time=Date.parse(item.t.replace(' ','T')+'Z'),meters=Number(item.v);
      if(Number.isFinite(time)&&meters>=-2&&meters<=4)observed={time,meters};
    }catch{/* The bundled prediction also works offline. */}
    finally{clearTimeout(timeout);}
  })().finally(()=>{inFlight=undefined;});
  return inFlight;
}

function tideAt(ms:number,live:boolean){
  if(live&&observed&&ms>=observed.time&&ms-observed.time<=30*60000)return {meters:observed.meters,source:'observed' as const};
  const hour=(ms-epoch)/3600000,i=Math.floor(hour),values=predictions.cm;
  if(i>=0&&i+1<values.length)return {meters:(values[i]+(values[i+1]-values[i])*(hour-i))*.01,source:'predicted' as const};
  return {meters:msl,source:'mean level' as const};
}
export function harborConditionsAt(date:Date,customMinutes?:number){
  const selected=cityDate(date,customMinutes),ms=selected.getTime();
  const clock=pacificClock(selected);
  const tide=tideAt(ms,customMinutes===undefined);
  const tideOffset=(tide.meters-msl)*.06;
  return {tide,tideOffset,clock:{...clock,tideOffset},next:nextHarborDeparture(clock.date,clock.minutes)};
}
