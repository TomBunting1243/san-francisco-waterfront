import * as THREE from 'three';

// The 2022 NAIP ortho was rectified into the waterfront's rotated .06 unit/m grid.
// Pixel space on the 48 px/unit plate makes the traced planting edges repeatable.
export function rinconPoint(u:number,v:number):[number,number]{return [-42+u/48,-5+v/48];}
const outline=[[325,221],[337,205],[367,181],[400,168],[432,163],[464,165],[506,176],[549,193],
  [588,214],[626,241],[604,236],[579,235],[560,237],[550,244],[534,241],[522,247],[502,251],
  [486,249],[475,254],[459,261],[438,264],[415,260],[405,255],[384,252],[363,253],[348,246],[334,235]];
export const knollOutline=outline.map(([u,v])=>rinconPoint(u,v));
export const knollCenter=rinconPoint(452,196);
export const knollBase=.148;
// A fan of planar turf facets ensures visitors, walls and the buried bow all meet the same surface.
function radialFraction(x:number,z:number){
  const dx=x-knollCenter[0],dz=z-knollCenter[1];
  for(let i=0;i<knollOutline.length;i++){
    const a=knollOutline[i],b=knollOutline[(i+1)%knollOutline.length];
    const ax=a[0]-knollCenter[0],az=a[1]-knollCenter[1],bx=b[0]-knollCenter[0],bz=b[1]-knollCenter[1];
    const det=ax*bz-az*bx,u=(dx*bz-dz*bx)/det,v=(ax*dz-az*dx)/det;
    if(u>=-1e-8&&v>=-1e-8&&u+v<=1.000001)return Math.min(1,u+v);
  }
  return 1;
}
export const knollHeight=(x:number,z:number)=>knollBase+.11*(1-radialFraction(x,z));
export function rinconKnoll(){
  const p:number[]=[];
  for(let i=0;i<knollOutline.length;i++){
    const [ax,az]=knollOutline[i],[bx,bz]=knollOutline[(i+1)%knollOutline.length];
    p.push(knollCenter[0],knollBase+.11,knollCenter[1],bx,knollBase,bz,ax,knollBase,az);
    p.push(ax,knollBase,az,bx,knollBase,bz,ax,.108,az,ax,.108,az,bx,knollBase,bz,bx,.108,bz);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.computeVertexNormals();return geo;
}

// OLIN's waterfront-facing photographs show two exposed recurved limbs, a silver
// shaft, three red vanes and a black string from each limb tip to the nock.
export function cupidsSpan(){
  const sculpture=new THREE.Group();sculpture.name="Cupid's Span";
  function solid(g:THREE.BufferGeometry,c:string){
    const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:c,roughness:.78}));sculpture.add(mesh);return mesh;
  }
  const v=(x:number,y:number,z=0)=>new THREE.Vector3(x,y,z);
  function rod(a:THREE.Vector3,b:THREE.Vector3,r:number,color:string){
    const d=b.clone().sub(a),m=solid(new THREE.CylinderGeometry(r,r,d.length(),10),color);
    m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(v(0,1),d.normalize());
  }
  // Flat, broad bow stave with a changing section and a darker belly.
  function limb(points:THREE.Vector3[],wide:number){
    const curve=new THREE.CatmullRomCurve3(points),verts:number[]=[],indices:number[]=[];
    for(let i=0;i<=28;i++){
      const t=i/28,c=curve.getPoint(t),d=curve.getTangent(t),normal=v(-d.y,d.x).normalize();
      const w=wide*(1-.75*t),depth=.059*(1-.48*t);
      for(const [s,z] of [[-1,-1],[1,-1],[1,1],[-1,1]])verts.push(c.x+normal.x*w*s,c.y+normal.y*w*s,c.z+z*depth);
      if(i)for(let j=0;j<4;j++){const a=4*(i-1)+j,b=4*(i-1)+(j+1)%4;indices.push(a,b,a+4,b,b+4,a+4);}
    }
    indices.push(112,113,114,112,114,115);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();
    solid(geo,'#e7a13a').material.side=THREE.DoubleSide;
  }
  const low=v(-1.304,.27),high=v(1.304,1.15),nock=v(-.11,1.06,.025);
  limb([v(-.71,-.12),v(-.92,.17),v(-1.12,.32),low],.073);
  limb([v(.15,-.12),v(.47,.20),v(.76,.71),v(.99,.99),high],.083);
  rod(low,nock,.006,'#4c4a42');rod(high,nock,.006,'#4c4a42');
  const base=v(-.02,-.10,.025),shaft=v(-.12,1.16,.025);
  rod(base,shaft,.021,'#9ba4a4');
  for(let i=0;i<3;i++){
    const vane=new THREE.Shape();
    vane.moveTo(0,0);vane.quadraticCurveTo(.12,.035,.177,.12);vane.lineTo(.177,.42);
    vane.lineTo(.137,.405);vane.lineTo(.155,.43);vane.lineTo(0,.365);vane.closePath();
    const feather=solid(new THREE.ExtrudeGeometry(vane,{depth:.009,bevelEnabled:false}),'#c84d3f');
    feather.position.set(-.087,.72,.025);feather.rotation.y=i*2*Math.PI/3;
  }
  const [x,z]=rinconPoint(464,194);
  sculpture.position.set(x,knollHeight(x,z),z);sculpture.rotation.y=-.285;
  return sculpture;
}
