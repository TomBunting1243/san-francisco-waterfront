import * as THREE from 'three';

// Original small-format car cards. Muni's 1051 has curved advertising panels
// over its standee windows; the artwork here belongs to the illustrated city.
export function pccCarCards(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=384;
  const pen=canvas.getContext('2d');
  if(!pen)return null;
  const label=(s:string,x:number,y:number,size:number,color:string,bold=false)=>{
    pen.fillStyle=color;pen.font=(bold?'bold ':'')+size+'px Arial, sans-serif';pen.fillText(s,x,y);
  };
  const line=(points:number[][],color:string,width:number)=>{
    pen.strokeStyle=color;pen.lineWidth=width;pen.beginPath();points.forEach(([x,y],i)=>i?pen.lineTo(x,y):pen.moveTo(x,y));pen.stroke();
  };
  const disk=(x:number,y:number,r:number,color:string)=>{pen.fillStyle=color;pen.beginPath();pen.arc(x,y,r,0,Math.PI*2);pen.fill();};
  const cream='#f2e6c8',ink='#253e40',brick='#954b37',sea='#426f72';
  for(let row=0;row<4;row++){
    pen.save();pen.translate(0,row*96);
    pen.fillStyle=[cream,sea,brick,'#d2c7a2'][row];pen.fillRect(0,0,512,96);
    if(row===0){
      disk(49,47,31,brick);label('F',37,61,40,cream,true);
      label('MARKET & WHARVES',96,30,22,ink,true);
      line([[102,51],[445,51]],brick,4);for(const x of [102,265,445])disk(x,51,6,brick);
      label('Castro',93,78,16,ink);label('Ferry Building',211,78,16,ink);label("Fisherman’s Wharf",362,78,16,ink);
    }else if(row===1){
      label('Please hold on',21,58,40,cream,true);
      for(const x of [361,419,477]){
        line([[x,0],[x,32],[x-14,58],[x+14,58],[x,32]],cream,4);
      }
    }else if(row===2){
      label('1051',20,78,82,cream,true);line([[237,13],[237,83]],cream,2);
      label('SAN FRANCISCO',258,40,23,cream,true);label('Municipal Railway',258,70,24,cream);
    }else{
      label('The Ferry Building',18,58,39,ink,true);
      const x=401;line([[330,76],[371,76],[371,48],[383,48],[383,22],[390,22],[397,8],[404,22],[412,22],[412,48],[423,48],[423,76],[499,76]],sea,4);
      disk(x-4,36,6,sea);line([[397,31],[397,36],[401,38]],cream,2);
    }
    pen.restore();
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  return texture;
}
