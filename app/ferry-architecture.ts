import {harryBridgesGround,westMarketGround} from './curb-survey.ts';
import {createMarketPaving} from './market-paving.ts';
import {createFerryBikeRacks} from './ferry-bike-racks.ts';
import {addMarketStreet} from './market-street.ts';
import {addPlazaBenches,southPlazaTop} from './plaza-survey.ts';
import * as THREE from 'three';
import type { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { footprintGeometry, sfMap } from './sf-map.ts';

const pale='#dfd8c8', ashlar='#cbc6b7', deep='#485f63';

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
  const {root,box,mesh,extrude,line}=builders('Ferry Building hall');
  const footprint=sfMap.buildings.find(b=>b.id===558731934)!.p;
  const left=Math.min(...footprint.map(p=>p[0])),right=Math.max(...footprint.map(p=>p[0]));
  const centerX=(left+right)/2, width=right-left;
  const bayZ=Math.max(...footprint.map(p=>p[1])), streetZ=footprint[0][1];
  const porticoZ=Math.min(...footprint.map(p=>p[1])), towerX=(1.181-1.418)/2;
  const depth=bayZ-streetZ,breezeWidth=.49;
  const street=new THREE.Group(),bay=new THREE.Group();
  street.name='Embarcadero arcade and portico';
  bay.name='Ferry Plaza elevation';
  street.position.set(centerX,0,streetZ);
  street.rotation.y=Math.PI;
  bay.position.set(centerX,0,bayZ);
  root.add(street,bay);

  function roundWindow(w:number,h:number){
    const arch=new THREE.Shape(),r=w/2;
    arch.moveTo(-r,0);arch.lineTo(r,0);arch.lineTo(r,h-r);
    arch.absarc(0,h-r,r,0,Math.PI,false);arch.closePath();return arch;
  }
  function lowerPanel(g:THREE.Group,x:number,w:number,lo:number,hi:number,r:number,openingTop:number,th=.082){
    const p=new THREE.Shape();
    p.moveTo(-w/2,lo);p.lineTo(-w/2,hi);p.lineTo(w/2,hi);p.lineTo(w/2,lo);
    p.lineTo(r,lo);
    if(r){
      p.lineTo(r,openingTop-r);p.absarc(0,openingTop-r,r,0,Math.PI,false);
    }
    p.lineTo(-r,lo);p.closePath();
    return extrude(p,th,ashlar,x,0,-th,g);
  }
  function archedOpening(g:THREE.Group,x:number,w:number,lo:number,hi:number,r:number,top:number,style:'small'|'tall'){
    lowerPanel(g,x,w,lo,hi,r,top).name='Pierced arcade panel';
    const edge=style==='tall'?.017:.010;
    const spring=top-r;
    mesh(new THREE.TorusGeometry(r+.006,edge,5,16,Math.PI),pale,x,spring,.009,g);
    for(const sign of [-1,1]){
      box(edge*1.42,spring-lo,.026,x+sign*(r+.006),(lo+spring)/2,.008,pale,g);
      box(edge*2.5,.015,.037,x+sign*(r+.006),spring,.015,pale,g);
    }
  }
  function sash(g:THREE.Group,x:number,base:number,w:number,h:number,z:number,style:'small'|'bay'|'end'){
    const tint=style==='bay'?'#5d7374':deep;
    extrude(roundWindow(w,h),.012,tint,x,base,z,g).name=style==='bay'?'East round-headed sash':'Round-headed sash';
    const r=w/2,spring=h-r,frame=style==='bay'?'#81918a':'#a8aa9d';
    for(const fraction of style==='bay'?[-.72,-.36,0,.36,.72]:[-.62,0,.62]){
      const pane=spring+r*Math.sqrt(1-fraction*fraction);
      box(style==='bay'?.009:.011,pane*.98,.012,x+fraction*r,base+pane/2,z+.016,frame,g);
    }
    box(w,.008,.016,x,base+spring,z+.016,frame,g);
    box(w*.93,.008,.015,x,base+spring*.47,z+.016,frame,g);
    mesh(new THREE.TorusGeometry(r+.004,style==='bay'?.006:.009,5,17,Math.PI),style==='bay'?'#89978d':pale,x,base+spring,z+.018,g);
    if(spring>.016)for(const sign of [-1,1])box(.014,spring,.017,x+sign*(r+.004),base+spring/2,z+.019,pale,g);
    box(w+.016,.015,.022,x,base-.006,z+.016,ashlar,g);
  }
  function storefront(g:THREE.Group,x:number,w:number,lo:number,h:number,z:number,finish:string){
    box(w,h,.018,x,lo+h/2,z,finish,g);
    for(const i of [-.37,-.19,0,.19,.37])box(.010,h,.019,x+i*w,lo+h/2,z+.013,'#8e9c92',g);
    box(w,.011,.014,x,lo+h*.70,z+.019,'#a6aa97',g);
    box(w,.036,.018,x,lo+.017,z+.015,'#8e8e7e',g);
  }

  // The ground-floor breezeway remains open between plazas. Its floor and mezzanine
  // bridge the slot between the two ground-floor volumes.
  box(width-.07,.054,depth+.07,centerX,.076,(bayZ+streetZ)/2,ashlar).name='Breezeway paving';
  for(const [a,b] of [[left+.12,towerX-breezeWidth/2],[towerX+breezeWidth/2,right-.12]]){
    box(b-a,.279,depth-.44,(a+b)/2,.240,(bayZ+streetZ)/2,'#8b9188');
    box(.034,.271,depth-.42,a<towerX?b:a,.240,(bayZ+streetZ)/2,'#bab7a8');
  }
  box(width-.16,.475,depth-.125,centerX,.639,(bayZ+streetZ)/2,'#aeb0a4').name='Ferry Hall upper volume and breezeway ceiling';
  for(const z of [-1.02,-.48,.21,.93]){
    box(breezeWidth-.035,.012,.016,towerX,.372,z,'#e0c69a');
  }

  // Page & Turnbull west elevation, p. 17. Small recessed arches and a central
  // portico with three tall arches between a narrower pair.
  const porticoWidth=2.63,porticoCenter=centerX-towerX;
  const westWing=[{a:-width/2,b:porticoCenter-porticoWidth/2,openSpans:[6,16]},
    {a:porticoCenter+porticoWidth/2,b:width/2,openSpans:[10]}];
  for(const {a,b,openSpans} of westWing){
    const pitch=(b-a)/18;
    for(let i=0;i<18;i++){
      const x=a+(i+.5)*pitch;
      lowerPanel(street,x,pitch,.413,.944,pitch*.362,.766,.062);
      sash(street,x,.432,pitch*.697,.325,-.026,'small');
      box(.011,.303,.014,x-pitch*.451,.599,.010,'#bdb8a8',street);
      if(openSpans.includes(i)){
        box(pitch*2,.052,.087,x+pitch/2,.377,-.036,ashlar,street);
        continue;
      }
      if(openSpans.includes(i-1))continue;
      archedOpening(street,x,pitch,.109,.400,pitch*.343,.339,'small');
      const glass=i<6||i>11?'#637776':'#52635e';
      storefront(street,x,pitch*.75,.111,.219,-.222,glass);
    }
  }
  const portico=new THREE.Group();portico.name='Central five-bay entrance';
  portico.position.set(porticoCenter,0,streetZ-porticoZ);street.add(portico);
  let cursor=-porticoWidth/2;
  for(const [i,span] of [.41,.60333,.60334,.60333,.41].entries()){
    const x=cursor+span/2,outer=i===0||i===4,r=outer?.117:.196;
    const top=outer?.537:.784;
    archedOpening(portico,x,span,.111,1.023,r,top,'tall');
    if(outer){
      sash(portico,x,.59,span*.67,.133,.008,'small');
      storefront(portico,x,span*.77,.115,.35,-.367,'#75837a');
    }else{
      const arch=roundWindow(r*1.91,top-.407);
      extrude(arch,.014,'#9d9c86',x,.405,-.112,portico);
      for(const d of [-.61,-.31,0,.31,.61]){
        box(.009,.206,.011,x+d*r,.513,-.094,'#c2bc9f',portico);
      }
      box(r*1.91,.024,.035,x,.406,-.086,'#8e8876',portico);
      if(i!==2)storefront(portico,x,r*1.97,.113,.45,-.610,'#687a6d');
    }
    if(i>0){
      box(.065,.832,.075,cursor,.56,.009,pale,portico);
      for(const side of [-1,1]){
        const cx=cursor+side*.044;
        box(.069,.144,.088,cx,.178,.038,ashlar,portico);
        box(.075,.023,.096,cx,.257,.040,pale,portico);
        mesh(new THREE.CylinderGeometry(.030,.034,.582,12),pale,cx,.558,.052,portico).name='Portico engaged column';
        mesh(new THREE.CylinderGeometry(.046,.030,.055,8),pale,cx,.875,.052,portico);
        box(.089,.019,.096,cx,.911,.046,pale,portico);
      }
    }
    cursor+=span;
  }
  for(const side of [-1,1])box(.082,.896,streetZ-porticoZ+.046,side*porticoWidth/2,.558,-.258,ashlar,portico);
  for(const y of [.938,.973,1.018]){
    box(porticoWidth+.07,.027,.091,0,y,.023,pale,portico);
  }
  // The three treads rise from the curbside pavement to the existing hall floor.
  for(let step=0;step<3;step++){
    const top=.1125-step*.015,base=.030;
    box(porticoWidth+.08+step*.058,top-base,.09,0,(top+base)/2,.055+step*.057,'#ccc4b1',portico);
  }
  const landingDepth=streetZ-porticoZ;
  box(porticoWidth,.054,landingDepth+.015,0,.076,.014-landingDepth/2,ashlar,portico).name='Portico landing';

  // Port/SFMTA right-of-way polygons 110 and 128 already pave the west
  // approach, including the curb returns and accessible ramps. Match their
  // east edge at the existing .031 grade, then rise to the hall foundation.
  const interpolateZ=(x:number,ax:number,az:number,bx:number,bz:number)=>
    THREE.MathUtils.lerp(az,bz,(x-ax)/(bx-ax));
  const forecourt=[
    [left,interpolateZ(left,-11.572,-1.266,-1.536,-1.524)],
    [-1.536,-1.524],[-1.537,-1.729],[-1.418,-1.723],[-1.418,-1.748],
    [0,-1.745],[1.181,-1.744],[1.181,-1.594],
    [right,interpolateZ(right,1.181,-1.594,11.570,-1.862)],
    [right,streetZ+.025],[left,streetZ+.025]
  ];
  const pavement:number[]=[];
  const triangles=THREE.ShapeUtils.triangulateShape(forecourt.map(([x,z])=>new THREE.Vector2(x,-z)),[]);
  for(const tri of triangles)for(const i of tri){
    const [x,z]=forecourt[i];
    pavement.push(x,i>=forecourt.length-2?.064:.031,z);
  }
  const walk=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(pavement,3));
  walk.computeVertexNormals();
  mesh(walk,'#c9c5b3',0,0,0).name='Embarcadero forecourt pavement';

  // The restored bay-side elevation has 23 round-headed office windows above
  // a rectangular arcade with independent iron columns and recessed shops.
  const bayCount=23,bayPitch=width/bayCount,column='#7b8d83';
  const base=.601,bayTop=.902,r=bayPitch*.445,spring=.610,archedTop=spring+r;
  for(let i=0;i<bayCount;i++){
    const x=(i+.5)*bayPitch-width/2,walkthrough=i===11;
    lowerPanel(bay,x,bayPitch,base,bayTop,r,archedTop,.066).name='East window field';
    sash(bay,x,base+.001,r*1.95,archedTop-base-.007,-.036,'bay');
    // The distinct continuous glass band sits between the arches and the lower arcaded walk.
    const glass=['#738b8b','#789293','#647d7d','#6a8483','#7a9190'];
    for(let pane=0;pane<4;pane++){
      const w=bayPitch/4, cx=x-bayPitch/2+(pane+.5)*w;
      box(w-.008,.171,.017,cx,.511,.006,glass[(pane*3+i*7)%glass.length],bay).name='East mezzanine glazing band';
      box(.009,.184,.014,cx-w/2,.512,.022,'#99a39a',bay);
    }
    if(walkthrough){
      for(const side of [-1,1]){
        storefront(bay,towerX-centerX+side*.184,.070,.106,.258,-.173,'#687772');
        box(.015,.280,.024,towerX-centerX+side*.221,.235,-.162,column,bay);
      }
      box(.405,.039,.021,towerX-centerX,.365,-.173,'#87958a',bay).name='Central breezeway transom';
    }else{
      storefront(bay,x,bayPitch*.95,.105,.277,-.176,i%5===4?'#708176':'#586d66');
      if(i%4===1||i%5===3)box(bayPitch*.91,.025,.036,x,.307,-.155,'#939e90',bay);
    }
  }
  const columnGeo=new THREE.CylinderGeometry(.012,.017,.249,8);
  for(let i=0;i<=bayCount;i++){
    const x=-width/2+i*bayPitch;
    mesh(columnGeo,column,x,.24,.010,bay).name='Reused cast-iron arcade column';
    box(.041,.022,.037,x,.112,.010,'#a4a89a',bay);
    box(.037,.028,.040,x,.376,.010,'#9da798',bay);
  }
  box(width+.06,.037,.195,0,.391,-.055,ashlar,bay).name='Cantilevered east arcade soffit';
  box(width,.018,.053,0,.422,.023,pale,bay);
  box(width+.021,.018,.044,0,.602,.013,'#b4b8aa',bay);
  for(const g of [street,bay]){
    const y=g===street?.94:.90;
    box(width+.12,.045,.084,0,y,.010,pale,g);
    box(width+.10,.015,.076,0,y-.028,.008,'#b1b4a8',g);
    box(width+.08,.025,.063,0,.104,.028,'#d1c9b8',g);
    for(let x=-width/2+.10;x<width/2;x+=g===street?.134:.174){
      box(.039,.014,.041,x,y-.048,.042,'#dad8ca',g);
    }
  }

  // Three parallel gables articulate the end elevations rather than the former single hip.
  const roofs=[
    {start:streetZ-.077,end:streetZ+.965,eave:.951,rise:.227},
    {start:streetZ+.965,end:streetZ+1.94,eave:.902,rise:.167},
    {start:streetZ+1.94,end:bayZ+.061,eave:.902,rise:.122},
  ];
  for(const [i,{start,end,eave,rise}] of roofs.entries()){
    const z=(start+end)/2,leg=(end-start)/2,pitch=Math.atan2(rise,leg),slant=Math.hypot(rise,leg);
    const tone=['#6e7672','#757c76','#747e76'][i];
    for(const side of [-1,1]){
      const panel=box(width+.13,.023,slant,centerX,eave+rise/2,z+side*leg/2,tone);
      panel.rotation.x=side*pitch;panel.name='Ferry Hall gable roof plane';
      for(let x=left+.09;x<right;x+=.193){
        const seam=box(.005,.004,slant-.024,x,eave+rise/2+.014,z+side*leg/2,'#7c837a');
        seam.rotation.x=side*pitch;
      }
    }
    box(width+.103,.017,.055,centerX,eave+rise+.016,z,'#94a095');
    for(const x of [left,right]){
      const endElevation=new THREE.Group();
      endElevation.position.set(x,0,z);endElevation.rotation.y=x===left?-Math.PI/2:Math.PI/2;root.add(endElevation);
      box(end-start,.805,.048,0,.500,-.023,ashlar,endElevation);
      const peak=new THREE.Shape();
      peak.moveTo(-leg,.872);peak.lineTo(leg,.872);peak.lineTo(leg,eave);peak.lineTo(0,eave+rise);peak.lineTo(-leg,eave);peak.closePath();
      extrude(peak,.055,ashlar,0,0,-.05,endElevation).name='Ferry Hall end gable';
      sash(endElevation,0,.388,leg*.96,.452,.009,'end');
      storefront(endElevation,0,leg*1.28,.108,.245,.009,'#63786d');
      box(end-start,.023,.065,0,.360,.017,pale,endElevation);
      box(end-start,.021,.065,0,.390,.017,pale,endElevation);
    }
  }
  const last=roofs.at(-1)!,ridgeZ=(last.start+last.end)/2;
  const monitorWidth=width*.13;
  for(const fraction of [-.304,0,.304]){
    const x=centerX+width*fraction,y=last.eave+last.rise;
    box(monitorWidth,.054,.147,x,y+.027,ridgeZ,'#687e7c').name='East roof glazing monitor';
    box(monitorWidth+.047,.016,.170,x,y+.063,ridgeZ,'#9ca49a');
    for(let n=x-monitorWidth/2+.03;n<x+monitorWidth/2;n+=.105)box(.009,.056,.151,n,y+.025,ridgeZ,'#a7aca0');
  }
  // The sign is split across two steel racks at either side of the clock tower.
  const waterfrontSign=new THREE.Group();waterfrontSign.name='PORT OF SAN FRANCISCO';
  waterfrontSign.position.set(centerX,1.23,bayZ-.157);root.add(waterfrontSign);
  for(const [label,x,span] of [['PORT OF',-1.34,1.09],['SAN FRANCISCO',1.82,2.04]] as const){
    const words=new TextGeometry(label,{font,size:.151,depth:.012,curveSegments:4});
    words.computeBoundingBox();
    const bounds=words.boundingBox!,w=bounds.max.x-bounds.min.x;
    words.translate(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,0);
    // Both finishes belong to the same extrusion. A second copy of the caps
    // used to fall inside one depth-buffer step at normal orbit distances.
    const normals=words.getAttribute('normal');
    const colors=new Float32Array(normals.count*3);
    const face=new THREE.Color('#b95e50'),returns=new THREE.Color('#87594f');
    for(let i=0;i<normals.count;i++)(normals.getZ(i)>.99?face:returns).toArray(colors,i*3);
    words.setAttribute('color',new THREE.BufferAttribute(colors,3));
    words.userData.paintVertices=true;
    const sign=mesh(words,'#ffffff',x,.025,.009,waterfrontSign);sign.name=label;
    sign.scale.x=span/w;
    const supportBase=.952;
    box(span+.052,.016,.026,x,.013,.003,'#728881',waterfrontSign);
    for(let station=-span/2+.026;station<=span/2;station+=.195){
      const h=waterfrontSign.position.y-supportBase+.041;
      box(.012,h,.023,x+station,.041-h/2,-.012,'#718680',waterfrontSign);
      box(.047,.014,.079,x+station,supportBase-waterfrontSign.position.y,-.021,'#8e9588',waterfrontSign);
    }
    line([centerX+x-span/2,bayZ-.184],[centerX+x+span/2,bayZ-.184],1.161,.012,.017,'#83938b');
  }
  // HLB's restoration lights the west entry pedestals, paired columns, arches
  // and entablature. The recessed glazed openings retain their darker centers.
  // https://hlblighting.com/project/san-francisco-ferry-building/
  function hallUplight(p:THREE.Vector3,n:THREE.Vector3){
    const west=p.z<streetZ+.12;
    const side=west?-1:1;
    const column=west&&Math.abs(p.x-towerX)<porticoWidth/2&&p.z<streetZ-.09;
    const height=THREE.MathUtils.smoothstep(p.y,.075,.27)*(1-THREE.MathUtils.smoothstep(p.y,.97,1.08));
    const incidence=.25+.66*Math.max(0,n.z*side)+.28*Math.max(0,-n.y);
    return height*incidence*(column?.96:west?.65:.40);
  }
  for(const side of [street,bay])side.traverse(o=>{if(o instanceof THREE.Mesh)o.userData.uplight=hallUplight;});
  return {root,towerX,towerZ:(porticoZ+streetZ)/2+.24};
}

export function ferryPublicRealm() {
  const {root,box,mesh,slab,line}=builders('Ferry plaza and Market Street');
  const metal='#586f70';
  root.add(createMarketPaving());
  addMarketStreet(mesh,root);
  root.add(createFerryBikeRacks());
  // The Ferry Building's forecourt has its own single-head plaza lights.
  for(const z of [-2.05,-7.45])for(const side of [-1,1]){
    const streetX=-.13+z*.133;
    const x=streetX+side*(z>-10?.83:.90), y=harryBridgesGround(x,z)??(z>-3?.031:westMarketGround(x,z));
    mesh(new THREE.CylinderGeometry(.018,.035,.64,7),metal,x,y+.32,z);
    box(.067,.082,.064,x,y+.049,z,metal);
    box(.039,.068,.041,x,y+.64,z,'#e8d4a6');
    mesh(new THREE.ConeGeometry(.039,.045,8),metal,x,y+.693,z);
  }
  // Port inventory C3 identifies the two Millennium light sculptures. The
  // 2024 8 cm orthophoto places their eight-sided landings at these OSM pins.
  // https://www.sfport.com/media/9230/download
  // https://artandarchitecture-sf.com/light-cannons-at-the-ferry-building.html
  for(const [x,z] of [[1.266,-4.647],[-2.218,-4.670]]){
    const y=harryBridgesGround(x,z)!,steel='#a5afad',stone='#b8b2a3';
    const tower=new THREE.Group();tower.name='Harry Bridges Plaza Millennium light';root.add(tower);
    tower.position.set(x,y,z);
    const section=(base:number,top:number,bottomRadius:number,topRadius:number,sides:number,color:string)=>{
      const part=mesh(new THREE.CylinderGeometry(topRadius,bottomRadius,top-base,sides),color,0,(base+top)/2,0,tower);
      part.rotation.y=Math.PI/sides;
      return part;
    };
    for(let i=0;i<4;i++)section(.009*i,.009*(i+1),.413-i*.021,.413-i*.021,8,stone);
    section(.036,.089,.157,.157,8,stone);
    section(.089,.376,.118,.112,12,'#afa99b');
    section(.376,.395,.115,.091,12,steel);
    section(.395,.638,.052,.049,12,steel);
    section(.636,.657,.064,.064,12,'#8f9999');
    section(.657,.855,.022,.021,10,steel);
    for(let i=0;i<4;i++){
      const a=Math.PI*(.25+i/2),out=new THREE.Vector3(Math.cos(a),0,Math.sin(a));
      const bottom=out.clone().multiplyScalar(.038);bottom.y=.654;
      const top=out.clone().multiplyScalar(.088);top.y=.859;
      const brace=box(.015,bottom.distanceTo(top),.015,0,0,0,steel,tower);
      brace.position.copy(bottom).lerp(top,.5);
      brace.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),top.sub(bottom).normalize());
    }
    section(.855,.871,.114,.114,4,'#838e90');
    section(.871,1.011,.114,.183,4,steel);
    section(1.011,1.021,.184,.184,4,'#7e8889');
    section(1.021,1.189,.004,.0008,6,steel);
  }
  addPlazaBenches(mesh,root);
  // The granite map occupies the plaza between the hall and Agriculture Building.
  // Its north–south axis fits between the two facades. The charcoal stone traces
  // the Bay from Alviso through San Pablo Bay; metal dots identify ferry landings.
  const forecourt=[[-9.83,-.69],[-6.26,-1.20],[-6.26,1.64],[-7.05,2.14],[-8.65,2.14],[-8.65,1.77],[-9.83,1.77]];
  slab(forecourt,southPlazaTop,.030,'#c1baa9').name='South terminal granite plaza';
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
  slab(shore.map(([lo,la])=>paper(lo,la)),southPlazaTop+.001,.002,'#848e89').name='Bay inlay';
  for(const island of [[[-122.43,37.86],[-122.42,37.87],[-122.41,37.86],[-122.43,37.85]],
    [[-122.37,37.83],[-122.36,37.82],[-122.36,37.81],[-122.37,37.81]]])slab(island.map(([lo,la])=>paper(lo,la)),southPlazaTop+.002,.001,'#c9c1ae');
  const terminal=paper(-122.3935,37.7955);
  for(const [lo,la] of [[-122.34,38.10],[-122.36,37.91],[-122.28,37.795],[-122.30,37.79],[-122.25,37.74],[-122.38,37.66]]){
    const dest=paper(lo,la);line(terminal,dest,southPlazaTop+.002,.005,.001,'#b29c75');
    mesh(new THREE.CylinderGeometry(.016,.016,.0015,10),'#c2a46c',dest[0],southPlazaTop+.003,dest[1]);
  }
  // Sawn stone joints cross the darker map and continue to the restaurant entrance.
  for(let i=0;i<11;i++){
    const x=-9.76+i*.335;
    line([x,-.62-(x+9.76)*.14],[x,x<-8.65?1.74:1.63],southPlazaTop+.004,.004,.001,'#a39d8d');
  }
  for(let z=-.58;z<1.74;z+=.302)line([-9.81,z],[-6.28,z],southPlazaTop+.004,.005,.001,'#a6a191');
  slab([[-10.48,1.15],[-9.75,1.15],[-9.75,1.96],[-10.48,1.96]],southPlazaTop+.001,.025,'#b6afa1').name='Pier 2 entrance landing';
  for(const z of [1.28,1.48,1.68,1.88])line([-10.46,z],[-9.76,z],southPlazaTop+.003,.007,.002,'#a99c87');
  for(const [x,z,len] of [[-9.46,-.44,.64],[-6.62,-.64,.59],[-6.61,.78,.43]]){
    box(.18,.071,len,x,.141,z,'#b4ac9a');
    for(let slat=0;slat<3;slat++)box(.024,.012,len,x-.056+slat*.028,.183,z,'#a39174');
    box(.062,.013,len-.04,x+.052,.183,z,'#757e64');
    for(let k=0;k<6;k++){
      const stem=mesh(new THREE.ConeGeometry(.018,.091+k%3*.013,5),'#829077',x+.05,.223,z+(k/5-.5)*(len-.12));
      stem.rotation.z=(k%3-1)*.23;
    }
  }
  // Keep the passage and the apron clear for ferry queues; the movable market
  // stands live alongside the building and the fixed deck is built by the terminal.
  for(let x=-6.08;x<6.23;x+=.366){
    line([x,1.658],[x,2.206],.097,.005,.003,'#a19989');
  }
  return root;
}
