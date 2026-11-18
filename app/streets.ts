import * as THREE from 'three';
import map from '../public/data/sf-waterfront.json' with {type:'json'};
import tracks from '../public/data/embarcadero-tracks.json' with {type:'json'};
const segments=map.roads.filter(r=>r.name==='The Embarcadero').flatMap(r=>r.p.slice(1).map((b,i)=>({a:r.p[i],b}))).filter(s=>Math.abs(s.b[0]-s.a[0])>.01);
/** Sample the actual curved carriageways, retaining their mapped separation. */
export function streetPose(x:number,direction=1){
  let choices=segments.filter(s=>x>=Math.min(s.a[0],s.b[0])&&x<=Math.max(s.a[0],s.b[0]));
  if(!choices.length)choices=[segments.reduce((best,s)=>Math.min(Math.abs(x-s.a[0]),Math.abs(x-s.b[0]))<Math.min(Math.abs(x-best.a[0]),Math.abs(x-best.b[0]))?s:best)];
  const positions=choices.map(({a,b})=>{const t=Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0])));return {z:a[1]+(b[1]-a[1])*t,slope:(b[1]-a[1])/(b[0]-a[0])};}).sort((a,b)=>a.z-b.z);
  const p=direction>0?positions[positions.length-1]:positions[0];
  return {x,z:p.z,heading:-Math.atan(p.slope)+(direction>0?0:Math.PI)};
}

// Both directions follow mapped tram ways. Gauge is measured between the
// inside rail faces. The contact wire is 19 feet above the running surface.
export const streetcarTrack={
  gauge:1.435*.06, railHead:.068*.06, railTop:.057, wireRise:19*.3048*.06,
};
export const trackCenterlines=tracks.tracks;
export function trackAt(x:number,line=trackCenterlines[0]){
  let lo=0,hi=line.length-1;
  while(hi-lo>1){
    const mid=(lo+hi)>>1;
    if(line[mid][0]<=x)lo=mid;else hi=mid;
  }
  const [ax,az]=line[lo],[bx,bz]=line[hi],slope=(bz-az)/(bx-ax);
  return {x,z:az+(x-ax)*slope,heading:-Math.atan(slope)};
}

// Use the contact shoe as the trailing end of the short chord on curves.
// This keeps the collector on the actual overhead even at the tightest bend.
export const shoeTrail=1.05*((48+5/12)*.3048*.06/3.629);
export function streetcarPose(x:number){
  const point=trackAt(x);
  let heading=point.heading;
  for(let i=0;i<3;i++){
    const trailing=trackAt(x-shoeTrail*Math.cos(heading));
    heading=-Math.atan2(point.z-trailing.z,point.x-trailing.x);
  }
  return {...point,y:streetcarTrack.railTop,heading};
}

type TrackBox=(w:number,h:number,d:number,x:number,y:number,z:number,color:string)=>THREE.Mesh;
type TrackPole=(a:THREE.Vector3,b:THREE.Vector3,r:number,color:string)=>THREE.Mesh;
export function buildStreetcarTrack(box:TrackBox,pole:TrackPole){
  const {gauge,railHead,railTop,wireRise}=streetcarTrack;
  for(const track of trackCenterlines){
    let nextSupport=0;
    for(let i=1;i<track.length;i++){
      const [x,z]=track[i],[a,b]=track[i-1],dx=x-a,dz=z-b,len=Math.hypot(dx,dz);
      if(len<.001)continue;
      const nx=-dz/len,nz=dx/len,wireY=railTop+wireRise;
      for(const sign of [-1,1]){
        const offset=sign*(gauge+railHead)/2;
        const rail=box(railHead,.009,len+.001,(a+x)/2+offset*nx,railTop-.0045,(b+z)/2+offset*nz,'#909991');
        rail.name='Running rail';rail.rotation.y=Math.atan2(dx,dz);
      }
      pole(new THREE.Vector3(a,wireY,b),new THREE.Vector3(x,wireY,z),.0012,'#53645e').name='Contact wire';
      nextSupport-=len;
      if(nextSupport<=0){
        // One cantilever per track, on the outside of the pair.
        const side=track===trackCenterlines[0]?1:-1;
        const sx=x+nx*side*.25,sz=z+nz*side*.25;
        pole(new THREE.Vector3(sx,.032,sz),new THREE.Vector3(sx,wireY+.04,sz),.0055,'#345564');
        pole(new THREE.Vector3(sx,wireY+.035,sz),new THREE.Vector3(x,wireY,z),.0028,'#345564');
        nextSupport=1.8;
      }
    }
  }
}
