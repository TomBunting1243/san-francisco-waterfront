export const signalPeriod=64;
export function signalAspects(elapsed:number):[number,number]{
  const t=(elapsed%signalPeriod+signalPeriod)%signalPeriod;
  if(t<32)return [2,0];
  if(t<36)return [1,0];
  if(t<38)return [0,0];
  if(t<58)return [0,2];
  if(t<62)return [0,1];
  return [0,0];
}

// x stations where each mapped through lane reaches its approach stop stripe.
// Mission northbound uses the conservative upstream edge of its partly obscured crossing.
export const roadStopLines={
  north:{mission:-13.50,market:-1.21,washington:11.01},
  south:{mission:-11.50,market:-.49,washington:13.96},
} as const;

// Separate northbound and southbound midblock crossings meet Harry Bridges Plaza.
// The simulated cabinets share the existing traffic clock. The final four
// seconds remain steady hand before vehicles are released on the next cycle.
const walkStart=38,walkEnd=46;
export function marketWalkDelay(elapsed:number){
  if(marketPedestrianPhase(elapsed)==='walk')return 0;
  const t=((elapsed%signalPeriod)+signalPeriod)%signalPeriod;
  return (walkStart-t+signalPeriod)%signalPeriod;
}
export function marketPedestrianPhase(elapsed:number):'walk'|'clearance'|'stop'{
  const t=((elapsed%signalPeriod)+signalPeriod)%signalPeriod;
  return t>=walkStart&&t<walkEnd?'walk':t>=walkEnd&&t<60?'clearance':'stop';
}
