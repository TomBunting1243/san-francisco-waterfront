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
// The night photograph shows a bright grazing highlight on the near limb and
// separate warm pools in the grass. Fixture positions and throw are inferred.
// https://intentionallylost.com/photo-collections/cupids-span-at-night/
const [artX,artZ]=rinconPoint(458,190),artY=knollHeight(artX,artZ),azimuth=-.295;
function fromSculpture(x:number,y:number,z:number){
  return new THREE.Vector3(artX+x*Math.cos(azimuth)+z*Math.sin(azimuth),artY+y,
    artZ-x*Math.sin(azimuth)+z*Math.cos(azimuth));
}
function uplighter(x:number,z:number,target:Vertex,strength:number,radius:number){
  const origin=fromSculpture(x,0,z);origin.y=knollHeight(origin.x,origin.z)+.002;
  return {origin,aim:fromSculpture(...target).sub(origin).normalize(),strength,radius};
}
const parkLights=[
  uplighter(-.41,-.29,[-.49,.195,-.06],2.45,.19),
  uplighter(-.94,-.17,[-.91,.27,-.05],2.30,.22),
  uplighter(-.09,-.41,[-.11,1.03,.03],.62,.19),
];
function grassLight(x:number,z:number){
  let light=0;
  for(const {origin,radius} of parkLights){
    const d=((x-origin.x)/radius)**2+((z-origin.z)/(radius*.78))**2;
    if(d<1)light+=.85*(1-d)**2;
  }
  return light;
}
const incident=new THREE.Vector3();
function sculptureLight(point:THREE.Vector3,normal:THREE.Vector3){
  let light=0;
  for(const {origin,aim,strength} of parkLights){
    incident.subVectors(point,origin);
    const d=incident.length();if(d<.001)continue;
    incident.multiplyScalar(1/d);
    const beam=THREE.MathUtils.smoothstep(incident.dot(aim),.68,.985);
    const incidence=Math.max(0,-incident.dot(normal));
    light+=strength*beam*(.08+.92*incidence)/(1+.78*d*d);
  }
  return light;
}
export function rinconKnoll(){
  const positions:number[]=[],colors:number[]=[],night:number[]=[],indices:number[]=[];
  const turfTone=new THREE.Color('#829b61'),crestTone=new THREE.Color('#b9a877');
  for(const tri of turf){
    const pigments=tri.map(([x,,z])=>{
      const u=(x+42)*48-456,v=(z+5)*48-187-u*.22;
      const wear=1-THREE.MathUtils.smoothstep(Math.hypot(u/115,v/25),.48,1.1);
      return turfTone.clone().lerp(crestTone,wear);
    });
    const points=tri.map(([x,y,z])=>new THREE.Vector3(x,y,z));
    const local:number[]=[];
    function addVertex(point:THREE.Vector3,color:THREE.Color){
      const id=positions.length/3,light=grassLight(point.x,point.z);
      positions.push(point.x,point.y,point.z);colors.push(color.r,color.g,color.b);
      night.push(Math.round(255*color.r*light),Math.round(211*color.g*light),Math.round(133*color.b*light));
      return id;
    }
    for(let i=0;i<3;i++)local.push(addVertex(points[i],pigments[i]));
    // Split only where the original surveyed triangle meets a light's footprint.
    // The new vertices stay on that plane and interpolate its original day colors.
    function split(a:number,b:number,c:number){
      const pa=points[a],pb=points[b],pc=points[c];
      const xmin=Math.min(pa.x,pb.x,pc.x),xmax=Math.max(pa.x,pb.x,pc.x);
      const zmin=Math.min(pa.z,pb.z,pc.z),zmax=Math.max(pa.z,pb.z,pc.z);
      const near=parkLights.some(({origin,radius})=>origin.x+radius>xmin&&origin.x-radius<xmax&&origin.z+radius>zmin&&origin.z-radius<zmax);
      const ab=pa.distanceToSquared(pb),bc=pb.distanceToSquared(pc),ca=pc.distanceToSquared(pa);
      if(!near||Math.max(ab,bc,ca)<.084**2){indices.push(local[a],local[b],local[c]);return;}
      if(bc>=ab&&bc>=ca)[a,b,c]=[b,c,a];else if(ca>=ab)[a,b,c]=[c,a,b];
      const mid=points.length;
      points.push(points[a].clone().lerp(points[b],.5));pigments.push(pigments[a].clone().lerp(pigments[b],.5));
      local.push(addVertex(points[mid],pigments[mid]));
      split(a,mid,c);split(mid,b,c);
    }
    split(0,1,2);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.userData.paintVertices=true;
  geo.setAttribute('signLight',new THREE.Uint8BufferAttribute(night,3,true));
  geo.computeVertexNormals();return geo;
}

// Grass bunches visible at ground level in the night study. Place the roots
// on the surveyed crest and leave clear soil around the recessed optics.
export function rinconGrass(){
  const pos:number[]=[],rgb:number[]=[],night:number[]=[],index:number[]=[];
  let seed=3521;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const olive=new THREE.Color('#687744'),straw=new THREE.Color('#aa985d'),blade=new THREE.Color();
  for(let tuft=0;tuft<490;tuft++){
    const x=artX+(random()-.5)*3.7,z=artZ+(random()-.47)*1.46;
    const h=knollHeight(x,z);
    if(h<knollBase+.06||parkLights.some(lamp=>Math.hypot(x-lamp.origin.x,z-lamp.origin.z)<.032))continue;
    // Thin the planting across the worn crest around the sculpture penetrations.
    const trail=Math.abs((z-artZ)-(x-artX)*.27);
    if(trail<.17&&random()<.75)continue;
    const size=.014+.022*random(),hue=random(),light=grassLight(x,z);
    for(let leaf=0;leaf<5;leaf++){
      const angle=2*Math.PI*(leaf+random()*.6)/5,dx=Math.cos(angle),dz=Math.sin(angle);
      const rise=size*(.5+.60*random()),spread=rise*(.58+random()*.96),width=.0017+.0012*random();
      const bx=x+dx*.002,bz=z+dz*.002,k=pos.length/3;
      const mx=bx+dx*spread*.38,mz=bz+dz*spread*.38;
      // A folded grass blade bends outward above its sheath.
      pos.push(bx-dz*width,h-.001,bz+dx*width,bx+dz*width,h-.001,bz-dx*width,
        mx-dz*width*.57,h+rise*.76,mz+dx*width*.57,mx+dx*.0014,h+rise*.80,mz+dz*.0014,
        mx+dz*width*.57,h+rise*.76,mz-dx*width*.57,bx+dx*spread,h+rise,bz+dz*spread);
      blade.copy(olive).lerp(straw,.60*hue+.22*random());
      for(const value of [.62,.65,.91,1.04,.83,1.14]){
        rgb.push(blade.r*value,blade.g*value,blade.b*value);
        night.push(Math.round(255*blade.r*light*value),Math.round(214*blade.g*light*value),Math.round(136*blade.b*light*value));
      }
      index.push(k,k+2,k+3,k,k+3,k+1,k+1,k+3,k+4,k+2,k+5,k+3,k+3,k+5,k+4);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));g.userData.paintVertices=true;
  g.setAttribute('signLight',new THREE.Uint8BufferAttribute(night,3,true));g.setIndex(index);g.computeVertexNormals();return g;
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
  function rod(name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,color:string,segments=1){
    const d=b.clone().sub(a),m=solid(name,new THREE.CylinderGeometry(r,r,d.length(),14,segments),color);
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
    const cast=solid(name,g,'#d6a04d');cast.userData.uplight=sculptureLight;cast.userData.uplightTint=[1.15,.82];
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
  const shaft=rod('Continuous stainless steel shaft',base,tip,.027,'#a7b2b2',10);
  shaft.userData.uplight=sculptureLight;
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
    const feather=solid('Ribbed red fletching',geometry,'#ffffff');feather.material.vertexColors=true;feather.userData.uplight=sculptureLight;
  }
  sculpture.position.set(artX,artY,artZ);sculpture.rotation.y=azimuth;
  return sculpture;
}

export function rinconUplights(){
  const fixtures=new THREE.Group();fixtures.name='Rincon lawn uplights';
  const bezel=new THREE.CylinderGeometry(.010,.011,.002,10),metal=new THREE.MeshStandardMaterial({color:'#5b5b4e'});
  const optic=new THREE.SphereGeometry(.0076,10,4,0,2*Math.PI,0,Math.PI/2).scale(1,.35,1);
  const glass=new THREE.MeshStandardMaterial({color:'#b5b2a0'}),up=new THREE.Vector3(0,1,0);
  for(const {origin,aim} of parkLights){
    const axis=aim.clone().lerp(up,.55).normalize();
    const housing=new THREE.Mesh(bezel,metal);housing.name='Lawn uplight bezel';housing.position.copy(origin);
    housing.quaternion.setFromUnitVectors(up,axis);
    const lens=new THREE.Mesh(optic,glass);lens.name='Lawn uplight lens';lens.position.copy(origin).addScaledVector(axis,.0011);
    lens.quaternion.copy(housing.quaternion);lens.userData.signLight=[.96,.82,.54];
    fixtures.add(housing,lens);
  }
  return fixtures;
}
