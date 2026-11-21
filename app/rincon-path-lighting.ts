import * as THREE from 'three';
import {rinconPoint} from './rincon-park.ts';
import {ferryWalkLens} from './ferry-walk-lights.ts';

// Pole heads/shadows along the seawall walk in the 2024 SF 8 cm ortho,
// measured in its 96 px/model-unit plate with origin (-42,-5).
// https://tile.sf.gov/
// The City's before photograph (printed sheet 24, PDF page 31) resolves
// the silver pole, suspended lamp and small inclined collector above it.
// https://commissions.sfplanning.org/hpcpackets/2012-0893ENV.pdf#page=31
// Reconstructed mounting height and output; the original has no photometry.
const pins=[
  [75,485],[174,499],[264,522],[356,543],[449,562],[529,574],
  [607,570],[683,558],[778,550],[873,537],[970,523],[1065,509],
  [1154,502],[1250,493],[1344,484],[1440,470],[1535,458],
];
export function addRinconPathLighting(root:THREE.Group){
  const post=new THREE.CylinderGeometry(.0043,.006,.30,8);
  const barrel=new THREE.CylinderGeometry(.013,.012,.023,8);
  const lens=new THREE.CylinderGeometry(.010,.009,.011,8);
  const plate=new THREE.BoxGeometry(.049,.003,.029);
  const metal=new THREE.MeshStandardMaterial({color:'#99a29e',roughness:.72});
  const collector=new THREE.MeshStandardMaterial({color:'#516368',roughness:.66});
  const glazing=new THREE.MeshStandardMaterial({color:'#dedfcf',roughness:.55});
  function part(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number){
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);root.add(mesh);
    mesh.castShadow=mesh.receiveShadow=true;return mesh;
  }
  for(const [u,v] of pins){
    const [x,z]=rinconPoint(u/2,v/2);
    // The walking ribbon crosses the .110 terrace at .146. Sink the pole
    // foot below both grades so the thin stem emerges from the actual paving.
    part(post,metal,x,.214,z);
    part(barrel,metal,x,.366,z);
    const lamp=part(lens,glazing,x,.351,z);
    ferryWalkLens(lamp,'Rincon Park solar path light',1.13,.79);
    for(const dx of [-.009,.009])part(post,metal,x+dx,.390,z).scale.set(.42,.13,.42);
    part(plate,collector,x,.413,z).rotation.z=-.22;
  }
}
