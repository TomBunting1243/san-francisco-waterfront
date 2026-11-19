import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Plan=readonly [number,number];
type Pane={x:number;y:number;z:number;w:number;h:number;ry:number};
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.79});
const datum=.035,metres=.06,grade=7.27;
const atHeight=(absolute:number)=>datum+(absolute-grade)*metres;
// The u axis runs from Stevenson to Market, and v runs along Market toward Ecker.
const ux=.98923777,uz=-.14631692;
function point(u:number,y:number,v:number):FacadePoint{
  return [-12.192+ux*u-uz*v,y,-53.725+uz*u+ux*v];
}
const glass=['#485a63','#5b6b74','#667880','#52626b','#626970','#76838a'];
const granite=['#d3c9b8','#c7bdac','#d7cdbe','#c9beae'];

/** The rectangular granite towers at Market Center face their broad bays in different directions. */
export function addMarketCenter(b:{id:number},root:THREE.Group,windows:Pane[]){
  const tall=b.id===32963382;
  if(!tall&&b.id!==32946577)return false;
  const f=new FacadePanels();
  // Laser-survey roof edges are slightly rotated in the original mapped block frame.
  const minU=tall?-.105:.95,minV=tall?.25:3.41,w=tall?2.97:1.56,d=tall?1.66:2.65;
  const turn=tall?-.021:-.006,co=Math.cos(turn),si=Math.sin(turn);
  const site=(u:number,y:number,v:number)=>point(minU+co*u-si*v,y,minV+si*u+co*v);
  function solid(ring:Plan[],bottom:number,top:number,wall:string,lid:string){
    // Site plans wind counterclockwise in (u,v); the upward cap winds in reverse.
    ring.forEach(([u,v],i)=>{
      const [x,z]=ring[(i+1)%ring.length];
      f.quad(site(u,bottom,v),site(u,top,v),site(x,top,z),site(x,bottom,z),wall);
    });
    for(let i=1;i<ring.length-1;i++){
      f.triangle(site(ring[0][0],top,ring[0][1]),site(ring[i+1][0],top,ring[i+1][1]),site(ring[i][0],top,ring[i][1]),lid);
    }
  }
  const rectangle=(u:number,v:number,width:number,depth:number):Plan[]=>[[u,v],[u+width,v],[u+width,v+depth],[u,v+depth]];
  const corners=rectangle(0,0,w,d),roof=atHeight(tall?176.05:99.45),rim=atHeight(tall?177.15:100.5);
  const officeBottom=datum+(tall?.43:.36),officeTop=rim-(tall?.30:.28),floors=tall?39:21;
  for(let side=0;side<4;side++){
    const [u,v]=corners[side],[x,z]=corners[(side+1)%4],length=Math.hypot(x-u,z-v);
    const du=(x-u)/length,dv=(z-v)/length;
    const at=(s:number,y:number,depth=0)=>site(u+du*s+dv*depth,y,v+dv*s-du*depth);
    const face=(l:number,r:number,lo:number,hi:number,depth:number,c:string)=>f.quad(at(l,lo,depth),at(l,hi,depth),at(r,hi,depth),at(r,lo,depth),c);
    const bays=tall?(side%2===0?16:8):(side%2===0?9:15);
    const end=tall?.036:.031,span=(length-2*end)/bays,step=(officeTop-officeBottom)/floors;
    face(0,end,officeBottom,officeTop,0,'#c8bcaa');face(length-end,length,officeBottom,officeTop,0,'#d4caba');
    // Each window sits behind a projecting top and sill. The sloped reveals catch
    // opposite light across the street rather than reading as dots painted on a wall.
    for(let row=0;row<floors;row++){
      const lo=officeBottom+step*row,hi=lo+step,sill=lo+step*.18,head=hi-step*.07;
      face(end,length-end,lo,sill,0,granite[Math.floor(row/5)%granite.length]);
      face(end,length-end,head,hi,0,'#c8bfaf');
      for(let bay=0;bay<bays;bay++){
        const left=end+span*bay,right=left+span,l=left+span*.18,r=right-span*.18;
        const tone=granite[(side+Math.floor(bay/4)+Math.floor(row/9))%granite.length];
        face(left,l,sill,head,0,tone);face(r,right,sill,head,0,tone);
        const lip=tall?.008:.014,inner=-.009,reveal=.004;
        f.quad(at(l,sill),at(l,sill+reveal,lip),at(r,sill+reveal,lip),at(r,sill),'#928878');
        f.quad(at(l,sill+reveal,lip),at(l+reveal,sill+.012,inner),at(r-reveal,sill+.012,inner),at(r,sill+reveal,lip),'#ddd5c5');
        f.quad(at(l,head),at(r,head),at(r-reveal,head-.011,inner),at(l+reveal,head-.011,inner),'#807a70');
        f.quad(at(l,sill+reveal,lip),at(l,head),at(l+reveal,head-.011,inner),at(l+reveal,sill+.012,inner),'#b5ac9e');
        f.quad(at(r-reveal,sill+.012,inner),at(r-reveal,head-.011,inner),at(r,head),at(r,sill+reveal,lip),'#a99f92');
        const tint=glass[(side*2+Math.floor(bay/3)+Math.floor(row/6))%glass.length];
        face(l+reveal,r-reveal,sill+.012,head-.011,inner,tint);
        const shade=(row*11+bay*17+side*7)%31;
        if(shade<3){
          const shadeHeight=step*(.10+.06*shade);
          face(l+reveal+.001,r-reveal-.001,head-.011-shadeHeight,head-.011,inner+.0012,'#bbb6a8');
        }else if((row*7+bay*3+side*5)%18===0){
          const [px,py,pz]=at((l+r)/2,(head+sill)/2,inner+.0012),normal=at((l+r)/2,(head+sill)/2,inner+.1012);
          windows.push({x:px,y:py,z:pz,w:r-l-2*reveal-.003,h:head-sill-.028,ry:Math.atan2(normal[0]-px,normal[2]-pz)});
        }
      }
    }
    face(0,length,officeTop,rim,0,'#d4cbbb');
    f.quad(at(length,rim),at(0,rim),at(0,rim,-.014),at(length,rim,-.014),'#e0d9ca');
    f.quad(at(length,roof,-.014),at(length,rim,-.014),at(0,rim,-.014),at(0,roof,-.014),'#948c7d');
    // Wider double-height door and storefront openings from the existing ground
    // plan, including a recessed office lobby facing the common garden.
    const lobby=tall?side===2:side===0,market=side===1;
    const count=Math.max(3,Math.round(bays/2)),sash=length/count,wall=market?'#c9c0ae':'#d1c7b5';
    for(let i=0;i<count;i++){
      const a=i*sash,z2=(i+1)*sash,mid=Math.floor(count/2);
      const sharedPortion=lobby&&tall&&(i===mid-1||i===mid);
      const l=a+(sharedPortion&&i===mid?0:.026),r=z2-(sharedPortion&&i===mid-1?0:.026);
      const door=lobby&&(i===mid||sharedPortion);
      const depth=door?-.085:-.047;
      // The three-way garden promenade enters the lobby above the planting beds.
      // These raised vestibules meet its 0.095 scene-unit deck at the actual jamb.
      const threshold=lobby?.095:datum;
      if(l>a)face(a,l,datum,officeBottom,0,wall);
      if(r<z2)face(r,z2,datum,officeBottom,0,wall);
      if(l>a)f.quad(at(l,datum),at(l,officeBottom),at(l,officeBottom,depth),at(l,datum,depth),'#a49b8c');
      if(r<z2)f.quad(at(r,datum,depth),at(r,officeBottom,depth),at(r,officeBottom),at(r,datum),'#b9ad9a');
      face(l,r,threshold,officeBottom,depth,door?'#475558':'#586564');
      face(l,r,officeBottom-.084,officeBottom-.016,depth+.002,'#5f625d');
      face((l+r)/2-.0025,(l+r)/2+.0025,threshold,officeBottom-.084,depth+.0015,'#9e9d8e');
      if(lobby){
        f.quad(at(r,threshold),at(l,threshold),at(l,threshold,depth),at(r,threshold,depth),'#c1b9a8');
        face(l,r,datum,threshold,0,'#a59d8e');
      }
      if(door){
        face(l,r,threshold+.157,threshold+.163,depth+.002,'#a7a797');
        for(const k of [-.016,.016])face((l+r)/2+k-.002,(l+r)/2+k+.002,threshold+.048,threshold+.095,depth+.003,'#d3ccb7');
      }
      f.quad(at(r,officeBottom,depth),at(l,officeBottom,depth),at(l,officeBottom),at(r,officeBottom),'#a69e90');
    }
  }
  solid(rectangle(.014,.014,w-.028,d-.028),roof-.013,roof,'#8e8d80','#b6b4a7');
  if(tall){
    const plant=atHeight(183.05);
    solid(rectangle(.25,.24,w-.51,d-.48),roof,plant,'#a9a79b','#cdcbbd');
    solid(rectangle(.38,.66,.06,.31),plant,atHeight(184.4),'#797b74','#a8a69a');
    const start=1.64,fanZ=.67;
    solid(rectangle(start,fanZ,1.03,.36),plant,atHeight(184.44),'#92938b','#a2a399');
    for(let j=0;j<4;j++){
      const cx=start+.13+j*.258,cz=fanZ+.18,cy=atHeight(184.44);
      const ring=Array.from({length:12},(_,n):Plan=>[cx+.104*Math.cos(n*Math.PI/6),cz+.104*Math.sin(n*Math.PI/6)]);
      solid(ring,cy,cy+.005,'#97988c','#68716c');
      for(let k=0;k<5;k++){
        const t=k*2*Math.PI/5,tip=(r:number,a:number)=>site(cx+r*Math.cos(t+a),cy+.006,cz+r*Math.sin(t+a));
        f.quad(tip(.012,0),tip(.075,-.4),tip(.093,-.75),tip(.044,-.72),'#9fa498');
      }
    }
    solid(rectangle(1.69,.51,.14,.13),plant,atHeight(186.1),'#999b90','#cbcbbd');
  }else{
    // The 1964 building has a six-sided rooftop enclosure with a ridge at
    // each end, plainly visible in the perpendicular 2024 aerial.
    const core:Plan[]=[[.15,.42],[w/2,.19],[w-.15,.42],[w-.15,d-.38],[w/2,d-.15],[.15,d-.38]];
    solid(core,roof,atHeight(103.73),'#9b9a90','#c6c5b8');
    for(const u of [.16,w-.25])solid(rectangle(u,.97,.07,.44),atHeight(103.73),atHeight(105.2),'#95958a','#bcbbae');
  }
  const mesh=f.mesh(material);mesh.name=tall?'575 Market Street · Chevron Tower':'555 Market Street · Standard Oil Building';
  root.add(mesh);return true;
}
