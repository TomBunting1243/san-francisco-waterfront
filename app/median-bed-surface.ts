type Point=[number,number,number];
type Plan=[number,number];
type BedTile={quad:(a:Point,b:Point,c:Point,d:Point,color:string)=>void};
export type MedianBed={x:number;z:number;angle:number;halfLength:number;halfWidth:number;grade:number;raised:boolean};

export function medianBedSoilHeight(bed:MedianBed){
  return bed.grade+(bed.raised?.0054:-.0012);
}

const stone=['#665f53','#736a5d','#625e54','#777063','#6d675d'];
const earth=['#c0af92','#bcaa8d','#c2b196','#bda98c','#c1ad91','#beac8e'];
const grit=['#aa987d','#d1c1a5','#b49f81','#cdb99c'];
const mix=(a:Plan,b:Plan,t:number):Plan=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];

/** The caller cuts the exact outer rectangle from its concrete before emitting this tile. */
export function addMedianBedSurface(tile:BedTile,bed:MedianBed){
  const {x,z,halfLength:l,halfWidth:w,grade,raised}=bed;
  const cs=Math.cos(bed.angle),sn=Math.sin(bed.angle);
  const point=([a,b]:Plan,y:number):Point=>[x+a*cs-b*sn,y,z+a*sn+b*cs];
  const soil=medianBedSoilHeight(bed),rim=grade+(raised?.009:0);
  const width=Math.min(raised?.0084:.0066,.22*Math.min(l,w));
  const innerL=l-width,innerW=w-width;
  const rectangle=(a:number,b:number):Plan[]=>[[-a,-b],[-a,b],[a,b],[a,-b]];
  const outer=rectangle(l,w),inner=rectangle(innerL,innerW);
  let state=((Math.round(x*1e4)*73)^Math.round(z*1e4))>>>0;
  const rand=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);

  // A single course. Miter the corners, vary the joint spacing and skew the
  // inner ends slightly. Mortar occupies its own narrow part of the top.
  for(let side=0;side<4;side++){
    const next=(side+1)%4,a=outer[side],b=outer[next],c=inner[side],d=inner[next];
    if(raised){
      tile.quad(point(a,rim),point(b,rim),point(d,rim),point(c,rim),'#c6bbab');
      tile.quad(point(a,grade),point(b,grade),point(b,rim),point(a,rim),'#ada493');
    }else{
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const count=Math.max(1,Math.round(length/.0144)),joint=Math.min(.0005/length,.15/count);
      let start=0,insideStart=0;
      for(let i=1;i<=count;i++){
        const end=i===count?1:(i+.28*(rand()-.5))/count;
        const insideEnd=i===count?1:end+.17*(rand()-.5)/count;
        const faceEnd=i===count?end:end-joint,insideFaceEnd=i===count?insideEnd:insideEnd-joint;
        tile.quad(point(mix(a,b,start),rim),point(mix(a,b,faceEnd),rim),
          point(mix(c,d,insideFaceEnd),rim),point(mix(c,d,insideStart),rim),stone[Math.floor(rand()*stone.length)]);
        if(i<count)tile.quad(point(mix(a,b,faceEnd),rim),point(mix(a,b,end),rim),
          point(mix(c,d,insideEnd),rim),point(mix(c,d,insideFaceEnd),rim),'#514d43');
        start=end;insideStart=insideEnd;
      }
    }
    tile.quad(point(c,rim),point(d,rim),point(d,soil),point(c,soil),raised?'#a69a86':'#6c6051');
  }

  // A continuous, level seat under the whole collar. Small angular grains
  // replace portions of this surface; neither an overlay nor a raised pebble
  // can interfere with trunk placement or depth testing.
  const nx=Math.min(10,Math.max(2,Math.round(2*innerL/.022)));
  const nz=Math.min(8,Math.max(2,Math.round(2*innerW/.022)));
  const points:Plan[][]=[];
  for(let i=0;i<=nx;i++){
    const column:Plan[]=[];
    for(let j=0;j<=nz;j++){
      const u=i===0||i===nx?i:i+.34*(rand()-.5),v=j===0||j===nz?j:j+.34*(rand()-.5);
      column.push([innerL*(2*u/nx-1),innerW*(2*v/nz-1)]);
    }
    points.push(column);
  }
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
    const cell=[points[i][j],points[i][j+1],points[i+1][j+1],points[i+1][j]];
    const tint=earth[Math.floor(rand()*earth.length)];
    if(rand()>.26){
      tile.quad(point(cell[0],soil),point(cell[1],soil),point(cell[2],soil),point(cell[3],soil),tint);
      continue;
    }
    const center=mix(mix(cell[0],cell[1],.3+.4*rand()),mix(cell[3],cell[2],.3+.4*rand()),.3+.4*rand());
    const grain=cell.map(p=>mix(center,p,.09+.16*rand()));
    for(let k=0;k<4;k++){
      const n=(k+1)%4;
      tile.quad(point(cell[k],soil),point(cell[n],soil),point(grain[n],soil),point(grain[k],soil),tint);
    }
    tile.quad(point(grain[0],soil),point(grain[1],soil),point(grain[2],soil),point(grain[3],soil),
      grit[Math.floor(rand()*grit.length)]);
  }
}
