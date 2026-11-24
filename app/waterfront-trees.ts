import {setPackedNormals} from './packed-normals.ts';
import * as THREE from 'three';
import {observedCanopy} from './surveyed-canopies.ts';

type PlantMesh=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
type Point=THREE.Vector3;
const vec=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
const tau=Math.PI*2;
const month=Number(new Intl.DateTimeFormat('en-US',{month:'numeric',timeZone:'America/Los_Angeles'}).format(new Date()));
function seed(id:number,n:number){
  const value=Math.sin(id*.173+n*59.313)*43758.5453;
  return value-Math.floor(value);
}
const pigment=(...colors:string[])=>colors.map(c=>new THREE.Color(c));
const bark=pigment('#655b4c','#88775e','#a28d70');
const planeBark=pigment('#8b826c','#b4a98e','#d3c7a8');
const leaf={
  broad:pigment('#435e4e','#647e59','#8c9d6c'),
  plane:pigment('#435f4d','#81945d','#b6bf83'),
  gold:pigment('#706c42','#aa9b54','#ceb66a'),
  ochre:pigment('#685f44','#998751','#baa36c'),
  evergreen:pigment('#3c594d','#56775e','#7c956e'),
  magnolia:pigment('#745e48','#496655','#789076'),
  ash:pigment('#596d5b','#809368','#a8ae7e'),
  palm:pigment('#414f3f','#637657','#86916a'),
  palmSkirt:pigment('#544e38','#786e49','#97855b'),
  fan:pigment('#5e796b','#819b82','#a6b69a'),
  dry:pigment('#776e50','#90825e','#aa9972'),
};

// Original procedural geometry. NC State Extension photographs inspected for habit:
// Frank Vincentz, date palm (CC BY-SA 3.0): https://plants.ces.ncsu.edu/plants/phoenix-canariensis/
// Filo gèn’, Mexican fan palm (CC BY-SA 4.0): https://plants.ces.ncsu.edu/plants/washingtonia-robusta/
// Jim Robbins, plane / magnolia / privet (CC BY-NC-ND 4.0):
// https://plants.ces.ncsu.edu/plants/platanus-x-acerifolia/ ; /magnolia-grandiflora/ ; /ligustrum-lucidum/
// Douglas Goldman, USDA, live oak (CC BY-NC 4.0): https://plants.ces.ncsu.edu/plants/quercus-virginiana/
// Ginkgo tree and fall foliage forms: https://plants.ces.ncsu.edu/plants/ginkgo-biloba/
// The city inventory supplies individual street taxa. The City's historical plaza
// evaluation (photographs 123, 129, 134) and OLIN's built Rincon Park photographs
// document local planting character: https://sfmea.sfplanning.org/Appendix%206%20-%20Cultural%20Resources%20Supporting%20Material.pdf
// https://theolinstudio.com/rincon-park/ . Photographs are not bundled or sampled.
export function treeHabit(species:string){
  if(/Platanus|plane tree|sycamore/i.test(species))return 'plane';
  if(/Ginkgo/i.test(species))return 'ginkgo';
  if(/Ligustrum/i.test(species))return 'privet';
  if(/Magnolia/i.test(species))return 'magnolia';
  if(/Quercus virginiana/i.test(species))return 'live oak';
  if(/Fraxinus/i.test(species))return 'ash';
  if(/Populus|Lombard/i.test(species))return 'poplar';
  return 'broadleaf';
}
type Habit=ReturnType<typeof treeHabit>;
type Form={fork:number;spread:number;reach:number;rise:number;depth:number;branches:number};
const forms:Record<Habit,Form>={
  plane:{fork:.33,spread:.42,reach:.86,rise:.27,depth:.72,branches:7},
  ginkgo:{fork:.34,spread:.26,reach:.76,rise:.43,depth:.67,branches:7},
  privet:{fork:.32,spread:.32,reach:.72,rise:.32,depth:1.0,branches:8},
  magnolia:{fork:.24,spread:.34,reach:.82,rise:.46,depth:.92,branches:8},
  'live oak':{fork:.24,spread:.56,reach:.97,rise:.18,depth:.57,branches:7},
  ash:{fork:.40,spread:.36,reach:.84,rise:.33,depth:.67,branches:6},
  poplar:{fork:.26,spread:.18,reach:.67,rise:.50,depth:1.38,branches:8},
  broadleaf:{fork:.32,spread:.36,reach:.80,rise:.34,depth:.80,branches:6},
};

class Paint {
  xyz:number[]=[];rgb:number[]=[];indices:number[]=[];
  vertex(p:Point,c:THREE.Color){
    const i=this.xyz.length/3;this.xyz.push(p.x,p.y,p.z);this.rgb.push(c.r,c.g,c.b);return i;
  }
  quad(a:number,b:number,c:number,d:number){this.indices.push(a,b,c,a,c,d);}
  finish(mesh:PlantMesh,x:number,y:number,z:number,name:string){
    if(!this.indices.length)return;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.xyz,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.rgb,3));g.setIndex(this.indices);
    setPackedNormals(g);g.userData.paintVertices=true;
    const part=mesh(g,'#ffffff',x,y,z);part.name=name;
    if(name.endsWith('foliage')){part.userData.plantCrown=true;g.userData.plantCrown=true;}
    return part;
  }
  // Connected, tapered rings model trunk mottling and leave every winter twig attached.
  stem(a:Point,b:Point,r:number,tip:number,tones:THREE.Color[],phase:number,rings=2,n=6){
    const axis=b.clone().sub(a).normalize();
    const u=vec(0,0,1).cross(axis).normalize(),v=axis.clone().cross(u);
    const first=this.xyz.length/3;
    for(let j=0;j<rings;j++){
      const t=j/(rings-1),center=a.clone().lerp(b,t),radius=THREE.MathUtils.lerp(r,tip,t);
      for(let k=0;k<n;k++){
        const w=tau*k/n+.16,pt=center.clone().addScaledVector(u,Math.cos(w)*radius).addScaledVector(v,Math.sin(w)*radius);
        this.vertex(pt,tones[Math.min(tones.length-1,Math.floor(seed(phase,k+j*6)*tones.length))]);
        if(j){const lo=first+(j-1)*n+k,next=first+(j-1)*n+(k+1)%n;this.quad(lo,next,next+n,lo+n);}
      }
    }
  }
  // A foliage sweep begins inside a bough fork and follows the wood outward.
  // Its two edges swell and recede at different stations. At the end the middle
  // falls short of the outer fingers, leaving a visible notch in the silhouette.
  bough(start:Point,end:Point,side:Point,width:number,depth:number,tones:THREE.Color[],phase:number){
    const axis=end.clone().sub(start),forward=vec(axis.x,0,axis.z).normalize();
    const widths=[.22,.62,.95,.76,1,.68,.23],n=6,first=this.xyz.length/3;
    const cross=[[-1,.04],[-.56,.84],[.38,.97],[1,.20],[.57,-.56],[-.49,-.65]];
    const hue=new THREE.Color();
    for(let j=0;j<widths.length;j++){
      const t=j/(widths.length-1);
      const center=start.clone().addScaledVector(axis,t).addScaledVector(side,Math.sin(2.7*t+phase)*width*.21);
      center.y+=Math.sin(t*Math.PI)*depth*.35;
      for(let k=0;k<n;k++){
        const [l,v]=cross[k],bank=l<0?-1:1;
        const shape=widths[Math.min(widths.length-1,Math.max(0,j+(bank<0&&j>1&&j<6?1:0)))];
        const offset=l*width*shape*(.80+.32*seed(phase,7*j+k));
        const p=center.clone().addScaledVector(side,offset);
        p.addScaledVector(forward,width*((.18*Math.sin(1.9*j+bank+phase))+.24*Math.abs(l)*t*t));
        p.y+=depth*(v*(.18+.82*shape)+l*.20+.12*Math.sin(phase+j*.8+k*1.7));
        const value=THREE.MathUtils.clamp(.27+.48*v+.17*t+.22*(seed(phase,j*9+k)-.5),0,1)*2;
        hue.copy(tones[Math.floor(value)]).lerp(tones[Math.min(2,Math.ceil(value))],value%1);
        this.vertex(p,hue);
        if(j){const a=first+(j-1)*n+k,b=first+(j-1)*n+(k+1)%n;this.quad(a,b,b+n,a+n);}
      }
    }
    for(let k=1;k<n-1;k++)this.indices.push(first,first+k,first+k+1,
      first+(widths.length-1)*n,first+(widths.length-1)*n+k+1,first+(widths.length-1)*n+k);
  }
  // One irregular, closed leaf mass per bough. Shared vertices and joined caps
  // allow smooth lighting without transparent cards, exposed backs or loose leaves.
  spray(at:Point,rx:number,ry:number,rz:number,angle:number,tones:THREE.Color[],phase:number,compact=false){
    const n=compact?7:9,start=this.xyz.length/3;
    const levels=compact?[-.51,.55]:[-.66,.06,.68];
    const lo=this.vertex(at.clone().add(vec(0,-ry,0)),tones[0]);
    for(const [j,level] of levels.entries()){
      for(let k=0;k<n;k++){
        const az=tau*k/n+.10*j, scallop=.83+.24*seed(phase,k)+.12*Math.sin(3*az+phase);
        const radius=Math.sqrt(1-level*level)*scallop;
        const dx=rx*Math.cos(az)*radius,dz=rz*Math.sin(az)*radius;
        const p=at.clone().add(vec(dx*Math.cos(angle)-dz*Math.sin(angle),ry*(level+.18*(seed(phase,k+19*j)-.5)),dz*Math.cos(angle)+dx*Math.sin(angle)));
        this.vertex(p,tones[j===1&&k%5===1?2:j]);
      }
    }
    const hi=this.vertex(at.clone().add(vec(.07*rx,ry,0)),tones[2]);
    for(let k=0;k<n;k++){
      const a=start+1+k,b=start+1+(k+1)%n;
      const last=(levels.length-1)*n;
      this.indices.push(lo,a,b,hi,b+last,a+last);
      for(let j=0;j<levels.length-1;j++)this.quad(a+j*n,a+(j+1)*n,b+(j+1)*n,b+j*n);
    }
  }
}

// Farthest-point seeds follow high returns and spreading side branches.
// Trees borrowing a measured form reuse the same ordered bough memberships.
const planeClusters=new WeakMap<Point[],number[][]>();
export function observedSprays(points:Point[]){
  const cached=planeClusters.get(points);if(cached)return cached;
  const boughs=10,centers:Point[]=[];
  const groupForPoint=new Uint8Array(points.length);
  const nearestDistance=new Float64Array(points.length).fill(Infinity);
  let seedPoint=points.reduce((a,b)=>a.y>b.y?a:b);
  // Adding each seed already compares it with every point. Keep the winning
  // group here so the first refinement starts with its assignments complete.
  for(let k=0;k<boughs;k++){
    centers.push(seedPoint.clone());
    let farthest=0;
    for(let i=0;i<points.length;i++){
      const distance=points[i].distanceToSquared(seedPoint);
      if(distance<nearestDistance[i]){
        nearestDistance[i]=distance;
        groupForPoint[i]=k;
      }
      if(nearestDistance[i]>nearestDistance[farthest])farthest=i;
    }
    seedPoint=points[farthest];
  }
  const sums=centers.map(()=>vec(0,0,0)),counts=new Uint32Array(boughs);
  for(let pass=1;pass<5;pass++){
    counts.fill(0);for(const sum of sums)sum.set(0,0,0);
    for(let i=0;i<points.length;i++){
      const k=groupForPoint[i];sums[k].add(points[i]);counts[k]++;
    }
    for(let k=0;k<boughs;k++)if(counts[k])centers[k].copy(sums[k]).divideScalar(counts[k]);
    let changed=false;
    for(let i=0;i<points.length;i++){
      let nearest=0,min=Infinity;
      for(let k=0;k<boughs;k++){
        const distance=points[i].distanceToSquared(centers[k]);
        if(distance<min){min=distance;nearest=k;}
      }
      if(nearest!==groupForPoint[i]){groupForPoint[i]=nearest;changed=true;}
    }
    if(!changed)break;
  }
  const groups:number[][]=Array.from({length:boughs},()=>[]);
  for(let i=0;i<points.length;i++)groups[groupForPoint[i]].push(i);
  planeClusters.set(points,groups);return groups;
}

function planeSprays(points:Point[],groups:number[][],phase:number,id:number,h:number,r:number,tones:THREE.Color[],wood:Paint,crown:Paint,fork:Point,spine:Point){
  const measured=new THREE.Box3().setFromPoints(points),out=new THREE.Box3();
  const supports:{center:Point;tip:Point}[]=[];
  const hue=new THREE.Color(),v=vec(0,0,0);
  groups.forEach((indices,k)=>{
    const group=indices.map(i=>points[i]);
    const mid=group.reduce((sum,p)=>sum.add(p),vec(0,0,0)).divideScalar(group.length);
    const height=(mid.y-measured.min.y)/(measured.max.y-measured.min.y);
    const az=Math.atan2(mid.z,mid.x)+.19*Math.sin(phase+k);
    const dir=vec(Math.cos(az),0,Math.sin(az)),side=vec(-dir.z,0,dir.x);
    const axes=new THREE.Box3();
    for(const p of group){v.copy(p).sub(mid);axes.expandByPoint(vec(v.dot(dir),v.y,v.dot(side)));}
    const extent=axes.getSize(vec(0,0,0));
    const len=Math.max(.085*h,extent.x*.61),width=Math.max(.053*h,extent.z*(.36+.13*height));
    const depth=Math.max(.042*h,extent.y*(.27+.13*height));
    // Two forked sprays per bough. Sparse lateral twigs show beneath broad,
    // overlapping upper fans. Stagger the layers to avoid a ring of equal tufts.
    const base=mid.clone().addScaledVector(dir,-len*.85);
    base.y-=depth*.6;
    const to=mid.clone().addScaledVector(side,width*.40);
    supports.push({center:base,tip:to});
    for(const sign of [-1,1]){
      const n=sign===1?6:5,layers=sign===1?3:2,first=crown.xyz.length/3;
      const shoot=dir.clone().addScaledVector(side,sign*(.34+.30*seed(id,k+42))).normalize();
      const cross=vec(-shoot.z,0,shoot.x),scale=sign===1?1:.78;
      const origin=base;
      const end=mid.clone().addScaledVector(shoot,len*(sign===1?1.13:.81)).addScaledVector(side,sign*width*.51);
      end.y+=depth*(sign===1?.91:.25);
      const hueAt=(value:number)=>{
        value=THREE.MathUtils.clamp(value,0,1)*2;
        return hue.copy(tones[Math.floor(value)]).lerp(tones[Math.ceil(value)],value%1);
      };
      crown.vertex(origin,hueAt(.20+.20*height));
      for(let j=0;j<layers;j++){
        const t=(j+1)/(layers+1),c=origin.clone().lerp(end,t);c.y+=Math.sin(t*Math.PI)*depth*.25;
        for(let a=0;a<n;a++){
          const ang=tau*(a+.13*j+.17*seed(id,k+3))/n;
          const spread=(.83+.28*seed(id,43*k+7*j+a))*Math.sin(Math.PI*t)**.55;
          const pt=c.clone().addScaledVector(cross,Math.cos(ang)*width*scale*spread);
          pt.y+=Math.sin(ang)*depth*scale*spread;
          pt.addScaledVector(shoot,len*.32*Math.sin(ang*3+k+j));
          crown.vertex(pt,hueAt(.40+.21*height+.24*Math.sin(ang)+.16*(seed(id,k*37+j*5+a)-.5)));
        }
      }
      const tip=crown.vertex(end,hueAt(.65+.15*height));
      for(let a=0;a<n;a++){
        const b=(a+1)%n,i=first+1+a,j=first+1+b;
        crown.indices.push(first,i,j);
        for(let row=0;row<layers-1;row++)crown.quad(i+row*n,i+(row+1)*n,j+(row+1)*n,j+row*n);
        crown.indices.push(i+(layers-1)*n,tip,j+(layers-1)*n);
      }
      // A short terminal spray breaks each outline into attached folded
      // leaf tips, even when the leaf texture is smaller than a pixel.
      const rim=first+1+(layers-1)*n+(sign>0?0:Math.floor(n/2));
      const pin=vec(0,0,0).fromArray(crown.xyz,rim*3);
      const along=shoot.clone().addScaledVector(cross,sign*.68);
      const scaleTip=Math.min(len,width)*.66;
      const pattern=[[.88,-.37],[.68,-.07],[1.18,.10],[.65,.17],[.88,.42],[.38,.25]];
      const edge=pattern.map(([u,v],j)=>{
        const pt=pin.clone().addScaledVector(along,u*scaleTip).addScaledVector(cross,v*scaleTip);
        pt.y+=scaleTip*(.14*Math.sin(j*1.4)-u*.16);
        return crown.vertex(pt,hueAt(.48+.16*height+.08*Math.sin(j*2)));
      });
      for(let j=1;j<edge.length;j++)crown.indices.push(rim,edge[j-1],edge[j]);
      const fold=pin.clone().addScaledVector(along,scaleTip*.36);fold.y-=scaleTip*.14;
      const underside=crown.vertex(fold,hueAt(.36+.14*height));
      crown.indices.push(underside,edge[2],edge[0],underside,edge[4],edge[2]);
    }
  });
  for(let i=0;i<crown.xyz.length;i+=3)out.expandByPoint(v.fromArray(crown.xyz,i));
  const stretch=measured.getSize(vec(0,0,0)).divide(out.getSize(vec(0,0,0)));
  const fit=(p:Point)=>p.sub(out.min).multiply(stretch).add(measured.min);
  for(let i=0;i<crown.xyz.length;i+=3)fit(v.fromArray(crown.xyz,i)).toArray(crown.xyz,i);
  const scaffold=Array.from({length:5},()=>[] as {mid:Point;tip:Point}[]);
  for(const s of supports){
    const mid=fit(s.center),tip=fit(s.tip);
    const sector=Math.floor(((Math.atan2(mid.z,mid.x)-phase+tau*2)%tau)/tau*5);
    scaffold[sector].push({mid,tip});
  }
  for(const [i,arms] of scaffold.entries()){
    if(!arms.length)continue;
    const origin=fork.clone().lerp(spine,.26+.42*seed(id,i+51));
    const mean=arms.reduce((v,s)=>v.add(s.mid),vec(0,0,0)).divideScalar(arms.length);
    const elbow=origin.clone().lerp(mean,.54);elbow.y-=h*.047;
    wood.stem(origin,elbow,r*.52,r*.28,planeBark,id+i,2,5);
    for(const {mid,tip} of arms){
      wood.stem(elbow,mid,r*.26,r*.11,planeBark,id+i+11,2,4);
      wood.stem(mid,tip,r*.12,r*.025,planeBark,id+i+21,2,3);
    }
  }
}

export function waterfrontTree(mesh:PlantMesh,x:number,y:number,z:number,id:number,height:number,species='',seasonMonth=month,trunkRadius?:number,streetCrown=false){
  const habit=treeHabit(species),f=forms[habit],h=height,phase=seed(id,7)*tau;
  const evergreen=['privet','magnolia','live oak','broadleaf'].includes(habit);
  const winter=!evergreen&&(seasonMonth===12||seasonMonth<=2);
  const autumn=!evergreen&&seasonMonth>=10&&seasonMonth<=11;
  const green=habit==='magnolia'?leaf.magnolia:evergreen&&habit!=='broadleaf'?leaf.evergreen:habit==='plane'?leaf.plane:habit==='ash'?leaf.ash:leaf.broad;
  const tones=autumn?(habit==='ginkgo'||habit==='poplar'?leaf.gold:leaf.ochre):green;
  const wood=new Paint(),crown=new Paint(),timber=habit==='plane'?planeBark:bark;
  const r=trunkRadius??h*(habit==='live oak'?.035:.021+seed(id,10)*.006);
  const anchor={};
  const tagged:PlantMesh=(g,c,px,py,pz)=>{
    const m=mesh(g,c,px,py,pz);m.userData.waterfrontPlant='tree';m.userData.plantAnchor=anchor;return m;
  };
  const shell=streetCrown?undefined:observedCanopy(id,habit==='plane');
  if(shell&&!winter){
    // Ground the scaffold in the trunk and aim each division toward its own
    // sector of observed canopy. Large openings remain clear to the sky.
    const direct=id===shell.source,rotation=direct?0:phase,cos=Math.cos(rotation),sin=Math.sin(rotation);
    const points=shell.points.map(p=>vec((p.x*cos-p.z*sin)*h,p.y*h,(p.x*sin+p.z*cos)*h));
    const high=Math.max(...points.map(p=>p.y)),low=Math.min(...points.map(p=>p.y));
    const fork=vec(.018*h*Math.cos(phase),Math.min(.39*h,low*.89),.018*h*Math.sin(phase));
    wood.stem(vec(0,0,0),fork,r,r*.65,timber,id,5);
    const spine=vec(fork.x+.036*h*Math.cos(phase+.5),fork.y+h*.18,fork.z+.036*h*Math.sin(phase+.5));
    wood.stem(fork,spine,r*.65,r*.31,timber,id+22,3);
    if(habit==='plane'){
      planeSprays(points,observedSprays(shell.points),phase,id,h,r,tones,wood,crown,fork,spine);
      wood.finish(tagged,x,y,z,'plane branches');
      const foliage=crown.finish(tagged,x,y,z,'plane foliage')!;
      foliage.geometry.userData.planeLeaf=true;
      foliage.geometry.userData.crownSource=direct?'individual lidar sprays':'local lidar sprays';
      foliage.geometry.userData.crownSourceId=shell.source;
      return;
    }
    const sectors:Point[][]=Array.from({length:6},()=>[]);
    for(const p of points){
      const az=Math.atan2(p.z,p.x)+Math.PI;
      sectors[Math.min(5,Math.floor(az*6/tau))].push(p);
    }
    for(const [j,sector] of sectors.entries()){
      if(sector.length<3)continue;
      const mean=sector.reduce((v,p)=>v.add(p),vec(0,0,0)).multiplyScalar(1/sector.length);
      const origin=fork.clone().lerp(spine,((j*5)%6)/6);
      const elbow=vec(mean.x*.53,origin.y+(mean.y-origin.y)*(.32+.12*seed(id,j)),mean.z*.53);
      wood.stem(origin,elbow,r*(.39+.13*seed(id,j+12)),r*.21,timber,id+j,2,6);
      for(const side of [-1,1]){
        const ranked=sector.slice().sort((a,b)=>(a.y+side*a.x*.48)-(b.y+side*b.x*.48));
        const tip=ranked[Math.floor(ranked.length*(side>0?.74:.43))].clone().lerp(mean,.22);
        wood.stem(elbow,tip,r*.23,r*.052,timber,id+j+side,2,6);
      }
    }
    wood.finish(tagged,x,y,z,habit+' branches');
    const center=points.reduce((v,p)=>v.add(p),vec(0,0,0)).multiplyScalar(1/points.length);
    const bounds=new THREE.Box3().setFromPoints(points),extent=bounds.getSize(vec(0,0,0));
    const geometry=new THREE.BufferGeometry().setFromPoints(points).setIndex(new THREE.BufferAttribute(shell.faces,1));
    const ellipsoid=vec(1/extent.x**2,1/extent.y**2,1/extent.z**2);
    const color=new THREE.Color(),direction=vec(0,0,0),outer=vec(0,0,0);
    const colors=new Float32Array(points.length*3),normals=new Float32Array(points.length*3);
    const variation=(seed(id,77)-.5)*.09;
    for(const [i,p] of points.entries()){
      const nx=shell.normals[i*3]/127,nz=shell.normals[i*3+2]/127;
      direction.set(nx*cos-nz*sin,shell.normals[i*3+1]/127,nx*sin+nz*cos);
      outer.copy(p).sub(center).multiply(ellipsoid).normalize();
      direction.lerp(outer,.42).normalize().toArray(normals,i*3);
      const depth=THREE.MathUtils.clamp((shell.density[i]/255-.48)/.52,0,1),up=(p.y-low)/(high-low);
      const wash=.074*Math.sin((p.x*15+p.z*7)/h)*Math.cos((p.y*19-p.z*9)/h)
        +.051*Math.sin((p.x*26+p.y*14-p.z*12)/h);
      const value=THREE.MathUtils.clamp(.43+.37*up+.10*outer.y+variation+wash-.26*depth,0,1)*2;
      color.copy(tones[Math.floor(value)]).lerp(tones[Math.min(2,Math.ceil(value))],value%1);
      color.multiplyScalar(1.02-.27*depth*(1-.30*up)).toArray(colors,i*3);
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.userData.paintVertices=true;
    geometry.userData.plantCrown=true;
    geometry.userData.crownSource=direct?'individual lidar envelope':'local lidar form';
    geometry.userData.crownSourceId=shell.source;
    const canopy=tagged(geometry,'#ffffff',x,y,z);canopy.name=habit+' foliage';canopy.userData.plantCrown=true;
    return;
  }
  const fork=vec(.027*h*Math.cos(phase),f.fork*h,.027*h*Math.sin(phase));
  wood.stem(vec(0,0,0),fork,r,r*.72,timber,id,5);
  const leader=vec(.07*h*Math.cos(phase+.2),h*.98,.07*h*Math.sin(phase+.2));
  wood.stem(fork,leader,r*.7,r*.035,timber,id+1,4);
  const tapered=['ginkgo','magnolia','poplar'].includes(habit);
  for(let i=0;i<f.branches;i++){
    const t=i/(f.branches-1),az=phase+i*2.39996+(seed(id,i+17)-.5)*.37;
    const direction=vec(Math.cos(az),0,Math.sin(az)),cross=vec(-direction.z,0,direction.x);
    const origin=fork.clone().lerp(leader,t*(tapered?.78:.51));
    const spread=h*f.spread*(.88+.20*seed(id,i+31))*(tapered?1-.63*t:1-.22*t);
    const lift=h*f.rise*(tapered?1-.73*t:1);
    const elbow=origin.clone().addScaledVector(direction,spread*(habit==='live oak'?.76:.47));
    elbow.y+=lift*(habit==='live oak'?.43:.29);
    const end=elbow.clone().addScaledVector(direction,spread*f.reach*.48).addScaledVector(cross,spread*(seed(id,40+i)-.5)*.31);
    end.y+=lift*(.47+.24*seed(id,i+4));
    wood.stem(origin,elbow,r*(.50-.25*t),r*.19,timber,id+i);
    wood.stem(elbow,end,r*.20,r*.065,timber,id+10+i);
    const size=spread*(habit==='privet'?.84:habit==='plane'?.68:.66);
    const spreading=!tapered&&habit!=='privet';
    if(!winter&&tapered){
      // The leader carries a continuous taper of foliage behind the outer fans.
      // Vary the outline at every tier, with exposed switches between side sprays.
      const inside=origin.clone().lerp(end,.36);
      inside.y+=h*(habit==='magnolia'?.13:.15);
      const breadth=spread*(habit==='ginkgo'?.83:.90);
      crown.spray(inside,breadth,h*(habit==='poplar'?.19:.16)*(1-.29*t),breadth*.74,az+.9,tones,phase+43*i);
    }
    for(const side of [-1,1]){
      const tip=end.clone().addScaledVector(cross,side*size*(.55+.13*seed(id,22+i))).addScaledVector(direction,size*.22);
      tip.y+=h*(habit==='live oak'?.05:.085)*(tapered?1-.64*t:1)*(side===1?1:.7);
      wood.stem(end,tip,r*.088,r*.028,timber,id+side+i);
      if(winter){
        const twig=tip.clone().addScaledVector(direction,h*.046);twig.y+=h*.056;
        wood.stem(tip,twig,r*.036,r*.009,timber,id+i);
      }else if(streetCrown){
        // The Howard rows show exposed forked scaffolds under contiguous,
        // uneven crowns. Build small overlapping leaf clusters on the actual
        // branch tips; the openings between successive forks remain visible.
        const color=autumn&&seed(id,i+47)>.72?green:tones;
        const base=end.clone().lerp(tip,.65),azimuth=az+side*.42;
        for(const [j,along,across,up,scale] of [
          [0,-.28,.02,.11,.64],[1,.20,.26,.27,.57],[2,.30,-.20,.03,.50],
          [3,-.05,-.24,.43,.46],
        ]){
          const leafCenter=base.clone().addScaledVector(direction,along*size)
            .addScaledVector(cross,side*across*size);
          leafCenter.y+=up*size;
          crown.spray(leafCenter,size*scale,size*scale*.79,size*scale*.81,
            azimuth+.41*j,color,id+i*23+side*7+j,true);
        }
      }else if(!spreading){
        const color=autumn&&habit!=='ginkgo'&&seed(id,i+47)>.72?green:tones;
        crown.spray(tip,size*(side===1?1:.76),size*f.depth, size*.70,az+.32*side,color,i*63+side+phase);
      }
    }
    if(!winter&&spreading&&!streetCrown){
      const start=origin.clone().lerp(elbow,.62);
      const tip=end.clone().addScaledVector(direction,size*(.83+.30*seed(id,i+60)));
      tip.addScaledVector(cross,size*(seed(id,i+77)-.5)*.54);
      tip.y+=h*(habit==='live oak'?.065:.106)+size*(seed(id,i+65)-.5)*.40;
      const color=autumn&&seed(id,i+47)>.72?green:tones;
      crown.bough(start,tip,cross,size*(.83+.23*seed(id,i+71)),size*(habit==='live oak'?.48:.74),color,phase+i*2.7);
    }
  }
  if(!winter&&!tapered&&habit!=='privet'){
    const head=leader.clone().multiplyScalar(.83);
    head.x+=h*.05*Math.cos(phase+.7);head.z+=h*.05*Math.sin(phase+.7);
    crown.spray(head,h*f.spread*.57,h*(habit==='live oak'?.095:.17),h*f.spread*.56,phase,tones,phase);
    const shoulder=head.clone().add(vec(-Math.cos(phase)*h*.15,-h*.07,-Math.sin(phase)*h*.15));
    crown.spray(shoulder,h*f.spread*.45,h*.121,h*f.spread*.50,phase-.65,tones,phase+9);
  }
  if(!winter&&(tapered||habit==='privet'))crown.spray(leader,h*f.spread*(tapered?.27:.40),h*.080,h*f.spread*.36,phase,tones,phase);
  wood.finish(tagged,x,y,z,habit+' branches');crown.finish(tagged,x,y,z,habit+' foliage');
}

function palmPanel(paint:Paint,points:Point[],colors:THREE.Color[]){
  // Separate rear vertices keep both sides lit when the shared city material is single-sided.
  for(const reverse of [false,true]){
    const ids=points.map((pt,i)=>paint.vertex(pt,colors[i]));
    if(reverse)ids.reverse();
    paint.quad(ids[0],ids[1],ids[2],ids[3]);
  }
}
export function waterfrontPalm(mesh:PlantMesh,x:number,y:number,z:number,id:number,h:number,radius:number,measuredTrunkRadius?:number,species='Phoenix canariensis'){
  const fan=/Washingtonia/i.test(species),angle=seed(id,19)*tau,anchor={};
  const tagged:PlantMesh=(g,c,px,py,pz)=>{
    const m=mesh(g,c,px,py,pz);m.userData.waterfrontPlant='palm';m.userData.plantAnchor=anchor;return m;
  };
  const trunk=measuredTrunkRadius??h*(fan?.017:.038);
  const axis=vec(Math.cos(angle),0,Math.sin(angle)),joint=axis.clone().multiplyScalar(h*.013),top=axis.clone().multiplyScalar(h*(fan?.044:.023));
  joint.y=h*.47;top.y=h;
  const limb=(a:Point,b:Point,r:number,end:number,c:string)=>{
    const direction=b.clone().sub(a),mid=a.clone().lerp(b,.5);
    const member=tagged(new THREE.CylinderGeometry(end,r,direction.length(),8),c,x+mid.x,y+mid.y,z+mid.z);
    member.name='Palm trunk';member.quaternion.setFromUnitVectors(vec(0,1,0),direction.normalize());
  };
  limb(vec(0,0,0),joint,trunk,trunk*.86,fan?'#a0957f':'#81725d');
  limb(joint,top,trunk*.86,trunk*(fan?.72:1.04),fan?'#b1a58e':'#988364');
  const collarCount=fan?4:7;
  for(let j=0;j<collarCount;j++){
    const f=j/(collarCount-1),center=top.clone().addScaledVector(vec(0,1,0),-trunk*(.28+j*.58));
    const r=trunk*(fan?.95:1.32-.44*f);
    limb(center,center.clone().add(vec(0,trunk*.46,0)),r*.82,r,j%2?'#928260':'#aa956f');
  }
  const paint=new Paint(),rib=new Paint(),count=fan?14:23;
  for(let i=0;i<count;i++){
    const az=angle+i*2.39996+.19*(seed(id,i+18)-.5),out=vec(Math.cos(az),0,Math.sin(az)),side=vec(-out.z,0,out.x);
    const tier=i%3,length=radius*(.79+.23*seed(id,i+3)),base=top.clone().add(vec(0,(tier-1)*trunk*.35,0));
    const tones=fan&&tier===0&&i%2===0?leaf.dry:fan?leaf.fan:leaf.palm;
    if(fan){
      const wrist=base.clone().addScaledVector(out,length*(tier===2?.38:.50));
      wrist.y+=length*([-.10,.16,.42][tier]+(seed(id,i+80)-.5)*.28);
      rib.stem(base,wrist,trunk*.20,trunk*.11,tones,i);
      const along=wrist.clone().sub(base);
      along.y+=length*([-.23,.36,.55][tier]+.22*(seed(id,i+71)-.5));along.normalize();
      const leafLength=length*(tier===2?.66:.77),roll=(seed(id,i+52)-.5)*.62;
      for(let j=0;j<12;j++){
        const edge=(u:number,t:number)=>{
          const v=(u-.5)*2,spread=Math.sin(v*1.15),reach=Math.cos(v*1.15);
          const p=wrist.clone().addScaledVector(along,leafLength*t*reach).addScaledVector(side,leafLength*t*spread);
          p.y+=leafLength*(.15*Math.sin(t*Math.PI)-.19*t*t-.23*t*Math.abs(v)+roll*t*v);return p;
        };
        const a=j/12,b=(j+1)/12,m=(a+b)/2;
        const ridge=edge(m,1);ridge.y+=leafLength*.06;
        palmPanel(paint,[edge(a,.015),edge(a,.79),ridge,edge(m,.012)],[tones[0],tones[1],tones[2],tones[0]]);
        palmPanel(paint,[edge(m,.012),ridge,edge(b,.79),edge(b,.015)],[tones[0],tones[2],tones[1],tones[0]]);
      }
    }else{
      // Miia Ranta's close and wide plaza photographs (May 2011) show an
      // upright central spray above broad arches and a skirt of pendant tips.
      // https://commons.wikimedia.org/wiki/File:San_Francisco_Ferry_Building_from_the_Embarcadero_Plaza_(May_2011).jpg
      // https://commons.wikimedia.org/wiki/File:Ferry_Building_clock_tower_in_San_Francisco_obfuscated_by_palm_trees.jpg
      const youth=(i+seed(id,i+32))/count;
      const spear=THREE.MathUtils.smoothstep(youth,.54,1);
      const reach=length*(.97-.57*spear),tip=length*(-.83+1.73*youth);
      const rise=length*(1.22+.55*youth),turn=length*.17*(seed(id,i+41)-.5);
      const dry=THREE.MathUtils.clamp((.38-youth)*2.8+.20*(seed(id,i+27)-.5),0,1);
      const shade=leaf.palm[0].clone().lerp(leaf.palmSkirt[0],dry);
      const ridge=leaf.palm[1].clone().lerp(leaf.palmSkirt[1],dry);
      const light=leaf.palm[2].clone().lerp(leaf.palmSkirt[2],dry);
      const sections=9;
      for(let j=0;j<=sections;j++){
        const t=j/sections,bow=t*(1-t);
        const mid=base.clone().addScaledVector(out,reach*(t+(.83-.40*spear)*bow)).addScaledVector(side,turn*t*t);
        mid.y+=rise*bow+tip*t*t;
        // Group the pinnae into tapered, swept feather edges. The broad
        // V-fold remains visible at phone scale without individual needles.
        const width=length*(.002+(.147-.044*spear)*Math.sin(Math.PI*t)**.94)*(j%2===0?.74:1);
        for(const sign of [-1,1]){
          const edge=mid.clone().addScaledVector(side,sign*width).addScaledVector(out,width*(j%2===0?.20:.72));
          edge.y-=width*(.72-.42*spear);
          const tint=sign>0?light:shade;
          // Keep the folded ridge and the underside independently lit using
          // the existing single-sided tree material.
          for(const reverse of [false,true]){
            const m=paint.vertex(mid,ridge),e=paint.vertex(edge,tint);
            if(!j)continue;
            const stride=8;
            if(reverse===(sign>0))paint.quad(m-stride,e-stride,e,m);
            else paint.quad(m,e,e-stride,m-stride);
          }
        }
      }
    }
  }
  rib.finish(tagged,x,y,z,'Fan palm petioles');
  paint.finish(tagged,x,y,z,fan?'Fan palm foliage':'Date palm foliage');
}
