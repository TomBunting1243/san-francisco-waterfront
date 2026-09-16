export const waterSurface={size:1400,columns:120,rows:110,level:-.7};

/** Match the rendered water triangles, including interpolation between wave vertices. */
export function waterHeight(x:number,z:number,time:number){
  const {size,columns,rows,level}=waterSurface,dx=size/columns,dz=size/rows;
  const gx=(x+size/2)/dx,gz=(z+size/2)/dz,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz;
  const wave=(cx:number,cz:number)=>Math.sin((cx*dx-size/2)*.47+time*.5)*.08+Math.cos((size/2-cz*dz)*.64+time*.65)*.06;
  const h00=wave(ix,iz),h10=wave(ix+1,iz),h01=wave(ix,iz+1),h11=wave(ix+1,iz+1);
  return level+(u+v<=1?h00+(h10-h00)*u+(h01-h00)*v:h11+(h01-h11)*(1-u)+(h10-h11)*(1-v));
}
