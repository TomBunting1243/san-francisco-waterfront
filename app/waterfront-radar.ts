import palette from '../public/data/radar-palette.json' with {type:'json'};

const dBZ:Record<string,number>=palette.colors;
const fiveMinutes=300_000;

export async function readWaterfrontRadar(now:number,request:typeof fetch,signal:AbortSignal){
  // IEM composites are archived every five minutes. Allow time for the latest
  // scans to arrive and sample a 3-by-3 patch centered on the Ferry Building.
  const at=Math.floor((now-7*60_000)/fiveMinutes)*fiveMinutes;
  const query=new URLSearchParams({service:'WMS',version:'1.1.1',request:'GetMap',layers:'nexrad-n0q-wmst',
    srs:'EPSG:4326',bbox:'-122.4012,37.7880,-122.3862,37.8030',width:'3',height:'3',transparent:'true',
    format:'image/png',time:new Date(at).toISOString().replace('.000Z','Z')});
  try{
    const res=await request('https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0q-t.cgi?'+query,
      {signal,credentials:'omit'});
    if(!res.ok||!res.headers.get('content-type')?.includes('image/png'))return;
    const bitmap=await createImageBitmap(await res.blob());
    try{
      if(bitmap.width!==3||bitmap.height!==3)return;
      const canvas=document.createElement('canvas');canvas.width=3;canvas.height=3;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return;
      ctx.drawImage(bitmap,0,0);
      const value=radarStrength(ctx.getImageData(0,0,3,3).data);
      if(value!==null)return {at,value};
    }finally{bitmap.close();}
  }catch{/* An absent radar frame leaves the official waterfront forecast in effect. */}
}

export function radarStrength(pixels:ArrayLike<number>){
  const values:number[]=[];
  for(let i=0;i<pixels.length;i+=4){
    if(pixels[i+3]!==255)continue;
    const rgb=((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]).toString(16).padStart(6,'0');
    if(dBZ[rgb]!==undefined)values.push(dBZ[rgb]);
  }
  if(values.length<3)return null;
  const reflectivity=values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
  // Filter clutter and avoid declaring the pavement dry from a missing echo.
  // This is a visual estimate of rain strength, not a gauge measurement.
  return reflectivity<12?null:Math.min(1,.14+.86*Math.max(0,reflectivity-12)/33);
}
