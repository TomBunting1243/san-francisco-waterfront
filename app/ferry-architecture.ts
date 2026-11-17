import {waterfrontPalm} from './waterfront-trees.ts';
import * as THREE from 'three';
import type { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { footprintGeometry, sfMap } from './sf-map.ts';

const pale='#dfd8c8', ashlar='#cbc6b7', deep='#485f63', bronze='#827d64';

function builders(name:string) {
  const root=new THREE.Group(), materials=new Map<string,THREE.MeshStandardMaterial>();
  root.name=name;
  function mesh(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number,parent=root){
    let material=materials.get(color);
    if(!material){material=new THREE.MeshStandardMaterial({color,roughness:.83});materials.set(color,material);}
    const m=new THREE.Mesh(geometry,material);
    m.position.set(x,y,z);
    m.castShadow=m.receiveShadow=true;
    parent.add(m);
    return m;
  }
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:string,g=root)=>mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,g);
  const extrude=(shape:THREE.Shape,d:number,c:string,x:number,y:number,z:number,g=root)=>mesh(new THREE.ExtrudeGeometry(shape,{depth:d,curveSegments:10,bevelEnabled:false}),c,x,y,z,g);
  const slab=(points:number[][],top:number,depth:number,color:string)=>mesh(footprintGeometry(points,depth),color,0,top-depth,0);
  function line(a:number[],b:number[],y:number,width:number,height:number,color:string) {
    const dx=b[0]-a[0],dz=b[1]-a[1];
    const segment=box(width,height,Math.hypot(dx,dz),(a[0]+b[0])/2,y,(a[1]+b[1])/2,color);
    segment.rotation.y=Math.atan2(dx,dz);
    return segment;
  }
  return {root,mesh,box,extrude,slab,line};
}

export function ferryHall(font:Font) {
  const {root,box,mesh,extrude}=builders('Ferry Building hall');
  const footprint=sfMap.buildings.find(b=>b.id===558731934)!.p;
  const left=Math.min(...footprint.map(p=>p[0])),right=Math.max(...footprint.map(p=>p[0]));
  const centerX=(left+right)/2, width=right-left;
  const bayZ=Math.max(...footprint.map(p=>p[1])), streetZ=footprint[0][1];
  const porticoZ=Math.min(...footprint.map(p=>p[1])), towerX=(1.181-1.418)/2;
  const depth=bayZ-streetZ;
  const street=new THREE.Group(), bay=new THREE.Group();
  street.name='Embarcadero arcade and portico';
  bay.name='Ferry Plaza elevation';
  street.position.set(centerX,0,streetZ);
  street.rotation.y=Math.PI;
  bay.position.set(centerX,0,bayZ);
  root.add(street,bay);
  function shape(w:number,bottom:number,spring:number){
    const path=new THREE.Shape();
    path.moveTo(-w/2,bottom);
    path.lineTo(w/2,bottom);
    path.lineTo(w/2,spring);
    path.absarc(0,spring,w/2,0,Math.PI,false);
    path.lineTo(-w/2,bottom);
    return path;
  }
  function bayWindow(g:THREE.Group,x:number,y:number,w:number,spring:number,thickness:number) {
    extrude(shape(w,0,spring),.024,deep,x,y,-.027,g);
    for(const sx of [-1,0,1])box(.019,spring+w/2,.027,x+sx*w*.288,y+(spring+w/2)*.46,.004,'#91a09a',g);
    box(w,.017,.030,x,y+spring,.006,'#91a09a',g);
    const molding=mesh(new THREE.TorusGeometry(w/2+.012,thickness,5,20,Math.PI),pale,x,y+spring,.016,g);
    molding.name='Radiating stone arch';
    for(const sign of [-1,1])box(thickness*2,spring,.055,x+sign*(w/2+.012),y+spring/2,.016,pale,g);
  }
  function realArcade(g:THREE.Group,count:number,w:number,x:number,base:number,ht:number,r:number,castDepth:number) {
    const span=w/count;
    const panelHeight=ht-base;
    for(let i=0;i<count;i++){
      // A pierced stone panel makes the arch an actual opening to the recessed colonnade.
      const panel=new THREE.Shape();
      const spring=panelHeight-r-.062;
      panel.moveTo(-span/2,0);
      panel.lineTo(-span/2,panelHeight);
      panel.lineTo(span/2,panelHeight);
      panel.lineTo(span/2,0);
      panel.lineTo(r,0);
      panel.lineTo(r,spring);
      panel.absarc(0,spring,r,0,Math.PI,false);
      panel.lineTo(-r,0);
      panel.lineTo(-span/2,0);
      const cx=x-w/2+(i+.5)*span;
      extrude(panel,castDepth,ashlar,cx,base,-castDepth,g).name='Pierced arcade panel';
      const y=base+spring;
      mesh(new THREE.TorusGeometry(r+.009,.019,5,24,Math.PI),pale,cx,y,.012,g);
      for(const signed of [-1,1]){
        box(.039,spring,.052,cx+signed*(r+.015),base+spring/2,.013,pale,g);
        box(.071,.034,.081,cx+signed*(r+.023),y,.019,pale,g);
      }
      box(.047,.06,.047,cx,y+r+.008,.022,'#ebe0cc',g);
    }
  }
  // The hall's core is set behind both outward elevations to expose their depth.
  box(width-.07,.063,depth+.10,centerX,.102,(bayZ+streetZ)/2,ashlar);
  box(width-.22,.93,depth-.53,centerX,.60,(bayZ+streetZ)/2,'#b1ada0');
  box(width,.19,depth-.06,centerX,1.105,(bayZ+streetZ)/2,ashlar);

  const porticoWidth=2.63;
  const leftWing=(width-porticoWidth)/2+towerX-centerX, rightWing=width-leftWing-porticoWidth;
  for(const [w,x] of [[leftWing,-width/2+leftWing/2],[rightWing,width/2-rightWing/2]]) {
    realArcade(street,8,w,x,.13,.735,(w/8)*.356,.107);
    for(let i=0;i<8;i++){
      const span=w/8,cx=x-w/2+(i+.5)*span;
      box(span*.72,.54,.03,cx,.412,-.25,deep,street);
      for(const offset of [-.19,0,.19])box(.017,.53,.023,cx+offset*span,.415,-.228,'#9a9d87',street);
      box(span*.75,.023,.035,cx,.39,-.214,bronze,street);
      bayWindow(street,cx,.765,span*.56,.137,.016);
    }
  }
  const portico=new THREE.Group();
  portico.name='Central three-arch entrance';
  portico.position.set(centerX-towerX,0,streetZ-porticoZ);
  street.add(portico);
  const canonicalPortico=porticoWidth/3;
  realArcade(portico,3,porticoWidth,0,.136,.966,.29,.145);
  box(porticoWidth+.12,.125,streetZ-porticoZ+.20,0,1.015,-.24,pale,portico);
  for(const side of [-1,1]){
    box(.12,.89,streetZ-porticoZ,side*porticoWidth/2,.57,-.31,ashlar,portico);
    for(let y=.25;y<.88;y+=.125)box(.145,.028,streetZ-porticoZ+.042,side*porticoWidth/2,y,-.296,pale,portico);
  }
  for(const x of [-canonicalPortico,0,canonicalPortico]){
    box(.72,.65,.026,x,.455,-.62,'#697b76',portico);
    box(.021,.64,.031,x,.455,-.604,bronze,portico);
  }
  for(let step=0;step<3;step++)box(porticoWidth+.12+step*.09,.02,.28+step*.06,0,.121-step*.022,.024+step*.041,'#ccc2ab',portico);
  for(const x of [-1.03,-.63,.63,1.03]){
    box(.054,.86,.058,x,1.46,-.14,pale,portico);
    box(.09,.038,.097,x,1.05,-.137,'#c1bcab',portico);
  }

  // The waterfront elevation is a single continuous upper window hall over a shallower loading arcade.
  const bayCount=22, bayPitch=width/bayCount;
  realArcade(bay,bayCount,width,0,.128,.60,bayPitch*.34,.085);
  for(let i=0;i<bayCount;i++){
    const x=(i+.5)*bayPitch-width/2;
    box(bayPitch*.73,.38,.026,x,.325,-.137,i%4===1?'#596e67':deep,bay);
    box(.015,.39,.031,x,.326,-.121,bronze,bay);
    bayWindow(bay,x,.635,bayPitch*.65,.285,.015);
    if(i%3===0){
      box(bayPitch*.87,.034,.26,x,.554,.121,'#768780',bay).rotation.x=.105;
      box(.03,.072,.027,x+bayPitch*.35,.519,.18,'#6c7b75',bay);
    }
  }
  for(const g of [street,bay]){
    box(width+.12,.083,.129,0,1.186,.047,pale,g);
    box(width+.09,.022,.102,0,1.232,.045,'#b7b2a4',g);
    box(width+.05,.043,.087,0,.146,.031,'#ded2bb',g);
    for(let x=-width/2+.09;x<width/2;x+=.169)box(.075,.039,.05,x,1.13,.081,'#e6deca',g);
  }

  // Separate hipped roof and glazed clerestory run the length of the grand nave.
  const soffit=1.23, ridge=1.63,z=(bayZ+streetZ)/2;
  const rl=left+.96,rr=right-.96;
  const corners=[
    [left-.08,soffit,streetZ-.14],[right+.08,soffit,streetZ-.14],
    [right+.08,soffit,bayZ+.10],[left-.08,soffit,bayZ+.10],
    [rl,ridge,z],[rr,ridge,z],
  ];
  const geometry=new THREE.BufferGeometry();
  const triangles=[0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0];
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(triangles.flatMap(i=>corners[i]),3));
  geometry.computeVertexNormals();
  mesh(geometry,'#758780',0,0,0).name='Hipped nave roof';
  box(rr-rl,.1,.49,centerX,ridge+.025,z,'#739091');
  box(rr-rl+.05,.034,.57,centerX,ridge+.084,z,'#a2afa1');
  for(let x=rl+.07;x<rr;x+=.28)box(.017,.105,.51,x,ridge+.031,z,'#bbbbb0');
  for(const x of [left+.29,right-.30])for(let i=0;i<5;i++)box(.249,.056,.095,x,.26+.14*i,streetZ-.012,'#d8cfbc');
  for(const x of [left,right]){
    // Five arch bays in the short north and south elevations.
    const end=new THREE.Group();end.position.set(x,0,z);end.rotation.y=x===left?-Math.PI/2:Math.PI/2;root.add(end);
    realArcade(end,5,depth-.065,0,.132,.67,.171,.072);
    for(let i=0;i<5;i++)bayWindow(end,((i+.5)/5-.5)*(depth-.065),.72,.352,.173,.014);
    box(depth+.12,.065,.106,0,1.18,.05,pale,end);
  }

  const portSigns=new TextGeometry('PORT OF SAN FRANCISCO',{font,size:.194,depth:.018,curveSegments:3});
  portSigns.computeBoundingBox();
  portSigns.translate(-(portSigns.boundingBox!.min.x+portSigns.boundingBox!.max.x)/2,0,0);
  const sign=mesh(portSigns,'#bc6854',centerX,1.365,bayZ-.12);
  sign.name='PORT OF SAN FRANCISCO';
  sign.scale.x=1.15;
  const signWidth=(portSigns.boundingBox!.max.x-portSigns.boundingBox!.min.x)*1.15;
  box(signWidth+.09,.027,.038,centerX,1.349,bayZ-.13,'#647c78');
  for(let x=-signWidth/2+.03;x<signWidth/2;x+=.41)box(.016,.19,.026,centerX+x,1.317,bayZ-.155,'#647c78');
  return {root,towerX,towerZ:(porticoZ+streetZ)/2+.24};
}

const marketAt=(z:number)=>{
  const crossings=sfMap.roads.filter(road=>road.name==='Market Street').flatMap(road=>
    road.p.slice(1).flatMap(([bx,bz],i)=>{
      const [ax,az]=road.p[i];
      if(az===bz||z<Math.min(az,bz)||z>Math.max(az,bz))return [];
      return [ax+(bx-ax)*(z-az)/(bz-az)];
    }));
  return crossings.length?crossings.reduce((sum,x)=>sum+x,0)/crossings.length:.152*z+.019;
};

export function ferryPublicRealm() {
  const {root,box,mesh,slab,line}=builders('Ferry plaza and Market Street');
  const paving='#c4b8a3', edge='#ddd0b7', terrace='#b6b3a3', metal='#586f70';
  // Harry Bridges Plaza occupies the median between the two mapped boulevard carriageways.
  const roads=sfMap.roads.filter(r=>r.name==='The Embarcadero');
  const boulevardAt=(x:number)=>{
    const values=roads.flatMap(r=>r.p.slice(1).flatMap(([bx,bz],i)=>{
      const [ax,az]=r.p[i];
      if(ax===bx||x<Math.min(ax,bx)||x>Math.max(ax,bx))return [];
      return [az+(bz-az)*(x-ax)/(bx-ax)];
    }));
    return [Math.min(...values)+.52,Math.max(...values)-.53];
  };
  const frontRows=Array.from({length:27},(_,i)=>-6.5+i*.5).map(x=>{
    const [a,b]=boulevardAt(x);
    return {x,a,b};
  }).filter(({a,b})=>b>a+.14);
  slab([...frontRows.map(({x,a})=>[x,a]),...frontRows.slice().reverse().map(({x,b})=>[x,b])],.119,.15,paving);
  for(let i=1;i<frontRows.length;i++){
    const a=frontRows[i-1],q=frontRows[i];
    for(const k of ['a','b'] as const)line([a.x,a[k]],[q.x,q[k]],.123,.046,.019,edge);
    line([q.x,q.a+.039],[q.x,q.b-.039],.120,.008,.009,'#a99d87');
  }
  // A widened pedestrian route meets Market at the terminal and stays clear of both palm rows.
  const spine=[[-.13,-1.813],[-.25,-2.31],[-.49,-3.05],[-.68,-4.6],[-.93,-6.48],[-1.36,-8.87],[-1.63,-10.1]];
  for(let i=1;i<spine.length;i++)line(spine[i-1],spine[i],.129,i<3?.98:1.14,.018,'#d7c9ae');
  const marketZs=[-10.11,-10.98,-12.157,-15.404,-16.185,-18.898,-21.202,-23.189,-27.636,-28.948,-31.7,-35.543];
  const market=marketZs.map(z=>[marketAt(z),z]);
  const sidewalkStripe=(offset:number)=>market.map(([x,z])=>[x+offset,z]);
  for(const side of [-1,1]){
    const curb=sidewalkStripe(side*.64), outer=sidewalkStripe(side*.97);
    slab([...curb,...outer.reverse()],.102,.089,'#bfb6a6');
    for(let i=1;i<curb.length;i++)line(curb[i-1],curb[i],.105,.044,.036,'#d9cdb4');
  }
  for(let i=1;i<market.length;i++){
    line(market[i-1],market[i],.069,1.27,.024,'#839694');
    for(const track of [-.27,.27])for(const offset of [-.073,.073]){
      const a=market[i-1],b=market[i];
      line([a[0]+track+offset,a[1]],[b[0]+track+offset,b[1]],.086,.014,.012,'#bfc4b6');
    }
  }
  const lamps=[-2.05,-4.1,-7.45,-10.51,-13.1,-15.2,-17.6,-20.75,-24.1,-27.25,-30.3,-34];
  for(const z of lamps)for(const side of [-1,1]){
    const streetX=z>-10?-.13+z*.133:marketAt(z);
    const x=streetX+side*(z>-10?.83:.90), y=z>-6.3?.135:.106;
    mesh(new THREE.CylinderGeometry(.018,.035,.64,7),metal,x,y+.32,z);
    box(.067,.082,.064,x,y+.049,z,metal);
    box(.039,.068,.041,x,y+.64,z,'#e8d4a6');
    mesh(new THREE.ConeGeometry(.039,.045,8),metal,x,y+.693,z);
  }
  for(const [x,z] of [[-2.5,-4.45],[1.77,-4.45],[-4.20,-4.32],[3.49,-4.31],[-5.83,-4.15],[5.16,-4.15]]){
    const ground=.12, h=.85;
    waterfrontPalm(mesh,x,ground,z,Math.round(x*719),h,.59);
    slab([[x-.15,z-.15],[x+.15,z-.15],[x+.15,z+.15],[x-.15,z+.15]],ground+.022,.039,'#a59b83');
  }
  for(const [x,z] of [[-3.39,-4.82],[2.66,-4.81],[-4.81,-4.72],[4.37,-4.67]]){
    box(.285,.014,.077,x,.183,z,'#ae9875');
    box(.284,.046,.012,x,.215,z-.037,'#ae9875');
    for(const offset of [-.105,.105])box(.015,.058,.058,x+offset,.148,z,metal);
  }
  // The granite map occupies the plaza between the hall and Agriculture Building.
  // Its north–south axis fits between the two facades. The charcoal stone traces
  // the Bay from Alviso through San Pablo Bay; metal dots identify ferry landings.
  const forecourt=[[-9.83,-.69],[-6.26,-1.20],[-6.26,1.64],[-7.05,2.14],[-8.65,2.14],[-8.65,1.77],[-9.83,1.77]];
  slab(forecourt,.088,.030,'#c1baa9').name='South terminal granite plaza';
  const paper=(lng:number,lat:number)=>[-8.14+(lat-37.80)*3.66,.43+(lng+122.29)*2.93];
  const shore=[
    [-122.50,37.82],[-122.48,37.83],[-122.48,37.84],[-122.47,37.86],[-122.44,37.87],[-122.46,37.89],
    [-122.47,37.90],[-122.45,37.92],[-122.49,37.95],[-122.49,37.98],[-122.47,38.00],[-122.49,38.02],
    [-122.49,38.08],[-122.43,38.10],[-122.40,38.15],[-122.35,38.15],[-122.29,38.10],[-122.25,38.08],
    [-122.24,38.06],[-122.20,38.06],[-122.20,38.05],[-122.28,38.05],[-122.33,38.04],[-122.37,38.01],
    [-122.35,37.98],[-122.37,37.96],[-122.40,37.96],[-122.39,37.93],[-122.38,37.90],[-122.32,37.89],
    [-122.30,37.87],[-122.31,37.84],[-122.33,37.82],[-122.33,37.80],[-122.31,37.79],[-122.33,37.78],
    [-122.29,37.77],[-122.27,37.75],[-122.25,37.74],[-122.23,37.70],[-122.19,37.69],[-122.15,37.66],
    [-122.14,37.60],[-122.10,37.58],[-122.09,37.54],[-122.05,37.51],[-122.03,37.47],[-122.00,37.46],
    [-122.02,37.45],[-122.07,37.48],[-122.11,37.49],[-122.13,37.51],[-122.19,37.55],[-122.22,37.56],
    [-122.24,37.59],[-122.30,37.60],[-122.36,37.62],[-122.35,37.65],[-122.38,37.68],[-122.37,37.71],
    [-122.38,37.74],[-122.39,37.77],[-122.39,37.79],[-122.41,37.81],[-122.46,37.81],[-122.50,37.81],
  ];
  slab(shore.map(([lo,la])=>paper(lo,la)),.089,.002,'#848e89').name='Bay inlay';
  for(const island of [[[-122.43,37.86],[-122.42,37.87],[-122.41,37.86],[-122.43,37.85]],
    [[-122.37,37.83],[-122.36,37.82],[-122.36,37.81],[-122.37,37.81]]])slab(island.map(([lo,la])=>paper(lo,la)),.090,.001,'#c9c1ae');
  const terminal=paper(-122.3935,37.7955);
  for(const [lo,la] of [[-122.34,38.10],[-122.36,37.91],[-122.28,37.795],[-122.30,37.79],[-122.25,37.74],[-122.38,37.66]]){
    const dest=paper(lo,la);line(terminal,dest,.090,.005,.001,'#b29c75');
    mesh(new THREE.CylinderGeometry(.016,.016,.0015,10),'#c2a46c',dest[0],.091,dest[1]);
  }
  // Sawn stone joints cross the darker map and continue to the restaurant entrance.
  for(let i=0;i<11;i++){
    const x=-9.76+i*.335;
    line([x,-.62-(x+9.76)*.14],[x,x<-8.65?1.74:1.63],.092,.004,.001,'#a39d8d');
  }
  for(let z=-.58;z<1.74;z+=.302)line([-9.81,z],[-6.28,z],.092,.005,.001,'#a6a191');
  slab([[-10.48,1.15],[-9.75,1.15],[-9.75,1.96],[-10.48,1.96]],.089,.025,'#b6afa1').name='Pier 2 entrance landing';
  for(const z of [1.28,1.48,1.68,1.88])line([-10.46,z],[-9.76,z],.091,.007,.002,'#a99c87');
  for(const [x,z,len] of [[-9.46,-.44,.64],[-6.62,-.64,.59],[-6.61,.78,.43]]){
    box(.18,.071,len,x,.123,z,'#b4ac9a');
    for(let slat=0;slat<3;slat++)box(.024,.012,len,x-.056+slat*.028,.165,z,'#a39174');
    box(.062,.013,len-.04,x+.052,.165,z,'#757e64');
    for(let k=0;k<6;k++){
      const stem=mesh(new THREE.ConeGeometry(.018,.091+k%3*.013,5),'#829077',x+.05,.205,z+(k/5-.5)*(len-.12));
      stem.rotation.z=(k%3-1)*.23;
    }
  }
  // The landward access lanes feed into a broader apron for ferries, market, and promenade.
  const apron=[[-7.02,1.65],[6.48,1.65],[6.48,2.68],[5.96,2.68],[5.96,2.21],[3.32,2.21],[3.32,2.65],[2.76,2.65],[2.76,2.22],[-1.18,2.22],[-1.50,4.52],[-1.88,7.83],[-2.22,10.57],[-5.73,10.57],[-6.97,2.23],[-7.02,1.65]];
  slab(apron,.096,.18,terrace);
  for(let i=1;i<apron.length;i++){
    const a=apron[i-1],b=apron[i];
    if(Math.abs(a[1]-b[1])<.001&&a[1]<2)continue;
    line(a,b,.107,.055,.029,'#818e85');
  }
  for(let x=-6.82;x<6.45;x+=.37)line([x,1.65],[x,2.20],.099,.011,.006,'#a29783');
  for(let x=-6.65;x<6.48;x+=.58){
    mesh(new THREE.CylinderGeometry(.025,.032,.20,8),'#526d70',x,.199,2.138);
    mesh(new THREE.SphereGeometry(.033,7,4),'#a2ac9f',x,.299,2.138);
  }
  for(let z=2.67;z<10.55;z+=.50){
    const a=-7.02+(z-2.22)*.15,b=-1.19-(z-2.22)*.123;
    line([a+.036,z],[b-.04,z],.100,.012,.007,'#a19e8c');
    if(Math.round(z*2)%3===0) for(const x of [a+.29,b-.29]){
      box(.18,.045,.32,x,.263,z,'#ad9878');
      for(const dz of [-.114,.114])box(.13,.16,.026,x,.176,z+dz,metal);
    }
  }
  // Blue fender railing is segmented around the boarding landings.
  for(const [a,b] of [[[6.48,1.78],[6.48,2.37]],[[3.32,2.20],[5.54,2.22]],[[-.60,2.22],[2.76,2.22]],[[-2.23,10.55],[-5.72,10.55]],[[-7.00,2.44],[-5.74,10.50]]]){
    line(a,b,.238,.027,.027,'#56828d');
    line(a,b,.366,.035,.023,'#56828d');
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]), count=Math.ceil(len/.30);
    for(let i=0;i<=count;i++)box(.020,.267,.020,a[0]+(b[0]-a[0])*i/count,.233,a[1]+(b[1]-a[1])*i/count,'#658992');
  }
  return root;
}
