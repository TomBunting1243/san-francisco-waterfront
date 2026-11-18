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
