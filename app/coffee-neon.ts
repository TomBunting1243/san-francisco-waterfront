import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

type Stroke=[number,number][];
// Condensed, bent glass letters seen from the bay. Open centres let the
// unlit steelwork and the sky show between the red strokes after dark.
const glyphs:Record<string,Stroke[]>={
 H:[[[0,0],[0,1]],[[.38,0],[.38,1]],[[0,.49],[.38,.49]]],
 I:[[[.04,0],[.04,1]]],L:[[[0,1],[0,0],[.34,0]]],
 S:[[[.35,.85],[.30,.98],[.10,1],[.01,.90],[0,.63],[.07,.54],[.27,.47],[.36,.37],[.36,.12],[.28,.02],[.08,0],[0,.10]]],
 B:[[[0,0],[0,1],[.24,1],[.34,.92],[.34,.61],[.24,.51],[0,.51]],[[.24,.51],[.36,.42],[.36,.10],[.26,0],[0,0]]],
 R:[[[0,0],[0,1],[.25,1],[.35,.90],[.35,.61],[.25,.50],[0,.50]],[[.21,.50],[.37,0]]],
 O:[[[.10,0],[0,.12],[0,.88],[.10,1],[.28,1],[.38,.88],[.38,.12],[.28,0],[.10,0]]],
 C:[[[.37,.88],[.29,1],[.10,1],[0,.88],[0,.12],[.09,0],[.28,0],[.37,.12]]],
 F:[[[0,0],[0,1],[.35,1]],[[0,.51],[.29,.51]]],
 E:[[[.35,1],[0,1],[0,0],[.35,0]],[[0,.51],[.28,.51]]],
};
export function hillsCoffeeTubes(){
 const sections:THREE.BufferGeometry[]=[],up=new THREE.Vector3(0,1,0);
 let cursor=0;
 for(const letter of 'HILLS BROS COFFEE'){
   if(letter===' '){cursor+=.30;continue;}
   for(const stroke of glyphs[letter])for(let i=1;i<stroke.length;i++){
     const a=new THREE.Vector3(cursor+stroke[i-1][0],stroke[i-1][1],0);
     const b=new THREE.Vector3(cursor+stroke[i][0],stroke[i][1],0),d=b.clone().sub(a),mid=a.lerp(b,.5);
     const tube=new THREE.CylinderGeometry(.020,.020,d.length()+.008,8);
     tube.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,d.normalize()));
     tube.translate(mid.x,mid.y,0);sections.push(tube);
   }
   cursor+=letter==='I'?.22:.55;
 }
 const merged=mergeGeometries(sections);sections.forEach(g=>g.dispose());
 merged.computeBoundingBox();const bounds=merged.boundingBox!;
 merged.translate(-(bounds.max.x+bounds.min.x)/2,0,0);
 merged.scale(.515,.515,.515);merged.computeBoundingBox();return merged;
}
