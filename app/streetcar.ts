import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from './harbor-font.json' with {type:'json'};

/** Code-native PCC miniature, based on Muni 1051's green-and-cream bodywork. */
export function createStreetcar(){
  const group=new THREE.Group();group.name='Muni PCC streetcar';group.scale.setScalar(.5);
  const colors={green:'#31735c',cream:'#e9dfb8',glass:'#3e5e64',rubber:'#283737',metal:'#9baba6',dark:'#354a43'};
  const materials=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:key==='glass'?.3:.68,metalness:key==='metal'?.5:.08})]));
  const glazing=materials.glass;glazing.emissive.set('#e6c583');
  const lamp=new THREE.MeshStandardMaterial({color:'#fff1c8',emissive:'#ffd799',emissiveIntensity:1.5,roughness:.4});
  function part(geometry:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
  function box(w:number,h:number,d:number,x:number,y:number,z:number,mat=materials.cream,r=.015){return part(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),mat,x,y,z);}
  function rod(a:number[],b:number[],r:number,mat=materials.dark){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);const m=part(new THREE.CylinderGeometry(r,r,delta.length(),6),mat,...from.clone().add(to).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
  const font=new FontLoader().parse(fontData);
  function text(value:string,size:number,x:number,y:number,z:number,ry=0){const geo=new TextGeometry(value,{font,size,depth:.0015,curveSegments:2});geo.computeBoundingBox();geo.translate(-geo.boundingBox!.max.x/2,0,0);const m=part(geo,materials.cream,x,y,z);m.rotation.y=ry;return m;}
  // Rounded skirt and barrel roof retain the PCC's continuous streamlined silhouette.
  box(3.55,.67,.76,0,.58,0,materials.green,.16);
  box(3.52,.16,.77,0,.48,0,materials.cream,.07);
  box(3.48,.25,.74,0,.88,0,materials.green,.12);
  box(3.14,.08,.767,-.05,.87,0,materials.cream,.025);
  box(2.96,.055,.771,-.08,.32,0,materials.metal);
  box(2.8,.12,.56,0,.24,0,materials.dark);
  for(const x of [-1.08,1.08]){
    box(.69,.14,.49,x,.19,0,materials.dark);
    for(const dx of [-.22,.22])for(const z of [-.3,.3]){
      const wheel=part(new THREE.CylinderGeometry(.14,.14,.07,14),materials.rubber,x+dx,.14,z);wheel.rotation.x=Math.PI/2;
      const hub=part(new THREE.CylinderGeometry(.079,.079,.074,12),materials.metal,x+dx,.14,z);hub.rotation.x=Math.PI/2;
    }
  }
  // Both sides have divided passenger windows and the smaller standee windows above.
  for(const side of [-1,1])for(let i=0;i<10;i++){
    const x=-1.35+i*.285;
    if(side===1&&(Math.abs(x-1.21)<.3||Math.abs(x+.5)<.2))continue;
    box(.248,.27,.022,x,.695,side*.379,materials.metal,.025);
    box(.216,.232,.025,x,.695,side*.394,glazing,.022);
    box(.219,.012,.027,x,.72,side*.41,materials.cream);
    box(.19,.079,.019,x,.875,side*.372,materials.dark,.022);
    box(.16,.052,.023,x,.877,side*.384,glazing,.017);
  }
  for(const x of [1.21,-.5]){
    box(.43,.64,.031,x,.55,.395,materials.cream,.016);
    for(let leaf=0;leaf<4;leaf++){
      const xx=x-.159+leaf*.106;
      box(.013,.6,.025,xx+.05,.55,.42,materials.dark);
      box(.072,.25,.022,xx,.685,.422,glazing);
      box(.06,.16,.025,xx,.38,.423,materials.dark);
    }
    box(.46,.025,.10,x,.235,.41,materials.metal);
  }
  // Blunt rounded nose, split windshield, wipers and centered headlight.
  box(.14,.43,.64,1.75,.48,0,materials.cream,.06);
  for(const z of [-.156,.156]){
    box(.025,.262,.29,1.801,.737,z,glazing,.035);
    rod([1.821,.62,z+.05],[1.827,.78,z-.035],.006);
  }
  box(.025,.032,.60,1.81,.586,0,materials.cream);
  box(.025,.08,.48,1.749,.966,0,materials.dark,.022);
  text('F MARKET',.044,1.770,.948,0,Math.PI/2);
  text('1051',.039,1.80,.891,0,Math.PI/2);
  const headlight=part(new THREE.CylinderGeometry(.063,.063,.03,16),materials.metal,1.835,.43,0);headlight.rotation.z=Math.PI/2;
  const lens=part(new THREE.CircleGeometry(.044,16),lamp,1.854,.43,0);lens.rotation.y=Math.PI/2;
  for(const z of [-.24,.24])box(.027,.027,.045,1.83,.525,z,lamp);
  for(const y of [.285,.315])box(.045,.021,.63,1.83,y,0,materials.metal);
  for(const side of [-1,1])text('1051',.058,-.96,.43,side*.397,side<0?Math.PI:0);
  // Rear glazing, bumper, roof ventilators, trolley base and trailing pole.
  box(.025,.24,.48,-1.757,.7,0,glazing,.04);box(.035,.03,.59,-1.74,.30,0,materials.metal);
  for(const x of [-.8,-.15,.47]){box(.25,.045,.30,x,1.015,0,materials.green);for(let j=0;j<4;j++)box(.018,.012,.24,x-.075+j*.05,1.043,0,materials.dark);}
  box(.24,.055,.25,.10,1.04,0,materials.dark);
  rod([.1,1.07,0],[-1.05,1.94,0],.013);rod([.1,1.07,.02],[-.24,1.36,.02],.021,materials.metal);
  box(.085,.023,.07,-1.05,1.95,0,materials.dark);
  return {group,glazing,lamp};
}
