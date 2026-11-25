import data from '../public/data/natoma-landings.json' with {type:'json'};

type Point=[number,number,number];
type Tile={vertices(points:Point[],color:string):number;indices:number[];roadClass:number;roadExposure:number[]};
const remainder:Record<string,number[][][][]>=data.remainder;
export function natomaPavingRemainder(kind:string,index:number){return remainder[kind+index];}

const ex=.15135,ez=Math.sqrt(1-ex*ex);
const pigment:Record<string,string>={asphalt:'#899692',face:'#d1cbb6',cap:'#d1cbb6',walk:'#cac6b3',warning:'#c0a16b'};
export function addNatomaLandings(tile:Tile,warningTile:Tile,warningUV:number[]){
  const prior=tile.roadClass;tile.roadClass=1;warningTile.roadClass=1;
  for(const [type,ids] of Object.entries(data.faces)){
    const points:Point[]=[],local=new Map<number,number>();
    for(const id of ids){
      if(local.has(id))continue;
      const [u,v,y]=data.vertices[id],s=(u-414)/24,d=(v+543)/24;
      local.set(id,points.length);
      points.push([-22.938495+.06*(s*ex-d*ez),y,-32.902787+.06*(s*ez+d*ex)]);
      if(type==='warning'){
        // Orient RX-6 rows along the local ramp, centered near each panel.
        const west=u<380,dx=west?.951:-.898,dy=west?-.309:-.440;
        const a=u-(west?194:536),b=v-(west?322:229),pitch=24*.0254*1.66;
        warningUV.push(2048+(a*dx+b*dy)/pitch,(b*dx-a*dy)/pitch);
      }
    }
    const target=type==='warning'?warningTile:tile;
    const first=target.vertices(points,pigment[type]);
    // Match the adjoining sidewalk/curb's night receiver at each section
    // end. Asphalt and the exposed curb cheeks stay road-lit across the joint.
    if(type==='cap'||type==='walk'){
      for(const [id,i] of local){
        const [u,v]=data.vertices[id];
        const seam=u<350?(v===278||v===389):(v===190||v===374);
        if(seam)target.roadExposure[first+i]=0;
      }
    }
    for(const id of ids)target.indices.push(first+local.get(id)!);
  }
  tile.roadClass=prior;
}
