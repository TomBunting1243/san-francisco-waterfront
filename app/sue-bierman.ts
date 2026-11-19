import * as THREE from 'three';
import {setPackedNormals} from './packed-normals.ts';
import survey from '../public/data/bierman-ground.json' with {type:'json'};

export const biermanParcel=(id:number)=>id===175516006||id===585983823;

// 2023 USGS Class 2 bare earth, medians of 12 nearest returns on a 4.17 m
// grid. Interpolate the two triangular facets actually drawn at each cell.
// The local datum aligns 3.1 m NAVD88 with the adjoining park path datum.
// https://www.fisheries.noaa.gov/inport/item/73386
export function biermanGround(x:number,z:number){
  const u=(x-survey.x0)/survey.step,v=(z-survey.z0)/survey.step;
  const col=Math.max(0,Math.min(survey.w-2,Math.floor(u))),row=Math.max(0,Math.min(survey.h-2,Math.floor(v)));
  const i=row*survey.w+col,dx=u-col,dz=v-row;
  const a=survey.cm[i],b=survey.cm[i+1],c=survey.cm[i+survey.w],d=survey.cm[i+survey.w+1];
  const cm=dx+dz<=1?a+(b-a)*dx+(c-a)*dz:d+(c-d)*(1-dx)+(b-d)*(1-dz);
  return .12+(cm-310)*.0006;
}

export function sueBiermanPark(){
  const root=new THREE.Group();root.name='Sue Bierman Park east and west';
  const groundNames=['Waterfront Playground safety surface','Park paths','Ornamental beds','Mapped lawns','Park grounds'];
  const tones=['#77865c','#d1c9b4','#677e5a','#92a271','#819669'];
  // Each land-cover patch is clipped to a common set of grade facets before
  // export. Paths meet lawns edge to edge; the PUC service yard stays open.
  for(const [i,indices] of survey.indices.entries()){
    const vertices:number[]=[],localIndex:number[]=[],local=new Map<number,number>();
    for(const corner of indices){
      let id=local.get(corner);
      if(id===undefined){
        id=vertices.length/3;local.set(corner,id);
        const x=survey.xz[corner*2]/10000,z=survey.xz[corner*2+1]/10000;
        vertices.push(x,biermanGround(x,z),z);
      }
      localIndex.push(id);
    }
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)).setIndex(localIndex);
    setPackedNormals(geometry);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:tones[i],roughness:.96}));
    mesh.name=groundNames[i];root.add(mesh);
  }
  // The circular rope climber and adjacent swing bank remain identifiable in
  // the 2024 city ortho. SF Rec & Park confirms the site's net climber and swings.
  // https://sfrecpark.org/m/newsflash/Archive/Item/600?arcId=2825
  const climber=new THREE.Group();climber.name='Waterfront Playground rope climber';
  climber.position.set(11.538,biermanGround(11.538,-6.50),-6.50);root.add(climber);
  const metal=new THREE.MeshStandardMaterial({color:'#78817a'}),rope=new THREE.MeshStandardMaterial({color:'#a65a46'});
  function bar(group:THREE.Group,a:THREE.Vector3,b:THREE.Vector3,r:number,material:THREE.Material){
    const d=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),5),material);
    mesh.position.copy(a).lerp(b,.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());group.add(mesh);
  }
  const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  bar(climber,v(0,0,0),v(0,.24,0),.007,metal);
  const ring=(i:number,f:number)=>v(Math.sin(i*Math.PI/4)*.195*f,.24*(1-f)+.012,Math.cos(i*Math.PI/4)*.195*f);
  for(let i=0;i<8;i++){
    bar(climber,ring(i,1),ring(i,0),.0037,rope);
    for(const f of [.4,.7,1])bar(climber,ring(i,f),ring(i+1,f),.0037,rope);
  }
  const swing=new THREE.Group();swing.name='Waterfront Playground swings';root.add(swing);
  swing.position.set(12.326,biermanGround(12.326,-7.674),-7.674);swing.rotation.y=-.38;
  bar(swing,v(-.19,.174,0),v(.19,.174,0),.006,metal);
  for(const x of [-.19,.19])for(const z of [-.06,.06])bar(swing,v(x,0,z),v(x,.174,0),.005,metal);
  for(const x of [-.10,.10]){
    for(const dx of [-.014,.014])bar(swing,v(x+dx,.036,0),v(x+dx,.174,0),.0019,metal);
    const seat=new THREE.Mesh(new THREE.BoxGeometry(.038,.006,.023),metal);seat.position.set(x,.036,0);swing.add(seat);
  }
  return root;
}
