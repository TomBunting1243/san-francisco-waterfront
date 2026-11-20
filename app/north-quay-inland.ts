import {Color,Vector2} from 'three';

type Triangles={vertex(x:number,y:number,z:number,color:Color):void};
type Point=[number,number,number];
type Ground=(x:number,z:number)=>number;
const clay=new Color('#a06352'),coping=new Color('#ac7868'),reveal=new Color('#825748');
const bronze=new Color('#55574f'),glass=[new Color('#586664'),new Color('#606f6d'),new Color('#657370')];
const lawn=new Color('#8b9d65'),concrete=new Color('#c4bcaa'),plant=new Color('#b1aea0');

// First coordinate of the retained North Beach ring for City footprint 201006.0000570.
export function isWaterfrontPlazaFootprint(lon:number,lat:number){
  return lon===-122.405114&&lat===37.805286;
}

function face(mesh:Triangles,a:Point,b:Point,c:Point,d:Point,tone:Color){
  for(const [x,y,z] of [a,b,c,a,c,d])mesh.vertex(x,y,z,tone);
}

/** The street wings of 1700 Montgomery fold back around an open lawn.
 * Four floors of bronze glazing sit behind the brick pier and spandrel grid. */
export function addWaterfrontPlaza(mesh:Triangles,points:Vector2[],floor:number,roof:number,ground:Ground){
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],length=a.distanceTo(b);
    const dx=(b.x-a.x)/length,dz=(b.y-a.y)/length;
    // The relief ring is clockwise in plan. Positive depth runs indoors.
    const at=(u:number,y:number,depth=0):Point=>[a.x+dx*u+dz*depth,y,a.y+dz*u-dx*depth];
    const panel=(u:number,v:number,low:number,high:number,depth:number,tone:Color)=>
      face(mesh,at(u,low,depth),at(v,low,depth),at(v,high,depth),at(u,high,depth),tone);
    const bays=Math.max(2,Math.round(length/.46)),bay=length/bays,pier=.030;
    const storey=(roof-floor)/4;
    panel(0,length,Math.min(ground(a.x,a.y),ground(b.x,b.y))-.12,floor+.008,0,clay);
    for(let level=0;level<4;level++){
      const y=floor+level*storey,low=y+.008,high=y+storey*(level===3?.75:.81);
      // Faces at each return join the setback glass to its street-facing grid.
      panel(0,length,high,level===3?roof:y+storey+.008,0,level===3?coping:clay);
      for(let j=0;j<bays;j++){
        const u=j*bay,v=(j+1)*bay,left=u+pier,right=v-pier,inset=level===0?.055:.028;
        panel(u,left,low,high,0,clay);panel(right,v,low,high,0,clay);
        face(mesh,at(left,low),at(left,low,inset),at(left,high,inset),at(left,high),reveal);
        face(mesh,at(right,low,inset),at(right,low),at(right,high),at(right,high,inset),reveal);
        face(mesh,at(left,low),at(right,low),at(right,low,inset),at(left,low,inset),coping);
        face(mesh,at(left,high,inset),at(right,high,inset),at(right,high),at(left,high),reveal);
        const pane=(right-left)/3;
        for(let k=0;k<3;k++){
          const start=left+k*pane,end=start+pane;
          panel(start,end-.006,low,high,inset,glass[(j+k+level)%3]);
          panel(end-.006,end,low,high,inset,bronze);
        }
      }
    }
  }

  // Outline of the pale mechanical enclosure visible in the 2024 aerial.
  const enclosure=[[86.86,-9.94],[87.88,-10.23],[88.04,-9.70],[87.02,-9.41]];
  const roofPoint=(i:number,y:number):Point=>[enclosure[i][0],y,enclosure[i][1]];
  const top=roof+.105;
  for(let i=0;i<4;i++){
    const j=(i+1)%4;
    face(mesh,roofPoint(j,roof),roofPoint(i,roof),roofPoint(i,top),roofPoint(j,top),plant);
  }
  face(mesh,roofPoint(3,top),roofPoint(2,top),roofPoint(1,top),roofPoint(0,top),concrete);

  // Sections traced across the bay-facing lawn and its curved concrete path.
  // Each strip shares its grade and edge vertices with the next material.
  const sections=[
    [86.43,-7.43,-7.02,-6.43],[86.53,-7.72,-7.37,-6.45],[86.75,-8.16,-7.80,-6.50],
    [87.06,-8.41,-8.12,-6.56],[87.51,-8.58,-8.35,-6.66],[88.03,-8.75,-8.47,-6.77],
    [88.50,-8.89,-8.43,-6.87],[89.00,-8.70,-8.22,-6.98],[89.43,-8.49,-8.02,-7.07],
    [89.85,-8.29,-7.81,-7.15],[90.04,-8.15,-7.72,-7.20],
  ];
  const section=(row:number[])=>{
    const [x,back,path,front]=row;
    return [back,path-.048,path+.048,(path+front)/2,front].map((z):Point=>[x,ground(x,z)+.017,z]);
  };
  for(let i=1;i<sections.length;i++){
    const a=section(sections[i-1]),b=section(sections[i]);
    for(let j=0;j<a.length-1;j++)face(mesh,a[j],a[j+1],b[j+1],b[j],j===1?concrete:lawn);
  }
}

// Public Works London planes in the curb cutouts, followed by a separate
// orthophoto-mapped lawn specimen. Last two columns are metric crown envelopes.
export const waterfrontPlazaTrees=[
  [135213,84.3623,-5.7086,9.5,7.2],
  [135212,85.0549,-5.8699,10.1,7.1],
  [135211,85.4451,-5.9333,8.8,5.8],
  [135210,85.7548,-5.9891,10.3,6.2],
  [135209,86.1986,-6.0736,11.0,6.9],
  [135208,86.6839,-6.1528,11.1,7.2],
  [135207,87.1237,-6.2612,11.9,6.8],
  [135206,87.6153,-6.3419,12.3,6.6],
  [135205,88.0408,-6.4302,11.8,6.4],
  [135204,88.4765,-6.5241,9.7,6.6],
  [135203,88.9816,-6.5865,9.7,6.8],
  [135202,89.4398,-6.7173,8.6,5.9],
  [135201,89.8851,-6.7941,10.7,6.6],
  [135200,90.3183,-6.8924,10.0,4.4],
  [135199,90.9426,-7.1394,9.6,7.6],
  [-170001,88.18,-7.74,6.8,6.3],
] as const;
