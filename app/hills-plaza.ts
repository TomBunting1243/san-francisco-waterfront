import type {mappedBuildings} from './sf-map.ts';
// City SF16 footprint 201006.0000159 and the registered 2024 p2024_rgb8cm
// orthophoto. The 2 Harrison frontage ends before the low public arcade.
// SF Planning 2011.0417A documents the six-story roasting plant, setback
// penthouse, gravel roof and parapet. 345 Spear occupies the other side of the
// midblock passage (2011.0422C), with its residential tower on the Spear side.
const plate=(u:number,v:number)=>[-49+u*1750/(1150*132),2-(657+v*1750/1150)/132];
const ring=(p:number[][])=>[...p,p[0]];
const traced=(uv:number[][])=>ring(uv.map(([u,v])=>plate(u,v)));
function building(id:number,name:string,p:number[][],h:number,minH=0):typeof mappedBuildings[number]{
  return {id,name,p,h,minH,glass:false,measured:true};
}
export const hillsPlant=building(-157,'Hills Bros Coffee',ring([
  [-47.064,-3.837],[-44.564,-4.212],[-45.248,-8.738],[-47.78,-8.36]]),1.505);
export const hillsSign={point:plate(254,158),width:2.28};
export const hillsArcade=[[-44.564,-4.212],[-42.087,-4.584]];
// Suite 100 opens through the two stepped walls at the Folsom end of the arcade.
export const hillsPalomino={x:-41.38,z:-5.24,y:.129,yaw:Math.atan2(.372,2.477)};
export const terraceDoors=[[-41.673,-5.208],[-41.349,-4.990]];
export function patioPoint(u:number,v:number){
  const {x,z,yaw}=hillsPalomino;
  return [x+u*Math.cos(yaw)+v*Math.sin(yaw),z-u*Math.sin(yaw)+v*Math.cos(yaw)];
}
// Continuous paving between the public stair landing and the dining pocket.

export const hillsCourt=ring([[-44.59,-4.52],patioPoint(-.80,.24),patioPoint(-.80,.84),patioPoint(.01,.84),[-41.29,-4.70],[-41.38,-5.24],[-41.92,-5.17],[-41.992,-5.70],
  [-42.55,-5.63],[-42.64,-6.17],[-43.185,-6.094],[-43.54,-8.36],[-42.71,-8.46],[-42.82,-9.29],
  [-43.28,-9.21],[-43.24,-9.0],[-42.82,-9.06],[-42.76,-8.71],[-45.18,-8.34],
  [-44.99,-7.1],[-44.15,-7.22],[-44.01,-6.32],[-44.85,-6.19]]);
export const hillsAtrium=traced([[646,339],[824,363],[816,421],[636,396]]);
const plazaPlan=ring([[-41.992,-5.700],[-42.550,-5.629],[-42.638,-6.167],[-43.185,-6.094],
  [-43.54,-8.36],[-42.710,-8.460],[-42.820,-9.290],[-40.560,-9.620],[-40.530,-9.370],
  [-39.570,-9.530],[-39.590,-9.780],[-37.840,-10.030],[-37.570,-8.300],[-37.860,-8.250],
  [-37.830,-8.080],[-37.690,-8.100],[-37.590,-7.470],[-37.760,-7.440],[-37.750,-7.310],
  [-37.420,-7.340],[-37.090,-5.050],[-39.090,-4.750],[-39.130,-5.020],[-39.570,-4.960],
  [-39.530,-4.690],[-40.710,-4.510],[-40.750,-4.780],[-41.290,-4.700],[-41.380,-5.240],[-41.920,-5.170]]);
// 2023 USGS 3DEP roof medians from ~29 m at the bay podium up to 64 m NAVD88 on the tower.
export const hillsBuildings=[
  hillsPlant,
  building(-158,'2 Harrison rooftop penthouse',traced([[167,165],[351,192],[315,408],[125,381]]),1.75,1.505),
  building(-345,'345 Spear Street',plazaPlan,1.52),
  building(-346,'345 Spear office penthouse',traced([[709,224],[807,239],[798,304],[696,290]]),1.8,1.52),
  building(-347,'345 Spear stepped roof',traced([[877,335],[981,351],[966,453],[862,437]]),2.23,1.52),
  building(-348,'345 Spear residential terraces',traced([[878,382],[979,397],[968,461],[868,447]]),2.59,2.23),
  building(-349,'345 Spear terrace',ring([[-42.68,-8.18],[-40.76,-8.47],[-40.91,-9.48],[-42.84,-9.19]]),2.17,1.52),
];
