import {addEmbarcaderoEntrance} from './embarcadero-station.ts';
import {addMarketRunningRails,makeSteuartJunction} from './steuart-junction.ts';
import {addSurveyedFrostTree} from './frost-trees.ts';
import {addMarketLights,insideMarketLampFooting} from './market-lights.ts';
import * as THREE from 'three';
import {addCaliforniaSidewalk,replacedMarketCrossings} from './california-sidewalk.ts';
import {californiaRailGeometry,californiaIslandTop,cableRailHead} from './california-terminal.ts';
import {treeWell} from './tree-wells.ts';
import data from '../public/data/market-street.json' with {type:'json'};
import {footprintGeometry} from './sf-map.ts';
import {waterfrontLandscape} from './waterfront-gardens.ts';
import {waterfrontPalm,waterfrontTree} from './waterfront-trees.ts';

type MeshFactory=(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number,parent?:THREE.Group)=>THREE.Mesh;
type Point=[number,number];
const records=data as unknown as {
  tracks:[number,number,Point[]][];platforms:[number,boolean,Point[]][];
  crossings:[number,Point[]][];entrances:[number,Point,Point][];trees:[number,Point,string,number][];
};

/** The street plane and sidewalks come from the city right-of-way survey.
 * All geometry here sits on it. Keep the F line's Steuart turn and the cable
 * terminal independent: they have different gauges and electrical systems. */
export function addMarketStreet(mesh:MeshFactory,root:THREE.Group){
  const cube=new THREE.BoxGeometry(1,1,1), shaft=new THREE.CylinderGeometry(.70,1,1,8);
  const steel='#536568';
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
  addMarketRunningRails(records.tracks,line);
  root.add(makeSteuartJunction());
  part(californiaRailGeometry(),'#ffffff',0,0,0).name='Lower California cable rails and crossover';
  addCaliforniaSidewalk(part,cableRailHead);
  for(const [id,points] of records.crossings){
    if(replacedMarketCrossings.has(id))continue;
    const path=new THREE.CurvePath<THREE.Vector3>();
    for(let j=1;j<points.length;j++)path.add(new THREE.LineCurve3(new THREE.Vector3(points[j-1][0],0,points[j-1][1]),new THREE.Vector3(points[j][0],0,points[j][1])));
    const n=Math.max(2,Math.round(path.getLength()/.076));
    for(let j=0;j<n;j++){
      const t=(j+.5)/n,p=path.getPointAt(t),axis=path.getTangentAt(t);
      box(p.x,.055,p.z,.17,.003,.032,'#d6d0b9',Math.atan2(axis.x,axis.z)).name='Marked Market crossing';
    }
  }
  for(const [id,shelter,p] of records.platforms){
    const base=.045;
    const top=id===773030143?californiaIslandTop:.063;
    part(footprintGeometry(p,top-base),'#c5bfb0',0,base,0).name='Mapped Muni boarding island';
    if(!shelter)continue;
    const a=p[0],b=p.reduce((best,pt)=>Math.hypot(pt[0]-a[0],pt[1]-a[1])>Math.hypot(best[0]-a[0],best[1]-a[1])?pt:best,a);
    const length=Math.hypot(a[0]-b[0],a[1]-b[1]);if(length<.44)continue;
    const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,ry=Math.atan2(b[0]-a[0],b[1]-a[1]),span=Math.min(.39,length*.64);
    for(const end of [-1,1])mast(x+end*Math.sin(ry)*span*.36,z+end*Math.cos(ry)*span*.36,.006,.145,.064,steel);
    box(x,.215,z,.094,.009,span,'#acaaa0',ry);
  }
  for(const [id,a,b] of records.entrances){
    if(addEmbarcaderoEntrance(part,id))continue;
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
    const trunkRadius=dbh>0?dbh*.0254*.03:undefined;
    if(insideMarketLampFooting(x,z,trunkRadius??0)||planted.some(p=>Math.hypot(p[0]-x,p[1]-z)<.095))continue;
    planted.push([x,z]);
    const h=.06*Math.min(12.5,Math.max(3.5,3+Math.sqrt(dbh||9)*1.45));
    treeWell(part,id,x,.045,z,-Math.atan(.15));
    if(addSurveyedFrostTree(part,x,.049,z,id,species,trunkRadius))continue;
    if(/Washingtonia|Phoenix/.test(species))waterfrontPalm(part,x,.049,z,id,h,h*.24,trunkRadius,species);
    else waterfrontTree(part,x,.049,z,id,h,species,undefined,trunkRadius);
  }
  addMarketLights(root);
}
