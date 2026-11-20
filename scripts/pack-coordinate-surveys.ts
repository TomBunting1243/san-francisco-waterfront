import {readFileSync} from 'node:fs';
import {basename,dirname,resolve} from 'node:path';
import {normalizePath,type Plugin} from 'vite';

// These datasets have a net transfer benefit under both gzip and Brotli.
// Other survey formats use the normal JSON loader or their own binary layout.
export const coordinateSurveys=['approach-soma','curb-survey','downtown-roofs','east-bay-shore',
  'sf-waterfront','sightline-streets','south-beach','survey-blocks','survey-shore','waterfront-landscape'];

export function packCoordinates(data:unknown):[string,string,string]|undefined{
  const previous=new Map<number,number[]>(),xs:number[]=[],zs:number[]=[];
  let safe=true,paths=0;
  function delta(value:number,bytes:number[]){
    let code=value<0?-2*value-1:2*value;
    while(code>=128){bytes.push((code&127)|128);code>>>=7;}
    bytes.push(code);
  }
  function store(value:unknown):unknown{
    if(!value||typeof value!=='object'){
      if(Object.is(value,-0))return '~Z';
      if(typeof value==='string'&&(value.startsWith('~P')||value==='~Z'))safe=false;
      return value;
    }
    if(!Array.isArray(value))return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,store(v)]));
    if(Array.isArray(value[0])&&value[0].length===2&&typeof value[0][0]==='number'){
      // Check exact double round trips; leave paths with other precision or
      // out-of-range coordinates in the ordinary JSON shape.
      for(const precision of [3,4,6,7]){
        const scale=10**precision;
        if(!value.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>
          typeof n==='number'&&Math.abs(n*scale)<9e8&&!Object.is(n,-0)&&Object.is(Math.round(n*scale)/scale,n))))continue;
        let [x,z]=previous.get(precision)??[0,0];
        for(const [i,p] of value.entries()){
          const nx=Math.round(p[0]*scale),nz=Math.round(p[1]*scale);
          delta(nx-x,xs);delta(nz-z,zs);x=nx;z=nz;
          if(i===0)previous.set(precision,[x,z]);
        }
        paths++;
        return '~P'+precision+value.length.toString(36);
      }
    }
    return value.map(store);
  }
  const shape=store(data);
  if(!safe||!paths)return;
  return [JSON.stringify(shape),Buffer.from(xs).toString('base64'),Buffer.from(zs).toString('base64')];
}

export function packCoordinateSurveys():Plugin{
  const filenames=new Set(coordinateSurveys.map(name=>name+'.json'));
  let directory:string;
  return {
    name:'pack-waterfront-coordinate-surveys',apply:'build',enforce:'post',
    configResolved(config){directory=normalizePath(resolve(config.root,'public/data'));},
    transform(_code,id){
      if(dirname(id)!==directory||!filenames.has(basename(id)))return;
      const packed=packCoordinates(JSON.parse(readFileSync(id,'utf8')));
      if(packed)return {code:"import {unpackCoordinateSurvey} from '../../app/coordinate-survey.ts';\n"+
        'export default unpackCoordinateSurvey('+packed.map(s=>JSON.stringify(s)).join(',')+');',map:null};
    },
  };
}
