import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import {howardBealePlate} from './howard-beale-through.ts';
import {setPackedNormals} from './packed-normals.ts';

type Surface=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
const width=6.23,end=47.7;
const westLamps=Array.from({length:8},(_,i)=>1.63+4.965*i);
const eastLamps=Array.from({length:8},(_,i)=>1.79+5.855*i);
const lights=[...westLamps.map(s=>[.27,s]),...eastLamps.map(s=>[width-.27,s])];

// Horizontal metres measured from the 180 Howard wall and the municipal
// sidewalk's rear edge. Slope and rotation follow the v65 municipal plate.
// The facing 188 Spear piers have 5.85 m bays; 180 Howard has 4.97 m bays.
export function courtyardPoint(w:number,s:number,h=0):FacadePoint{
  const u=2034.54+.038*s+7*w;
  const v=141.416422-(u-1732.986722)*.00528189-7*s;
  const [x,z]=howardBealePlate(u,v);
  return [x,.045+h*.06,z];
}

// The East Cut's 2019 inventory p.36 and its second field view show the
// different aisles on either side of the pots and both rows of wall lanterns.
// https://www.theeastcut.org/open-space/120-howard-st/
export function addHowardPublicCourtyard(mesh:Surface){
  const f=new FacadePanels(),energy:number[]=[];
  type P=[number,number,number]; // metres across, into the passage, above the finished surface
  function quad(a:P,b:P,c:P,d:P,color:string,light:P=[0,0,0]){
    f.quad(courtyardPoint(...a),courtyardPoint(...b),courtyardPoint(...c),courtyardPoint(...d),color);
    for(let i=0;i<4;i++)energy.push(...light);
  }
  function tri(a:P,b:P,c:P,color:string){
    f.triangle(courtyardPoint(...a),courtyardPoint(...b),courtyardPoint(...c),color);
    energy.push(0,0,0,0,0,0,0,0,0);
  }
  function top(l:number,r:number,s:number,t:number,h:number,color:string){
    quad([l,s,h],[r,s,h],[r,t,h],[l,t,h],color);
  }
  function box(l:number,r:number,s:number,t:number,lo:number,hi:number,color:string){
    top(l,r,s,t,hi,color);
    quad([l,s,lo],[r,s,lo],[r,s,hi],[l,s,hi],color);
    quad([r,t,lo],[l,t,lo],[l,t,hi],[r,t,hi],color);
    quad([l,t,lo],[l,s,lo],[l,s,hi],[l,t,hi],color);
    quad([r,s,lo],[r,t,lo],[r,t,hi],[r,s,hi],color);
  }
  // One continuous tessellation; terracotta bands and concrete panels meet
  // at their edges. A single baked falloff on each surface vertex replaces
  // per-lantern lighting and keeps the central walk darker than the margins.
  const stations=[0,end];for(let s=1.55;s<end;s+=4.965)for(const d of [0,.16,.68,.84,2.8])if(s+d<end)stations.push(s+d);
  stations.sort((a,b)=>a-b);
  const across=[0,.28,1.50,3.11,4.72,width-.28,width];
  function spill(w:number,s:number){
    let sum=0;for(const [a,b] of lights)sum+=Math.exp(-((w-a)**2/2.7+(s-b)**2/3.5));
    return [22,18,13].map(k=>Math.min(255,Math.round(sum*k)));
  }
  for(let j=0;j<stations.length-1;j++)for(let i=0;i<across.length-1;i++){
    const l=across[i],r=across[i+1],s=stations[j],t=stations[j+1],phase=((s+t)/2-1.55+4.965)%4.965;
    const red=i===0||i===across.length-2||phase<.16||(phase>.68&&phase<.84);
    top(l,r,s,t,0,red?'#ae7968':['#beb5a9','#bcb4a9','#c3b9ad'][(i+j)%3]);
    energy.splice(-12,12,...spill(l,s),...spill(r,s),...spill(r,t),...spill(l,t));
  }
  function planter(l:number,r:number,s:number,t:number,seed:number){
    const skin='#b7b8b2',lip=.045,h=.64;
    // Uncapped open planter with one soil surface and a narrow folded rim.
    const walls:P[]=[[l,s,0],[r,s,0],[r,t,0],[l,t,0]];
    for(let i=0;i<4;i++){
      const a=walls[i],b=walls[(i+1)%4];
      quad(a,b,[b[0],b[1],h],[a[0],a[1],h],skin);
    }
    top(l,r,s,s+lip,h,skin);top(l,r,t-lip,t,h,skin);
    top(l,l+lip,s+lip,t-lip,h,skin);top(r-lip,r,s+lip,t-lip,h,skin);
    top(l+lip,r-lip,s+lip,t-lip,h-.045,'#4c5241');
    let state=seed+1;
    const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
    const center=(l+r)/2,half=(r-l)/2,overhang=t-s>1?.20:.055;
    // A continuous, softly rounded leaf mass underlies the separate hanging
    // blades. Shared vertices smooth the normals from the shaded base to the crown.
    const profile=[[-.72,.64],[-.96,.84],[-1.02,1.15],[-.73,1.35],[0,1.43],
      [.73,1.35],[1.02,1.15],[.96,.84],[.72,.64]];
    const base=f.positions.length/3,steps=Math.ceil((t-s)*3.1),stride=profile.length;
    const shade=new THREE.Color('#516747'),sun=new THREE.Color('#a8b67c'),ink=new THREE.Color();

    for(let i=0;i<=steps;i++){
      const fraction=i/steps,station=s-overhang+(t-s+2*overhang)*fraction;
      const endFraction=Math.min(1,i,steps-i),widthScale=.77+.23*endFraction;
      const wave=.043*Math.sin(2.5*i+seed)+.031*Math.sin(1.38*i+seed*.46);

      for(const [side,nominal] of profile){
        const exposed=(nominal-h)/.79;
        const y=nominal+exposed*(wave-.10*(1-endFraction)+.035*(random()-.5));
        const p:P=[center+half*side*widthScale,station,y];
        f.positions.push(...courtyardPoint(...p));energy.push(0,0,0);
        ink.copy(shade).lerp(sun,Math.max(0,Math.min(1,exposed*.88+.13*(random()-.5))));
        f.colors.push(ink.r,ink.g,ink.b);
      }

      if(i===0)continue;
      for(let j=0;j<stride-1;j++){
        const a=base+(i-1)*stride+j,b=a+1,c=b+stride,d=a+stride;
        f.indices.push(a,b,c,a,c,d);
      }
    }
    for(const i of [0,steps]){
      const middle=f.positions.length/3,station=i===0?s-overhang:t+overhang;
      f.positions.push(...courtyardPoint(center,station+(i===0?-.035:.035),h+.33));
      ink.copy(shade).lerp(sun,.38);f.colors.push(ink.r,ink.g,ink.b);energy.push(0,0,0);
      for(let j=0;j<stride-1;j++){
        const a=base+i*stride+j;
        f.indices.push(middle,i===0?a+1:a,i===0?a:a+1);
      }
    }
    // Small forked sprays tumble over the rim. Their narrow, folded blades
    // catch light along one edge while the interior hedge reads as one planting.
    const greens=['#78935e','#91a673','#a3ae79','#72875c'];
    function spray(w:number,station:number,y:number,dw:number,ds:number){
      for(let k=-1;k<=1;k++){
        const fan=k*.10+.035*(random()-.5),reach=.11+.04*random(),drop=.20+.13*random();
        const ax=dw*reach-ds*fan,az=ds*reach+dw*fan;
        const start:P=[w,station,y],tip:P=[w+ax,station+az,y-drop];
        const left:P=[w+ax*.66-ds*.022,station+az*.66+dw*.022,y-drop*.27];
        const right:P=[w+ax*.70+ds*.022,station+az*.70-dw*.022,y-drop*.37];
        const tint=(seed+k+1+Math.floor(random()*3))%greens.length;
        tri(start,tip,left,greens[tint]);tri(start,right,tip,greens[(tint+1)%greens.length]);
      }
    }
    for(const side of [-1,1]){
      const count=Math.ceil((t-s)*3.3);
      for(let i=0;i<count;i++){
        const station=s+(i+.18+.64*random())*(t-s)/count;
        spray(center+side*half*(.94+.06*random()),station,1.15+.15*random(),side,0);
      }
    }
    for(const side of [-1,1]){
      const station=side<0?s-overhang:t+overhang;
      for(let i=0;i<4;i++)spray(center+half*(i-1.5)*.42,station,1.10+.16*random(),0,side*(t-s>1?1:.5));
    }
  }
  // The two photographed passages flank a single line of movable planters.
  for(let i=0;i<12;i++){const s=1.65+3.18*i;planter(1.44,2.43,s,s+2.81,i);}
  planter(2.30,3.70,46.72,47.63,19);planter(3.74,5.54,46.72,47.63,21);
  // A slatted timber seat looks back toward Howard from the pocket.
  for(const w of [2.83,4.24])box(w-.045,w+.045,45.94,46.49,0,.43,'#525952');
  for(let j=0;j<6;j++)box(2.57,4.48,45.93+j*.091,46.008+j*.091,.43,.487,'#9e8262');
  for(let j=0;j<15;j++)box(2.60+.126*j,2.70+.126*j,46.432,46.50,.49,.90,'#a78a6c');
  box(2.57,4.49,46.50,46.54,.66,.72,'#555d52');
  // Slim square smoker's receptacle next to the seat, as recorded by the CBD.
  box(4.70,4.99,46.11,46.40,0,.73,'#4d5048');
  top(4.74,4.95,46.15,46.36,.734,'#353932');
  const dark='#414342';
  function lantern(w:number,s:number,dir:number){
    const x=w+.25*dir,lo=2.71,hi=3.53,r=.145;
    box(Math.min(w-.03*dir,x),Math.max(w-.03*dir,x),s-.052,s+.052,3.10,3.19,dark);
    const side=(a:number,radius:number,h:number):P=>[x+Math.cos(a)*radius,s+Math.sin(a)*radius,h];
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3,b=(i+1)*Math.PI/3;
      const A=side(a,r,lo),B=side(b,r,lo),C=side(b,r,hi),D=side(a,r,hi);
      quad(A,B,C,D,'#c9c8bb',[138,120,92]);
      quad(side(a-.07,r+.009,lo),side(a+.07,r+.009,lo),side(a+.07,r+.009,hi),side(a-.07,r+.009,hi),dark);
      quad(side(a,r+.012,hi),side(b,r+.012,hi),side(b,.07,hi+.065),side(a,.07,hi+.065),dark);
      quad(side(a,.072,lo-.052),side(b,.072,lo-.052),side(b,r+.012,lo),side(a,r+.012,lo),dark);
      tri(side(a,.07,hi+.065),side(b,.07,hi+.065),[x,s,hi+.08],dark);
    }
  }
  for(const s of westLamps)lantern(0,s,1);
  for(const s of eastLamps)lantern(width,s,-1);
  // Brass plaque with the characteristic dark, pointed public-open-space mark.
  box(.002,.025,1.45,1.82,1.31,1.83,'#ba9866');
  const sign=.027;tri([sign,1.50,1.61],[sign,1.77,1.61],[sign,1.635,1.79],'#423f32');
  for(const [s,t,y] of [[1.55,1.72,1.56],[1.50,1.77,1.49],[1.54,1.73,1.45]])
    quad([sign,s,y],[sign,t,y],[sign,t,y+.012],[sign,s,y+.012],'#544c36');
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(f.positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(f.colors,3));
  g.setAttribute('signLight',new THREE.Uint8BufferAttribute(energy,3,true));
  g.setIndex(f.indices);setPackedNormals(g);g.userData.paintVertices=true;
  mesh(g,'#ffffff',0,0,0).name='120 Howard public courtyard';
}
