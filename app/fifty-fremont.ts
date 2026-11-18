import * as THREE from 'three';
import {footprintGeometry} from './sf-map.ts';

type Building={id:number;p:number[][]};
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
type Vertex=[number,number,number];
const roofMaterial=new THREE.MeshStandardMaterial({color:'#aaa999',roughness:.95});
const facadeMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88});
const stone=['#cbc5b4','#c9c2b1','#d0caba'],glass=['#4d626a','#576b71','#52666d'];
const longFace=new Set([6,24]),shortFace=new Set([15,33]);

// Andrew Campbell Nelson's direct Mission Street, tower plaza and skyline views:
// https://sfyimby.com/2021/09/number-13-salesforce-west-at-50-fremont-center-soma-san-francisco.html
// SGH inspected SOM's original structural drawings and the 43-story building.
// https://www.sgh.com/project/50-fremont-center/
// Salesforce lease, Exhibit A-1 floor plans and Exhibit H lobby/plaza drawings:
// https://www.sec.gov/Archives/edgar/data/1108524/000119312512005111/d277012dex101.htm
// SF Planning, Figure 2: 50 Fremont floor plate and perimeter walks.
// https://sfplanning.s3.amazonaws.com/sfmea/2015-009288ENV_CPE_Checklist.pdf
// The 36 surveyed corners describe the repeated notches on all four sides. The
// 2023 USGS DSM resolves ~115 m corner ledges, ~173 m shoulders, ~180 m screen
// steps and a main roof just under 183 m. Higher isolated returns aren't walls.
const shoulder=10.395,roofHeight=10.98;
const first=.04,pitch=(shoulder-first)/43,mid=first+28*pitch;

class Panels{
  positions:number[]=[];colors:number[]=[];indices:number[]=[];
  tones=new Map<string,THREE.Color>();
  quad(a:Vertex,b:Vertex,c:Vertex,d:Vertex,tint:string){
    let color=this.tones.get(tint);
    if(!color)this.tones.set(tint,color=new THREE.Color(tint));
    const i=this.positions.length/3;
    for(const p of [a,b,c,d]){this.positions.push(...p);this.colors.push(color.r,color.g,color.b);}
    this.indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  finish(root:THREE.Group){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    geo.setIndex(this.indices);geo.computeVertexNormals();geo.userData.paintVertices=true;
    const mesh=new THREE.Mesh(geo,facadeMaterial);mesh.name='50 Fremont stone bays and corner glazing';root.add(mesh);
  }
}

// Move each corner notch along the same two axes as the original footprint,
// taking a full window off each end of the upper stone elevations.
function upperRings(p:number[][]){
  const center=p.reduce(([x,z],q)=>[x+q[0]/p.length,z+q[1]/p.length],[0,0]);
  const ux=p[6][0]-p[7][0],uz=p[6][1]-p[7][1],length=Math.hypot(ux,uz),ax=ux/length,az=uz/length;
  const clamp=(v:number)=>Math.max(0,Math.min(1,v));
  return (tier:number)=>p.map(([x,z])=>{
    const dx=x-center[0],dz=z-center[1],u=dx*ax+dz*az,v=-dx*az+dz*ax;
    const cutU=.028+.25*(1-clamp((Math.abs(u)-1.275)/.29));
    const cutV=.028+.25*(1-clamp((Math.abs(v)-.875)/.27));
    const a=u-Math.sign(u)*(cutU+tier*.078),b=v-Math.sign(v)*(cutV+tier*.070);
    return [center[0]+ax*a-az*b,center[1]+az*a+ax*b];
  });
}

function deck(root:THREE.Group,name:string,ring:number[][],y:number){
  const mesh=new THREE.Mesh(footprintGeometry(ring,.007),roofMaterial);
  mesh.name=name;mesh.position.y=y-.007;root.add(mesh);
}

function elevation(s:Panels,a:number[],b:number[]){
  const dx=b[0]-a[0],dz=b[1]-a[1],width=Math.hypot(dx,dz),ux=dx/width,uz=dz/width;
  const point=(x:number,y:number,d:number):Vertex=>[a[0]+x*ux-d*uz,y,a[1]+x*uz+d*ux];
  function panel(l:number,r:number,y:number,t:number,d:number,c:string){
    s.quad(point(l,y,d),point(r,y,d),point(r,t,d),point(l,t,d),c);
  }
  function jamb(l:number,r:number,y:number,t:number,c:string){
    panel(l,r,y,t,.012,c);
    for(const [x,front,back] of [[l,0,.012],[r,.012,0]])
      s.quad(point(x,y,front),point(x,y,back),point(x,t,back),point(x,t,front),'#afa99a');
  }
  return {width,point,panel,jamb,angle:Math.atan2(-uz,ux)};
}

function offices(s:Panels,ring:number[][],start:number,end:number,windows:Window[]){
  const bottom=first+start*pitch,top=first+end*pitch;
  for(let i=0;i<ring.length;i++){
    const face=elevation(s,ring[(i+1)%ring.length],ring[i]);
    if(!longFace.has(i)&&!shortFace.has(i)){
      // The glass curtains continue vertically past the office windows, edged
      // by narrow stone fins on the returns of the notched plan.
      face.panel(0,face.width,bottom,top,0,i%2?'#536970':'#65797b');
      face.panel(0,face.width*(i%2?.14:.25),bottom,top,.005,stone[i%3]);
      continue;
    }
    const count=(longFace.has(i)?9:6)-(start?2:0),bay=face.width/count;
    for(let k=0;k<count;k++){
      const l=(k+.18)*bay,r=(k+.82)*bay,tint=stone[(k+i)%3];
      if(!k)face.jamb(0,l,bottom,top,tint);
      face.jamb(r,Math.min(face.width,r+.36*bay),bottom,top,tint);
      face.panel(l,r,bottom,top,0,glass[(k+i)%3]);
      for(let row=start;row<end;row++){
        const y=first+row*pitch;
        if(row>=14&&row<17){
          if(row===14){
            face.panel(l,r,y+.035,y+3*pitch-.040,.002,'#6c746e');
            for(let rib=1;rib<=6;rib++){
              const x=l+(r-l)*rib/7;
              face.panel(x-.0016,x+.0016,y+.035,y+3*pitch-.040,.004,'#86887d');
            }
          }
          continue;
        }
        const entry=row===0,lower=entry?y:y+pitch*.27,upper=y+pitch*.83;
        if(!entry)face.panel(l,r,y,lower,.009,tint);
        face.panel(l,r,upper,y+pitch,.009,tint);
        if(entry)face.panel((r+l)/2-.003,(r+l)/2+.003,lower,upper,.005,'#545956');
        if((row+k+i)%5===0){
          const [x,py,z]=face.point((r+l)/2,(lower+upper)/2,.002);
          windows.push({x,y:py,z,ry:face.angle,w:(r-l)*.94,h:(upper-lower)*.94});
        }
      }
    }
  }
}

export function addFiftyFremont(b:Building,root:THREE.Group,windows:Window[]){
  if(b.id!==288716396)return false;
  const part=new THREE.Group(),s=new Panels(),p=b.p.slice(0,-1),inset=upperRings(p);
  part.name='50 Fremont Center';root.add(part);
  const upper=inset(0);
  offices(s,p,0,28,windows);
  deck(part,'50 Fremont corner setbacks',p,mid);
  offices(s,upper,28,43,windows);
  deck(part,'50 Fremont shoulder roof',upper,shoulder);
  const cuts=[shoulder,10.59,10.79,roofHeight];
  for(let tier=0;tier<3;tier++){
    const ring=inset(tier+1),base=cuts[tier],top=cuts[tier+1];
    for(let i=0;i<ring.length;i++){
      const f=elevation(s,ring[(i+1)%ring.length],ring[i]);
      f.panel(0,f.width,base,top,0,stone[(i+tier)%3]);
      if(i===33&&tier===1){
        f.panel(f.width*.28,f.width*.72,base+.024,top-.037,.002,'#434c4b');
      }
    }
    deck(part,tier===2?'50 Fremont architectural roof':'50 Fremont crown terrace',ring,top);
  }
  s.finish(part);
  return true;
}
