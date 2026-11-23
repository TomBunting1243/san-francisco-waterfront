import * as THREE from 'three';
import map from '../public/data/sf-waterfront.json' with {type:'json'};
import {northQuayStations,northWaterfrontGrade} from './north-quay-grade.ts';
import extensions from '../public/data/sightline-streets.json' with {type:'json'};
export {northWaterfrontGrade};
import tracks from '../public/data/embarcadero-tracks.json' with {type:'json'};
const segments=map.roads.filter(r=>r.name==='The Embarcadero').flatMap(r=>r.p.slice(1).map((b,i)=>({a:r.p[i],b}))).filter(s=>Math.abs(s.b[0]-s.a[0])>.01);
// A station bucket retains the source order, including overlapping road
// segments at junctions. Both travel directions share the same lookup.
const stationSegments=new Map<number,typeof segments>();
for(const segment of segments){
  const first=Math.floor(Math.min(segment.a[0],segment.b[0]));
  const last=Math.floor(Math.max(segment.a[0],segment.b[0]));
  for(let station=first;station<=last;station++){
    const bucket=stationSegments.get(station);
    if(bucket)bucket.push(segment);
    else stationSegments.set(station,[segment]);
  }
}
export function streetPoses(x:number){
  const local=stationSegments.get(Math.floor(x));
  let choices=local?.filter(({a,b})=>x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0]));
  if(!choices?.length){
    const distance=({a,b}:typeof segments[number])=>Math.min(Math.abs(x-a[0]),Math.abs(x-b[0]));
    choices=[segments.reduce((best,s)=>distance(s)<distance(best)?s:best)];
  }
  const positions=choices.map(({a,b})=>{
    const t=Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0])));
    return {z:a[1]+(b[1]-a[1])*t,slope:(b[1]-a[1])/(b[0]-a[0])};
  }).sort((a,b)=>a.z-b.z);
  const pose=(p:typeof positions[number],rotation:number)=>({x,z:p.z,heading:-Math.atan(p.slope)+rotation});
  return [pose(positions[0],Math.PI),pose(positions[positions.length-1],0)] as const;
}

/** Sample the actual curved carriageways, retaining their mapped separation. */
export function streetPose(x:number,direction=1){
  return streetPoses(x)[direction>0?1:0];
}

// Both directions follow mapped tram ways. Gauge is measured between the
// inside rail faces. The contact wire is 19 feet above the running surface.
export const streetcarTrack={
  gauge:1.435*.06, railHead:.068*.06, railTop:.057, wireRise:19*.3048*.06,
};
// At the Don Chee wye the rail heads are embedded in the surveyed .031 carriageway.
export const junctionRailTop=.0331;
export function waterfrontRailTop(x:number){
  const flat=Math.min(THREE.MathUtils.smoothstep(x,-9.85,-8.90),1-THREE.MathUtils.smoothstep(x,-6.40,-5.45));
  // The four rail heads also pass flush across the Howard Street roadway.
  const howard=Math.min(THREE.MathUtils.smoothstep(x,-25.50,-24.83),1-THREE.MathUtils.smoothstep(x,-23.52,-22.85));
  return THREE.MathUtils.lerp(streetcarTrack.railTop,junctionRailTop,Math.max(flat,howard))+(x>64?northWaterfrontGrade(x)-.054:0);
}
export function donCheeRailTop(z:number){
  return THREE.MathUtils.lerp(.062,junctionRailTop,THREE.MathUtils.smoothstep(z,-5.3,-4.65));
}
export const trackCenterlines=tracks.tracks.map((line,i)=>[...line,...extensions.outerTracks[i]]);
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
  return {...point,y:waterfrontRailTop(x),heading};
}

type TrackBox=(w:number,h:number,d:number,x:number,y:number,z:number,color:string)=>THREE.Mesh;
type TrackPole=(a:THREE.Vector3,b:THREE.Vector3,r:number,color:string)=>THREE.Mesh;
export function buildStreetcarTrack(box:TrackBox,pole:TrackPole){
  const {gauge,railHead,wireRise}=streetcarTrack;
  for(const original of trackCenterlines){
    // Retain surveyed plan segments while resolving the short approach grades.
    const track=original.flatMap((p,i)=>{
      if(i===0)return [p];
      const a=original[i-1],cuts=[-25.50,-25.28,-25.06,-24.83,-23.52,-23.30,-23.08,-22.85,-9.85,-9.60,-9.37,-9.14,-8.90,-6.40,-6.16,-5.92,-5.69,-5.45,...northQuayStations];
      return [...cuts.filter(x=>a[0]<x&&x<p[0]).map(x=>[x,a[1]+(p[1]-a[1])*(x-a[0])/(p[0]-a[0])]),p];
    });
    let nextSupport=0;
    for(let i=1;i<track.length;i++){
      const [x,z]=track[i],[a,b]=track[i-1],dx=x-a,dz=z-b,len=Math.hypot(dx,dz);
      if(len<.001)continue;
      const nx=-dz/len,nz=dx/len,y0=waterfrontRailTop(a),y1=waterfrontRailTop(x),wireY=y1+wireRise;
      for(const sign of [-1,1]){
        const offset=sign*(gauge+railHead)/2;
        const rail=box(railHead,.009,Math.hypot(len,y1-y0)+(x>-10&&a< -5?.004:.001),(a+x)/2+offset*nx,(y0+y1)/2-.0045,(b+z)/2+offset*nz,'#909991');
        rail.name='Running rail';rail.rotation.order='YXZ';rail.rotation.y=Math.atan2(dx,dz);rail.rotation.x=-Math.atan2(y1-y0,len);
      }
      pole(new THREE.Vector3(a,y0+wireRise,b),new THREE.Vector3(x,wireY,z),.0012,'#53645e').name='Contact wire';
      nextSupport-=len;
      if(nextSupport<=0){
        nextSupport=1.8;
        // The two stop_position nodes sit under the Ferry Terminal roofs;
        // the intervening rail-crossing nodes are in the pedestrian crossing.
        // The contact wire continues across them on the span-wire system.
        if(Math.abs(x+.228)<.012||(original===trackCenterlines[0]&&x>.70&&x<3.1)||(original===trackCenterlines[1]&&x> -3.57&&x< -1.22))continue;
        // One cantilever per track, on the outside of the pair.
        const side=original===trackCenterlines[0]?1:-1;
        const sx=x+nx*side*.25,sz=z+nz*side*.25;
        pole(new THREE.Vector3(sx,.032+(sx>64?northWaterfrontGrade(sx)-.054:0),sz),new THREE.Vector3(sx,wireY+.04,sz),.0055,'#345564');
        pole(new THREE.Vector3(sx,wireY+.035,sz),new THREE.Vector3(x,wireY,z),.0028,'#345564');
      }
    }
  }
}
