import map from '../public/data/sf-waterfront.json' with {type:'json'};
const segments=map.roads.filter(r=>r.name==='The Embarcadero').flatMap(r=>r.p.slice(1).map((b,i)=>({a:r.p[i],b}))).filter(s=>Math.abs(s.b[0]-s.a[0])>.01);
/** Sample the actual curved carriageways, retaining their mapped separation. */
export function streetPose(x:number,direction=1){
  let choices=segments.filter(s=>x>=Math.min(s.a[0],s.b[0])&&x<=Math.max(s.a[0],s.b[0]));
  if(!choices.length)choices=[segments.reduce((best,s)=>Math.min(Math.abs(x-s.a[0]),Math.abs(x-s.b[0]))<Math.min(Math.abs(x-best.a[0]),Math.abs(x-best.b[0]))?s:best)];
  const positions=choices.map(({a,b})=>{const t=Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0])));return {z:a[1]+(b[1]-a[1])*t,slope:(b[1]-a[1])/(b[0]-a[0])};}).sort((a,b)=>a.z-b.z);
  const p=direction>0?positions[positions.length-1]:positions[0];
  return {x,z:p.z,heading:-Math.atan(p.slope)+(direction>0?0:Math.PI)};
}

/** Separate inner lane for the miniature historic streetcar and its rails. */
export function streetcarPose(x:number){const p=streetPose(x);return {...p,z:p.z-.56};}
