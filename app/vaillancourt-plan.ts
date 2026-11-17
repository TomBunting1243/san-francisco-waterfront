/** Digitized centerlines from the 1969 sculpture sheets S1, S3–S5 reproduced in the
 * Page & Turnbull assessment, pp. 44–48. u/v refer to the 1850 px-wide plan; h is
 * height above pool taken from the corresponding elevation at the same scale.
 * One 4'-6" tube measures 42 drawing units. The miniature uses .06 units per metre. */
type Station=[number,number,number];
const scale=1.3716*.06/42;
export const tubeWidth=42*scale;
export function planPoint(u:number,v:number):[number,number] {
  return [(925-u)*scale,(495-v)*scale];
}
export const basinOutline=[[316,803],[717,116],[1642,172],[1543,674],[927,1050]].map(([u,v])=>planPoint(u,v));
export const screenRuns=[
  [[368,770],[744,157],18],[[744,157],[1563,221],20],
] as const;
export const observationDecks=[
  {start:[417,574],end:[578,306],inward:[.86,.51]},
  {start:[911,104],end:[1200,127],inward:[-.08,1]},
];
const runs:{id:string;stations:Station[];fall:boolean}[]=[];
function trace(id:string,stations:Station[],fall=true){runs.push({id,stations,fall});}
// Starting at the corner and following the eastern screen. Side arms rise at
// different heights on the same column. EJ is the tall A-shaped diagonal.
trace('EC',[[832,164,-20],[832,164,315],[824,281,315],[817,354,212]]);
trace('EC lower',[[832,164,142],[823,279,142]]);
trace('EF',[[960,171,-20],[960,171,182],[951,264,182],[946,355,47]],false);
trace('EF transverse',[[965,64,183],[952,263,183],[1065,271,183]]);
trace('EJ',[[1134,184,-20],[1134,184,184],[1121,351,313],[1100,570,32]]);
trace('EJ brace',[[1224,486,-12],[1224,486,41],[1109,464,110]],false);
trace('EL',[[1215,190,-18],[1215,190,140],[1344,200,140],[1344,200,63]]);
trace('EO',[[1348,204,-20],[1348,204,166],[1340,291,223],[1226,346,301],[1229,395,235]]);
// Bent north screen. The free-standing PA fountain crosses the open pool on its
// own footing; it does not join a row of ducts coming from the screen.
trace('DC upper',[[708,220,-16],[708,220,183],[785,269,239],[940,367,151]]);
trace('DC cross',[[676,288,163],[783,268,238],[712,356,70]]);
trace('DH',[[644,344,-20],[644,344,141],[789,438,141]]);
trace('EH',[[608,405,-20],[608,405,109],[760,505,109]]);
trace('DK',[[529,532,-18],[529,532,141],[594,573,141],[687,627,24]]);
trace('DK cross',[[598,680,149],[597,574,149],[694,538,88]]);
trace('DL',[[503,559,-20],[503,559,181],[579,603,238],[681,546,302],[729,581,241]]);
trace('PA',[[813,660,-18],[813,660,30],[899,607,113],[914,517,160]]);
export const fountainCourses=runs.map(({stations,...course})=>({...course,path:stations.map(([u,v,h])=>{
  const [x,z]=planPoint(u,v);return [x,h*scale,z] as [number,number,number];
})}));

/** Keep the pieces of a paving stone outside the convex basin rim. A partial
 * stone is cut at the same surveyed edge as the pool, including at its corners. */
export function cutPavingAtBasin(tile:number[][],ring:number[][]) {
  const winding=Math.sign(ring.reduce((area,a,i)=>{
    const b=ring[(i+1)%ring.length];return area+a[0]*b[1]-a[1]*b[0];
  },0));
  const remainder:number[][][]=[];
  let inside=tile;
  for(let e=0;e<ring.length&&inside.length>=3;e++){
    const a=ring[e],b=ring[(e+1)%ring.length];
    const side=(p:number[])=>winding*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
    const keep:number[][]=[],outside:number[][]=[];
    for(let i=0;i<inside.length;i++){
      const p=inside[i],q=inside[(i+1)%inside.length],dp=side(p),dq=side(q);
      (dp>=0?keep:outside).push(p);
      if((dp<0)!==(dq<0)){
        const t=dp/(dp-dq),cross=[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
        keep.push(cross);outside.push(cross);
      }
    }
    if(outside.length>=3)remainder.push(outside);
    inside=keep;
  }
  return remainder;
}
