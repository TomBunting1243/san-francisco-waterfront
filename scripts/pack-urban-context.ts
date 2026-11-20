import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {normalizePath,type Plugin} from 'vite';
import {urbanStreamBytes} from '../app/urban-stream.ts';

function pushDelta(low:number[],high:number[],top:number[],delta:number){
  const signed=delta<<16>>16;
  const value=(signed<<1)^(signed>>15);
  low.push((value&127)|(value>=128?128:0));
  if(value>=128){
    high.push(((value>>>7)&127)|(value>=16384?128:0));
    if(value>=16384)top.push(value>>>14);
  }
}

function packStream(encoded:unknown,building:boolean){
  if(typeof encoded!=='string')return;
  if(!encoded)return '';
  const raw=Buffer.from(encoded,'base64');
  if(raw.toString('base64')!==encoded)return;
  const fields=building?9:1;
  const columns=Array.from({length:fields+8},():number[]=>[]);
  const [countLow,countHigh,xLow,xHigh,xTop,zLow,zHigh,zTop]=columns.slice(fields);
  let offset=0,startX=0,startZ=0;
  while(offset<raw.length){
    if(offset+fields>raw.length)return;
    const rings=building?raw[offset+8]:1;
    for(let i=0;i<fields;i++)columns[i].push(raw[offset++]);
    for(let r=0;r<rings;r++){
      if(offset+2>raw.length)return;
      const n=raw.readUInt16LE(offset);
      countLow.push(raw[offset++]);countHigh.push(raw[offset++]);
      if(offset+n*4>raw.length)return;
      let x=startX,z=startZ;
      for(let i=0;i<n;i++){
        const nextX=raw.readInt16LE(offset),nextZ=raw.readInt16LE(offset+2);offset+=4;
        pushDelta(xLow,xHigh,xTop,nextX-x);pushDelta(zLow,zHigh,zTop,nextZ-z);
        x=nextX;z=nextZ;if(i===0){startX=x;startZ=z;}
      }
    }
  }
  const header=Buffer.alloc(24);
  [columns[0].length,countLow.length,xLow.length,xHigh.length,xTop.length,zHigh.length]
    .forEach((length,i)=>header.writeUInt32LE(length,i*4));
  const bytes=Buffer.concat([header,...columns.map(column=>Buffer.from(column))]);
  const result=(building?'!1b':'!1r')+bytes.toString('base64');
  // The source survey is authoritative. Only substitute verified exact bytes.
  return raw.equals(urbanStreamBytes(result))?result:undefined;
}

export function packedUrbanSurvey(survey:{tiles:unknown[][]}){
  if(!Array.isArray(survey?.tiles))return;
  const tiles=[];
  for(const tile of survey.tiles){
    if(!Array.isArray(tile)||tile.length<5)return;
    const buildings=packStream(tile[2],true),roads=packStream(tile[3],false);
    if(buildings===undefined||roads===undefined)return;
    tiles.push([tile[0],tile[1],buildings,roads,...tile.slice(4)]);
  }
  return {...survey,tiles};
}

export function packUrbanContext():Plugin{
  let source:string;
  return {
    name:'pack-urban-context',apply:'build',enforce:'post',
    configResolved(config){source=normalizePath(resolve(config.root,'public/data/urban-context.json'));},
    transform(_code,id){
      if(id!==source)return;
      const survey=packedUrbanSurvey(JSON.parse(readFileSync(source,'utf8')));
      if(survey)return {code:'export default JSON.parse('+JSON.stringify(JSON.stringify(survey))+');',map:null};
    },
  };
}
