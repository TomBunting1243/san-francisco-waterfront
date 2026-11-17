// Compile the small, offline SoMa section from a saved public OSM API response.
// curl -fL 'https://api.openstreetmap.org/api/0.6/map.json?bbox=-122.413,37.7715,-122.390,37.790' -o soma.osm.json
// node scripts/import-approach.mjs soma.osm.json
import {readFile,writeFile} from 'node:fs/promises';

const source='https://api.openstreetmap.org/api/0.6/map.json?bbox=-122.413,37.7715,-122.390,37.790';
if(!process.argv[2]) throw new Error('Supply the saved SoMa OSM map response.');
const {elements}=JSON.parse(await readFile(process.argv[2],'utf8'));
const map=JSON.parse(await readFile(new URL('../public/data/sf-waterfront.json',import.meta.url),'utf8'));
const [latitude,longitude]=map.origin;
const nodes=new Map(elements.filter(o=>o.type==='node').map(node=>[node.id,node]));
const ways=new Map(elements.filter(o=>o.type==='way').map(way=>[way.id,way]));
const round=v=>Math.round(v*10000)/10000;
const project=({lat,lon})=>{
  const east=(lon-longitude)*111320*Math.cos(latitude*Math.PI/180),north=(lat-latitude)*111320;
  return [round(-.03552029735*east+.04836012986*north),round(.04836012986*east+.03552029735*north)];
};
const position=id=>{
  const node=nodes.get(id);
  if(!node) throw new Error('Missing mapped node '+id);
  return project(node);
};
const bridgeOrigin=[-58.2973,-22.6527];
function route(name,ids,bridge=false) {
  const points=[];
  let last;
  for(const id of ids){
    const way=ways.get(Math.abs(id));
    if(!way)throw new Error('Missing mapped way '+id);
    const chain=id>0?way.nodes:[...way.nodes].reverse();
    if(last!==undefined&&chain[0]!==last)throw new Error(name+' has an unconnected way '+id);
    const lanes=+way.tags.lanes||1;
    for(const node of chain)if(node!==last)points.push([...position(node),lanes]);
    last=chain.at(-1);
  }
  if(bridge){
    const [x,z]=points[0];
    if(Math.hypot(x-bridgeOrigin[0],z-bridgeOrigin[1])<1)points.shift();
    points.unshift([...bridgeOrigin,5]);
  }
  return {name,ways:ids.map(Math.abs),points};
}

const west=route('I-80 West',[1343738800,120813417,202485364,1343730967,617730080,510583844,845978827,31129732,254299122,1343735695],true);
const east=route('I-80 East',[-739661211,-661905443,-123741452,-839972870,-31129771,-513706009,-394443189,-394443187,-859701761,-394443190,-394443188,-123741454,-123741465,-617730081],true);
const ramps=[
  route('Harrison Street exit',[31129372,60319196,394443197,513707464]),
  route('Fremont Street exit',[619027325,110361656,417400771,111319423,27397919,712552382,667824727]),
  route('First Street entrance',[1021031302,468201421]),
  route('Sterling Street entrance',[397094812,175354957,423425773,397094805,397094807,839972871,661905445,179235237]),
  route('Fifth Street exit',[8915062,417400772,839813778,28824888,394443192]),
  route('Fifth Street entrance',[8915151,31609103,876616474]),
  route('Fourth Street exit',[8915415,754401925,754401924,31560837,754401923]),
  route('Fourth Street entrance',[394443195,26779600,839813777,1118881224,394443196,28825281]),
  route('Seventh Street exit',[8915117,8915115,1064362373]),
  route('Seventh Street entrance',[8915123,1161024302,27093144]),
  route('Ninth Street exit',[26779355,394443194,8915704,394443198,525662692]),
];
const existing=new Set(map.buildings.map(building=>building.id));
const supportBuildings=new Set([243353690,243353706]);
const corridors=[west,east,...ramps];
function corridorDistance(x,z){
  let distance=Infinity;
  for(const {points} of corridors)for(let i=1;i<points.length;i++){
    const [ax,az]=points[i-1],[bx,bz]=points[i],dx=bx-ax,dz=bz-az;
    const u=Math.min(1,Math.max(0,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));
    distance=Math.min(distance,Math.hypot(x-ax-u*dx,z-az-u*dz));
  }
  return distance;
}
const buildings=[];
const roads=[];
const streetTypes=new Set(['primary','secondary','tertiary','residential','unclassified']);
for(const way of ways.values()){
  const tags=way.tags||{};
  const box={west:-92,east:-43,near:-27,far:-155};
  if(!tags.building&&!streetTypes.has(tags.highway))continue;
  if(way.nodes.some(node=>!nodes.has(node)))continue;
  const points=way.nodes.map(position);
  const [x,z]=points.reduce(([x,z],[a,b])=>[x+a/points.length,z+b/points.length],[0,0]);
  if(x<box.west||x>box.east||z<box.far||z>box.near||(x< -81&&z> -112))continue;
  if(!supportBuildings.has(way.id)&&corridorDistance(x,z)>(tags.building?13.5:15.5))continue;
  if(tags.building&&way.nodes[0]===way.nodes.at(-1)){
    if(existing.has(way.id)&&!supportBuildings.has(way.id))continue;
    const area=Math.abs(points.slice(1).reduce((sum,[x,z],i)=>sum+points[i][0]*z-points[i][1]*x,0))*.5;
    if(area<.29)continue;
    const height=parseFloat(tags.height)||(+tags['building:levels']||(tags.building==='house'?2:1.8))*3.25;
    const kind=tags.building==='parking'?'garage':tags.building==='industrial'||height<=7?'workshop':'block';
    buildings.push({id:way.id,name:tags.name??'',height:round(height*.06),kind,points});
  }else if(streetTypes.has(tags.highway)&&!tags.tunnel&&!tags.bridge){
    // Existing street geometry already covers most of the blocks east of Fourth.
    if(z> -89)continue;
    const name=tags.name??'';
    if(!name)continue;
    roads.push({name,points:points.filter(([,z])=>z< -86&&z> -155),width:tags.highway==='primary'?.88:tags.highway==='secondary'?.71:tags.highway==='tertiary'?.63:.44});
  }
}

await writeFile(new URL('../public/data/approach-soma.json',import.meta.url),JSON.stringify({
  source:'© OpenStreetMap contributors',license:'ODbL 1.0',sourceUrl:source,
  west,east,ramps,buildings,roads:roads.filter(road=>road.points.length>1),
}));
console.log('Mainline nodes',west.points.length,east.points.length,'Ramplines',ramps.length,'Buildings',buildings.length,'Street ways',roads.length);
