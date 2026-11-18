import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Building={id:number;p:number[][]};
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
type Plan=[number,number];
const cladding='#c3bcac',lightMetal='#cec7b8',seal='#827e72',reveal='#88877e';
const panes=['#52616a','#626c70','#52606a','#5b676c'];
const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75});
const lobby=.315,deck=8.147,parapet=8.197,rows=33;

// SF Planning DPR (45 Fremont) describes the radiused aluminum slab. Andrew
// Campbell Nelson's two orthogonal original photographs resolve the pane counts,
// pairs of equipment floors nine rows below the parapet, and centered entrance.
// https://sfplanning.s3.amazonaws.com/archives/CDG/docs/transit_center/Survey_A_and_B_forms.pdf
// https://sfyimby.com/2021/04/number-37-45-fremont-street-soma-san-francisco.html
export function addFortyFiveFremont(b:Building,root:THREE.Group,windows:Window[]){
  if(b.id!==32946535)return false;
  const origin=b.p[4],edge=b.p[0],rear=b.p[3];
  const width=Math.hypot(edge[0]-origin[0],edge[1]-origin[1]);
  const depth=Math.hypot(rear[0]-origin[0],rear[1]-origin[1]);
  const ux=(edge[0]-origin[0])/width,uz=(edge[1]-origin[1])/width;
  const vx=(rear[0]-origin[0])/depth,vz=(rear[1]-origin[1])/depth;
  const project=(x:number,y:number,z:number):FacadePoint=>[origin[0]+ux*x+vx*z,y,origin[1]+uz*x+vz*z];
  const batch=new FacadePanels(),group=new THREE.Group();group.name='45 Fremont aluminum tower';root.add(group);
  const radius=.04,pitch=(deck-lobby)/rows;
  // Counterclockwise in plan. The street runs along the five-bay forward face.
  const runs:Plan[][]=[[[radius,0],[width-radius,0]],[[width,radius],[width,depth-radius]],
    [[width-radius,depth],[radius,depth]],[[0,depth-radius],[0,radius]]];
  for(const [side,[a,c]] of runs.entries()){
    const dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz),bayCount=side%2?3:5,panesPerBay=side%2?4:3;
    const nx=dz/len,nz=-dx/len;
    const at=(x:number,y:number,offset=0)=>project(a[0]+x*dx/len+nx*offset,y,a[1]+x*dz/len+nz*offset);
    const face=(l:number,r:number,lo:number,hi:number,offset:number,tint:string)=>
      batch.quad(at(l,lo,offset),at(l,hi,offset),at(r,hi,offset),at(r,lo,offset),tint);
    const bayWidth=len/bayCount;
    for(let bay=0;bay<bayCount;bay++){
      const left=bay*bayWidth,right=left+bayWidth,jamb=.014;
      const entrance=side===0&&bay===2;
      const inset=entrance?-.048:-.014;
      face(left,left+jamb*2,.035,lobby,0,cladding);face(right-jamb*2,right,.035,lobby,0,cladding);
      face(left+jamb*2,right-jamb*2,.035,lobby-.045,inset,entrance?'#455956':'#596365');
      face(left+jamb*2,right-jamb*2,lobby-.045,lobby,0,cladding);
      for(const x of [left+jamb*2,right-jamb*2]){
        const start=x<left+bayWidth*.5?0:inset,end=start===0?inset:0;
        batch.quad(at(x,.035,start),at(x,lobby-.045,start),at(x,lobby-.045,end),at(x,.035,end),reveal);
      }
      if(entrance){
        // The central glazed doors sit inside a broad brushed-metal surround.
        batch.quad(at(left+jamb*2,lobby-.045,0),at(right-jamb*2,lobby-.045,0),
          at(right-jamb*2,lobby-.045,inset),at(left+jamb*2,lobby-.045,inset),reveal);
        face(left+.032,right-.032,lobby*.66,lobby*.71,inset+.002,lightMetal);
      }
      for(let m=1;m<panesPerBay;m++){
        const x=left+m*bayWidth/panesPerBay;
        face(x-.003,x+.003,.035,lobby-.045,inset+.002,lightMetal);
      }
      for(let row=0;row<rows;row++){
        const y=lobby+row*pitch,sill=y+.20*pitch,head=y+.79*pitch;
        const l=left+jamb,r=right-jamb;
        face(left,right,y,sill,0,cladding);face(left,right,head,y+pitch,0,lightMetal);
        face(left,l,sill,head,0,cladding);face(r,right,sill,head,0,cladding);
        // Short exterior reveal and glazing rebate provide an actual shadow at the top.
        const back=-.009;
        batch.quad(at(l,sill),at(l,head),at(l,head,back),at(l,sill,back),reveal);
        batch.quad(at(r,sill,back),at(r,head,back),at(r,head),at(r,sill),reveal);
        batch.quad(at(l,sill,back),at(r,sill,back),at(r,sill),at(l,sill),lightMetal);
        batch.quad(at(l,head),at(r,head),at(r,head,back),at(l,head,back),reveal);
        const vent=row===22||row===23;
        if(vent){
          face(l,r,sill,head,back,'#4a5356');
          for(let k=1;k<=4;k++){
            const slat=sill+(head-sill)*k/5;
            face(l,r,slat-.004,slat+.004,-.002,seal);
          }
        }else{
          for(let pane=0;pane<panesPerBay;pane++){
            const pl=l+(r-l)*pane/panesPerBay,pr=l+(r-l)*(pane+1)/panesPerBay;
            if(pane)face(pl,pl+.0035,sill,head,-.005,seal);
            face(pl+(pane?.0035:0),pr,sill,head,back,panes[(pane+bay+side+Math.floor(row/5))%panes.length]);
            if((row+bay+pane*3+side*2)%9===0){
              const [x,wy,z]=at((pl+pr)/2,(sill+head)/2,back+.002);
              windows.push({x,y:wy,z,ry:Math.atan2(ux*nx+vx*nz,uz*nx+vz*nz),w:(pr-pl)*.90,h:(head-sill)*.93});
            }
          }
        }
      }
      face(left,right,deck,parapet,0,cladding);
    }
  }
  // Radius is deliberately continuous at every floor, including the outer parapet.
  const centers:Plan[]=[[width-radius,radius],[width-radius,depth-radius],[radius,depth-radius],[radius,radius]];
  const rim:Plan[]=[];
  for(let corner=0;corner<4;corner++){
    const [cx,cz]=centers[corner];
    for(let j=0;j<=5;j++){
      const theta=(corner-1+j/5)*Math.PI/2;
      const p:Plan=[cx+radius*Math.cos(theta),cz+radius*Math.sin(theta)];rim.push(p);
      if(!j)continue;
      const [x,z]=rim[rim.length-2];
      batch.quad(project(x,.035,z),project(x,parapet,z),project(p[0],parapet,p[1]),project(p[0],.035,p[1]),lightMetal);
    }
  }
  for(let i=0;i<rim.length;i++){
    const [x,z]=rim[i],[rx,rz]=rim[(i+1)%rim.length];
    const inset=(x:number,z:number):Plan=>[(x-width/2)*.983+width/2,(z-depth/2)*.983+depth/2];
    const [u,v]=inset(x,z),[ru,rv]=inset(rx,rz);
    batch.quad(project(x,parapet,z),project(u,parapet,v),project(ru,parapet,rv),project(rx,parapet,rz),lightMetal);
    batch.quad(project(u,deck,v),project(ru,deck,rv),project(ru,parapet,rv),project(u,parapet,v),seal);
    batch.triangle(project(width/2,deck,depth/2),project(ru,deck,rv),project(u,deck,v),'#aaa99d');
  }
  const facade=batch.mesh(paint);facade.name='45 Fremont radiused facade and roof terrace';group.add(facade);
  // The long rectangular plant and the lower transverse extensions are distinct
  // point-cloud planes (135.8 m, approximately 140 m, 145.0–146 m).
  const roofBatch=new FacadePanels();
  function plant(l:number,r:number,f:number,bk:number,top:number,tone:string){
    const ring:Plan[]=[[l*width,f*depth],[r*width,f*depth],[r*width,bk*depth],[l*width,bk*depth]];
    for(let i=0;i<4;i++){
      const [x,z]=ring[i],[u,v]=ring[(i+1)%4];
      roofBatch.quad(project(x,deck,z),project(x,top,z),project(u,top,v),project(u,deck,v),tone);
    }
    roofBatch.quad(project(l*width,top,f*depth),project(l*width,top,bk*depth),project(r*width,top,bk*depth),project(r*width,top,f*depth),'#b9b6a9');
  }
  plant(.085,.93,.325,.685,8.715,'#afad9e');
  plant(.553,.655,.17,.325,8.405,'#a4a499');plant(.449,.648,.685,.841,8.405,'#a4a499');
  const housing=roofBatch.mesh(paint);housing.name='45 Fremont surveyed roof plant';group.add(housing);return true;
}
