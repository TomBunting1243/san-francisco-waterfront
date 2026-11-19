import {createFerryFlag} from './ferry-flag.ts';
import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';

type Hands={minute:THREE.Mesh;hour:THREE.Mesh;angle:number};
const foot=.3048*.06;
const radius=11*foot,dialY=2.035,wall=.324;

// The Port and preservation architect give 22-foot dials and a 235-foot tower.
// https://www.sfport.com/media/9505/download
// Dimensions of both hands: https://sfplanninggis.org/docs/landmarks_and_districts/LM90.pdf
// Shaft panels, raised dial and the four open stages follow Highsmith's frontal
// and oblique records: https://www.loc.gov/item/2013630063/ and https://www.loc.gov/resource/highsm.20934/
// Tower paint: https://www.sherwin-williams.com/architects-specifiers-designers/inspiration/sw-choosing-best-colors
export function ferryClockTower(font:Font){
  const root=new THREE.Group(),hands:Hands[]=[],materials=new Map<string,THREE.MeshStandardMaterial>();
  root.name='Ferry Building clock tower';
  const stone='#d3cec1',light='#e2dbcd',shade='#b9b4a7',iron='#504e48',bronze='#82735b';
  const cube=new THREE.BoxGeometry(1,1,1);
  function mesh(geo:THREE.BufferGeometry,c:string,x:number,y:number,z:number,g=root,name=''){
    if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.83}));
    const m=new THREE.Mesh(geo,materials.get(c));m.position.set(x,y,z);m.name=name;g.add(m);
    m.castShadow=true;m.receiveShadow=true;return m;
  }
  function box(w:number,h:number,d:number,x:number,y:number,z:number,c:string,g=root,name=''){
    const m=mesh(cube,c,x,y,z,g,name);m.scale.set(w,h,d);return m;
  }
  function round(r:number,top:number,h:number,x:number,y:number,z:number,c:string,g=root){
    return mesh(new THREE.CylinderGeometry(top,r,h,24),c,x,y,z,g);
  }
  function disk(r:number,c:string,z:number,g:THREE.Group,name=''){
    return mesh(new THREE.CircleGeometry(r,72),c,0,dialY,z,g,name);
  }
  function bezel(r:number,t:number,z:number,c:string,g:THREE.Group){
    return mesh(new THREE.TorusGeometry(r,t,6,72),c,0,dialY,z,g);
  }
  function square(w:number,low:number,high:number,c:string){
    box(w,high-low,w,0,(high+low)/2,0,c);
  }
  function column(x:number,z:number,low:number,high:number,r:number,g:THREE.Group){
    round(r,r*.82,high-low,x,(low+high)/2,z,light,g);
    round(r*1.35,r*1.09,.013,x,low+.006,z,stone,g);
    round(r*.97,r*1.36,.015,x,high-.008,z,shade,g);
    box(r*2.9,.011,r*2.9,x,high,z,light,g);
  }
  function hand(length:number,wide:number,z:number,g:THREE.Group){
    const s=new THREE.Shape();s.moveTo(-wide*.43,-.014);s.lineTo(-wide*.55,.022);
    s.lineTo(-wide*.34,length*.49);s.lineTo(-wide*.58,length*.65);s.lineTo(0,length);
    s.lineTo(wide*.58,length*.65);s.lineTo(wide*.34,length*.49);s.lineTo(wide*.55,.022);s.lineTo(wide*.43,-.014);s.closePath();
    return mesh(new THREE.ExtrudeGeometry(s,{depth:.002,bevelEnabled:false}),iron,0,dialY,z,g);
  }
  square(wall*2,.90,2.50,stone);
  // Broken-out head mouldings and shadow lines around the smaller pierced stories.
  for(const [w,lo,hi,c] of [
    [.666,2.332,2.346,shade],[.684,2.346,2.359,light],[.673,2.359,2.371,stone],
    [.678,2.486,2.498,shade],[.709,2.498,2.509,light],[.732,2.51,2.528,shade],[.742,2.528,2.54,light],
    [.658,2.54,2.574,stone],[.648,2.574,2.584,light],
    [.639,2.827,2.85,stone],[.661,2.85,2.867,shade],[.687,2.867,2.881,light],
    [.637,2.881,2.93,stone],[.647,2.93,2.945,light],[.545,2.945,2.996,stone],[.566,2.996,3.01,light],
    [.471,3.01,3.04,shade],[.477,3.04,3.055,light],[.377,3.055,3.074,stone],
    [.377,3.238,3.254,shade],[.397,3.254,3.271,light]
  ] as const)square(w,lo,hi,c);
  const digits=['XII','I','II','III','IIII','V','VI','VII','VIII','IX','X','XI'];
  const labels=digits.map(d=>{
    const geo=new TextGeometry(d,{font,size:.029,depth:.0013,curveSegments:2});geo.computeBoundingBox();
    const b=geo.boundingBox!;geo.translate(-(b.min.x+b.max.x)/2,-(b.min.y+b.max.y)/2,0);return geo;
  });
  for(let side=0;side<4;side++){
    const g=new THREE.Group();g.rotation.y=side*Math.PI/2;root.add(g);
    // A recessed central channel and two longer outside panels lie below each dial.
    for(const x of [-.239,-.060,.060,.239]){
      box(.008,1.125,.008,x,1.65,wall+.001,shade,g);
      box(.005,1.125,.010,x+.005,1.65,wall+.004,light,g);
    }
    for(const x of [-.151,.151])box(.17,.009,.011,x,2.211,wall+.003,light,g);
    for(const [x,y] of [[0,1.675],[-.175,1.415],[.175,1.415],[0,1.164]]){
      box(.047,.122,.008,x,y,wall+.003,light,g);
      box(.034,.105,.005,x,y,wall+.009,'#706f66',g);
      box(.023,.093,.004,x,y,wall+.013,'#58605d',g);
      box(.030,.005,.006,x,y,wall+.016,shade,g);
    }
    for(let i=-3;i<=3;i++){
      const x=i*.068;
      box(.052,.059,.009,x,2.424,wall+.004,shade,g);
      box(.042,.050,.007,x+.001,2.424,wall+.011,'#686d65',g);
    }
    for(let i=-17;i<=17;i++)box(.009,.009,.012,i*.019,2.495,wall+.014,shade,g);
    // Recessed green-grey center, wide ivory chapter ring, radial Roman numerals.
    disk(radius+.009,shade,wall+.012,g);
    disk(radius,'#eee8d5',wall+.017,g,'Twenty-two foot clock dial');
    bezel(radius,.0043,wall+.022,iron,g);
    disk(radius*.687,'#6b6858',wall+.023,g);
    const dialGlass=disk(radius*.612,'#a7aa99',wall+.025,g,'Inner illuminated clock dial');
    dialGlass.userData.signLight=[.78,.71,.51];
    bezel(radius*.61,.0026,wall+.028,bronze,g);
    bezel(radius*.447,.0018,wall+.029,'#d6cbb2',g);
    for(let i=0;i<60;i++){
      const t=i*Math.PI/30;
      const tick=box(.0024,i%5===0?.014:.007,.003,Math.sin(t)*radius*.966,dialY+Math.cos(t)*radius*.966,wall+.024,iron,g);tick.rotation.z=-t;
      if(i%5===0){
        const m=mesh(labels[i/5],iron,Math.sin(t)*radius*.82,dialY+Math.cos(t)*radius*.82,wall+.025,g);
        m.rotation.z=-t;m.scale.x=.79;
      }
    }
    const hour=hand(7.5*foot,.019,wall+.032,g),minute=hand(11*foot,.012,wall+.037,g);
    hands.push({minute,hour,angle:g.rotation.y});
    disk(.009,bronze,wall+.041,g,'Clock spindle');

    // Two square colonnades. This stage has five clear openings between the corner piers.
    for(const sign of [-1,1]){
      box(.084,.245,.071,sign*.273,2.705,.267,stone,g);
      box(.014,.236,.013,sign*.285,2.705,.309,light,g);
      box(.059,.158,.052,sign*.148,3.156,.145,stone,g);
    }
    for(const x of [-.144,-.048,.048,.144])column(x,.274,2.584,2.826,.012,g);
    for(const x of [-.033,.033])column(x,.153,3.076,3.236,.010,g);
    for(const [x,y,z,r] of [[.287,2.959,.287,.017],[.180,3.073,.180,.013],[.174,3.286,.174,.012]]){
      mesh(new THREE.SphereGeometry(r,10,8),bronze,x,y,z,g);
    }
  }
  // Both round lantern galleries are open to the sky through the column bays.
  for(const [low,high,r,n] of [[3.283,3.469,.104,10],[3.523,3.635,.063,10]]){
    round(r*1.26,r*1.17,.023,0,low,0,stone);
    for(let i=0;i<n;i++){
      const a=i*Math.PI*2/n;column(Math.sin(a)*r,Math.cos(a)*r,low+.011,high,r*.096,root);
    }
    round(r*1.16,r*1.30,.021,0,high+.007,0,shade);
    round(r*1.30,r*1.33,.012,0,high+.023,0,light);
  }
  round(.138,.125,.019,0,3.507,0,light);
  for(let i=0;i<20;i++){
    const a=i*Math.PI/10;round(.003,.002,.020,.128*Math.sin(a),3.525,.128*Math.cos(a),stone);
  }
  const dome=mesh(new THREE.SphereGeometry(.081,24,12,0,Math.PI*2,0,Math.PI/2),'#8d8067',0,3.665,0);
  dome.scale.y=.84;
  round(.024,.012,.027,0,3.738,0,bronze);
  const top=235*foot;
  round(.0038,.002,(top-3.75),0,(top+3.75)/2,0,'#b6ae92');
  // Roof-mounted floods rake up the shaft; lights inside the upper stages
  // catch cornice soffits and the backs of the columns. HLB restoration design.
  // https://hlblighting.com/project/san-francisco-ferry-building/
  function towerUplight(p:THREE.Vector3,n:THREE.Vector3){
    if(p.y<.94||p.y>3.75)return 0;
    const dx=p.x-root.position.x,dz=p.z-root.position.z;
    const radius=Math.max(.001,Math.hypot(dx,dz));
    const outward=(dx*n.x+dz*n.z)/radius;
    const shaft=(.55+.35*Math.max(0,outward))*(.62+.38*THREE.MathUtils.smoothstep(p.y,1.03,2.15));
    const gallery=.29+.72*Math.max(0,-outward)+.42*Math.max(0,-n.y);
    return THREE.MathUtils.lerp(shaft,gallery,THREE.MathUtils.smoothstep(p.y,2.48,2.58));
  }
  root.traverse(o=>{if(o instanceof THREE.Mesh)o.userData.uplight=towerUplight;});
  const flag=createFerryFlag();flag.position.y=top-.007;root.add(flag);
  return {root,hands,flag};
}

export function setFerryClockTime(hands:Hands[],hours:number,minutes:number){
  for(const {minute,hour} of hands){
    minute.rotation.z=-minutes*Math.PI/30;
    hour.rotation.z=-(hours%12+minutes/60)*Math.PI/6;
  }
}
