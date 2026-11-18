/** The opening frame is composed around the Ferry Building and first bridge tower. */
export const openingCamera = {
  yaw: 1.24,
  zoom: 1,
  target: [0, 2.4, 0] as const,
  desktop: { focalLength: 40, elevation: 8.5, distance: 52 },
  portrait: { focalLength: 44, elevation: 8.5, distance: 52 },
  mobile: { focalLength: 36, elevation: 7.2, distance: 46 },
};

export function openingLens(width: number, height: number) {
  return width < 650 ? openingCamera.mobile
    : width < 950 && height > width * 1.2 ? openingCamera.portrait
    : openingCamera.desktop;
}

export function openingYaw(width: number, height: number) {
  if(width<650)return 1.49;
  return width < 950 && height > width * 1.2 ? 1.4 : openingCamera.yaw;
}

/** Inland towers cross the low bay-side orbit. A continuous arc rises over their
 * roofline on the city side while preserving the same central subject. */
export function orbitPitch(yaw:number, tilt:number, basePitch:number){
  const inland=-Math.cos(yaw);
  const u=Math.max(0,Math.min(1,(inland-.08)/.69));
  const clearance=u*u*(3-2*u);
  // Looking north from the south end, the low arc crosses the Bay Bridge deck.
  const bridgePhase=(1-Math.cos(yaw-4.975))/(1-Math.cos(.29));
  const aboveApproach=Math.max(0,1-bridgePhase);
  return basePitch+.66*clearance+.19*aboveApproach*aboveApproach+tilt*(1-.60*clearance);
}

export type CameraAxis = { value: number; velocity: number };

/** Critically damped motion settles without a spring bounce, regardless of frame rate. */
export function dampCameraAxis(axis: CameraAxis, destination: number, dt: number, response = 4, immediate = false) {
  if (immediate) { axis.value = destination; axis.velocity = 0; return axis.value; }
  const change = axis.value - destination;
  const step = (axis.velocity + response * change) * dt;
  const decay = Math.exp(-response * dt);
  axis.value = destination + (change + step) * decay;
  axis.velocity = (axis.velocity - response * step) * decay;
  return axis.value;
}

// Center of travel follows the promenade. The spur follows the timber pier;
// the wider recess at Market lets the focus enter the plaza.
const promenadeSlices = [
  [-53.7,-5.8,.15],[-48,-5.1,.5],[-39,-5.6,.8],[-31,-6.1,1.2],[-20,-4.8,1.3],
  [-12,-5.6,1.5],[-7,-10.6,2.2],[5,-11.1,2.2],[10,-6.3,1.7],[18,-5.7,1.5],[27.7,-5.1,1.6],
];
const clampTo=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function boundWaterfrontFocus(x:number,z:number){
  const u=clampTo(x,promenadeSlices[0][0],27.7);
  const i=promenadeSlices.findIndex(p=>p[0]>=u);
  const [ax,az,aq]=promenadeSlices[Math.max(0,i-1)],[bx,bz,bq]=promenadeSlices[i];
  const t=bx===ax?0:(u-ax)/(bx-ax);
  const mainZ=clampTo(z,az+(bz-az)*t,aq+(bq-aq)*t);
  const pierX=clampTo(x,26.91,27.66),pierZ=clampTo(z,-.94,14.45);
  return Math.hypot(x-u,z-mainZ)<=Math.hypot(x-pierX,z-pierZ)?{x:u,z:mainZ}:{x:pierX,z:pierZ};
}

export function moveWaterfrontFocus(x:number,z:number,yaw:number,forward:number,strafe:number,dt:number){
  const distance=5.2*dt/Math.max(1,Math.hypot(forward,strafe));
  return boundWaterfrontFocus(x+distance*(strafe*Math.cos(yaw)-forward*Math.sin(yaw)),
    z-distance*(forward*Math.cos(yaw)+strafe*Math.sin(yaw)));
}

/** As the orbit comes inland it clears the roofs. Lift the sightline so the
 * islands stay in the frame; a deliberate downward tilt can still study the quay. */
export function harborLookHeight(yaw:number,tilt:number,eyeRise:number,run:number,headroom:number){
  const u=clampTo((-Math.cos(yaw)-.04)/.76,0,1),ease=u*u*(3-2*u);
  return headroom+(eyeRise-run*Math.tan(.11+Math.max(0,tilt)*.89)-headroom)*ease;
}
