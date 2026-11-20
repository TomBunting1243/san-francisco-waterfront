import * as THREE from 'three';
import {StreetAssembly} from './street-amenities.ts';
import {ferryHallFloor} from './ferry-portico-access.ts';
import {seatedFigure} from './terrene-diners.ts';

export const taylorPicnic={
  name:"Taylor's Automatic Refresher",xs:[4.46,4.70,4.94,5.18,5.42,5.66],zs:[-1.447],seatOffset:.041,ground:ferryHallFloor,
} as const;

// Port/BCDC north arcade existing conditions, sheets 37–38: an 18-foot
// café zone along the outside of the arches, with public circulation beyond.
// The city model has a 1.2 m difference between sidewalk and hall datums.
// Carry the hall finish across the dining area and ease it back to the
// surrounding forecourt. The south approach rises at less than 1:12.
// https://www.sfport.com/media/8796/download
export function taylorTerrace(){
  const positions:number[]=[],colors:number[]=[];
  const concrete=new THREE.Color('#bebcb1'),joint=new THREE.Color('#8e8d84');
  function quad(a:number[],b:number[],c:number[],d:number[],color:THREE.Color){
    positions.push(...a,...b,...c,...c,...b,...d);
    for(let i=0;i<6;i++)colors.push(color.r,color.g,color.b);
  }
  const west=-1.568,east=-1.260,south=4.30,north=5.848;
  const top=ferryHallFloor;
  quad([3.34,.030,-1.84],[3.34,.031,west],[south,.030,-1.84],[south,top,west],concrete);
  quad([3.34,.031,west],[3.34,.031,east],[south,top,west],[south,top,east],concrete);
  quad([south,.030,-1.84],[south,top,west],[north,.030,-1.84],[north,top,west],concrete);
  // Flush scored concrete slabs visible on the Port's existing-conditions photo.
  // Share every boundary with its joint, without a layer on top of the floor.
  for(let i=0;i<12;i++)for(let j=0;j<3;j++){
    const x=south+(north-south)*i/12,xx=south+(north-south)*(i+1)/12;
    const z=west+(east-west)*j/3,zz=west+(east-west)*(j+1)/3;
    const edgeX=i?x+.0009:x,edgeZ=j?z+.0009:z;
    if(i)quad([x,top,z],[x,top,zz],[edgeX,top,z],[edgeX,top,zz],joint);
    if(j)quad([edgeX,top,z],[edgeX,top,edgeZ],[xx,top,z],[xx,top,edgeZ],joint);
    quad([edgeX,top,edgeZ],[edgeX,top,zz],[xx,top,edgeZ],[xx,top,zz],concrete);
  }
  quad([north,top,west],[north,top,east],[north,.030,west],[north,.030,east],concrete);
  positions.push(north,.030,-1.84,north,top,west,north,.030,west);
  for(let i=0;i<3;i++)colors.push(concrete.r,concrete.g,concrete.b);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.userData.paintVertices=true;
  g.computeVertexNormals();
  return g;
}

// Cathy Chaplin's July 2007 photograph shows three red channel letters on a
// white interior hood, steel counter, backless stools and a recessed lamp row.
export function taylorCounter(x:number,glazingZ:number,bayWidth:number){
  const root=new THREE.Group();root.name="Taylor's indoor service counter";
  root.position.set(x,0,glazingZ);
  const shop=new StreetAssembly(),span=bayWidth*.85;
  shop.box(0,.249,-.073,span,.056,.041,'#d5d2c5').userData.signLight=[.21,.20,.17];
  shop.box(0,.19,-.081,span,.056,.011,'#a4b2ae');
  shop.box(0,.154,-.059,span,.088,.035,'#748987');
  shop.box(0,.202,-.056,span+.007,.005,.051,'#b8c3bb');
  for(const k of [-1,0,1]){
    const sx=k*span*.35;
    shop.box(sx,.143,-.021,.019,.003,.018,'#565e5b');
    for(const side of [-1,1])shop.box(sx+side*.007,.124,-.021,.002,.037,.003,'#7a8887');
    shop.box(sx,.219,-.060,.009,.003,.008,'#e3d8b7').userData.signLight=[.68,.60,.40];
  }
  // The smaller span sits within the clear pane between the existing mullions.
  shop.label('EAT',span*.23,.232,-.050,.028,'#c14434');
  shop.parts.at(-1)!.userData.signLight=[.74,.075,.034];
  root.add(shop.bake('Red EAT letters above steel service counter'));
  return root;
}

const diners=[
  [4,0,-1,'#496d76','#ba8969','burger'],[4,0,1,'#ad775b','#bf9678',true],
  [2,0,1,'#607d68','#a57660','burger'],[5,0,-1,'#9c686a','#ba967c',true],
] as const;

export function taylorDiners(){
  const root=new THREE.Group();root.name="Taylor's picnic diners";
  const actors=diners.map(([column,row,side,coat,skin,order],i)=>{
    const guest=seatedFigure(coat,skin,order,true);
    guest.figure.name='Picnic diner '+(i+1);
    guest.figure.position.set(taylorPicnic.xs[column]+(i%2?.036:-.036),taylorPicnic.ground,taylorPicnic.zs[row]+side*taylorPicnic.seatOffset);
    guest.figure.rotation.y=side<0?0:Math.PI;
    guest.figure.scale.setScalar(.060);
    root.add(guest.figure);
    const tray=new StreetAssembly();
    tray.box(0,0,0,.019,.001,.012,'#ccbaa1');
    tray.box(-.0031,.0008,0,.009,.0004,.009,'#e0d6bc');
    const paper=tray.bake('Paper-lined burger tray');paper.position.set(guest.figure.position.x,taylorPicnic.ground+.0463,taylorPicnic.zs[row]+side*.018);
    root.add(paper);
    return guest;
  });
  function update(elapsed:number,sheltered:boolean){
    root.visible=!sheltered;
    for(const [i,guest] of actors.entries()){
      const t=((elapsed+i*4.7)%18+18)%18;
      const bite=THREE.MathUtils.smoothstep(t,3.4,5.1)*(1-THREE.MathUtils.smoothstep(t,6.4,8.3));
      guest.forearm!.rotation.x=-1.66*bite;guest.face.rotation.x=.12*bite;
    }
  }
  return {root,actors,update};
}
