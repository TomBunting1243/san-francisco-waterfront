import {ferryEntryX,ferryTowerZ} from './ferry-portico-access.ts';

/** From the plaza, the clock lines up with the bay and the eastern suspension towers. */
export const openingCamera = {
  yaw: 3.145,
  zoom: 1,
  target: [0, .83, 0] as const,
  desktop: { focalLength: 21.5, elevation: 1.13, distance: 9.6 },
  portrait: { focalLength: 19.5, elevation: 1.13, distance: 9.6 },
  mobile: { focalLength: 18, elevation: 1.13, distance: 9.6 },
};

export function openingLens(width: number, height: number) {
  const lens = width < 650 ? openingCamera.mobile
    : width < 950 && height > width * 1.2 ? openingCamera.portrait
    : openingCamera.desktop;
  // A wider window reveals more of the waterfront on either side. Keep the
  // vertical angle wide enough for both the flag and the paving below it.
  const aspect = width / Math.max(1, height);
  return aspect > 16 / 9 ? { ...lens, focalLength: lens.focalLength * (16 / 9) / aspect } : lens;
}

export function openingYaw(width: number, height: number) {
  if(width<650)return 3.10;
  return width < 950 && height > width * 1.2 ? 3.125 : openingCamera.yaw;
}

/** Rotate about the visitor's focus with a fixed radius and the chosen pitch. */
export function orbitOffset(lens:{elevation:number;distance:number},yaw:number,tilt:number,out:{set(x:number,y:number,z:number):unknown}){
  const pitch=Math.atan2(lens.elevation,lens.distance)+tilt;
  const radius=Math.hypot(lens.elevation,lens.distance),run=radius*Math.cos(pitch);
  out.set(Math.sin(yaw)*run,Math.sin(pitch)*radius,Math.cos(yaw)*run);
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

// The point is the centre of the street dial, at the outside of its bronze bezel.
const westDial=[ferryEntryX,2.035,ferryTowerZ-.324-.022] as const;
export const clockArrivalDuration=2800;
export function clockArrivalFraming(width:number,height:number){
  const lens=openingLens(width,height),yaw=openingYaw(width,height);
  const sin=Math.sin(yaw),cos=Math.cos(yaw);
  const pitch=Math.atan2(lens.elevation,lens.distance),up=Math.sin(pitch),forward=Math.cos(pitch);
  const dx=westDial[0]-lens.distance*sin,dy=westDial[1]-openingCamera.target[1]-lens.elevation,dz=westDial[2]-lens.distance*cos;
  const along=dx*sin+dz*cos,depth=-along*forward-dy*up;
  const pixels=lens.focalLength*Math.max(width,height)/35;
  return {x:pixels*(dx*cos-dz*sin)/depth,y:-pixels*(dy*forward-along*up)/depth,
    gain:.56*Math.min(width,height)*depth/(22*.3048*.06*pixels)};
}
// Interpolate focal length in log space. A film offset recentres the clock
// without rotating or translating the camera. At t=1 the original frustum is exact.
export function clockArrivalFrame(framing:ReturnType<typeof clockArrivalFraming>,t:number){
  const p=Math.max(0,Math.min(1,t)),smooth=p*p*(3-2*p);
  const gain=framing.gain**(1-smooth);
  const fraction=(gain-1)/(framing.gain-1);
  return {gain,shiftX:-framing.x*framing.gain*fraction,shiftY:-framing.y*framing.gain*fraction};
}
