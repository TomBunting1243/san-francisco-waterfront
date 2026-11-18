import * as THREE from 'three';
import records from '../public/data/surveyed-shopfronts.json' with {type:'json'};
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Factory=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
type Record=(typeof records)[number];
const fronts=new Map(records.map(row=>[row.id,row]));
const grade=.045;

// Split only the original six wall vertices that correspond to the surveyed
// street edge. All other faces, including rooftop contours, stay as authored.
// Interpolating the original facadeGrid keeps upper windows in their own bays.
function openWall(g:THREE.BufferGeometry,record:Record){
  const pos=g.getAttribute('position'),normal=g.getAttribute('normal');
  if(g.index||!g.hasAttribute('facadeGrid'))return;
  const [a,b]=record.edge,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),tx=dx/len,tz=dz/len;
  const dl=record.center*len-record.width/2,dr=dl+record.width;
  if(dl<=0||dr>=len)return;
  for(let i=0;i<pos.count-5;i++){
    if(Math.abs(normal.getY(i))>.01)continue;
    const ends=[-1,-1,-1,-1];
    let top=0,matched=0;
    for(let j=i;j<i+6;j++){
      const x=pos.getX(j)-a[0],z=pos.getZ(j)-a[1],d=x*tx+z*tz,h=pos.getY(j);
      if(Math.abs(x*tz-z*tx)>.001||Math.min(Math.abs(d),Math.abs(d-len))>.001)break;
      matched++;ends[(d>len/2?1:0)+(h>.005?2:0)]=j;top=Math.max(h,top);
    }
    if(matched!==6||ends.some(j=>j<0)||top<record.head+.02)continue;
    const nx=normal.getX(i),nz=normal.getZ(i),cuts=[[0,len,record.head,top],[0,dl,0,record.head],[dr,len,0,record.head],[dl,dr,0,grade]];
    const weights=cuts.flatMap(([l,r,bottom,head])=>[[l,bottom],[l,head],[r,head],[r,bottom]]);
    for(const [key,attribute] of Object.entries(g.attributes)){
      const size=attribute.itemSize,values=new Float32Array((pos.count+weights.length)*size);
      // downtownBuilding supplies contiguous floating point attributes.
      values.set(attribute.array);
      weights.forEach(([d,h],j)=>{
        const t=d/len,u=h/top;
        for(let k=0;k<size;k++){
          const v=ends.map(e=>attribute.array[e*size+k]);
          values[(pos.count+j)*size+k]=(1-u)*((1-t)*v[0]+t*v[1])+u*((1-t)*v[2]+t*v[3]);
        }
      });
      g.setAttribute(key,new THREE.BufferAttribute(values,size));
    }
    const index=Array.from({length:pos.count},(_,j)=>j).filter(j=>j<i||j>=i+6);
    for(let j=pos.count;j<pos.count+weights.length;j+=4){
      if(tz*nx-tx*nz>0)index.push(j,j+1,j+2,j,j+2,j+3);
      else index.push(j,j+2,j+1,j,j+3,j+2);
    }
    g.setIndex(index);g.clearGroups();
    return {nx,nz,len,tx,tz};
  }
}

function interior(r:Record,frame:NonNullable<ReturnType<typeof openWall>>){
  const {nx,nz,len,tx,tz}=frame,[a]=r.edge,at=r.center*len,f=new FacadePanels();
  const p=(x:number,h:number,d:number):FacadePoint=>[a[0]+(at+x)*tx+nx*d,h,a[1]+(at+x)*tz+nz*d];
  const panel=(l:number,b:number,lo:number,hi:number,d:number,color:string)=>{
    const v=[p(l,lo,d),p(l,hi,d),p(b,hi,d),p(b,lo,d)] as const;
    if(tz*nx-tx*nz>0)f.quad(...v,color);else f.quad(v[3],v[2],v[1],v[0],color);
  };
  const two=(a:FacadePoint,b:FacadePoint,c:FacadePoint,d:FacadePoint,color:string)=>{
    f.quad(a,b,c,d,color);f.quad(d,c,b,a,color);
  };
  const w=r.width/2,head=r.head,dl=r.door-.032,dr=r.door+.032,reveal=-.047,glass=-.014,doorHead=grade+.130;
  const side=(x:number,near:number,far:number,lo:number,hi:number,tint:string)=>two(p(x,lo,near),p(x,hi,near),p(x,hi,far),p(x,lo,far),tint);
  const slab=(l:number,b:number,h:number,near:number,far:number,tint:string)=>two(p(l,h,near),p(b,h,near),p(b,h,far),p(l,h,far),tint);
  side(-w,0,glass,grade,head,r.frame);side(w,0,glass,grade,head,r.frame);
  slab(-w,w,head,0,glass,r.frame);slab(-w,w,grade+.0004,.009,reveal,'#b8aea0');
  for(const [l,b] of [[-w,dl],[dr,w]]){
    panel(l,b,grade,head,glass,r.glass);
    panel(l,b,grade,grade+.020,glass+.0018,'#a49c8c');
    for(const x of [l,(l+b)/2,b-.004])panel(x,x+.004,grade+.020,head,glass+.0024,r.frame);
    panel(l,b,doorHead,doorHead+.005,glass+.003,r.frame);
  }
  side(dl,glass,reveal,grade,doorHead,r.frame);side(dr,glass,reveal,grade,doorHead,r.frame);
  slab(dl,dr,doorHead,glass,reveal,'#8a8274');
  panel(dl,dr,doorHead,head,glass,'#83989a');
  panel(dl,dr,grade,doorHead,reveal,'#526a6d');
  for(const x of [dl,dr-.004])panel(x,x+.004,grade,doorHead,reveal+.0018,r.frame);
  panel(dl,dr,grade,grade+.012,reveal+.0019,r.frame);
  panel(dr-.015,dr-.012,grade+.050,grade+.083,reveal+.003,'#bea983');
  panel(-w,w,head-.013,head,-.001,r.frame);
  return f;
}

/** Wrap the generic facade factory. Only the two matched ground sections are modified. */
export function surveyedShopfrontFactory(b:{id:number},mesh:Factory):Factory{
  const record=fronts.get(b.id);
  if(!record)return mesh;
  let built=false;
  return (geometry,color,x,y,z)=>{
    if(!built&&x===0&&y===0&&z===0){
      const frame=openWall(geometry,record);
      if(frame){
        const panels=interior(record,frame);
        const detail=new THREE.BufferGeometry();
        detail.setAttribute('position',new THREE.Float32BufferAttribute(panels.positions,3));
        detail.setAttribute('color',new THREE.Float32BufferAttribute(panels.colors,3));
        detail.setIndex(panels.indices);detail.computeVertexNormals();detail.userData.paintVertices=true;
        mesh(detail,'#ffffff',0,0,0).name='Surveyed storefront '+record.address;
        built=true;
      }
    }
    return mesh(geometry,color,x,y,z);
  };
}
