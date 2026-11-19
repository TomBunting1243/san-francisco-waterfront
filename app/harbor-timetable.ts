import data from '../public/data/harbor-timetable.json' with {type:'json'};

export type HarborCall=[minutes:number,gate:'E'|'F'|'G',route:string,stop:string,direction:'in'|'out',arrivalMinutes?:number];
const patterns=data.patterns as HarborCall[][],start=Date.parse(data.start+'T00:00:00Z');
const dayMs=86400000;
const pacific=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function pacificClock(date:Date){
  const parts=pacific.formatToParts(date);
  const field=(key:string)=>parts.find(p=>p.type===key)!.value;
  return {date:field('year')+'-'+field('month')+'-'+field('day'),weekend:['Sat','Sun'].includes(field('weekday')),minutes:Number(field('hour'))*60+Number(field('minute'))};
}
const dates=data.days.map((_,i)=>new Date(start+i*dayMs).toISOString().slice(0,10));
const datedIndex=new Map(dates.map((date,i)=>[date,i]));
const dayIndex=(date:string)=>datedIndex.get(date)??-1;
export function shiftedServiceDate(date:string,delta:number){
  const i=dayIndex(date);
  return i<0?undefined:dates[i+delta];
}
export function serviceDayCalls(date:string){
  return patterns[data.days[dayIndex(date)]] as HarborCall[]|undefined;
}
const stopNames:Record<string,string>=data.stops;
export function nextHarborDeparture(date:string,minutes:number){
  const first=dayIndex(date);
  if(first<0||first>=data.days.length)return {status:'outside feed' as const};
  for(let d=first;d<data.days.length;d++){
    const next=patterns[data.days[d]].find(c=>c[4]==='out'&&(d!==first||c[0]>=minutes));
    if(next)return {status:'scheduled' as const,minutes:next[0],gate:next[1],destination:stopNames[next[3]],daysAhead:d-first};
  }
  return {status:'no further sailing' as const};
}
export const timetableThrough=data.end;

// The observed operator feed identifies gates, not numbered berths or hulls.
// One representative vessel per route follows successive downtown departures.
const daily=new Map<string,HarborCall[]>();
export function routeDepartures(date:string,route:string){
  const key=date+route;
  let rows=daily.get(key);
  if(!rows){
    rows=[];
    const today=dayIndex(date);
    for(const d of [-1,0,1]){
      const pattern=patterns[data.days[today+d]];
      if(pattern)for(const c of pattern)if(c[2]===route&&c[4]==='out')rows.push([c[0]+d*1440,c[1],c[2],c[3],c[4],c[5]===undefined?undefined:c[5]+d*1440]);
    }
    if(daily.size>=32)daily.clear();
    daily.set(key,rows);
  }
  return rows;
}
