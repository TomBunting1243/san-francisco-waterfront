// Production survey modules preserve their JSON structure and substitute
// path markers for coordinate arrays. The two streams hold x and z deltas.
export function unpackCoordinateSurvey(shape:string,xStream:string,zStream:string){
  function reader(stream:string){
    const bytes=atob(stream);
    let offset=0;
    return ()=>{
      let value=0,shift=0,byte:number;
      do{
        byte=bytes.charCodeAt(offset++);value|=(byte&127)<<shift;shift+=7;
      }while(byte&128);
      return (value>>>1)^-(value&1);
    };
  }
  const xDelta=reader(xStream),zDelta=reader(zStream);
  const previous=new Map<number,[number,number]>();
  function restore(value:unknown):unknown{
    if(value==='~Z')return -0;
    if(typeof value==='string'&&value.startsWith('~P')){
      const precision=Number(value[2]),scale=10**precision,count=parseInt(value.slice(3),36);
      const points=new Array<[number,number]>(count);
      let [x,z]=previous.get(precision)??[0,0];
      for(let i=0;i<count;i++){
        x+=xDelta();z+=zDelta();points[i]=[x/scale,z/scale];
        if(i===0)previous.set(precision,[x,z]);
      }
      return points;
    }
    if(Array.isArray(value)){
      for(let i=0;i<value.length;i++)value[i]=restore(value[i]);
    }else if(value&&typeof value==='object'){
      const record=value as Record<string,unknown>;
      for(const key of Object.keys(record))record[key]=restore(record[key]);
    }
    return value;
  }
  return restore(JSON.parse(shape));
}
