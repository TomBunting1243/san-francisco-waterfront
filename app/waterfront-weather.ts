// NOAA observes visibility at Pier 17 and wind at Pier 1, beside the Ferry Building.
// https://tidesandcurrents.noaa.gov/stationhome.html?id=9414296
// https://tidesandcurrents.noaa.gov/stationhome.html?id=9414311
// Metric CO-OPS visibility is km and wind is m/s: https://api.tidesandcurrents.noaa.gov/api/prod/
// The NWS /points/37.7955,-122.3937 response identifies this specific waterfront forecast grid.
const endpoints={
  visibility:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=9414296&product=visibility&time_zone=gmt&units=metric&format=json',
  wind:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=9414311&product=wind&time_zone=gmt&units=metric&format=json',
  sky:'https://api.weather.gov/gridpoints/MTR/86,106',
};

export type WaterfrontWeather={
  observedAt:string;station:string;description:string;
  visibilityKm:number|null;windKph:number|null;windFromDegrees:number|null;
  fog:number;cloudCover:number;rain:number;cloudKnown:boolean;rainKnown:boolean;
};
type Reading={at:number;value:number;direction?:number|null};
type Period={from:number;until:number;value:number};
type Grid={at:number;cloud:Period|null;rain:Period|null};
type Records={visibility?:Reading;wind?:Reading;sky?:Grid};
type Options={request?:typeof fetch;now?:()=>number;storage?:Pick<Storage,'getItem'|'setItem'>|null;timeoutMs?:number};
const minute=60_000,marineAge=45*minute,gridAge=18*60*minute,key='sf-waterfront-weather-v1';
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
function valueOf(value:unknown,max:number){
  if(typeof value!=='number'&&(typeof value!=='string'||!value.trim()))return null;
  const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=max?n:null;
}
function fresh(time:number,now:number,age:number){
  return Number.isFinite(time)&&time<=now+2*minute&&time>=now-age;
}
type Obj=Record<string,unknown>;
function object(v:unknown):Obj{return typeof v==='object'&&v!==null?v as Obj:{};}
function marine(json:unknown,kind:'wind'|'visibility',now:number):Reading|undefined{
  const body=object(json),station=kind==='wind'?'9414311':'9414296';
  if(object(body.metadata).id!==station||!Array.isArray(body.data))return;
  const row=object(body.data[body.data.length-1]),t=String(row.t);
  if(!/^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(t))return;
  const at=Date.parse(t.replace(' ','T')+':00Z');
  if(!fresh(at,now,marineAge)||!/^0(?:,0)*$/.test(String(row.f)))return;
  const v=kind==='wind'?valueOf(row.s,130):valueOf(row.v,200);
  if(v===null)return;
  return kind==='wind'?{at,value:v*3.6,direction:valueOf(row.d,360)}:{at,value:v};
}
function period(layer:unknown,now:number,convert:(v:unknown)=>number|null):Period|null{
  const values=object(layer).values;
  if(!Array.isArray(values))return null;
  for(const item of values){
    const row=object(item),[start,duration]=String(row.validTime).split('/');
    const m=/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(duration??'');
    if(!m)continue;
    const [,days='0',hours='0',minutes='0',seconds='0']=m;
    const span=((Number(days)*24+Number(hours))*60+Number(minutes))*minute+Number(seconds)*1000;
    const from=Date.parse(start),until=from+span;
    if(!(from<=now&&now<until))continue;
    const value=convert(row.value);return value===null?null:{from,until,value};
  }
  return null;
}
function rainWeight(terms:unknown){
  if(!Array.isArray(terms))return null;
  let result=0;
  for(const item of terms){
    const w=object(item);
    if(!['rain','rain_showers','drizzle','freezing_rain','freezing_drizzle'].includes(String(w.weather)))continue;
    // A chance of showers alone does not establish that it is raining now.
    const coverage=String(w.coverage??'');
    if(['chance','slight_chance','isolated'].includes(coverage))continue;
    const confidence=['likely','scattered','patchy','areas'].includes(coverage)?.65:1;
    const intensity=w.intensity==='heavy'?1:w.intensity==='light'?.33:.66;
    result=Math.max(result,confidence*intensity*(String(w.weather).includes('drizzle')?.6:1));
  }
  return result;
}
function grid(json:unknown,now:number):Grid|undefined{
  const p=object(object(json).properties),at=Date.parse(String(p.updateTime));
  if(!fresh(at,now,gridAge))return;
  const cloud=period(p.skyCover,now,x=>{const n=valueOf(x,100);return n===null?null:n/100;});
  const rain=period(p.weather,now,rainWeight);
  return cloud||rain?{at,cloud,rain}:undefined;
}

function compose(records:Records,now:number):WaterfrontWeather|null{
  const vis=records.visibility,anemometer=records.wind,sky=records.sky;
  const visibilityKm=vis&&fresh(vis.at,now,marineAge)?valueOf(vis.value,200):null;
  const windKph=anemometer&&fresh(anemometer.at,now,marineAge)?valueOf(anemometer.value,468):null;
  const forecastValue=(p:Period|null|undefined)=>sky&&fresh(sky.at,now,gridAge)&&p&&p.from<=now&&now<p.until?valueOf(p.value,1):null;
  const cloud=forecastValue(sky?.cloud),rain=forecastValue(sky?.rain);
  if(visibilityKm===null&&windKph===null&&cloud===null&&rain===null)return null;
  const fog=visibilityKm===null?0:clamp(1-Math.log1p(visibilityKm)/Math.log(13));
  const windFromDegrees=windKph===null||windKph===0?null:valueOf(anemometer?.direction,360);
  const stations=[visibilityKm!==null?'9414296':'',windKph!==null?'9414311':''].filter(Boolean);
  const at=stations.length?Math.max(visibilityKm!==null?vis!.at:0,windKph!==null?anemometer!.at:0):sky!.at;
  const description=[visibilityKm!==null?'Pier 17 visibility':'',windKph!==null?'Pier 1 wind':'',cloud!==null||rain!==null?'NWS waterfront forecast':''].filter(Boolean).join(' · ');
  return {station:stations.join('+')||'MTR/86,106',description,observedAt:new Date(at).toISOString(),visibilityKm,windKph,windFromDegrees,
    fog,cloudCover:cloud??0,rain:rain??0,cloudKnown:cloud!==null,rainKnown:rain!==null};
}

// No browser storage, fetch or timer is touched until the first live-scene request.
export function createWaterfrontWeatherReader(options:Options={}){
  const now=options.now??Date.now;
  let records:Records={},loaded=false,lastTry=-Infinity,pending:Promise<WaterfrontWeather|null>|undefined;
  function storage(){
    if(options.storage!==undefined)return options.storage;
    try{return globalThis.localStorage;}catch{return null;}
  }
  return function read():Promise<WaterfrontWeather|null>{
    if(pending)return pending;
    if(!loaded){
      loaded=true;
      try{records=object(JSON.parse(storage()?.getItem(key)??'{}')) as Records;}catch{/* Private storage is optional. */}
    }
    const time=now(),previous=compose(records,time);
    if(time>=lastTry&&time-lastTry<(previous?10*minute:minute))return Promise.resolve(previous);
    lastTry=time;
    const controller=new AbortController();
    const alarm=setTimeout(()=>controller.abort(),options.timeoutMs??3000);
    async function get(url:string){
      try{
        const response=await (options.request??fetch)(url,{signal:controller.signal,credentials:'omit',cache:'no-cache'});
        if(response.ok)return await response.json();
      }catch{/* A failed feed may still have a recent independent reading. */}
      return undefined;
    }
    pending=Promise.all(Object.values(endpoints).map(get)).then(([visibility,wind,sky])=>{
      const current=now(),v=marine(visibility,'visibility',current),w=marine(wind,'wind',current),g=grid(sky,current);
      if(v&&(!fresh(records.visibility?.at??NaN,current,marineAge)||v.at>=records.visibility!.at))records.visibility=v;
      if(w&&(!fresh(records.wind?.at??NaN,current,marineAge)||w.at>=records.wind!.at))records.wind=w;
      if(g&&(!fresh(records.sky?.at??NaN,current,gridAge)||g.at>=records.sky!.at))records.sky=g;
      if(v||w||g)try{storage()?.setItem(key,JSON.stringify(records));}catch{/* Memory cache remains available. */}
      return compose(records,current);
    }).finally(()=>{clearTimeout(alarm);pending=undefined;});
    return pending;
  };
}
export const readWaterfrontWeather=createWaterfrontWeatherReader();
