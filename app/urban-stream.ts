// Production survey streams have columnar metadata and two signed coordinate
// delta streams. The importer and dev server retain the original byte layout.
export function urbanStreamBytes(encoded:string):Uint8Array {
  const packed=encoded.startsWith('!1');
  const text=packed?encoded.slice(3):encoded;
  const type=Uint8Array as typeof Uint8Array & {fromBase64?:(s:string)=>Uint8Array};
  let bytes:Uint8Array;
  if(type.fromBase64)bytes=type.fromBase64(text);
  else{
    const raw=atob(text);bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  }
  if(!packed)return bytes;

  const building=encoded[2]==='b',fields=building?9:1;
  const header=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const records=header.getUint32(0,true),paths=header.getUint32(4,true),points=header.getUint32(8,true);
  const metadata=24,counts=metadata+fields*records,xLow=counts+paths*2;
  let xl=xLow,xh=xl+points,xt=xh+header.getUint32(12,true);
  let yl=xt+header.getUint32(16,true),yh=yl+points,yt=yh+header.getUint32(20,true);
  const raw=new Uint8Array(records*fields+paths*2+points*4);
  const view=new DataView(raw.buffer);
  let out=0,path=0,startX=0,startZ=0;
  for(let record=0;record<records;record++){
    for(let f=0;f<fields;f++)raw[out++]=bytes[metadata+f*records+record];
    const rings=building?raw[out-1]:1;
    for(let r=0;r<rings;r++,path++){
      const count=bytes[counts+path]|(bytes[counts+paths+path]<<8);
      view.setUint16(out,count,true);out+=2;
      let x=startX,z=startZ;
      for(let i=0;i<count;i++){
        let dx=bytes[xl++],dz=bytes[yl++];
        if(dx&128){const high=bytes[xh++];dx=(dx&127)|((high&127)<<7);if(high&128)dx|=bytes[xt++]<<14;}
        if(dz&128){const high=bytes[yh++];dz=(dz&127)|((high&127)<<7);if(high&128)dz|=bytes[yt++]<<14;}
        x+=(dx>>>1)^-(dx&1);z+=(dz>>>1)^-(dz&1);
        // setInt16 restores the signed survey coordinates modulo 65536.
        view.setInt16(out,x,true);view.setInt16(out+2,z,true);out+=4;
        if(i===0){startX=x;startZ=z;}
      }
    }
  }
  return raw;
}
