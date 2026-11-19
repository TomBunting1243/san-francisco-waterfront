import {pccFrontDoorX,pccLengthScale} from './pcc-layout.ts';
// Projected front-door station for SFMTA 14532. PCC 1051's shell is 48 ft 5 in.
export const washingtonDoorX=15.1602;
export const pccDoorLead=pccFrontDoorX*pccLengthScale;
export const washingtonStopX=washingtonDoorX-pccDoorLead;
export const washingtonDwell=7;
const clamp=(t:number)=>Math.max(0,Math.min(1,t));
export function washingtonDoorOpening(t:number){
  return Math.min(clamp((t-.30)/.95),clamp((6.80-t)/1.1));
}

export function ambientStreetcarCall(elapsed:number,plaza=false){
  const start=plaza?-12:-65,length=plaza?32:130,speed=.85,brakeTime=3.6;
  const stop=washingtonStopX,brakeRun=speed*brakeTime/2;
  const arrival=(stop-start)/speed+brakeTime/2;
  const period=length/speed+brakeTime+washingtonDwell;
  const clock=(((elapsed+(plaza?7:42)/speed)%period)+period)%period;
  const t=clock-arrival;
  let station=stop;
  if(t< -brakeTime)station=start+clock*speed;
  else if(t<0)station-=speed*t*t/(2*brakeTime);
  else if(t>washingtonDwell){
    const departure=t-washingtonDwell;
    station+=departure<brakeTime?speed*departure*departure/(2*brakeTime):brakeRun+speed*(departure-brakeTime);
  }
  return {station,t};
}
