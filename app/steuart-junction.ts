import * as THREE from 'three';
import junction from '../public/data/steuart-junction.json' with {type:'json'};
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import {marketRailCenter,marketRailTop,registeredMarketTracks} from './california-sidewalk.ts';
import {streetcarTrack,trackCenterlines,donCheeRailTop} from './streets.ts';

type Point=number[];
const {gauge,railHead,wireRise}=streetcarTrack;
const marketJoin=-5.3;
const approachY=marketRailCenter(marketJoin)+.002;
const approachWire=marketRailTop(marketJoin)+wireRise;
function direction(a:Point,b:Point){
  const dx=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dx,dz);
  return [dx/d,dz/d];
}

// SFMTA curb return 3818976 ends at (-8.513,-7.824), normal (.936,-.351).
// Its transverse gutter cap supplies the first two shared edges. The short
// side taper reaches the independently registered aerial curb near the door.
const bed=[[-8.56,-7.50,-8.42],[-8.478368,-7.52,-7.836987],[-8.5108472,-7.52,-7.8248073],
  [-8.490,-7.52,-7.774],[-8.458,-7.52,-7.709],[-8.40,-7.52,-7.61],[-8.3832,-7.518,-7.48],[-8.325,-7.51,-7.03],
  [-8.26,-7.44,-6.24],[-8.23,-7.35,-5.53],[-8.16,-7.27,-5.30],[-8.12,-7.23,-5.14],[-8.09,-7.20,-4.98],[-8.07,-7.17,-4.81],[-8.04,-7.13,-4.65]];
export const donCheeHotelCurb=bed.map(([x,,z]):[number,number]=>[x,z]);
export const donCheeBedHeight=(z:number)=>donCheeRailTop(z)-.0021;
// The local outer margin descends toward Steuart's roadway; rails retain
// their running levels across this triangular concrete apron.
const cornerHeights=[.03116,.032,.0315,.0354,.0404,.0586,.0599];
export function donCheeGutterHeight(z:number){
  const i=bed.findIndex(row=>row[2]>=z);
  if(i===0)return cornerHeights[0];
  if(i<0||i>=cornerHeights.length)return donCheeBedHeight(z);
  const a=bed[i-1][2],b=bed[i][2];
  return THREE.MathUtils.lerp(cornerHeights[i-1],cornerHeights[i],(z-a)/(b-a));
}

type PlanPoint=[number,number];
type TrackStrip=(a:PlanPoint,b:PlanPoint,y:number,w:number,h:number,paint:string)=>THREE.Mesh;
export function addMarketRunningRails(tracks:[number,number,PlanPoint[]][],line:TrackStrip){
  for(const [id,cable,original] of tracks){
    if(cable)continue; // The complete California terminal uses its own surveyed crossover.
    const points=registeredMarketTracks[id]??original;
    const gauge=1.435*.06;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      function trackStrip(offset:number,y0:number,y1:number,w:number,h:number,color:string){
        const ox=dz/len*offset,oz=-dx/len*offset;
        const obj=line([a[0]+ox,a[1]+oz],[b[0]+ox,b[1]+oz],(y0+y1)/2,w,h,color);
        obj.scale.z=Math.hypot(len,y1-y0)+(a[0]<-7&&a[1]>-8&&b[1]>-8?.002:0);
        obj.rotation.order='YXZ';obj.rotation.x=-Math.atan2(y1-y0,len);
        return obj;
      }
      for(const sign of [-1,1]){
        trackStrip(gauge*.5*sign,marketRailCenter(a[1]),marketRailCenter(b[1]),streetcarTrack.railHead,.004,'#a9aaa0').name='Market running rail';
      }
      trackStrip(0,marketRailTop(a[1])+streetcarTrack.wireRise,marketRailTop(b[1])+streetcarTrack.wireRise,.003,.003,'#606a65').name='F line contact wire';
    }
  }
}

/** The rail map's four junction nodes are shared with the Embarcadero mains.
 * Only the two curves bending north are scheduled F passenger movements.
 * https://www.sfmta.com/routes/f-market-wharves */
export function makeSteuartJunction(){
  const panels=new FacadePanels();
  // Limits of the concrete reservation in the SF 2024 p2024_rgb8cm ortho.
  // At the Steuart end the track crosses existing asphalt. At the opposite
  // end the reservation descends flush to the surveyed Embarcadero roadway.
  for(let k=1;k<bed.length;k++){
    const [a,b,z]=bed[k-1],[c,d,w]=bed[k];
    const h=donCheeBedHeight(z),j=donCheeBedHeight(w);
    if(k<cornerHeights.length){
      // Ease the track-side apron into the asphalt without lifting either rail.
      const insideA=a+Math.min(.175,(b-a)*.21),insideC=c+Math.min(.175,(d-c)*.21);
      panels.quad([a,donCheeGutterHeight(z),z],[c,donCheeGutterHeight(w),w],[insideC,j,w],[insideA,h,z],'#ada89a');
      panels.quad([insideA,h,z],[insideC,j,w],[d,j,w],[b,h,z],'#ada89a');
    }else panels.quad([a,h,z],[c,j,w],[d,j,w],[b,h,z],'#ada89a');
  }
  // The rounded outside gutter and the taper meet beyond the final oblique
  // edge of Steuart road polygon 111. Close the 0.01 m² intersection of the
  // three edges with one gutter triangle, sharing existing road and apron vertices.
  panels.triangle([-8.484980,.031,-7.854493],[-8.478368,.032,-7.836987],
    [-8.480904,donCheeGutterHeight(-7.855098),-7.855098],'#989c91');
  function track(original:Point[],endAxis?:Point){
    const path=original.flatMap((p,i)=>{
      if(i===0)return [p];
      const a=original[i-1],n=Math.ceil(Math.hypot(p[0]-a[0],p[1]-a[1])/(a[1]<-4.65?.08:1));
      return Array.from({length:n},(_,j)=>[a[0]+(p[0]-a[0])*(j+1)/n,a[1]+(p[1]-a[1])*(j+1)/n]);
    });
    for(const sign of [-1,0,1]){
      const wire=sign===0;
      let last:FacadePoint[]=[];
      path.forEach((p,i)=>{
        const incoming=direction(path[Math.max(0,i-1)],i===0?path[1]:p);
        const outgoing=i+1<path.length?direction(p,path[i+1]):endAxis??incoming;
        const nx=incoming[1]+outgoing[1],nz=-incoming[0]-outgoing[0];
        const divisor=1+incoming[0]*outgoing[0]+incoming[1]*outgoing[1];
        // Finish the very small change of rail section before the diamond.
        const u=THREE.MathUtils.smoothstep(p[1],-5.30,-4.05);
        const halfGauge=(gauge+u*railHead)*.5;
        const height=wire?donCheeRailTop(p[1])+wireRise+(approachWire-approachY-wireRise)*(1-u):donCheeRailTop(p[1]);
        const hw=wire?.00135:railHead*.5,low=wire?height-.00135:height-.004,high=wire?height+.00135:height;
        const vertex=(side:number,y:number):FacadePoint=>[p[0]+nx/divisor*(sign*halfGauge+side*hw),y,p[1]+nz/divisor*(sign*halfGauge+side*hw)];
        const v=[vertex(-1,high),vertex(1,high),vertex(1,low),vertex(-1,low)];
        if(last.length){
          const ink=wire?'#58655e':'#a3a79e';
          for(let k=0;k<(wire?4:3);k++){
            const a=wire?k:[0,1,3][k],b=(a+1)%4;
            panels.quad(last[a],v[a],v[b],last[b],ink);
          }
        }
        last=v;
      });
    }
  }
  track(junction.westJoin);track(junction.eastJoin);
  for(const {points} of junction.curves){
    const end=points[points.length-1];
    // Keep the turnout tongue tangent to the receiving main at its actual node.
    const main=trackCenterlines.find(line=>line.some(p=>p[0]===end[0]&&p[1]===end[1]))!;
    const i=main.findIndex(p=>p[0]===end[0]&&p[1]===end[1]);
    const next=main[i+(end[0]>points[0][0]?1:-1)];
    track(points,direction(end,next));
  }
  // The mapped ways are the square high landings, tagged 2 ft 10 in.
  // Both 2024 aerial ramp runs extend back toward Steuart, irrespective of
  // vehicle direction. SFMTA uses a portable bridge plate across the gap.
  // https://www.sfmta.com/getting-around/accessibility/muni-accessibility/muni-access-guide/access-historic-streetcars
  for(const ring of junction.landings){
    const [east,,west,,d]=ring;
    const axis=direction(east,d),span=direction(east,west);
    // The independently mapped rail and platform lines agree to ~0.15 m.
    // Register the edge to the car envelope and inset the handrail feet.
    const inbound=ring===junction.landings[1];
    const a=[east[0]+(inbound?.008:0)*span[0],east[1]+(inbound?.008:0)*span[1]];
    const b=[west[0]-(inbound?0:.008)*span[0],west[1]-(inbound?0:.008)*span[1]];
    const ground=approachY-.0021,top=ground+34*.0254*.06,run=.631;
    function at(p:Point,t:number,y:number):FacadePoint{return [p[0]+axis[0]*t,y,p[1]+axis[1]*t];}
    const y=(t:number)=>ground+(top-ground)*THREE.MathUtils.clamp(1+t/run,0,1);
    const end=Math.hypot(d[0]-east[0],d[1]-east[1]);
    for(const [start,finish] of [[-run,0],[0,end]]){
      const high=[at(a,start,y(start)),at(b,start,y(start)),at(b,finish,y(finish)),at(a,finish,y(finish))];
      panels.quad(high[0],high[1],high[2],high[3],'#bdb7a9');
      for(const [i,j] of [[0,3],[2,1],[3,2]]){
        if(i===3&&finish===0)continue;
        const l=high[i],r=high[j];
        panels.quad(r,l,[l[0],ground,l[2]],[r[0],ground,r[2]],'#a09b90');
      }
    }
    // Keep the platform nose open for the bridge plate. Side rails stop at the landing.
    for(const side of [a,b]){
      const inset=side===a?.006:-.006;
      const foot=[side[0]+inset*span[0],side[1]+inset*span[1]];
      const edge=(t:number,h:number):FacadePoint=>at(foot,t,y(t)+h);
      function bar(t0:number,h0:number,t1:number,h1:number){
        const l=edge(t0,h0),r=edge(t1,h1);
        const beam=new THREE.Vector3(r[0]-l[0],r[1]-l[1],r[2]-l[2]).normalize();
        const across=new THREE.Vector3(axis[1],0,-axis[0]).multiplyScalar(.0017);
        const perp=beam.clone().cross(across).normalize().multiplyScalar(.0017);
        const section=(p:FacadePoint)=>[[-1,-1],[-1,1],[1,1],[1,-1]].map(([i,j]):FacadePoint=>[p[0]+i*across.x+j*perp.x,p[1]+j*perp.y,p[2]+i*across.z+j*perp.z]);
        const v=section(l),w=section(r);
        for(let i=0;i<4;i++)panels.quad(v[i],v[(i+1)%4],w[(i+1)%4],w[i],'#606761');
      }
      bar(-run,.052,0,.052);
      for(const t of [-run,-run*.66,-run*.33,0])bar(t,0,t,.052);
    }
  }
  const mesh=panels.mesh(new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.79}));
  mesh.name='Don Chee track junction and accessible platforms';mesh.receiveShadow=true;
  return mesh;
}
