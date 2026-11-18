import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from './harbor-font.json' with {type:'json'};

type UV=[number,number];
const font=new FontLoader().parse(fontData);
// BXP's street, lobby and promenade plans, pp. 3–5. The eastern podium end
// turns along the diagonal boundary of Embarcadero Plaza. R-4110 reaches the
// southeastern corner, with R-4108 and R-4107 immediately north of it.
// https://embarcaderocenter.com/wp-content/uploads/Brochure_Embarcadero-Center_47v3.pdf
// https://oshathai.com/embarcadero/   https://oshathai.com/refresh/
// https://resizer.otstatic.com/v2/photos/xlarge/1/92332303.jpg
export function fourCenterRetail(street:number,lobby:number,promenade:number){
  const root=new THREE.Group();root.name='Four Embarcadero Center plaza frontage';
  root.position.set(9.278,0,-13.552);root.rotation.y=Math.atan2(-.891,-.454);
  const unit=new THREE.BoxGeometry(),materials=new Map<string,THREE.MeshStandardMaterial>();
  function part(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number,parent:THREE.Object3D=root){
    if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.82}));
    const mesh=new THREE.Mesh(geometry,materials.get(color));mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function box(w:number,h:number,d:number,x:number,y:number,z:number,color:string,parent:THREE.Object3D=root){
    const mesh=part(unit,color,x,y,z,parent);mesh.scale.set(w,h,d);return mesh;
  }
  const concrete='#b4a995',bronze='#484943',teal='#54716d';
  // Local x is horizontal across a facade as read from the plaza. Local z
  // points out of the storefront and toward diners or pedestrians.
  function face(a:UV,b:UV,name:string){
    const group=new THREE.Group();group.name=name;
    group.position.set((a[0]+b[0])/2,0,(a[1]+b[1])/2);
    group.rotation.y=Math.atan2(a[1]-b[1],b[0]-a[0]);root.add(group);return group;
  }
  function storefront(a:UV,b:UV,floor:number,ceiling:number,bays:number,name:string,entry=-1){
    const g=face(a,b,name),len=Math.hypot(b[0]-a[0],b[1]-a[1]),w=len/bays;
    const h=ceiling-floor,top=.064;
    box(len,top,.066,0,ceiling-top/2,0,concrete,g);
    for(let i=0;i<bays;i++){
      const x=-len/2+(i+.5)*w;
      if(i===entry){
        // Twin glazed leaves recessed behind the reveals and transom.
        const doorHeight=.139;
        box(w-.012,h-top-doorHeight,.015,x,ceiling-top-(h-top-doorHeight)/2,-.018,teal,g);
        for(const side of [-1,1]){
          const leaf=box(w*.465,doorHeight,.017,x+side*w*.242,floor+doorHeight/2,-.037,'#454f49',g);
          leaf.name='Recessed glass door';
          box(.005,.032,.009,x+side*.010,floor+.065,-.022,'#c1a26f',g);
        }
        box(w,.010,.05,x,floor+doorHeight,0,bronze,g);
      }else{
        box(w-.008,h-top-.025,.023,x,floor+(h-top+.025)/2,-.010,i%3===1?'#6a8079':teal,g);
        box(w,.025,.035,x,floor+.012,0,concrete,g);
      }
      box(.011,h-top,.026,x-w/2+.005,floor+(h-top)/2,.012,bronze,g);
    }
    return g;
  }
  function terrace(a:UV,b:UV,height:number,depth:number,low:number){
    const g=face(a,b,'Supported precast balcony'),len=Math.hypot(a[0]-b[0],a[1]-b[1]);
    box(len,.073,depth,0,height-.035,depth/2,concrete,g);
    box(len,.073,.035,0,height+.036,depth-.017,'#bfb39e',g);
    box(len,.012,.012,0,height+.095,depth-.019,bronze,g);
    const bays=Math.max(2,Math.round(len/.27));
    for(let i=0;i<=bays;i++){
      const x=(i/bays-.5)*len;
      box(.009,.096,.009,x,height+.045,depth-.019,bronze,g);
      if(i%2===0){
        const post=box(.053,height-low-.073,.056,x,low+(height-low-.073)/2,depth-.08,'#aca28f',g);
        post.name='Precast arcade pier';
      }
    }
  }
  // Transcribed southeast tenant line. The restaurant entrance is in the
  // short diagonal bay, rather than on Drumm Street or an elevated skywalk.
  const north:UV=[3.80,3.21],joint:UV=[4.31,3.89],osha:UV=[4.78,4.52],end:UV=[5.28,5.19];
  storefront(joint,north,street,lobby-.068,4,'Four Center north plaza shop',1);
  storefront(osha,joint,street,lobby-.068,4,'Four Center middle plaza shop',2);
  const patio=storefront(end,osha,street,lobby-.068,5,'Osha Thai · street-level plaza entrance',2);
  storefront([2.91,5.20],[5.27,5.20],street,lobby-.068,12,'Osha Thai · Sacramento return',3);
  const roomLength=Math.hypot(end[0]-osha[0],end[1]-osha[1]);
  // The published lower-case wordmark is represented in relief. Mounting and
  // precise letter profiles are interpreted from location photographs.
  const sign=box(.30,.075,.016,0,lobby-.108,.027,'#4b423b',patio);
  sign.name='Osha Thai signboard';
  const letters=new THREE.ShapeGeometry(font.generateShapes('osha thai',.040),4);
  letters.computeBoundingBox();const bb=letters.boundingBox!;
  letters.translate(-(bb.min.x+bb.max.x)/2,-(bb.min.y+bb.max.y)/2,0);
  part(letters,'#f4c9ac',0,lobby-.108,.036,patio).name='Osha Thai lettering';
  // Flanking planted tables leave the approach through the middle bay clear.
  const leaf=new THREE.IcosahedronGeometry(1,0),disc=new THREE.CylinderGeometry(1,1,1,10);
  for(const side of [-1,1]){
    for(let i=0;i<2;i++){
      const x=side*roomLength*(.22+.14*i),z=.106+.046*(i%2);
      const table=part(disc,'#c6b092',x,street+.045,z,patio);table.scale.set(.032,.007,.032);
      box(.010,.043,.010,x,street+.020,z,'#655d4d',patio);
      for(const c of [-1,1]){
        box(.030,.010,.027,x,street+.024,z+c*.046,'#9b8065',patio);
        box(.028,.037,.009,x,street+.032,z+c*.058,'#9b8065',patio);
      }
    }
    box(.041,.077,.044,side*.349,street+.039,.19,'#846e5b',patio);
    for(let k=0;k<8;k++){
      const blossom=part(leaf,k%3?'#ab5267':'#61754d',side*(.35-.019*k),lobby-.145+.009*Math.cos(k),.032,patio);
      blossom.scale.set(.023,.017,.018);
    }
  }
  for(const [level,roof,inset] of [[lobby,promenade,.035],[promenade,1.09,.11]]){
    // The two upper dining terraces retreat in succession. Broken tenant
    // fronts and supporting piers explain the horizontal bands seen from shore.
    const a:UV=[3.82-inset,3.24+inset],b:UV=[5.29-inset,5.19+inset];
    storefront(b,a,level,roof-.035,11,'Four Center glazed dining terrace',7);
    terrace(b,a,level,.18+inset,level===lobby?street:lobby);
    storefront([2.91,5.19-inset],[5.22-inset,5.19-inset],level,roof-.035,10,'Four Center south dining windows',4);
    terrace([2.91,5.19-inset],[5.22-inset,5.19-inset],level,.19+inset,level===lobby?street:lobby);
  }
  for(const [floor,ceiling] of [[street,lobby],[lobby,promenade],[promenade,1.09]]){
    storefront([2.91,5.20],[2.91,3.21],floor,ceiling-.05,8,'Four Center interior gallery',2);
    storefront([2.91,3.21],[3.80,3.21],floor,ceiling-.05,4,'Four Center gallery return',1);
  }
  const shape=new THREE.Shape();
  for(const [i,[u,v]] of ([[2.91,3.21],[3.66,3.35],[5.09,5.08],[2.91,5.08]] as UV[]).entries()){
    if(i===0)shape.moveTo(u,-v);else shape.lineTo(u,-v);
  }
  shape.closePath();
  const roof=new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false}).rotateX(-Math.PI/2);
  part(roof,concrete,0,1.055,0).name='Four Center dining pavilion roof';
  return root;
}
