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
// SF Public Works RX-6, sheet note 5 and details 3/4 (effective April 2017).
// The grade axes are least-squares fits through each warning's surveyed
// high/low edges in the 7 px/m plate. A single basis per mouth preserves
// alignment at facet seams, including the curved corner transitions.
// https://sfpublicworks.org/sites/default/files/RX-6_0.pdf
const warningAxes=[
  [31.8855,297.0327,-.178244,.983986],[48.8771,310.5492,-.994267,.106926],
  [208.2269,297.4672,.310957,.950424],[195.5153,309.4385,.951267,.308368],
];
const pitchPixels=.0254*1.66*7;
export function addFremontApproachCurbs(tile:Tile,warningTile:Tile){
  const warningUV:number[]=[];
  const points:Point[]=paving.vertices.map(([u,v,y])=>[
    -27.00800104+.0012973094*u-.0084729829*v,
    y,
    -33.37263659+.0084728164*u+.0012965840*v,
  ]);
  // These paved edges sit beneath the same SFPUC standards as the asphalt.
  // Use the existing measured lamp atlas and the passenger headlights.
  const prior=tile.roadClass;tile.roadClass=1;warningTile.roadClass=1;
  for(const [surface,faces] of Object.entries(paving.faces)){
    const local=new Map<number,number>(),vertices:Point[]=[];
    for(const id of faces){
      if(local.has(id))continue;
      local.set(id,vertices.length);vertices.push(points[id]);
      if(surface==='warning'){
        const [u,v]=paving.vertices[id],i=(u>100?2:0)+(v>303?1:0);
        const [x,y,dx,dy]=warningAxes[i],a=u-x,b=v-y;
        // Ordinary pavement UVs elsewhere span less than 1000 panels.
        warningUV.push(2048+(a*dx+b*dy)/pitchPixels,(b*dx-a*dy)/pitchPixels);
      }
    }
    const target=surface==='warning'?warningTile:tile;
    const first=target.vertices(vertices,tint[surface]);
    for(const id of faces)target.indices.push(first+local.get(id)!);
  }
  tile.roadClass=prior;return warningUV;
}
