import * as THREE from 'three';

// The 2022 NAIP ortho was rectified into the waterfront's rotated .06 unit/m grid.
// Pixel space on the 48 px/unit plate makes the traced planting edges repeatable.
export function rinconPoint(u:number,v:number):[number,number]{return [-42+u/48,-5+v/48];}
const outline=[[325,221],[337,205],[367,181],[400,168],[432,163],[464,165],[506,176],[549,193],
  [588,214],[626,241],[604,236],[579,235],[560,237],[550,244],[534,241],[522,247],[502,251],
  [486,249],[475,254],[459,261],[438,264],[415,260],[405,255],[384,252],[363,253],[348,246],[334,235]];
export const knollOutline=outline.map(([u,v])=>rinconPoint(u,v));
export const knollCenter=rinconPoint(457,190);
export const knollBase=.110;
// 2023 USGS San Francisco 3DEP bare-earth returns, metres. Three sampled
// contours across the traced lawn capture the long, off-center waterfront ridge.
const metres=[
  [4.7,4.7,4.9,4.9,5,5.1,5,4.8,4.6,4.3,4.4,4.6,4.6,4.6,4.6,4.7,4.5,4.6,4.6,4.5,4.4,4.5,4.5,4.5,4.5,4.5,4.6],
  [4.1,4.3,4.4,4.7,4.9,4.9,4.7,4.4,4,3.3,3.5,3.7,3.8,3.6,3.7,3.6,3.7,3.8,3.7,3.6,3.7,3.7,3.8,3.8,3.8,3.9,4.1],
  [3.7,3.9,4.2,4.5,4.7,4.8,4.5,4,3.4,3,3.1,3.2,2.9,2.9,3.2,3.2,3.2,3.1,3.1,3.2,3.2,3.2,3.2,3.3,3.3,3.3,3.6],
];
type Vertex=[number,number,number];
const grade=(m:number)=>knollBase+(m-2.9)*.06;
const summit:Vertex=[knollCenter[0],grade(5.1),knollCenter[1]];
const contours=[.33,.66,.955].map((r,k)=>knollOutline.map(([x,z],i):Vertex=>[
  knollCenter[0]+(x-knollCenter[0])*r,grade(metres[k][i]),knollCenter[1]+(z-knollCenter[1])*r,
]));
// The survey's outer samples lie inside the grass shoulder. OLIN's mounded
// landform eases back down into the surrounding promenade at the traced edge.
contours.push(knollOutline.map(([x,z]):Vertex=>[x,.108,z]));
const turf:Vertex[][]=[];
for(let i=0;i<knollOutline.length;i++){
  const j=(i+1)%knollOutline.length;
  turf.push([summit,contours[0][j],contours[0][i]]);
  for(let k=1;k<contours.length;k++){
    const a=contours[k-1][i],b=contours[k-1][j],c=contours[k][i],d=contours[k][j];
    turf.push([a,b,c],[b,d,c]);
  }
}
export function knollHeight(x:number,z:number){
  for(const [a,b,c] of turf){
    const ux=b[0]-a[0],uz=b[2]-a[2],vx=c[0]-a[0],vz=c[2]-a[2],det=ux*vz-uz*vx;
    const u=((x-a[0])*vz-(z-a[2])*vx)/det,v=(ux*(z-a[2])-uz*(x-a[0]))/det;
    if(u>=-1e-7&&v>=-1e-7&&u+v<=1.0000001)return a[1]+(b[1]-a[1])*u+(c[1]-a[1])*v;
  }
  return knollBase;
}
export function rinconKnoll(){
  const positions:number[]=[],colors:number[]=[];
  const turfTone=new THREE.Color('#829b61'),crestTone=new THREE.Color('#b9a877'),color=new THREE.Color();
  for(const tri of turf){
    for(const [x,y,z] of tri){
      // Pale worn grass along the crest in the 2024 8 cm ortho, concentrated
      // around the three sculpture penetrations. The bayside toe stays green.
      const u=(x+42)*48-456,v=(z+5)*48-187-u*.22;
      const wear=1-THREE.MathUtils.smoothstep(Math.hypot(u/115,v/25),.48,1.1);
      positions.push(x,y,z);color.copy(turfTone).lerp(crestTone,wear);colors.push(color.r,color.g,color.b);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.userData.paintVertices=true;
  geo.computeVertexNormals();return geo;
}

// Kreysler's installed views show the lower arc doubling back on itself, a
// broad recurved upper limb, two taut cables and deeply ribbed red feathers.
// https://www.kreysler.com/projects/all/sculpture/cupid-span
// https://fisher.access.sfmoma.org/301/
// The 2024 SF ortho locates the three separate ground penetrations. Heights
// of the lower limb (3–5 m), higher tip (~15 m), and fletching (~19–20 m)
// match the 2023 DSM. Overall envelope 64 ft x 143 ft 9 in x 17 ft.
export function cupidsSpan(){
  const sculpture=new THREE.Group();sculpture.name="Cupid's Span";
  const palette=new Map<string,THREE.MeshStandardMaterial>();
  const v=(x:number,y:number,z=0)=>new THREE.Vector3(x,y,z);
  function solid(name:string,g:THREE.BufferGeometry,color:string){
    let m=palette.get(color);
    if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.60});palette.set(color,m);}
    const mesh=new THREE.Mesh(g,m);mesh.name=name;sculpture.add(mesh);return mesh;
  }
  function rod(name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,color:string){
    const d=b.clone().sub(a),m=solid(name,new THREE.CylinderGeometry(r,r,d.length(),14),color);
    m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(v(0,1),d.normalize());return m;
  }
  function limb(name:string,stations:THREE.Vector3[],height:number,depth:number){
    const curve=new THREE.CatmullRomCurve3(stations),points:number[]=[],indices:number[]=[];
    // Bevels yield the broad warm top and shaded undercut seen on the cast ends.
    const profile=[[-.79,-1],[.73,-1],[1,-.56],[1,.58],[.72,1],[-.79,1],[-1,.56],[-1,-.52]];
    for(let i=0;i<=36;i++){
      const t=i/36,center=curve.getPoint(t),tangent=curve.getTangent(t);
      const normal=v(-tangent.y,tangent.x).normalize();
      const h=height*(.95+.12*Math.sin(Math.PI*t)-.40*t),d=depth*(1-.41*t);
      for(const [u,w] of profile)points.push(center.x+normal.x*u*h,center.y+normal.y*u*h,center.z+w*d);
      if(i)for(let j=0;j<8;j++){
        const a=(i-1)*8+j,b=(i-1)*8+(j+1)%8;indices.push(a,b,a+8,b,b+8,a+8);
      }
    }
    for(let j=1;j<7;j++)indices.push(288,288+j,288+j+1);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();
    solid(name,g,'#d6a04d');
    return curve;
  }
  const low=limb('Low returning bow limb',[v(-.085,-.10,-.060),v(-.32,.12,-.063),v(-.72,.255,-.055),
    v(-1.01,.273,-.05),v(-1.19,.23,-.053),v(-1.295,.183,-.055)],.068,.078);
  const high=limb('High swept bow limb',[v(.27,-.095,-.06),v(.48,.055,-.066),v(.71,.35,-.075),
    v(.89,.655,-.076),v(1.05,.807,-.071),v(1.22,.867,-.065),v(1.322,.868,-.061)],.086,.078);
  // The center of the drawn bow turns below ground. Join its two roots
  // under the surveyed lawn, leaving the separate entry points visible.
  const grip=new THREE.CatmullRomCurve3([low.getPoint(0),v(.01,-.163,-.079),v(.14,-.170,-.076),high.getPoint(0)]);
  solid('Buried bow grip',new THREE.TubeGeometry(grip,12,.046,8,false),'#d6a04d');
  const base=v(.34,-.105,-.116),tip=v(-.14,1.132,.060);
  const axis=tip.clone().sub(base).normalize(),nock=base.clone().lerp(tip,.908);
  rod('Continuous stainless steel shaft',base,tip,.027,'#a7b2b2');
  rod('Low tension cable',low.getPoint(.985),nock,.0066,'#494e4b');
  rod('High tension cable',high.getPoint(.985),nock,.0066,'#494e4b');
  // Fan the three molded vanes around the *same* inclined shaft as the nock.
  // Their serrated lobes and alternating ridges follow the fabricator's photograph.
  const start=base.clone().lerp(tip,.49),run=start.distanceTo(tip),normal=v(0,0,1).addScaledVector(axis,-axis.z).normalize();
  for(let i=0;i<3;i++){
    const radial=normal.clone().applyAxisAngle(axis,(i*2*Math.PI/3)+.27);
    const tangent=axis.clone().cross(radial);
    const pts:number[]=[],cols:number[]=[],idx:number[]=[];
    const light=new THREE.Color('#c35447'),dark=new THREE.Color('#a23b35');
    for(let j=0;j<=48;j++){
      const f=j/48,band=j%4;
      const width=.154*Math.min(1,.055+f*4.7)*(band===0?.86:1)*(1-.17*f);
      const height=f*(run-.047);
      for(const [r,puff] of [[.013,0],[width*.55,.014],[width,0]]){
        const p=start.clone().addScaledVector(axis,height+(r/Math.max(width,.016))*.050*f)
          .addScaledVector(radial,r).addScaledVector(tangent,puff*(band===0?.25:1));
        pts.push(p.x,p.y,p.z);
        const pigment=band===0?dark:light;cols.push(pigment.r,pigment.g,pigment.b);
      }
      if(j)for(let k=0;k<2;k++){const a=(j-1)*3+k;idx.push(a,a+3,a+1,a+1,a+3,a+4);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([...pts,...pts],3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute([...cols,...cols],3));
    // The static-city bake uses front faces; both sides of each fin must survive it.
    const twoSides=[...idx];
    const offset=pts.length/3;
    for(let j=0;j<idx.length;j+=3)twoSides.push(offset+idx[j],offset+idx[j+2],offset+idx[j+1]);
    geometry.setIndex(twoSides);geometry.computeVertexNormals();geometry.userData.paintVertices=true;
    const feather=solid('Ribbed red fletching',geometry,'#ffffff');feather.material.vertexColors=true;
  }
  const [x,z]=rinconPoint(458,190);
  sculpture.position.set(x,knollHeight(x,z),z);sculpture.rotation.y=-.295;
  return sculpture;
}
