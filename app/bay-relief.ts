import {reliefCover} from './relief-cover.ts';
import {addWaterfrontPlaza,isWaterfrontPlazaFootprint} from './north-quay-inland.ts';
import {setPackedNormals} from './packed-normals.ts';
import * as THREE from 'three';
import {oaklandContainerCranes} from './oakland-cranes.ts';
import {distantEastSpan} from './east-span.ts';
import {distantGoldenGate} from './golden-gate.ts';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import reliefData from '../public/data/bay-relief.json' with { type: 'json' };
import { isTidalVertex, surveyedCoastalCells } from './survey-shore.ts';
import { waterSurface } from './water-surface.ts';

type Location = readonly [longitude: number, latitude: number];
type Grid = { name: string; west: number; south: number; step: number; cols: number; rows: number; heights: string };
type ReliefData = {
  grids: Grid[];
  buildings: [height: number, footprint: Location[], district?: 'oakland'][];
  paths: [kind: string, points: Location[]][];
  cover: Location[][];
  coasts: Location[][];
  features: { coit: Location[]; coitHeight: number; bernal: Location };
};
const data = reliefData as unknown as ReliefData;
const origin = [-122.39348, 37.79554] as const;
const horizontal = 111320 * Math.cos(THREE.MathUtils.degToRad(origin[1]));
const scale = .06;
const shoreHeight = waterSurface.level + .15;

/** The survey transform is shared with the mapped downtown and both Bay Bridge landfalls. */
export function bayReliefPosition(longitude: number, latitude: number): [number, number] {
  const east = (longitude - origin[0]) * horizontal;
  const north = (latitude - origin[1]) * 111320;
  return [-.03552029735 * east + .04836012986 * north, .04836012986 * east + .03552029735 * north];
}

function geographicPosition(x: number, z: number): Location {
  const east = (-.03552029735 * x + .04836012986 * z) / (scale * scale);
  const north = (.04836012986 * x + .03552029735 * z) / (scale * scale);
  return [origin[0] + east / horizontal, origin[1] + north / 111320];
}

function decodeGrid(grid: Grid) {
  const bytes = atob(grid.heights);
  const meters = new Int16Array(grid.cols * grid.rows);
  for (let i = 0; i < meters.length; i++) meters[i] = bytes.charCodeAt(i * 2) | (bytes.charCodeAt(i * 2 + 1) << 8);
  // A relief vertex is immutable, including the tidal and downtown adjustments.
  // Keep the exact double used by the renderer. All three grids total 856 KiB.
  const groundY=new Float64Array(meters.length).fill(NaN);
  return { ...grid, meters, groundY, parks:reliefCover(grid,data.cover), coasts:reliefCover(grid,data.coasts), east: grid.west + grid.step * (grid.cols - 1), north: grid.south + grid.step * (grid.rows - 1) };
}

type HeightGrid = ReturnType<typeof decodeGrid>;
const grids = data.grids.map(decodeGrid);
const [regional, ...detailed] = grids;
const detailPriority = [...detailed].reverse();
const inGrid = ({ west, east, south, north }: HeightGrid, lng: number, lat: number) =>
  lng >= west - 1e-8 && lng <= east + 1e-8 && lat >= south - 1e-8 && lat <= north + 1e-8;

function sample(grid: HeightGrid, lng: number, lat: number, value: (col: number, row: number) => number) {
  const u = THREE.MathUtils.clamp((lng - grid.west) / grid.step, 0, grid.cols - 1);
  const v = THREE.MathUtils.clamp((lat - grid.south) / grid.step, 0, grid.rows - 1);
  const col = Math.min(grid.cols - 2, Math.floor(u)), row = Math.min(grid.rows - 2, Math.floor(v));
  const x = u - col, y = v - row;
  const b = value(col + 1, row), c = value(col, row + 1);
  if (x + y <= 1) {
    const a = value(col, row);
    return a + (b - a) * x + (c - a) * y;
  }
  const d = value(col + 1, row + 1);
  return d + (c - d) * (1 - x) + (b - d) * (1 - y);
}

function meterHeight(grid: HeightGrid, col: number, row: number) {
  return grid.meters[row * grid.cols + col];
}

function elevation(grid: HeightGrid, lng: number, lat: number, col: number, row: number) {
  const raw = meterHeight(grid, col, row);
  if (grid === regional) return raw;
  const edge = Math.min(lat - grid.south, grid.north - lat, lng - grid.west, grid.east - lng);
  if (edge >= regional.step) return raw;
  // Finish a detail patch at the parent triangle height, even between parent vertices.
  const broad = sample(regional, lng, lat, (c, r) => meterHeight(regional, c, r));
  return THREE.MathUtils.lerp(broad, raw, THREE.MathUtils.smoothstep(edge, 0, regional.step));
}

function applicableGrid(lng: number, lat: number) {
  return detailPriority.find(grid => inGrid(grid, lng, lat)) ?? regional;
}

/** Elevation in metres above sea level, including the regional-to-local boundary blend. */
export function bayReliefElevation(longitude: number, latitude: number) {
  if (!inGrid(regional, longitude, latitude)) return null;
  const grid = applicableGrid(longitude, latitude);
  return sample(grid, longitude, latitude, (col, row) =>
    elevation(grid, grid.west + col * grid.step, grid.south + row * grid.step, col, row));
}

const [islandGrid] = detailed.slice(-1);

function surfaceVertex(grid: HeightGrid, col: number, row: number) {
  const lng = grid.west + col * grid.step, lat = grid.south + row * grid.step;
  const [x, z] = bayReliefPosition(lng, lat);
  const meters = elevation(grid, lng, lat, col, row);
  let y = waterSurface.level + meters * scale;
  if (inGrid(islandGrid, lng, lat)) {
    y = grid.coasts[row*grid.cols+col] ? Math.max(shoreHeight, y) : Math.min(y, waterSurface.level - .18);
  } else if (meters <= 0) {
    y = Math.min(y, waterSurface.level - .18);
  }
  // Downtown's detailed streets and landmarks share a level datum in the original map.
  const downtown = Math.min(x + 96, 67 - x, z + 99, 14 - z);
  // The fixed-height South Beach streets, Oracle Park and China Basin decks
  // share this grade. Raised regional relief must not break through the field.
  const southBeach=Math.min(x+137,-75-x,z+83,-12-z);
  const blend = THREE.MathUtils.smoothstep(Math.max(downtown,southBeach), -9, 0);
  if (meters > 0 || y > -.04) y = THREE.MathUtils.lerp(y, -.04, blend);
  if (isTidalVertex(grid.name, row * grid.cols + col)) y = Math.max(y, -.04);
  return { x, y, z, lng, lat, meters };
}

function groundVertex(grid:HeightGrid,col:number,row:number){
  const i=row*grid.cols+col,cached=grid.groundY[i];
  if(!Number.isNaN(cached))return cached;
  return grid.groundY[i]=surfaceVertex(grid,col,row).y;
}

function withinRing(points:number[][],x:number,z:number){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [ax,az]=points[j],[bx,bz]=points[i];
    if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
  }
  return inside;
}

function reliefGround(x:number,z:number,clip:boolean){
  const [lng, lat] = geographicPosition(x, z);
  const grid = applicableGrid(lng, lat);
  const u=THREE.MathUtils.clamp((lng-grid.west)/grid.step,0,grid.cols-1);
  const v=THREE.MathUtils.clamp((lat-grid.south)/grid.step,0,grid.rows-1);
  const col=Math.min(grid.cols-2,Math.floor(u)),row=Math.min(grid.rows-2,Math.floor(v));
  const cuts=clip?surveyedCoastalCells(grid.name)?.get(row*grid.cols+col):undefined;
  if(cuts&&!cuts[u-col+v-row<=1?0:1].some(([outer,...holes])=>
    withinRing(outer,x,z)&&!holes.some(ring=>withinRing(ring,x,z))))return waterSurface.level-.36;
  const dx=u-col,dz=v-row,b=groundVertex(grid,col+1,row),c=groundVertex(grid,col,row+1);
  if(dx+dz<=1){
    const a=groundVertex(grid,col,row);
    return a+(b-a)*dx+(c-a)*dz;
  }
  const d=groundVertex(grid,col+1,row+1);
  return d+(c-d)*(1-dx)+(b-d)*(1-dz);
}

/** Height along the surveyed bank, including its boundary. */
export function bayReliefBankHeight(x:number,z:number){return reliefGround(x,z,false);}

/** Local support height for paths, footprints and the bridge abutment. */
export function bayReliefGround(x:number,z:number){return reliefGround(x,z,true);}

class ColoredTriangles {
  readonly positions: number[] = [];
  readonly colors: number[] = [];

  vertex(x: number, y: number, z: number, color: THREE.Color) {
    this.positions.push(x, y, z);
    this.colors.push(color.r, color.g, color.b);
  }

  geometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    setPackedNormals(geometry);
    geometry.computeBoundingSphere();
    return geometry;
  }
}

const marsh = new THREE.Color('#84968b'), coastColor = new THREE.Color('#a9ad95');
const plain = new THREE.Color('#8a9f88'), slope = new THREE.Color('#698c79');
const summit = new THREE.Color('#a3a989'), built = new THREE.Color('#a29e93');
const park = new THREE.Color('#77956f');
function landColor({lng, lat, meters, x, z}: ReturnType<typeof surfaceVertex>, color: THREE.Color, inPark:number) {
  const variation = (Math.sin(x * .022 + z * .088) * Math.cos(x * .113 - z * .017) + 1) * .5;
  color.copy(plain).lerp(slope, variation * .65);
  color.lerp(summit, THREE.MathUtils.smoothstep(meters, 140, 320) * .65);
  color.lerp(marsh, (1 - THREE.MathUtils.smoothstep(meters, 0, 14)) * .58);
  if (inPark) color.lerp(park, .80);
  else {
    // Muted lowland tones behind the separately mapped neighborhoods.
    const westCity=(1-THREE.MathUtils.smoothstep(lng,-122.389,-122.377))*
      THREE.MathUtils.smoothstep(lat,37.70,37.72)*(1-THREE.MathUtils.smoothstep(lat,37.804,37.826));
    const eastCity=THREE.MathUtils.smoothstep(lng,-122.326,-122.314)*
      THREE.MathUtils.smoothstep(lat,37.71,37.73)*(1-THREE.MathUtils.smoothstep(lat,37.90,37.92));
    color.lerp(built,Math.max(westCity,eastCity)*(1-THREE.MathUtils.smoothstep(meters,32,125))*.77);
    if (lng > -122.38 && lng < -122.354 && lat > 37.814 && lat < 37.836 && meters < 12) {
      color.lerp(coastColor, .42);
    }
  }
  return color;
}

function* terrain(grid: HeightGrid, material: THREE.Material, shouldYield:()=>boolean) {
  const vertices = new Float32Array(grid.cols * grid.rows * 3);
  const colors = new Float32Array(vertices.length);
  const indices: number[] = [];
  const blockSize = grid === regional ? 44 : 60;
  const blocks = new Map<string, { index: number[]; bounds: THREE.Box3 }>();
  const position = new THREE.Vector3();
  const color = new THREE.Color();
  const cuts=surveyedCoastalCells(grid.name),nearshore=new ColoredTriangles();
  const shoreTint=new THREE.Color(),tintA=new THREE.Color(),tintB=new THREE.Color(),tintC=new THREE.Color();
  for (let i = 0; i < grid.cols * grid.rows; i++) {
    if(i%1024===0&&shouldYield())yield;
    const point = surfaceVertex(grid, i % grid.cols, Math.floor(i / grid.cols));
    vertices.set([point.x, point.y, point.z], i * 3);
    landColor(point, color, grid.parks[i]).toArray(colors, i * 3);
    grid.groundY[i]=point.y;
  }
  for (let row = 0; row < grid.rows - 1; row++) {
    if(row%4===0&&shouldYield())yield;
    for (let col = 0; col < grid.cols - 1; col++) {
      const lng = grid.west + (col + .5) * grid.step, lat = grid.south + (row + .5) * grid.step;
      if (applicableGrid(lng, lat) !== grid) continue;
      const a = row * grid.cols + col, b = a + 1, c = a + grid.cols, d = c + 1;
      const cut=cuts?.get(a);
      if(cut){
        for(const [half,[first,second,third]] of [[a,b,c],[b,d,c]].entries()){
          tintA.fromArray(colors,first*3);tintB.fromArray(colors,second*3);tintC.fromArray(colors,third*3);
          for(const [outer,...holes] of cut[half]){
            const path=(ring:number[][])=>ring.map(([x,z])=>new THREE.Vector2(x,-z));
            const border=path(outer),inners=holes.map(path);
            const faces=THREE.ShapeUtils.triangulateShape(border,inners);
            const points=[border,...inners].flat().map(({x,y})=>{
              const z=-y,[longitude,latitude]=geographicPosition(x,z);
              const u=(longitude-grid.west)/grid.step-col,v=(latitude-grid.south)/grid.step-row;
              const [w1,w2,w3]=half===0?[1-u-v,u,v]:[1-v,u+v-1,1-u];
              const height=w1*vertices[first*3+1]+w2*vertices[second*3+1]+w3*vertices[third*3+1];
              const tint=shoreTint.copy(tintA).multiplyScalar(w1);
              tint.r+=w2*tintB.r+w3*tintC.r;
              tint.g+=w2*tintB.g+w3*tintC.g;
              tint.b+=w2*tintB.b+w3*tintC.b;
              return {x,z,height,tint:tint.clone()};
            });
            for(const face of faces){
              if(face.every(i=>points[i].height<waterSurface.level-.15))continue;
              for(const i of face){
                const {x,z,height,tint}=points[i];
                nearshore.vertex(x,height,z,tint);
              }
            }
          }
        }
        continue;
      }
      if (Math.max(vertices[a * 3 + 1], vertices[b * 3 + 1], vertices[c * 3 + 1], vertices[d * 3 + 1]) < waterSurface.level - .15) continue;
      indices.push(a, b, c, b, d, c);
      const key = Math.floor(col / blockSize) + ',' + Math.floor(row / blockSize);
      let block = blocks.get(key);
      if (!block) blocks.set(key, block = { index: [], bounds: new THREE.Box3() });
      block.index.push(a, b, c, b, d, c);
      for (const corner of [a, b, c, d]) block.bounds.expandByPoint(position.fromArray(vertices, corner * 3));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  setPackedNormals(geometry);
  // Keep shared normals at tile boundaries while giving each surface tile its own culling bounds.
  const group = new THREE.Group();
  group.name = grid.name + ' elevation';
  if(nearshore.positions.length){
    const mesh=new THREE.Mesh(nearshore.geometry(),material);
    mesh.name='Survey-clipped coastal terrain';
    group.add(mesh);
  }
  for (const { index, bounds } of blocks.values()) {
    const tile = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) tile.setAttribute(name, attribute);
    tile.setIndex(index);
    tile.boundingBox = bounds;
    tile.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
    group.add(new THREE.Mesh(tile, material));
  }
  geometry.dispose();
  return group;
}

function ring(footprint: Location[]) {
  const points = footprint.slice(0,-1).map(p => new THREE.Vector2(...bayReliefPosition(...p)));
  return THREE.ShapeUtils.isClockWise(points) ? points : points.reverse();
}

function islandShore(material: THREE.Material) {
  const mesh = new ColoredTriangles();
  for (const footprint of data.coasts) {
    const points = ring(footprint);
    // A low exact shoreline underneath the DEM keeps the flat reclaimed land continuous.
    for (const face of THREE.ShapeUtils.triangulateShape(points, [])) {
      for (const index of [face[0], face[2], face[1]]) mesh.vertex(points[index].x, shoreHeight - .015, points[index].y, coastColor);
    }
  }
  const shore = new THREE.Mesh(mesh.geometry(), material);
  shore.name = 'OpenStreetMap island shoreline';
  return shore;
}

// Spatial batches let the renderer drop whole neighborhoods when the camera faces the Bay.
function spatialBatches(name: string, material: THREE.Material) {
  const batches = new Map<string, ColoredTriangles>();
  function at(x: number, z: number) {
    const key = Math.floor(x / 64) + ',' + Math.floor(z / 64);
    let batch = batches.get(key);
    if (!batch) batches.set(key, batch = new ColoredTriangles());
    return batch;
  }
  function group() {
    const root = new THREE.Group();
    root.name = name;
    for (const batch of batches.values()) root.add(new THREE.Mesh(batch.geometry(), material));
    return root;
  }
  return { at, group };
}

const facadeColors = ['#c3b6a2', '#a9aba0', '#b0a594', '#b3b7a8', '#c5b6a9'].map(color => new THREE.Color(color));
const roofColors = ['#9b9186', '#a49f95', '#9da49d', '#b29b8d'].map(color => new THREE.Color(color));
function* neighborhoods(material: THREE.Material, shouldYield:()=>boolean) {
  const buildings = spatialBatches('North Beach, Bernal Heights and island buildings', material);
  const skyline = spatialBatches('Downtown Oakland skyline', material);
  const skylineFacade = new THREE.Color('#9ba6aa'), skylineRoof = new THREE.Color('#a1a0a0');
  for(const [i,[meters,footprint,district]] of data.buildings.entries()){
    if(i%64===0&&shouldYield())yield;
    const points = ring(footprint);
    if (points.length < 3 || Math.abs(THREE.ShapeUtils.area(points)) < .025) continue;
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const z = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    const ground = bayReliefGround(x, z);
    if (ground < waterSurface.level + .08) continue;
    const oakland = district === 'oakland';
    const triangles = (oakland ? skyline : buildings).at(x, z);
    const roofY = ground + meters * scale;
    const wallColor = oakland ? skylineFacade : facadeColors[i % facadeColors.length];
    const roofColor = oakland ? skylineRoof : roofColors[i % roofColors.length];
    const waterfrontPlaza=isWaterfrontPlazaFootprint(...footprint[0]);
    if(waterfrontPlaza)addWaterfrontPlaza(triangles,points,ground,roofY,bayReliefGround);
    else {
      const floors = points.map(p => Math.min(ground - .10, bayReliefGround(p.x, p.y) - .09));
      for (let n = 0; n < points.length; n++) {
        const next = (n + 1) % points.length;
        const a = points[n], b = points[next];
        triangles.vertex(a.x, floors[n], a.y, wallColor);
        triangles.vertex(b.x, floors[next], b.y, wallColor);
        triangles.vertex(b.x, roofY, b.y, wallColor);
        triangles.vertex(a.x, floors[n], a.y, wallColor);
        triangles.vertex(b.x, roofY, b.y, wallColor);
        triangles.vertex(a.x, roofY, a.y, wallColor);
      }
    }
    for (const face of THREE.ShapeUtils.triangulateShape(points, [])) {
      for (const index of [face[0], face[2], face[1]]) triangles.vertex(points[index].x, roofY, points[index].y, roofColor);
    }
  }
  return [buildings.group(), skyline.group()];
}

type PathPoint=[x:number,y:number,z:number];
// Allow a submillimetre at the shared cut for Float32 positions far across the bay.
const roadCutMargin=.00005;
type PavedStrip={outline:PathPoint[];minX:number;maxX:number;minZ:number;maxZ:number};

// Subtract a clockwise convex road strip in plan. A split point retains the
// trail's interpolated elevation even where the relief changes slope.
function outsidePavement(trail:PathPoint[],outline:PathPoint[]){
  const remaining:PathPoint[][]=[];
  let inside=trail;
  for(let i=0;i<outline.length;i++){
    const start=outline[i],end=outline[(i+1)%outline.length];
    const dx=end[0]-start[0],dz=end[2]-start[2],margin=roadCutMargin*Math.hypot(dx,dz);
    const side=([x,,z]:PathPoint)=>dx*(z-start[2])-dz*(x-start[0])-margin;
    const inner:PathPoint[]=[],outer:PathPoint[]=[];
    for(let j=0;j<inside.length;j++){
      const a=inside[j],b=inside[(j+1)%inside.length],da=side(a),db=side(b);
      (da>0?outer:inner).push(a);
      if((da>0)!==(db>0)){
        const t=da/(da-db),cut:PathPoint=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])];
        inner.push(cut);outer.push(cut);
      }
    }
    if(outer.length>=3)remaining.push(outer);
    if(inner.length<3)return [trail];
    inside=inner;
  }
  return remaining;
}

function* streets(material: THREE.Material, shouldYield:()=>boolean) {
  const streets = spatialBatches('Mapped hill streets and park paths', material);
  const paved = new THREE.Color('#838c88'), trail = new THREE.Color('#b5ad91');
  const cells=new Map<string,PavedStrip[]>();
  for(const walking of [false,true])for (const [i,[kind,line]] of data.paths.entries()) {
    if(i%32===0&&shouldYield())yield;
    const foot = kind === 'footway' || kind === 'path' || kind === 'steps';
    if(walking!==foot)continue;
    const width = foot ? .055 : kind === 'motorway' || kind === 'primary' ? .36 : kind === 'service' ? .11 : .23;
    const color = foot ? trail : paved;
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = bayReliefPosition(...line[i-1]), [bx, bz] = bayReliefPosition(...line[i]);
      const length = Math.hypot(bx - ax, bz - az);
      if (length < .025) continue;
      const dx = (bx - ax) / length, dz = (bz - az) / length;
      const steps = Math.ceil(length / 1.35);
      for (let j = 0; j < steps; j++) {
        const s = length * j / steps, t = length * (j + 1) / steps;
        const sx = ax + dx * s, sz = az + dz * s, tx = ax + dx * t, tz = az + dz * t;
        const y1 = bayReliefGround(sx, sz), y2 = bayReliefGround(tx, tz);
        if (Math.min(y1, y2) < waterSurface.level + .07) continue;
        const roads = streets.at(sx, sz);
        const lx = dz * width / 2, lz = -dx * width / 2;
        const outline:PathPoint[]=[[sx-lx,y1+.055,sz-lz],[tx-lx,y2+.055,tz-lz],[tx+lx,y2+.055,tz+lz],[sx+lx,y1+.055,sz+lz]];
        const pad=foot?roadCutMargin:0;
        const minX=Math.min(sx,tx)-Math.abs(lx)-pad,maxX=Math.max(sx,tx)+Math.abs(lx)+pad;
        const minZ=Math.min(sz,tz)-Math.abs(lz)-pad,maxZ=Math.max(sz,tz)+Math.abs(lz)+pad;
        const strip={outline,minX,maxX,minZ,maxZ},crossings=new Set<PavedStrip>();
        for(let x=Math.floor(minX/2);x<=Math.floor(maxX/2);x++)for(let z=Math.floor(minZ/2);z<=Math.floor(maxZ/2);z++){
          const key=x+','+z,neighbors=cells.get(key);
          if(foot){
            for(const n of neighbors??[])if(n.minX<maxX&&n.maxX>minX&&n.minZ<maxZ&&n.maxZ>minZ)crossings.add(n);
          }else if(neighbors)neighbors.push(strip);else cells.set(key,[strip]);
        }
        let exposed=[outline];
        for(const crossing of crossings)exposed=exposed.flatMap(piece=>outsidePavement(piece,crossing.outline));
        for(const piece of exposed)for(let k=1;k+1<piece.length;k++){
          roads.vertex(...piece[0],color);roads.vertex(...piece[k],color);roads.vertex(...piece[k+1],color);
        }
      }
    }
  }
  return streets.group();
}

function coitTower(material: THREE.MeshStandardMaterial, recess: THREE.MeshStandardMaterial) {
  const footprint = ring(data.features.coit);
  const x = footprint.reduce((sum, p) => sum + p.x, 0) / footprint.length;
  const z = footprint.reduce((sum, p) => sum + p.y, 0) / footprint.length;
  const tower = new THREE.Group();
  tower.name = 'Coit Tower';
  tower.position.set(x, bayReliefGround(x, z) - .03, z);
  function cylinder(top: number, bottom: number, height: number, at: number) {
    const part = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 16), material);
    part.position.y = at + height / 2;
    tower.add(part);
  }
  const height = data.features.coitHeight * scale;
  const apron = new THREE.ExtrudeGeometry(new THREE.Shape(footprint.map(p => new THREE.Vector2(p.x - x, z - p.y))), {
    depth:.24, bevelEnabled: false,
  });
  apron.rotateX(-Math.PI / 2);
  const base = new THREE.Mesh(apron, material);
  base.position.y = -.04;
  tower.add(base);
  cylinder(.43, .48, .34, .15);
  cylinder(.27, .39, height - 1.03, .44);
  cylinder(.291, .272, .08, height - .59);
  cylinder(.29, .29, .44, height - .51);
  cylinder(.253, .30, .075, height - .075);
  const bays = new THREE.BoxGeometry(.075,.27,.012);
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8;
    const window = new THREE.Mesh(bays, recess);
    window.position.set(Math.sin(angle) * .288, height - .28, Math.cos(angle) * .288);
    window.rotation.y = angle;
    tower.add(window);
  }
  for (const mat of [material, recess]) {
    const parts = tower.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh && child.material === mat);
    const originalGeometries = new Set(parts.map(part => part.geometry));
    const copies = parts.map(part => {
      part.updateMatrix();
      const copy = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      return copy.applyMatrix4(part.matrix);
    });
    const combined = mergeGeometries(copies);
    if (!combined) throw new Error('Unable to merge Coit Tower geometry');
    tower.remove(...parts);
    tower.add(new THREE.Mesh(combined, mat));
    for (const geo of [...copies, ...originalGeometries]) geo.dispose();
  }
  return tower;
}

// The scene follows a short portion of OAK's runway 12 final over the Bay.
const runway12Threshold: Location = [-(122 + 14 / 60 + 31.6144 / 3600), 37 + 43 / 60 + 12.2254 / 3600];
const runway12Course = THREE.MathUtils.degToRad(130);
const runway12Slope = Math.tan(THREE.MathUtils.degToRad(2.75));
const nauticalMile = 1852;
const approachSpeed = 150 * nauticalMile / 3600;
const approachStart = 7.7 * nauticalMile;
const approachLength = 2 * nauticalMile;
const approachDuration = approachLength / approachSpeed;

function approachPoint(distance: number) {
  const [lng, lat] = runway12Threshold;
  const longitude = lng - Math.sin(runway12Course) * distance / horizontal;
  const latitude = lat - Math.cos(runway12Course) * distance / 111320;
  const [x, z] = bayReliefPosition(longitude, latitude);
  // The ILS crosses the 8.3-foot threshold at 55 feet above it.
  const y = waterSurface.level + ((8.3 + 55) * .3048 + distance * runway12Slope) * scale;
  return new THREE.Vector3(x, y, z);
}

const startApproach = approachPoint(approachStart);
const endApproach = approachPoint(approachStart - approachLength);
const approachDirection = endApproach.clone().sub(startApproach);

function airplane(material: THREE.MeshStandardMaterial) {
  const model = new THREE.Group();
  model.name = 'Distant passenger airplane';
  const fuselage = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
  fuselage.scale.set(1.19, .11, .13);
  model.add(fuselage);
  const wingShape = new THREE.Shape();
  wingShape.moveTo(.44, 0); wingShape.lineTo(-.33, 1.19); wingShape.lineTo(-.57, 1.12);
  wingShape.lineTo(-.26, 0); wingShape.lineTo(-.57,-1.12); wingShape.lineTo(-.33,-1.19);
  wingShape.closePath();
  const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(wingShape, {depth:.022, bevelEnabled:false}), material);
  wing.rotation.x = -Math.PI / 2;
  model.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(.31,.018,.8), material);
  tail.position.set(-.86,.045,0);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(.28,.31,.025), material);
  fin.position.set(-.88,.17,0);
  fin.rotation.z = .26;
  model.add(tail, fin);
  model.visible = false;
  return model;
}

export function* bayReliefStages(shouldYield:()=>boolean) {
  const root = new THREE.Group();
  root.name = 'San Francisco Bay relief';
  const horizon = { value: new THREE.Color('#e2dfcc').convertLinearToSRGB() };
  const mistAmount = { value: 0 };
  const visibilityFalloff = { value: 0 };
  const nightAmount = { value: 0 };

  function material(options: THREE.MeshStandardMaterialParameters, start: number, coastal = false) {
    const mat = new THREE.MeshStandardMaterial({ ...options, roughness: .93, fog: false });
    mat.onBeforeCompile = shader => {
      shader.uniforms.reliefHorizon = horizon;
      shader.uniforms.reliefMist = mistAmount;
      shader.uniforms.reliefVisibilityFalloff = visibilityFalloff;
      shader.uniforms.reliefNight = nightAmount;
      if (coastal) {
        shader.vertexShader = 'varying float reliefHeight;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          reliefHeight = position.y - (${waterSurface.level.toFixed(7)});
        `);
      }
      shader.fragmentShader = `
        uniform vec3 reliefHorizon;
        uniform float reliefMist, reliefNight, reliefVisibilityFalloff;
        ${coastal ? 'varying float reliefHeight;' : ''}
      ` + shader.fragmentShader.replace('#include <fog_fragment>', `
        float depth = length(vViewPosition);
        float aerial = 1. - exp(-max(0.,depth - ${start.toFixed(1)}) * mix(.0009, .0022, reliefMist));
        float fade = max(aerial * mix(.89, .67, reliefNight), smoothstep(1120.,1450.,depth));
        fade = max(fade, 1. - exp(-max(0., depth-12.) * reliefVisibilityFalloff));
        ${coastal ? `
          float lowShore = 1. - smoothstep(.06, .55, reliefHeight);
          float coastalAir = smoothstep(120., 445., depth) * lowShore;
          fade = mix(fade, 1., coastalAir * mix(.18,.76,smoothstep(.0005,.009,reliefVisibilityFalloff)));
        ` : ''}
        gl_FragColor.rgb = mix(gl_FragColor.rgb, reliefHorizon, fade);
      `);
    };
    mat.customProgramCacheKey = () => `bay-relief-${start}-${coastal}`;
    return mat;
  }

  // The strait is west-northwest of the Ferry Building. Both the terrain's
  // depth buffer and the same marine visibility field can hide the steel.
  root.add(distantGoldenGate(bayReliefPosition,waterSurface.level,material({color:'#ac7969'},16)));
  root.add(distantEastSpan(bayReliefPosition,waterSurface.level,material({vertexColors:true},16)));
  const ground = material({vertexColors:true}, 85, true);
  const masonry = material({vertexColors:true}, 105);
  root.add(oaklandContainerCranes(bayReliefPosition,bayReliefGround,masonry));
  const concrete = material({color:'#e4dac2'}, 110);
  const slit = material({color:'#657579'}, 110);
  for(const grid of grids)root.add(yield* terrain(grid,ground,shouldYield));
  root.add(islandShore(ground));
  root.add(...yield* neighborhoods(masonry,shouldYield));
  root.add(yield* streets(ground,shouldYield));
  root.add(coitTower(concrete, slit));
  const aircraftPaint = material({ color:'#d1d9d8', emissive:'#b8c6cf', emissiveIntensity:.10,
    transparent:true, depthWrite:false }, 160);
  const plane = airplane(aircraftPaint);
  plane.rotation.set(0, -Math.atan2(approachDirection.z, approachDirection.x),
    Math.atan2(approachDirection.y, Math.hypot(approachDirection.x, approachDirection.z)), 'YXZ');
  root.add(plane);
  function update(time: number, night: number, mist: number, horizonColor?: THREE.Color, visibilityRange=465) {
    nightAmount.value = THREE.MathUtils.clamp(night, 0, 1);
    mistAmount.value = THREE.MathUtils.clamp(mist, 0, 1);
    visibilityFalloff.value = 2.8 * Math.max(0, 1 / Math.max(28, visibilityRange) - 1 / 465);
    if (horizonColor) horizon.value.copy(horizonColor);
    const approachTime = time % 210 - 18;
    plane.visible = approachTime > 0 && approachTime < approachDuration;
    if (plane.visible) {
      plane.position.lerpVectors(startApproach, endApproach, approachTime / approachDuration);
      aircraftPaint.opacity = THREE.MathUtils.smoothstep(approachTime, 0, 3) *
        THREE.MathUtils.smoothstep(approachDuration - approachTime, 0, 3);
    }
  }
  return { root, update };
}

export function createBayRelief(){
  const stages=bayReliefStages(()=>false);
  let next=stages.next();
  while(!next.done)next=stages.next();
  return next.value;
}
