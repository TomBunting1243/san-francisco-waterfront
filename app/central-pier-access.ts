const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
export const pierOneHalfFront=(x:number)=>-1.815+(x-14.047)*.0086;
export const entryX=16.515,apronStart=-1.990,apronEnd=-1.625,clearHalf=.186,apronHalf=.252;
// Historic street-to-wharf transition. The curb survey is at .031 and the
// bulkhead deck is at .060. Interpolate on the same triangles used by the mesh.
export function pierOneHalfPassageHeight(x:number,z:number){
  const along=clamp((z-apronStart)/(apronEnd-apronStart),0,1);
  if(z>=apronEnd)return .060;
  const side=clamp((apronHalf-Math.abs(x-entryX))/(apronHalf-clearHalf),0,1);
  if(!side&&z>=pierOneHalfFront(x))return .060;
  return .031+.029*Math.min(along,side);
}
