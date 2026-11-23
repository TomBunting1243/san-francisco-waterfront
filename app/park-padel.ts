import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

// Two original 20 × 10 m interiors registered to the SF p2024_rgb8cm ortho.
// Eight corners shared with Park Padel's Hyatt-facing aerial locate court 3.
// SF Rec & Park dates its installation to Oct 2024, before fountain removal.
// https://www.sfrecpark.org/m/newsflash/home/detail/2115
// https://parkpadel.com/clubs/san-francisco
export const padelSites=[
  {name:'Round landing',x:3.2375,z:-8.15625,angle:2.374,turf:'#99ad54',skirt:'#637938',rise:.32},
  {name:'Fountain',x:4.16875,z:-9.125,angle:-42.075,turf:'#a2b64e',skirt:'#637938',rise:.34},
  {name:'October 2024',x:3.5275,z:-9.5149,angle:-42.075,turf:'#a5b994',skirt:'#3d4640',rise:.20},
] as const;
const unit=.06,metal='#43504a',white='#e4e5d4';
export const padelScreenName='Park Padel glass, wire cages and nets';

function screenMaterial(){
  const mat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.54,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  mat.forceSinglePass=true;
  mat.onBeforeCompile=s=>{
    s.vertexShader='attribute float panelType; varying float type; varying vec2 metres;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntype=panelType; metres=uv;');
    s.fragmentShader='varying float type; varying vec2 metres;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      if(type<.5){
        float facing=abs(dot(normalize(vViewPosition),normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition)))));
        diffuseColor=vec4(.57,.71,.65,.055+.13*pow(1.-facing,3.));
      }else{
        vec2 grid=metres/(type>1.5?.045:.05), fw=max(fwidth(grid),vec2(.002));
        vec2 dist=abs(fract(grid+.5)-.5);
        vec2 strands=mix(1.-smoothstep(vec2(.033)-fw*.5,vec2(.033)+fw*.5,dist),vec2(.066),smoothstep(.24,.9,fw));
        diffuseColor=vec4(.075,.095,.081,1.-(1.-strands.x)*(1.-strands.y));
      }`);
  };
  mat.customProgramCacheKey=()=>'park-padel-glass-wire-v1';return mat;
}

export function addParkPadel(plaza:THREE.Group,ground:(x:number,z:number)=>number){
  const screens=new FacadePanels(),uv:number[]=[],kinds:number[]=[];
  const opaque=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86});
  for(const site of padelSites){
    const a=THREE.MathUtils.degToRad(site.angle),c=Math.cos(a),s=Math.sin(a);
    const xy=(l:number,w:number)=>[site.x+unit*(c*l-s*w),site.z+unit*(s*l+c*w)] as const;
    const corners=[[-10,-5],[-10,5],[10,5],[10,-5]];
    const levels=corners.map(([l,w])=>ground(...xy(l,w)));
    const y=Math.max(...levels)+unit*site.rise;
    const xyz=(l:number,h:number,w:number):FacadePoint=>{const [x,z]=xy(l,w);return [x,y+unit*h,z];};
    const court=new THREE.Group();court.name='Park Padel · '+site.name;plaza.add(court);
    function add(p:FacadePanels,name:string){const m=p.mesh(opaque);m.name=name;court.add(m);}
    const floor=new FacadePanels(),lines=new FacadePanels(),frames=new FacadePanels();
    const tops=corners.map(([l,w])=>xyz(l,0,w));
    floor.quad(tops[0],tops[1],tops[2],tops[3],site.turf);
    for(let i=0;i<4;i++){
      const j=(i+1)%4,lo=(k:number):FacadePoint=>[tops[k][0],levels[k]-.0003,tops[k][2]];
      floor.quad(tops[j],tops[i],lo(i),lo(j),site.skirt);
    }
    add(floor,'Supported turf and skirt');
    function stripe(l:number,r:number,b:number,t:number){
      lines.quad(xyz(l,.003,b),xyz(l,.003,t),xyz(r,.003,t),xyz(r,.003,b),white);
    }
    for(const line of [-6.95,6.95])stripe(line-.025,line+.025,-5,5);
    stripe(-7.15,7.15,-.025,.025);add(lines,'Padel service lines');
    function beam(start:FacadePoint,end:FacadePoint,width:number,depth:number,paint=metal){
      const p=new THREE.Vector3(...start),q=new THREE.Vector3(...end),v=q.clone().sub(p).normalize();
      const u=new THREE.Vector3().crossVectors(v,Math.abs(v.y)>.95?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).setLength(width*unit/2);
      const w=new THREE.Vector3().crossVectors(v,u).setLength(depth*unit/2);
      const ring=(center:THREE.Vector3)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>center.clone().addScaledVector(u,i).addScaledVector(w,j).toArray() as FacadePoint);
      const lo=ring(p),hi=ring(q);
      for(let k=0;k<4;k++){const j=(k+1)%4;frames.quad(lo[k],lo[j],hi[j],hi[k],paint);}
      frames.quad(hi[0],hi[1],hi[2],hi[3],paint);
    }
    function panel(l:number,w:number,r:number,t:number,base:number,top:number,kind:number,endTop=top){
      const length=Math.hypot(r-l,t-w);
      screens.quad(xyz(l,base,w),xyz(r,base,t),xyz(r,endTop,t),xyz(l,top,w),'#ffffff');
      uv.push(0,base,length,base,length,endTop,0,top);kinds.push(kind,kind,kind,kind);
    }
    // The Aug 2025 plaza photo resolves transparent panoramic end glass, a
    // metal mesh crown, dark corner standards, and the raised green platform.
    // https://embarcaderoplaza.com/tour/padel-courts
    for(const end of [-10,10]){
      panel(end,-5,end,5,0,3,0);panel(end,-5,end,5,3,4,1);
      for(const h of [3,4])beam(xyz(end,h,-5),xyz(end,h,5),.075,.075);
      for(const w of [-5,5])beam(xyz(end,0,w),xyz(end,4,w),.10,.10);
      for(const w of [-3,-1,1,3]){
        beam(xyz(end,3,w),xyz(end,4,w),.035,.035);
        beam(xyz(end,0,w),xyz(end,3,w),.012,.012,'#798c7d');
      }
    }
    for(const edge of [-5,5]){
      for(const sign of [-1,1]){
        panel(10*sign,edge,6*sign,edge,0,3,0);
        panel(10*sign,edge,6*sign,edge,3,4,1);
        panel(6*sign,edge,1*sign,edge,0,3,1);
        beam(xyz(10*sign,4,edge),xyz(6*sign,4,edge),.065,.065);
        beam(xyz(10*sign,3,edge),xyz(6*sign,3,edge),.065,.065);
        for(const l of [1,3.5,6])beam(xyz(l*sign,0,edge),xyz(l*sign,l===6?4:3,edge),.07,.07);
      }
      beam(xyz(-6,3,edge),xyz(6,3,edge),.065,.065);
      panel(-1,edge,1,edge,2.2,3,1);
      beam(xyz(-1,2.2,edge),xyz(1,2.2,edge),.06,.06);
      beam(xyz(0,0,edge),xyz(0,.94,edge),.085,.085);
    }
    for(let w=-5;w<5;w++){
      const height=(d:number)=>.88+.04*(d/5)**2;
      panel(0,w,0,w+1,.012,height(w),2,height(w+1));
      beam(xyz(0,height(w)-.018,w),xyz(0,height(w+1)-.018,w+1),.018,.035,white);
    }
    add(frames,'Cage frame and net tape');
  }
  const mesh=screens.mesh(screenMaterial());
  mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  mesh.geometry.setAttribute('panelType',new THREE.Uint8BufferAttribute(kinds,1));
  mesh.name=padelScreenName;plaza.add(mesh);
}
