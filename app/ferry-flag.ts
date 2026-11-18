import * as THREE from 'three';

const columns=20,rows=7,stride=columns+1;
const hoist=6*.3048*.06,fly=hoist*1.9;
const span=fly/columns;
let fabric:THREE.MeshStandardMaterial|undefined;
type Flag=THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;

// A single mipmapped print registers the union, stars, and all thirteen stripes
// to both sides of the same moving surface. UV (0,1) is the top of the hoist.
function clothMaterial(){
  if(fabric)return fabric;
  const width=512,height=256,data=new Uint8Array(width*height*4);
  const red=[169,77,69],white=[231,225,207],blue=[65,84,105];
  function pixel(x:number,y:number,c:number[]){
    const offset=4*((height-1-y)*width+x);
    data[offset]=c[0];data[offset+1]=c[1];data[offset+2]=c[2];data[offset+3]=255;
  }
  const unionWidth=width*.4,unionHeight=height*7/13;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const canton=x+.5<unionWidth&&y+.5<unionHeight;
    pixel(x,y,canton?blue:Math.floor((y+.5)/height*13)%2?white:red);
  }
  // Five rows of six stars alternate with four rows of five. Test star pixels
  // against the ten straight sides so their shape survives obtainable zoom.
  const radius=height*.0308;
  const points=Array.from({length:10},(_,i)=>{
    const a=i*Math.PI/5-Math.PI/2,r=i%2?radius*.382:radius;
    return [r*Math.cos(a)*width/height/1.9,r*Math.sin(a)];
  });
  for(let row=0;row<9;row++)for(let col=0;col<(row%2?5:6);col++){
    const cx=unionWidth*(1+2*col+row%2)/12,cy=unionHeight*(1+row)/10;
    for(let y=Math.floor(cy-radius);y<=cy+radius;y++)for(let x=Math.floor(cx-radius*1.1);x<=cx+radius*1.1;x++){
      const px=x+.5-cx,py=y+.5-cy;let inside=false;
      for(let i=0,j=9;i<10;j=i++){
        const [ax,ay]=points[i],[bx,by]=points[j];
        if((ay>py)!==(by>py)&&px<(bx-ax)*(py-ay)/(by-ay)+ax)inside=!inside;
      }
      if(inside)pixel(x,y,white);
    }
  }
  const print=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);
  print.name='Ferry flag textile print';print.colorSpace=THREE.SRGBColorSpace;
  print.generateMipmaps=true;print.minFilter=THREE.LinearMipmapLinearFilter;print.magFilter=THREE.LinearFilter;print.needsUpdate=true;
  fabric=new THREE.MeshStandardMaterial({map:print,roughness:.97,side:THREE.DoubleSide});
  return fabric;
}

export function createFerryFlag():Flag{
  const count=stride*(rows+1),geo=new THREE.BufferGeometry(),uv=new Float32Array(count*2),indices:number[]=[];
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const i=row*stride+col;
    uv[2*i]=col/columns;uv[2*i+1]=1-row/rows;
    if(col<columns&&row<rows)indices.push(i,i+1,i+stride,i+stride,i+1,i+stride+1);
  }
  for(const name of ['position','normal'])
    geo.setAttribute(name,new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(indices);
  geo.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,-hoist/2,0),fly+hoist/2);
  geo.boundingBox=new THREE.Box3(new THREE.Vector3(-fly,-hoist-fly,-fly),new THREE.Vector3(fly,fly,fly));
  const flag=new THREE.Mesh(geo,clothMaterial().clone());flag.name='Ferry Building wind flag';flag.userData.ferryFlag=true;
  updateFerryFlag(flag,0,{x:-1,y:0},12,0);
  return flag;
}

const validWind=(kph:number)=>Math.max(0,Math.min(150,Number.isFinite(kph)?kph:0));
const validRain=(fraction:number)=>Math.max(0,Math.min(1,Number.isFinite(fraction)?fraction:0));
const windDrive=(wind:number,wet:number)=>wind/(wind+7+wet*6);

/** Angular velocity in radians per second for the scene's accumulated cloth phase. */
export function ferryFlagFlutterRate(windKph:number,rainFraction:number){
  const drive=windDrive(validWind(windKph),validRain(rainFraction));
  return drive*(1.2+6.3*drive);
}

// Downstream is the horizontal scene vector (x,z), carried as Vector2 (x,y).
// Integrating unit tangents preserves the fly length as the cloth fills or sags.
// The scene integrates wave phase so a new wind report only changes future cadence.
export function updateFerryFlag(flag:Flag,phaseRadians:number,downstream:{x:number;y:number},windKph:number,rainFraction:number){
  const wind=validWind(windKph);
  const wet=validRain(rainFraction);
  const phase=Number.isFinite(phaseRadians)?phaseRadians:0;
  const length=Math.hypot(downstream.x,downstream.y);
  const dx=Number.isFinite(length)&&length>.0001?downstream.x/length:-1;
  const dz=Number.isFinite(length)&&length>.0001?downstream.y/length:0;
  const drive=windDrive(wind,wet);
  const lift=.18+.83*(1-Math.exp(-wind/(11+9*wet)))-.04*wet;
  const swing=drive*(1-.32*wet);
  const positions=flag.geometry.getAttribute('position') as THREE.BufferAttribute;
  const normals=flag.geometry.getAttribute('normal') as THREE.BufferAttribute;
  const pos=positions.array,nor=normals.array;
  for(let row=0;row<=rows;row++){
    const v=row/rows;
    let x=0,y=-hoist*v,z=0;
    for(let col=0;col<=columns;col++){
      const i=3*(row*stride+col);
      pos[i]=x;pos[i+1]=y;pos[i+2]=z;
      if(col===columns)break;
      const u=(col+.5)/columns;
      const wave=8.8*u-phase+.72*v;
      const restingFold=.26*(1-drive)*Math.sin(7*u+.72*v);
      const bend=(.20+.80*u)*(restingFold+swing*(.78*Math.sin(wave)+.22*Math.sin(1.85*wave+.9*v)));
      // Arc angles vary along the sheet. The wet fly rides lower and its smaller
      // crosswind excursion makes the passing gusts feel heavier.
      const dip=-Math.acos(Math.min(.995,lift))+.18*drive*u*Math.sin(wave+.9);
      const horizontal=Math.cos(dip),forward=horizontal*Math.cos(bend),cross=horizontal*Math.sin(bend);
      x+=span*(dx*forward-dz*cross);z+=span*(dz*forward+dx*cross);y+=span*Math.sin(dip);
    }
  }
  // Centered differences update smooth, two-sided normals in the same buffers.
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const i=3*(row*stride+col);
    const l=col?i-3:i,r=col<columns?i+3:i,t=row?i-3*stride:i,b=row<rows?i+3*stride:i;
    const ax=pos[r]-pos[l],ay=pos[r+1]-pos[l+1],az=pos[r+2]-pos[l+2];
    const bx=pos[b]-pos[t],by=pos[b+1]-pos[t+1],bz=pos[b+2]-pos[t+2];
    const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
    const inv=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1);
    nor[i]=nx*inv;nor[i+1]=ny*inv;nor[i+2]=nz*inv;
  }
  positions.needsUpdate=true;normals.needsUpdate=true;
}
