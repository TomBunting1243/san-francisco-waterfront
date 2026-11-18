import * as THREE from 'three';

type FerryMesh = (shape: THREE.BufferGeometry, color: string, x: number, y: number, z: number, parent: THREE.Group) => THREE.Mesh;
type Point = [x: number, y: number, z: number];

// Dorado and Delphinus share Mavrik Marine's low, twin-hull profile. Stations
// run stern to bow. Successive livery seams partition the same skin.
const stations = [
  { x:-2.59, width:.164, bottom:-.56, sheer:.46, paint:[-.20,-.15,-.08] },
  { x:-2.49, width:.214, bottom:-.71, sheer:.49, paint:[-.20,-.14,-.075] },
  { x:-1.88, width:.242, bottom:-.748, sheer:.51, paint:[-.19,-.11,-.04] },
  { x:-1.06, width:.248, bottom:-.748, sheer:.51, paint:[-.15,-.04,.04] },
  { x:-.24, width:.248, bottom:-.748, sheer:.52, paint:[-.08,.035,.13] },
  { x:.61, width:.243, bottom:-.748, sheer:.53, paint:[.035,.16,.26] },
  { x:1.31, width:.232, bottom:-.71, sheer:.55, paint:[.16,.29,.40] },
  { x:1.88, width:.203, bottom:-.63, sheer:.56, paint:[.30,.44,.52] },
  { x:2.27, width:.159, bottom:-.52, sheer:.58, paint:[.44,.52,.57] },
  { x:2.56, width:.115, bottom:-.38, sheer:.59, paint:[.54,.565,.585] },
  { x:2.72, width:.073, bottom:-.25, sheer:.60, paint:[.569,.583,.594] },
] as const;
// San Francisco Bay Ferry fleet particulars for both Mavrik sister ships.
export const doradoDimensions={length:42*.06,beam:10.5*.06,draft:1.4*.06};
const deckScale=.27,waterline=-.20,keel=-.748;
const boardingSill=.529, boardingLedgeThickness=.027;
export const doradoBoardingFreeboard=(boardingSill+boardingLedgeThickness/2-waterline)*deckScale;
export const doradoWake={
  stern:-2.59*doradoDimensions.length/5.31,
  hullOffset:.562*doradoDimensions.beam/1.62,
  halfBeam:doradoDimensions.beam/2,
};
const navy='#1d3c5a', blue='#3a7390', green='#5d966e', white='#e3e0ce', darkSeam='#597175';

function hullSkin(parent: THREE.Group, mesh: FerryMesh) {
  const bands = new Map<string,number[]>();
  function panel(color:string,a:Point,b:Point,c:Point,d:Point) {
    let vertices=bands.get(color);
    if(!vertices)bands.set(color,vertices=[]);
    vertices.push(...a,...b,...c,...a,...c,...d);
  }
  const paint=[navy,blue,green,white];
  for(const center of [-.562,.562]){
    function ring(section:typeof stations[number],side:number):Point[] {
      const heights=[section.bottom,...section.paint,section.sheer];
      return heights.map(y=>{
        const u=(y-section.bottom)/(section.sheer-section.bottom);
        // Narrow keel, full shoulder, and a raked bow form the twin demihulls.
        const breadth=section.width*(.54+.46*Math.sqrt(u));
        const skinY=y<waterline?waterline+(y-waterline)*doradoDimensions.draft/((waterline-keel)*deckScale):y;
        return [section.x,skinY,center+side*breadth];
      });
    }
    const left=stations.map(s=>ring(s,-1)),right=stations.map(s=>ring(s,1));
    for(let i=1;i<stations.length;i++){
      for(let b=0;b<paint.length;b++){
        panel(paint[b],right[i-1][b],right[i][b],right[i][b+1],right[i-1][b+1]);
        panel(paint[b],left[i-1][b+1],left[i][b+1],left[i][b],left[i-1][b]);
      }
      panel(navy,left[i-1][0],left[i][0],right[i][0],right[i-1][0]);
      panel(white,left[i-1][4],right[i-1][4],right[i][4],left[i][4]);
    }
    for(let b=0;b<paint.length;b++){
      panel(paint[b],left[0][b],right[0][b],right[0][b+1],left[0][b+1]);
      panel(navy,right.at(-1)![b],left.at(-1)![b],left.at(-1)![b+1],right.at(-1)![b+1]);
    }
  }
  for(const [color,positions] of bands){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(positions.length/3*2),2));
    geometry.computeVertexNormals();
    const part=mesh(geometry,color,0,0,0,parent);
    part.name='Continuous painted hull band';
  }
}

function deckOutline(points: readonly Point[], thickness:number) {
  const shape=new THREE.Shape(points.map(([x,,z])=>new THREE.Vector2(x,-z)));
  return new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false}).rotateX(-Math.PI/2);
}

export function createDoradoFerry(mesh:FerryMesh,name:string) {
  const hull=new THREE.Group();
  hull.name=name;
  hull.scale.set(doradoDimensions.length/5.31,deckScale,doradoDimensions.beam/1.62);
  hullSkin(hull,mesh);
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,color:string)=>
    mesh(new THREE.BoxGeometry(w,h,d),color,x,y,z,hull);
  function beam(a:Point,b:Point,w:number,color:string){
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from),mid=from.lerp(to,.5);
    const steel=mesh(new THREE.CylinderGeometry(w,w,delta.length(),6),color,mid.x,mid.y,mid.z,hull);
    steel.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  }
  const cabin='#29414a', glass='#3e5860', trim='#a8b4ad', roof='#dfddc9', rubbing='#465b5f';
  function plate(points:Point[],thickness:number,y:number,color:string){
    mesh(deckOutline(points,thickness),color,0,y,0,hull);
  }

  // The bridge deck stops before the catamaran's twin stems; open working decks
  // and railings keep the stern and both forward ends visually separate.
  plate([[-2.57,0,-.64],[-2.37,0,-.76],[-1.72,0,-.797],[1.90,0,-.770],[2.38,0,-.620],
    [2.47,0,-.25],[2.47,0,.25],[2.38,0,.62],[1.90,0,.77],[-1.72,0,.797],[-2.37,0,.76],[-2.57,0,.64]],.118,.43,white);
  plate([[-1.78,0,-.716],[-1.60,0,-.75],[1.59,0,-.75],[1.89,0,-.52],[1.89,0,.52],
    [1.59,0,.75],[-1.60,0,.75],[-1.78,0,.716]],.588,.52,white);
  const sill=.80, head=1.032;
  for(const side of [-1,1]){
    const z=.753*side;
    for(let i=0;i<9;i++){
      const x=-1.52+i*.344;
      box(.310,head-sill,.017,x,(sill+head)/2,z,i%3===0?glass:cabin);
    }
    box(.210,.35,.024,-1.59,.742,z*1.007,trim);
    box(.12,.137,.027,-1.59,.836,z*1.02,cabin);
    box(2.10,.034,.031,-.54,.575,z*1.015,rubbing);
    for(const at of [-1.06,.27,.85]){
      box(.017,.026,.062,at,.608,z*1.033,trim);
    }
    // Narrow boarding cut with dark weather stripping and a deck-level ledge.
    box(.16,.286,.027,.44,.68,z*1.014,'#b3beb6');
    box(.009,.261,.029,.50,.683,z*1.033,darkSeam);
    box(.205,boardingLedgeThickness,.075,.44,boardingSill,z*1.025,roof);
  }
  const bowGlass=box(.036,.270,1.22,1.76,.905,0,cabin);
  bowGlass.rotation.z=-.27;
  for(const z of [-.50,-.17,.17,.50])box(.021,.298,.025,1.79,.92,z,trim).rotation.z=-.27;
  // Wide overhang and lower forward brow with the green/blue livery curve.
  plate([[-1.86,0,-.78],[1.17,0,-.78],[1.64,0,-.63],[1.83,0,-.44],[1.83,0,.44],
    [1.64,0,.63],[1.17,0,.78],[-1.86,0,.78]],.078,1.086,roof);
  const brow=box(.43,.053,1.27,1.76,1.092,0,green);
  brow.rotation.z=-.18;
  const bowBrow=box(.18,.044,1.15,2.049,1.045,0,blue);
  bowBrow.rotation.z=-.18;

  const pilot=box(2.00,.347,1.28,.14,1.343,0,white);
  pilot.rotation.z=.006;
  for(const side of [-1,1]){
    const z=.646*side;
    for(let i=0;i<6;i++)box(.275,.192,.022,-.68+i*.309,1.388,z,i%2?cabin:glass);
    for(const x of [-.895,.99])box(.044,.255,.028,x,1.36,z*1.013,white);
  }
  for(const z of [-.428,-.148,.148,.428]){
    box(.055,.247,.246,1.147,1.382,z,cabin).rotation.z=-.22;
  }
  plate([[-.96,0,-.68],[1.18,0,-.72],[1.27,0,-.56],[1.27,0,.56],[1.18,0,.72],[-.96,0,.68]],
    .085,1.507,roof);

  for(const side of [-1,1]){
    const z=side*.741;
    // Stainless rails surround the exposed aft and foredeck areas.
    for(const [from,to,y] of [[-2.46,-1.79,.55],[1.88,2.41,.55],[-1.75,-.93,1.168]]){
      const edge=z*(from>1?.85:1);
      for(let x=from;x<=to+.003;x+=.16)box(.016,.303,.018,x,y+.151,edge,trim);
      for(const d of [.136,.281])beam([from,y+d,edge],[to,y+d,edge],.011,roof);
    }
    for(const x of [-2.36,2.27]){
      box(.11,.075,.11,x,.575,z*.76,rubbing);
      beam([x-.065,.655,z*.76],[x+.067,.655,z*.76],.016,trim);
    }
    for(const x of [-2.37,2.34])box(.029,.14,.105,x,.575,z*.85,rubbing);
    mesh(new THREE.TorusGeometry(.069,.015,5,12),'#be7952',-1.92,.746,z*1.018,hull);
    box(.029,.175,.025,-1.92,.740,z,'#9caeaa');
  }
  for(const d of [.122,.274]){
    beam([-2.48,.55+d,-.63],[-2.48,.55+d,.63],.012,roof);
    beam([2.40,.55+d,-.61],[2.40,.55+d,.61],.012,roof);
  }
  for(const [x,z] of [[-.42,-.46],[-.42,.46],[.64,0]])box(.18,.079,.12,x,1.606,z,roof);
  const mastX=-.08,mastHead=2.115;
  beam([mastX,1.58,0],[mastX,mastHead,0],.018,trim);
  beam([mastX-.17,1.603,0],[mastX,2.02,0],.011,trim);
  beam([mastX,1.97,-.20],[mastX,1.97,.20],.010,roof);
  box(.087,.058,.275,mastX,mastHead,0,roof);
  box(.04,.045,.050,mastX,1.972,-.192,'#a55c4d');
  box(.04,.045,.050,mastX,1.972,.192,green);
  // The moving group's origin follows the water triangle under the hulls.
  // Position every painted and structural part relative to that load waterline.
  for(const part of hull.children)part.position.y-=waterline;
  return hull;
}
