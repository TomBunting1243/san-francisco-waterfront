// The NPS urban comparison puts the naked-eye limit near apparent magnitude 2.
// https://www.nps.gov/subjects/nightskies/rateyoursky.htm
// This is a fixed illustrative sky, with no claim to depict a dated star chart.
export function starfieldData() {
  const positions: number[] = [], colors: number[] = [];
  const fraction = (seed: number) => {
    const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let rank = 1; rank <= 45; rank++) {
    // Permute elevation independently of brightness. Differential extinction
    // dims even a bright source seen through a long column of shoreline air.
    const height = ((rank * 19) % 47 + fraction(rank)) / 47;
    const magnitude = 2 * Math.log10(rank / 2.5) + .22 * (1 / height - 1);
    if (magnitude > 2.45) continue;
    const azimuth = 2 * Math.PI * fraction(rank + 87) - 1, ring = Math.sqrt(1 - height * height);
    positions.push(420 * ring * Math.cos(azimuth), 420 * height, 420 * ring * Math.sin(azimuth));
    const alpha = Math.min(.7, .32 * Math.pow(10, -.28 * magnitude));
    colors.push(.85, .89, .95, alpha);
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
}

export function starVisibility(night: number, cloud: number, fog: number) {
  return Math.max(0, (night - .65) / .35) * (1 - cloud) ** 2 * (1 - fog) ** 3;
}

export function harborStars(THREE: typeof import('three')) {
  const data = starfieldData(), geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 4));
  const material = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true,
    transparent: true, depthTest: true, depthWrite: false, fog: false, toneMapped: false });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\ngl_Position.z = gl_Position.w;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(0.12, 0.5, length(gl_PointCoord - 0.5));');
  };
  const stars = new THREE.Points(geometry, material);
  stars.renderOrder = -1;
  return stars;
}
