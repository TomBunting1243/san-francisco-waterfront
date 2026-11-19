import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {normalizePath,type Plugin} from 'vite';

type ReliefRow=[number|string, [number,number][], ...unknown[]];
type ReliefSurvey={buildings:ReliefRow[];paths:ReliefRow[]};

// Keep source surveys and Node imports readable. Only the production module
// replaces the repeated decimal pairs with signed, variable-length deltas.
export function packedReliefModule(survey:ReliefSurvey){
  const bytes:number[]=[];
  let lastLon=0,lastLat=0,exact=true;
  function delta(value:number){
    let code=value<0?-2*value-1:2*value;
    while(code>=128){bytes.push((code&127)|128);code>>>=7;}
    bytes.push(code);
  }
  function pack(rows:ReliefRow[]){
    return rows.map(([label,points,...metadata])=>{
      for(const point of points){
        const [lon,lat]=point;
        const x=Math.round(lon*1e6),y=Math.round(lat*1e6);
        // Let Vite serve its ordinary JSON module if a future survey changes
        // precision or coordinate system.
        if(point.length!==2||Math.abs(lon)>180||Math.abs(lat)>90||Object.is(lon,-0)||Object.is(lat,-0)||!Object.is(x/1e6,lon)||!Object.is(y/1e6,lat)){
          exact=false;break;
        }
        delta(x-lastLon);delta(y-lastLat);
        lastLon=x;lastLat=y;
      }
      return [label,points.length,...metadata];
    });
  }
  const stored={...survey,buildings:pack(survey.buildings),paths:pack(survey.paths)};
  if(!exact)return;
  return `const survey=JSON.parse(${JSON.stringify(JSON.stringify(stored))});
const bytes=atob("${Buffer.from(bytes).toString('base64')}");
let offset=0,lon=0,lat=0;
function delta(){
  let value=0,shift=0,byte;
  do{
    byte=bytes.charCodeAt(offset++);
    value|=(byte&127)<<shift;
    shift+=7;
  }while(byte&128);
  return (value>>>1)^-(value&1);
}
for(const rows of [survey.buildings,survey.paths]){
  for(const row of rows){
    const points=new Array(row[1]);
    for(let i=0;i<points.length;i++){
      lon+=delta();lat+=delta();
      points[i]=[lon/1e6,lat/1e6];
    }
    row[1]=points;
  }
}
export default survey;`;
}

export function packBayRelief():Plugin{
  let source:string;
  return {
    name:'pack-bay-relief',apply:'build',enforce:'post',
    configResolved(config){source=normalizePath(resolve(config.root,'public/data/bay-relief.json'));},
    transform(_code,id){
      if(id!==source)return;
      const code=packedReliefModule(JSON.parse(readFileSync(source,'utf8')));
      if(code)return {code,map:null};
    },
  };
}
