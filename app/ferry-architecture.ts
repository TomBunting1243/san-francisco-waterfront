import {ferryWalkLens} from './ferry-walk-lights.ts';
import {taylorCounter,taylorTerrace} from './taylors-refresher.ts';
import {ferryPatios} from './ferry-patios.ts';
import {ferryGlazing} from './ferry-portico-glazing.ts';
import {ferryEntryX,ferryHallFloor,ferryTowerZ,ferryTreads} from './ferry-portico-access.ts';
import {harryBridgesGround,westMarketGround} from './curb-survey.ts';
import {createMarketPaving} from './market-paving.ts';
import {createFerryBikeRacks} from './ferry-bike-racks.ts';
import {addFrostPlaza} from './frost-plaza.ts';
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
  const porticoZ=Math.min(...footprint.map(p=>p[1])), towerX=ferryEntryX;
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
    const glazing=extrude(roundWindow(w,h),.012,tint,x,base,z,g);
    glazing.name=style==='bay'?'East round-headed sash':'Round-headed sash';
    // The Pier 1 photograph resolves individual lit rooms behind the arches
    // and bright end windows. The particular occupied rooms are inferred.
    if(style!=='small'){
      const room=Math.round((x+width/2)/(width/23));
      if(style==='end'||room%5===2||room%7===3)glazing.userData.signLight=[.42,.31,.18];
    }
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
    const glazing=box(w,h,.018,x,lo+h/2,z,finish,g);
    for(const i of [-.37,-.19,0,.19,.37])box(.010,h,.019,x+i*w,lo+h/2,z+.013,'#8e9c92',g);
    box(w,.011,.014,x,lo+h*.70,z+.019,'#a6aa97',g);
    box(w,.036,.018,x,lo+.017,z+.015,'#8e8e7e',g);
    return glazing;
  }

  // The ground-floor breezeway remains open between plazas. Its floor and mezzanine
  // bridge the slot between the two ground-floor volumes.
  const arcadeBack=streetZ+.547,bayEdge=bayZ+.035;
  box(width-.07,.054,bayEdge-arcadeBack,centerX,ferryHallFloor-.027,(bayEdge+arcadeBack)/2,ashlar).name='Breezeway paving';
  for(const [a,b] of [[left+.12,towerX-breezeWidth/2],[towerX+breezeWidth/2,right-.12]]){
    // Set the marketplace back to column line B. The original box sat in
    // front of the west shop windows, hiding their glazing and closed doors.
    const westBack=streetZ+.75,eastBack=bayZ-.22;
    box(b-a,.279,eastBack-westBack,(a+b)/2,.240,(eastBack+westBack)/2,'#8b9188');
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
  const shops=ferryGlazing(street);
  for(const {a,b,openSpans} of westWing){
    const pitch=(b-a)/18;
    for(let i=0;i<18;i++){
      const x=a+(i+.5)*pitch;
      lowerPanel(street,x,pitch,.413,.944,pitch*.362,.766,.062);
      sash(street,x,.432,pitch*.697,.325,-.026,'small');
      box(.011,.303,.014,x-pitch*.451,.599,.010,'#bdb8a8',street);
      if(openSpans.includes(i)){
        box(pitch*2,.052,.087,x+pitch/2,.377,-.036,ashlar,street);
        for(let k=0;k<2;k++)shops.shop(x+k*pitch,pitch*.94,-.43,i+k);
        continue;
      }
      if(openSpans.includes(i-1))continue;
      archedOpening(street,x,pitch,.109,.400,pitch*.343,.339,'small');
      // The arcaded walk extends along the facade; the tenant frontage is
      // visible beyond the arch, not installed between its granite jambs.
      const gallery=a<0?i>=7:i<10,z=gallery?-.430:-.226;
      const taylors=centerX-x>=4.27&&centerX-x<=5.88;
      const serviceCounter=taylors&&Math.abs(centerX-x-5.47)<pitch/2;
      shops.shop(x,pitch*.96,z,i,taylors,serviceCounter);
      if(taylors){
        // The remembered Taylor’s dining room opens onto the picnic tables.
        // Treat the arch mouth as an area source for the escaping shop light.
        const aperture=new THREE.Object3D();
        aperture.name="Taylor's dining-room light aperture";
        if(serviceCounter)street.add(taylorCounter(x,z,pitch));
        aperture.position.set(x,.27,-.014);
        aperture.userData.ferryWalkPool={radius:1.49,strength:.81};street.add(aperture);
      }
      if(gallery){
        box(pitch,.013,.40,x,.354,-.224,'#939382',street);
        if(i%3===1)box(.029,.009,.029,x,.337,-.196,'#dfd3af',street).userData.signLight=[.35,.24,.13];
      }
    }
  }
  shops.finish();
  const portico=new THREE.Group();portico.name='Central five-bay entrance';
  portico.position.set(porticoCenter,0,streetZ-porticoZ);street.add(portico);
  const entries=ferryGlazing(portico);
  let cursor=-porticoWidth/2;
  for(const [i,span] of [.41,.60333,.60334,.60333,.41].entries()){
    const x=cursor+span/2,outer=i===0||i===4,r=outer?.117:.196;
    const top=outer?.537:.784;
    archedOpening(portico,x,span,.111,1.023,r,top,'tall');
    const lineA=-(streetZ-porticoZ),lineB=lineA-.491;
    const clear=2*r,entryTop=outer?.343:.397;
    // Page & Turnbull 2024, memo fig. 2 and exhibit 46. The three large
    // fanlights are set into the FRONT wall of the portico. The elevator
    // and breezeway doors are on line A, the outer market doors on line B.
    entries.fanlight(x,r*1.92,entryTop+.012,top-.010,-.070);
    box(clear+.014,.026,.065,x,entryTop,-.035,'#b2b09b',portico);
    if(outer)sash(portico,x,.59,span*.67,.133,.008,'small');
    const doorZ=outer?lineB:lineA;
    // Keep the front portion of the portico open sideways as in exhibit 46.
    if(outer){
      entries.returnWall(x-clear*.54,.104,.333,lineA,doorZ-.130,true);
      entries.returnWall(x+clear*.54,.104,.333,lineA,doorZ-.130,false);
    }
    if(i===3){
      for(let step=0;step<14;step++){
        const top=.113+step*.010;
        box(clear,.010,.028,x,top-.005,lineA-step*.024,'#a79d87',portico);
      }
      entries.doors(x,clear,lineA-.280,.223,.155);
      entries.pane(x,.311,lineA-.354,clear,.171,'#59625b');
    }else{
      entries.doors(x,clear,doorZ,.103,outer?.210:.242,i===2);
      if(i!==2)entries.shop(x,clear*1.02,doorZ-.078,i+2);
    }
    for(const dir of [-1,1]){
      box(.018,.245,.095,x+dir*(clear/2+.014),.226,lineA-.004,ashlar,portico);
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
  entries.finish();
  for(const side of [-1,1])box(.082,.896,streetZ-porticoZ+.046,side*porticoWidth/2,.558,-.258,ashlar,portico);
  for(const y of [.938,.973,1.018]){
    box(porticoWidth+.07,.027,.091,0,y,.023,pale,portico);
  }
  for(const tread of ferryTreads){
    box(porticoWidth+.08+tread.extraWidth,tread.top-.030,tread.depth,0,(tread.top+.030)/2,
      porticoZ-tread.z,'#ccc4b1',portico);
  }
  const landingFront=ferryTreads[0].z+ferryTreads[0].depth/2;
  box(porticoWidth,.054,streetZ-landingFront,towerX,ferryHallFloor-.027,(landingFront+streetZ)/2,ashlar).name='Portico landing';
  // Continuous grade from the top tread into the hall; each finish owns its footprint.
  for(const [a,b,front] of [[left+.030,towerX-porticoWidth/2,streetZ-.035],
    [towerX-porticoWidth/2,towerX+porticoWidth/2,streetZ],[towerX+porticoWidth/2,right-.030,streetZ-.035]]){
    box(b-a,.036,arcadeBack-front,(a+b)/2,ferryHallFloor-.018,(front+arcadeBack)/2,pale).name='Recessed arcade paving';
  }

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
  mesh(taylorTerrace(),'#ffffff',0,0,0).name='North café paving and south approach';

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
      const worldX=centerX+x;
      const slantedDoor=worldX>=4.17&&worldX<5.88;
      const glazing=storefront(bay,x,bayPitch*.95,.105,.277,-.176,slantedDoor?'#405956':i%5===4?'#708176':'#586d66');
      const dining=worldX>=1.63&&worldX<3.27||worldX>=4.17&&worldX<5.88;
      const coffee=worldX>=-4.26&&worldX< -3.61;
      // Dyer's Hog Island night elevation shows
      // flush downlights. Continue the softer public walk beneath the same
      // soffit between frontages; only the photographed dining rooms glow.
      if(dining){
        // Recess the room behind the existing sash. Vary individual pools of
        // interior light behind the glass; the lower privacy screen stays cool.
        glazing.position.z-=.022;
        glazing.userData.signLight=[.13,.12,.085];
        for(const side of [-1,1]){
          const inset=x+side*bayPitch*.22;
          const wall=box(bayPitch*.37,.105,.005,inset,.255,-.181,'#888478',bay);
          wall.userData.signLight=side===1&&i%2===0?[.41,.28,.15]:[.27,.19,.12];
          const lamp=box(.038,.023,.009,inset,.288,-.172,'#e0d6bb',bay);
          lamp.userData.signLight=[.79,.62,.40];
          if(slantedDoor){
            const screen=box(bayPitch*.39,.081,.007,inset,.162,-.165,'#91a9a0',bay);
            screen.userData.signLight=[.12,.16,.14];
          }
        }
      }
      const lens=mesh(new THREE.CylinderGeometry(.013,.013,.003,10),'#e9dfc7',x,.371,-.027,bay);
      ferryWalkLens(lens,'East arcade recessed downlight',.81,dining?.89:coffee?.57:.50,true);
      if(i%4===1||i%5===3)box(bayPitch*.91,.025,.036,x,.307,-.155,'#939e90',bay);
    }
  }
  // Koeppel describes an exterior bay-side entrance. Hayler's 2013 photo
  // shows a small white transfer on clear glass and a silver vertical pull.
  // The exact door leaf within the northeast frontage is reconstructed.
  const doorMark=new THREE.Group();doorMark.name='The Slanted Door';
  const entryBayX=-width/2+Math.ceil((4.17-left)/bayPitch-.5)*bayPitch+bayPitch/2;
  doorMark.position.set(entryBayX-bayPitch*.09,.188,-.153);bay.add(doorMark);
  const transfer=.024;
  for(const [word,width,y] of [['THE',.24,.0049],['SLANTED',1,0],['DOOR',.55,-.0049]] as const){
    const geo=new THREE.ShapeGeometry(font.generateShapes(word,1),2);
    geo.computeBoundingBox();const bounds=geo.boundingBox!;
    const scale=transfer*width/(bounds.max.x-bounds.min.x);
    geo.translate(-(bounds.min.x+bounds.max.x)/2,-(bounds.min.y+bounds.max.y)/2,0);
    const ink=mesh(geo,'#bdc8c0',0,y,.001,doorMark);
    ink.scale.setScalar(scale);ink.name='The Slanted Door '+word;
  }
  box(.0018,.027,.002,transfer*.93,-.021,.002,'#aab6b0',doorMark);
  box(.051,.002,.003,0,.044,0,'#909d95',doorMark);
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
  const copingDepth=.084,copingCenter=.010,copingHeight=.045,streetCopingY=.94;
  for(const g of [street,bay]){
    const y=g===street?streetCopingY:.90;
    box(width+.12,copingHeight,copingDepth,0,y,copingCenter,pale,g).name='Long arcade coping';
    box(width+.10,.015,.076,0,y-.028,.008,'#b1b4a8',g);
    // The water table terminates at the through door; its moulding cannot
    // run across the central walking surface.
    // The northwest café also opens directly onto the arcade floor.
    const end=g===street?centerX-4.30:-width/2-.04;
    for(const [a,b] of [[end,-.26],[.26,width/2+.04]])
      box(b-a,.025,.063,(a+b)/2,.104,.028,'#d1c9b8',g);
    for(let x=-width/2+.10;x<width/2;x+=g===street?.134:.174){
      box(.039,.014,.041,x,y-.048,.042,'#dad8ca',g);
    }
  }

  // Page & Turnbull, roof plan and end elevations, pp. 29 and 21:
  // https://www.sfport.com/media/9505/download#page=29
  // 2023 USGS 1.5 m DSM profiles across the nave place the three crests
  // around z=-.18, +.66 and +1.40; the clock returns span z=-1.315..-.505.
  const towerZ=ferryTowerZ,shaft=.324;
  // Both long roof edges terminate against the inner cheek of the stone
  // coping. The old bay slope continued through it, leaving a flickering
  // sliver of sheet metal poking out underneath the cornice.
  const copingInset=copingDepth/2-copingCenter;
  const roofWest=streetZ+copingInset,roofEast=bayZ-copingInset,firstEave=-.66;
  const roofs=[
    {start:firstEave,ridge:-.180,end:.305,low:.952,high:1.151,tone:'#717973'},
    {start:.305,ridge:.665,end:1.145,low:.882,high:1.047,tone:'#757d77'},
    {start:1.145,ridge:1.403,end:roofEast,low:.882,high:.967,tone:'#768078'},
  ];
  const roofPoints:number[]=[],roofColors:number[]=[],roofIndices:number[]=[];
  const pigment=new THREE.Color();
  // Each patch meets its neighbour edge-to-edge. The ridge cap, seam paint,
  // glazing and flashings are part of the skin, with no superposed planes.
  function strip(a:number,b:number,z0:number,y0:number,z1:number,y1:number,tone:string,underside=false){
    if(b-a<.00001)return;
    const i=roofPoints.length/3;
    roofPoints.push(a,y0,z0,a,y1,z1,b,y1,z1,b,y0,z0);
    pigment.set(tone);
    for(let j=0;j<4;j++)roofColors.push(pigment.r,pigment.g,pigment.b);
    if(underside)roofIndices.push(i,i+2,i+1,i,i+3,i+2);
    else roofIndices.push(i,i+1,i+2,i,i+2,i+3);
  }
  const shaftL=towerX-shaft,shaftR=towerX+shaft,shaftW=towerZ-shaft,shaftE=towerZ+shaft;
  function cutStrip(a:number,b:number,z0:number,y0:number,z1:number,y1:number,color:string,underside=false){
    const cuts=[z0,...[shaftW,shaftE].filter(z=>z>z0&&z<z1),z1];
    for(let k=1;k<cuts.length;k++){
      const s=cuts[k-1],t=cuts[k],mid=(s+t)/2;
      const lo=z1===z0?y0:THREE.MathUtils.lerp(y0,y1,(s-z0)/(z1-z0));
      const hi=z1===z0?y1:THREE.MathUtils.lerp(y0,y1,(t-z0)/(z1-z0));
      if(mid>shaftW&&mid<shaftE){
        strip(a,Math.min(b,shaftL),s,lo,t,hi,color,underside);
        strip(Math.max(a,shaftR),b,s,lo,t,hi,color,underside);
      }else strip(a,b,s,lo,t,hi,color,underside);
    }
  }
  const westDeck=.924,entryDeck=.998,roofL=left-.024,roofR=right+.024;
  const entryL=towerX-porticoWidth/2,entryR=towerX+porticoWidth/2;
  cutStrip(entryL,entryR,porticoZ+.005,entryDeck,roofWest,entryDeck,'#92918a');
  cutStrip(entryL,entryR,porticoZ+.005,.976,roofWest,.976,'#aca99a',true);
  // The stone coping already forms the lower part of this exposed step.
  // Butt the portico flashing to its top on both shoulders of the tower.
  cutStrip(entryL,entryR,roofWest,entryDeck,roofWest,streetCopingY+copingHeight/2,'#888b82');
  cutStrip(roofL,roofR,roofWest,westDeck,firstEave,westDeck,'#848982');
  cutStrip(roofL,roofR,firstEave,westDeck,firstEave,roofs[0].low,'#7c8078');
  for(const x of [left,right]){
    // The roof membrane is the only top face. A solid masonry box with
    // the same cap would put two materials at identical depth.
    const wall=new THREE.PlaneGeometry(firstEave-roofWest,westDeck-.098);
    wall.rotateY(x===left?-Math.PI/2:Math.PI/2);
    mesh(wall,ashlar,x,(westDeck+.098)/2,(firstEave+roofWest)/2);
  }
  // On sheet 29 the three skylights alternate with the four monitor runs
  // on the next ridge. Normalize the longitudinal stations to the hall.
  const skylights=[[.130,.262],[.434,.566],[.738,.870]];
  const monitors=[[0,.132],[.262,.435],[.565,.738],[.868,1]];
  const span=roofR-roofL;
  for(const [i,{start,end,ridge,low,high,tone}] of roofs.entries()){
    const ranges=i===0?skylights:i===1?monitors:[];
    // Keep the surveyed east pitch while cutting it back to the parapet.
    const endLow=i===2?THREE.MathUtils.lerp(high,low,(end-ridge)/(bayZ+.057-ridge)):low;
    const roofY=(z:number)=>z<=ridge?THREE.MathUtils.lerp(low,high,(z-start)/(ridge-start))
      :THREE.MathUtils.lerp(high,endLow,(z-ridge)/(end-ridge));
    const xs=new Set<number>([roofL,roofR]);
    for(let x=roofL+.115;x<roofR-.008;x+=.193){xs.add(x);xs.add(x+.006);}
    for(const pair of ranges)for(const f of pair)xs.add(roofL+span*f);
    const cuts=[...xs].sort((a,b)=>a-b);
    for(let k=1;k<cuts.length;k++){
      const a=cuts[k-1],b=cuts[k],f=((a+b)/2-roofL)/span;
      const raised=ranges.some(([l,r])=>f>l&&f<r);
      const cap=raised?(i===0?.097:.102):.016;
      const y0=roofY(ridge-cap),y1=roofY(ridge+cap);
      const seam=b-a<.0061;
      const sheet=seam?'#858b81':tone;
      cutStrip(a,b,start,low,ridge-cap,y0,sheet);
      cutStrip(a,b,ridge+cap,y1,end,endLow,sheet);
      if(raised){
        const curb=high+(i===0?.036:.066),top=curb+(i===0?.035:.021);
        strip(a,b,ridge-cap,y0,ridge-cap,curb,'#798782');
        strip(a,b,ridge-cap,curb,ridge,top,seam?'#a4ada1':i===0?'#879b97':'#949f96');
        strip(a,b,ridge,top,ridge+cap,curb,seam?'#a4ada1':i===0?'#839694':'#929b93');
        strip(a,b,ridge+cap,curb,ridge+cap,y1,'#72827e');
        for(const edge of [a,b]){
          if(!ranges.some(pair=>pair.some(v=>Math.abs(roofL+span*v-edge)<.00001)))continue;
          const base=roofPoints.length/3;
          roofPoints.push(edge,y0,ridge-cap,edge,curb,ridge-cap,edge,top,ridge,
            edge,curb,ridge+cap,edge,y1,ridge+cap,edge,high,ridge);
          pigment.set('#758480');
          for(let p=0;p<6;p++)roofColors.push(pigment.r,pigment.g,pigment.b);
          for(const tri of [[0,1,5],[1,2,5],[2,3,5],[3,4,5]]){
            if(edge===a)tri.reverse();
            roofIndices.push(...tri.map(n=>base+n));
          }
        }
      }else{
        strip(a,b,ridge-cap,y0,ridge,high+.006,'#909b92');
        strip(a,b,ridge,high+.006,ridge+cap,y1,'#909b92');
      }
    }
    // The first (Grand Nave) gable has the higher eave. Close its step to
    // the second gable along the full valley; the two eastern eaves coincide.
    if(i+1<roofs.length&&low!==roofs[i+1].low)
      strip(roofL,roofR,end,low,end,roofs[i+1].low,'#81867d');
    // A gable's extruded stone cap used to occupy the same inclined plane
    // as the metal sheet. Build the three visible faces of a real eave:
    // folded edge, soffit, and upright masonry meeting its underside.
    const endMonitor=i===1,edgeCap=endMonitor?.102:.016,thickness=.012;
    const profile=[[start,low],[ridge-edgeCap,roofY(ridge-edgeCap)],
      [ridge,high+(endMonitor?0:.006)],[ridge+edgeCap,roofY(ridge+edgeCap)],[end,endLow]];
    for(const x of [left,right]){
      const endElevation=new THREE.Group(),z=(start+end)/2,leg=(end-start)/2;
      endElevation.position.set(x,0,z);endElevation.rotation.y=x===left?-Math.PI/2:Math.PI/2;root.add(endElevation);
      const outer=x===left?roofL:roofR,along=x===left?1:-1;
      const peak=new THREE.Shape();
      peak.moveTo((start-z)*along,.098);
      for(const [station,y] of profile)peak.lineTo((station-z)*along,y-thickness);
      peak.lineTo((end-z)*along,.098);peak.closePath();
      mesh(new THREE.ShapeGeometry(peak),ashlar,0,0,0,endElevation).name='Ferry Hall end gable';
      for(let j=1;j<profile.length;j++){
        const [z0,y0]=profile[j-1],[z1,y1]=profile[j],v=roofPoints.length/3;
        roofPoints.push(outer,y0,z0,outer,y0-thickness,z0,outer,y1-thickness,z1,outer,y1,z1);
        pigment.set('#778078');
        for(let k=0;k<4;k++)roofColors.push(pigment.r,pigment.g,pigment.b);
        if(x===left)roofIndices.push(v,v+1,v+2,v,v+2,v+3);
        else roofIndices.push(v,v+2,v+1,v,v+3,v+2);
        strip(Math.min(x,outer),Math.max(x,outer),z0,y0-thickness,z1,y1-thickness,'#85897f',true);
      }
      sash(endElevation,0,.388,leg*.96,.452,.009,'end');
      storefront(endElevation,0,leg*1.28,.108,.245,.009,'#63786d');
      box(end-start,.023,.065,0,.360,.017,pale,endElevation);
      box(end-start,.021,.065,0,.390,.017,pale,endElevation);
    }
  }
  const skin=new THREE.BufferGeometry();
  skin.setAttribute('position',new THREE.Float32BufferAttribute(roofPoints,3));
  skin.setAttribute('color',new THREE.Float32BufferAttribute(roofColors,3));
  skin.setIndex(roofIndices);skin.computeVertexNormals();skin.userData.paintVertices=true;
  const roof=mesh(skin,'#ffffff',0,0,0);roof.material=roof.material.clone();
  roof.material.vertexColors=true;roof.name='Ferry hall joined roof and portico';
  // The sign is split across two steel racks at either side of the clock tower.
  const waterfrontSign=new THREE.Group();waterfrontSign.name='PORT OF SAN FRANCISCO';
  const signZ=.193;
  waterfrontSign.position.set(centerX,1.23,signZ);root.add(waterfrontSign);
  for(const [label,x,span] of [['PORT OF',-1.34,1.09],['SAN FRANCISCO',1.82,2.04]] as const){
    const words=new TextGeometry(label,{font,size:.151,depth:.012,curveSegments:4});
    words.computeBoundingBox();
    const bounds=words.boundingBox!,w=bounds.max.x-bounds.min.x;
    words.translate(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,0);
    // Both finishes belong to the same extrusion. A second copy of the caps
    // used to fall inside one depth-buffer step at normal orbit distances.
    const normals=words.getAttribute('normal');
    const colors=new Float32Array(normals.count*3),neon=new Uint8Array(normals.count*3);
    const face=new THREE.Color('#b95e50'),returns=new THREE.Color('#87594f');
    for(let i=0;i<normals.count;i++){
      const nz=normals.getZ(i);
      (nz>.99?face:returns).toArray(colors,i*3);
      // Direct bay-facing neon; the back and painted returns pick up red spill.
      neon.set(nz>.99?[242,29,11]:nz<-.99?[78,10,5]:[107,14,5],i*3);
    }
    words.setAttribute('signLight',new THREE.BufferAttribute(neon,3,true));
    words.setAttribute('color',new THREE.BufferAttribute(colors,3));
    words.userData.paintVertices=true;
    const sign=mesh(words,'#ffffff',x,.025,.009,waterfrontSign);sign.name=label;
    sign.scale.x=span/w;
    const footZ=-.012;
    const r=roofs[0],slope=(r.low-r.high)/(r.end-r.ridge);
    const supportBase=r.high+slope*(signZ+footZ-r.ridge);
    box(span+.052,.016,.026,x,.017,.003,'#728881',waterfrontSign);
    for(let station=-span/2+.026;station<=span/2;station+=.195){
      const h=waterfrontSign.position.y-supportBase+.041;
      box(.012,h,.023,x+station,.041-h/2,-.012,'#718680',waterfrontSign);
      const shoe=box(.046,.009,.055,x+station,supportBase-waterfrontSign.position.y+.003,footZ,'#8e9588',waterfrontSign);
      shoe.rotation.x=-Math.atan(slope);shoe.name='Sign rack roof shoe';
    }
    line([centerX+x-span/2,signZ-.017],[centerX+x+span/2,signZ-.017],1.161,.012,.017,'#83938b');
  }
  // HLB's restoration lights the west entry pedestals, paired columns, arches
  // and entablature. The recessed glazed openings retain their darker centers.
  // https://hlblighting.com/project/san-francisco-ferry-building/
  function hallUplight(p:THREE.Vector3,n:THREE.Vector3,west:boolean){
    // HLB's light falls on the stone jambs and cornices; recesses behind
    // the front colonnade receive less light than the outward-facing stone.
    const side=west?-1:1;
    const column=west&&Math.abs(p.x-towerX)<porticoWidth/2&&p.z<streetZ-.09;
    const height=THREE.MathUtils.smoothstep(p.y,.075,.27)*(1-THREE.MathUtils.smoothstep(p.y,.97,1.08));
    const incidence=.25+.66*Math.max(0,n.z*side)+.28*Math.max(0,-n.y);
    const entablature=west?THREE.MathUtils.smoothstep(p.y,.83,.92)*.23:0;
    return height*(incidence*(column?.96:west?.65:.40)+entablature);
  }
  for(const side of [street,bay]){
    const incident=(p:THREE.Vector3,n:THREE.Vector3)=>hallUplight(p,n,side===street);
    side.traverse(o=>{
      if(o instanceof THREE.Mesh&&!o.geometry.hasAttribute('signLight'))o.userData.uplight=incident;
    });
  }
  return {root,towerX,towerZ};
}

export function ferryPublicRealm() {
  const {root,box,mesh,slab,line}=builders('Ferry plaza and Market Street');
  const metal='#586f70';
  root.add(createMarketPaving());
  addMarketStreet(mesh,root);
  addFrostPlaza(root);
  root.add(createFerryBikeRacks());
  // The Ferry Building's forecourt has its own single-head plaza lights.
  for(const z of [-2.05,-7.45])for(const side of [-1,1]){
    const streetX=-.13+z*.133;
    const x=streetX+side*(z>-10?.83:.90), y=harryBridgesGround(x,z)??(z>-3?.031:westMarketGround(x,z));
    mesh(new THREE.CylinderGeometry(.018,.035,.64,7),metal,x,y+.32,z);
    box(.067,.082,.064,x,y+.049,z,metal);
    const globe=box(.039,.068,.041,x,y+.64,z,'#e8d4a6');
    globe.name='Ferry forecourt globe';globe.userData.signLight=[.90,.60,.29];
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
  root.add(ferryPatios());
  // Keep the passage and the apron clear for ferry queues; the movable market
  // stands live alongside the building and the fixed deck is built by the terminal.
  for(let x=-6.08;x<6.23;x+=.366){
    line([x,1.658],[x,2.206],.097,.005,.003,'#a19989');
  }
  return root;
}
