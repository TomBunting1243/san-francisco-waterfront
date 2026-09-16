/** Separated shipping lanes, seaward of every terminal and pier. +X is the bow. */
export const ferryRoutes = [
  { z: 28, speed: .82, direction: 1, start: -6 },
  { z: 33, speed: .61, direction: -1, start: 28 },
] as const;
export function ferryPose(elapsed: number, index: number) {
  const route=ferryRoutes[index % ferryRoutes.length];
  const x=((route.start+elapsed*route.speed*route.direction+80)%160+160)%160-80;
  return {x,z:route.z,y:-.47+Math.sin(elapsed*1.4+index)*.035,heading:route.direction===1?0:Math.PI};
}
export function birdPose(elapsed:number,index:number){
  const t=elapsed*(.085+(index%3)*.01)+index*1.7;
  return {x:5+Math.sin(t)*(19+index*1.5),y:13+index*.55+Math.sin(t*2.1)*1.3,z:9+Math.cos(t)*(3+index*.35),heading:Math.atan2(Math.sin(t)*(3+index*.35),Math.cos(t)*(19+index*1.5)),flap:Math.sin(elapsed*(5.5+index*.15)+index)*.5};
}
