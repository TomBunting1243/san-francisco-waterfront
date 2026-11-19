import {pccFrontDoorX,pccLengthScale} from './pcc-layout.ts';

// OSM stop_position 1083359950 is on the regular northbound platform.
// The separate high ramp at x=3.034 serves accessible boarding.
export const ferryDoorX=2.217,washingtonDoorX=15.1602;
export const pccDoorLead=pccFrontDoorX*pccLengthScale;
export const ferryStopX=ferryDoorX-pccDoorLead,washingtonStopX=washingtonDoorX-pccDoorLead;
export const washingtonDwell=7;
const clamp=(t:number)=>Math.max(0,Math.min(1,t));
export function washingtonDoorOpening(t:number){
  return Math.min(clamp((t-.30)/.95),clamp((6.80-t)/1.1));
}

const speed=.85,brakeTime=3.6,stopCost=brakeTime+washingtonDwell;
export const ambientStreetcarPeriod=(plaza:boolean)=>(plaza?32:130)/speed+2*stopCost;
export function ambientStreetcarCall(elapsed:number,plaza=false){
  const start=plaza?-12:-65,period=ambientStreetcarPeriod(plaza);
  const elapsedWithLead=elapsed+(plaza?7:42)/speed;
  const cycle=(t:number,d:number)=>((t%d)+d)%d;
  const clock=cycle(elapsedWithLead,period);
  const ferryArrival=(ferryStopX-start)/speed+brakeTime/2;
  const washingtonArrival=(washingtonStopX-start)/speed+brakeTime/2+stopCost;
  const ferryTime=clock-ferryArrival,t=clock-washingtonArrival;
  // A red light can keep a pedestrian on the median longer than the short
  // plaza lap. Reintroduce the next rider inside the arriving car after three laps.
  const passengerTime=cycle(elapsedWithLead-ferryArrival+12,plaza?3*period:period)-12;
  const servingFerry=ferryTime<washingtonDwell+brakeTime;
  const u=servingFerry?ferryTime:t,stop=servingFerry?ferryStopX:washingtonStopX;
  let station=stop;
  if(u< -brakeTime)station+=speed*(u+brakeTime/2);
  else if(u<0)station-=speed*u*u/(2*brakeTime);
  else if(u>washingtonDwell){
    const d=u-washingtonDwell;
    station+=d<brakeTime?speed*d*d/(2*brakeTime):speed*(d-brakeTime/2);
  }
  return {station,t,ferryTime,passengerTime};
}
