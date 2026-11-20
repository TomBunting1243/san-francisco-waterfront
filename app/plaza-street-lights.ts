import * as THREE from 'three';
import {StreetAssembly} from './street-amenities.ts';

// HALS CA-164 sheet 4 (2021 existing conditions), registered to the five
// modeled basin corners and six SFPUC curb poles. Registration RMS is 1.25 m.
// The legend identifies bronze 50–70 ft floodlight flagpoles and black
// three-lantern standards. Head sizes, mounting heights and output are estimates.
// https://www.loc.gov/resource/hhh.ca4485.sheet/?sp=4
const floodSites=[[5.7867,-10.2082],[4.4997,-10.6599],[3.1,-10.4617],[1.0273,-9.6451]];
const lanternSites=[[6.671,-8.1965],[6.2905,-7.4222],[5.5096,-7.1217],[4.6352,-6.8321]];
// SFPUC active SL-StdSteel sites on the north and west park approaches.
// SF Planning's Northeast Embarcadero Study, existing section fig. 9,
// documents the Washington roadway mast arm. Aim follows the street center.
// https://services.arcgis.com/Zs2aNLFN00jrS4gG/arcgis/rest/services/SFPUC_Streetlights/FeatureServer/0
// https://default.sfplanning.org/Citywide/NES/Northeast_Embarcadero_Study_Report_June2010.pdf
const roadwaySites=[
  [287292,12.711,-5.667,.031,-2.000],[287293,13.830,-7.866,.04445,1.119],
  [287294,14.129,-10.775,.03184,1.301],[281712,11.863,-12.447,.031,2.678],
  [286246,9.291,-14.556,.03165,-.467],[286247,11.302,-14.326,.045,-.472],
  [286249,13.201,-13.353,.045,-.472],[286245,7.88,-15.282,.031,-.467],
];
const bronze='#655b4a',black='#364242',steel='#778380',glass='#e5daca';
const up=new THREE.Vector3(0,1,0);
const post=new THREE.CylinderGeometry(.68,1,1,8),globe=new THREE.SphereGeometry(1,8,5);
const warm=[.9,.61,.34];

// Each hood points from its shaft toward the open brick court. Recover this
// measured head direction for the one-time light texture, including vignettes.
export function terraceFloodAim(x:number,y:number,z:number){
  if(y<.90||y>1.0)return;
  for(const [cx,cz] of floodSites)if(Math.hypot(x-cx,z-cz)<.08)return Math.atan2(x-cx,z-cz);
}
export function addPlazaStreetLights(root:THREE.Group,halos:number[]){
  function assembly(x:number,y:number,z:number){
    const a=new StreetAssembly();
    function upright(h:number,r:number,tone:string){
      a.add(post,tone,0,h/2,0).scale.set(r,h,r);
    }
    function arm(angle:number,reach:number,h:number,rise:number,tone:string){
      const tip=new THREE.Vector3(reach*Math.sin(angle),h+rise,reach*Math.cos(angle));
      const delta=tip.clone().sub(new THREE.Vector3(0,h,0));
      const bar=a.box(tip.x/2,h+rise/2,tip.z/2,.011,delta.length(),.011,tone);
      bar.quaternion.setFromUnitVectors(up,delta.normalize());return tip;
    }
    function light(p:THREE.Vector3){halos.push(x+p.x,y+p.y,z+p.z);}
    function finish(name:string){
      const m=a.bake(name);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;root.add(m);
    }
    return {a,upright,arm,light,finish};
  }
  for(const [x,z] of floodSites){
    const {a,upright,arm,light,finish}=assembly(x,.163,z);
    upright(1.08,.012,bronze); // 18 m flagpole
    const aim=Math.atan2(3.3-x,-8.2-z);
    for(const side of [-1,0,1]){
      const angle=aim+side*.78,p=arm(angle,.045,.78,.008,bronze);
      const shell=a.box(p.x,p.y,p.z,.042,.033,.034,bronze);
      shell.rotation.order='YXZ';shell.rotation.set(.54,angle,0,'YXZ');
      const face=p.clone().add(new THREE.Vector3(0,0,.0175).applyEuler(shell.rotation));
      const window=a.box(face.x,face.y,face.z,.036,.027,.002,glass);
      window.rotation.copy(shell.rotation);window.userData.signLight=warm;light(face);
    }
    finish('Terrace bronze floodlight flagpole');
  }
  for(const [x,z] of lanternSites){
    const {a,upright,arm,light,finish}=assembly(x,.142,z);
    upright(.291,.011,black);
    for(const angle of [0,2*Math.PI/3,4*Math.PI/3]){
      const p=arm(angle,.037,.253,.025,black);p.y+=.018;
      const lens=a.add(globe,glass,p.x,p.y,p.z);lens.scale.set(.014,.025,.014);
      lens.userData.signLight=warm;light(p);
      a.add(post,black,p.x,p.y+.025,p.z).scale.set(.018,.012,.018);
    }
    finish('Fountain walk three-lantern standard');
  }
  for(const [id,x,z,y,aim] of roadwaySites){
    const {a,upright,arm,light,finish}=assembly(x,y,z);
    upright(.49,.011,steel);
    const p=arm(aim,.135,.455,.035,steel);
    a.add(globe,steel,p.x,p.y,p.z).scale.set(.026,.011,.016);
    p.y-=.006;
    const window=a.add(globe,glass,p.x,p.y,p.z);window.scale.set(.024,.008,.014);
    window.userData.signLight=warm;light(p);
    finish('Park approach SFPUC '+id);
  }
}
