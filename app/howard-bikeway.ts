import * as THREE from 'three';
import {addHowardBoardingIsland} from './howard-boarding-island.ts';
import {createHowardBikeRacks} from './ferry-bike-racks.ts';
import {setPackedNormals} from './packed-normals.ts';

type Point=[number,number];
const C=.988686,S=.150004;
// Registered SF 2024 8 cm orthophoto: (300,1400) = Howard/Spear at 200 px/unit.
// The 2020 SFMTA quick-build installed the westbound north-side bikeway.
// https://www.sfmta.com/projects/howard-street-quick-build-project
// The 2019 hearing order identifies the Main turn lane and Spear boarding island.
// https://www.sfmta.com/media/20182/download?inline=
const asphaltPaint=.03124;
const white=new THREE.Color('#dedbd0'),yellow=new THREE.Color('#ddbd64'),green=new THREE.Color('#749580');

// y, outer buffer stripe centre, stripe adjoining the green lane, curbside
// edge of green. Both street ends follow the joining gutter wings. In the
// center the asphalt width comes from the 2024 orthophoto registration.
const profiles=[
  [1568,367,384,393.5],[1593,368,389.0,411.4],[1630,369.5,390.0,413.9],
  [1742,374.5,390.6,414.3],[1938,372.3,390.0,414.1],[2050,370.8,389.8,414.4],
  [2207,370.2,389.6,414.0],[2418,370.0,389.6,414.2],[2515,370.1,389.7,414.0],
  [2540,370.1,389.7,401.7],
];
const hatchCenters=[1773,1810,1846,1884,1920,1956,1993,2030,2067,2103,2140,2177,2214,2250,2288,2324,2360,2397,2434,2530];
const profile=(y:number,column:number)=>{
  const i=profiles.findIndex(p=>p[0]>=y);
  if(i<=0)return profiles[i===0?0:profiles.length-1][column];
  const a=profiles[i-1],b=profiles[i];
  return THREE.MathUtils.lerp(a[column],b[column],(y-a[0])/(b[0]-a[0]));
};

/** One static mesh. Adjacent paint regions meet at their boundaries, including
 * the gaps for hatching and the two yield teeth cut out of the green surface. */
export function addHowardBikeway(root:THREE.Group){
  const xyz:number[]=[],rgb:number[]=[],indices:number[]=[];
  function polygon(outline:Point[],color:THREE.Color,holes:Point[][]=[]){
    const vertex=(p:Point)=>new THREE.Vector2(...p);
    const outer=outline.map(vertex),inner=holes.map(r=>r.map(vertex));
    const vertices=[...outer,...inner.flat()],start=xyz.length/3;
    for(const p of vertices){
      const u=(p.x-300)/200,v=(p.y-1400)/200;
      xyz.push(-25.894+C*u+S*v,asphaltPaint,-12.65-S*u+C*v);
      rgb.push(color.r,color.g,color.b);
    }
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(outer,inner)){
      const n=(vertices[b].y-vertices[a].y)*(vertices[c].x-vertices[a].x)
        -(vertices[b].x-vertices[a].x)*(vertices[c].y-vertices[a].y);
      indices.push(start+a,start+(n>0?b:c),start+(n>0?c:b));
    }
  }
  function band(path:Point[],width:number,color:THREE.Color,offset=0){
    // Same transverse section on both sides of each bend: no overlapping caps.
    polygon([...path.map(([x,y]):Point=>[x+offset-width/2,y]),
      ...path.slice().reverse().map(([x,y]):Point=>[x+offset+width/2,y])],color);
  }
  // Double yellow follows the observed offset east of the Spear turn pocket.
  for(const [path,spacing] of [
    [[[314.0,255],[315.8,602],[315.1,923],[315.8,1248]],1.33],
    [[[277.8,1597],[277.4,1737],[279.3,1775],[293.3,1897],[295.6,1931],[294.7,2228],[295.7,2515]],1.48],
  ] as [Point[],number][]){
    for(const sign of [-1,1])band(path,1.30,yellow,sign*spacing);
  }
  // West block. The Main end separates the through movement from the
  // right-turn pocket. The measured plain-asphalt lane has interrupted edges;
  // its two boundaries turn diagonally towards the curb near Spear.
  for(const [y0,y1,left,right] of [[254,411,356.5,370.8],[511,540,356.0,370.3],
    [568,604,355.7,370.1],[640,684,354.2,369.4],[720,762,353.1,369.3],
    [782,803,353.0,369.5]]){
    band([[left,y0],[left-.15,y1]],1.6,white);
    band([[right,y0],[right-.1,y1]],1.6,white);
  }
  band([[353,805],[353,868]],1.6,white);
  band([[370.2,853],[370.2,919],[383.8,961],[402.6,1014]],1.60,white);
  band([[353.3,904],[353.2,919],[371,977],[400,1068]],1.65,white);
  band([[354.3,1008],[352.9,1095],[353.4,1248]],1.7,white);
  band([[372.5,534],[399.5,490]],1.8,white);
  // The edge continuing under the near-Spear crown is reliably visible again
  // just before the marked crossing. Keep it on the asphalt side of the gutter.
  band([[400.2,1224],[400.2,1247]],1.5,white);

  const stops=(a:number,b:number)=>[a,...profiles.map(p=>p[0]).filter(y=>y>a&&y<b),b];
  const edge=(y:number,col:number,offset=0):Point=>[profile(y,col)+offset,y];
  const stripe=(a:number,b:number,col:number)=>band(stops(a,b).map(y=>edge(y,col)),1.7,white);
  // The platform's concrete surface is excluded. Only the green bicycle route
  // on its curb side and the visible line at that edge enter this layer.
  stripe(1570,1737,2);
  for(const [a,b] of [[1742,2039],[2049,2540]])stripe(a,b,1);
  for(const [a,b] of [[1742,2036],[2075,2540]])stripe(a,b,2);

  for(const y of hatchCenters){
    // Oblique hatch ends stop at the inner edges of the white border strips.
    const left=(v:number)=>edge(v,1,.85),right=(v:number)=>edge(v,2,-.85);
    polygon([left(y+7.6),left(y+10),right(y-6.8),right(y-9.2)],white);
  }
  const fraction=(y:number,t:number):Point=>{
    const l=profile(y,2)+.85;return [THREE.MathUtils.lerp(l,profile(y,3),t),y];
  };
  const teeth:Point[][]=[.28,.73].map(t=>[fraction(2112,t-.16),fraction(2112,t+.16),fraction(2121,t)]);
  for(const [a,b] of [[1570,1737],[1742,2036],[2075,2539]]){
    const ys=stops(a,b),ring=[...ys.map(y=>edge(y,2,.85)),...ys.reverse().map(y=>edge(y,3))];
    polygon(ring,green,a===2075?teeth:[]);
  }
  teeth.forEach(t=>polygon(t,white));
  // Midblock pedestrian crossing of the bike lane and upstream yield marking.
  for(const t of [.13,.60]){
    polygon([fraction(2039,t-.07),fraction(2039,t+.07),fraction(2072,t+.07),fraction(2072,t-.07)],white);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));geometry.setIndex(indices);
  geometry.userData.paintVertices=true;geometry.userData.roadPaint='Waterfront crossings';setPackedNormals(geometry);
  const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98}));
  m.name='Howard north-side bikeway and centerlines';m.receiveShadow=true;m.userData.roadExposure=1;
  root.add(m,createHowardBikeRacks());addHowardBoardingIsland(root);return m;
}
