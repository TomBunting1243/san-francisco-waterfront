import {pccFrontDoorX,pccFrontLeafWidth,pccTruckHalfSpacing,pccExitX} from './pcc-layout.ts';
import * as THREE from 'three';
import {StreetAssembly,createStreetPaint} from './street-amenities.ts';
import {mountExteriorEntrance,pccTreads} from './pcc-entrance.ts';

// Longitudinal body coordinates are shared with the kingpins, glass and driver.
// The skirt, waist and roof are sections of the same stamping. Side panels end
// at the door jambs and the wheel cutouts instead of running behind them.
type P=[number,number,number];
const green='#285b41',roof='#326044',cream='#e3d6a4',steel='#9ea59b',seal='#353e36',dark='#41544a';
function paintMesh(){
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  function polygon(points:P[],ink:string){
    const v=positions.length/3,t=new THREE.Color(ink);
    for(const p of points){positions.push(...p);colors.push(t.r,t.g,t.b);}
    indices.push(v,v+1,v+2);
    if(points.length===4)indices.push(v,v+2,v+3);
  }
  const face=(a:P,b:P,c:P,d:P,ink:string)=>polygon([a,b,c,d],ink);
  const triangle=(a:P,b:P,c:P,ink:string)=>polygon([a,b,c],ink);
  function finish(name:string,mat:THREE.MeshStandardMaterial){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat);m.name=name;return m;
  }
  return {face,triangle,finish};
}
const x0=-1.469,x1=1.733;
const bands=[
  [.13,.391,1.79,-1.735],[.279,.421,1.820,-1.763],[.305,.424,1.823,-1.765],
  [.470,.427,1.827,-1.767],[.545,.427,1.823,-1.764],[.566,.426,1.823,-1.761],
  [.817,.415,1.758,-1.723],[.916,.398,1.686,-1.682],[.969,.370,1.648,-1.648],
  [1.011,.296,1.603,-1.604],[1.032,.182,1.559,-1.557],[1.037,.001,1.493,-1.49],
] as const;
const inks=[green,steel,green,cream,green,green,cream,roof,roof,roof,roof];
export function addPccBody(group:THREE.Group,glazing:THREE.MeshStandardMaterial,lamp:THREE.MeshStandardMaterial){
  const skin=paintMesh(),windows=paintMesh(),fittings=new StreetAssembly(),signs=new StreetAssembly(),lenses=new StreetAssembly();
  const paint=createStreetPaint();glazing.side=THREE.DoubleSide;glazing.vertexColors=true;
  glazing.color.set(0xffffff);lamp.vertexColors=true;
  for(const material of [glazing,lamp]){
    material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance*=vColor.rgb;\n#endif');};
    material.customProgramCacheKey=()=> 'pcc-local-lens-pigment-v1';
  }
  const frontHalf=2*pccFrontLeafWidth*.06/group.scale.x,doorL=pccFrontDoorX-frontHalf,doorR=pccFrontDoorX+frontHalf;
  const rearL=pccExitX-frontHalf,rearR=pccExitX+frontHalf;
  const layouts=(side:number)=>side===1?[[x0+.018,rearL-.008,5],[rearR+.008,doorL-.007,7]]:[[x0+.018,1.205,13],[1.222,x1+.012,1]];
  const through:Array<{side:number;a:number;b:number;x:number}>=[];
  for(const side of [-1,1])for(const [a,b,count] of layouts(side)){
    const step=(b-a)/count;
    for(let i=0;i<count;i++)if(a+i*step<=.817&&a+(i+1)*step>.817)
      through.push({side,a:a+i*step,b:a+(i+1)*step,x:a+(i+.5)*step});
  }
  const intervals=[...through.flatMap(p=>[p.a,p.b]),rearL,rearR,x0,-1.401,-1.347,-1.27,-1.12,-.98,-.855,-.794,-.74,-.712,-.29,
    .775,.795,.85,.90,.95,doorL,1.09,1.24,1.36,1.405,doorR,x1].sort((a,b)=>a-b);
  const skirt=(x:number)=>{
    const d=Math.min(Math.abs(x-pccTruckHalfSpacing),Math.abs(x+pccTruckHalfSpacing));
    if(d>=.34)return .13;
    return .13+.115*Math.sqrt(Math.max(0,1-(d/.34)**2));
  };
  const anchorX=(height:number)=>x1-.26*THREE.MathUtils.smoothstep(height,.816,1.037);
  // Fittings follow the cross-section of the same rounded stamping. A flat
  // sign or lens set in the middle tangent disappears into the brow at its ends.
  function noseX(z:number,y:number){
    const hi=bands.findIndex(b=>b[0]>=y),a=bands[hi-1],b=bands[hi];
    const t=(y-a[0])/(b[0]-a[0]);
    const surface=(section:typeof bands[number])=>{
      const x=anchorX(section[0]);
      return x+(section[2]-x)*Math.sqrt(Math.max(0,1-(z/section[1])**2));
    };
    return THREE.MathUtils.lerp(surface(a),surface(b),t);
  }
  const sweptX=(x:number,h:number)=>x<=1.205?x:1.205+(x-1.205)*(anchorX(h)-1.205)/(x1-1.205);
  for(const side of [-1,1])for(let j=0;j<bands.length-1;j++){
    const [bottom,w]=bands[j],[top,w2]=bands[j+1];
    for(let i=1;i<intervals.length;i++){
      const a=intervals[i-1],b=intervals[i],mid=(a+b)/2;
      if(side===1&&((mid>doorL&&mid<doorR)||(mid>rearL&&mid<rearR))&&j<6)continue;
      if((j===5||j===6)&&through.some(p=>p.side===side&&mid>p.a&&mid<p.b))continue;
      // Each wheel arch cuts the lower bands out of the sheet.
      const l=Math.max(bottom,skirt(a)),r=Math.max(bottom,skirt(b));
      if(l>=top&&r>=top)continue;
      const pt=(x:number,h:number):P=>[sweptX(x,h),h,side*THREE.MathUtils.lerp(w,w2,(h-bottom)/(top-bottom))];
      const nose=mid>.725&&j<=3;
      skin.face(pt(a,Math.min(l,top)),pt(b,Math.min(r,top)),pt(b,top),pt(a,top),nose&&j!==1?cream:inks[j]);
    }
    for(const end of [-1,1]){
      const anchor=end===1?x1:x0,steps=8;
      function at(k:number,band:typeof bands[number]):P{
        const theta=(k/steps)*Math.PI/2,ext=end===1?band[2]:band[3];
        const start=end===1?anchorX(band[0]):anchor;
        return [start+(ext-start)*Math.sin(theta),band[0],side*band[1]*Math.cos(theta)];
      }
      for(let k=0;k<steps;k++){
        if(j===5)continue; // The end glazing is fitted between the belt rail and header below.
        const ink=j<4&&end===1?(j===1?steel:cream):j===6&&end===1?roof:inks[j];
        skin.face(at(k,bands[j]),at(k+1,bands[j]),at(k+1,bands[j+1]),at(k,bands[j+1]),ink);
      }
    }
  }
  // The side panes and upper standee lights turn down into rounded corners.
  // Their bezels have the pane cut out, so the aluminum never covers the glass.
  function sideWindow(x:number,y:number,width:number,height:number,side:number,upper:boolean){
    const r=Math.min(height*.31,.029),rim=.008;
    const outer=(u:number,h:number):P=>[x+u,y+h,side*(upper?.417-(y+h-.817)*.19+.003:.428-(y+h-.566)*.044+.003)];
    const round=(w:number,h:number,rad:number)=>[[-1,-1],[1,-1],[1,1],[-1,1]].flatMap(([a,b])=>{
      const ends=[[a*(w/2-rad),b*h/2],[a*(w/2-rad*.28),b*(h/2-rad*.28)],[a*w/2,b*(h/2-rad)]];
      return (a===b?ends.reverse():ends).map(([u,v])=>outer(u,v));
    });
    const ring=round(width,height,r),pane=round(width-2*rim,height-2*rim,Math.max(.003,r-rim));
    for(let i=0;i<ring.length;i++){
      const k=(i+1)%ring.length;skin.face(ring[i],ring[k],pane[k],pane[i],upper?seal:'#9b9f88');
      if(!through.some(p=>p.side===side&&Math.abs(p.x-x)<.0001))
        windows.triangle(outer(0,0),pane[i],pane[k],upper?'#596b60':'#61726a');
    }
    const open=through.find(p=>p.side===side&&Math.abs(p.x-x)<.0001);
    if(open){
      const ink=upper?cream:green;
      const fill=(l:number,r:number,lo:number,hi:number)=>skin.face(outer(l,lo),outer(r,lo),outer(r,hi),outer(l,hi),ink);
      const l=open.a-x,r=open.b-x,lo=upper?.817-y:.566-y,hi=upper?.916-y:.817-y;
      fill(l,r,lo,-height/2);fill(l,r,height/2,hi);
      fill(l,-width/2,-height/2,height/2);fill(width/2,r,-height/2,height/2);
      for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
        const corner=outer(a*width/2,b*height/2);
        skin.face(corner,outer(a*(width/2-rim),b*height/2),outer(a*(width/2-rim*.28),b*(height/2-rim*.28)),outer(a*width/2,b*(height/2-rim)),ink);
      }
    }
    if(!upper){
      const a=-width/2+.007,b=width/2-.007,v=.022;
      const raised=(u:number,h:number):P=>{const p=outer(u,h);p[2]+=side*.003;return p;};
      skin.face(raised(a,v),raised(b,v),raised(b,v+.008),raised(a,v+.008),'#9aa18e');
      if(open)return;
      const low=-height*.42;
      const paneBand=(u0:number,u1:number,v0:number,v1:number,ink:string,lit=false)=>{
        (lit?windows:skin).face(raised(u0,v0),raised(u1,v0),raised(u1,v1),raised(u0,v1),ink);
      };
      paneBand(a+.009,b-.009,.067,.074,'#b8b49a',true);
      // The seat tops and a handful of occupied windows leave the upper sash clear.
      paneBand(-width*.32,width*.22,low,low+.030,'#4d6256');
      for(const [along,coat] of [[.43,'#6d6558'],[.13,'#766b61'],[-.73,'#57635c'],[-1.27,'#72675f']] as const){
        if(Math.abs(x-along)>width*.5-.038)continue;
        const u=along-x;
        skin.face(raised(u-.035,low+.008),raised(u+.035,low+.008),raised(u+.026,low+.07),raised(u-.025,low+.07),coat);
        skin.face(raised(u-.016,low+.07),raised(u+.018,low+.07),raised(u+.013,low+.106),raised(u-.013,low+.112),'#4c5148');
      }
    }
  }
  for(const side of [-1,1]){
    const groups=layouts(side);
    for(const [a,b,count] of groups){
      const step=(b-a)/count;
      for(let i=0;i<count;i++){
        const x=a+(i+.5)*step;
        sideWindow(x,.685,step-.014,.204,side,false);
        sideWindow(x,.869,step*.79,.060,side,true);
      }
    }
  }
  // The visor, split windshield and rounded corners share an angled sill.
  for(const end of [-1,1]){
    const anchor=end===1?x1:x0,base=bands[5],header=bands[6];
    const pt=(angle:number,h:number,offset=0):P=>{
      const t=(h-base[0])/(header[0]-base[0]),radius=THREE.MathUtils.lerp(base[1],header[1],t);
      const extreme=THREE.MathUtils.lerp(end===1?base[2]:base[3],end===1?header[2]:header[3],t);
      return [anchor+(extreme-anchor+end*offset)*Math.cos(angle),h,(radius+offset)*Math.sin(angle)];
    };
    function strip(a:number,b:number,l:number,h:number,ink:string,offset=0){
      const n=Math.max(1,Math.ceil((b-a)/.16));
      for(let i=0;i<n;i++){
        const v=a+(b-a)*i/n,u=a+(b-a)*(i+1)/n;
        skin.face(pt(v,l,offset),pt(u,l,offset),pt(u,h,offset),pt(v,h,offset),ink);
      }
    }
    for(const [a,b] of [[-Math.PI/2,-.85],[-.85,0],[0,.85],[.85,Math.PI/2]]){
      const lo=.582,hi=.802,edge=.022;
      strip(a,b,.565,lo,green);strip(a,b,hi,.818,green);
      strip(a,a+edge,lo,hi,green);strip(b-edge,b,lo,hi,green);
      const l=a+edge,r=b-edge;
      strip(l,r,lo,lo+.006,steel);strip(l,r,hi-.005,hi,dark);
      // Low-contrast sky, reflected sash and a dark dashboard across the lower fourth.
      strip(l,r,lo+.006,.638,end===1?'#3c504a':'#65726a');
      strip(l,r,.638,hi-.036,end===1?'#657f7c':'#7c8a7e');
      strip(l,r,hi-.036,hi-.005,end===1?'#5a716c':'#4e685c');
    }
  }
  // Two chromed bumper strips wrap around the skirt. The separate amber
  // markers sit either side of the front lamp, under the narrow belt line.
  for(const end of [-1,1]){
    for(let j=0;j<2;j++)for(let i=0;i<12;i++){
      const rim=(k:number,y:number):P=>{
        const angle=-1.30+k*2.60/12;
        return [(end===1?x1:x0)+end*(end===1?1.85-x1:.310)*Math.cos(angle),y,.426*Math.sin(angle)];
      };
      const y=.245+.033*j;skin.face(rim(i,y),rim(i+1,y),rim(i+1,y+.024),rim(i,y+.024),steel);
    }
  }
  for(const side of [-1,1]){
    fittings.box(noseX(.22,.492)+.005,.492,side*.22,.015,.034,.068,'#b5a28c').rotation.y=-side*.40;
    lenses.box(noseX(.223,.491)+.016,.491,side*.223,.012,.020,.051,'#d99440').rotation.y=-side*.40;
    fittings.box(-1.735,.469,side*.208,.012,.037,.045,'#823c32').rotation.y=side*.42;
  }
  // A hooded rollsign with the destination on a second panel.
  const last=.288,h0=.819,h1=.894;
  for(const side of [-1,1]){
    const p=(v:number,h:number):P=>[noseX(v,h)+.006,h,side*v];
    function frame(a:number,b:number,l:number,h:number,ink:string){
      const n=Math.ceil((b-a)/.045);
      for(let i=0;i<n;i++){
        const u=a+(b-a)*i/n,v=a+(b-a)*(i+1)/n;
        skin.face(p(u,l),p(v,l),p(v,h),p(u,h),ink);
      }
    }
    frame(0,last,h0,h0+.006,green);frame(0,last,h1-.006,h1,green);
    frame(0,.005,h0+.006,h1-.006,green);frame(last-.007,last,h0+.006,h1-.006,green);
    frame(.005,last-.007,h0+.006,h1-.006,'#26352f');
  }
  function noseLettering(assembly:StreetAssembly,words:string,z:number,y:number,h:number,ink:string){
    assembly.label(words,0,0,0,h,ink);
    const geometry=assembly.parts.at(-1)!.geometry,pos=geometry.attributes.position;
    for(let i=0;i<pos.count;i++){
      const v=z-pos.getX(i),height=y+pos.getY(i);
      pos.setXYZ(i,noseX(v,height)+.009,height,v);
    }
    geometry.computeVertexNormals();
  }
  noseLettering(signs,'F MARKET',.145,.838,.035,'#f3ecd0');
  noseLettering(signs,"FISHERMAN'S",-.143,.852,.020,'#f3ecd0');
  noseLettering(signs,'WHARF',-.143,.831,.018,'#f3ecd0');
  noseLettering(fittings,'1051',0,.925,.036,cream);
  const label=(words:string,x:number,y:number,z:number,h:number,color:string,heading:number)=>fittings.label(words,x,y,z,h,color,heading);
  for(const side of [-1,1]){
    for(const [a,b] of (side===1?[[x0,rearL],[rearR,doorL],[doorR,x1]]:[[x0,x1]])){
      fittings.box((a+b)/2,.323,side*.430875,b-a,.018,.02175,steel);
    }
  }
  for(const side of [-1,1])label('1051',.72,.942,side*.392,.037,cream,side<0?Math.PI:0);
  // Slatted roof equipment, rain gutters and a dark underframe behind the running gear.
  fittings.box(-.38,1.041,0,.94,.053,.278,green);
  for(let i=0;i<10;i++)for(const side of [-1,1])fittings.box(-.81+i*.094,1.041,side*.140,.056,.023,.007,'#394d3e');
  for(const side of [-1,1])fittings.box(0,.917,side*.400,2.97,.010,.008,'#476b50');
  for(const [a,b] of [[-1.375,rearL],[rearR,1.30]])fittings.box((a+b)/2,.18,0,b-a,.16,.49,'#3c433e');
  // Each folding doorway opens above a recessed well and a floor continuous
  // across the car. The thin skirt and rub rails end at the actual jambs.
  const sy=.06/group.scale.y,sz=.06/group.scale.z,z=.42,far=-.371;
  for(const [left,right] of [[doorL,doorR],[rearL,rearR]]){
    for(const [i,tread] of pccTreads.entries()){
      const outer=z-i*.21*sz,inner=outer-.21*sz,h=tread*sy;
      skin.face([left,h,outer],[right,h,outer],[right,h,inner],[left,h,inner],'#837f68');
      const lower=(i?pccTreads[i-1]:.30)*sy;
      skin.face([left,lower,outer],[right,lower,outer],[right,h,outer],[left,h,outer],i?'#606650':steel);
    }
    for(const x of [left,right])skin.face([x,.38*sy,z],[x,.96*sy,z-.85*sz],[x,.82,z-.85*sz],[x,.82,z],cream);
    skin.face([left,.96*sy,z-.84*sz],[right,.96*sy,z-.84*sz],[right,.96*sy,far],[left,.96*sy,far],'#596152');
    // The header is low only at the outside jamb. Follow the pressed roof
    // over the stairwell so it opens into the full-height saloon aisle.
    const ceiling=[...bands.slice(6).map(([h,w])=>[w-.003,h-.009]),
      ...bands.slice(7,-1).reverse().map(([h,w])=>[-w+.003,h-.009])];
    for(let i=1;i<ceiling.length;i++){
      const [a,h]=ceiling[i-1],[b,k]=ceiling[i];
      skin.face([left,h,a],[right,h,a],[right,k,b],[left,k,b],'#cbbf9c');
    }
    fittings.box((left+right)/2,.398,far+.002,right-left,.14,.028,'#7c907a');
  }
  skin.face([.55,.96*sy,.38],[doorL,.96*sy,.38],[doorL,.96*sy,far],[.55,.96*sy,far],'#596152');
  fittings.box(.866,.581,.129,.007,.365,.009,steel);
  fittings.box(1.24,.489,-.199,.16,.055,.17,'#647b69');
  fittings.box(1.15,.554,-.199,.029,.161,.17,'#65836d');
  group.add(skin.finish('1051 formed shell and windshield',paint),windows.finish('1051 passenger glazing',glazing),
    fittings.bake('1051 enamel fittings and number plates',paint),signs.bake('1051 backlit destination lettering',glazing),lenses.bake('1051 amber running lights',lamp),mountExteriorEntrance(group.scale));
}
