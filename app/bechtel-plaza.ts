import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type P=[number,number];
const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82});
const paving=.046,brick='#a87965',concrete='#b6b0a0',seat='#c3bba8';
const rect=(x:number,z:number,X:number,Z:number):P[]=>[[x,z],[X,z],[X,Z],[x,Z]];
const circle=(x:number,z:number,r:number,n=10):P[]=>Array.from({length:n},(_,i)=>[x+r*Math.cos(i*2*Math.PI/n),z+r*Math.sin(i*2*Math.PI/n)]);
// Registration in the City 2017 & 2024 orthophotos. Local u points along
// Beale toward Market, v toward the street. The 2017 car roof is fully visible.
// https://sfplanninggis.org/1938/ • https://www.davisconstruction.com/projects/all-projects/waateekaa-historic-railcar
export function addBechtelPlaza(park:{name:string;p:number[][]},root:THREE.Group){
  if(park.name!=='50 Beale Street Plaza')return false;
  const origin=park.p[3],[ax,az]=park.p[5],len=Math.hypot(ax-origin[0],az-origin[1]);
  const c=(ax-origin[0])/len,s=(az-origin[1])/len;
  const world=([u,v]:P,y:number):FacadePoint=>[origin[0]+c*u-s*v,y,origin[1]+s*u+c*v];
  const f=new FacadePanels();
  function top(r:P[],y:number,tone:string){
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(r.map(([u,v])=>new THREE.Vector2(u,v)),[]))
      f.triangle(world(r[a],y),world(r[c],y),world(r[b],y),tone);
  }
  function solid(r:P[],lo:number,hi:number,wall:string,roof=wall){
    r.forEach((a,i)=>{const b=r[(i+1)%r.length];f.quad(world(a,lo),world(a,hi),world(b,hi),world(b,lo),wall);});
    top(r,hi,roof);
  }
  const outline=park.p.slice(0,-1).map(([x,z]):P=>[(x-origin[0])*c+(z-origin[1])*s,-(x-origin[0])*s+(z-origin[1])*c]);
  top(outline,paving,brick);
  const px=(x:number,y:number):P=>[(x-40)/200,(y-40)/200];
  const trace=(pts:P[])=>pts.map(([x,y])=>px(x,y));
  function slab(x:number,z:number,X:number,Z:number,lo:number,hi:number,tone:string,roof=tone){
    solid(trace(rect(x,z,X,Z)),lo,hi,tone,roof);
  }
  // Exposed aggregate inset into the brick grid. Running brick paths carry
  // through to both entries and to the diagonal museum display.
  for(const [a,b] of [[126,208],[218,288],[299,354],[365,433]]){
    for(const [l,r] of [[323,370],[381,429]])top(trace(rect(a,l,b,r)),paving+.001,concrete);
  }
  for(const [a,b] of [[116,215],[226,321],[332,432]])top(trace(rect(a,86,b,110)),paving+.001,concrete);
  const beds:P[][]=[
    [[125,132],[324,132],[343,113],[348,119],[214,254],[181,267],[125,267]],
    [[356,216],[417,153],[435,153],[435,216]],
    rect(130,449,431,524),rect(496,118,553,293),rect(496,305,553,436),rect(496,455,553,524),
    [[272,345],[296,314],[346,305],[372,331],[366,372],[333,390],[282,381]]
  ];
  beds.forEach(r=>{
    const poly=trace(r),cx=poly.reduce((a,p)=>a+p[0],0)/r.length,cz=poly.reduce((a,p)=>a+p[1],0)/r.length;
    solid(poly,paving,paving+.032,'#b4ac9b',seat);
    top(poly.map(([x,z])=>[cx+(x-cx)*.92,cz+(z-cz)*.88]),paving+.033,'#677257');
  });
  // Three freestanding planters in the aggregate seating court (2024 aerial).
  for(const [x,z] of [[422,365],[407,378],[419,401]]){
    solid(circle(...px(x,z),.018),paving,paving+.03,'#aa9c8a','#777052');
    solid(circle(...px(x,z),.014),paving+.03,paving+.05,'#79815a','#909362');
  }
  for(const [x,z] of [[166,136],[286,136],[151,442],[370,442]]){
    slab(x,z,x+28,z+5,.059,.074,'#817464','#9e8d74');
    for(const X of [x+4,x+22])slab(X,z+1,X+2,z+4,paving,.059,'#635e53');
  }
  // Northern garage entry runs alongside the court (municipal DPR, 30 Beale).
  // Render its descending lane mouth with two low concrete cheeks at the edge.
  top(trace(rect(566,277,594,420)),paving+.001,'#726f68');
  slab(563,275,566,422,paving,.096,'#aaa393',seat);
  slab(594,275,597,422,paving,.096,'#aaa393',seat);
  // The city/OSM tree inventories have no anchors within this park. The plum
  // row, side beds and separate taller green crown follow the aerial clusters.
  function tree(x:number,z:number,h:number,r:number,seed:number,tones:string[]){
    const [u,v]=px(x,z),base=paving+.033;
    solid(circle(u,v,.008,6),base,base+h*.71,'#776b57');
    for(let b=0;b<4;b++){
      const a=b*2.4+seed,X=u+Math.cos(a)*r*.26,Z=v+Math.sin(a)*r*.29,H=base+h*(.73+.07*Math.sin(a));
      const trunk=world([u,v],base+h*.38);
      f.triangle(trunk,world([X-.008,Z],H),world([X+.008,Z],H),'#766c56');
      const layers=[[-.26,.15],[-.19,.64],[-.06,.85],[.10,.75],[.20,.33],[.23,.02]];
      const p=(j:number,k:number)=>{
        const w=(k%8)*Math.PI/4+a,R=r*layers[j][1]*(1+.09*Math.sin(5*w+seed+j*.47));
        return world([X+R*Math.cos(w),Z+R*Math.sin(w)*.88],H+h*layers[j][0]);
      };
      for(let j=1;j<layers.length;j++)for(let k=0;k<8;k++)
        f.quad(p(j-1,k),p(j,k),p(j,k+1),p(j-1,k+1),tones[(k+b+(j>3?1:0))%tones.length]);
    }
  }
  const purple=['#6c5e57','#73635e','#786a62','#705c59'];
  const green=['#738755','#809453','#839953','#6f8351'];
  [[157,487],[211,484],[267,488],[322,485],[378,484],[419,486]].forEach(([x,z],i)=>tree(x,z,.282+.012*(i%3),.19,i,purple));
  [[520,160],[521,227],[521,274],[520,338],[520,402],[521,488]].forEach(([x,z],i)=>tree(x,z,.225,.135,i+9,purple));
  tree(326,351,.412,.273,20,green);
  tree(158,202,.284,.145,21,green);tree(217,180,.255,.14,22,green);
  tree(396,196,.166,.085,23,green);
  // Museum outline in the historical aerial is diagonal; near observation
  // deck faces the Beale/300 Mission side. DAVIS measured 61 ft over ends.
  const center=px(301,215),h=Math.SQRT1_2,carLength=61*.3048*.06,width=.183;
  const car=(l:number,v:number):P=>[center[0]+(l+v)*h,center[1]+(-l+v)*h];
  const carWorld=(l:number,v:number,y:number)=>world(car(l,v),paving+y);
  const body=(l:number,v:number,L:number,V:number,lo:number,hi:number,tone:string,roof=tone)=>
    solid(rect(l,v,L,V).map(([x,z])=>car(x,z)),paving+lo,paving+hi,tone,roof);
  const half=carLength/2,near=-half+.080,far=half-.029,side=width/2;
  for(const v of [-.043,.043]){
    body(-half-.045,v-.003,half+.045,v+.003,.001,.008,'#544d40');
    for(const l of [-.37,-.32,-.27,.27,.32,.37]){
      const wheel=(i:number)=>{const a=i*Math.PI/5;return carWorld(l+.025*Math.cos(a),v+Math.sign(v)*.015,.034+.025*Math.sin(a));};
      for(let i=0;i<10;i++)f.triangle(carWorld(l,v+Math.sign(v)*.015,.034),wheel(v<0?i+1:i),wheel(v<0?i:i+1),'#373837');
    }
  }
  for(const l of [-.38,.26])body(l,-.065,l+.119,.065,.035,.068,'#3e403d');
  body(-half,-side,half,side,.067,.085,'#403f3c');
  body(near,-side,far,side,.085,.215,'#734e43','#695046');
  const sideWindow=(l:number,w:number,v:number,arched:boolean)=>{
    const p=(x:number,y:number)=>carWorld(x,v,y),sign=v>0?1:-1;
    const quad=(a:FacadePoint,b:FacadePoint,c:FacadePoint,d:FacadePoint,t:string)=>sign>0?f.quad(a,b,c,d,t):f.quad(d,c,b,a,t);
    quad(p(l-w,.121),p(l+w,.121),p(l+w,.182),p(l-w,.182),'#435052');
    for(let i=0;i<6;i++){
      const a=Math.PI*i/6,b=Math.PI*(i+1)/6;
      const x=p(l,.182),y=p(l+w*Math.cos(a),.182+(arched?.019:.009)*Math.sin(a)),z=p(l+w*Math.cos(b),.182+(arched?.019:.009)*Math.sin(b));
      if(sign>0)f.triangle(x,y,z,'#525950');else f.triangle(x,z,y,'#525950');
    }
    quad(p(l-w-.003,.118),p(l+w+.003,.118),p(l+w+.003,.122),p(l-w-.003,.122),'#a18b75');
  };
  for(const v of [-side-.0008,side+.0008]){
    for(let i=0;i<11;i++)sideWindow(near+.057+i*.085,[1,3,4,9].includes(i)?.014:.028,v,true);
  }
  // Original signwriting on both sides of the Pullman. Stroke lettering keeps
  // the markings on the car as it is batched with the plaza.
  const glyphs:Record<string,string[]>={W:['00 13 21 33 40'],A:['03 20 43','12 32'],B:['03 00 30 41 31 01','31 42 33 03'],E:['40 00 03 43','01 31'],C:['40 10 01 02 13 43'],H:['00 03','40 43','02 42'],T:['00 40','20 23'],L:['00 03 43'],O:['10 30 41 42 33 13 02 01 10'],K:['00 03','40 02','21 43'],'.':['23 33']};
  function letters(text:string,cy:number,scale:number,v:number){
    const step=6*scale,start=-(text.length-1)*step/2-2*scale;
    for(const [i,ch] of [...text].entries())for(const stroke of glyphs[ch]??[]){
      const coords=stroke.split(' ').map(d=>[start+i*step+Number(d[0])*scale,cy-Number(d[1])*scale]);
      for(let j=1;j<coords.length;j++){
        const [x,y]=coords[j-1],[X,Y]=coords[j],r=.25*scale/Math.hypot(X-x,Y-y),dx=(Y-y)*r,dy=(x-X)*r;
        const p=(l:number,h:number)=>carWorld(v<0?-l:l,v,h);
        f.quad(p(x+dx,y+dy),p(X+dx,Y+dy),p(X-dx,Y-dy),p(x-dx,y-dy),'#d4c8ad');
      }
    }
  }
  for(const v of [-side-.001,side+.001]){letters('W.A. BECHTEL CO.',.213,.0028,v);letters('WAATEEKAA',.112,.0017,v);}
  // Overhanging pale rolled roof edges step up to a tall, narrower clerestory.
  const roofProfile=[[-.103,.213],[-.103,.218],[-.087,.23],[-.061,.237],[-.056,.25],[-.043,.262],[0,.268],[.043,.262],[.056,.25],[.061,.237],[.087,.23],[.103,.218],[.103,.213]];
  for(let i=1;i<roofProfile.length;i++){
    const [a,A]=roofProfile[i-1],[b,B]=roofProfile[i],tone=(i===4||i===9)?'#684d44':'#cdcac0';
    f.quad(carWorld(-half,a,A),carWorld(-half,b,B),carWorld(half,b,B),carWorld(half,a,A),tone);
    for(const l of [-half,half]){
      const q=carWorld(l,0,.211),p=carWorld(l,a,A),r=carWorld(l,b,B);
      if(l<0)f.triangle(q,r,p,'#b9b5ab');else f.triangle(q,p,r,'#b9b5ab');
    }
  }
  for(const end of [-half+.005,half-.005]){
    body(end-.003,-side,end+.003,side,.135,.14,'#4a4842');
    for(let k=0;k<7;k++)body(end-.002,-side+k*side/3-.0016,end+.002,-side+k*side/3+.0016,.084,.14,'#4c4942');
  }
  for(const z of [-side,side]){body(-half,z-.002,near,z+.002,.136,.14,'#44443f');body(near-.005,z-.003,near,z+.003,.085,.214,'#57473e');}
  for(const sign of [-1,1])for(let i=0;i<6;i++){
    const l=-half-.035+i*(carLength+.07)/5;
    solid(circle(...car(l,sign*.135),.0025,6),paving,paving+.049,'#9a865a');
    if(i<5){
      const span=(carLength+.07)/5;
      for(let k=0;k<4;k++){
        const end=(n:number,y:number)=>carWorld(l+n*span/4,sign*.135,.046-.017*Math.sin(Math.PI*n/4)+y);
        if(sign>0)f.quad(end(k,0),end(k+1,0),end(k+1,.0017),end(k,.0017),'#655c4a');
        else f.quad(end(k,.0017),end(k+1,.0017),end(k+1,0),end(k,0),'#655c4a');
      }
    }
  }
  const mesh=f.mesh(paint);mesh.name='Bechtel Plaza and WaaTeeKaa';root.add(mesh);return true;
}
