import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {FacadePanels, type FacadePoint} from './facade-panels.ts';
import {addMuseumGallery} from './museum-gallery.ts';
import {addHotelTerraces,addMuseumWalk} from './hotel-terraces.ts';

type Building={id:number;p:number[][];h:number;minH?:number;parent?:number};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const podium=193054134;
const floor=.068;
const streetDatum=.046;
const b23=new Map([
  [podium,10.75],[1487225647,16.57],[1487225648,19.43],[1487225649,22.35],
  [1487225650,28.42],[1487225651,25.33],[1487225652,22.64],
]);
// The low sustained roof return in each OSM part. Street returns around the
// perimeter have a median elevation of 3.30 m in the same USGS datum.
export const hotelRoofHeight=(id:number)=>(b23.get(id)!-3.30)*.06+streetDatum;
const eave=hotelRoofHeight;
const hotel=(b:Building)=>b23.has(b.id);
const surface=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.88});
const brick='#966a57',shadowBrick='#845d50',stone='#c9c2ad',iron='#3e4b49',wine='#a43e45';

const museumBrick='#a29187',steuartBrick='#795b4f';
const bondPigments=new Set([brick,shadowBrick,museumBrick,steuartBrick]);

// Real hotel masonry is physically modeled around the glazing. Only its wall
// quads need a bond pattern; the shared facade shader must leave all other
// materials and the separate night window instances alone.
class HotelPanels extends FacadePanels {
  private brickQuads:number[]=[];
  override quad(a:FacadePoint,b:FacadePoint,c:FacadePoint,d:FacadePoint,tint:string){
    if(bondPigments.has(tint))this.brickQuads.push(this.positions.length/3);
    super.quad(a,b,c,d,tint);
  }
  override mesh(material:THREE.MeshStandardMaterial){
    const mesh=super.mesh(material);
    if(!this.brickQuads.length)return mesh;
    const g=mesh.geometry,pos=g.attributes.position,norm=g.attributes.normal;
    const grid=new Float32Array(pos.count*4);
    for(let k=0;k<pos.count;k++)grid[k*4+2]=-1;
    // Common vertical datum aligns courses across adjacent panels and floors.
    for(const k of this.brickQuads){
      const nx=norm.getX(k),nz=norm.getZ(k),length=Math.hypot(nx,nz);
      if(length<.8)continue;
      for(let j=k;j<k+4;j++){
        const u=((pos.getX(j)+8.611)*nz-(pos.getZ(j)+7.807)*nx)/length;
        grid.set([u/.0135,(pos.getY(j)-floor)/.00435,-2,0],j*4);
      }
    }
    g.setAttribute('facadeGrid',new THREE.BufferAttribute(grid,4));
    return mesh;
  }
}

function elevation(panels:FacadePanels,a:number[],b:number[],nx:number,nz:number){
  const w=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const start=(b[0]-a[0])*nz-(b[1]-a[1])*nx>0?a:b;
  const at=(x:number,y:number,d=0):FacadePoint=>[start[0]+nz*x+nx*d,y,start[1]-nx*x+nz*d];
  function face(l:number,r:number,lo:number,hi:number,d:number,tint:string){
    panels.quad(at(l,lo,d),at(r,lo,d),at(r,hi,d),at(l,hi,d),tint);
  }
  function relief(l:number,r:number,lo:number,hi:number,back:number,front:number,tint:string){
    face(l,r,lo,hi,front,tint);
    panels.quad(at(l,hi,front),at(r,hi,front),at(r,hi,back),at(l,hi,back),tint);
    panels.quad(at(l,lo,back),at(r,lo,back),at(r,lo,front),at(l,lo,front),tint);
    panels.quad(at(l,lo,back),at(l,lo,front),at(l,hi,front),at(l,hi,back),tint);
    panels.quad(at(r,lo,front),at(r,lo,back),at(r,hi,back),at(r,hi,front),tint);
  }
  return {w,at,face,relief,nx,nz};
}
type Wall=ReturnType<typeof elevation>;

// The north and west elevations are deliberately open at the storefront.
// Each arch has a soffit and returns, with glazing recessed behind the masonry.
function groundArc(p:FacadePanels,f:Wall,l:number,r:number,spring:number,rise:number,recess:number,finish=brick,glazedBacking=true){
  const {at,face}=f;
  const top=(i:number)=>spring+rise*Math.sin(Math.PI*i/12);
  for(let i=0;i<12;i++){
    const x=l+(r-l)*i/12,next=l+(r-l)*(i+1)/12,h=top(i),k=top(i+1);
    p.quad(at(x,h),at(next,k),at(next,eave(podium)),at(x,eave(podium)),finish);
    p.quad(at(x,h,recess),at(next,k,recess),at(next,k),at(x,h),shadowBrick);
    p.quad(at(x,spring-.001,recess),at(next,spring-.001,recess),at(next,k,recess),at(x,h,recess),'#4c6264');
  }
  p.quad(at(l,floor,0),at(l,floor,recess),at(l,spring,recess),at(l,spring,0),shadowBrick);
  p.quad(at(r,floor,recess),at(r,floor,0),at(r,spring,0),at(r,spring,recess),shadowBrick);
  p.quad(at(l,floor,0),at(r,floor,0),at(r,floor,recess),at(l,floor,recess),stone);
  if(glazedBacking)face(l,r,floor,spring,recess,'#344b4d');
}

function museum(p:FacadePanels,f:Wall,north:boolean,root:THREE.Group,font:Font){
  const {at,face,relief,w}=f,roof=eave(podium);
  const wallBrick=north?museumBrick:steuartBrick;
  function pier(l:number,r:number){
    face(l,r,0,roof,0,wallBrick);
    for(let course=0;course<3;course++){
      const y=floor+course*.016;
      for(let edge=l-(course%2)*.028;edge<r;edge+=.056){
        const a=Math.max(l,edge),b=Math.min(r,edge+.0554);
        if(b>a)relief(a,b,y,y+.015,0,.003+(course%2)*.0008,course===1?'#bcb6a2':stone);
      }
    }
  }
  function lettering(word:string,height:number,width:number,x:number,y:number,z:number,parent:THREE.Object3D,angle=0){
    const geo=new THREE.ShapeGeometry(font.generateShapes(word,height),2);
    geo.computeBoundingBox();const bounds=geo.boundingBox!;
    geo.translate(-(bounds.min.x+bounds.max.x)/2,-(bounds.min.y+bounds.max.y)/2,0);
    geo.scale(width/(bounds.max.x-bounds.min.x),1,1);
    const ink=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#f0e4cb',roughness:.95}));
    ink.name='Museum lettering';ink.position.set(x,y,z);ink.rotation.z=angle;parent.add(ink);
  }
  if(!north){
    let prev=0;
    for(let i=0;i<3;i++){
      const l=w*(.10+i*.315),r=l+w*.205;
      pier(prev,l);groundArc(p,f,l,r,.208,.031,-.017,wallBrick,false);
      relief((l+r)/2-.0018,(l+r)/2+.0018,floor,.230,-.017,-.014,iron);
      relief(l,r,.174,.178,-.017,-.014,iron);
      relief(l,r,floor,floor+.018,-.018,-.014,iron);
      for(const x of [l+.002,r-.002])relief(x-.002,x+.002,floor+.016,.208,-.018,-.014,iron);
      prev=r;
    }
    pier(prev,w);
    // The blade is mounted to the Steuart wall just beyond the corner.
    const blade=new THREE.Group();blade.name='Railway museum blade on Steuart';root.add(blade);
    blade.position.set(...at(.060,0,.051));blade.rotation.y=Math.atan2(f.nx,f.nz)-Math.PI/2;
    for(const h of [.262,.478])relief(.055,.061,h,h+.005,.001,.086,iron);
    const fabric=new THREE.Mesh(new THREE.BoxGeometry(.062,.203,.003),
      new THREE.MeshStandardMaterial({color:wine,roughness:.96}));
    fabric.position.y=.369;blade.add(fabric);
    for(const side of [-1,1]){
      const sideFrame=new THREE.Group();sideFrame.rotation.y=side===1?0:Math.PI;blade.add(sideFrame);
      lettering('museum',.029,.137,0,.391,.0024,sideFrame,Math.PI/2);
      // Small frontal streetcar badge beneath the wordmark, as photographed.
      const badge=new FacadePanels(),z=.0026;
      const panel=(l:number,r:number,lo:number,hi:number,depth:number,ink:string)=>
        badge.quad([l,lo,depth],[r,lo,depth],[r,hi,depth],[l,hi,depth],ink);
      panel(-.011,.011,.277,.301,z,'#d9b86d');
      panel(-.011,.011,.293,.301,z+.0001,'#334b53');
      badge.triangle([-.011,.301,z],[.011,.301,z],[0,.305,z],'#334b53');
      for(const x of [-.0053,.0053])panel(x-.0034,x+.0034,.295,.300,z+.0002,'#a5beb6');
      panel(-.011,.011,.279,.282,z+.0001,'#ece1bc');
      sideFrame.add(badge.mesh(surface));
    }
    return;
  }
  // Aerial red canopy centre, 3.3 m from the Steuart corner, along Don Chee.
  const mid=w-.198,l=mid-.084,r=mid+.084;
  pier(0,l);groundArc(p,f,l,r,.199,.025,-.021,wallBrick,false);pier(r,w);
  const trim='#394746',door=-.017;
  // Glazed double leaves with low solid kick plates and the aluminum
  // meeting stiles and pulls visible under the canopy in the operator photo.
  for(const [a,b] of [[l+.006,mid-.002],[mid+.002,r-.006]]){
    // A narrow sky glint on each top rail leaves the exhibit visible through the door.
    face(a,b,.175,.179,door,'#8b9c98');
    relief(a,b,floor+.002,floor+.018,door,door+.002,'#636a66');
    relief(a,b,.126,.1285,door,door+.0015,'#b0afa0');
  }
  for(const x of [l+.006,mid,r-.006])relief(x-.002,x+.002,floor,.193,door,door+.003,trim);
  relief(l,r,.179,.185,door,door+.003,trim);
  for(const x of [mid-.011,mid+.011])relief(x-.0014,x+.0014,.091,.118,door+.002,door+.005,'#bead8c');
  relief(w*.330,w*.411,floor,.168,.001,.004,'#515451');
  face(w*.352,w*.382,.103,.107,.005,'#b8baa9');
  relief(r+.014,r+.045,.138,.20,.001,.003,'#646f60');
  // Shield and ivory lettering on the photographed wall plaque.
  const cx=r+.0295;
  const badge=(half:number,lo:number,hi:number,depth:number,color:string)=>{
    face(cx-half,cx+half,lo,hi,depth,color);
    p.triangle(at(cx-half,lo,depth),at(cx,lo-half*.83,depth),at(cx+half,lo,depth),color);
  };
  badge(.009,.176,.194,.0036,'#c0c2ad');
  badge(.0073,.177,.192,.0040,wine);
  face(cx-.0047,cx+.0047,.183,.188,.0043,'#adc6ba');
  for(const [y,half] of [[.162,.010],[.158,.007],[.147,.004]])face(cx-half,cx+half,y,y+.0013,.0037,'#c9d1c3');
  // The operator's exterior photograph shows a barrel running out from
  // the wall, with the museum wordmark across its arched street-facing end.
  const half=.099,back=.002,reach=.077,hem=.205;
  const fabricSide='#92383e';
  for(let i=0;i<16;i++){
    const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
    const l=mid-half*Math.cos(a),r=mid-half*Math.cos(b);
    const ya=hem+.043*Math.sin(a),yb=hem+.043*Math.sin(b);
    p.quad(at(l,ya,back),at(l,ya,reach),at(r,yb,reach),at(r,yb,back),wine);
    p.quad(at(l,hem-.019,reach),at(r,hem-.019,reach),at(r,yb,reach),at(l,ya,reach),wine);
  }
  for(const side of [-1,1]){
    const x=mid+side*half;
    const a=at(x,hem-.019,back),b=at(x,hem-.019,reach),c=at(x,hem,reach),d=at(x,hem,back);
    if(side>0)p.quad(b,a,d,c,fabricSide);else p.quad(a,b,c,d,fabricSide);
  }
  const fascia=new THREE.Group();fascia.name='Don Chee Way museum awning';root.add(fascia);
  fascia.position.set(...at(mid,hem,reach+.0008));fascia.rotation.y=Math.atan2(f.nx,f.nz);
  lettering('museum',.020,.101,.016,-.002,0,fascia);
  lettering('SAN FRANCISCO RAILWAY',.0031,.070,.016,.013,.0002,fascia);
  for(const [dx,body] of [[-.067,'#c6ab64'],[-.049,'#b7aa8c']] as const){
    const x=mid+dx,d=reach+.0015;
    relief(x-.0058,x+.0058,hem-.009,hem+.010,reach,d,body);
    p.triangle(at(x-.006,hem+.010,d),at(x+.006,hem+.010,d),at(x,hem+.014,d),'#c9c7ac');
    for(const gap of [-.0024,.0024])face(x+gap-.0017,x+gap+.0017,hem+.001,hem+.007,d+.0004,'#58726e');
    face(x-.0058,x+.0058,hem-.006,hem-.003,d+.0004,'#a36350');
  }
  // The plain brick wall has a single small second-story opening over the door.
  relief(mid-.048,mid+.048,.294,.387,.001,.004,iron);
  face(mid-.044,mid+.044,.298,.384,.005,'#74898c');
}

/** Seven connected hotel volumes, with the Railway Museum occupying the low
 * Steuart/Don Chee corner. Night glass uses the city's shared window batch. */
export function railwayHotel(b:Building,neighbors:Building[],font:Font,inside:(x:number,z:number,p:number[][])=>boolean){
  const root=new THREE.Group(),windows:Pane[]=[];
  root.name=b.id===podium?'1 Hotel and San Francisco Railway Museum':'Stepped hotel terrace';
  const p=new HotelPanels(),top=eave(b.id),base=b.id===podium?0:eave(podium),parent=b.id===podium;
  const ring=b.p.slice(0,-1),outline=ring.map(([x,z])=>new THREE.Vector2(x,z));
  const winding=THREE.ShapeUtils.area(outline)>0?1:-1;
  const peers=neighbors.filter(n=>n.id!==b.id&&n.p.some(([x,z])=>Math.hypot(x+10,z+6)<5));
  function blocked(x:number,z:number,y:number){
    return peers.some(n=>y>(n.parent===podium?eave(podium):n.minH??0)&&y<(hotel(n)?eave(n.id):n.h)+.001&&inside(x,z,n.p));
  }
  // The shell's roof is separate from its walls, so the entrance bays can open
  // into the footprint. The upper floors share the podium's top elevation.
  const roofPaint=parent?'#a39f91':'#aaa99d';
  const roofPanels=new FacadePanels();
  for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(outline,[])){
    const v=(i:number):FacadePoint=>[ring[i][0],top,ring[i][1]];
    roofPanels.triangle(v(i),v(k),v(j),roofPaint);
  }
  const roof=roofPanels.mesh(surface);roof.name='Surveyed hotel roof';root.add(roof);
  if(parent){addMuseumWalk(root);addMuseumGallery(root);}
  addHotelTerraces(root,b.id,top);
  for(let i=0;i<ring.length;i++){
    const a=ring[i],c=ring[(i+1)%ring.length],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz);
    if(len<.001)continue;
    const nx=winding*dz/len,nz=-winding*dx/len;
    const f=elevation(p,a,c,nx,nz),{face,at,relief}=f;
    const north=parent&&a[0]===-8.462&&c[0]===-8.611;
    const west=parent&&a[0]===-8.611&&c[0]===-9.564;
    if(north||west){museum(p,f,north,root,font);continue;}
    const masonry=parent||b.id===1487225647||b.id===1487225652||b.id===1487225650;
    const bayFront=nz>.95&&a[1]>-5.2&&c[1]>-5.2&&len>.48;
    const finish=bayFront&&!parent?'#cdb69e':masonry?brick:'#c4baaa';
    if(bayFront){
      const count=len>.8?2:1,spacing=len/count;
      for(let j=0;j<count;j++){
        const l=j*spacing,r=l+spacing,u=(l+r)/2;
        if(parent){
          for(const [a,b] of [[l,u-spacing*.34],[u+spacing*.34,r]])relief(a,b,0,top,-.012,0,brick);
          groundArc(p,f,u-spacing*.34,u+spacing*.34,.200,.033,-.014);
          relief(u-.002,u+.002,floor,.224,-.014,-.009,iron);
          relief(u-spacing*.34,u+spacing*.34,.177,.181,-.014,-.009,iron);
          for(const x of [u-spacing*.23,u+spacing*.23]){
            relief(x-.034,x+.034,.298,.382,.001,.003,iron);
            face(x-.031,x+.031,.301,.379,.004,'#74888b');
          }
          continue;
        }
        face(l,r,base,top,0,finish);
        const h=top-base,nFloors=Math.max(3,Math.round(h/.184));
        const step=h/nFloors,front=.055,half=spacing*.364,capY=top-step;
        relief(u-half,u+half,base+.014,capY,0,front,'#354248');
        for(let k=0;k<nFloors;k++){
          const upper=k===nFloors-1,z=upper?.005:front+.002;
          const bottom=base+k*step+.032,head=base+(k+1)*step-.016;
          for(const side of [-1,1]){
            const x=u+side*half*.49,glass=at(x,(bottom+head)/2,z);
            windows.push({x:glass[0],y:glass[1],z:glass[2],ry:Math.atan2(nx,nz),w:half*.89,h:head-bottom});
            face(x-half*.45,x+half*.45,head-.031,head-.028,z+.002,'#789196');
          }
          if(!upper)relief(u-half-.004,u+half+.004,bottom-.023,bottom-.015,0,front+.006,'#52626a');
        }
      }
      continue;
    }
    face(0,len,base,top,0,finish);
    // Arc segments form the curved, glazed bay facing Mission. Do not put a
    // separate room-sized window or stone joint onto each small chord.
    const arc=a[0]<-11.53&&c[0]<-11.53&&a[1]>-5.33&&c[1]>-5.33&&len<.165;
    if(len<.20&&!arc)continue;
    const floors=parent?2:Math.max(1,Math.round((top-base)/.178));
    const step=(top-(parent?floor:base))/floors,span=arc?1:Math.max(1,Math.round(len/.272));
    for(let j=0;j<span;j++){
      const u=(j+.5)*len/span,width=arc?len*.90:Math.min(.172,len/span*.72);
      for(let k=0;k<floors;k++){
        const y=(parent?floor:base)+(k+.49)*step,pt=at(u,y,.010);
        if(blocked(pt[0],pt[2],y))continue;
        const h=step*(arc&&!parent?.82:parent&&k===0?.78:.66),l=u-width/2,r=u+width/2;
        face(l,r,y-h/2,y+h/2,.002,iron);
        const inset=Math.min(.003,width*.05),glass=at(u,y,.004);
        windows.push({x:glass[0],y,z:glass[2],ry:Math.atan2(nx,nz),w:width-2*inset,h:h-.006});
        relief(l-.002,r+.002,y-h/2-.005,y-h/2,.001,.009,masonry?'#aa8570':'#d1c8b9');
        if(!arc){
          face(l,r,y+h*.24,y+h*.24+.003,.0055,iron);
          face(u-.0015,u+.0015,y-h/2,y+h/2,.0055,iron);
        }
      }
      const rim=at(u,top+.009,.008);
      if(!blocked(rim[0],rim[2],top+.009)){
        relief(j*len/span,(j+1)*len/span,top-.015,top-.004,0,.009,masonry?'#a17e68':'#cec7b8');
      }
    }
    if(!parent&&len>.34){
      // Roof-end guards sit inside the parapet; shared walls have no railing.
      const sections=Math.max(1,Math.round(len/.18));
      for(let j=0;j<sections;j++){
        const l=j*len/sections,r=(j+1)*len/sections,pt=at((l+r)/2,top+.041,.017);
        if(blocked(pt[0],pt[2],top+.041))continue;
        for(const y of [.032,.060])relief(l,r,top+y,top+y+.003,-.022,-.018,iron);
        for(const x of [l+.002,r-.002])relief(x-.0015,x+.0015,top,top+.062,-.023,-.018,iron);
      }
    }
  }
  const facades=p.mesh(surface);facades.name='Steuart hotel brick, stone and glazing returns';root.add(facades);
  return {root,windows};
}
