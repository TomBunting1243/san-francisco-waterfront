import * as THREE from 'three';

// J/Boats J/22 technical specifications. St. Francis Yacht Club sails this
// class on the Bay. LOA, LWL, beam, draft and I/J/P/E are in metres.
const rig={length:6.86,waterline:5.79,beam:2.44,draft:1.16,I:7.56,J:2.68,P:7.96,E:2.74};
const scale=.06;
export const daySailerContact={halfLength:rig.waterline*scale/2,halfBeam:rig.beam*scale/2};

/** The loaded waterline is local y=0; the hull points along local +X. */
export function createDaySailer(accent:string){
  const positions:number[]=[],colors:number[]=[],paint=new THREE.Color();
  type Point=[number,number,number];
  function triangle(a:Point,b:Point,c:Point,color:string){
    positions.push(...a,...b,...c);paint.set(color);
    for(let i=0;i<3;i++)colors.push(paint.r,paint.g,paint.b);
  }
  function quad(a:Point,b:Point,c:Point,d:Point,color:string){
    triangle(a,b,c,color);triangle(a,c,d,color);
  }
  function spar(a:Point,b:Point,r:number,color:string){
    const axis=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize();
    const u=new THREE.Vector3(0,0,1),v=new THREE.Vector3().crossVectors(axis,u);
    const rim=(p:Point,i:number):Point=>{
      const angle=i*Math.PI/3;
      return new THREE.Vector3(...p).addScaledVector(u,r*Math.cos(angle))
        .addScaledVector(v,r*Math.sin(angle)).toArray() as Point;
    };
    for(let i=0;i<6;i++)quad(rim(a,i),rim(a,i+1),rim(b,i+1),rim(b,i),color);
  }
  // The tips overhang the waterline. Paired deck and immersed stations close
  // the transom, topsides and bilge, leaving a separate fin below the hull.
  const half=rig.length/2,wl=rig.waterline/2;
  const stations=[
    [-half,-wl,.68,.48],[-2.10,-1.92,1.04,.51],[-.62,-.60,rig.beam/2,.50],
    [.67,.65,1.16,.48],[2.05,1.85,.77,.53],[half,wl,.014,.64],
  ];
  for(let i=1;i<stations.length;i++){
    const [x,u,w,h]=stations[i-1],[nx,nu,nw,nh]=stations[i];
    for(const side of [-1,1]){
      quad([x,h,w*side],[nx,nh,nw*side],[nx,nh-.105,nw*side],[x,h-.105,w*side],accent);
      quad([x,h-.105,w*side],[nx,nh-.105,nw*side],[nu,0,nw*.85*side],[u,0,w*.85*side],'#ece7d7');
      quad([u,0,w*.85*side],[nu,0,nw*.85*side],[nu,-.24,0],[u,-.24,0],'#b6b9ac');
    }
    quad([x,h,-w],[nx,nh,-nw],[nx,nh,nw],[x,h,w],'#e1decb');
  }
  for(const idx of [0,stations.length-1]){
    const [x,u,w,h]=stations[idx];
    quad([x,h,w],[x,h,-w],[u,0,-w*.85],[u,0,w*.85],'#e6dfc8');
    triangle([u,0,w*.85],[u,0,-w*.85],[u,-.24,0],'#b6b9ac');
  }
  quad([-.84,-.16,0],[.43,-.16,0],[.11,-rig.draft,0],[-.57,-rig.draft,0],'#85918e');
  quad([-3.28,.19,0],[-2.98,.19,0],[-2.93,-.63,0],[-3.18,-.63,0],'#a7aaa0');
  quad([-2.67,.535,-.57],[-.58,.535,-.57],[-.58,.535,.57],[-2.67,.535,.57],'#777f76');
  const cabin:Point[]=[[-.52,.52,-.72],[.98,.54,-.52],[.98,.54,.52],[-.52,.52,.72]];
  const roof:Point[]=[[-.47,.79,-.55],[.87,.71,-.42],[.87,.71,.42],[-.47,.79,.55]];
  for(let i=0;i<4;i++){const next=(i+1)%4;quad(cabin[i],cabin[next],roof[next],roof[i],'#d3d6ca');}
  quad(roof[0],roof[1],roof[2],roof[3],'#eee9d7');
  const mast=half-.28-rig.J,boom=1.14;
  spar([mast,.50,0],[mast,boom+rig.P+.10,0],.047,'#798782');
  spar([mast-rig.E,boom,.14],[mast,boom,0],.04,'#818880');
  const panel=(t:number):[Point,Point]=>[
    [mast,boom+rig.P*t,.018],
    [mast-rig.E*(1-t),boom+rig.P*t+.14*(1-t),.14*(1-t)+.16*Math.sin(Math.PI*t)],
  ];
  for(let i=0;i<8;i++){
    const [a,b]=panel(i/8),[d,c]=panel((i+1)/8);
    quad(a,b,c,d,i===5?accent:i%2?'#fff7de':'#f4edd4');
  }
  const tack:Point=[mast+rig.J,.57,0],head:Point=[mast,.50+rig.I,0],clew:Point=[mast+.10,1.15,-.18];
  triangle(tack,head,clew,'#eee4ca');
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.scale(scale,scale,scale);geometry.computeVertexNormals();
  const boat=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.84}));
  boat.name='J/22 daysailer';boat.receiveShadow=true;return boat;
}
