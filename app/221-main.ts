import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Plan = [number,number];
type NightWindow = {x:number;y:number;z:number;ry:number;w:number;h:number};
const angle=-Math.atan2(.279,1.917),cos=Math.cos(angle),sin=Math.sin(angle);
const local=([x,z]:number[]):Plan=>[(x+32)*cos+(z+15)*sin,-(x+32)*sin+(z+15)*cos];
const world=(u:number,v:number):Plan=>[-32+cos*u-sin*v,-15+sin*u+cos*v];
const stone='#c5bfb1',light='#d9d2c4',shadow='#a9a394',metal='#575c5c';
const shades=['#637074','#616e71','#728081','#677476','#565f62'];
const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8});
const grade=.035,groundFloor=grade+.272,terrace=grade+14.70*.06;
const deck=grade+66.12*.06,rim=grade+68.04*.06;
const rectangle=(x:number,z:number,w:number,d:number):Plan[]=>[[x,z],[x+w,z],[x+w,z+d],[x,z+d]];
const outward=(a:Plan,b:Plan):Plan=>{
  const du=b[0]-a[0],dv=b[1]-a[1],length=Math.hypot(du,dv);
  return [dv/length,-du/length];
};
// Miter the reveals around re-entrant corners; ribbon glazing turns the corner
// continuously behind the concrete slab ends.
function inset(ring:Plan[],distance:number):Plan[]{
  return ring.map((p,i)=>{
    const a=outward(ring[(i+ring.length-1)%ring.length],p),b=outward(p,ring[(i+1)%ring.length]);
    const scale=distance/(1+a[0]*b[0]+a[1]*b[1]);
    return [p[0]-(a[0]+b[0])*scale,p[1]-(a[1]+b[1])*scale];
  });
}

export function add221Main(building:{id:number;p:number[][]},root:THREE.Group,windows:NightWindow[],font?:Font){
  if(building.id!==288714525)return false;
  // SF Planning DPR 3740034 and Columbia's exterior photographs establish
  // the projecting pavilion, chamfered arcade columns and post-free corners.
  // The 2024 8-cm ortho and USGS 2023 surface separate the terrace from the
  // main roof and central equipment enclosure. V increases towards Spear.
  const p=building.p.slice(0,-1).map(local);
  const step:Plan[]=[[-1.006,-.305],[-.653,-.305],[-.653,-.694],[1.245,-.694]];
  const tower=[...p.slice(0,6),...step,...p.slice(11)];
  const podium=[...p.slice(5,11),...step.slice().reverse()];
  const group=new THREE.Group();group.name='221 Main Street';group.position.set(-32,0,-15);group.rotation.y=-angle;root.add(group);
  let panels=new FacadePanels();
  function finish(name:string){
    const mesh=panels.mesh(paint);mesh.name=name;group.add(mesh);panels=new FacadePanels();
  }
  function cap(ring:Plan[],height:number,tint:string,underside=false){
    const triangles=THREE.ShapeUtils.triangulateShape(ring.map(([u,v])=>new THREE.Vector2(u,v)),[]);
    const point=(i:number):FacadePoint=>[ring[i][0],height,ring[i][1]];
    for(const [a,b,c] of triangles)panels.triangle(point(a),point(underside?b:c),point(underside?c:b),tint);
  }
  function extrusion(ring:Plan[],low:number,high:number,wall:string,roof=wall){
    ring.forEach(([u,v],i)=>{
      const [x,z]=ring[(i+1)%ring.length];
      panels.quad([u,low,v],[u,high,v],[x,high,z],[x,low,z],wall);
    });
    cap(ring,high,roof);
  }
  function block(u:number,v:number,w:number,d:number,low:number,high:number,tint:string,roof=tint){
    extrusion(rectangle(u,v,w,d),low,high,tint,roof);
  }
  function ringFloor(ring:Plan[],opening:Plan[],y:number,top:boolean,tint:string){
    for(let i=0;i<ring.length;i++){
      const j=(i+1)%ring.length;
      const at=(p:Plan):FacadePoint=>[p[0],y,p[1]];
      if(top)panels.quad(at(ring[i]),at(opening[i]),at(opening[j]),at(ring[j]),tint);
      else panels.quad(at(ring[i]),at(ring[j]),at(opening[j]),at(opening[i]),tint);
    }
  }
  function facade(ring:Plan[],low:number,high:number,rows:number,isTower:boolean){
    const glass=inset(ring,.022),pitch=(high-low)/rows;
    for(let row=0;row<rows;row++){
      const y=low+row*pitch,sill=y+pitch*.28,head=y+pitch*.88;
      ringFloor(ring,glass,sill,true,light);ringFloor(ring,glass,head,false,shadow);
      for(let i=0;i<ring.length;i++){
        const j=(i+1)%ring.length,a=ring[i],b=ring[j],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
        // The pavilion joins the tower along the same stepped wall below its terrace.
        if(!isTower&&i>=6)continue;
        if(isTower&&y<terrace-.001&&i>=5&&i<=8)continue;
        const normal=outward(a,b);
        const point=(edge:Plan[],t:number,h:number):FacadePoint=>[
          edge[i][0]+(edge[j][0]-edge[i][0])*t,h,edge[i][1]+(edge[j][1]-edge[i][1])*t];
        const panel=(edge:Plan[],l:number,r:number,h0:number,h1:number,tone:string)=>
          panels.quad(point(edge,l,h0),point(edge,l,h1),point(edge,r,h1),point(edge,r,h0),tone);
        panel(ring,0,1,y,sill,stone);panel(ring,0,1,head,y+pitch,row===rows-1?light:stone);
        const count=Math.max(1,Math.round(len/.095)),bays=Math.round(len/.50);
        for(let pane=0;pane<count;pane++){
          const l=pane/count,r=(pane+1)/count,mull=.003/len;
          panel(glass,l,r-mull,sill,head,shades[(Math.floor(pane/3)+Math.floor(row/5)+i)%shades.length]);
          panel(glass,r-mull,r,sill,head,metal);
          const mid=(l+r)/2;
          const pierGap=bays?Math.abs(mid*bays-(Math.floor(mid*bays)+.5))*len/bays:Infinity;
          if((row*7+pane*3+i)%17===0&&(!isTower||len<=1.2||pierGap>.027+len/count*.5+.022)){
            const [u,h,v]=point(glass,(l+r)/2,(sill+head)/2);
            const [x,z]=world(u+normal[0]*.0015,v+normal[1]*.0015);
            windows.push({x,y:h,z,ry:Math.atan2(cos*normal[0]-sin*normal[1],sin*normal[0]+cos*normal[1]),w:len/count*.86,h:(head-sill)*.88});
          }
        }
        // Slim intermediate mullions and much deeper full-story concrete piers
        // have separate rhythms. At each projecting end the glass wraps freely.
        if(isTower&&len>1.2){
          for(let n=0;n<bays;n++){
            const t=(n+.5)/bays,w=.027/len;
            panel(ring,t-w,t+w,sill,head,stone);
            for(const side of [-1,1]){
              const line=t+side*w,front=side<0?glass:ring,back=side<0?ring:glass;
              panels.quad(point(front,line,sill),point(front,line,head),point(back,line,head),point(back,line,sill),shadow);
            }
          }
        }
      }
    }
  }

  // The three-story, cantilevered Main Street pavilion encloses a recessed lobby.
  const lobby=inset(podium,.125);
  extrusion(lobby,grade,groundFloor,'#536467');
  ringFloor(podium,lobby,groundFloor,false,'#beb7a8');
  for(const u of [-1.03,-.35,.34,1.05]){
    const v=-1.685,r=.051,k=r*.55;
    const column:Plan[]=[[-k,-r],[k,-r],[r,-k],[r,k],[k,r],[-k,r],[-r,k],[-r,-k]];
    extrusion(column.map(([x,z])=>[x+u,z+v]),grade,groundFloor,'#b8b1a1');
  }
  facade(podium,groundFloor,terrace,2,false);
  cap(podium,terrace,'#c9bfab');
  finish('Main Street pavilion and sheltered arcade');

  // The Main and Spear ends of the upper tower have a narrower central wing.
  facade(tower,grade,terrace,3,true);facade(tower,terrace,deck,13,true);
  cap(tower,deck,'#cfcec2');
  const inner=inset(tower,.026);
  for(let i=0;i<tower.length;i++){
    const j=(i+1)%tower.length,a=tower[i],b=tower[j],c=inner[i],d=inner[j];
    panels.quad([a[0],deck,a[1]],[a[0],rim,a[1]],[b[0],rim,b[1]],[b[0],deck,b[1]],light);
    panels.quad([d[0],deck,d[1]],[d[0],rim,d[1]],[c[0],rim,c[1]],[c[0],deck,c[1]],shadow);
  }
  ringFloor(tower,inner,rim,true,light);
  finish('Sixteen floors of concrete and ribbon windows');

  // Paired roof fans are visible inside the east equipment well. A smaller
  // bank sits beside the west service run. Heights are sampled at each roof.
  const plant=grade+70.98*.06;
  block(-.48,.29,1.64,1.11,deck,plant,'#a4a394','#bdbdae');
  block(-.43,.36,.55,.32,plant,plant+.06,'#93968c','#babbb1');
  block(.70,.34,.43,.46,plant,plant+.027,'#90948b','#7c857e');
  function fan(u:number,v:number,y:number,r:number){
    const disc:Plan[]=Array.from({length:12},(_,i)=>[u+r*Math.cos(i*Math.PI/6),v+r*Math.sin(i*Math.PI/6)]);
    extrusion(disc,y,y+.018,'#979b90','#656e6a');
    for(let k=0;k<5;k++){
      const a=k*2*Math.PI/5,p=(radius:number,t:number):FacadePoint=>[u+radius*Math.cos(t),y+.019,v+radius*Math.sin(t)];
      panels.triangle(p(r*.13,a),p(r*.74,a+.8),p(r*.83,a+.12),'#a3a89a');
    }
  }
  for(const u of [.793,1.015])fan(u,.56,plant+.027,.084);
  block(-.80,.41,.21,.86,deck,deck+.104,'#97998e','#b0afa2');
  block(-.78,1.38,.32,.19,deck,deck+.201,'#97998e','#aaa99e');
  for(const u of [-.70,-.54])fan(u,1.47,deck+.201,.065);
  finish('Roof plant and paired fan wells');

  // Two diagonal paths frame the central seating court in the ortho. Retain
  // the small planted rooms and the low open canopy at the north edge.
  const planting:Plan[][]=[
    [[-1.19,-1.55],[-.55,-1.55],[-.55,-1.11],[-1.19,-1.11]],
    [[-.49,-1.56],[-.36,-1.56],[-.36,-1.09],[-.49,-1.02]],
    [[-1.22,-1.08],[-.39,-1.08],[-.39,-1.01],[-1.22,-.76]],
    [[-1.12,-.71],[-.39,-.94],[-.39,-.75],[-1.10,-.65]],
    [[.21,-1.03],[.80,-.84],[.80,-.77],[.21,-.95]],
    [[.50,-1.55],[.78,-1.55],[.78,-1.05],[.50,-1.13]]];
  for(const [i,bed] of planting.entries())extrusion(bed,terrace,terrace+.028,'#9a967e',i===0?'#80905c':'#657858');
  for(const u of [-.27,-.02,.26]){
    for(const v of [-1.42,-1.18]){
      block(u-.029,v-.029,.058,.058,terrace,terrace+.043,'#99957f','#b8ae96');
      for(const side of [-1,1])block(u+side*.054-.017,v-.020,.034,.04,terrace,terrace+.027,'#8a7560');
    }
  }
  for(const u of [.58,.84])for(const v of [-1.54,-.98])
    block(u-.009,v-.009,.018,.018,terrace,terrace+.196,metal);
  for(let k=0;k<11;k++)block(.55,-1.58+k*.063,.32,.024,terrace+.191,terrace+.206,'#9d9582');
  // 221's blue-green media entrance occupies the north bay on Main Street.
  block(.60,-1.829,.49,.02,groundFloor-.026,groundFloor+.067,'#749da4','#bbc7be');
  if(font){
    const geometry=new THREE.ShapeGeometry(font.generateShapes('221',.052),3);
    geometry.center();const label=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#283e45'}));
    label.name='221 entrance numerals';label.rotation.y=Math.PI;label.position.set(.845,groundFloor+.018,-1.831);group.add(label);
  }
  finish('Fourth-floor terrace and media entrance');
  return true;
}
