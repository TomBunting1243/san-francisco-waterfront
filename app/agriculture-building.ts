import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
type Plan=[number,number];
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.81});
const scale=.06,grade=.045,width=50.9,mainDepth=16.6,wing=11.24,rear=38.65,tip=47.25;
const brick='#895b46',brickShade='#714d3d',stone='#bd925f',trim='#d0a776',granite='#988980';
const copper='#474d43',sash='#807d6d',glass='#525f61',clay='#a2684c';
// OSM 104599975, local distances in metres from its street/south corner.
// The 2024 SF aerial distinguishes the long hip from the low east infill.
// 2023 3DEP puts the west ridge 12.7 m above the adjacent Embarcadero.
const point=(s:number,t:number,h:number):FacadePoint=>[
  -13.109+scale*(s-.00785*t),grade+scale*h,-1.238+scale*(t+.00785*s)];

export function addAgricultureBuilding(b:{id:number},root:THREE.Group,windows:Pane[]){
  if(b.id!==104599975)return false;
  const p=new FacadePanels(),lensVertices:number[]=[];
  function roof(vertices:[number,number,number][],color:string){
    const points=vertices.map(([s,t,h])=>point(s,t,h));
    for(let i=1;i<points.length-1;i++)p.triangle(points[0],points[i+1],points[i],color);
  }
  // Keep facade normals facing outwards. Positive depth is out from the wall.
  function face(a:Plan,b:Plan){
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),ds=(b[0]-a[0])/length,dt=(b[1]-a[1])/length;
    const at=(u:number,y:number,d=0)=>point(a[0]+ds*u+dt*d,a[1]+dt*u-ds*d,y);
    function wall(l:number,r:number,lo:number,hi:number,d:number,c:string){
      const first=p.colors.length;
      p.quad(at(l,lo,d),at(l,hi,d),at(r,hi,d),at(r,lo,d),c);
      if(c===brick){
        // Large, continuous value changes in the masonry wash. Adjacent panels
        // use the same value at a shared corner, even at the window jambs.
        for(const [i,u,y] of [[0,l,lo],[1,l,hi],[2,r,hi],[3,r,lo]]){
          const value=.93+.045*Math.sin(u*.49+y*.28)+.024*Math.cos(u*.27-y*.80);
          for(let channel=0;channel<3;channel++)p.colors[first+i*3+channel]*=value;
        }
      }
    }
    function reveal(l:number,r:number,lo:number,hi:number,back:number){
      p.quad(at(l,hi),at(l,hi,back),at(l,lo,back),at(l,lo),brickShade);
      p.quad(at(r,hi,back),at(r,hi),at(r,lo),at(r,lo,back),brickShade);
      p.quad(at(l,lo,back),at(r,lo,back),at(r,lo),at(l,lo),granite);
      p.quad(at(l,hi),at(r,hi),at(r,hi,back),at(l,hi,back),brickShade);
    }
    function aperture(center:number,w:number,lo:number,hi:number,door:boolean,lit:boolean){
      const l=center-w/2,r=center+w/2,back=door?-.42:-.18;
      reveal(l,r,lo,hi,back);
      wall(l,r,lo,hi,back,door?'#40493f':glass);
      const split=door?lo+(hi-lo)*.72:(lo+hi)/2;
      wall(center-.043,center+.043,lo,hi,back+.025,sash);
      wall(l,r,split-.045,split+.045,back+.032,sash);
      if(door){
        wall(l-.24,l,lo,hi+.22,.04,stone);wall(r,r+.24,lo,hi+.22,.04,stone);
        // Heavy flat stone head with radiating joints on the 2018 street
        // photograph. The blocks tile the face, with a real underside.
        for(let i=0;i<5;i++){
          const bl=l-.24+(w+.48)*i/5,br=l-.24+(w+.48)*(i+1)/5;
          const tl=l-.42+(w+.84)*i/5,tr=l-.42+(w+.84)*(i+1)/5;
          p.quad(at(bl,hi,.14),at(tl,hi+.39,.14),at(tr,hi+.39,.14),at(br,hi,.14),[stone,'#b78957',trim,'#b98f60',stone][i]);
        }
        p.quad(at(l-.24,hi,.14),at(r+.24,hi,.14),at(r+.24,hi,0),at(l-.24,hi,0),brickShade);
        for(const [a,b] of [[l+.09,center-.075],[center+.075,r-.09]]){
          wall(a,b,lo+.25,lo+1.04,back+.014,'#595a4c');
          wall(a,b,lo+1.18,split-.10,back+.014,'#506462');
        }
        for(const side of [l,r-.18])wall(side,side+.18,hi-.22,hi,.08,stone);
      }else{
        for(const h of [(lo+split)/2,(split+hi)/2])wall(l,r,h-.027,h+.027,back+.026,sash);
        wall(l-.08,r+.08,lo-.13,lo,.055,stone);
      }
      // Only one upper sash leaf per selected room. Lower doors, shuttered
      // ground panes and the service annex do not participate in occupancy.
      if(lit){
        const [x,y,z]=at((l+center)/2,(lo+hi)/2,back+.01);
        const n=at(0,0,1),o=at(0,0);
        windows.push({x,y,z,ry:Math.atan2(n[0]-o[0],n[2]-o[2]),w:(w/2-.12)*scale,h:(hi-lo-.12)*scale});
      }
    }
    function cornice(y:number){
      for(const [lo,hi,d,c] of [[y-.50,y-.33,.10,stone],[y-.33,y-.18,.22,copper],[y-.18,y,.35,copper]] as const)
        wall(0,length,lo,hi,d,c);
      p.quad(at(0,y-.18,.35),at(length,y-.18,.35),at(length,y-.18),at(0,y-.18),copper);
    }
    return {length,at,wall,reveal,aperture,cornice};
  }
  type Face=ReturnType<typeof face>;
  function historic(f:Face,centres:number[],doors:number[],base:number,head:number,street=false,north=false){
    const {length,wall,aperture}=f;
    const belt=6.18,upperTop=head-.65;
    if(base<belt){
      let left=0;
      for(let i=0;i<centres.length;i++){
        const c=centres[i],door=doors.includes(i),w=door?(north?(i===1?1.07:2.55):street&&i===4?3.25:2.08):1.62;
        const l=c-w/2,r=c+w/2,hi=door?4.88:4.62,lo=door?base:Math.max(base,1.05);
        wall(left,l,base,belt,0,brick);
        if(lo>base)wall(l,r,base,lo,0,brick);
        wall(l,r,hi,belt,0,brick);aperture(c,w,lo,hi,door,false);
        if(base===0){wall(left,l,0,.53,.026,granite);if(!door)wall(l,r,0,.53,.026,granite);}
        left=r;
      }
      wall(left,length,base,belt,0,brick);
      if(base===0)wall(left,length,0,.53,.026,granite);
    }
    const upperBase=Math.max(base,belt);
    let left=0;
    for(let i=0;i<centres.length;i++){
      const c=centres[i],w=1.63,l=c-w/2,r=c+w/2,lo=Math.max(upperBase+.13,6.58);
      wall(left,l,upperBase,head,0,brick);wall(l,r,upperBase,lo,0,brick);
      wall(l,r,upperTop,head,0,brick);aperture(c,w,lo,upperTop,false,street&&i%4===1);
      if(street && i>0){
        const mid=(left+l)/2,y=(lo+upperTop)/2,sz=(i===4||i===5)?.48:.22;
        p.quad(f.at(mid-sz,y,.043),f.at(mid,y+sz,.043),f.at(mid+sz,y,.043),f.at(mid,y-sz,.043),stone);
      }
      left=r;
    }
    wall(left,length,upperBase,head,0,brick);
    if(base<=belt)wall(0,length,belt-.11,belt+.12,.055,trim);
    f.cornice(head);
  }
  const road=face([0,0],[width,0]),roadCenters=[3.45,9.9,15.25,20.58,25.45,30.32,35.65,41,47.45];
  const eave=9.62;
  historic(road,roadCenters,[0,4,8],0,eave,true);
  for(const x of [.55,6.72,23.27,27.63,width-6.72,width-.55]){
    for(let row=0;row<12;row++){
      const w=row%2===0?.92:.72,lo=.58+row*.717;
      road.wall(x-w/2,x+w/2,lo,lo+.65,.084,stone);
    }
  }
  // Southwest and southeast are the street and long side in the field photos.
  const south=face([0,mainDepth],[0,0]);historic(south,[3.55,8.3,13.05],[],0,eave);
  const southReturn=face([0,rear],[0,mainDepth]);
  historic(southReturn,[2.15,6.3,10.7,15.05,19.35],[],0,9.61);
  // Daylight field photo 68885153 shows dark projecting lantern bodies.
  // Their limited warm lens at night is interpreted; there is no facade wash.
  for(const [f,u] of [[south,8.3],[southReturn,19.35]] as const){
    f.wall(u-.16,u+.16,4.91,5.49,.08,copper);
    f.wall(u-.12,u+.12,5.03,5.38,.16,'#c6b798');lensVertices.push(p.positions.length/3-4);
    f.wall(u-.17,u+.17,5.38,5.49,.18,copper);
  }
  historic(face([0,tip],[0,rear]),[2.13,6.42],[],6.28,9.61);
  historic(face([wing,tip],[0,tip]),[2.85,8.38],[],6.28,9.61);
  historic(face([wing,rear],[wing,tip]),[2.13,6.42],[],6.28,9.61);
  historic(face([wing,mainDepth],[wing,rear]),[2.15,6.3,10.7,15.05,19.35],[],7.02,9.61);
  const plaza=face([width,0],[width,mainDepth]);
  historic(plaza,[3.55,8.3,13.05],[0,1,2],0,eave,false,true);
  for(const side of [plaza,south])for(const x of [.65,side.length-.65]){
    for(let row=0;row<12;row++){
      const w=row%2===0?1.25:1.05,lo=.58+row*.717;
      side.wall(x-w/2,x+w/2,lo,lo+.65,.084,stone);
    }
  }
  historic(face([width,mainDepth],[wing,mainDepth]),[3.3,9.8,16.4,23,29.5,36.25],[],7.03,eave);

  // Low services block and the open steel-supported end of the 1918 wing.
  function service(f:Face,height:number){f.wall(0,f.length,0,height,0,'#a88f74');f.wall(0,f.length,height-.18,height,.05,'#827d6e');}
  // ROMA Drone12 and SFCTA's opening view show brick on the plaza side,
  // painted service doors on the bay side, and a different upper wall behind.
  function utility(f:Face,count:number,bayside:boolean){
    const wall=bayside?'#b7b5ac':brick,step=f.length/count;
    for(let i=0;i<count;i++){
      const a=i*step,b=(i+1)*step,w=bayside?(i%3===0?2.65:1.75):1.64;
      const l=(a+b-w)/2,r=l+w,lo=bayside?.12:.68,hi=bayside?2.85:3.47;
      f.wall(a,l,0,5.56,0,wall);f.wall(r,b,0,5.56,0,wall);
      f.wall(l,r,0,lo,0,wall);f.wall(l,r,hi,5.56,0,wall);
      f.reveal(l,r,lo,hi,-.18);f.wall(l,r,lo,hi,-.18,i%3===1?'#8e928b':'#747c79');
      if(i%3!==1) {
        f.wall((l+r)/2-.04,(l+r)/2+.04,lo,hi,-.15,sash);
        f.wall(l,r,hi-.79,hi-.72,-.15,sash);
      }
    }
    f.wall(0,f.length,5.39,5.56,.06,bayside?'#9d9d96':stone);
  }
  utility(face([width,mainDepth],[width,rear]),6,false);
  utility(face([width,rear],[wing,rear]),8,true);
  service(face([wing,rear],[0,rear]),6.28);
  for(const s of [.35,wing-.35]){
    const r=.14,t=tip-.37,outline:Plan[]=[[s-r,t-r],[s+r,t-r],[s+r,t+r],[s-r,t+r]];
    for(let i=0;i<4;i++)service(face(outline[i],outline[(i+1)%4]),6.28);
  }
  const bottom=[[0,rear],[wing,rear],[wing,tip],[0,tip]].map(([s,t])=>point(s,t,6.28));
  p.quad(bottom[0],bottom[1],bottom[2],bottom[3],'#787360');
  // Main four-way hip. Shallow bands of fired tile are coplanar adjoining
  // courses, eliminating overlays and a tile-sized triangle budget.
  type Vertex=[number,number,number];
  function slope(a:Vertex,b:Vertex,c:Vertex,d:Vertex){
    const mix=(u:Vertex,v:Vertex,f:number):Vertex=>[u[0]+(v[0]-u[0])*f,u[1]+(v[1]-u[1])*f,u[2]+(v[2]-u[2])*f];
    const tones=[clay,'#a16a50','#aa7154','#9d644a'];
    for(let i=0;i<14;i++){
      const t=i/14,t1=(i+1)/14,l=mix(a,d,t),r=mix(b,c,t),l1=mix(a,d,t1),r1=mix(b,c,t1);
      if(i===13&&c===d)roof([l,r,l1],tones[i%4]);else roof([l,r,r1,l1],tones[i%4]);
    }
  }
  const sw:Vertex=[-.55,-.55,eave],nw:Vertex=[width+.55,-.55,eave],
    ne:Vertex=[width+.55,mainDepth+.3,eave],se:Vertex=[-.55,mainDepth+.3,eave];
  const ridgeS:Vertex=[7.7,8.05,12.85],ridgeN:Vertex=[width-7.7,8.05,12.85];
  slope(sw,nw,ridgeN,ridgeS);slope(nw,ne,ridgeN,ridgeN);
  slope(ne,se,ridgeS,ridgeN);slope(se,sw,ridgeS,ridgeS);
  // The narrower return has tile sides surrounding a flat central roof strip.
  const join=mainDepth+.3,outer=-.55,inner=wing+.35,end=tip+.42;
  const wa:Vertex=[outer,join,9.61],wb:Vertex=[inner,join,9.61],
    wc:Vertex=[inner,end,9.61],wd:Vertex=[outer,end,9.61];
  const la:Vertex=[2.64,join,10.48],lb:Vertex=[wing-2.64,join,10.48],
    lc:Vertex=[wing-2.64,end-2.9,10.7],ld:Vertex=[2.64,end-2.9,10.7];
  slope(wb,wc,lc,lb);slope(wc,wd,ld,lc);slope(wd,wa,la,ld);
  p.triangle(point(...wa),point(...la),point(la[0],join,eave),brickShade);
  p.quad(point(la[0],join,eave),point(...la),point(...lb),point(lb[0],join,eave),brickShade);
  p.triangle(point(lb[0],join,eave),point(...lb),point(...wb),brickShade);
  roof([la,lb,lc,ld],'#857c69');
  // Adjacent roof steps follow the 2024 survey. Close each riser only once.
  const spans=[[wing,width-9.1,6.87],[width-9.1,width,5.56]] as const;
  for(const [a,b,h] of spans){
    roof([[a,mainDepth,h],[b,mainDepth,h],[b,rear,h],[a,rear,h]],h>6?'#948c7b':'#746f62');
    const step=face([b,mainDepth],[a,mainDepth]);step.wall(0,step.length,h,7.03,0,brickShade);
    if(h>6){
      const east=face([b,mainDepth],[b,rear]);east.wall(0,east.length,5.56,h,0,'#8f8878');
      const bay=face([b,rear],[a,rear]);bay.wall(0,bay.length,5.56,h,0,'#8f8878');
    }
  }
  const mesh=p.mesh(material),energy=new Uint8Array(p.positions.length);
  for(const first of lensVertices)for(let v=first;v<first+4;v++)energy.set([74,42,17],v*3);
  mesh.geometry.setAttribute('signLight',new THREE.BufferAttribute(energy,3,true));
  mesh.name='Agriculture Building and Ferry Station Post Office';root.add(mesh);
  return true;
}
