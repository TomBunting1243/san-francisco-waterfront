import * as THREE from 'three';

type Point = [number, number];
type Building = { id: number; minH?: number };
type Window = { x: number; y: number; z: number; ry: number; w: number; h: number };
const m=.06;
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65});
const blue=['#668891','#718f99','#78959d','#819da2','#6d8c94'];
const sill='#a7b8ba',metal='#c7ceca',balconyGlass='#94a9aa';
const interpolate=(a:Point,b:Point,t:number):Point=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];

// Huang et al., SMIP12, figs. 1, 3, 5 and 6 (completed south tower, 2008).
// https://www.conservation.ca.gov/cgs/documents/program-smi/seminar/smip12/P6_Paper_Huang_Others.pdf
// Drawing axes: right is southeast; down is southwest. The Ferry camera sees
// the square north end and the stepped northeast side. The silver grid runs
// across the bowed southwest face. Surveyed roof returns range from 183 m
// on the east setback to 216 m on the highest screen, on a ~32 m site datum.
function world([u,v]:Point):Point{
  return [-56.8+m*(-.989*u-.147*v),-33+m*(.147*u-.989*v)];
}
function arc(a:Point,b:Point,c:Point,steps:number):Point[]{
  return Array.from({length:steps},(_,i)=>{
    const t=(i+1)/steps;
    return interpolate(interpolate(a,b,t),interpolate(b,c,t),t);
  });
}

export function addRinconTower(building:Building,root:THREE.Group,windows:Window[]):boolean{
  if(building.id!==944990390)return false;
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const palette=new Map<string,THREE.Color>();
  function vertex(p:Point,y:number,tone:string){
    let color=palette.get(tone);
    if(!color){color=new THREE.Color(tone);palette.set(tone,color);}
    const [x,z]=world(p);positions.push(x,y,z);colors.push(color.r,color.g,color.b);
  }
  function wall(a:Point,b:Point,lo:number,hi:number,tone:string){
    // These plans wind clockwise in their numerical coordinate system.
    const k=positions.length/3;
    vertex(a,lo,tone);vertex(b,lo,tone);vertex(b,hi,tone);vertex(a,hi,tone);
    indices.push(k,k+1,k+2,k,k+2,k+3);
  }
  function lid(points:Point[],y:number,tone:string,up=true){
    const k=positions.length/3;
    const tris=THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(...p)),[]);
    for(const p of points)vertex(p,y,tone);
    for(const [a,b,c] of tris)indices.push(k+a,k+(up?c:b),k+(up?b:c));
  }
  function glazing(a:Point,b:Point,base:number,top:number,rows:number,phase:number,grid=false){
    const distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const bays=Math.max(1,Math.round(distance/2.2)),[ax,az]=world(a),[bx,bz]=world(b);
    const length=distance*m,dx=(bx-ax)/length,dz=(bz-az)/length;
    for(let bay=0;bay<bays;bay++){
      const p=interpolate(a,b,bay/bays),q=interpolate(a,b,(bay+1)/bays);
      // Six major silver uprights break the broad curved wall into tall bays.
      const primary=grid && Math.floor(phase/3)%2===0 && bay===0;
      const frame=interpolate(p,q,primary?.20:.044);
      wall(p,frame,base,top,grid?metal:sill);
      for(let row=0;row<rows;row++){
        const lo=base+(top-base)*row/rows,hi=base+(top-base)*(row+1)/rows;
        const band=lo+(hi-lo)*(grid?(row%8===0?.16:.042):.11);
        wall(frame,q,lo,band,grid&&row%8===0?metal:sill);
        wall(frame,q,band,hi,blue[(phase+bay+Math.floor(row/4))%blue.length]);
        if((bay*3+phase+row*7)%13===0){
          const [x,z]=world(interpolate(frame,q,.5));
          windows.push({x:x-dz*.003,y:(hi+band)/2,z:z+dx*.003,ry:Math.atan2(-dz,dx),
            w:length/bays*.82,h:(hi-band)*.83});
        }
      }
    }
  }
  function balconies(a:Point,b:Point,base:number,top:number,rows:number){
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    const outer=(p:Point):Point=>[p[0]-dz/length*1.0,p[1]+dx/length*1.0];
    const p=outer(a),q=outer(b),rim=[a,p,q,b];
    for(let row=0;row<rows;row++){
      const lo=base+(top-base)*row/rows,edge=lo+.014,rail=edge+.055;
      lid(rim,edge,'#adb3ae');lid(rim,lo,metal,false);
      for(let j=0;j<3;j++){
        wall(rim[j],rim[j+1],lo,edge,metal);
        wall(rim[j],rim[j+1],edge,rail,balconyGlass);
        wall(rim[j],rim[j+1],rail,rail+.004,metal);
      }
    }
  }

  // Level 28/30/32 plan in fig. 6. The lower plate and its notched northeast
  // corners extend beyond the oval outline carried in the OSM tower part.
  function shaft(base:number,top:number,rows:number,upper:boolean,phase:number){
    const setback=upper?5:0;
    const a:Point=[-19,-13+setback*.22], b:Point=[-19,10];
    const curve=arc(b,[1,18.9],[17.8,7.3],12);
    const plan:Point[]=[a,[-19,-2.8],[-19,.9],b,...curve,[17.8,-6],[17.8,-9.5],
      [17.8,-19.0+setback],[-10,-16.5+setback],[-10,-14+setback*.22],a];
    for(let i=0;i<plan.length-1;i++){
      glazing(plan[i],plan[i+1],base,top,rows,phase+i*3,i>=3&&i<15);
      // Engineering floor plans show a single projecting bay on either end.
      if(i===1||i===16)balconies(plan[i],plan[i+1],base,top,rows);
    }
    lid(plan.slice(0,-1),top,'#aeb2ac');
  }
  const base=building.minH??.6;
  shaft(base,151.4*m,48,false,0);
  shaft(151.4*m,171.2*m,6,true,48);

  // Level 61 terrace, rounded northwest nose, sheared-off southeast end,
  // and the continuation of the curved aluminum grid up the freeway side.
  const crown:Point[]=[[-12,7.6],[-12.8,11.5],...arc([-12.8,11.5],[5,17.0],[17.8,7.4],12),
    [17.8,-8.6],...arc([17.8,-8.6],[-.8,-17.9],[-12.2,-7.8],10),
    ...arc([-12.2,-7.8],[-21,.1],[-12,7.6],10)];
  crown.pop();
  const center:Point=[1,.2],inner=crown.map(p=>interpolate(p,center,.022));
  const roof=180.2*m;
  for(let i=0;i<crown.length;i++){
    const j=(i+1)%crown.length,p=crown[i],q=crown[j];
    const freeway=i>=1&&i<=12,lip=(freeway?184.2:182.7)*m;
    const stripCount=Math.max(1,Math.round(Math.hypot(q[0]-p[0],q[1]-p[1])/1.8));
    for(let k=0;k<stripCount;k++){
      const a=interpolate(p,q,k/stripCount),b=interpolate(p,q,(k+1)/stripCount),seam=interpolate(a,b,.07);
      wall(a,seam,171.2*m,lip,freeway?metal:sill);
      let panelBottom=171.2*m;
      for(let l=0;l<5;l++){
        const y=(173.2+l*1.75)*m;
        wall(seam,b,panelBottom,y,'#8ba4ac');
        wall(seam,b,y,y+.009,'#a0b2b5');
        panelBottom=y+.009;
      }
      wall(seam,b,panelBottom,lip,'#8ba4ac');
    }
    if(i===1)wall(inner[i],p,182.7*m,lip,metal);
    if(i===12)wall(q,inner[j],182.7*m,lip,metal);
    wall(inner[j],inner[i],roof,lip,'#869495');
    lid([p,q,inner[j],inner[i]],lip,metal);
  }
  lid(inner,roof,'#a4aba7');
  // Fig. 5 locates the paired damper cells at the southeast end of level 62.
  // The raised eastern tank roof sits below the parapet and above the deck.
  const tank:Point[]=[[9,-8.8],[9,8.6],[17.2,5.8],[17.2,-6.4]];
  for(let i=0;i<4;i++)wall(tank[i],tank[(i+1)%4],roof,181.5*m,'#9caaac');
  lid(tank,181.5*m,'#acb7b5');
  lid([[9,-.14],[9,.14],[17.2,.14],[17.2,-.14]],181.5*m+.003,metal);

  const geometry=new THREE.BufferGeometry();
  geometry.setIndex(indices);geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.userData.paintVertices=true;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='One Rincon Hill · South Tower';
  root.add(mesh);return true;
}
