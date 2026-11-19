import * as THREE from 'three';
import {footprintGeometry} from './sf-map.ts';

type Plan=number[][];
type Building={id:number;p:Plan};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const ids={hundredOneLand:1279505488,hundredOneTower:436484078,fiftyLand:32612484,fiftyTower:944093113};
const buildingIds=new Set(Object.values(ids));
const height101=600*.3048*.06,height50=148.4*.06;
const atriumTop=1.56;
const litGlass=['#879aa4','#86979c','#9da8a8','#798f9a'];
const inkGlass=['#465861','#46545c','#546269','#536067'];

// Parcel 0263011. The survey parcel sides give the axes of the annex and the California/Davis plaza.
const ux=.89057,uz=.45485;
const fromParcel=(u:number,v:number)=>[-.6179+u*ux-v*uz,-33.2755+u*uz+v*ux];
function parcelPoint(x:number,z:number){return [(x+.6179)*ux+(z+33.2755)*uz,-(x+.6179)*uz+(z+33.2755)*ux];}

const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78});
class Surfaces{
  private p:number[]=[];private c:number[]=[];private t:number[]=[];
  private colors=new Map<string,THREE.Color>();
  private root:THREE.Group;
  constructor(root:THREE.Group){this.root=root;}
  quad(a:number[],b:number[],c:number[],d:number[],color:string){
    let tone=this.colors.get(color);
    if(!tone){tone=new THREE.Color(color);this.colors.set(color,tone);}
    const i=this.p.length/3;
    for(const pt of [a,b,c,d]){this.p.push(...pt);this.c.push(tone.r,tone.g,tone.b);}
    this.t.push(i,i+1,i+2,i,i+2,i+3);
  }
  triangle(a:number[],b:number[],c:number[],color:string){
    let tone=this.colors.get(color);
    if(!tone){tone=new THREE.Color(color);this.colors.set(color,tone);}
    const i=this.p.length/3;
    for(const pt of [a,b,c]){this.p.push(...pt);this.c.push(tone.r,tone.g,tone.b);}
    this.t.push(i,i+1,i+2);
  }
  finish(name:string){
    if(!this.t.length)return;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));
    g.setIndex(this.t);g.computeVertexNormals();const m=new THREE.Mesh(g,paint);m.name=name;this.root.add(m);
  }
}

function slab(root:THREE.Group,plan:Plan,lo:number,hi:number,color:string,name:string){
  const m=new THREE.Mesh(footprintGeometry(plan,hi-lo),new THREE.MeshStandardMaterial({color,roughness:.82}));
  m.position.y=lo;m.name=name;root.add(m);
}
function eachFace(plan:Plan,draw:(wall:ReturnType<typeof face>,index:number)=>void){
  const pts=plan.slice();
  if(pts[0][0]===pts.at(-1)![0]&&pts[0][1]===pts.at(-1)![1])pts.pop();
  if(!THREE.ShapeUtils.isClockWise(pts.map(([x,z])=>new THREE.Vector2(x,z))))pts.reverse();
  pts.forEach((a,i)=>{const f=face(a,pts[(i+1)%pts.length]);if(f.length>.001)draw(f,i);});
}
function face(a:number[],b:number[]){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const nx=-dz/length,nz=dx/length;
  function p(t:number,y:number,lip=0){return [a[0]+dx*t+nx*lip,y,a[1]+dz*t+nz*lip];}
  return {length,nx,nz,p,
    panel(s:Surfaces,left:number,right:number,low:number,high:number,color:string,lip=0){
      s.quad(p(left,low,lip),p(right,low,lip),p(right,high,lip),p(left,high,lip),color);
    },
    fin(s:Surfaces,left:number,right:number,low:number,high:number,color:string,depth:number){
      this.panel(s,left,right,low,high,color,depth);
      s.quad(p(left,low),p(left,low,depth),p(left,high,depth),p(left,high),color);
      s.quad(p(right,low,depth),p(right,low),p(right,high),p(right,high,depth),color);
    },
    window(out:Pane[],u:number,y:number,w:number,h:number){
      const [x,,z]=p(u,y,.008);
      out.push({x,y,z,ry:Math.atan2(nx,nz),w,h});
    },
  };
}

function plaza101(root:THREE.Group){
  // Hines' post-renovation overhead photograph shows four garden compartments cut by
  // the cross paths, an elongated reflecting pool, a pair of lawns and seat walls.
  const ground=(polygon:Plan,low:number,high:number,tone:string,name:string)=>
    slab(root,polygon.map(([u,v])=>fromParcel(u,v)),low,high,tone,name);
  ground([[.08,.08],[4.95,.08],[4.95,4.95],[.08,4.95]],.012,.067,'#cbc7bb','Granite plaza, California and Davis');
  const gardens:Plan[]=[
    [[3.36,4.72],[4.01,4.72],[4.01,4.0],[3.46,3.99]],
    [[4.27,4.72],[4.77,4.72],[4.77,4.0],[4.27,4.0]],
    [[4.27,3.74],[4.77,3.74],[4.77,2.32],[4.38,2.7]],
    [[3.40,3.74],[4.01,3.74],[4.01,3.27],[3.47,3.35]],
  ];
  gardens.forEach((p,i)=>{
    ground(p,.068,.094,'#a29782','Planter seat wall');
    const cx=p.reduce((v,q)=>v+q[0]/p.length,0),cz=p.reduce((v,q)=>v+q[1]/p.length,0);
    ground(p.map(([x,z])=>[cx+(x-cx)*.89,cz+(z-cz)*.89]),.094,.106,i%2?'#748668':'#617d68','Plaza planting');
  });
  ground([[3.88,2.64],[4.01,2.77],[3.62,3.16],[3.49,3.03]],.068,.079,'#637d7e','Linear reflecting pool');
  const timber=new THREE.MeshStandardMaterial({color:'#8e8576',roughness:.9});
  const leaves=['#637e68','#76886a','#718268'].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
  for(const [i,[u,v]] of [[3.49,4.54],[3.8,4.46],[4.65,4.50],[4.7,3.32],[4.53,2.98],[3.74,3.50]].entries()){
    const [x,z]=fromParcel(u,v);
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.012,.017,.20,6),timber);
    stem.position.set(x,.20,z);root.add(stem);
    const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(.129,1),leaves[i%3]);
    crown.scale.set(1.04,1.27,.92);crown.rotation.y=i*.8;crown.position.set(x,.335,z);
    crown.name='Courtyard tree';root.add(crown);
  }
  // Open-sided gridded shade shelters visible in the owner's completed plaza view.
  for(const [u,v] of [[3.60,4.25],[4.62,4.15],[4.51,3.60]]){
    const w=.135;
    for(const du of [-w,w])for(const dv of [-w,w]){
      const [x,z]=fromParcel(u+du,v+dv);
      const post=new THREE.Mesh(new THREE.BoxGeometry(.014,.18,.014),timber);
      post.position.set(x,.187,z);root.add(post);
    }
    for(let j=0;j<7;j++){
      const v0=v-w+j*w*2/7;
      ground([[u-w,v0],[u+w,v0],[u+w,v0+.018],[u-w,v0+.018]],.274,.289,'#92948b','Pergola louver');
    }
  }
  const annex=[[.065,-.045],[5.065,-.045],[.065,4.955]].map(([u,v])=>fromParcel(u,v));
  const well=[[.86,.78],[2.14,.78],[2.14,1.44],[1.12,1.55]].map(([u,v])=>fromParcel(u,v));
  slab(root,annex,.068,atriumTop-.28,'#b3afa2','Seven-story triangular annex');
  const shape=new THREE.Shape(annex.map(([x,z])=>new THREE.Vector2(x,-z)));
  shape.holes.push(new THREE.Path(well.map(([x,z])=>new THREE.Vector2(x,-z))));
  const roofGeometry=new THREE.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:false});
  roofGeometry.rotateX(-Math.PI/2);
  const top=new THREE.Mesh(roofGeometry,new THREE.MeshStandardMaterial({color:'#adafa5',roughness:.87}));
  top.position.y=atriumTop-.28;top.name='Recessed annex roof court';root.add(top);
  slab(root,well,atriumTop-.279,atriumTop-.265,'#788e7a','Annex roof court floor');
  const skin=new Surfaces(root);
  eachFace(annex,f=>{
    const cols=Math.max(1,Math.round(f.length/.225));
    for(let i=0;i<cols;i++)for(let row=0;row<7;row++){
      const y=.08+row*.21;
      f.panel(skin,(i+.13)/cols,(i+.87)/cols,y+.037,y+.173,'#68777a',.004);
    }
  });
  skin.finish('Annex punched windows');
}

function tower101(root:THREE.Group,p:Plan,windows:Pane[]){
  const shaft=new Surfaces(root),lobby=new Surfaces(root);
  const [cx,cz]=fromParcel(1.86,3.07);
  eachFace(p,(f,i)=>{
    const mid=f.p(.5,0),radial=(mid[0]-cx)*f.nx+(mid[2]-cz)*f.nz;
    const glass=radial>1.1,deep=f.length>.48;
    const stone=deep?'#817e78':radial>.73?'#b4a9a2':'#a19994';
    f.panel(shaft,0,1,atriumTop,height101-.085,glass?litGlass[i%4]:stone);
    if(glass){
      for(let row=0;row<41;row++){
        const y=atriumTop+row*(height101-atriumTop)/41;
        f.panel(shaft,0,1,y,y+.019,'#65727a',.0018);
        if((i+row)%11===0&&f.length>.048)f.window(windows,.5,y+.104,f.length*.78,.125);
      }
    }
    f.panel(shaft,0,1,height101-.085,height101,'#9b9b96');
    // The seven-story lobby is recessed behind pale perimeter piers; its glass line
    // continues underneath the overhanging drum instead of filling the open colonnade.
    if(i%4===0)f.fin(lobby,.12,.86,.07,atriumTop,'#c8bba5',.019);

  });
  const inset=p.slice(0,-1).map(([x,z])=>[cx+(x-cx)*.84,cz+(z-cz)*.84]);
  const diagonal=(pt:number[])=>{const [u,v]=parcelPoint(pt[0],pt[1]);return u+v;};
  // Clip the inclined glass enclosure at the surveyed drum. Its lower end faces the plaza.
  function clip(plan:Plan,cut:number,below:boolean){
    const out:Plan=[];
    for(let i=0;i<plan.length;i++){
      const a=plan[i],b=plan[(i+1)%plan.length],s=diagonal(a)-cut,t=diagonal(b)-cut;
      if(below?s<=0:s>=0)out.push(a);
      if(s*t<0){const u=s/(s-t);out.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]);}
    }
    return out;
  }
  const lowCut=4.95,highCut=6.25;
  const glassTop=(pt:number[])=>THREE.MathUtils.clamp(atriumTop-(diagonal(pt)-lowCut)*.83,.47,atriumTop);
  const envelope=clip(inset,highCut,true);
  eachFace(envelope,f=>{
    const a=f.p(0,0),b=f.p(1,0),ay=glassTop([a[0],a[2]]),by=glassTop([b[0],b[2]]);
    lobby.quad(f.p(0,.066),f.p(1,.066),f.p(1,by),f.p(0,ay),'#607a7f');
    for(let row=1;row<12;row++){
      const t=row/12;
      lobby.quad(f.p(0,ay*t,.003),f.p(1,by*t,.003),f.p(1,by*t+.011,.003),f.p(0,ay*t+.011,.003),'#a4b0a9');
    }
  });
  const slope=new Surfaces(root);
  function glazedStrip(start:number,end:number,tone:string,lift:number){
    const band=clip(clip(envelope,start,false),end,true);
    if(band.length<3)return;
    const tris=THREE.ShapeUtils.triangulateShape(band.map(([x,z])=>new THREE.Vector2(x,z)),[]);
    const at=(i:number)=>[band[i][0],glassTop(band[i])+lift,band[i][1]];
    for(const [a,b,c] of tris)slope.triangle(at(c),at(b),at(a),tone);
  }
  glazedStrip(lowCut,highCut,'#87a2a8',0);
  for(let k=0;k<13;k++)glazedStrip(lowCut+k*.1,lowCut+k*.1+.012,'#bdc6bd',.003);
  slope.finish('Inclined atrium glazing and transoms');
  shaft.finish('Serrated granite and glass drum');lobby.finish('Recessed seven-story atrium and piers');
  slab(root,p,atriumTop-.033,atriumTop,'#a99e8d','Cantilever soffit');
  // The drum's granite panels already enclose the perimeter up to the roof.
  const roofPlan=new THREE.Shape(p.map(([x,z])=>new THREE.Vector2(x,-z)));
  const roof=new THREE.Mesh(new THREE.ShapeGeometry(roofPlan).rotateX(-Math.PI/2),
    new THREE.MeshStandardMaterial({color:'#a3a29a',roughness:.82}));
  roof.position.y=height101;roof.name='Faceted flat roof';root.add(roof);
}

function tower50(root:THREE.Group,plan:Plan,windows:Pane[]){
  // Leasing floor plates and the Shorenstein exterior show four continuous sides:
  // the extra surveyed points on the long side are collinear, not facade breaks.
  const p=[plan[0],plan[1],plan[2],plan[3]];
  const curtain=new Surfaces(root),ribs=new Surfaces(root);
  eachFace(p,(f,side)=>{
    const count=Math.round(f.length/.092);
    f.panel(curtain,0,1,.21,height50-.32,'#424c52');
    for(let col=0;col<count;col++){
      for(let floor=0;floor<36;floor++){
        const pitch=(height50-.54)/36,y=.21+floor*pitch;
        const left=(col+.13)/count,right=(col+.87)/count;
        f.panel(curtain,left,right,y+.032,y+pitch*.83,inkGlass[(col+floor*3+side)%4],.002);
        if((col*3+floor*7)%29===0)f.window(windows,(col+.5)/count,y+pitch*.48,(right-left)*f.length,pitch*.61);
      }
      f.fin(ribs,col/count,(col+.21)/count,.21,height50-.3,'#bdafa1',.024);
    }
    f.panel(ribs,0,1,height50-.33,height50,'#b7aea3',.022);
  });
  curtain.finish('36 floors of gray glazing and dark spandrels');ribs.finish('Continuous precast fins and crown');
  slab(root,p,height50-.05,height50,'#939893','Flat roof and parapet');
}

export function addFinancialDistrictBuilding(b:Building,root:THREE.Group,windows:Pane[]){
  if(!buildingIds.has(b.id))return false;
  const group=new THREE.Group();root.add(group);
  switch(b.id){
    case ids.hundredOneLand:group.name='101 California plaza and annex';plaza101(group);break;
    case ids.hundredOneTower:group.name='101 California';tower101(group,b.p,windows);break;
    case ids.fiftyLand:group.name='50 California plinth';slab(group,b.p,.02,.21,'#acaaa1','Street-level podium');break;
    case ids.fiftyTower:group.name='50 California';tower50(group,b.p,windows);break;
  }
  return true;
}
