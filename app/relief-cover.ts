type Grid = {west:number;south:number;step:number;cols:number;rows:number};
type Point = readonly [longitude:number,latitude:number];

// Rasterize the survey at its original sample vertices. A row intersects
// each polygon edge once. The left bound belongs to the ring, the right
// bound does not, matching the original eastward ray crossing rule.
export function reliefCover(grid:Grid,rings:readonly (readonly Point[])[]){
  const coverage=new Uint8Array(grid.cols*grid.rows);
  function firstColumn(longitude:number){
    let lo=0,hi=grid.cols;
    while(lo<hi){
      const mid=(lo+hi)>>>1;
      if(grid.west+mid*grid.step<longitude)lo=mid+1;
      else hi=mid;
    }
    return lo;
  }
  for(const ring of rings){
    if(!ring.length)continue;
    let south=Infinity,north=-Infinity;
    for(const [,latitude] of ring){south=Math.min(south,latitude);north=Math.max(north,latitude);}
    for(let row=0;row<grid.rows;row++){
      const lat=grid.south+row*grid.step;
      if(lat<south||lat>=north)continue;
      const crossings:number[]=[];
      for(let i=0,j=ring.length-1;i<ring.length;j=i++){
        const [lx,ly]=ring[i],[rx,ry]=ring[j];
        if((ly>lat)!==(ry>lat))crossings.push((rx-lx)*(lat-ly)/(ry-ly)+lx);
      }
      crossings.sort((a,b)=>a-b);
      const start=row*grid.cols;
      for(let i=0;i<crossings.length;i+=2){
        coverage.fill(1,start+firstColumn(crossings[i]),start+firstColumn(crossings[i+1]));
      }
    }
  }
  return coverage;
}
