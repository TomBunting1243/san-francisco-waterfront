import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Pair=readonly [number,number];
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.57});
export const spearCanopyGlassName='188 Spear glass entrance canopy';
const canopyGlass=new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,opacity:.54,depthWrite:false,
  side:THREE.DoubleSide,roughness:.36});
canopyGlass.forceSinglePass=true;

// 2024 rectified survey plate, seven pixels per metre; Howard at bottom,
// Spear on right. The 2023 wall returns put the Spear plane at u=2322–2326.
const plate=(u:number,v:number):Pair=>[-27.00800104+.0012973094*u-.0084729829*v,-33.37263659+.0084728164*u+.0012965840*v];
const ring:Pair[]=[[2319,135],[2084.6,135.4],[2078.2,127.2],[2080.2,-200.6],
  [2086.3,-206],[2319,-207],[2324,-201],[2324,128]].map(([u,v])=>plate(u,v));
const brick='#a86f55',lightBrick='#bd8464',deepBrick='#744e41',limestone='#c4b69d';
const smoked='#49565b',silver='#8a9a9c',upperGlass='#527488',ground=.045;
const height=(metres:number)=>ground+metres*.06;

export function add188Spear(b:{id:number},root:THREE.Group,windows:Window[]){
  if(b.id!==192026937)return false;
  const shell=new FacadePanels(),glazing=new FacadePanels();
  // No night photograph establishes the luminance. Warm interior glazing and its
  // reflected return light are an interpretation of the daylight lobby photographs.
  type Glow=readonly [number,number,number,number];
  const litFaces:{first:number;red:Glow}[]=[];
  function lightFace(red:Glow){
    litFaces.push({first:shell.positions.length/3-4,red});
  }
  const level=(p:Pair,y:number):FacadePoint=>[p[0],y,p[1]];
  function cap(poly:Pair[],y:number,color:string){
    for(let i=1;i<poly.length-1;i++)shell.triangle(level(poly[0],y),level(poly[i+1],y),level(poly[i],y),color);
  }
  const transition=height(32.5),top=height(49.28),roof=height(48.35);
  for(let edge=0;edge<ring.length;edge++){
    const [x,z]=ring[edge],[xx,zz]=ring[(edge+1)%ring.length],len=Math.hypot(xx-x,zz-z),tx=(xx-x)/len,tz=(zz-z)/len;
    const at=(s:number,y:number,d=0):FacadePoint=>[x+tx*s+tz*d,y,z+tz*s-tx*d];
    const wall=(a:number,b:number,lo:number,hi:number,d:number,c:string,glow?:Glow)=>{
      shell.quad(at(a,lo,d),at(a,hi,d),at(b,hi,d),at(b,lo,d),c);
      if(glow)lightFace(glow);
    };
    const horizontal=(a:number,b:number,y:number,far:number,near:number,c:string)=>
      shell.quad(at(a,y,near),at(a,y,far),at(b,y,far),at(b,y,near),c);
    function reveal(a:number,b:number,lo:number,hi:number,back:number,lit:boolean){
      shell.quad(at(a,lo),at(a,hi),at(a,hi,back),at(a,lo,back),deepBrick);
      if(lit)lightFace([3,7,30,15]);
      shell.quad(at(b,lo,back),at(b,hi,back),at(b,hi),at(b,lo),deepBrick);
      if(lit)lightFace([15,30,7,3]);
      shell.quad(at(a,hi),at(b,hi),at(b,hi,back),at(a,hi,back),deepBrick);
      if(lit)lightFace([7,7,34,34]);
    }
    if(edge%2){
      wall(0,len,0,transition,0,brick);wall(0,len,transition,top,0,upperGlass);
      wall(0,len,top-.023,top,.0008,silver);continue;
    }
    const bays=edge%4===0?6:8,pitch=len/bays;
    for(let bay=0;bay<bays;bay++){
      const a=bay*pitch,b=a+pitch,jamb=.029,l=a+jamb,r=b-jamb;
      const portal=edge===6&&bay>=3&&bay<=5,alley=edge===2;
      const stone=portal?limestone:brick;
      const door=portal||alley&&bay===1;
      const groundHead=height(4.2),back=alley?-.055:portal?-.096:-.033;
      wall(a,l,0,groundHead,0,stone,portal?[1,2,7,3]:undefined);
      wall(r,b,0,groundHead,0,stone,portal?[3,7,2,1]:undefined);
      reveal(l,r,0,groundHead,back,portal);
      wall(l,r,0,groundHead,back,alley&&bay===1?'#292a26':'#454c4b',portal?[36,57,61,40]:undefined);
      if(door){
        wall(l,r,ground,ground+.009,back+.002,silver);
        wall(l,r,height(2.55),height(2.63),back+.002,'#635f55');
        if(portal)wall((l+r)/2-.002,(l+r)/2+.002,ground,height(2.55),back+.002,silver);
        else {
          // The East Cut field photograph shows one open glass door in the near passage bay.
          const mid=(l+r)/2;
          shell.quad(at(mid,ground,back+.002),at(mid,height(2.45),back+.002),
            at(mid+.038,height(2.45),-.004),at(mid+.038,ground,-.004),'#726c5f');
        }
      }else{
        wall((l+r)/2-.003,(l+r)/2+.003,ground,groundHead,back+.0015,silver);
      }
      const head=height(8.3);
      for(let floor=1;floor<12;floor++){
        const addition=floor>=8,last=floor===11;
        const lo=floor===1?groundHead:floor<8?head+(transition-head)*(floor-2)/6:transition+(top-transition)*(floor-8)/4;
        const hi=floor===1?head:floor<8?head+(transition-head)*(floor-1)/6:transition+(top-transition)*(floor-7)/4;
        const corner=addition&&(bay===0||bay===bays-1);
        const frame=last?silver:addition?lightBrick:brick;
        const side=last?.006:corner?.007:jamb;
        const left=a+side,right=b-side;
        const sill=lo+(hi-lo)*(last?.07:floor===8?.14:floor===9?.035:.25);
        if(portal&&floor===1){
          // Three adjoining pale-stone arches over the real Spear sidewalk entrance.
          wall(a,l,lo,hi,0,limestone,[5,0,2,10]);wall(r,b,lo,hi,0,limestone,[10,2,0,5]);
          wall(l,r,lo,hi,-.039,smoked,[46,24,26,50]);
          for(let k=0;k<12;k++){
            const arch=(t:number)=>at(l+(r-l)*t,lo+(hi-lo)*(.25+.63*Math.sqrt(Math.max(0,1-(2*t-1)**2))));
            const p=arch(k/12),q=arch((k+1)/12);
            shell.quad(p,[p[0],hi,p[2]],[q[0],hi,q[2]],q,limestone);
            lightFace([10,1,1,10]);
          }
          continue;
        }
        wall(a,left,lo,hi,0,frame);wall(right,b,lo,hi,0,frame);
        wall(left,right,lo,sill,0,last||floor===9?silver:frame);
        const glass=addition?upperGlass:smoked;
        wall(left,right,sill,hi,-.005,glass);
        for(let leaf=0;leaf<3;leaf++){
          const width=(right-left)/3,start=left+leaf*width;
          if(leaf)wall(start-.0021,start+.0021,sill,hi,-.002,silver);
          if((bay*13+edge+floor*7+leaf*5)%17===2){
            const [wx,wy,wz]=at(start+width/2,(sill+hi)/2,-.0037);
            windows.push({x:wx,y:wy,z:wz,ry:Math.atan2(tz,-tx),w:width-.007,h:hi-sill-.008});
          }
        }
      }
    }
    if(edge===6){
      const l=3*pitch+.012,r=6*pitch-.012,y=height(4.20),reach=.141;
      const panels=12;
      for(let i=0;i<panels;i++){
        const a=l+(r-l)*i/panels,b=l+(r-l)*(i+1)/panels;
        glazing.quad(at(a+.002,y,.002),at(b-.002,y,.002),at(b-.002,y,reach),at(a+.002,y,reach),'#c4d2cb');
        horizontal(a,a+.005,y+.001,-.015,reach,'#a8ac9f');
        if(i%2===0){
          const upper=at(a,height(5.05)),lower=at(a,y,reach*.88);
          shell.quad([upper[0]-tx*.0018,upper[1],upper[2]-tz*.0018],[upper[0]+tx*.0018,upper[1],upper[2]+tz*.0018],
            [lower[0]+tx*.0018,lower[1],lower[2]+tz*.0018],[lower[0]-tx*.0018,lower[1],lower[2]-tz*.0018],'#a4a798');
        }
      }
      wall(l,r,y-.006,y+.002,reach,'#a7aca3');
      // Individual metal numerals sit above the glass at its Howard end.
      const charHeight=.020,base=y+.003,first=r-.068,digit=.012;
      wall(first+.003,first+.006,base,base+charHeight,reach-.017,'#c1c2b9');
      for(const center of [first+digit*1.7,first+digit*3.0]){
        for(const dy of [.005,.014]){
          for(let k=0;k<10;k++){
            const band=(i:number,scale:number)=>at(center+.0048*scale*Math.cos(i*Math.PI/5),base+dy+.0054*scale*Math.sin(i*Math.PI/5),reach-.017);
            shell.quad(band(k,.55),band(k+1,.55),band(k+1,1),band(k,1),'#c1c2b9');
          }
        }
      }
    }
    wall(0,len,top-.020,top,.001,silver);
  }
  // The roof perimeter sits below its central plant enclosure in the 2023 scan.
  const cx=ring.reduce((s,p)=>s+p[0],0)/ring.length,cz=ring.reduce((s,p)=>s+p[1],0)/ring.length;
  const inner:Pair[]=ring.map(([x,z])=>[cx+(x-cx)*.987,cz+(z-cz)*.987]);
  ring.forEach((p,i)=>{
    const j=(i+1)%ring.length;
    shell.quad(level(p,top),level(inner[i],top),level(inner[j],top),level(ring[j],top),silver);
    shell.quad(level(inner[j],roof),level(inner[j],top),level(inner[i],top),level(inner[i],roof),smoked);
  });
  cap(inner,roof,'#b6b6aa');
  const plant=[plate(2130,23),plate(2130,-128),plate(2254,-128),plate(2254,23)];
  plant.forEach((p,i)=>{
    const q=plant[(i+1)%plant.length];shell.quad(level(p,roof),level(p,height(53.8)),level(q,height(53.8)),level(q,roof),'#a8a99f');
  });
  cap(plant,height(53.8),'#b6b7ad');
  const building=shell.mesh(material);building.name='188 Spear Street';
  const energy=new Uint8Array(shell.positions.length);
  for(const {first,red} of litFaces){
    red.forEach((r,i)=>{
      const j=(first+i)*3;energy[j]=r;energy[j+1]=Math.round(r*.735);energy[j+2]=Math.round(r*.45);
    });
  }
  building.geometry.setAttribute('signLight',new THREE.BufferAttribute(energy,3,true));
  const canopy=glazing.mesh(canopyGlass);canopy.name=spearCanopyGlassName;canopy.castShadow=false;
  root.add(building,canopy);return true;
}
