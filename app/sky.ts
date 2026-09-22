/** Even coverage around the full horizon, with a fixed seed and no per-frame allocation. */
export function starfieldData(count = 1800, radius = 420) {
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const random = (seed: number) => { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  for (let i = 0; i < count; i++) {
    const height = .008 + .992 * (i + .5) / count;
    const azimuth = i * goldenAngle + (random(i) - .5) * .13;
    const ring = Math.sqrt(1 - height * height) * radius;
    positions.set([Math.cos(azimuth) * ring, height * radius, Math.sin(azimuth) * ring], i * 3);
    const brightness = .35 + Math.pow(random(i + count), 2) * .65;
    const warm = random(i + count * 2);
    colors.set([brightness * (.86 + warm * .14), brightness * .93, brightness * (1 - warm * .14)], i * 3);
  }
  return { positions, colors };
}
