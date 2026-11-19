import survey from '../public/data/rincon-curb-edge.json' with {type:'json'};

export const rinconGardenBorder=survey.garden;
export const rinconTerrace=survey.terrace;
type Vertex=[number,number,number];
type Tile={quad:(a:Vertex,b:Vertex,c:Vertex,d:Vertex,color:string)=>void;top:(rings:number[][][],y:number,color:string)=>void};
const at=(p:number[],h:number):Vertex=>[p[0],h,p[1]];
// Positive world z is toward the park. Each section starts at the unmodified
// terrace, crosses the planting shoulder and walk, then ends at the cycleway.
export function addRinconCurbEdge(tile:Tile){
  const sections=survey.stations;
  for(let i=1;i<sections.length;i++){
    const a=sections[i-1],b=sections[i];
    const strip=(j:number,up:number,down:number,color:string)=>
      tile.quad(at(a[j],up),at(b[j],up),at(b[j+1],down),at(a[j+1],down),color);
    strip(0,.110,.045,'#a39d79');
    strip(1,.045,.045,'#c4bdac');
    // The protected cycle track follows the sidewalk down to the vehicle
    // separator. Its pigment is distinct from the adjacent asphalt.
    strip(2,.039,.033,'#a6a49b');
    tile.quad(at(a[2],.045),at(b[2],.045),at(b[2],.039),at(a[2],.039),'#b8b4a3');
    tile.quad(at(a[3],.033),at(b[3],.033),at(b[3],.031),at(a[3],.031),'#92948d');
  }
  function crossSection(x:number){
    const i=sections.findIndex(s=>s[0][0]>=x);
    const a=sections[i-1],b=sections[i],u=(x-a[0][0])/(b[0][0]-a[0][0]);
    return [2,3].map(j=>a[j][1]+u*(b[j][1]-a[j][1]));
  }
  for(const [x0,x1] of survey.separator){
    const [a,az]=crossSection(x0),[b,bz]=crossSection(x1);
    const l=.028;
    // Low precast separator blocks set inside the white traffic-side edge.
    tile.quad([x0,.042,az+l],[x1,.042,bz+l],[x1,.042,bz],[x0,.042,az],'#c6c4b9');
    tile.quad([x0,.042,az],[x1,.042,bz],[x1,.033,bz],[x0,.033,az],'#929387');
    tile.quad([x1,.042,bz+l],[x0,.042,az+l],[x0,.034,az+l],[x1,.034,bz+l],'#9e9f94');
    for(const [x,z,rev] of [[x0,az,1],[x1,bz,-1]]){
      const pa=at([x,z],.033),pb=at([x,z+l],.034),pc=at([x,z+l],.042),pd=at([x,z],.042);
      if(rev===1)tile.quad(pa,pb,pc,pd,'#b8b7ab');
      else tile.quad(pa,pd,pc,pb,'#b8b7ab');
    }
    // Short faded center dashes in the two-way protected lane. Their height
    // follows the actual cycleway plane underneath the paint.
    const z0=(a+az)/2,z1=(b+bz)/2,dx=(x1-x0)*.35,dz=(z1-z0)*.35;
    const zA=z0+dz,zB=z1-dz;
    tile.quad([x0+dx,.0364,zA+.004],[x1-dx,.0364,zB+.004],
      [x1-dx,.0364,zB-.004],[x0+dx,.0364,zA-.004],'#cbc8ab');
  }
  for(const p of survey.inland)tile.top(p,.045,'#c4bdac');
  for(const p of survey.wells)tile.top(p,.040,'#8e8270');
}
