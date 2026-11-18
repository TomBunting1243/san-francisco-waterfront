import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Plan=[number,number];
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.74});
const bronze='#5d4f48',edge='#917e6e',reveal='#403e3e',spandrel='#785f52';
const glass=['#556268','#646a68','#64605d','#4f5a60','#716c64','#58676d'];
const wallBase=.035,metres=.06;
const height=(m:number)=>wallBase+m*metres;

/** SOM's former Bechtel headquarters. The owner’s plan has eleven structural
 * bays on the Beale elevation and six on Mission, each with four lights. */
export function add300Mission(building:{id:number;p:number[][]},root:THREE.Group,windows:Pane[]){
  if(building.id!==256065251)return false;
  const p=building.p,origin=p[3],w=Math.hypot(p[5][0]-origin[0],p[5][1]-origin[1]),d=Math.hypot(p[2][0]-origin[0],p[2][1]-origin[1]);
  const c=(p[5][0]-origin[0])/w,s=(p[5][1]-origin[1])/w;
  const scene=(u:number,y:number,v:number):FacadePoint=>[origin[0]+u*c-v*s,y,origin[1]+u*s+v*c];
  const f=new FacadePanels();
  function rect(u:number,v:number,width:number,depth:number,lo:number,hi:number,tone:string,top=tone){
    const pt=(x:number,y:number,z:number)=>scene(u+x,y,v+z);
    const ring:Plan[]=[[0,0],[width,0],[width,depth],[0,depth]];
    ring.forEach(([x,z],i)=>{const [nx,nz]=ring[(i+1)%4];f.quad(pt(x,lo,z),pt(x,hi,z),pt(nx,hi,nz),pt(nx,lo,nz),tone);});
    f.quad(pt(0,hi,0),pt(0,hi,depth),pt(width,hi,depth),pt(width,hi,0),top);
  }
  const deck=height(89.55),rim=height(91.12),officeBase=height(5.15),glazingTop=height(89.05);
  const corners:Plan[]=[[0,0],[w,0],[w,d],[0,d]];
  corners.forEach(([u,v],side)=>{
    const [nx,nz]=corners[(side+1)%4],length=Math.hypot(nx-u,nz-v);
    const du=(nx-u)/length,dv=(nz-v)/length,normalU=dv,normalV=-du;
    const at=(along:number,y:number,offset=0)=>scene(u+du*along+normalU*offset,y,v+dv*along+normalV*offset);
    const panel=(l:number,r:number,lo:number,hi:number,offset:number,tone:string)=>
      f.quad(at(l,lo,offset),at(l,hi,offset),at(r,hi,offset),at(r,lo,offset),tone);
    const bays=side%2===0?44:24,span=length/bays;
    const rows=22,pitch=(glazingTop-officeBase)/rows;
    for(let row=0;row<rows;row++){
      const bottom=officeBase+row*pitch,sill=bottom+pitch*.31,head=bottom+pitch;
      panel(0,length,bottom,sill,-.009,spandrel);
      panel(0,length,sill,sill+.0023,-.008,edge);
      for(let i=0;i<bays;i++){
        const l=i*span,r=l+span,tint=glass[(side*3+Math.floor(i/4)+Math.floor(row/7))%glass.length];
        panel(l,r,sill+.0023,head,-.012,tint);
        const blind=(row*13+i*17+side*11)%29;
        if(blind===0||blind===1)panel(l+.004,r-.004,head-pitch*(blind?.19:.36),head-.002,-.0108,'#918780');
        if(blind>1&&(row*7+i*3+side)%25===0){
          const [x,y,z]=at((l+r)/2,(head+sill)/2,-.0102);
          windows.push({x,y,z,w:span-.009,h:(head-sill)*.92,ry:Math.atan2(normalU*c-normalV*s,normalU*s+normalV*c)});
        }
      }
    }
    // Long anodized fins catch sunlight on the leading edge and leave a real return
    // between the bronze face and smoked glass at oblique angles.
    for(let i=0;i<=bays;i++){
      const l=Math.max(0,i*span-.0027),r=Math.min(length,i*span+.0027),base=i%4===0?wallBase:officeBase;
      panel(l,r,base,glazingTop,.011,edge);
      f.quad(at(l,base,-.012),at(l,glazingTop,-.012),at(l,glazingTop,.011),at(l,base,.011),bronze);
      f.quad(at(r,base,.011),at(r,glazingTop,.011),at(r,glazingTop,-.012),at(r,base,-.012),reveal);
      if(i%4===0){
        const a=Math.max(0,l-.012),b=Math.min(length,r+.012);
        panel(a,b,wallBase,officeBase,-.012,bronze);
        f.quad(at(a,wallBase,-.063),at(a,officeBase,-.063),at(a,officeBase,-.012),at(a,wallBase,-.012),reveal);
        f.quad(at(b,wallBase,-.012),at(b,officeBase,-.012),at(b,officeBase,-.063),at(b,wallBase,-.063),bronze);
      }
    }
    panel(0,length,glazingTop,rim,0,bronze);
    // Folded coping around the sunken main roof deck.
    f.quad(at(length,rim),at(0,rim),at(0,rim,-.012),at(length,rim,-.012),edge);
    f.quad(at(length,deck,-.012),at(length,rim,-.012),at(0,rim,-.012),at(0,deck,-.012),reveal);
    const setback=.064;
    // Recessed shop windows under the continuous fascia and the Mission lobby.
    const alongMission=side===3;
    for(let i=0;i<bays;i++){
      const l=i*span,r=l+span;
      const door=(alongMission&&i>=10&&i<14)||(side===2&&i>=12&&i<14);
      const offset=door?-.132:-setback;
      panel(l,r,wallBase,officeBase-.026,offset,door?'#535b58':glass[(Math.floor(i/4)+side)%glass.length]);
      panel(l,r,wallBase,wallBase+.014,offset+.0015,'#8c8276');
      panel(l,l+.004,wallBase,officeBase-.026,offset+.0015,bronze);
      panel(l,r,officeBase-.026,officeBase,offset,reveal);
      if(door){
        panel(l,r,height(2.8),height(2.86),offset+.002,edge);
        panel(l+.013,l+.016,height(.9),height(1.55),offset+.002,edge);
        if(i===(alongMission?10:12))f.quad(at(l,wallBase,-setback),at(l,officeBase,-setback),at(l,officeBase,offset),at(l,wallBase,offset),bronze);
        if(i===13)f.quad(at(r,wallBase,offset),at(r,officeBase,offset),at(r,officeBase,-setback),at(r,wallBase,-setback),bronze);
      }
    }
    f.quad(at(0,officeBase),at(length,officeBase),at(length,officeBase,-.135),at(0,officeBase,-.135),reveal);
  });
  rect(0,0,w,d,deck-.013,deck,'#8c837b','#a89f91');
  // The 2023 surface and 2024 SF aerial separate the plenum, its lower fan
  // well, air-handling plant and the two stacks from the perimeter roof.
  const mech=height(97.35),inside=height(95.35),wellU=2.87,wellV=1.22;
  rect(.39,.46,2.48,1.49,deck,mech,'#837e73','#a59e8e');
  rect(wellU,.46,.94,wellV-.46,deck,mech,'#837e73','#a9a292');
  rect(wellU,wellV,.94,1.95-wellV,deck,inside,'#78776e','#686b63');
  const rail=.013;
  for(const u of [wellU,3.35,3.81-rail])rect(u,wellV,rail,1.95-wellV,inside,mech+.007,'#b4ac9a');
  for(const v of [wellV,1.53,1.78,1.95-rail])rect(wellU,v,.94,rail,mech-.016,mech+.008,'#b4ac9a');
  rect(1.83,.65,.94,1.04,mech,height(98.5),'#8d8b7e','#b9b3a1');
  rect(.61,1.10,1.20,.62,mech,height(99.05),'#65675e','#89897b');
  function disk(u:number,v:number,r:number,lo:number,hi:number,wall:string,top:string){
    const n=16,ring=Array.from({length:n},(_,i):Plan=>[u+r*Math.cos(i*2*Math.PI/n),v+r*Math.sin(i*2*Math.PI/n)]);
    ring.forEach(([x,z],i)=>{const [nx,nz]=ring[(i+1)%n];f.quad(scene(x,lo,z),scene(x,hi,z),scene(nx,hi,nz),scene(nx,lo,nz),wall);f.triangle(scene(u,hi,v),scene(nx,hi,nz),scene(x,hi,z),top);});
  }
  function rotor(u:number,v:number,r:number,y:number){
    disk(u,v,r,y,y+.008,'#7a7b70','#525952');
    for(let n=0;n<6;n++){
      const a=n*Math.PI/3,tip=(rr:number,t:number)=>scene(u+rr*Math.cos(a+t),y+.010,v+rr*Math.sin(a+t));
      f.quad(tip(r*.15,-.35),tip(r*.65,-.52),tip(r*.91,-.81),tip(r*.84,-1.06),'#b2b3a1');
    }
    disk(u,v,r*.16,y+.01,y+.015,'#7c8275','#bbb8a7');
  }
  for(let i=0;i<6;i++){
    const u=.80+i*.166;
    rect(u,1.37,.145,.168,height(99.05),height(100.68),'#929386','#aaa998');
    rotor(u+.073,1.454,.050,height(100.68));
  }
  for(const u of [3.19,3.55]){
    rect(u-.145,1.47,.29,.29,inside,height(97.83),'#75776b','#929486');
    rotor(u,1.615,.118,height(97.83));
  }
  for(const [u,v] of [[.39,1.12],[3.64,1.13]])disk(u,v,.033,mech,height(105.1),'#76786d','#565c53');
  const architecture=f.mesh(paint);architecture.name='300 Mission Street · Bechtel Building';root.add(architecture);
  return true;
}
