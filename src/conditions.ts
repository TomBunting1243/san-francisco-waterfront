export const weatherLabels={
  clear:'Clear',overcast:'Overcast',fog:'Fog',rain:'Rain',downpour:'Downpour',snow:'Snow'
} as const;
export type Weather=keyof typeof weatherLabels;
export type Conditions={minutes?:number;weather?:Weather};

const key='sf-waterfront.custom-conditions.v1';
export function readConditions(raw:string|null):Conditions{
  if(!raw)return {};
  try{
    const value:unknown=JSON.parse(raw),result:Conditions={};
    if(!value||typeof value!=='object')return result;
    if('minutes' in value&&typeof value.minutes==='number'&&Number.isInteger(value.minutes)&&value.minutes>=0&&value.minutes<1440)result.minutes=value.minutes;
    if('weather' in value&&typeof value.weather==='string'&&Object.hasOwn(weatherLabels,value.weather))result.weather=value.weather as Weather;
    return result;
  }catch{return {};}
}
export function loadConditions():Conditions{
  try{return readConditions(window.localStorage.getItem(key));}catch{return {};}
}
export function saveConditions(value:Conditions){
  try{
    if(value.minutes===undefined&&value.weather===undefined)window.localStorage.removeItem(key);
    else window.localStorage.setItem(key,JSON.stringify(value));
  }catch{/* The controls still work for this visit when storage is unavailable. */}
}
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Los_Angeles',hourCycle:'h23',hour:'2-digit',minute:'2-digit'});
export function sanFranciscoTime(now=new Date()){return clock.format(now);}
export function timeText(minutes:number){return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');}
export function timeMinutes(text:string){
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(text))return undefined;
  const [hour,minute]=text.split(':').map(Number);
  return hour*60+minute;
}
