import street from '../public/data/market-street.json' with {type:'json'};

// BART 15LK-140 G001, Embarcadero ES1/2/3/4/7/8. The OSM points mark
// the escalator, not the center of the combined stair and escalator well.
// Roof offsets from the upper OSM pin are in metres, projected into the
// descent axis on the City's 2024 8 cm aerial. Drumm and Main show uncovered
// stair openings there: fit those two roofs from BART's common ES1 section.
const survey:Record<number,[string,number,number,number,number,number]>={
  309820436:['Drumm',1.06,-4.4,10.6,6.25,-1],
  309820442:['Spear',1.50,-4.4,10.0,6.25,-1],
  4343738971:['Davis',.72,-5.0,9.3,6.5,-1],
  4343738965:['Main',-1.55,-4.4,10.6,6.25,1],
  386586392:['Pine',-.10,-4.0,11.4,6.31,1],
  386587552:['Beale',-2.00,-4.7,10.6,6.44,1],
};
export const stationSites=new Map((street.entrances as [number,number[],number[]][]).flatMap(([id,a,b])=>{
  if(!survey[id])return [];
  const [name,shift,front,end,width,escalatorSide]=survey[id];
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
  const point=(u:number,v:number):[number,number]=>[a[0]+.06*((u+shift)*dz+v*dx),a[1]+.06*(-(u+shift)*dx+v*dz)];
  const well=width-2.35,back=end-1.65;
  const outline=[point(-well/2,.10),point(well/2,.10),point(well/2,back),point(-well/2,back)];
  const xs=outline.map(p=>p[0]),zs=outline.map(p=>p[1]);
  return [[id,{name,point,front,end,width,escalatorSide,well,back,outline,
    xmin:Math.min(...xs),xmax:Math.max(...xs),zmin:Math.min(...zs),zmax:Math.max(...zs)}] as const];
}));
const sites=[...stationSites.values()];
const bounds={
  xmin:Math.min(...sites.map(s=>s.xmin)),xmax:Math.max(...sites.map(s=>s.xmax)),
  zmin:Math.min(...sites.map(s=>s.zmin)),zmax:Math.max(...sites.map(s=>s.zmax)),
};

/** Subtract each stair rectangle from an otherwise opaque surface triangle.
 * Carry the grade through new edge vertices; untouched triangles use the caller's indices. */
export function stationPavingCut<T extends number[]>(a:T,b:T,c:T):T[][]|undefined{
  const z=a.length-1;
  const x0=Math.min(a[0],b[0],c[0]),x1=Math.max(a[0],b[0],c[0]),z0=Math.min(a[z],b[z],c[z]),z1=Math.max(a[z],b[z],c[z]);
  if(z1<bounds.zmin||z0>bounds.zmax||x1<bounds.xmin||x0>bounds.xmax)return;
  let fragments:T[][]|undefined;
  for(const s of sites){
    if(x1<s.xmin||x0>s.xmax||z1<s.zmin||z0>s.zmax)continue;
    const outside:T[][]=[];
    for(const input of fragments??[[a,b,c]]){
      let inside=input;
      for(let k=0;k<4&&inside.length;k++){
        const p=s.outline[k],q=s.outline[(k+1)%4];
        const side=(v:T)=>(q[0]-p[0])*(v[z]-p[1])-(q[1]-p[1])*(v[0]-p[0]);
        const next:T[]=[],rest:T[]=[];
        for(let i=0;i<inside.length;i++){
          const l=inside[i],r=inside[(i+1)%inside.length],dl=side(l),dr=side(r);
          (dl>=0?next:rest).push(l);
          if((dl<0&&dr>0)||(dl>0&&dr<0)){
            const t=dl/(dl-dr),cross=l.map((v,j)=>v+t*(r[j]-v)) as T;
            next.push(cross);rest.push(cross);
          }else if(dl===0||dr===0){
            if(dl===0&&dr<0)rest.push(l);
            if(dl<0&&dr===0)rest.push(r);
          }
        }
        if(rest.length>=3)outside.push(rest);
        inside=next;
      }
    }
    fragments=outside;
  }
  if(!fragments)return;
  return fragments.flatMap(p=>p.slice(2).map((v,i)=>[p[0],p[i+1],v]));
}
