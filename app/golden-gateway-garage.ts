import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import landscape from '../public/data/waterfront-landscape.json' with {type:'json'};

type Plan=[number,number];
type Building={id:number;p:number[][]};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const garage=1177704958,eastPavilion=104682205;
const pavement='#bdb4a3',concrete='#aaa89b',wall='#98988f',flute='#87887e',bronze='#555950';
const deck=.425,street=.032,paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86});
const length=10.962,width=4.261;
// Local coordinates start at Davis and Clay: u towards Battery, v towards Washington.
const origin=[14.069,-20.319],den=Math.hypot(4.977,-9.767),ux=4.977/den,uz=-9.767/den;
function world(u:number,y:number,v:number):FacadePoint{return [origin[0]+ux*u-uz*v,y,origin[1]+uz*u+ux*v];}
function local([x,z]:number[]):Plan{return [(x-origin[0])*ux+(z-origin[1])*uz,-(x-origin[0])*uz+(z-origin[1])*ux];}
// The two original OSM bridge endpoints are explicit vertices on the same
// straight street edge of Gateway Center West. Retain the other 53 vertices.
const receivingLandings=[
  {u:1.849,v:5.646,y:.421,index:49},
  {u:8.438,v:5.660,y:.448,index:32},
];
const landingHalf=.179,landingDepth=1.42;
export function refineMaritimeLandings<T extends Building>(buildings:T[]):T[]{
  return buildings.map(b=>{
    if(b.id!==588365127)return b;
    const p=b.p.flatMap((pt,i)=>{
      const landing=receivingLandings.find(l=>l.index===i);
      if(!landing)return [pt];
      const {u,v}=landing;
      return [[u+landingHalf,v],[u+landingHalf,v+landingDepth],
        [u-landingHalf,v+landingDepth],[u-landingHalf,v]].map(([a,c])=>{
        const [x,,z]=world(a,0,c);return [x,z];
      });
    });
    return {...b,p};
  });
}
const tile=(a:number,b:number,c:number,d:number):Plan[]=>[[a,c],[b,c],[b,d],[a,d]];
// SF 2024 orthophoto and the city-mapped paths settle the handedness of both
// courts. The 2023 1.5 m DSM puts open paving near .42 and pavilion roofs at .75.
// https://www.som.com/projects/one-maritime-plaza/
// https://www.pwpla.com/projects/golden-gateway-center-alcoa-plaza-and-sidney-g-walton-square
// https://sfbos.org/sites/default/files/FileCenter/Documents/54562-Potential%20Washington%20Street%20Pedestrian%2C%20Bicycle%20and%20other%20Street%20Improvements.pdf
// https://lots.impark.com/IMP/en/details/27/50?csr=0
export function addGoldenGatewayGarage(b:Building,root:THREE.Group,windows:Pane[]){
  if(b.id!==garage&&b.id!==eastPavilion)return false;
  const batch=new FacadePanels();
  const point=(p:Plan,y:number)=>world(p[0],y,p[1]);
  function top(poly:Plan[],y:number,col:string){
    for(const [a,c,d] of THREE.ShapeUtils.triangulateShape(poly.map(p=>new THREE.Vector2(...p)),[]))
      batch.triangle(point(poly[a],y),point(poly[d],y),point(poly[c],y),col);
  }
  function solid(poly:Plan[],lo:number,hi:number,ink:string,surface=ink){
    let ring=poly;
    if(THREE.ShapeUtils.isClockWise(poly.map(p=>new THREE.Vector2(...p))))ring=poly.slice().reverse();
    for(let i=0;i<ring.length;i++){
      const a=ring[i],c=ring[(i+1)%ring.length];
      batch.quad(point(a,lo),point(a,hi),point(c,hi),point(c,lo),ink);
    }
    top(ring,hi,surface);
  }
  const block=(a:number,c:number,v:number,w:number,lo:number,hi:number,ink:string,surface=ink)=>
    solid(tile(a,c,v,w),lo,hi,ink,surface);
  function circle(u:number,v:number,r:number,lo:number,hi:number,ink:string,n=24){
    solid(Array.from({length:n},(_,i)=>[u+r*Math.cos(i*2*Math.PI/n),v+r*Math.sin(i*2*Math.PI/n)]),lo,hi,ink);
  }
  function pavilion(poly:Plan[],isEast:boolean){
    const ring=THREE.ShapeUtils.isClockWise(poly.map(p=>new THREE.Vector2(...p)))?poly.slice().reverse():poly;
    for(const [i,a] of ring.entries()){
      const c=ring[(i+1)%ring.length],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz);
      const at=(s:number,y:number,delta:number)=>world(a[0]+s*dx/len+dz/len*delta,y,a[1]+s*dz/len-dx/len*delta);
      const face=(l:number,r:number,lo:number,hi:number,o:number,col:string)=>
        batch.quad(at(l,lo,o),at(l,hi,o),at(r,hi,o),at(r,lo,o),col);
      face(0,len,deck,.476,-.016,'#837e6e');
      face(0,len,.476,.695,-.016,'#52615c');
      face(0,len,.695,.747,0,'#aea995');
      const bays=Math.max(1,Math.round(len/.17));
      for(let k=0;k<bays;k++){
        const l=k*len/bays,r=(k+1)*len/bays;
        face(l,l+.011,.476,.695,-.008,bronze);
        if((i+k)%4===0){
          const [x,y,z]=at((l+r)/2,.582,-.013),n=world(dz/len,0,-dx/len);
          windows.push({x,y,z,ry:Math.atan2(n[0]-origin[0],n[2]-origin[1]),w:r-l-.018,h:.20});
        }
      }
    }
    top(ring,.747,'#d4cdb9');
    for(const v of [.8,3.38]){
      const u=isEast?1.62:9.15;
      block(u-.17,u+.17,v-.15,v+.15,.747,isEast?.925:.895,'#a7a497','#c4bfad');
      block(u-.065,u+.065,v-.055,v+.055,isEast?.925:.895,isEast?.948:.920,'#96958b');
    }
  }
  if(b.id===eastPavilion){
    pavilion(b.p.slice(0,-1).map(local),true);
  }else{
    // Actual 2024 west pavilion plan: a pair of square end rooms and a
    // Battery-side connecting wing with the open courtyard facing the lawn.
    pavilion([[8.55,.32],[9.73,.32],[9.73,1.20],[10.52,1.20],[10.52,3.09],
      [9.73,3.09],[9.73,3.95],[8.55,3.95],[8.55,2.58],[9.50,2.58],[9.50,1.63],[8.55,1.63]],false);

    const stairs=[{u:4.28,north:false},{u:6.76,north:false},{u:4.24,north:true},{u:6.69,north:true}];
    const stairHalf=.11,run=1.03;
    // Subdivide around the open stairwells so the treads actually reach the street.
    const cuts=[0,...stairs.flatMap(s=>[s.u-stairHalf,s.u+stairHalf]),10.62,length].sort((a,c)=>a-c);
    for(let i=1;i<cuts.length;i++)for(const [lo,hi] of [[0,run],[run,1.27],[1.27,3.16],[3.16,width-run],[width-run,width]]){
      const mid=(cuts[i]+cuts[i-1])/2;
      if(mid>10.62&&lo===1.27)continue;
      if(stairs.some(s=>Math.abs(s.u-mid)<stairHalf&&(s.north?lo>=width-run:hi<=run)))continue;
      top(tile(cuts[i-1],cuts[i],lo,hi),deck,pavement);
    }
    for(const s of stairs){
      const steps=33,dir=s.north?-1:1,start=s.north?width:0;
      for(let k=0;k<steps;k++){
        const a=start+dir*k*run/steps,c=start+dir*(k+1)*run/steps;
        block(s.u-stairHalf,s.u+stairHalf,Math.min(a,c),Math.max(a,c),street-.006,street+(deck-street)*(k+1)/steps,'#a8a499','#c0b9aa');
      }
      for(const side of [-1,1]){
        const u=s.u+side*stairHalf;
        block(u-.011,u+.011,Math.min(start,start+dir*run),Math.max(start,start+dir*run),street,deck+.048,concrete);
      }
    }
    // The city street-level photograph shows paired horizontal bands of
    // vertical-fluted concrete, interrupted by recessed garage/access portals.
    for(const north of [false,true]){
      const v=north?width:0,sign=north?-1:1;
      const openings=[north?[2.72,3.33]:[2.72,3.35],north?[7.35,7.99]:[7.34,8.01]];
      const edge=(u:number,y:number,d:number)=>world(u,y,v+sign*d);
      function panel(l:number,r:number,lo:number,hi:number,d:number,tint:string){
        const [a,c]=north?[r,l]:[l,r];
        batch.quad(edge(a,lo,d),edge(a,hi,d),edge(c,hi,d),edge(c,lo,d),tint);
      }
      const portals=stairs.filter(s=>s.north===north).map(s=>[s.u-stairHalf,s.u+stairHalf]);
      const spans=[...portals,...openings,[4.48,6.46]].sort((a,c)=>a[0]-c[0]);
      let cursor=0;
      function fluted(l:number,r:number,lo:number,hi:number){
        panel(l,r,lo,hi,0,wall);
        const n=Math.max(1,Math.round((r-l)/.038));
        for(let k=1;k<n;k++){
          const x=l+(r-l)*k/n;
          panel(x,x+.0028,lo,hi,-.0016,flute);
        }
      }
      function wallBay(l:number,r:number){
        if(r<=l)return;
        fluted(l,r,street,.208);panel(l,r,.208,.223,.004,'#71756f');fluted(l,r,.223,deck);
      }
      for(const [l,r] of spans){
        wallBay(cursor,l);cursor=r;
        if(openings.some(([a])=>a===l)){
          fluted(l,r,.195,deck);
          panel(l,r,street,.195,.18,'#495052');
          for(const u of [l,r]){
            const [front,back]=u===l?[0,.18]:[.18,0];
            const order=north?[back,front]:[front,back];
            batch.quad(edge(u,street,order[0]),edge(u,.195,order[0]),edge(u,.195,order[1]),edge(u,street,order[1]),concrete);
          }
          const bounds=[v,v+sign*.18].sort((a,c)=>a-c);
          block(l,r,bounds[0],bounds[1],street-.008,street,'#87887c');
          for(const stop of [l+.11,r-.11])block(stop-.008,stop+.008,bounds[0]+.08,bounds[0]+.10,street,.095,'#bcaa6e');
        }else if(l===4.48){
          panel(l,r,street,deck,.075,'#56605e');
          for(let j=1;j<8;j++)panel(l+(r-l)*j/8-.009,l+(r-l)*j/8+.009,street,deck,.045,'#9b9b8f');
        }
      }
      wallBay(cursor,length);
      const joins=north?[1.85,8.44]:[2.42,8.5];
      const gaps=[...joins.map(u=>[u-.22,u+.22]),...portals].sort((a,c)=>a[0]-c[0]);
      cursor=0;
      for(const [l,r] of [...gaps,[length,length]]){
        if(l>cursor)panel(cursor,l,deck,deck+.051,0,concrete);
        cursor=r;
      }
    }
    block(-.006,.006,0,width,street,deck+.055,wall);
    for(const [a,c] of [[0,1.27],[3.16,width]])block(length-.006,length+.006,a,c,street,deck+.055,wall);
    // Battery has two branches up from a single street entry. The long
    // sides of this stair are parallel to Battery, as mapped in 727134927–931.
    for(const end of [1.27,3.16]){
      const start=2.16,steps=30;
      for(let k=0;k<steps;k++){
        const a=start+(end-start)*k/steps,c=start+(end-start)*(k+1)/steps;
        block(10.66,length,Math.min(a,c),Math.max(a,c),street-.009,street+(deck-street)*(k+1)/steps,'#a5a093','#bdb7a7');
      }
    }
    // Corresponding 104682204 and 727134923 bridges across Clay are built
    // by createEmbarcaderoCenter. Join their existing extended .503 landings.
    for(const u of [2.42,8.5]){
      batch.quad(world(u-.215,.503,.207),world(u-.215,deck,.83),world(u+.215,deck,.83),world(u+.215,.503,.207),pavement);

    }
    // Two Washington bridges, measured in the aerial at about 3.0 m wide.
    // Their opposite landings meet the Golden Gateway residential podium.
    for(const id of [104682192,104682199]){
      const path=landscape.paths.find(p=>p.id===id)!,ends=[local(path.p[0]),local(path.p.at(-1)!)].sort((a,c)=>a[1]-c[1]);
      const [a,c]=ends,half=.091;
      const landing=receivingLandings[id===104682192?0:1];
      const v1=a[1]-.025,v2=landing.v,lo=deck,hi=landing.y;
      const corners=[world(a[0]-half,lo,v1),world(c[0]-half,hi,v2),world(c[0]+half,hi,v2),world(a[0]+half,lo,v1)] as const;
      batch.quad(...corners,'#c1b9aa');
      for(const side of [-1,1]){
        const p=(t:number,d:number)=>world(a[0]+(c[0]-a[0])*t+side*half,lo+(hi-lo)*t+d,v1+(v2-v1)*t);
        const face=(start:number,end:number,low:number,high:number,color:string)=>{
          const l=p(start,low),r=p(end,low),h=p(end,high),j=p(start,high);
          batch.quad(l,r,h,j,color);batch.quad(j,h,r,l,color);
        };
        face(0,1,-.060,0,concrete);face(0,1,.064,.073,'#aca99c');
        for(let k=0;k<=20;k++)face(k/21,k/21+.008,0,.066,'#b8b5a9');
      }
    }
    // Preserve the rest of the existing .84 residential podium. The first
    // flat section is the measured open-air landing. A short transition
    // flight reconciles it to the higher modeled residential courtyard.
    for(const {u,v,y} of receivingLandings){
      const l=u-landingHalf,r=u+landingHalf,flat=.37;
      block(l,r,v,v+flat,street,y,concrete,pavement);
      const count=35,back=v+landingDepth,flight=landingDepth-flat-.11;
      for(let k=0;k<count;k++){
        const a=v+flat+flight*k/count,b=v+flat+flight*(k+1)/count;
        block(l,r,a,b,street,y+(.862-y)*(k+1)/count,concrete,pavement);
      }
      // Adjacent neighborhood model carries an existing low parapet coping.
      // A short stone threshold crosses it and slopes down to the courtyard.
      top(tile(l,r,back-.111,back+.075),.868,pavement);
      batch.quad(world(l,.868,back+.075),world(l,.841,back+.31),world(r,.841,back+.31),world(r,.868,back+.075),pavement);
    }
    // Square sculpture court with a round fountain across the tower from
    // the square west lawn and four formal clipped-tree garden rooms.
    top(tile(2.63,4.20,1.32,2.89),deck+.004,'#aba18c');
    circle(3.415,2.12,.54,deck+.004,deck+.03,'#a69c86',40);
    circle(3.415,2.12,.49,deck+.03,deck+.032,'#596f68',40);
    circle(3.415,2.12,.30,deck+.032,deck+.046,'#858e78',32);
    circle(3.415,2.12,.215,deck+.046,deck+.052,'#728981');
    top(tile(6.65,8.10,1.39,2.82),deck+.014,'#829169');
    function crown(u:number,v:number,h:number,r:number){
      circle(u,v,.026,deck,deck+h*.72,'#827865',6);
      const poly=(radius:number):Plan[]=>Array.from({length:8},(_,i)=>[u+radius*Math.cos(i*Math.PI/4),v+radius*Math.sin(i*Math.PI/4)]);
      const lower=poly(r*.71),upper=poly(r);
      for(let k=0;k<8;k++){
        const j=(k+1)%8;
        batch.quad(point(lower[k],deck+h*.56),point(upper[k],deck+h*.85),point(upper[j],deck+h*.85),point(lower[j],deck+h*.56),'#71815c');
        batch.triangle(point(upper[k],deck+h*.85),world(u,deck+h,v),point(upper[j],deck+h*.85),'#80906c');
      }
    }
    for(const u of [3.34,7.44])for(const v of [.61,3.68]){
      top(tile(u-.64,u+.64,v-.52,v+.52),deck+.008,'#879374');
      top(tile(u-.29,u+.29,v-.29,v+.29),deck+.011,'#bdb5a0');
      for(const side of [-1,1])for(let k=-2;k<=2;k++)crown(u+k*.21,v+side*.47,.38+(k%2)*.022,.148);
      for(const side of [-1,1])for(let k=-1;k<=1;k++)crown(u+side*.56,v+k*.21,.39,.155);
    }
    for(const u of [.33,10.36])for(const v of [.52,3.70]){
      circle(u,v,.32,deck,deck+.012,'#c6bda7');
      circle(u,v,.17,deck+.012,deck+.018,'#899775');crown(u,v,.38,.125);
    }
  }
  const mesh=batch.mesh(paint);mesh.name=b.id===garage?'Golden Gateway Garage and Maritime Plaza':'Maritime Plaza east pavilion';
  root.add(mesh);return true;
}
