import {FacadePanels} from './facade-panels.ts';
import {addOshaDiningRoom} from './osha-dining-room.ts';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from './harbor-font.json' with {type:'json'};

type UV=[number,number];
// The 2023 USGS 1.5 m ground grid gives 3.70–3.75 m at the dining strip
// versus 3.39–3.45 m at the tree allée, whose modeled paving is at .163.
const allee=.163;
export const fourCenterDiningFloor=allee+(3.72-3.40)*.06;
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
  function storefront(a:UV,b:UV,floor:number,ceiling:number,bays:number,name:string,entry=-1,dining=false){
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
          const center=x+side*w*.242;
          const leaf=dining?box(w*.465,.009,.008,center,floor+.065,-.037,bronze,g):
            box(w*.465,doorHeight,.017,center,floor+doorHeight/2,-.037,'#454f49',g);
          if(dining){
            for(const edge of [-1,1])box(.0035,doorHeight,.009,center+edge*w*.219,floor+doorHeight/2,-.037,bronze,g);
            box(w*.463,.015,.009,center,floor+.008,-.037,bronze,g);
          }
          leaf.name='Recessed glass door';
          box(.005,.032,.009,x+side*.010,floor+.065,-.022,'#c1a26f',g);
        }
        box(w,.010,.05,x,floor+doorHeight,0,bronze,g);
      }else{
        if(dining){
          // Clear openings retain the view through the room after the
          // opaque city bake. Narrow glazing stops and the transom catch sky.
          box(w-.009,.011,.010,x,ceiling-top-.006,-.011,'#96a9a2',g);
          box(.003,h-top-.026,.004,x+w*.43,floor+(h-top+.026)/2,-.013,'#839790',g);
        }else{
          const recessed=name.includes('plaza shop')||name.includes('dining terrace');
          box(w-.008,h-top-.025,.012,x,floor+(h-top+.025)/2,recessed?-.061:-.010,i%3===1?'#6a8079':teal,g);
          if(recessed){
            box(.010,h-top-.025,.061,x-w*.48,floor+(h-top+.025)/2,-.027,bronze,g);
            box(w,.006,.066,x,floor+.030,-.026,'#aa9e89',g);
          }
        }
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
  storefront(joint,north,fourCenterDiningFloor,lobby-.068,4,'Four Center north plaza shop',1);
  storefront(osha,joint,fourCenterDiningFloor,lobby-.068,4,'Four Center middle plaza shop',2);
  const patio=storefront(end,osha,fourCenterDiningFloor,lobby-.068,5,'Osha Thai · street-level plaza entrance',2,true);
  storefront([2.91,5.20],[5.27,5.20],fourCenterDiningFloor,lobby-.068,12,'Osha Thai · Sacramento return',3,true);
  // The published lower-case wordmark is represented in relief. Mounting and
  // precise letter profiles are interpreted from location photographs.
  const sign=box(.30,.075,.016,0,lobby-.108,.027,'#4b423b',patio);
  sign.name='Osha Thai signboard';
  const letters=new THREE.ShapeGeometry(font.generateShapes('osha thai',.040),4);
  letters.computeBoundingBox();const bb=letters.boundingBox!;
  letters.translate(-(bb.min.x+bb.max.x)/2,-(bb.min.y+bb.max.y)/2,0);
  part(letters,'#f4c9ac',0,lobby-.108,.036,patio).name='Osha Thai lettering';
  // The operator photographs show a continuous terrace from the glazed
  // leaves to the café railing. Carry the complete R-4110 floor and its
  // neighboring plaza storefronts on the surveyed apron. The shell still
  // bears on the original podium; the upper floors keep their own grade.
  const platform=new FacadePanels(),pad=fourCenterDiningFloor;
  const outline:UV[]=[[2.91,3.21],north,end,[5.27,5.20],[2.91,5.20]];
  for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(outline.map(([x,z])=>new THREE.Vector2(x,z)),[])){
    const at=(k:number):[number,number,number]=>[outline[k][0],pad,outline[k][1]];
    platform.triangle(at(a),at(c),at(b),'#b3aa98');
  }
  // Sacramento's return is within the same street-level lease; the plaza-
  // facing corner and its return share a supported landing.
  for(let i=0;i<outline.length;i++){
    const a=outline[i],b=outline[(i+1)%outline.length];
    platform.quad([a[0],street,a[1]],[a[0],pad,a[1]],[b[0],pad,b[1]],[b[0],street,b[1]],concrete);
  }
  const baseMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92});
  const plinth=platform.mesh(baseMat);plinth.name='Four Center dining floor';root.add(plinth);
  const paving=new FacadePanels(),far=Math.hypot(end[0]-north[0],end[1]-north[1]);
  const start=-Math.hypot(end[0]-osha[0],end[1]-osha[1])/2,endU=start+far;
  const rows=[[0,pad],[.215,pad],[.335,allee+.009],[.54,allee]] as const;
  for(let j=1;j<rows.length;j++){
    const [d0,h0]=rows[j-1],[d1,h1]=rows[j];
    paving.quad([start,h0,d0],[start,h1,d1],[endU,h1,d1],[endU,h0,d0],j===1?'#ac9982':'#b6ae9b');
  }
  const paved=paving.mesh(baseMat);paved.name='Four Center dining apron to plaza allée';patio.add(paved);
  addOshaDiningRoom(root,patio,pad,lobby-.068);
  for(const [level,roof,inset,setback] of [[lobby,promenade,.035,.36],[promenade,1.09,.11,.47]]){
    // The city aerial shows the plaza tables in open sky. The upper tenant
    // walls and terrace edges are inland of the street-floor dining facade.
    const a:UV=[north[0]-.80*setback,north[1]+.60*setback];
    const south=5.19-inset,b:UV=[a[0]+(south-a[1])*.75,south];
    storefront(b,a,level,roof-.035,11,'Four Center glazed dining terrace',7);
    terrace(b,a,level,.18+inset,level===lobby?street:lobby);
    storefront([2.91,south],b,level,roof-.035,10,'Four Center south dining windows',4);
    terrace([2.91,south],b,level,.19+inset,level===lobby?street:lobby);
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
