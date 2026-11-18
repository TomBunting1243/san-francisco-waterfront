import * as THREE from 'three';
import {pedestrianPace} from './waterfront-routes.ts';

const metresToScene=.06;
const modelHeight=.548;
const contactSurfaceOffset=.0009;
const swingFraction=.44;
const pedSpeed=(direction:number)=>direction>0?pedestrianPace:pedestrianPace*.87;

const cast=[
  {coat:'#a9604c',hem:'#915343',trousers:'#4b565a',ink:'#503f3a',light:'#caae83',accent:'#d0aa6c',bag:'#9a7950',cut:'trench'},
  {coat:'#a78746',hem:'#8d7441',trousers:'#5e6153',ink:'#534c3f',light:'#b58769',accent:'#6f8176',bag:'#9e8170',cut:'skirt'},
  {coat:'#5c807a',hem:'#52736f',trousers:'#4e6267',ink:'#69564d',light:'#d3ad87',accent:'#b79375',bag:'#92775a',cut:'jacket'},
  {coat:'#847387',hem:'#72637c',trousers:'#566360',ink:'#654b45',light:'#bd9173',accent:'#b9b09a',bag:'#a78158',cut:'overcoat'},
  {coat:'#6c7a5c',hem:'#616e52',trousers:'#5a554d',ink:'#77604e',light:'#c09b7b',accent:'#ad8878',bag:'#796651',cut:'jacket'},
  {coat:'#aa7a72',hem:'#946b65',trousers:'#515f68',ink:'#705852',light:'#d1a686',accent:'#6f6267',bag:'#806d60',cut:'overcoat'},
];

type Point=[number,number];
type RouteSample=(timeOffset:number)=>{x:number;z:number;heading:number};

/** A tinted, slightly irregular piece of paper. The geometry has no cylindrical cross-section. */
function cutout(points:Point[],seed:number){
  const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
  const geometry=new THREE.ShapeGeometry(shape);
  const positions=geometry.attributes.position;
  const color=new Float32Array(positions.count*3);
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i);
    const value=.924+.040*Math.sin(x*19+y*12+seed)+.027*Math.cos(y*46-x*14+seed);
    color.set([value,value,value],i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(color,3));
  return geometry;
}

function contactMaterial(){
  const size=24, pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const distance=Math.hypot((x+.5)*2/size-1,(y+.5)*2/size-1);
    const v=Math.min(1,Math.max(0,(1-distance)/.83));
    pixels[(y*size+x)*4+1]=Math.round(v*v*(3-2*v)*255);
  }
  const alphaMap=new THREE.DataTexture(pixels,size,size);
  alphaMap.minFilter=alphaMap.magFilter=THREE.LinearFilter;
  alphaMap.needsUpdate=true;
  return new THREE.MeshBasicMaterial({color:'#3d4539',alphaMap,transparent:true,opacity:.29,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
}

/** Painted miniature pedestrians with view-facing contours and world-space foot contact. */
export function createPeople(count=22){
  const group=new THREE.Group();
  const paper=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,side:THREE.DoubleSide});
  function batch(name:string,geometry:THREE.BufferGeometry,n=count,material:THREE.Material=paper){
    const mesh=new THREE.InstancedMesh(geometry,material,n);
    mesh.name=name;mesh.frustumCulled=false;group.add(mesh);return mesh;
  }
  const legs=batch('Contour trousers',cutout([
    [-.018,.50],[.024,.50],[.022,.24],[.016,.03],[.014,-.19],[.012,-.48],
    [-.011,-.50],[-.018,-.30],[-.020,-.01],[-.023,.20],
  ],2),count*2);
  const shoes=batch('Shoes',cutout([
    [-.029,.008],[-.021,.017],[.008,.012],[.034,.001],[.037,-.008],
    [.029,-.017],[-.026,-.017],[-.031,-.009],
  ],4),count*2);
  const bodies=batch('Coat silhouettes',cutout([
    [-.051,.094],[-.029,.121],[.009,.130],[.040,.118],[.062,.089],
    [.057,.006],[.050,-.052],[.054,-.103],[.025,-.116],
    [-.013,-.109],[-.065,-.115],[-.060,-.052],[-.054,.026],[-.056,.067],
  ],1));
  const hems=batch('Coat tails and skirts',cutout([
    [-.058,.040],[.043,.042],[.044,.017],[.075,-.067],[.048,-.078],
    [.012,-.074],[-.013,-.082],[-.070,-.065],[-.051,-.007],
  ],6));
  const sleeves=batch('Painted sleeves',cutout([
    [-.022,.51],[.023,.51],[.025,.29],[.019,.071],[.015,-.22],[.013,-.475],
    [-.009,-.516],[-.014,-.37],[-.018,-.10],[-.024,.24],
  ],5),count*2);
  const hands=batch('Wave accents',cutout([
    [-.010,-.014],[-.009,.011],[.002,.022],[.010,.018],[.012,.008],[.006,-.013],
  ],4));
  const lapels=batch('Lapel and scarf',cutout([
    [-.034,.016],[-.007,.024],[.028,.013],[.035,-.002],[.015,-.014],
    [.020,-.052],[.008,-.061],[.002,-.018],[-.021,-.014],
  ],7));
  const heads=batch('Head silhouettes',cutout([
    [-.037,-.009],[-.032,.025],[-.018,.040],[.006,.044],[.025,.032],[.030,.013],
    [.036,-.001],[.027,-.007],[.029,-.023],[.016,-.032],[.002,-.031],
    [-.003,-.058],[-.026,-.059],[-.019,-.026],
  ],7));
  const cheeks=batch('Small paper cheek',cutout([
    [.012,.019],[.025,.015],[.032,-.001],[.025,-.008],[.026,-.021],[.013,-.025],[.007,-.016],
  ],3));
  const hats=batch('Caps and brims',cutout([
    [-.045,-.008],[-.032,.005],[-.029,.025],[-.009,.034],[.013,.031],[.030,.019],
    [.034,.005],[.056,-.001],[.055,-.008],[.022,-.009],[-.013,-.008],
  ],4));
  const bags=batch('Canvas bags',cutout([
    [-.056,.044],[-.013,.054],[.042,.050],[.048,.031],[.038,-.047],
    [-.037,-.056],[-.055,-.038],
  ],7));
  const straps=batch('Bag straps',cutout([
    [-.0036,-.51],[.0043,-.51],[.0035,.50],[-.0031,.50],
  ],5));
  const contacts=batch('Foot contact shadows',new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),count*2,contactMaterial());
  contacts.renderOrder=2;

  for(let i=0;i<count;i++){
    const person=cast[i%cast.length];
    for(const [mesh,color] of [
      [bodies,person.coat],[hems,person.hem],[hands,person.light],[lapels,person.accent],
      [heads,person.ink],[cheeks,person.light],[hats,i%3===0?person.hem:person.ink],
      [bags,person.bag],[straps,person.bag],
    ] as const)mesh.setColorAt(i,new THREE.Color(color));
    for(const side of [0,1]){
      const index=i*2+side;
      legs.setColorAt(index,new THREE.Color(person.trousers).multiplyScalar(side?1:.82));
      sleeves.setColorAt(index,new THREE.Color(person.coat).multiplyScalar(side?1:.84));
      shoes.setColorAt(index,new THREE.Color(person.ink).multiplyScalar(side?.94:.79));
    }
  }

  const transform=new THREE.Object3D();
  const orientation=new THREE.Quaternion(), twist=new THREE.Quaternion(), forwardAxis=new THREE.Vector3(0,0,1);
  const up=new THREE.Vector3(0,1,0), right=new THREE.Vector3(), toward=new THREE.Vector3();
  const hip=new THREE.Vector3(), foot=new THREE.Vector3(), midpoint=new THREE.Vector3(), offset=new THREE.Vector3();
  const viewer=new THREE.Vector2(Infinity,Infinity);
  function setViewer(x:number,z:number){viewer.set(x,z);}
  function update(i:number,x:number,z:number,t:number,direction:number,ground=0,wave=0,standing=false,bearing=direction>0?0:Math.PI,routeSample?:RouteSample){
    const cadence=5.55+(i%4)*.23, phase=t*cadence+i*2.1, sway=Math.sin(phase);
    const style=i%cast.length, person=cast[style], adultHeight=1.65+(i%4)*.085;
    const size=adultHeight*metresToScene/modelHeight;
    const stanceDuration=(1-swingFraction)*2*Math.PI/cadence;
    const stride=pedSpeed(direction)*stanceDuration/(2*size);
    const base=ground===0?.072:ground, bob=standing?sway*.003:Math.abs(sway)*.011;
    const viewYaw=Number.isFinite(viewer.x)?Math.atan2(viewer.x-x,viewer.y-z):0;
    const lateral=Math.cos(viewYaw+bearing);
    const yaw=viewYaw+(lateral<0?Math.PI:0);
    const paperWidth=.70+Math.abs(lateral)*.30;
    right.set(Math.cos(yaw),0,-Math.sin(yaw));toward.set(Math.sin(viewYaw),0,Math.cos(viewYaw));
    orientation.setFromAxisAngle(up,yaw);
    const lean=standing?.025:.075+sway*.022;
    // Stacking offsets are measured towards the viewer, so both sides have the same readable layering.
    function place(m:THREE.InstancedMesh,index:number,px:number,py:number,pz:number,w:number,h:number,angle:number){
      transform.position.set(px,py,pz);
      transform.quaternion.multiplyQuaternions(orientation,twist.setFromAxisAngle(forwardAxis,angle));
      transform.scale.set(w*size,h*size,size);
      transform.updateMatrix();
      m.setMatrixAt(index,transform.matrix);
    }
    function pose(m:THREE.InstancedMesh,index:number,dx:number,y:number,layer:number,w=1,h=1,angle=0){
      place(m,index,x+size*(right.x*dx+toward.x*layer),base+y*size,z+size*(right.z*dx+toward.z*layer),w*paperWidth,h,angle);
    }
    function reach(m:THREE.InstancedMesh,index:number,ax:number,ay:number,bx:number,by:number,layer:number,width=1){
      const dx=(ax-bx)*paperWidth,dy=ay-by;
      pose(m,index,(ax+bx)*paperWidth/2,(ay+by)/2,layer,width,Math.hypot(dx,dy),-Math.atan2(dx,dy));
    }
    const shoulder=.384+bob, bodyY=.298+bob, long=person.cut!=='jacket';
    pose(bodies,i,0,bodyY,.008,1,long?1.07:.89,-lean);
    const hemLength=person.cut==='trench'?1.18:person.cut==='skirt'?.93:.85;
    // The short team jackets have a narrow waistband. The longer coats end in a swept-out hem.
    pose(hems,i,long?-.008:-.004,bodyY-(long?.106:.090),.010,
      person.cut==='skirt'?1.18:long?1.04:.76,long?hemLength:.32,-lean+sway*.12);
    pose(lapels,i,.005,.417+bob,.019,.89,style%2===0?1.02:.72,-lean);
    pose(heads,i,.019,.482+bob,.014,style===3?1.08:1,.96,-lean);
    pose(cheeks,i,.016,.483+bob,.020,style===3?.89:1,.92,-lean);
    const hasHat=style===1||style===4;
    pose(hats,i,.012,.500+bob,.023,hasHat?(style===4?1.06:.94):style===3?.43:0,hasHat?.77:style===3?.83:0,style===3?.69:-lean);
    const hasBag=style===0||style===2||style===5;
    const bagX=style===0?-.074:-.089, bagY=(style===0?.302:.237)+bob;
    pose(bags,i,bagX,bagY,.022,hasBag?(style===0?.73:.92):0,hasBag?1:0,.12-sway*.15);
    if(hasBag)reach(straps,i,-.020,.405+bob,bagX+.012,bagY+.039,.024,.91);
    else pose(straps,i,0,.34+bob,.023,0,0);

    const pathX=Math.cos(bearing),pathZ=Math.sin(bearing);
    for(let side=0;side<2;side++){
      const sign=side?1:-1,index=i*2+side;
      const step=((phase/(2*Math.PI)+side*.5)%1+1)%1, swing=step<swingFraction;
      const u=swing?step/swingFraction:(step-swingFraction)/(1-swingFraction);
      const lift=standing||!swing?0:Math.sin(Math.PI*u)*.049;
      // The planted foot moves backward relative to the advancing hips at a constant speed.
      const footZ=standing?sign*.014:stride*(swing?-1+2*(u*u*(3-2*u)):1-2*u);
      const ankleY=.020+lift;
      const advance=(footZ+.012)*size, spread=sign*.045*size;
      const anchor=routeSample?.(advance/pedSpeed(direction));
      if(anchor){
        // The ground anchor stays fixed during stance, including when the body rounds a bend.
        foot.set(anchor.x+Math.sin(anchor.heading)*spread,base+size*ankleY,anchor.z-Math.cos(anchor.heading)*spread);
      }else foot.set(x+pathX*advance+pathZ*spread,base+size*ankleY,z+pathZ*advance-pathX*spread);
      hip.set(x+size*(pathX*.003+pathZ*sign*.022),base+size*(.228+bob),z+size*(pathZ*.003-pathX*sign*.022));
      offset.subVectors(hip,foot);
      const dx=offset.dot(right),dy=offset.y;
      midpoint.copy(hip).lerp(foot,.50);
      place(legs,index,midpoint.x,midpoint.y,midpoint.z,paperWidth*(side?.98:.88),Math.hypot(dx,dy)/size,-Math.atan2(dx,dy));
      place(shoes,index,foot.x,foot.y,foot.z,paperWidth,1,swing&&!standing?-Math.sin(2*Math.PI*u)*.105:0);
      const shadowScale=1-lift*8;
      transform.position.set(foot.x,base+contactSurfaceOffset,foot.z);
      transform.quaternion.setFromAxisAngle(up,Math.PI/2-bearing);
      transform.scale.set(.131*shadowScale*size,1,(.17+.008*sway)*shadowScale*size);
      transform.updateMatrix();contacts.setMatrixAt(index,transform.matrix);

      const gesturing=side===1?wave:0, pocket=style===3||style===4;
      const shoulderX=sign*.036, wristX=shoulderX+sign*(pocket?.002:.022)+(standing?0:-footZ*.53)+gesturing*.121;
      const wristY=shoulder-(pocket?.083:.125)+gesturing*(.19+.016*Math.sin(t*7));
      reach(sleeves,index,shoulderX,shoulder,wristX,wristY,side?.024:-.024,side?.96:.9);
      if(side===1)pose(hands,i,wristX*paperWidth,wristY-.005+gesturing*.020,.026,gesturing*.90,gesturing*.90,-.24);
    }
  }
  function flush(){
    for(const mesh of [legs,shoes,bodies,hems,sleeves,hands,lapels,heads,cheeks,hats,bags,straps,contacts])mesh.instanceMatrix.needsUpdate=true;
  }
  return {group,bodies,heads,setViewer,update,flush};
}
