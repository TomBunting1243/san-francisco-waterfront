import * as THREE from 'three';
import {StreetAssembly} from './street-amenities.ts';

const wine='#622e36',oxblood='#78404a',cream='#e4cda1',gold='#c5a570';
const blue='#8ca4ad',wood='#a4774c',varnish='#815735',steel='#353e40';
const glass='#607576',clerestory='#586767';
type Point=[number,number,number];

/** California Street double-ended car 49, in metres above the tread contact plane. */
export function makeCaliforniaCarBody(){
  const car=new StreetAssembly();
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:string)=>car.box(x,y,z,w,h,d,c);
  // Geometry used for flat painted faces has no back or buried side triangles.
  function sheet(vertices:Point[],indices:number[],c:string){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));g.setIndex(indices);
    g.computeVertexNormals();return car.add(g,c,0,0,0);
  }
  function rod(a:Point,b:Point,r:number,c:string,n=6){
    const v=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
    const m=car.add(new THREE.CylinderGeometry(r,r,v.length(),n,1,true),c,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());
  }
  // The eaves wrap the open ends; the upper roof has a shorter footprint.
  function roof(length:number,width:number,y:number,thickness:number,corner:number,roll:number,c:string,rim=c){
    const half=length/2,w=width/2;
    const outline:Point[]=[];
    for(const [sx,sz,begin] of [[1,1,0],[-1,1,Math.PI/2],[-1,-1,Math.PI],[1,-1,3*Math.PI/2]]){
      for(let k=0;k<=3;k++){
        const t=begin+k*Math.PI/6;
        outline.push([sx*(half-corner)+corner*Math.cos(t),y,sz*(w-corner)+corner*Math.sin(t)]);
      }
    }
    const vertices=[...outline,...outline.map(([x,,z]):Point=>[x,y+thickness,z]),
      ...outline.map(([x,,z]):Point=>[x*.971,y+thickness+roll,z*.69])];
    const top=vertices.push([0,y+thickness+roll,0])-1,bottom=vertices.push([0,y,0])-1;
    const inds:number[]=[],skin:number[]=[],n=outline.length;
    for(let i=0;i<n;i++){
      const j=(i+1)%n;
      inds.push(i,j,bottom,i,i+n,j+n,i,j+n,j);
      skin.push(i+n,i+2*n,j+2*n,i+n,j+2*n,j+n,i+2*n,top,j+2*n);
    }
    sheet(vertices,inds,c);sheet(vertices,skin,rim);
  }
  // Rail contact is the circular tread, with four axles in two pivoting trucks.
  for(const s of [-1,1]){
    for(const x of [s*1.95,s*3.53]){
      rod([x,.31,-.584],[x,.31,.584],.097,steel);
      for(const side of [-1,1]){
        const wheel=car.add(new THREE.CylinderGeometry(.31,.31,.091,12),steel,x,.31,side*.5335);
        wheel.rotation.x=Math.PI/2;
        const hub:Point[]=[],tri:number[]=[];
        for(let k=0;k<8;k++){
          const t=k*Math.PI/4;hub.push([x+.105*Math.cos(t),.31+.105*Math.sin(t),side*.581]);
          if(k>=2)tri.push(0,k-1,k);
        }
        if(side<0)tri.reverse();
        sheet(hub,tri,'#616c6c');
      }
    }
    for(const side of [-1,1])box(s*2.74,.395,side*.637,1.99,.155,.101,'#495253');
  }
  box(0,.478,0,8.81,.19,1.82,'#494845');
  box(0,.603,0,8.97,.105,1.875,varnish);
  for(const side of [-1,1]){
    for(const end of [-1,1]){
      // Outside running board is continuous beside each open bench.
      box(end*3.016,.28,side*1.083,2.952,.08,.270,'#686965');
      box(end*3.016,.294,side*1.212,2.952,.049,.012,'#acb0a7');
      box(end*3.016,.573,side*.951,2.95,.15,.032,blue);
      for(const x of [2.12,3.75])box(end*x,.363,side*.986,.082,.137,.25,steel);
    }
    box(0,.492,side*.953,3.23,.22,.058,blue);
    box(0,.901,side*.927,3.23,.605,.107,wine);
    box(0,1.236,side*.94,3.23,.067,.099,cream);
    box(0,.673,side*.986,3.19,.030,.012,gold);
    car.label('49',0,.79,side*.987,.22,cream,side===1?0:Math.PI);
  }
  // Four arched sash windows. Build the cream arch spandrels around the actual
  // glass opening to preserve the shadow reveal and the curved upper corners.
  for(const side of [-1,1]){
    const panel=(xys:number[][],depth:number,c:string)=>{
      const indices:number[]=[];
      for(let j=1;j<xys.length-1;j++)indices.push(0,...(side>0?[j,j+1]:[j+1,j]));
      return sheet(xys.map(([x,y])=>[x,y,side*depth]),indices,c);
    };
    for(let i=0;i<4;i++){
      const x=(i-1.5)*.80,l=x-.362,r=x+.362;
      const arch=[[l,2.305],[l+.036,2.354],[l+.121,2.394],[x,2.408],
        [r-.121,2.394],[r-.036,2.354],[r,2.305]];
      panel([[l,1.284],[r,1.284],...arch.slice().reverse()],.926,i%2?glass:'#687d7c').userData.cabinLight=1;
      for(let j=0;j<arch.length-1;j++){
        const a=arch[j],b=arch[j+1];
        panel([a,b,[b[0],2.47],[a[0],2.47]],.974,cream);
      }
      box(x-.4,1.864,side*.95,.077,1.20,.055,cream);
      if(i===3)box(x+.4,1.864,side*.95,.077,1.20,.055,cream);
      box(x,1.28,side*.95,.731,.039,.055,cream);
    }
    box(0,2.50,side*.95,3.25,.093,.113,cream);
  }
  for(const end of [-1,1]){
    const s=end;
    box(s*1.615,.945,0,.085,.58,1.86,wine);
    for(const side of [-1,1]){
      box(s*1.614,1.85,side*.68,.045,1.09,.422,glass).userData.cabinLight=1;
      box(s*1.62,1.85,side*.93,.077,1.22,.064,cream);
      box(s*1.62,1.85,side*.445,.072,1.22,.066,cream);
      // Narrow varnished slats leave visible gaps on the continuous outward-facing seats.
      for(let k=0;k<4;k++)box(s*2.74,1.033,side*(.17+k*.102),1.96,.065,.085,wood);
      for(let k=0;k<3;k++)box(s*2.74,1.15+k*.126,side*.122,1.96,.09,.045,wood);
      for(const x of [1.94,3.52])box(s*x,.846,side*.342,.095,.315,.37,varnish);
      for(const x of [2.49,3.80,4.34]){
        rod([s*x,1.62,side*.919],[s*x,2.534,side*.919],.031,varnish,5);
        rod([s*x,.655,side*.919],[s*x,1.62,side*.919],.032,gold,5);
      }
    }
    // Half-height end dash around the grip position; the sides stay open.
    box(s*4.404,1.022,0,.1,.71,1.64,wine);
    box(s*4.416,1.39,0,.12,.055,1.68,gold);
    box(s*4.457,1.03,0,.012,.425,.95,cream);
    car.label('49',s*4.47,.98,0,.143,wine,s*Math.PI/2);
    // DBI 2018–19 annual report p.36: one round dash lens directly beneath 49.
    // The replacement PAR46 is 5¾ inches across. Its bezel projects from the dash.
    car.add(new THREE.CylinderGeometry(.096,.096,.066,12),steel,s*4.476,.845,0).rotation.z=Math.PI/2;
    const lens=car.add(new THREE.CircleGeometry(.073,12),'#bdaf9b',s*4.511,.845,0);
    lens.rotation.y=s*Math.PI/2;lens.userData.cabinLight=s>0?2:3;
    for(const side of [-1,1]){
      rod([s*4.386,1.393,side*.754],[s*4.386,2.555,side*.754],.035,varnish,8);
      rod([s*3.91,.647,side*.18],[s*3.68,1.48,side*.18],.031,steel);
    }
    box(s*1.62,1.255,0,.082,1.19,.81,varnish);
    box(s*1.668,1.938,0,.015,.88,.72,glass).userData.cabinLight=1;
  }
  roof(9.2202,2.4372,2.531,.11,.295,.108,oxblood,gold);
  box(0,2.839,0,7.27,.256,1.62,varnish);
  for(const side of [-1,1])for(let k=0;k<16;k++){
    const x=(k-7.5)*.451,z=side*.813;
    sheet([[x-.191,2.766,z],[x+.191,2.766,z],[x+.191,2.931,z],[x-.191,2.931,z]],
      side>0?[0,1,2,0,2,3]:[0,2,1,0,3,2],clerestory);
  }
  roof(7.48,1.8,2.957,.059,.133,.0828,'#9b886c');
  for(const s of [-1,1]){
    const angle=s===1?0:Math.PI;
    car.label('CALIFORNIA ST',0,2.55,s*1.2192,.067,cream,angle);
  }
  function oval(x:number,y:number,z:number,w:number,h:number,d:number,c:string){
    car.add(new THREE.SphereGeometry(1,6,4).scale(w,h,d),c,x,y,z);
  }
  function rider(x:number,side:number,coat:string,skin:string){
    const z=side*.35;
    oval(x,1.42,z,.198,.327,.143,coat);
    oval(x,1.858,z,.111,.144,.107,skin);
    oval(x,1.944,z-side*.01,.116,.073,.109,'#55473e');
    for(const s of [-1,1]){
      box(x+s*.093,1.102,side*.504,.143,.132,.349,'#46525a');
      box(x+s*.093,.872,side*.636,.127,.392,.129,'#46525a');
      box(x+s*.093,.686,side*.685,.138,.068,.207,'#51463d');
      rod([x+s*.163,1.57,z],[x+s*.185,1.211,side*.541],.054,coat);
    }
  }
  rider(-2.84,-1,'#586f85','#b98565');
  rider(2.31,1,'#96846a','#b38b77');
  // Operator stands clear of the outside step, facing the leading dash.
  for(const s of [-1,1]){
    box(3.91,.988,s*.106,.14,.636,.135,'#3e4953');
    box(3.966,.693,s*.106,.244,.075,.144,'#514840');
  }
  oval(3.912,1.526,0,.162,.321,.222,'#475865');
  oval(3.928,1.966,0,.119,.151,.113,'#ba8f75');
  box(3.946,2.086,0,.269,.086,.237,'#404c54');
  rod([3.911,1.644,-.154],[3.713,1.478,-.18],.062,'#475865');
  rod([3.911,1.644,.154],[3.716,1.478,.18],.062,'#475865');
  const body=car.bake('California Street cable car 49');
  const lightRanges:{start:number;count:number;kind:number}[]=[];
  let start=0;
  for(const part of car.parts){
    const count=part.geometry.attributes.position.count;
    if(part.userData.cabinLight)lightRanges.push({start,count,kind:part.userData.cabinLight});
    start+=count;
  }
  return Object.assign(body,{lightRanges});
}
