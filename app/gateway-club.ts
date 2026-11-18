import * as THREE from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {insideBuilding} from './building-character.ts';
import {footprintGeometry,sfMap} from './sf-map.ts';
import {waterfrontTree} from './waterfront-trees.ts';

type Point=number[];
type Area={id:number;p:Point[]};
type Route={id:number;p:Point[]};
type Bank={name:string;p:Point[];courts:number[]};

// Enclosure edges and lawn panels traced from the City and County's 2024
// orthoimagery (tile.sf.gov/api/tiles/p2024_rgb8cm/20), registered to the OSM
// court outlines used by the rest of the scene. The 2011 City existing-site
// plan provides access and enclosure context, with three tennis courts since
// replaced by six pickleball courts on the contemporary aerial:
// https://sfplanning.s3.amazonaws.com/archives/documents/8540-2007.0030E_8_Washington_DEIR_Part%201.pdf#page=47
// Surface colors, furnishings and pergola: https://www.bayclubs.com/clubs/thegateway
const banks:Bank[]=[
  {name:'North single tennis',p:[[27.164,-5.689],[27.159,-4.584],[24.962,-4.714],[24.943,-5.747]],courts:[1090805627]},
  {name:'Six pickleball courts',p:[[25.410,-6.626],[24.396,-4.679],[22.535,-5.552],[23.366,-7.618]],courts:[1381832974,1381832975,1381832976,1381832977,1381832978,1381832979]},
  {name:'Central tennis pair',p:[[20.442,-7.989],[19.453,-6.152],[17.444,-7.193],[18.448,-9.049]],courts:[1090805623,1090805624]},
  {name:'South tennis pair',p:[[18.225,-9.093],[17.326,-7.399],[15.273,-8.502],[16.071,-10.180]],courts:[1090805621,1090805622]},
  {name:'South single tennis',p:[[17.315,-7.446],[16.691,-6.352],[14.639,-7.455],[15.170,-8.587]],courts:[1090805620]},
];
const aquatics=[[23.236,-7.405],[22.375,-5.519],[21.908,-4.679],[19.359,-6.086],[20.360,-7.959],[20.809,-8.693]];
const lawns=[
  [[23.151,-7.453],[22.812,-6.787],[21.011,-7.661],[21.380,-8.409]],
  [[22.761,-6.780],[22.028,-5.250],[21.595,-5.478],[22.341,-6.983]],
];
const openTerrace=[[24.042,-4.85],[23.597,-4.652],[22.286,-4.806],[22.546,-5.589]];
const canopies=[
  [[21.091,-8.546],[20.988,-8.262],[20.884,-7.979]],
  [[22.809,-6.640],[22.659,-6.375],[22.510,-6.110],[22.363,-5.829],[22.220,-5.573],[22.097,-5.304]],
  [[18.251,-8.863],[18.102,-8.538],[17.951,-8.230],[17.811,-7.897],[17.655,-7.562]],
  [[15.979,-10.218],[15.495,-9.254],[15.158,-8.468],[14.647,-7.568]],
];
// The city plan labels the big pool 36 × 75 ft and the smaller pool 25 × 55 ft.
// Use the observed stripes and ropes, counting the small spa separately.
const swimming=[[436478200,6],[436478201,2],[1090805630,0]] as const;
const pavement=.119,fenceColor='#48655d',postColor='#50665c',netColor='#40585a',courtLine='#e1e2cd';
const closed=(p:Point[])=>[...p,p[0]];
const interpolate=(a:Point,b:Point,t:number)=>[THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t)];
const length=(a:Point,b:Point)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const contains=(p:Point[],x:number,z:number)=>insideBuilding(x,z,closed(p));
export const gatewayClubGround=(x:number,z:number)=>contains(aquatics,x,z)||banks.some(b=>contains(b.p,x,z));

function rectangle(p:Point[]){
  const [a,b,c,d]=p;
  const [shortStart,shortEnd,farEnd,farStart]=length(a,b)<length(b,c)?[a,b,c,d]:[b,c,d,a];
  return {
    point:(along:number,across:number)=>interpolate(interpolate(shortStart,shortEnd,across),interpolate(farStart,farEnd,across),along),
    long:length(shortStart,farStart),short:length(shortStart,shortEnd),
  };
}

export function createGatewayClub(areas:Area[],paths:Route[],font?:Font){
  const root=new THREE.Group();root.name='Golden Gateway Tennis and Swim Club';
  const materials=new Map<string,THREE.MeshStandardMaterial>();
  const courts:{id:number;sport:'tennis'|'pickleball';markings:{from:Point;to:Point}[]}[]=[];
  const pools:{id:number;lanes:number}[]=[];
  const unitBox=new THREE.BoxGeometry();
  function group(name:string){
    const child=new THREE.Group();child.name=name;root.add(child);return child;
  }
  function mesh(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number,parent:THREE.Object3D=root){
    if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.89}));
    const object=new THREE.Mesh(g,materials.get(color)!);object.position.set(x,y,z);
    object.castShadow=object.receiveShadow=true;parent.add(object);return object;
  }
  function box(w:number,h:number,d:number,x:number,y:number,z:number,color:string,parent:THREE.Object3D=root){
    const object=mesh(unitBox,color,x,y,z,parent);object.scale.set(w,h,d);return object;
  }
  function bar(a:Point,b:Point,y:number,w:number,h:number,color:string,parent:THREE.Object3D=root){
    const [x,z]=interpolate(a,b,.5);
    const object=box(w,h,length(a,b),x,y,z,color,parent);
    object.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);return object;
  }
  function surface(p:Point[],y:number,depth:number,color:string,parent:THREE.Object3D=root){
    return mesh(footprintGeometry(closed(p),depth),color,0,y-depth,0,parent);
  }
  const entry=paths.find(path=>path.id===1505475434)?.p;
  function fence(p:Point[],parent:THREE.Object3D,high=.247){
    for(let i=0;i<p.length;i++){
      const a=p[i],b=p[(i+1)%p.length],bays=Math.max(1,Math.ceil(length(a,b)/.265));
      for(let bay=0;bay<bays;bay++){
        const start=interpolate(a,b,bay/bays),end=interpolate(a,b,(bay+1)/bays),mid=interpolate(start,end,.5);
        if(entry&&entry[0]&&length(mid,entry[0])<.26)continue;
        bar(start,end,pavement+high/2,.010,high-.021,i%3===0?fenceColor:'#4e695e',parent);
        bar(start,end,pavement+high,.018,.011,postColor,parent);
        box(.019,high+.016,.019,start[0],pavement+high/2,start[1],postColor,parent);
      }
    }
  }
  for(const bank of banks){
    const enclosure=group(bank.name);
    surface(bank.p,pavement,.055,'#789267',enclosure).name='Green court apron';
    fence(bank.p,enclosure);
    const pickle=bank.courts.length===6;
    for(const id of bank.courts){
      const data=areas.find(area=>area.id===id);
      if(!data)continue;
      const p=data.p.slice(0,-1),{point,long,short}=rectangle(p);
      const court=new THREE.Group();court.name=`${pickle?'Pickleball':'Tennis'} court ${id}`;enclosure.add(court);
      const record:{id:number;sport:'tennis'|'pickleball';markings:{from:Point;to:Point}[]}={id,sport:pickle?'pickleball':'tennis',markings:[]};
      courts.push(record);
      surface(p,pavement+.006,.006,pickle?'#5286a4':'#607a8c',court).name='Blue playing surface';
      const service=.5+(pickle?2.1336:6.4)*.06/long;
      if(pickle){
        const kitchen=[point(1-service,0),point(service,0),point(service,1),point(1-service,1)];
        surface(kitchen,pavement+.009,.003,'#689ba5',court).name='Non-volley zone';
      }
      const mark=(from:Point,to:Point)=>{
        bar(from,to,pavement+.012,pickle?.0034:.004,.003,courtLine,court).name='Court line';
        record.markings.push({from,to});
      };
      const stripe=(a:number,b:number,c:number,d:number)=>mark(point(a,b),point(c,d));
      for(const across of [0,1])stripe(0,across,1,across);
      for(const along of [0,1])stripe(along,0,along,1);
      if(pickle){
        for(const along of [1-service,service])stripe(along,0,along,1);
        stripe(0,.5,1-service,.5);stripe(service,.5,1,.5);
      }else{
        const singles=1.3716*.06/short;
        stripe(0,singles,1,singles);stripe(0,1-singles,1,1-singles);
        for(const along of [1-service,service])stripe(along,singles,along,1-singles);
        stripe(1-service,.5,service,.5);stripe(0,.5,.025,.5);stripe(.975,.5,1,.5);
      }
      const from=point(.5,-.065),to=point(.5,1.065),net=pavement+(pickle?.056:.066);
      bar(from,to,net-.024,.007,.040,netColor,court).name='Court net';
      bar(from,to,net,.006,.006,'#c8cdb4',court);
      for(const [x,z] of [from,to])box(.012,net-pavement,.012,x,(net+pavement)/2,z,netColor,court);
      const [x,z]=point(.5,-.22);
      box(.018,.40,.018,x,pavement+.20,z,postColor,court);
      const lamp=box(.073,.031,.043,x,pavement+.397,z,'#858b7b',court);
      lamp.rotation.y=Math.atan2(to[0]-from[0],to[1]-from[1]);
    }
  }

  const swim=group('Aquatic deck and lawns');
  const poolRings=swimming.map(([id,lanes])=>({id,lanes,p:areas.find(area=>area.id===id)?.p.slice(0,-1)})).filter(pool=>pool.p!==undefined);
  // Paving is cut around the water for visible coping and pool depth.
  const shape=new THREE.Shape(aquatics.map(([x,z])=>new THREE.Vector2(x,-z)));
  for(const {p} of poolRings)shape.holes.push(new THREE.Path(p!.map(([x,z])=>new THREE.Vector2(x,-z))));
  const deck=new THREE.ExtrudeGeometry(shape,{depth:.060,bevelEnabled:false}).rotateX(-Math.PI/2);
  mesh(deck,'#c4bca9',0,pavement-.060,0,swim).name='Pool deck with cutouts';
  fence(aquatics,swim,.225);
  for(const p of lawns)surface(p,pavement+.014,.017,'#8ca06a',swim).name='Sun lawn';
  surface(openTerrace,pavement+.006,.018,'#b7b3a0',swim).name='Pickleball seating terrace';
  for(const {id,lanes,p} of poolRings){
    const pool=new THREE.Group();pool.name=lanes===6?'Six-lane lap pool':lanes===2?'Teaching pool':'Small spa basin';swim.add(pool);
    pools.push({id,lanes});
    const surfaceY=pavement-.021;
    surface(p!,surfaceY,.022,lanes===0?'#84aeb1':lanes===2?'#82b4b7':'#79b1b8',pool);
    for(let i=0;i<p!.length;i++)bar(p![i],p![(i+1)%p!.length],pavement+.001,.034,.049,'#d6d1bd',pool).name='Pool coping';
    if(lanes===0)continue;
    const {point}=rectangle(p!);
    for(let lane=0;lane<lanes;lane++){
      const a=(lane+.5)/lanes,from=point(.064,a),to=point(.936,a);
      bar(from,to,surfaceY+.004,.014,.003,'#4d7b8a',pool).name='Pool lane marking';
      for(const end of [.064,.936])bar(point(end,a-.035),point(end,a+.035),surfaceY+.004,.012,.003,'#4d7b8a',pool);
      if(lane===0)continue;
      const floats=lanes===6?13:9;
      for(let k=0;k<floats;k++){
        bar(point(k/floats,lane/lanes),point((k+.93)/floats,lane/lanes),surfaceY+.010,.010,.009,k%3===0?'#d8c9a4':'#8bbbbb',pool).name='Lane rope';
      }
    }
    for(const along of [.13,.87])for(const across of [-.036,1.036]){
      const [x,z]=point(along,across);
      const ladder=mesh(new THREE.TorusGeometry(.023,.005,4,8,Math.PI),'#dbd8ca',x,pavement+.019,z,pool);
      const [ax,az]=point(along,.5);ladder.rotation.y=Math.atan2(z-az,ax-x);
    }
  }

  for(const [i,row] of canopies.entries())for(const [j,[x,z]] of row.entries()){
    waterfrontTree((g,c,px,py,pz)=>mesh(g,c,px,py,pz,swim),x,pavement,z,39261+i*71+j,.29+(i+j)%3*.055,i===1?'':'Acer');
  }
  // White umbrellas and low chaises on the owner-photographed sun lawn.
  const lawn=rectangle(lawns[0]);
  for(let row=0;row<3;row++)for(let i=0;i<6;i++){
    const [x,z]=lawn.point(.21+row*.22,.12+i*.14);
    box(.033,.018,.070,x,pavement+.030,z,'#e4dfc9',swim).rotation.y=-.48;
  }
  for(const [x,z] of [[20.032,-6.24],[20.11,-6.11],[20.30,-5.94]]){
    box(.008,.094,.008,x,pavement+.047,z,'#c0baa5',swim);
    mesh(new THREE.ConeGeometry(.065,.027,8),'#e3ddca',x,pavement+.094,z,swim);
  }

  // These two mapped one-story buildings are below the generic city's
  // footprint-size cutoff. Keep the pavilion and dressing room different.
  for(const building of sfMap.buildings.filter(b=>b.id===256086585||b.id===260933651)){
    const desk=building.id===256086585,p=building.p.slice(0,-1);
    const height=desk?.248:.208;
    const buildingGroup=group(desk?'Tennis front desk pavilion':'Pool dressing rooms');
    surface(p,pavement+height,height,desk?'#b7b39e':'#a9a591',buildingGroup);
    if(desk){
      const center=p.reduce(([x,z],[px,pz])=>[x+px/p.length,z+pz/p.length],[0,0]);
      const roof=closed(p.map(([x,z])=>[center[0]+(x-center[0])*1.12,center[1]+(z-center[1])*1.12]));
      const eave=pavement+height,peak=new THREE.Vector3(center[0],eave+.123,center[1]);
      for(let i=1;i<roof.length;i++){
        const a=new THREE.Vector3(roof[i-1][0],eave,roof[i-1][1]),b=new THREE.Vector3(roof[i][0],eave,roof[i][1]);
        const up=b.clone().sub(a).cross(peak.clone().sub(a)).y>0;
        const face=new THREE.BufferGeometry();
        face.setAttribute('position',new THREE.Float32BufferAttribute([...a.toArray(),...(up?b:peak).toArray(),...(up?peak:b).toArray()],3));
        face.computeVertexNormals();
        mesh(face,i%3===0?'#596b74':'#4d626e',0,0,0,buildingGroup);
      }
      const b=p.at(-1)!,toward=interpolate(b,p[0],.18);
      bar(toward,interpolate(b,p[0],.82),pavement+.142,.026,.095,'#607a7a',buildingGroup);
    }else{
      surface(p,pavement+height+.016,.021,'#aba898',buildingGroup);
      const [a,b]=p;
      bar(a,b,pavement+.14,.032,.083,'#687b74',buildingGroup);
    }
  }
  if(entry&&entry.length>1){
    const access=group('Drumm Street club entrance');
    const a=entry[0],b=entry[1],l=length(a,b),dx=(b[0]-a[0])/l,dz=(b[1]-a[1])/l;
    const point=(along:number,across:number)=>[a[0]+dx*along+dz*across,a[1]+dz*along-dx*across];
    bar(point(-.16,0),point(l,0),pavement+.004,.24,.025,'#c1b59d',access).name='Club access path';
    for(const t of [.02,.34])for(const side of [-1,1]){
      const [x,z]=point(t,side*.14);
      box(.048,.232,.052,x,pavement+.116,z,'#e3dcc7',access);
    }
    for(let i=0;i<7;i++){
      const t=.045+i*.046;
      bar(point(t,-.162),point(t,.162),pavement+.233,.032,.019,'#e1dbc8',access);
    }
    const [x,z]=point(-.016,0);
    const gate=box(.35,.057,.014,x,pavement+.234,z,'#4b6f87',access);
    const angle=Math.atan2(-dx,-dz);gate.rotation.y=angle;
    if(font){
      const sign=new TextGeometry('THE GATEWAY TENNIS & SWIM',{font,size:.014,depth:.001,curveSegments:2});
      sign.computeBoundingBox();
      const bb=sign.boundingBox!;sign.translate(-(bb.max.x+bb.min.x)/2,-.008,0);
      const letters=mesh(sign,'#e7e1d0',x-dx*.0085,pavement+.234,z-dz*.0085,access);letters.rotation.y=angle;
    }
  }
  return {root,courts,pools};
}
