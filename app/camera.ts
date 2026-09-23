/** The opening frame is composed around the Ferry Building and first bridge tower. */
export const openingCamera = {
  yaw: 1.08,
  zoom: 1,
  target: [-15, 3, 2] as const,
  desktop: { focalLength: 40, elevation: 5, distance: 50 },
  portrait: { focalLength: 44, elevation: 5, distance: 50 },
  mobile: { focalLength: 27, elevation: 6, distance: 66 },
};

export function openingLens(width: number, height: number) {
  return width < 650 ? openingCamera.mobile
    : width < 950 && height > width * 1.2 ? openingCamera.portrait
    : openingCamera.desktop;
}

export function openingYaw(width: number, height: number) {
  return width < 950 && height > width * 1.2 ? 1.4 : openingCamera.yaw;
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
