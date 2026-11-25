type Opening={outline:number[][];xmin:number;xmax:number;zmin:number;zmax:number};

/** Cut convex openings from a triangle, interpolating the elevation at each crossing. */
export function pavementCutter(sites:Opening[]){
  const bounds={
    xmin:Math.min(...sites.map(s=>s.xmin)),xmax:Math.max(...sites.map(s=>s.xmax)),
    zmin:Math.min(...sites.map(s=>s.zmin)),zmax:Math.max(...sites.map(s=>s.zmax)),
  };

  return function cut<T extends number[]>(a:T,b:T,c:T):T[][]|undefined{
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
  };
}
