import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import raw from '../public/data/south-beach.json' with {type:'json'};
import {footprintGeometry,center} from './sf-map.ts';
import {harborDatum,waterHeight,waterSurface,waterWaveHeight} from './water-surface.ts';

export const southBeach=raw;
type Point=number[];
type XYZ=[number,number,number];
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};

function openRing(p:Point[]){
  return p[0][0]===p.at(-1)![0]&&p[0][1]===p.at(-1)![1]?p.slice(0,-1):p;
}
function outline(p:Point[]){
  const ring=openRing(p), signed=ring.reduce((sum,[x,z],i)=>{
    const [a,b]=ring[(i+1)%ring.length];return sum+x*b-z*a;
  },0);
  return ring.flatMap(([x,z],i)=>{
    const [a,b]=ring[(i+1)%ring.length],w=Math.hypot(a-x,b-z);
    if(w<.005)return [];
    return [{x:(x+a)/2,z:(z+b)/2,w,nx:Math.sign(signed)*(b-z)/w,nz:Math.sign(signed)*(x-a)/w}];
  });
}
function shrink(p:Point[],factor:number){
  const [cx,cz]=center(openRing(p));
  return p.map(([x,z])=>[cx+(x-cx)*factor,cz+(z-cz)*factor]);
}
function clip(p:Point[],axis:Point,limit:number,greater:boolean){
  const ring=openRing(p),keep=(v:number)=>greater?v>=limit:v<=limit;
  const coordinate=([x,z]:Point)=>x*axis[0]+z*axis[1];
  const out:Point[]=[];
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],pa=coordinate(a),pb=coordinate(b);
    if(keep(pa))out.push(a);
    if(keep(pa)!==keep(pb)){
      const t=(limit-pa)/(pb-pa);
      out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
    }
  }
  return out;
}

type Mooring={x:number;z:number;length:number;heading:number};
const yachtTypes=[
  {beam:.30,cabin:false,mast:1.34,paint:'#e1d7bb'},
  {beam:.33,cabin:true,mast:1.52,paint:'#eae7d5'},
  {beam:.34,cabin:true,mast:1.44,paint:'#80a6a5'},
] as const;

function yachtGeometry(spec:typeof yachtTypes[number]){
  const positions:number[]=[],colors:number[]=[];
  const pigment=new THREE.Color();
  function vertex(p:XYZ){positions.push(...p);colors.push(pigment.r,pigment.g,pigment.b);}
  function quad(a:XYZ,b:XYZ,c:XYZ,d:XYZ,paint:string){
    pigment.set(paint);[a,b,c,a,c,d].forEach(vertex);
  }
  function part(source:THREE.BufferGeometry,color:string,x:number,y:number,z:number){
    const flat=source.index?source.toNonIndexed():source;
    const attribute=flat.getAttribute('position');
    pigment.set(color);
    for(let i=0;i<attribute.count;i++)vertex([attribute.getX(i)+x,attribute.getY(i)+y,attribute.getZ(i)+z]);
    flat.dispose();
    if(flat!==source)source.dispose();
  }
  function box(w:number,h:number,d:number,x:number,y:number,z:number,color:string){
    part(new THREE.BoxGeometry(w,h,d),color,x,y,z);
  }
  function stay(a:XYZ,b:XYZ,color:string,width=.006){
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),v=to.clone().sub(from);
    const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),v.clone().normalize());
    const midpoint=from.lerp(to,.5);
    part(new THREE.BoxGeometry(width,width,v.length()).applyQuaternion(rotation),color,midpoint.x,midpoint.y,midpoint.z);
  }

  // A short transom, rounded midship sections and a rising bow. Waterline is
  // local y=0. A 10 m cruiser has about 1.1 m of topside near midships.
  const rings=[
    [-.50,.37,.091,-.015],[-.37,.45,.103,-.064],[-.05,.50,.116,-.091],
    [.20,.42,.127,-.074],[.405,.24,.148,-.037],[.50,.006,.166,.003],
  ];
  const ring=rings.map(([z,breadth,deck,belly])=>{
    const w=breadth*spec.beam;
    return {left:[-w,deck,z] as XYZ,right:[w,deck,z] as XYZ,
      leftChine:[-w*.79,.016,z] as XYZ,rightChine:[w*.79,.016,z] as XYZ,
      leftBase:[-w*.30,belly,z] as XYZ,rightBase:[w*.30,belly,z] as XYZ};
  });
  for(let i=1;i<ring.length;i++){
    const a=ring[i-1],b=ring[i];
    quad(a.left,b.left,b.right,a.right,'#e7deca');
    quad(a.right,b.right,b.rightChine,a.rightChine,spec.paint);
    quad(a.leftChine,b.leftChine,b.left,a.left,spec.paint);
    quad(a.rightChine,b.rightChine,b.rightBase,a.rightBase,'#648080');
    quad(a.leftBase,b.leftBase,b.leftChine,a.leftChine,'#648080');
    quad(a.leftBase,a.rightBase,b.rightBase,b.leftBase,'#4c6e72');
  }
  const stern=ring[0],bow=ring.at(-1)!;
  quad(stern.left,stern.right,stern.rightBase,stern.leftBase,spec.paint);
  quad(bow.right,bow.left,bow.leftBase,bow.rightBase,spec.paint);
  box(.077,.105,.17,0,-.119,-.048,'#4d6d70');
  const cabin='#e9dfcb',glass='#587c83',timber='#b49b77';
  box(spec.beam*.68,.018,.25,0,.108,-.31,timber);
  for(const side of [-1,1])box(.019,.047,.23,side*spec.beam*.324,.122,-.292,spec.paint);
  if(spec.cabin){
    const roofWidth=spec.beam*.64, cabinX=roofWidth/2;
    box(roofWidth,.061,.342,0,.151,.026,cabin);
    box(roofWidth*.86,.027,.268,0,.193,.018,cabin);
    for(const side of [-1,1]){
      const m=side*(cabinX+.002);
      box(.007,.028,.207,m,.155,.023,glass);
      box(.009,.032,.013,m,.156,.020,cabin);
    }
    box(roofWidth*.73,.027,.03,0,.157,.207,glass);
  }else{
    box(spec.beam*.48,.032,.156,0,.136,-.075,'#b6ac8e');
  }
  box(.083,.011,.097,0,.157,.302,'#7b9392');
  const mastFoot=spec.cabin?.205:.147, mastHeight=spec.mast-mastFoot;
  part(new THREE.CylinderGeometry(.009,.012,mastHeight,6),'#c3bda6',0,mastFoot+mastHeight/2,.055);
  stay([0,spec.mast-.055,.055],[0,.158,.464],'#b8bca9');
  stay([0,spec.mast-.073,.055],[0,.132,-.46],'#bdbaaa');
  stay([0,.30,.055],[0,.31,-.37],spec.cabin?'#6c8888':'#b8bca9',.015);

  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();g.computeBoundingBox();
  return g;
}

// OSM fingers often cross a named floating walkway as a single way. Choose
// the longer wet side of that crossing before mooring alongside the finger.
const marinaSpines=southBeach.docks.filter(dock=>/^Dock [A-G]$/.test(dock.name))
  .flatMap(dock=>dock.p.slice(1).map((b,i)=>[dock.p[i],b] as const));
function berthSpan(a:Point,b:Point){
  const [ax,az]=a,dx=b[0]-ax,dz=b[1]-az;
  for(const [[x,z],[u,v]] of marinaSpines){
    const sx=u-x,sz=v-z,det=dx*sz-dz*sx;
    if(Math.abs(det)<.00001)continue;
    const t=((x-ax)*sz-(z-az)*sx)/det;
    const s=((x-ax)*dz-(z-az)*dx)/det;
    if(t<-.005||t>1.005||s<-.005||s>1.005)continue;
    return [[ax+dx*t,az+dz*t],t<.5?b:a];
  }
  return [a,b];
}

function addMarinaFleet(harbor:THREE.Group,moorings:Mooring[][],waterTime:{value:number}){
  const material=new THREE.MeshStandardMaterial({roughness:.86,vertexColors:true});
  const update:(()=>void)[]=[];
  for(const [type,anchors] of moorings.entries()){
    if(!anchors.length)continue;
    const fleet=new THREE.InstancedMesh(yachtGeometry(yachtTypes[type]),material,anchors.length);
    fleet.name='Moored sailboat fleet';
    fleet.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    fleet.receiveShadow=true;
    const holder=new THREE.Object3D();
    let lastTime=NaN;
    function matchWaterline(){
      const time=waterTime.value;
      if(time===lastTime)return;
      lastTime=time;
      for(const [i,{x,z,heading,length}] of anchors.entries()){
        holder.position.set(x,waterHeight(x,z,time),z);
        holder.rotation.y=heading;
        holder.scale.setScalar(length);
        holder.updateMatrix();fleet.setMatrixAt(i,holder.matrix);
      }
      fleet.instanceMatrix.needsUpdate=true;
    }
    matchWaterline();fleet.computeBoundingBox();fleet.computeBoundingSphere();
    fleet.boundingSphere!.radius+=2*waterWaveHeight;
    update.push(matchWaterline);
    harbor.add(fleet);
  }
  return ()=>{for(const updateBatch of update)updateBatch();};
}

export function createSouthBeach(font:Font,waterTime={value:0}){
  const root=new THREE.Group(), mats=new Map<string,THREE.MeshStandardMaterial>(), windows:Pane[]=[];
  root.name='South Beach to China Basin';
  const trim='#d0c2a8', dark='#456467', steel='#626e62';
  const brick='#ac7661', warm='#be8870', pale='#d1c3a8', shadow='#6c7062';
  function mesh(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number,parent:THREE.Group=root){
    let mat=mats.get(c);
    if(!mat){mat=new THREE.MeshStandardMaterial({color:c,roughness:.86});mats.set(c,mat);}
    const m=new THREE.Mesh(g,mat);
    m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
  }
  const slab=(p:Point[],y:number,height:number,c:string,g=root)=>mesh(footprintGeometry(p,height),c,0,y,0,g);
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:string,g=root)=>mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,g);
  function group(name:string,x:number,y:number,z:number,parent=root){
    const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;
  }
  function line(a:XYZ,b:XYZ,width:number,height:number,c:string,g=root){
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),d=to.clone().sub(from);
    const m=box(width,height,d.length(),(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,c,g);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d.normalize());return m;
  }
  function face(e:ReturnType<typeof outline>[number],parent=root){
    const g=group('Façade',e.x,0,e.z,parent);g.rotation.y=Math.atan2(e.nx,e.nz);return g;
  }
  function sign(text:string,size:number,y:number,z:number,width:number,c:string,g:THREE.Group){
    const geo=new TextGeometry(text,{font,size,depth:.009,curveSegments:3});
    geo.computeBoundingBox();
    const {min,max}=geo.boundingBox!;
    geo.translate(-(min.x+max.x)/2,-min.y,0);
    const m=mesh(geo,c,0,y,z,g);m.name=text;m.scale.x=Math.min(1,width/(max.x-min.x));
    return m;
  }
  function doorShape(w:number,spring:number){
    const shape=new THREE.Shape();
    shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,spring);
    shape.absarc(0,spring,w/2,0,Math.PI,false);shape.closePath();return shape;
  }
  function door(w:number,h:number,x:number,y:number,parent:THREE.Group){
    const spring=h-w/2;
    if(spring<=0)return;
    mesh(new THREE.ExtrudeGeometry(doorShape(w,spring),{depth:.019,bevelEnabled:false,curveSegments:8}),dark,x,y,.011,parent);
    mesh(new THREE.TorusGeometry(w/2+.009,.018,4,12,Math.PI),trim,x,y+spring,.025,parent);
    for(const s of [-1,1])box(.036,spring,.049,x+s*(w/2+.013),y+spring/2,.025,trim,parent);
    for(const v of [-.25,0,.25])box(.012,spring+.08,.018,x+w*v,y+(spring+.071)/2,.032,'#84928a',parent);
    box(w,.013,.024,x,y+spring,.034,trim,parent);
  }
  function glazing(g:THREE.Group,x:number,y:number,w:number,h:number){
    g.updateWorldMatrix(true,false);
    const p=g.localToWorld(new THREE.Vector3(x,y,.026));
    windows.push({x:p.x,y:p.y,z:p.z,ry:g.rotation.y,w,h});
  }
  function boardwalk(p:Point[],w:number,y:number,c:string,g=root){
    for(let i=1;i<p.length;i++){
      const [x,z]=p[i-1],[a,b]=p[i];
      if(Math.hypot(a-x,b-z)>.009)line([x,y,z],[a,y,b],w,.054,c,g);
    }
  }
  function guardRail(p:Point[],height:number,parent=root,offset=0){
    for(let i=1;i<p.length;i++){
      const [x,z]=p[i-1],[a,b]=p[i],d=Math.hypot(a-x,b-z);
      if(d<.04)continue;
      const nx=(b-z)/d*offset,nz=(x-a)/d*offset;
      for(const y of [height-.047,height])line([x+nx,y,z+nz],[a+nx,y,b+nz],.012,.012,steel,parent);
      const n=Math.ceil(d/.31);
      for(let j=0;j<=n;j++)box(.014,.091,.014,x+(a-x)*j/n+nx,height-.045,z+(b-z)*j/n+nz,steel,parent);
    }
  }

  const wharf=group('Brannan Street Wharf',0,0,0);
  const wharfTop=harborDatum.ferryApron,wharfSoffit=wharfTop-harborDatum.pierSlabThickness;
  slab(southBeach.features.wharf,wharfSoffit,harborDatum.pierSlabThickness,'#cbbfa9',wharf);
  slab(shrink(southBeach.features.wharf,.66),.096,.011,'#869565',wharf);
  for(const e of outline(southBeach.features.wharf)){
    if(e.w>.7&&e.nz>.16){
      const g=face(e,wharf);
      for(let t=-e.w/2+.30;t<e.w/2;t+=.64){
        const toe=waterSurface.level-.34;
        box(.09,wharfSoffit-toe,.1,t,(wharfSoffit+toe)/2,-.07,'#819083',g);
        box(.07,.10,.127,t,waterSurface.level,-.054,steel,g);
      }
      guardRail([[-e.w/2+.08,-.087],[e.w/2-.08,-.087]],.19,g);
    }
  }
  const park=group('South Beach Park',0,0,0);
  slab(southBeach.features.park,.023,.065,'#8fa476',park);
  slab(southBeach.features.chinaBasin,.004,.080,'#869b72',park);
  slab(southBeach.features.plaza,.001,.082,'#c7b298',park);
  for(const p of southBeach.paths)boardwalk(p.p,.23,.092,'#b9b19d',park);
  for(const [x,z] of [[-92.91,-33.16],[-93.93,-34.2],[-95.31,-35.6],[-97.17,-37],[-116.14,-54.62],[-117.75,-55.54],[-120,-54.78]]){
    const canopy=mesh(new THREE.IcosahedronGeometry(.25,1),'#729168',x,.63,z,park);
    canopy.scale.set(1.12,1.46,.91);
    mesh(new THREE.CylinderGeometry(.019,.027,.56,7),'#7f735a',x,.37,z,park);
  }
  for(const [x,z] of [[-95,-35],[-96.29,-36.69],[-119.3,-54.44]]){
    box(.35,.019,.12,x,.14,z,'#9c8d72',park);
    for(const dx of [-.10,.10])box(.015,.06,.10,x+dx,.11,z,steel,park);
  }

  function pierShed(name:string,p:Point[],h:number){
    const g=group(name,0,0,0), faces=outline(p), access=faces.filter(e=>e.z<Math.min(...p.map(v=>v[1]))+2.3&&e.w>.75)
      .sort((a,b)=>b.w-a.w)[0];
    slab(p,.045,h,name==='Pier 40'?'#9da9a2':'#c6c5b3',g);
    slab(shrink(p,1.012),h+.045,.042,name==='Pier 40'?'#778782':'#8f9a8d',g);
    for(const e of faces){
      if(e.w<.4)continue;
      const wall=face(e,g);
      box(e.w,.022,.046,0,h*.78,.025,pale,wall);
      if(e===access){
        const span=Math.min(e.w,2.4), w=Math.min(.61,span*.39);
        box(span,.101,.08,0,h+.087,.049,trim,wall);
        sign(name==='South Beach Harbor building'?'SOUTH BEACH HARBOR':name.toUpperCase(),.083,h+.043,.096,span*.74,shadow,wall);
        door(w,h*.67,0,.06,wall);
        for(const x of [-span*.34,span*.34]){
          door(w*.49,h*.52,x,.065,wall);
          box(.048,h*.76,.056,x+Math.sign(x)*.18,h*.45,.040,pale,wall);
        }
      }else if(e.w>1.15){
        const n=Math.ceil(e.w/.48);
        for(let j=0;j<n;j++){
          const x=((j+.5)/n-.5)*e.w, w=e.w/n*.70;
          box(w,h*.23,.025,x,h*.62,.024,dark,wall);
          box(.012,h*.23,.019,x,h*.62,.041,trim,wall);
          if(j%4===0)box(.051,h*.70,.048,x-e.w/n*.47,h*.42,.024,pale,wall);
        }
      }
    }
    return g;
  }
  pierShed('Pier 38',southBeach.features.pier38,.67);
  pierShed('Pier 40',southBeach.features.pier40,.52);
  pierShed('Pier 48',southBeach.features.pier48,.43);
  pierShed('South Beach Harbor building',southBeach.features.harborOffice,.39);

  const harbor=group('South Beach Marina',0,0,0);
  const walkHeight=waterSurface.level+harborDatum.marinaFreeboard;
  const fixedDeck=harborDatum.pierDeck, floatDeck=waterSurface.level+harborDatum.ferryFloatFreeboard;
  const moorings:Mooring[][]=yachtTypes.map(()=>[]);
  for(let i=1;i<southBeach.features.breakwater.length;i++){
    const [x,z]=southBeach.features.breakwater[i-1],[a,b]=southBeach.features.breakwater[i];
    line([x,fixedDeck-.407,z],[a,fixedDeck-.407,b],.46,.76,'#8b9182',harbor);
    line([x,fixedDeck-.182,z],[a,fixedDeck-.182,b],.379,.31,'#9aa18f',harbor);
  }
  boardwalk(southBeach.features.breakwater,.33,fixedDeck-.027,'#a7a99b',harbor);
  guardRail(southBeach.features.breakwater,fixedDeck+.069,harbor,-.13);
  boardwalk(southBeach.features.fishingPier,.22,fixedDeck-.027,'#a7ad9e',harbor);
  guardRail(southBeach.features.fishingPier,fixedDeck+.069,harbor,.083);
  slab(southBeach.features.oracleFloat,floatDeck-.13,.13,'#9ea99e',harbor).name='Oracle Park Ferry Terminal';
  slab(southBeach.features.oracleBridge,fixedDeck-harborDatum.pierSlabThickness,harborDatum.pierSlabThickness,'#b2b9a9',harbor);
  // The mapped shore and intermediate platforms lead to the separate
  // China Basin float. Both spans land just inside their adjoining decks.
  const spans=[
    [[-111.739,fixedDeck,-45.395],[-111.69,fixedDeck,-43.72]],
    [[-111.77,fixedDeck,-43.30],[-112.75,floatDeck,-41.87]],
  ] as [XYZ,XYZ][];
  for(const [a,b] of spans){
    line([a[0],a[1]-.01,a[2]],[b[0],b[1]-.01,b[2]],.15,.02,'#a3aaa2',harbor).name='China Basin access span';
    const dx=b[0]-a[0],dz=b[2]-a[2],d=Math.hypot(dx,dz);
    for(const side of [-1,1]){
      const nx=side*.068*dz/d,nz=-side*.068*dx/d;
      line([a[0]+nx,a[1]+.064,a[2]+nz],[b[0]+nx,b[1]+.064,b[2]+nz],.008,.008,steel,harbor);
      for(let i=0;i<=5;i++)box(.008,.064,.008,THREE.MathUtils.lerp(a[0],b[0],i/5)+nx,THREE.MathUtils.lerp(a[1],b[1],i/5)+.032,THREE.MathUtils.lerp(a[2],b[2],i/5)+nz,steel,harbor);
    }
  }
  // Gap in the landside rail for the gangway.
  const float=southBeach.features.oracleFloat;
  guardRail([...float.slice(0,6),[-112.64,-41.86]],floatDeck+.069,harbor);
  guardRail([[-112.82,-41.97],float[0]],floatDeck+.069,harbor);
  for(const [i,dock] of southBeach.docks.entries()){
    const wide=!!dock.name||dock.p.length>3;
    const fixed=dock.id===780006769;
    if(fixed)slab(dock.p,fixedDeck-harborDatum.pierSlabThickness,harborDatum.pierSlabThickness,'#a3a590',harbor);
    else boardwalk(dock.p,wide?.19:.061,walkHeight-.027,wide?'#a49a7e':'#9b967e',harbor);
    const [x,z]=dock.p.at(-1)!;
    box(.031,.33,.035,x,walkHeight-.085,z,'#828b7b',harbor);
    if(wide||i%3!==0)continue;
    const [start,end]=berthSpan(dock.p[0],[x,z]);
    const [ax,az]=start,dx=end[0]-ax,dz=end[1]-az,length=Math.hypot(dx,dz);
    if(length<.45||length>2.5)continue;
    const direction=new THREE.Vector2(dx,dz).normalize();
    const type=Math.floor(i/3)%yachtTypes.length;
    const boatLength=Math.min((length-.113)*.82,.41+(i%5)*.051);
    // Keep the topsides one fender's width clear of the berth finger.
    const offset=.052+boatLength*yachtTypes[type].beam/2;
    moorings[type].push({
      x:ax+dx*.57+direction.y*offset,z:az+dz*.57-direction.x*offset,
      length:boatLength,heading:Math.atan2(direction.x,direction.y),
    });
  }
  const updateMarina=addMarinaFleet(harbor,moorings,waterTime);

  const blocks=group('South Beach building fronts',0,0,0);
  for(const b of southBeach.buildings){
    const old=b.material.includes('brick')||/Townsend|Heublein|Wharfside|Arc Light|Delancey/.test(b.name)||
      (b.kind==='warehouse'||b.kind==='industrial');
    const palette=old?['#a7735e','#ae8067','#bb8b73','#bd9273']:['#a9ae9c','#c2b39f','#8c9e9e','#bcbba7','#d0baa0'];
    const body=palette[b.id%palette.length], eaves=old?'#d2ac88':'#c9c6b0',roof=old?'#9c8c78':'#a7ada2';
    slab(b.p,0,b.h,body,blocks);
    if(b.h>.46)slab(shrink(b.p,1.012),b.h-.021,.041,eaves,blocks);
    if(b.h>.85&&b.p.length<12&&b.id%2===0)slab(shrink(b.p,.42),b.h+.021,.10,roof,blocks);
    for(const e of outline(b.p)){
      if(e.w<.39||b.h<.28)continue;
      const g=face(e,blocks), bays=Math.max(1,Math.round(e.w/(old?.41:.48))), spacing=e.w/bays;
      const levels=Math.max(1,Math.round(b.h/(old?.236:.245))), step=b.h/levels;
      for(let f=0;f<levels;f++){
        const y=(f+.61)*step;
        for(let j=0;j<bays;j++){
          const x=((j+.5)/bays-.5)*e.w;
          glazing(g,x,y,spacing*(old?.55:.72),step*(old?.61:.60));
          if(old)box(spacing*.66,.018,.054,x,y-step*.36,.024,eaves,g);
        }
      }
      for(const y of [.074,b.h-.055])box(e.w,.031,.069,0,y,.017,eaves,g);
    }
  }

  const stadium=group('Oracle Park',0,0,0);
  const field=southBeach.features.field, envelope=southBeach.features.stadium;
  slab(envelope,-.025,.086,'#bba990',stadium).name='Mapped stadium foundation';
  slab(field,.061,.019,'#b28c64',stadium).name='Warning track';
  const grass=shrink(field,.961);
  slab(grass,.081,.008,'#7c995f',stadium).name='Oracle Park playing field';
  const home=[-103.401,-53.230], directionA=new THREE.Vector2(-5.40,1.98).normalize(), directionB=new THREE.Vector2(.87,6.45).normalize();
  // The cut of the grass follows the foul lines between the mapped right and left field bends.
  const axis=new THREE.Vector2().addVectors(directionA,directionB).normalize().toArray();
  const projections=grass.map(([x,z])=>x*axis[0]+z*axis[1]), low=Math.min(...projections), span=Math.max(...projections)-low;
  for(let i=0;i<9;i++){
    const stripe=clip(clip(grass,axis,low+span*i/9,true),axis,low+span*(i+1)/9,false);
    if(stripe.length>2)slab(stripe,.089,.0025,i%2?'#769459':'#8da86b',stadium);
  }
  const first=[home[0]+directionA.x*1.646,home[1]+directionA.y*1.646];
  const third=[home[0]+directionB.x*1.646,home[1]+directionB.y*1.646];
  const second=[first[0]+third[0]-home[0],first[1]+third[1]-home[1]];
  const diamond=[home,first,second,third];
  slab(shrink(diamond,1.16),.092,.006,'#b7815c',stadium).name='Infield cutout';
  slab(shrink(diamond,.74),.099,.003,'#86a662',stadium);
  for(const p of [first,second,third,home]){
    box(.051,.007,.051,p[0],.107,p[1],'#eee1bc',stadium).rotation.y=.31;
  }
  const mound=center(diamond);
  mesh(new THREE.CylinderGeometry(.17,.182,.008,18),'#b58158',mound[0],.104,mound[1],stadium);
  for(const [x,z] of [[-108.66,-51.34],[-102.53,-46.95]]){
    line([home[0],.108,home[1]],[x,.108,z],.014,.004,'#e5d7af',stadium);
    line([x,.085,z],[x,.98,z],.015,.015,'#d5b56c',stadium);
  }
  for(const e of outline(envelope)){
    if(e.w<.21)continue;
    const g=face(e,stadium), openField=e.z>-48.28&&e.nx<.22||e.nz>.79&&e.z>-48.2;
    const h=openField?(e.nx<-.46?.49:.20):e.z>-50.5?.83:1.09;
    box(e.w+.025,h,.14,0,h/2+.055,-.027,brick,g);
    for(const y of [.17,h-.045])if(y<h+.02)box(e.w+.025,.032,.190,0,y,.025,warm,g);
    if(openField)continue;
    const count=Math.max(1,Math.round(e.w/.38)), spacing=e.w/count;
    for(let j=0;j<count;j++){
      const x=((j+.5)/count-.5)*e.w, w=Math.min(.218,spacing*.60);
      box(.045,h-.077,.077,x-spacing*.435,h/2+.06,.071,'#ba846a',g);
      door(w,.33,x,.18,g);
      if(h>.90)door(w*.92,.23,x,.66,g);
    }
    if(h>.90){
      box(e.w,.047,.194,0,.595,.027,'#c59576',g);
      box(e.w,.016,.163,0,.982,.017,'#c59576',g);
    }
  }
  const seatingInside=[
    [-102.55,-47.20],[-102.50,-49.45],[-102.63,-51.49],[-102.75,-52.67],
    [-103.14,-53.64],[-104.76,-53.64],[-106.49,-53.02],[-108.16,-52.41],[-108.87,-51.42],
  ];
  const seatingOutside=[
    [-99.31,-45.64],[-99.73,-49.43],[-100.14,-53.21],[-100.75,-55.74],
    [-103.20,-56.42],[-105.14,-55.91],[-107.52,-55.08],[-108.79,-54.53],[-109.27,-51.55],
  ];
  function curve(p:Point[]){
    return new THREE.CatmullRomCurve3(p.map(([x,z])=>new THREE.Vector3(x,0,z)));
  }
  const inside=curve(seatingInside), outside=curve(seatingOutside);
  function rim(t:number,d:number,y:number){
    const p=inside.getPoint(t).lerp(outside.getPoint(t),d);p.y=y;return p;
  }
  function strip(from:number,to:number,lo:number,hi:number,color:string,t0=0,t1=1){
    const positions:number[]=[];
    const divisions=Math.max(6,Math.ceil((t1-t0)*72));
    for(let i=0;i<divisions;i++){
      const a=t0+(t1-t0)*i/divisions,b=t0+(t1-t0)*(i+1)/divisions;
      const v=[rim(a,from,lo),rim(b,from,lo),rim(b,to,hi),rim(a,to,hi)];
      for(const [j,k,l] of [[0,1,2],[0,2,3]]){
        const normal=v[k].clone().sub(v[j]).cross(v[l].clone().sub(v[j]));
        const order=normal.y<0?[j,l,k]:[j,k,l];
        for(const idx of order)positions.push(...v[idx].toArray());
      }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();
    mesh(g,color,0,0,0,stadium);
  }
  const club='#8b9b88', seats=['#738179','#67766e','#7b8b7b','#7d8b79'];
  // Radial seat tiers rise around the home plate and the two foul lines.
  for(let row=0;row<13;row++){
    const d=.035+row*.0275,y=.135+row*.044;
    for(let aisle=0;aisle<9;aisle++){
      const a=aisle/9+.002,b=(aisle+1)/9-.002;
      strip(d,d+.020,y,y,seats[row%seats.length],a,b);
    }
    strip(d+.020,d+.0275,y-.003,y+.043,'#aaa288');
  }
  strip(.395,.52,.68,.87,'#9a9d89');
  strip(.52,.59,.93,.95,club);
  for(let row=0;row<10;row++){
    const d=.600+row*.031,y=1.03+row*.057;
    strip(d,d+.023,y,y,seats[(row+1)%seats.length]);
    strip(d+.023,d+.031,y-.006,y+.050,'#a5a08b');
  }
  strip(.90,1.00,1.56,1.67,'#959482');
  for(const t of [.08,.205,.30,.395,.50,.61,.72,.81,.90]){
    const a=rim(t,.855,1.45),b=rim(t,.855,1.98),q=rim(t,.592,1.80),back=rim(t,1.00,1.99);
    line(a.toArray(),b.toArray(),.027,.027,steel,stadium);
    line(q.toArray(),back.toArray(),.035,.028,steel,stadium);
  }
  strip(.755,.994,1.894,2.012,'#979b88',.067,.899);
  strip(.720,.761,1.88,1.902,'#a9ae98',.067,.899);
  // Main stands flank the open center field, so the score display and marina remain visible inside.
  const score=group('Center-field scoreboard',-105.85,0,-44.50,stadium);score.rotation.y=Math.PI-.15;
  box(1.80,.80,.083,0,.72,0,steel,score);
  box(1.65,.578,.021,0,.728,.054,'#4e6158',score);
  sign('ORACLE PARK',.100,1.14,.060,1.36,'#d9c6a7',score);
  for(const x of [-.65,.65])box(.081,.77,.084,x,.34,-.07,steel,score);
  for(let row=0;row<4;row++)for(let col=0;col<11;col++){
    if(row===2&&col>2&&col<8)continue;
    box(.083,.025,.011,(col-5)*.131,.61+row*.080,.069,
      ['#9c9e75','#849372','#c0ae7e'][(row+col)%3],score);
  }
  // Small white clock towers and a brick arcade line the cove-facing elevated walk.
  const rightWall=[[-109.60,-46.94],[-109.43,-48.35],[-109.19,-49.72],[-108.98,-51.56]];
  boardwalk(rightWall,.26,.462,brick,stadium);
  for(let i=1;i<rightWall.length;i++){
    const [x,z]=rightWall[i-1],[a,b]=rightWall[i],d=Math.hypot(a-x,b-z),nx=(b-z)/d,nz=(x-a)/d;
    const g=face({x:(x+a)/2,z:(z+b)/2,w:d,nx,nz},stadium);
    const count=Math.ceil(d/.29);
    box(d,.446,.094,0,.245,0,brick,g);
    for(let j=0;j<count;j++)door(.155,.246,(j+.50)*d/count-d/2,.135,g);
    if(i===2)sign("LEVI'S LANDING",.068,.421,.057,d*.76,'#e7cea2',g);
  }
  for(const [x,z] of [[-109.52,-47.12],[-109.01,-51.50]]){
    const tower=group('Cove arcade clock tower',x,0,z,stadium);
    box(.28,.632,.269,0,.349,0,brick,tower);
    box(.331,.054,.314,0,.675,0,pale,tower);
    mesh(new THREE.ConeGeometry(.216,.18,4),'#667467',0,.771,0,tower).rotation.y=Math.PI/4;
    for(let i=0;i<4;i++){
      const g=group('Clock face',0,.582,0,tower);g.rotation.y=i*Math.PI/2;
      mesh(new THREE.CircleGeometry(.057,16),'#e0d0a8',0,0,.140,g);
      for(const [dx,dy] of [[.027,.02],[-.013,.04]])line([0,0,.145],[dx,dy,.145],.007,.007,dark,g);
    }
  }
  for(const [x,z,h] of [[-99.72,-48.53,2.49],[-100.68,-55.80,2.69],[-108.1,-55.39,2.69],[-109.23,-46.48,1.83],[-104.3,-44.61,1.94]]){
    const boom=group('Ballpark floodlight',x,0,z,stadium);
    line([0,.23,0],[0,h,0],.043,.039,steel,boom);
    box(.32,.13,.029,0,h-.015,.018,steel,boom);
    for(const y of [h-.055,h-.013,h+.033])for(const dx of [-.128,-.064,0,.064,.128])box(.040,.031,.017,dx,y,.038,'#e4d5af',boom);
  }
  // Recognizable left-field bottle and the glove overlook the outfield.
  const left=group('Left-field bottle and glove',-101.07,.28,-45.43,stadium);
  const bottle=group('Green bottle slide',-.14,.10,.09,left);
  bottle.rotation.set(.86,.31,-.46);
  const silhouette=[[0,0],[.15,0],[.18,.14],[.14,.55],[.155,.73],[.10,.89],[.06,1.03],[.048,1.16],[.06,1.22],[0,1.23]];
  mesh(new THREE.LatheGeometry(silhouette.map(([r,y])=>new THREE.Vector2(r,y)),12),'#6c865f',0,0,0,bottle);
  mesh(new THREE.CylinderGeometry(.154,.157,.198,12),'#b25b4d',0,.57,0,bottle);
  const glove=group('The Giant Glove',-.42,.09,-.31,left);glove.rotation.z=.23;
  const palm=mesh(new THREE.SphereGeometry(.163,9,7),'#9c765b',0,.145,0,glove);palm.scale.set(1.24,1.05,.52);
  for(const [i,x] of [-.125,-.059,.011,.078,.143].entries()){
    const h=[.12,.225,.259,.226,.145][i];
    const finger=mesh(new THREE.CapsuleGeometry(.042,h-.07,3,7),'#a17b5c',x,.213+h/2,.013,glove);
    finger.rotation.z=(2-i)*.10;
  }

  // Brick entry and the illuminated marquee on the Willie Mays Plaza axis.
  const entry=group('Willie Mays Gate',southBeach.points.maysGate[0],0,southBeach.points.maysGate[1]+.23,stadium);
  entry.rotation.y=Math.PI-.06;
  for(const x of [-.88,.88]){
    box(.386,1.30,.33,x,.71,0,brick,entry);
    box(.424,.062,.371,x,1.384,0,pale,entry);
    door(.127,.29,x,.83,entry);
  }
  box(1.49,.309,.173,0,1.154,.044,'#9c6255',entry);
  box(1.57,.066,.202,0,1.345,.060,warm,entry);
  sign('ORACLE PARK',.143,1.221,.156,1.43,'#e0ac88',entry);
  sign('HOME OF THE SAN FRANCISCO GIANTS',.052,1.112,.155,1.39,'#ead3aa',entry);
  box(1.35,.084,.099,0,.828,.124,steel,entry);
  sign('WILLIE MAYS GATE',.051,.802,.177,1.26,'#e6d4ad',entry);
  for(const x of [-.59,-.38,-.17,.04,.25,.46,.67]){
    box(.108,.332,.052,x,.228,.007,'#777c6c',entry);
    for(const dx of [-.035,.035])box(.015,.369,.067,x+dx,.238,.03,steel,entry);
  }
  for(const [point,name] of [[southBeach.points.mays,'Willie Mays statue'],[southBeach.points.mccovey,'Willie McCovey statue']] as [Point,string][]){
    const statue=group(name,point[0],.077,point[1],stadium);
    box(.38,.075,.27,0,.039,0,'#a59d85',statue);
    box(.26,.21,.21,0,.17,0,'#b3a48a',statue);
    const bronze='#787859';
    line([-.032,.28,0],[-.004,.44,.016],.042,.042,bronze,statue);
    line([.039,.28,.009],[-.004,.44,.016],.036,.036,bronze,statue);
    line([-.004,.44,.016],[.025,.558,.02],.076,.071,bronze,statue);
    mesh(new THREE.IcosahedronGeometry(.039,1),bronze,.033,.605,.022,statue);
    line([.018,.54,.022],[.114,.571,-.016],.025,.025,bronze,statue);
    line([.114,.571,-.016],[.151,.654,-.026],.013,.013,bronze,statue);
  }
  return {root,windows,updateMarina};
}
