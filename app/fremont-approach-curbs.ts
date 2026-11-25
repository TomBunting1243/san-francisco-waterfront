import paving from '../public/data/fremont-approach-curbs.json' with {type:'json'};

type Point=[number,number,number];
type Tile={vertices(points:Point[],color:string):number;indices:number[];roadClass:number};
const tint:Record<string,string>={face:'#aeaa9f',cap:'#d2cdc0',shoulder:'#c7c1b1',warning:'#c0a16b',joint:'#aca89c',walk:'#c7c3b7'};
const remainder:Record<string,number[][][][]>=paving.remainder;

// The two surveyed approach strips previously supplied plan-view caps only.
// Sections follow the existing road boundary. The shoulder meets sidewalk
// grade, the 15 cm stone face drops to asphalt, and the four corner mouths
// descend through flared wings. City 8 cm imagery resolves the ochre strips
// but not the individual domes. Scene scale is .06 per metre.
export function fremontPavingRemainder(kind:string,index:number){
  return remainder[kind+index];
}
export function addFremontApproachCurbs(tile:Tile){
  const points:Point[]=paving.vertices.map(([u,v,y])=>[
    -27.00800104+.0012973094*u-.0084729829*v,
    y,
    -33.37263659+.0084728164*u+.0012965840*v,
  ]);
  // These paved edges sit beneath the same SFPUC standards as the asphalt.
  // Use the existing measured lamp atlas and the passenger headlights.
  const prior=tile.roadClass;tile.roadClass=1;
  for(const [surface,faces] of Object.entries(paving.faces)){
    const local=new Map<number,number>(),vertices:Point[]=[];
    for(const id of faces){
      if(local.has(id))continue;
      local.set(id,vertices.length);vertices.push(points[id]);
    }
    const first=tile.vertices(vertices,tint[surface]);
    for(const id of faces)tile.indices.push(first+local.get(id)!);
  }
  tile.roadClass=prior;
}
