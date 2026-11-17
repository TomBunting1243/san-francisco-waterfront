// Offline bake of Mapzen Terrarium elevations and OpenStreetMap geometry.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const cache = process.argv[2];
if (!cache) throw new Error('Supply a directory for cached public source responses.');
await mkdir(cache, { recursive: true });

const assets = new URL('../public/data/', import.meta.url);
const terrainBase = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
const osmMap = bbox => 'https://api.openstreetmap.org/api/0.6/map.json?bbox=' + bbox;

async function resource(name, url) {
  const path = join(cache, name);
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60000),
    headers: { 'User-Agent': 'San Francisco Waterfront Terrain Bake' },
  });
  if (!response.ok) throw new Error(url + ' ' + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(path, bytes);
  return bytes;
}

const tiles = new Map();
async function height(longitude, latitude, zoom) {
  const extent = 2 ** zoom;
  const pixelX = (longitude + 180) / 360 * extent;
  const pixelY = (1 - Math.asinh(Math.tan(latitude * Math.PI / 180)) / Math.PI) * extent / 2;
  const x = Math.floor(pixelX), y = Math.floor(pixelY);
  const key = [zoom, x, y].join('-');
  if (!tiles.has(key)) {
    const image = resource(key + '.png', terrainBase + [zoom, x, y + '.png'].join('/'));
    tiles.set(key, image.then(png => sharp(png).removeAlpha().raw().toBuffer()));
  }
  const pixels = await tiles.get(key);
  const offset = (Math.floor((pixelY - y) * 256) * 256 + Math.floor((pixelX - x) * 256)) * 3;
  const meters = pixels[offset] * 256 + pixels[offset + 1] + pixels[offset + 2] / 256 - 32768;
  return Math.round(Math.max(-20, meters));
}

// Each detail patch occupies whole regional cells so the boundaries can meet.
const areas = [
  ['bay', -122.62, 37.618, -122.12, 37.958, .002, 11],
  ['city', -122.466, 37.724, -122.374, 37.814, .0004, 13],
  ['islands', -122.38, 37.802, -122.354, 37.836, .00025, 14],
];
const grids = [];
for (const [name, west, south, east, north, step, zoom] of areas) {
  const cols = Math.round((east - west) / step) + 1;
  const rows = Math.round((north - south) / step) + 1;
  const bytes = Buffer.alloc(cols * rows * 2);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const elevation = await height(west + col * step, south + row * step, zoom);
      bytes.writeInt16LE(elevation, (row * cols + col) * 2);
    }
  }
  grids.push({ name, west, south, step, rows, cols, heights: bytes.toString('base64') });
}

const districts = [
  ['coit', '-122.409,37.799,-122.402,37.805'],
  ['bernal', '-122.421,37.739,-122.408,37.748'],
  ['islands', '-122.38,37.801,-122.351,37.835'],
  ['oakland', '-122.28,37.798,-122.265,37.812'],
];
const buildings = [], paths = [], cover = [], coasts = [], features = {};
const localRoads = new Set(['residential', 'tertiary', 'footway', 'path', 'steps', 'service', 'primary', 'secondary', 'motorway']);
const skylineRoads = new Set(['primary', 'secondary', 'tertiary', 'motorway']);
const parkTypes = new Set(['wood', 'scrub', 'grassland']);
const excludedBuildingTypes = new Set(['construction', 'roof', 'no']);
const round = value => Math.round(value * 1e6) / 1e6;
const waterfront = JSON.parse(await readFile(new URL('sf-waterfront.json', assets), 'utf8'));
const existing = new Set(waterfront.buildings.map(building => building.id));

for (const [name, bbox] of districts) {
  const { elements } = JSON.parse(await resource(name + '.json', osmMap(bbox)));
  const nodes = new Map(elements.filter(element => element.type === 'node').map(node => [node.id, [round(node.lon), round(node.lat)]]));
  const skyline = name === 'oakland';
  const roadTypes = skyline ? skylineRoads : localRoads;
  for (const way of elements.filter(element => element.type === 'way' && element.tags)) {
    const tags = way.tags;
    const points = way.nodes.map(id => nodes.get(id)).filter(Boolean);
    if (points.length < 2) continue;
    if (tags.name === 'Coit Tower' && tags.man_made === 'tower') {
      features.coit = points;
      features.coitHeight = Number(tags.height);
      continue;
    }
    const polygon = way.nodes[0] === way.nodes.at(-1) && points.length > 3;
    if (polygon && tags.natural === 'coastline') coasts.push(points);
    if (polygon && (tags.leisure === 'park' || parkTypes.has(tags.natural))) cover.push(points);
    if (polygon && tags.building && !excludedBuildingTypes.has(tags.building) && !existing.has(way.id)) {
      const meters = parseFloat(tags.height) || (Number(tags['building:levels']) || 2) * 3.2;
      if (skyline && meters >= 13) buildings.push([round(meters), points, 'oakland']);
      if (!skyline) buildings.push([round(Math.min(32, meters)), points]);
      existing.add(way.id);
    } else if (roadTypes.has(tags.highway) && !tags.tunnel && !tags.bridge) {
      paths.push([tags.highway, points]);
    }
  }
  const bernal = elements.find(element => element.type === 'node' && element.tags?.name === 'Bernal Hill');
  if (bernal) features.bernal = nodes.get(bernal.id);
}
if (!features.coit?.length || !Number.isFinite(features.coitHeight) || !features.bernal || !coasts.length) {
  throw new Error('OpenStreetMap response is missing a required Bay landmark.');
}

await writeFile(new URL('bay-relief.json', assets), JSON.stringify({
  elevationSource: 'Mapzen Terrarium via AWS Open Data',
  elevationSourceUrl: 'https://registry.opendata.aws/terrain-tiles/',
  elevationAttribution: 'U.S. Geological Survey terrain data and NOAA ETOPO1',
  elevationAttributionUrl: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
  mapSource: '© OpenStreetMap contributors',
  mapLicense: 'ODbL 1.0',
  mapLicenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  mapAttributionUrl: 'https://www.openstreetmap.org/copyright',
  mapSourceUrls: districts.map(([, bbox]) => osmMap(bbox)),
  grids, buildings, paths, cover, coasts, features,
}));
console.log(grids.map(grid => [grid.name, grid.cols, grid.rows]), buildings.length, paths.length, features.bernal);
