import * as THREE from 'three';

type Building={id:number;p:number[][]};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
type Plan=[number,number];
type Vertex=[number,number,number];
const finish=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86});

// East elevation, including the narrow left entrance, photographed in 2006 and 2022.
// https://www.starbuckseverywhere.net/bigimages/12/DSCN12078.htm
// https://www.flickr.com/photos/sftrajan/51897256015/
// USGS San Francisco 2023 3DEP, 1.5 m DSM. Front edge 17.2–17.5 m;
// setback front 20.3 m, middle 18.9–19.1 m, rear roof 16.5–16.6 m.
// Roof outlines interpolate the sampled changes in height.
export function addDrummFrontage(b:Building,root:THREE.Group,windows:Pane[]){
  if(b.id!==260288456)return false;
  const [x0,z0]=b.p[0],dx=b.p[7][0]-x0,dz=b.p[7][1]-z0;
  const width=Math.hypot(dx,dz),c=dx/width,s=dz/width;
  const plan:Plan[]=b.p.slice(0,-1).map(([x,z])=>[(x-x0)*c+(z-z0)*s,-(x-x0)*s+(z-z0)*c]);
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const palette=new Map<string,THREE.Color>();
  function vertices(points:Vertex[],tone:string){
    let paint=palette.get(tone);
    if(!paint){paint=new THREE.Color(tone);palette.set(tone,paint);}
    const start=positions.length/3;
    for(const [x,y,z] of points){
      positions.push(x0+x*c-z*s,y,z0+x*s+z*c);
      colors.push(paint.r,paint.g,paint.b);
    }
    return start;
  }
  function quad(a:Vertex,b:Vertex,d:Vertex,e:Vertex,tone:string){
    const i=vertices([a,b,d,e],tone);indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  function face(l:number,r:number,lo:number,hi:number,z:number,tone:string){
    quad([l,lo,z],[r,lo,z],[r,hi,z],[l,hi,z],tone);
  }
  function relief(l:number,r:number,lo:number,hi:number,back:number,front:number,tone:string){
    face(l,r,lo,hi,front,tone);
    quad([l,hi,front],[r,hi,front],[r,hi,back],[l,hi,back],tone);
    quad([r,lo,front],[l,lo,front],[l,lo,back],[r,lo,back],tone);
    quad([l,lo,back],[l,lo,front],[l,hi,front],[l,hi,back],tone);
    quad([r,lo,front],[r,lo,back],[r,hi,back],[r,hi,front],tone);
  }
  function roof(ring:Plan[],base:number,top:number,wall:string,cover:string){
    // Clockwise viewed in x/z gives upward-facing triangles on the roof.
    const i=vertices(ring.map(([x,z])=>[x,top,z]),cover);
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(ring.map(([x,z])=>new THREE.Vector2(x,z)),[]))indices.push(i+c,i+b,i+a);
    const ccw=THREE.ShapeUtils.area(ring.map(([x,z])=>new THREE.Vector2(x,z)))>0;
    for(let k=0;k<ring.length;k++){
      const j=(k+1)%ring.length,[a,b]=ccw?[ring[j],ring[k]]:[ring[k],ring[j]];
      quad([a[0],base,a[1]],[b[0],base,b[1]],[b[0],top,b[1]],[a[0],top,a[1]],wall);
    }
  }
  const brick='#dbd1bb',cream='#e2d9c8',shade='#c7baa3',green='#34554f';
  const back=plan.map(([x,z],i):Plan=>[x,i===0||i===7?-.115:z]);
  roof(back,.025,.995,'#c9bfae','#b9b8b6');
  roof([[.018,-.54],[.085,-.2],[.26,-.14],[width-.042,-.15],[width-.014,-.62],[width-.014,-1.76],[.04,-1.26]],.995,1.139,'#bdbbb3','#b4b4b1');
  roof([[.085,-.2],[.26,-.14],[width-.042,-.15],[width-.044,-.65],[.14,-.55]],1.139,1.219,'#c4c2ba','#bcbdb8');
  // Low parapets border the service roof and follow the stepped party line.
  for(let k=0;k<7;k++){
    const [a,b]=[plan[k],plan[k+1]],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    const ix=-dz/len*.012,iz=dx/len*.012;
    roof([a,b,[b[0]+ix,b[1]+iz],[a[0]+ix,a[1]+iz]],.994,1.030,shade,cream);
  }

  // Viewed from Drumm, x increases from the separate fire-escape building to
  // the adjoining white gable. Storefront glass sits forward of the deep entry.
  const left=width*.082,divider=width*.308,right=width*.965,doorBack=-.090,shopBack=-.027,head=.317;
  const jambs=[[0,left],[divider-.012,divider],[right,width]];
  for(const [l,r] of jambs){
    relief(l,r,.025,head,-.115,0,cream);
    for(let y=.065;y<head;y+=.037)face(l,r,y,y+.002, .0008,shade);
  }
  relief(0,width,head,.407,-.115,0,cream);
  for(let i=0;i<10;i++){
    const x=width*(i+.5)/10,offset=(x/width-.5)*.075;
    quad([x-.001,head,.001],[x+.001,head,.001],[x+offset+.001,.403,.001],[x+offset-.001,.403,.001],shade);
  }
  face(left,divider-.012,.025,head,doorBack,shade);
  relief(left+.018,divider-.030,.025,.176,doorBack,doorBack+.003,'#3d4341');
  quad([left,.025,doorBack],[left,.025,0],[divider-.012,.025,0],[divider-.012,.025,doorBack],shade);
  face(divider,right,.025,head,shopBack,'#455852');
  for(const f of [0,.333,.667,.984]){
    const x=divider+(right-divider)*f;
    relief(x,x+.004,.025,head,shopBack,shopBack+.005,green);
  }
  relief(divider,right,.204,.227,shopBack,shopBack+.005,green);
  relief(0,width,.403,.424,-.11,.020,shade);
  relief(0,width,.419,.438,-.11,.027,cream);

  const margin=width*.048,step=(width-2*margin)/4;
  relief(0,width,.438,.463,-.11,.002,brick);
  for(const [lo,hi] of [[.463,.648],[.725,.91]]){
    for(let i=0;i<4;i++){
      const x=margin+(i+.5)*step,l=x-step*.435,r=x+step*.435;
      relief(i===0?0:margin+i*step,l,lo,hi,-.11,.004,brick);
      relief(r,i===3?width:margin+(i+1)*step,lo,hi,-.11,.004,brick);
      face(l,r,lo,hi,-.017,i%2===0?'#506560':'#556b67');
      for(const [a,b] of [[l,l+.004],[r-.004,r]])face(a,b,lo,hi,-.015,green);
      relief(l,r,hi-.056,hi-.050,-.017,-.012,green);
      relief(l-.003,r+.003,lo-.003,lo+.002,-.017,.011,cream);
      windows.push({x:x0+x*c+.014*s,y:lo+.067,z:z0+x*s-.014*c,ry:Math.atan2(-s,c),w:(r-l)*.86,h:.117});
    }
  }
  relief(0,width,.648,.725,-.11,.002,cream);
  for(let i=0;i<4;i++){
    const x=margin+(i+.5)*step;
    relief(x-step*.44,x+step*.44,.657,.711,.002,.009,shade);
    relief(x-step*.414,x+step*.414,.663,.706,.009,.012,cream);
  }
  for(let i=1;i<4;i++){
    const x=margin+i*step;
    quad([x-.007,.463,.007],[x+.007,.463,.007],[x+.010,.907,.007],[x-.010,.907,.007],cream);
    for(const y of [.642,.704])relief(x-.012,x+.012,y,y+.014,.007,.017,cream);
  }
  relief(0,width,.910,1.021,-.115,.004,brick);
  for(let y=.917;y<1.004;y+=.009)face(.003,width-.003,y,y+.001,.005,'#cfc5b0');
  for(let i=0;i<46;i++){
    const x=width*(i+.5)/46;
    relief(x-.003,x+.003,1.002,1.015,.004,.018,shade);
  }
  relief(0,width,1.015,1.029,-.09,.024,cream);
  relief(-.004,width+.004,1.029,1.044,-.09,.034,brick);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,finish);mesh.name='25–27 Drumm Street';root.add(mesh);
  return true;
}
