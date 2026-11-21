import {openingIrradiance} from './authored-window-spill.ts';
import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {StreetAssembly} from './street-amenities.ts';
import {FacadePanels} from './facade-panels.ts';
import {footprintGeometry} from './sf-map.ts';

type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const stone='#e0dcd2',brick='#e8e4dd',bronze='#61473c',iron='#383d3b';
const grade=.045,cornice=.363;

// Outlines of the six freestanding metal letters, from the operator's event
// deck masthead. The same flared strokes and spacing appear in the door photo.
const transomLetters=[
  [[15,76,3,8,0,2,14,2,9,7,10,19,21,19,22,5,19,2,34,2,29,9,21,73,20,76], [13,24,17,48,20,24]], // A
  [[87,77,92,72,92,34,80,76,63,76,71,67,70,6,65,2,82,2,76,6,77,57,91,5,93,2,99,3,98,72,102,77]], // N
  [[163,75,158,72,154,74,146,74,141,71,137,63,135,48,136,14,139,5,145,1,152,1,155,4,158,4,162,0,162,40,151,30,155,27,155,13,151,2,147,3,145,10,146,70,147,72,152,72,161,56,163,72]], // G
  [[200,77,204,73,205,69,203,8,199,3,224,3,226,30,217,6,210,6,212,72,217,77]], // L
  [[259,77,266,68,266,12,261,2,288,2,290,29,282,6,280,4,273,5,275,37,279,36,283,28,283,51,279,44,274,42,273,74,278,74,281,66,288,56,288,77]], // E
  [[321,76,326,70,326,7,324,7,320,2,340,2,334,6,336,37,340,37,343,33,344,4,346,2,356,2,351,7,351,33,345,40,350,45,352,52,351,68,342,76], [335,71,342,70,344,65,344,50,340,42,335,42]], // R
];
function transomSign(){
  const ring=(coords:number[])=>{
    const points:THREE.Vector2[]=[];
    for(let i=0;i<coords.length;i+=2)points.push(new THREE.Vector2((coords[i]-178)*.184/356,coords[i+1]*.0415/77));
    return points;
  };
  return new THREE.ShapeGeometry(transomLetters.map(([outer,...holes])=>{
    const shape=new THREE.Shape(ring(outer));
    shape.holes=holes.map(h=>new THREE.Path(ring(h)));return shape;
  }));
}

const pendantX=[-.26,.26],pendantZ=[-.20,-.44],sconceX=[-.135,.135];

// The city shader adds signLight only after dusk. Sample the actual surfaces in
// room coordinates while their pigment and normal are still available. This
// includes the floor visible through a window from an elevated waterfront orbit.
function bakeRestaurantLight(mesh:THREE.Mesh,bay:number,aperture:number){
  const g=mesh.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),pigment=g.getAttribute('color');
  const light=g.getAttribute('signLight');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    if(y>cornice)continue;
    let flux=0;
    if(z<-.012&&y>.036){
      for(const px of pendantX)for(const pz of pendantZ){
        const dx=px-x,dy=.252-y,dz=pz-z,d2=dx*dx+dy*dy+dz*dz;
        const facing=Math.max(0,(n.getX(i)*dx+n.getY(i)*dy+n.getZ(i)*dz)/Math.sqrt(Math.max(.00001,d2)));
        const falloff=Math.max(0,1-d2/.18);
        flux+=falloff*falloff*(.38+1.55*facing);
      }
    }
    if(z>-.027){
      for(const px of sconceX){
        const dx=(px-x)/.080,dy=(.224-y)/.138,dz=(z-.011)/.065;
        const falloff=Math.max(0,1-dx*dx-dy*dy-dz*dz);
        flux+=.39*falloff*falloff;
      }
    }
    // Occupied display openings face the promenade. Restrict escaping room
    // light to the exterior faces of the sill, frame and adjacent white brick.
    if(z>=0)for(const cx of [-bay,bay]){
      flux+=.50*openingIrradiance(cx,.190,-.014,aperture,.162,x,y,z,n.getX(i),n.getY(i),n.getZ(i));
    }
    if(flux<=0)continue;
    const r=Math.min(.54,flux*Math.sqrt(pigment.getX(i))*.76);
    const green=Math.min(.34,flux*Math.sqrt(pigment.getY(i))*.49);
    const blue=Math.min(.16,flux*Math.sqrt(pigment.getZ(i))*.24);
    light.setXYZ(i,Math.max(light.getX(i),r),Math.max(light.getY(i),green),Math.max(light.getZ(i),blue));
  }
}

// Jones Product's street elevation sets out this narrow parcel. The operator's
// 2024 photograph records the built revolving door and the contrasting flat leaf.
export function anglerFrontage(b:{p:number[][]},height:number,font:Font){
  const root=new THREE.Group(),windows:Pane[]=[];
  root.name='139 Steuart / 132 The Embarcadero';
  const [a,c]=b.p.slice(2,4),dx=c[0]-a[0],dz=c[1]-a[1],width=Math.hypot(dx,dz);
  const cx=(a[0]+c[0])/2,cz=(a[1]+c[1])/2,yaw=Math.atan2(-dz,dx);
  const front=new THREE.Group();front.position.set(cx,0,cz);front.rotation.y=yaw;root.add(front);
  const parts=new StreetAssembly();
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,tint:string)=>parts.box(x,y,z,w,h,d,tint);
  const half=width/2;
  // Keep the whole measured upper volume. Its underside is the ceiling over
  // the real openings. Below it, the three original party/back walls remain.
  const mass=new THREE.Mesh(footprintGeometry(b.p,height-cornice),new THREE.MeshStandardMaterial({color:stone}));
  mass.position.y=cornice;root.add(mass);
  const roof=new THREE.Mesh(footprintGeometry(b.p,.009),new THREE.MeshStandardMaterial({color:'#aca89e'}));roof.position.y=height;root.add(roof);
  for(const edge of [0,1,3]){
    const [x,z]=b.p[edge],[xx,zz]=b.p[(edge+1)%4],v=new THREE.Vector3(xx-x,0,zz-z);
    const shell=new THREE.Mesh(new THREE.BoxGeometry(v.length(),cornice,.006),mass.material);
    shell.position.set((x+xx)/2,cornice/2,(z+zz)/2);shell.rotation.y=-Math.atan2(v.z,v.x);root.add(shell);
  }
  const bay=width*.303,aperture=width*.239;
  function pane(x:number,y:number,w:number,h:number,depth:number){
    const pt=new THREE.Vector3(x,y,depth).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
    windows.push({x:cx+pt.x,y,z:cz+pt.z,ry:yaw,w,h});
  }
  // Photograph: two uninterrupted display windows between broad white brick
  // piers. The louvers sit above the glass and have visible dark air gaps.
  for(const x of [-bay,bay]){
    box(x,.062,-.004,aperture,.090,.017,'#613f38');
    box(x,.108,.003,aperture,.006,.020,'#ccc4b6');
    box(x,.293,-.007,aperture,.042,.010,'#444642');
    for(let i=0;i<6;i++)box(x,.277+i*.006,-.0005,aperture,.0023,.006,'#8a8981');
    for(const side of [-1,1])box(x+side*(aperture/2-.001),.190,-.009,.003,.162,.017,iron);
  }
  const cuts=[-half,-bay-aperture/2,-bay+aperture/2,-.111,.111,bay-aperture/2,bay+aperture/2,half];
  for(let j=0;j<cuts.length;j+=2){
    const lo=cuts[j],hi=cuts[j+1],x=(lo+hi)/2;
    parts.add(new THREE.BoxGeometry(hi-lo,.328,.018,1,8,1),brick,x,.164,-.009);
    for(let y=.053;y<.312;y+=.0135)parts.add(new THREE.PlaneGeometry(hi-lo,.0008),'#cfcac2',x,y,.0011);
  }
  box(0,(cornice+.316)/2,-.009,width,cornice-.316,.018,stone);
  box(0,cornice,.004,width+.006,.013,.024,'#c4bfb2');
  box(0,cornice+.008,.004,width+.012,.005,.030,'#e8e5de');

  // The revolving entrance occupies the right side of the central opening.
  // A glass bypass leaf is beside it. Frame only the glazing to keep true
  // sightlines to timber, chairs and lamps inside the dining room.
  const floor=.04515,drumX=.045,drumR=.060;
  const boards=new THREE.PlaneGeometry(width-.005,.62,10,8);boards.rotateX(-Math.PI/2);
  parts.add(boards,'#9a816b',0,floor,-.31);
  // SFMTA sidewalk 277 stops 0.66–0.70 m from the mapped masonry.
  // These two courtyard-facing vertices are its measured straight back edge.
  const landing=new FacadePanels();
  const left=-.42035,right=half;
  const back=(u:number)=>.0417-(u+.4204)*.0024/1.022;
  landing.quad([left,grade,0],[left,grade,back(left)],[right,grade,back(right)],[right,grade,0],'#b9b0a0');
  const apron=landing.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93}));
  apron.name='Angler threshold to surveyed sidewalk 277';front.add(apron);
  box(-.063,.125,-.002,.005,.158,.010,bronze);
  for(const x of [-.108,-.013])box(x,.125,-.002,.006,.158,.014,bronze);
  for(const y of [.053,.102,.207])box(-.061,y,-.001,.099,.007,.013,bronze);
  const cyl=(x:number,y:number,z:number,r:number,h:number,n:number,paint:string)=>
    parts.add(new THREE.CylinderGeometry(r,r,h,n),paint,x,y,z);
  const cap=cyl(drumX,.211,-.009,drumR,.014,20,bronze);
  cap.scale.z=.79;
  cyl(drumX,.129,-.009,.0028,.157,8,bronze);
  for(const angle of [.15,Math.PI*.55,Math.PI*1.05,Math.PI*1.55]){
    const x=drumX+Math.cos(angle)*drumR*.46,z=-.009+Math.sin(angle)*drumR*.46;
    for(const y of [.052,.107,.200])box(x,y,z,drumR*.92,.004,.0035,bronze).rotation.y=-angle;
    box(drumX+Math.cos(angle)*drumR*.92,.125,-.009+Math.sin(angle)*drumR*.92,.003,.153,.003,bronze);
  }
  for(const x of [drumX-drumR,drumX+drumR])box(x,.129,-.006,.005,.162,.014,bronze);
  box(0,.217,.003,.226,.008,.021,iron);
  box(0,.316,.002,.232,.005,.012,'#d2cec3');
  const letters=parts.add(transomSign(),'#ddd1bc',0,.223,.002);
  letters.userData.signLight=[.17,.124,.075];
  const number=new THREE.ShapeGeometry(font.generateShapes('132',.009),2);number.center();
  parts.add(number,'#484642',.134,.181,.002);
  for(const x of sconceX){
    box(x,.223,.004,.015,.044,.012,iron);
    box(x,.224,.011,.008,.031,.002,'#d6a16d').userData.signLight=[.69,.36,.12];
    for(const d of [-.003,0,.003])box(x+d,.224,.0125,.001,.035,.001,iron);
  }
  // The two small potted bay standards bracket the entrance in the dusk plate.
  for(const [j,x] of [-.144,.143].entries()){
    const z=.019;
    parts.add(new THREE.CylinderGeometry(.014,.010,.022,9),'#ae765b',x,grade+.011,z);
    cyl(x,grade+.022,z,.012,.001,9,'#51473a');
    box(x,grade+.047,z,.0026,.053,.0028,'#64563f');
    for(let k=0;k<9;k++){
      const a=k*2.4+j,r=.004+.007*(k%3)/2,dx=r*Math.cos(a),dz=r*Math.sin(a);
      const y=grade+.052+k*.0034;
      const stem=box(x+dx/2,y-.006,z+dz/2,.0014,.017,.0015,'#655740');
      stem.rotation.z=-dx/.016;stem.rotation.x=dz/.016;
      const leaves=parts.add(new THREE.IcosahedronGeometry(1,0),['#5d694b','#708052','#4e6044'][k%3],x+dx,y,z+dz);
      leaves.scale.set(.010,.008,.006);leaves.rotation.y=a;
    }
  }
  // The original three recessed windows and the broad subdivided upper
  // curtain wall follow the architect's elevation. Only these office panes
  // join the city night-window instances; retail light comes from its fixtures.
  for(const x of [-bay,0,bay]){
    box(x,.482,.002,.186,.204,.008,'#a7a59c');pane(x,.482,.171,.184,.008);
    for(const s of [-1,1])box(x+s*.091,.483,.012,.009,.213,.020,'#d0ccc1');
    box(x,.377,.011,.203,.011,.023,'#dcd7ca');
    box(x,.585,.009,.204,.014,.020,'#d2cec3');
    box(x,.483,.012,.003,.185,.006,'#898f89');
    box(x,.503,.012,.173,.003,.006,'#8a918b');
  }
  box(0,.643,.009,width+.009,.021,.031,'#c9c5b9');
  const bandBottom=.70,bandTop=height-.049,bandW=width*.924;
  box(0,(bandBottom+bandTop)/2,.002,bandW+.014,bandTop-bandBottom+.014,.010,'#909592');
  pane(0,(bandBottom+bandTop)/2,bandW,bandTop-bandBottom,.012);
  for(let j=1;j<9;j++)box(bandW*(j/9-.5),(bandBottom+bandTop)/2,.016,.0034,bandTop-bandBottom,.006,'#818985');
  box(0,bandBottom+(bandTop-bandBottom)*.46,.016,bandW,.004,.006,'#89918d');

  // Furnish just the depth that can be seen from the public sidewalk.
  for(const s of [-1,1])box(s*(half-.006),.176,-.31,.010,.255,.62,'#95694f');
  box(0,.183,-.603,width,.271,.015,'#936951').userData.signLight=[.039,.019,.007];
  for(let j=0;j<10;j++)box(0,.072+j*.023,-.594,width-.016,.0014,.001,'#785642');
  box(0,.288,-.300,width,.013,.60,'#a3876a');
  for(const z of [-.14,-.32,-.51])box(0,.278,z,width,.015,.012,'#59483b');
  for(const side of [-1,1]){
    box(side*(half-.034),.078,-.30,.056,.035,.44,'#5b4439');
    box(side*(half-.015),.112,-.30,.018,.041,.44,'#715649');
    for(const z of [-.144,-.304]){
      const x=side*(bay+.004);
      cyl(x,.091,z,.031,.0035,14,'#ae8366');
      cyl(x,.068,z,.003,.041,8,iron);
      cyl(x,.047,z,.013,.002,10,iron);
      const seat=x-side*.050;
      cyl(seat,.072,z,.0135,.004,10,'#5d4a3f');
      for(const d of [-.009,.009]){
        box(seat+d,.059,z,.002,.024,.002,'#484542');
        box(seat+d,.080,z+.010,.002,.041,.002,'#484542');
      }
      box(seat,.093,z+.010,.023,.011,.003,'#796453');
    }
  }
  // Cast metal fish over the backbar, as in the operator's Lounge plate.
  const fish=parts.add(new THREE.SphereGeometry(1,12,6),'#a69372',.023,.205,-.581);
  fish.scale.set(.065,.016,.009);fish.rotation.z=.07;
  const fin=new THREE.Shape();fin.moveTo(0,0);fin.lineTo(-.027,.014);fin.lineTo(-.022,-.011);fin.closePath();
  parts.add(new THREE.ShapeGeometry(fin),'#8b785b',-.035,.201,-.579);
  box(.01,.077,-.467,.365,.062,.047,'#a36d4c').userData.signLight=[.048,.021,.007];
  box(.01,.112,-.466,.377,.008,.058,'#474a45');
  box(.01,.098,-.442,.359,.002,.002,'#e0a763').userData.signLight=[.18,.074,.021];
  for(const z of pendantZ)for(const x of pendantX){
    cyl(x,.266,z,.0013,.022,6,iron);
    cyl(x,.252,z,.010,.006,12,'#caab81').userData.signLight=[.48,.275,.121];
  }
  // The existing upper rear windows keep the separate street-facing address.
  const [r,s]=b.p,backLength=Math.hypot(r[0]-s[0],r[1]-s[1]);
  const backYaw=Math.atan2(r[1]-s[1],s[0]-r[0]);
  for(let y=.4;y<height-.25;y+=.48)for(let d=.28;d<backLength-.2;d+=.4){
    const x=d-backLength/2;
    windows.push({x:(r[0]+s[0])/2+x*Math.cos(backYaw)+.045*Math.sin(backYaw),y,
      z:(r[1]+s[1])/2-x*Math.sin(backYaw)+.045*Math.cos(backYaw),ry:backYaw,w:.16,h:.23});
  }
  const lounge=parts.bake('Angler waterfront entry and dining room');
  bakeRestaurantLight(lounge,bay,aperture);front.add(lounge);
  return {root,windows};
}
