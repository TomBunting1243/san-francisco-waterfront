import * as THREE from 'three';

type Plan=[number,number];
type Vertex=[number,number,number];
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
type Building={id:number;p:number[][]};
const scale=.06,grade=.045;
const ux=-.158/Math.hypot(.158,.987),uz=-.987/Math.hypot(.158,.987);
const vx=uz,vz=-ux;
function local([x,z]:number[]):Plan{return [(x+20.224)*ux+(z+7.707)*uz,(x+20.224)*vx+(z+7.707)*vz];}
function world(u:number,v:number):Plan {return [-20.224+u*ux+v*vx,-7.707+u*uz+v*vz];}
const stone='#c8c7ba',light='#d9d7c8',reveal='#a2a198',trim='#969d97',dark='#46565b';
const glazing=['#677d83','#829494','#53696f','#75857f','#8e9990'];
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.74});

// OCII resolution 39-2020 A100.1, the 2024 SF orthophoto and the owner's
// Courtyard at Rincon Center brochure (cover). U runs from Steuart to Spear;
// V runs from the courtyard through the office atrium towards Howard.
// https://sfocii.org/sites/default/files/inline-files/2020039.pdf
// https://d18f92g93i3ums.cloudfront.net/property/custom_retail_brochure/1714671203442.pdf
export function addRinconCenter(building:Building,root:THREE.Group,windows:Window[]):boolean{
  if(building.id!==944891685)return false;
  const ring=building.p.map(local);
  if(ring[0][0]===ring.at(-1)![0]&&ring[0][1]===ring.at(-1)![1])ring.pop();
  const positions:number[]=[],colors:number[]=[],indices:number[]=[],palette=new Map<string,THREE.Color>();
  function face(points:Vertex[],tone:string,normal:Vertex){
    let ink=palette.get(tone);if(!ink){ink=new THREE.Color(tone);palette.set(tone,ink);}
    const [a,b,c]=points;
    const ab=b.map((p,i)=>p-a[i]),ac=c.map((p,i)=>p-a[i]);
    // The U,V projection reflects the local frame into the map, reversing winding.
    const reverse=(ab[1]*ac[2]-ab[2]*ac[1])*normal[0]+(ab[2]*ac[0]-ab[0]*ac[2])*normal[1]+(ab[0]*ac[1]-ab[1]*ac[0])*normal[2]>0;
    const first=positions.length/3;
    for(const [u,y,v] of points){const [x,z]=world(u,v);positions.push(x,grade+y,z);colors.push(ink.r,ink.g,ink.b);}
    for(let k=1;k+1<points.length;k++)indices.push(first,first+(reverse?k+1:k),first+(reverse?k:k+1));
  }
  function lid(p:Plan[],height:number,color:string){
    const triangles=THREE.ShapeUtils.triangulateShape(p.map(([u,v])=>new THREE.Vector2(u,v)),[]);
    for(const t of triangles)face(t.map(i=>[p[i][0],height,p[i][1]]),color,[0,1,0]);
  }
  function prism(p:Plan[],low:number,high:number,color:string,roof=color){
    lid(p,high,roof);
    const area=p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0);
    for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],sign=Math.sign(area);
      face([[a[0],low,a[1]],[b[0],low,b[1]],[b[0],high,b[1]],[a[0],high,a[1]]],color,[sign*(b[1]-a[1]),0,sign*(a[0]-b[0])]);
    }
  }
  function box(u:number,v:number,w:number,d:number,lo:number,hi:number,color:string,roof=color){
    prism([[u-w/2,v-d/2],[u+w/2,v-d/2],[u+w/2,v+d/2],[u-w/2,v+d/2]],lo,hi,color,roof);
  }
  // Clip the survey footprint to form the upper setback on each street. In
  // particular this leaves the courtyard and the separately mapped towers open.
  function clip(p:Plan[],limit:number,sign:number):Plan[]{
    const result:Plan[]=[];
    p.forEach((a,i)=>{const b=p[(i+1)%p.length],inA=(a[0]-limit)*sign>=0,inB=(b[0]-limit)*sign>=0;
      if(inA)result.push(a);
      if(inA!==inB)result.push([limit,a[1]+(b[1]-a[1])*(limit-a[0])/(b[0]-a[0])]);
    });
    return result;
  }
  const ledge=17.1*scale,roof=24.6*scale,parapet=25.4*scale;
  const upper=clip(clip(ring,.19,1),4.70,-1);
  lid(ring,ledge,'#b9b8ad');lid(upper,roof,'#c2c0b1');
  function elevation(p:Plan[],low:number,high:number,upperTier:boolean){
    const ccw=Math.sign(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0));
    for(let i=0;i<p.length;i++){
      const a=p[i],b=p[(i+1)%p.length],du=b[0]-a[0],dv=b[1]-a[1],length=Math.hypot(du,dv);
      if(length<.00005)continue;
      const nu=ccw*dv/length,nv=-ccw*du/length;
      const point=(s:number,y:number,d:number):Vertex=>[a[0]+du*s/length+nu*d,y,a[1]+dv*s/length+nv*d];
      const panel=(s:number,t:number,lo:number,hi:number,d:number,ink:string)=>face([point(s,lo,d),point(t,lo,d),point(t,hi,d),point(s,hi,d)],ink,[nu,0,nv]);
      const sill=(y:number,d1:number,d2:number,ink:string)=>face([point(0,y,d1),point(length,y,d1),point(length,y,d2),point(0,y,d2)],ink,[0,1,0]);
      const midU=(a[0]+b[0])/2,midV=(a[1]+b[1])/2;
      // The two diagonal back edges abut the separately modeled housing wings.
      const publicFace=midV<.12||midU<.22||midU>4.65||midV>3.63||
        (midV<2.24&&(midU>1.18&&midU<3.75)&&(nu*(2.47-midU)>0||nv<-.3));
      if(!publicFace){panel(0,length,low,high,0,stone);continue;}
      // The facade below is a continuous recessed curtain, with projecting
      // ivory spandrels; every exposed sill has a horizontal return.
      panel(0,length,low,high,-.009,dark);
      const levels=[0,4.9,9.10,13.10,17.10,21.05,24.6];
      for(let f=0;f<levels.length-1;f++){
        const y=levels[f]*scale,floorTop=levels[f+1]*scale;
        if(y<low-.0001||y>=high-.001)continue;
        const base=y+(y===0?.016:.028),head=floorTop-(y===0?.056:.095);
        panel(0,length,y,base,.002,stone);panel(0,length,head,floorTop,.003,stone);
        sill(base,.004,-.011,light);panel(0,length,floorTop-.018,floorTop-.014,.005,reveal);
        const n=Math.max(1,Math.round(length/.116));
        for(let j=0;j<n;j++){
          const step=length/n,start=j*step,end=(j+1)*step;
          panel(start+.004,end-.004,base+.003,head-.002,-.006,glazing[(j+i+Math.round(y*8))%glazing.length]);
          panel(start,start+.003,base,head,.001,trim);
          if(y===0&&j%4===2)panel(start+.008,end-.007,base+.085,base+.089,-.004,trim);
          if(j%2===0&&length>.24){
            const [u,cy,v]=point((start+end)/2,(base+head)/2,-.004);
            const [x,z]=world(u,v);
            windows.push({x,z,y:grade+cy,ry:Math.atan2(nu*ux+nv*vx,nu*uz+nv*vz),w:step*.72,h:(head-base)*.82});
          }
        }
      }
      if(upperTier){
        panel(0,length,roof,parapet,0,light);sill(parapet,0,-.020,'#d7d7ca');
        panel(0,length,roof,parapet,-.020,reveal);
      }
    }
  }
  elevation(ring,0,ledge,false);elevation(upper,ledge,roof,true);

  // Section through the central hall: LiDAR at 2023 ground +29.3 m along
  // the ridge, +27.7 m on the shoulders and +24.6 m on the flat wing roofs.
  const left=2.05,right=2.93,front=1.848,back=3.68;
  const arch=(t:number)=>roof+4.72*scale*Math.sqrt(Math.max(0,1-(2*t-1)**2));
  for(let i=0;i<20;i++){
    const s=i/20,t=(i+1)/20,a=left+(right-left)*s,b=left+(right-left)*t,h=arch(s),k=arch(t);
    for(const [v,w,ink] of [[front,front+.15,i%3===0?'#9baaaa':'#819496'],[front+.15,back,'#b9b7ab']] as const)
      face([[a,h,v],[b,k,v],[b,k,w],[a,h,w]],ink,[0,1,0]);
    face([[a,roof,back],[b,roof,back],[b,k,back],[a,h,back]],i%4===0?trim:'#959b93',[0,0,1]);
    face([[a,0,front],[b,0,front],[b,k,front],[a,h,front]],glazing[(i*3+2)%5],[0,0,-1]);
    if(i%2===0)face([[a,.015,front-.002],[a+.004,.015,front-.002],[a+.004,h,front-.002],[a,h,front-.002]],trim,[0,0,-1]);
    face([[a,h-.023,front-.004],[b,k-.023,front-.004],[b,k,front-.004],[a,h,front-.004]],light,[0,0,-1]);
  }
  for(let j=1;j<=8;j++)box((left+right)/2,front-.003,right-left,.005,j*.173,j*.173+.004,trim);
  // The owner's plaza photograph shows the mirrored arch landing on broad
  // pale masonry jambs, with a full-height glazed entrance between them.
  for(const u of [2.09,2.31,2.67,2.89])box(u,front-.007,.041,.015,0,.56,stone);
  for(const u of [2.40,2.58])box(u,front-.009,.006,.012,0,.193,trim);
  box(2.49,front-.009,.31,.015,.192,.210,light);
  // Ground-floor retail projects toward the central planting and seating court.
  const lobbyTop=6.3*scale;
  for(const s of [-1,1]){
    const side=(u:number)=>s<0?u:4.96-u;
    const edge:Plan[]=[[1.35,.08],[1.43,.10],[1.45,.38],[1.52,.45],[1.53,.70],[1.60,.77],[1.60,1.02],[1.73,1.19],[1.91,1.36],[1.92,1.82],[1.51,2.04],[1.31,2.04]];
    const p=edge.map(([u,v]):Plan=>[side(u),v]);prism(p,0,lobbyTop,'#b5b5a6','#abae99');
    for(let i=1;i<=8;i++){
      const a=p[i],b=p[i+1],du=b[0]-a[0],dv=b[1]-a[1],len=Math.hypot(du,dv),nu=-s*dv/len,nv=s*du/len;
      for(let j=0,n=Math.max(1,Math.round(len/.087));j<n;j++){
        const l=(j+.055)/n,r=(j+.945)/n;
        const at=(t:number,y:number):Vertex=>[a[0]+t*du+nu*.0015,y,a[1]+t*dv+nv*.0015];
        face([at(l,.023),at(r,.023),at(r,lobbyTop-.062),at(l,lobbyTop-.062)],glazing[(i+j)%5],[nu,0,nv]);
      }
    }
  }
  // The barrel vaults span open passages between the complex and the Annex.
  // Clear panes are indicated by their metal grid and narrow reflected strips.
  for(const [start,end] of [[0,1.40],[3.56,4.92]]){
    const rim=-.395,depth=.457,high=(v:number)=>scale*(13.3+.65*Math.sin(Math.PI*(v-rim)/depth));
    for(let j=0;j<8;j++){
      const a=rim+j*depth/8,b=rim+(j+1)*depth/8;
      face([[start,high(a),a],[end,high(a),a],[end,high(a+.004),a+.004],[start,high(a+.004),a+.004]],trim,[0,1,0]);
      face([[start,high(a+.005),a+.005],[end,high(a+.005),a+.005],[end,high(a+.013),a+.013],[start,high(a+.013),a+.013]],'#a8bab5',[0,1,0]);
      face([[start,high(a)-.005,a],[end,high(a)-.005,a],[end,high(a+.004)-.005,a+.004],[start,high(a+.004)-.005,a+.004]],reveal,[0,-1,0]);
      face([[start,high(a+.005)-.002,a+.005],[end,high(a+.005)-.002,a+.005],[end,high(a+.013)-.002,a+.013],[start,high(a+.013)-.002,a+.013]],'#afc2bb',[0,-1,0]);
      for(let k=0;k<=10;k++){
        const u=start+(end-start)*k/10;
        face([[u,high(a),a],[u+.006,high(a),a],[u+.006,high(b),b],[u,high(b),b]],trim,[0,1,0]);
        face([[u,high(a)-.014,a],[u+.006,high(a)-.014,a],[u+.006,high(b)-.014,b],[u,high(b)-.014,b]],reveal,[0,-1,0]);
        face([[u,high(a)-.014,a],[u,high(b)-.014,b],[u,high(b),b],[u,high(a),a]],reveal,[1,0,0]);
      }
    }
  }
  // Equipment location follows the roof survey. The dense east plant yard
  // contrasts with the short paired units on the calmer Spear wing.
  for(const [u,v,w,d,h] of [[.48,.91,.25,.39,.072],[.76,1.18,.24,.20,.060],[.61,.63,.26,.12,.038],[.99,1.27,.25,.10,.064],[4.07,1.11,.19,.24,.062],[4.29,1.14,.12,.17,.045]]){
    box(u,v,w,d,roof,roof+h,'#a1a49a','#b3b6a9');
    for(let j=0;j<3;j++)box(u-w*.25+j*w*.25,v,.007,d*.8,roof+h,roof+h+.002,trim);
  }
  const geometry=new THREE.BufferGeometry();geometry.setIndex(indices);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.userData.paintVertices=true;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Rincon Center II podium and courtyard galleries';mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
  return true;
}
