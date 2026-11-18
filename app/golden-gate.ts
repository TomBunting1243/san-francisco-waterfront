import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// YRA mark GGB-ST fixes the southern end. Use the marked tower-to-tower
// bearing and the bridge district's 4,200 ft main span to lay out the steel.
export const gateSurvey={south:[-122.478361,37.813966],north:[-122.479141,37.825150],mainMetres:1280,sideMetres:343,topMetres:227,deckMetres:75} as const;
export function distantGoldenGate(project:(lon:number,lat:number)=>[number,number],surface:number,material:THREE.Material){
  const [sx,sz]=project(...gateSurvey.south),[nx,nz]=project(...gateSurvey.north);
  const root=new THREE.Group();
  root.name='Golden Gate at the strait';root.position.set(sx,surface,sz);
  root.rotation.y=Math.atan2(nx-sx,nz-sz);root.scale.setScalar(.06);
  const parts:THREE.BufferGeometry[]=[];
  const beam=(a:THREE.Vector3,b:THREE.Vector3,w:number,d=w)=>{
    const delta=b.clone().sub(a),box=new THREE.BoxGeometry(w,delta.length(),d);
    const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    parts.push(box.applyMatrix4(new THREE.Matrix4().compose(a.clone().lerp(b,.5),rotation,new THREE.Vector3(1,1,1))));
  };
  const point=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const {mainMetres:main,sideMetres:side,topMetres:top,deckMetres:deck}=gateSurvey;
  for(const z of [0,main]){
    for(const flank of [-1,1]){
      const heights=[3,72,130,177,top],widths=[10,9,7.8,6.6];
      for(let i=0;i<4;i++){
        const spread=(y:number)=>flank*(15.5-y*.015);
        beam(point(spread(heights[i]),heights[i],z),point(spread(heights[i+1]),heights[i+1],z),widths[i],16-i*1.15);
      }
    }
    for(const [h,w] of [[72,9],[111,7],[153,6],[190,5],[217,5]]){
      beam(point(-13,h,z),point(13,h,z),w,12);
    }
  }
  beam(point(0,deck-4,-side),point(0,deck-4,main+side),27,8);
  // In a horizontal longitudinal member the box's width axis is X; the
  // short section normal to the roadway is the deck thickness.
  for(const x of [-13.5,13.5])for(const [from,to,left,right,sag] of [[-side,0,deck+5,top,26],[0,main,top,top,144],[main,main+side,top,deck+5,26]]){
    const n=from===0?40:12;
    const cable=(t:number)=>point(x,left+(right-left)*t-4*sag*t*(1-t),from+(to-from)*t);
    for(let i=1;i<=n;i++){
      const end=cable(i/n);beam(cable((i-1)/n),end,1.1);
      if(i%2===0&&end.y>deck+1)beam(point(x,deck,end.z),end,.53);
    }
  }
  const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());
  const steel=new THREE.Mesh(geometry,material);steel.name='Golden Gate suspension silhouette';root.add(steel);
  return root;
}
