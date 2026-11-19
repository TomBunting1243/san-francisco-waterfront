import * as THREE from 'three';

const sceneMetre=.06,measuredHeight=16*.3048;
const metal=['#66594f','#746459','#5e554f','#806d5d','#73675c','#574f48'];
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.67,metalness:.18});

/** Michael Christian's Corpus. Local +X is its higher, Agriculture Building end.
 * Angle in the ground plane sends +X toward (cos(angle), sin(angle)). */
export function addPier14Corpus(root:THREE.Group,centerX:number,surfaceY:number,centerZ:number,angle:number){
  const pos:number[]=[],color:number[]=[],index:number[]=[];
  const palette=new Map<string,THREE.Color>();
  function vertex(p:THREE.Vector3,tint:string){
    let c=palette.get(tint);
    if(!c){c=new THREE.Color(tint);palette.set(tint,c);}
    pos.push(p.x,p.y,p.z);color.push(c.r,c.g,c.b);
    return pos.length/3-1;
  }
  function quad(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3,tint:string){
    const i=vertex(a,tint);vertex(b,tint);vertex(c,tint);vertex(d,tint);index.push(i,i+1,i+2,i,i+2,i+3);
  }
  // Christian welds irregular, cut steel pieces together. Small diamond-shaped
  // voids approximate that openwork. Each selected panel has a genuine hole.
  function plate(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3,seed:number,perforated:boolean){
    const tint=metal[(seed*11+Math.floor(seed/3))%metal.length];
    if(!perforated){quad(a,b,c,d,tint);return;}
    const corners=[a,b,c,d],middle=a.clone().add(b).add(c).add(d).multiplyScalar(.25);
    const outer=corners.map(p=>vertex(p,tint));
    const aperture=corners.map((p,k)=>{
      const near=p.clone().lerp(corners[(k+1)%4],.38+.09*((seed+k)%3));
      return vertex(middle.clone().lerp(near,.34+.06*((seed+k)%4)),tint);
    });
    for(let j=0;j<4;j++){const k=(j+1)%4;index.push(outer[j],outer[k],aperture[k],outer[j],aperture[k],aperture[j]);}
  }
  const count=32;
  function shellPoint(longitude:number,latitude:number,top:boolean,shrink=1){
    const rad=Math.cos(latitude),x=2.02*rad*Math.cos(longitude)*shrink;
    const z=.91*rad*Math.sin(longitude)*shrink*(1+.045*Math.cos(longitude));
    const seam=3.94+x*.105+.025*Math.sin(2*longitude)*rad;
    return V(x,seam+Math.sin(latitude)*(top?.85:.80)+(top?.047:-.047),z);
  }
  for(const top of [false,true]){
    const rings=7;
    for(let j=0;j<rings;j++)for(let i=0;i<count;i++){
      const a=i*2*Math.PI/count,b=(i+1)*2*Math.PI/count;
      const lo=(top?j:j-rings)*Math.PI/(2*rings),hi=lo+Math.PI/(2*rings);
      const A=shellPoint(a,lo,top),B=shellPoint(a,hi,top),C=shellPoint(b,hi,top),D=shellPoint(b,lo,top);
      if(j===rings-1&&top||j===0&&!top){
        const p=top?[A,B,D]:[A,B,C],k=vertex(p[0],metal[i%metal.length]);
        vertex(p[1],metal[i%metal.length]);vertex(p[2],metal[i%metal.length]);index.push(k,k+1,k+2);
      }else{
        const seed=j*count+i+(top?29:3);plate(A,B,C,D,seed,seed%5===1||seed%9===2);
      }
    }
    // Dark turned-under lips give the long horizontal mouth a visible thickness.
    for(let i=0;i<count;i++){
      const a=i*2*Math.PI/count,b=(i+1)*2*Math.PI/count;
      const A=shellPoint(a,0,top),B=shellPoint(b,0,top),C=shellPoint(b,0,top,.89),D=shellPoint(a,0,top,.89);
      if(top)quad(A,B,C,D,'#403b38');else quad(D,C,B,A,'#453e37');
    }
  }
  // Round, outward-facing bosses/rivets on the upper sides of the shell.
  for(const longitude of [.47,1.60,2.62,3.73,4.84,5.89]){
    const lat=.82,p=shellPoint(longitude,lat,true);
    const n=V(Math.cos(longitude)*Math.cos(lat)/2.02,Math.sin(lat)/.85,Math.sin(longitude)*Math.cos(lat)/.91).normalize();
    const d=V(0,1,0).cross(n).normalize(),e=n.clone().cross(d);
    function rim(r:number,lift:number,a:number){return p.clone().addScaledVector(n,lift).addScaledVector(d,Math.cos(a)*r).addScaledVector(e,Math.sin(a)*r);}
    for(let j=0;j<10;j++){
      const a=j*Math.PI/5,b=(j+1)*Math.PI/5;
      quad(rim(.131,-.017,a),rim(.131,-.017,b),rim(.108,.053,b),rim(.108,.053,a),'#76695a');
      quad(rim(.108,.053,a),rim(.108,.053,b),rim(.076,.082,b),rim(.076,.082,a),'#362f2a');
      const i=vertex(rim(.076,.082,a),'#817a68');vertex(rim(.076,.082,b),'#817a68');vertex(p.clone().addScaledVector(n,.116),'#9e9480');index.push(i,i+1,i+2);
    }
  }
  // The long legs branch at shin height into tapering, independently grounded
  // feet. Slightly staggered joints preserve the openings seen end-on and broadside.
  function limb(start:THREE.Vector3,end:THREE.Vector3,r0:number,r1:number,rows:number,seed:number,grounded=false){
    const axis=end.clone().sub(start).normalize(),d=V(0,0,1).cross(axis).normalize(),e=axis.clone().cross(d);
    function sample(row:number,col:number){
      const t=row/rows,rad=THREE.MathUtils.lerp(r0,r1,t),a=col*Math.PI/3+.14*Math.sin(t*2+seed);
      const v=start.clone().lerp(end,t).addScaledVector(d,rad*Math.cos(a)).addScaledVector(e,rad*Math.sin(a));
      if(grounded&&row===rows)v.y=0;
      return v;
    }
    for(let row=0;row<rows;row++)for(let col=0;col<6;col++){
      const s=seed+row*13+col*7;
      plate(sample(row,col),sample(row,col+1),sample(row+1,col+1),sample(row+1,col),s,s%4===1);
    }
  }
  for(const [i,[x,z,dx,dz]] of [[-1.41,-.38,-.41,-.15],[-.46,-.51,-.16,-.18],[.49,-.49,.03,-.25],[1.38,-.34,.25,-.20],
      [-1.14,.38,-.36,.23],[.01,.54,.05,.20],[1.12,.40,.31,.27]].entries()){
    const from=V(x,3.47+.105*x,z),knee=V(x+dx,1.19+.13*(i%3),z+dz);
    limb(from,knee,.169,.105,6,23+i*49);
    const side=Math.sign(z);
    const footA=V(knee.x+dx*.85-.24+Math.sign(x)*.29,0,knee.z+side*(.96+.12*(i%2)));
    const footB=V(knee.x+dx*.45+.36+Math.sign(x)*.19,0,knee.z-side*(.64+.09*(i%3)));
    limb(knee,footA,.107,.053,4,73+i*57,true);
    limb(knee,footB,.090,.042,4,83+i*47,true);
  }
  const geometry=new THREE.BufferGeometry();
  let tallest=0;
  for(let i=1;i<pos.length;i+=3)tallest=Math.max(tallest,pos[i]);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(color,3));geometry.setIndex(index);
  geometry.scale(sceneMetre,sceneMetre*measuredHeight/tallest,sceneMetre);
  geometry.rotateY(-angle);geometry.translate(centerX,surfaceY,centerZ);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Corpus — Pier 14 public art';root.add(mesh);
  return mesh;
}
