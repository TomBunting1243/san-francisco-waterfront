import * as THREE from 'three';
import {treeWell} from './tree-wells.ts';
import data from '../public/data/market-street.json' with {type:'json'};
import {footprintGeometry} from './sf-map.ts';
import {streetcarTrack} from './streets.ts';
import {waterfrontLandscape} from './waterfront-gardens.ts';
import {waterfrontPalm,waterfrontTree} from './waterfront-trees.ts';

type MeshFactory=(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number,parent?:THREE.Group)=>THREE.Mesh;
type Point=[number,number];
const records=data as unknown as {
  tracks:[number,number,Point[]][];platforms:[number,boolean,Point[]][];
  crossings:[number,Point[]][];entrances:[number,Point,Point][];trees:[number,Point,string,number][];
};
const marketX=(z:number)=>.15*z+.019;

/** The street plane and sidewalks come from the city right-of-way survey.
 * All geometry here sits on it. Keep the F line's Steuart turn and the cable
 * terminal independent: they have different gauges and electrical systems. */
export function addMarketStreet(mesh:MeshFactory,root:THREE.Group){
  const cube=new THREE.BoxGeometry(1,1,1), shaft=new THREE.CylinderGeometry(.70,1,1,8);
  const orb=new THREE.SphereGeometry(1,8,6);
  const steel='#536568',bronze='#655e4e',warmGlass='#ead9ab';
  const part=(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number)=>mesh(g,c,x,y,z,root);
  function box(x:number,y:number,z:number,w:number,h:number,d:number,c:string,ry=0){
    const obj=part(cube,c,x,y,z);obj.scale.set(w,h,d);obj.rotation.y=ry;return obj;
  }
  function line(a:Point,b:Point,y:number,w:number,h:number,c:string){
    const dx=b[0]-a[0],dz=b[1]-a[1];
    return box((a[0]+b[0])/2,y,(a[1]+b[1])/2,w,h,Math.hypot(dx,dz),c,Math.atan2(dx,dz));
  }
  function mast(x:number,z:number,r:number,h:number,base:number,paint:string){
    const k=part(shaft,paint,x,base+h/2,z);k.scale.set(r,h,r);return k;
  }
  // City public-service kiosk SFO0003SF, 19 Market at Steuart. The 2013
  // street-level photograph puts it curbside on the Hyatt frontage; its
  // position along that surveyed sidewalk is approximate.
  const kioskX=-1.425,kioskZ=-12.51,kioskY=.046;
  const kioskGreen='#354c46',kioskTrim='#52645a';
  const silhouette=[
    [.036,0],[.036,.008],[.033,.011],[.033,.020],[.030,.023],
    [.030,.176],[.034,.179],[.037,.185],[.037,.192],[.033,.195],
    [.033,.204],[.031,.207],[.028,.211],[.022,.216],[.010,.221],[.005,.226],[0,.228],
  ];
  const kiosk=part(new THREE.LatheGeometry(silhouette.map(([r,y])=>new THREE.Vector2(r,y)),24),kioskGreen,kioskX,kioskY,kioskZ);
  kiosk.name='Market and Steuart cast-iron poster column';
  for(let j=0;j<3;j++){
    const angle=j*2*Math.PI/3+.24;
    for(const [radius,h,y,arc,paint] of [[.0307,.147,.102,1.80,kioskTrim],[.0311,.137,.102,1.67,'#c4bb9f']] as const){
      part(new THREE.CylinderGeometry(radius,radius,h,12,1,true,angle-arc/2,arc),paint,kioskX,kioskY+y,kioskZ).name='Curved poster frame and paper';
    }
  }
  for(const [,cable,points] of records.tracks){
    const gauge=(cable?1.067:1.435)*.06;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      for(const sign of [-1,1]){
        const ox=dz/len*gauge*.5*sign,oz=-dx/len*gauge*.5*sign;
        line([a[0]+ox,a[1]+oz],[b[0]+ox,b[1]+oz],.060,streetcarTrack.railHead,.004,'#a9aaa0').name='Market running rail';
      }
      if(cable)line(a,b,.059,.007,.003,'#65665e').name='California cable slot';
      else line(a,b,.060+streetcarTrack.wireRise,.003,.003,'#606a65').name='F line contact wire';
    }
  }
  for(const [,points] of records.crossings){
    const path=new THREE.CurvePath<THREE.Vector3>();
    for(let j=1;j<points.length;j++)path.add(new THREE.LineCurve3(new THREE.Vector3(points[j-1][0],0,points[j-1][1]),new THREE.Vector3(points[j][0],0,points[j][1])));
    const n=Math.max(2,Math.round(path.getLength()/.076));
    for(let j=0;j<n;j++){
      const t=(j+.5)/n,p=path.getPointAt(t),axis=path.getTangentAt(t);
      box(p.x,.055,p.z,.17,.003,.032,'#d6d0b9',Math.atan2(axis.x,axis.z)).name='Marked Market crossing';
    }
  }
  for(const [,shelter,p] of records.platforms){
    part(footprintGeometry(p,.018),'#c5bfb0',0,.045,0).name='Mapped Muni boarding island';
    if(!shelter)continue;
    const a=p[0],b=p.reduce((best,pt)=>Math.hypot(pt[0]-a[0],pt[1]-a[1])>Math.hypot(best[0]-a[0],best[1]-a[1])?pt:best,a);
    const length=Math.hypot(a[0]-b[0],a[1]-b[1]);if(length<.44)continue;
    const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,ry=Math.atan2(b[0]-a[0],b[1]-a[1]),span=Math.min(.39,length*.64);
    for(const end of [-1,1])mast(x+end*Math.sin(ry)*span*.36,z+end*Math.cos(ry)*span*.36,.006,.145,.064,steel);
    box(x,.215,z,.094,.009,span,'#acaaa0',ry);
  }
  for(const [,a,b] of records.entrances){
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!length)continue;
    const dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length,span=Math.min(.99,length),w=.175;
    const cx=a[0]+dx*span/2,cz=a[1]+dz*span/2,ry=Math.atan2(dx,dz);
    box(cx,.052,cz,w,.007,span,'#475c60',ry);
    for(const side of [-1,1]){
      const x=cx+dz*w*side*.47,z=cz-dx*w*side*.47;
      box(x,.077,z,.012,.063,span,'#9a9e93',ry);
      for(const along of [-.44,0,.44])mast(x+dx*span*along,z+dz*span*along,.006,.176,.053,steel);
    }
    box(cx,.233,cz,w+.014,.009,span+.022,'#b4bdb6',ry).name='Market Street station entrance canopy';
    box(a[0],.207,a[1],w,.026,.010,'#485852',ry);
  }
  // The inventory identifies trunks and species. Crown height is an estimate
  // from trunk diameter; a newly planted tree keeps its much smaller silhouette.
  const planted:Point[]=waterfrontLandscape.trees.map(t=>t.p as Point);
  for(const [id,[x,z],species,dbh] of records.trees){
    if(planted.some(p=>Math.hypot(p[0]-x,p[1]-z)<.095))continue;
    planted.push([x,z]);
    const h=.06*Math.min(12.5,Math.max(3.5,3+Math.sqrt(dbh||9)*1.45));
    const trunkRadius=dbh>0?dbh*.0254*.03:undefined;
    treeWell(part,id,x,.045,z,-Math.atan(.15));
    if(/Washingtonia|Phoenix/.test(species))waterfrontPalm(part,x,.049,z,id,h,h*.24,trunkRadius,species);
    else waterfrontTree(part,x,.049,z,id,h,species,undefined,trunkRadius);
  }
  // Three opal globes, the middle one raised, on cast-iron trolley poles.
  // The city designation documents the fitting; the spacing is interpreted.
  for(let z=-11.65;z> -61;z-=1.98)for(const side of [-1,1]){
    const x=marketX(z)+side*.91;
    if(planted.some(p=>Math.hypot(p[0]-x,p[1]-z)<.14)||records.crossings.some(([,p])=>p.some(q=>Math.hypot(q[0]-x,q[1]-z)<.23)))continue;
    mast(x,z,.022,.126,.048,bronze);mast(x,z,.013,.47,.134,'#4c5f5c');
    mast(x,z,.009,.087,.598,bronze);
    box(x,.602,z,.131,.012,.012,bronze);
    for(const s of [-1,0,1]){
      const y=s===0?.692:.650,u=x+s*.061;
      mast(u,z,.010,.04,y-.050,bronze);
      const globe=part(orb,warmGlass,u,y,z);globe.scale.set(.018,.026,.018);
      globe.userData.signLight=[.29,.16,.048];globe.name='Path of Gold globe';
      const cap=part(orb,bronze,u,y+.022,z);cap.scale.set(.014,.005,.014);
    }
    if(side>0)line([x,z],[x-1.82,z],.060+streetcarTrack.wireRise+.004,.0025,.0025,'#656c64');
  }
}
