import type {WaterfrontWeather} from './waterfront-weather.ts';

export type WeatherChoice='clear'|'overcast'|'fog'|'rain'|'downpour'|'snow';
export type CityConditions={minutes?:number;weather?:WeatherChoice};

const pacific=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});

export function cityDate(now:Date,minutes?:number){
  if(minutes===undefined||!Number.isInteger(minutes)||minutes<0||minutes>1439)return now;
  const parts=Object.fromEntries(pacific.formatToParts(now).map(({type,value})=>[type,value]));
  const utc=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),0,minutes);
  // The earlier occurrence wins during the repeated hour. A nonexistent spring
  // time moves forward by the DST gap, as with a local JavaScript Date.
  const summer=new Date(utc+7*3600_000);
  const local=pacific.formatToParts(summer);
  const hour=Number(local.find(v=>v.type==='hour')!.value);
  return hour===Math.floor(minutes/60)?summer:new Date(utc+8*3600_000);
}

const looks={
  clear:{cloudCover:.04,fog:0,rain:0,visibilityKm:22,windKph:11},
  overcast:{cloudCover:.97,fog:.15,rain:0,visibilityKm:9,windKph:16},
  fog:{cloudCover:.94,fog:.96,rain:0,visibilityKm:.45,windKph:9},
  rain:{cloudCover:.90,fog:.14,rain:.55,visibilityKm:5,windKph:22},
  downpour:{cloudCover:1,fog:.29,rain:1,visibilityKm:1.2,windKph:42},
  snow:{cloudCover:.89,fog:.20,rain:0,visibilityKm:2.4,windKph:8},
} as const;

export function cityWeather(observation:WaterfrontWeather|null,choice?:WeatherChoice){
  if(!choice)return observation;
  return {...looks[choice],windFromDegrees:observation?.windFromDegrees??255};
}
