import * as THREE from 'three';
import {streetPose,streetcarPose} from './streets.ts';
import {createStreetcar} from './streetcar.ts';
import {createPeople} from './people.ts';
import {createFireboat} from './fireboat.ts';
import {waterSurface} from './water-surface.ts';
import {buildingCharacter,modernBuildingAccents,characterBuildings,characterColors} from './building-character.ts';
import {hasNeighborhoodDetail,neighborhoodColor,neighborhoodDetail,refineNeighborhoodMassing} from './neighborhood-detail.ts';
import {waterfrontGardens} from './waterfront-gardens.ts';
import {architectureProfile,referenceColor,refineReferenceMassing,referenceArchitecture} from './reference-architecture.ts';
import {isMooredVessel,mooredVessel} from './moored-vessels.ts';
import {windowGlow,applyWindowLighting} from './window-lighting.ts';
import {waterfrontLandmark,detailedWaterfrontNames} from './waterfront-landmarks.ts';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {bridgeLayout,bridgePoint,bridgeApproaches} from './bridge-layout.ts';
import {sfMap,mappedBuildings,footprintGeometry,center} from './sf-map.ts';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontData from './harbor-font.json' with { type: 'json' };
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** San Francisco waterfront footprints with selectively detailed landmark models. */
export function createLandscape() {
  const root = new THREE.Group();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const windowPositions: { x: number; y: number; z: number; ry: number; w: number; h: number }[] = [];
  const clockHands: { minute:THREE.Mesh; hour:THREE.Mesh; angle:number }[] = [];
  const residentPositions:{x:number;z:number;y:number}[]=[];
  const cream = '#ede4d3', dark = '#345564', rust = '#b96043';
  function material(color: string) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .86, metalness: .02 }));
    return materials.get(color)!;
  }
  function mesh(geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, parent: THREE.Group = root) {
    const m = new THREE.Mesh(geo, material(color));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function box(w: number, h: number, d: number, x: number, y: number, z: number, color: string, parent = root) {
    return mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent);
  }
  function pole(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: string, parent = root) {
    const delta = b.clone().sub(a);
    const m = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 5), color, 0, 0, 0, parent);
    m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return m;
  }
  const font=new FontLoader().parse(fontData);
  function lettering(text:string,size:number,x:number,y:number,z:number,color:string,parent=root){
    const geo=new TextGeometry(text,{font,size,depth:.035,curveSegments:3,bevelEnabled:false});
    geo.computeBoundingBox();geo.translate(-(geo.boundingBox!.max.x-geo.boundingBox!.min.x)/2,0,0);
    return mesh(geo,color,x,y,z,parent);
  }
  function gable(w:number,h:number,d:number,x:number,y:number,z:number,color:string,parent=root){
    const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(0,h);shape.lineTo(w/2,0);shape.closePath();
    return mesh(new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false}),color,x,y,z-d/2,parent);
  }
  function tree(x:number,z:number,s=1){
    pole(new THREE.Vector3(x,0,z),new THREE.Vector3(x,2.5*s,z),.14*s,'#76614a');
    for(let i=0;i<5;i++){
      const a=i*2.4;
      const crown=mesh(new THREE.IcosahedronGeometry((i? .9:1.1)*s,2),['#509a7c','#9aac57','#4d968e'][i%3],x+Math.cos(a)*.62*s,2.7*s+(i%2)*.4*s,z+Math.sin(a)*.5*s);
      crown.scale.set(1,.95,.86);
    }
  }
  // Water and a long, softened waterfront. Nothing is a texture or image.
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#a5ccd1', roughness: .38, metalness: .15 });
  const waterTime = { value: 0 };
  waterMaterial.onBeforeCompile = shader => {
    shader.uniforms.harborTime = waterTime;
    shader.vertexShader = 'uniform float harborTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z += sin(position.x * .47 + harborTime * .5) * .08 + cos(position.y * .64 + harborTime * .65) * .06;');
  };
  waterMaterial.customProgramCacheKey = () => 'harbor-water-v1';
  const water = new THREE.Mesh(new THREE.PlaneGeometry(waterSurface.size, waterSurface.size, waterSurface.columns, waterSurface.rows), waterMaterial);
  water.rotation.x = -Math.PI / 2; water.position.y = waterSurface.level; water.receiveShadow = true; root.add(water);
  // The mapped shoreline and footprints establish the open spaces and street widths.
  const ordered=[...sfMap.coasts].sort((a,b)=>a[0][0]-b[0][0]);
  const coast=ordered.flat();
  const shore=coast.filter(p=>p[0]>-99&&p[0]<112).sort((a,b)=>a[0]-b[0]);
  // Coast vertices are retained in chain order below; no regular island rectangle.
  const chain: number[][]=[];
  const remaining=[...sfMap.coasts];let current=remaining.splice(remaining.findIndex(c=>c[0][0]<-99),1)[0];
  if(current){chain.push(...current);while(remaining.length){const end=chain[chain.length-1];const next=remaining.findIndex(c=>Math.hypot(c[0][0]-end[0],c[0][1]-end[1])<.05);if(next<0)break;current=remaining.splice(next,1)[0];chain.push(...current.slice(1));}}
  const landEdge=chain.length?chain:shore;
  const landPoints=[...landEdge,[500,-1000],[-500,-1000]];
  mesh(footprintGeometry(landPoints,.72),'#b9bba9',0,-.73,0);
  function linePath(points:number[][],width:number,y:number,color:string){
    for(let i=1;i<points.length;i++){
      const [ax,az]=points[i-1],[bx,bz]=points[i],length=Math.hypot(bx-ax,bz-az);
      if(length<.02)continue;
      const m=box(width,.028,length,(ax+bx)/2,y,(az+bz)/2,color);m.rotation.y=Math.atan2(bx-ax,bz-az);
    }
  }
  linePath(landEdge,1.1,.03,'#ddcfb7');
  sfMap.roads.forEach(road=>{
    const width=road.name.includes('Embarcadero')?1.02:road.name==='Market Street'?1.45:road.kind==='primary'?.8:.48;
    linePath(road.p,width,.04,'#889b9a');
    if(road.name.includes('Embarcadero'))linePath(road.p,.027,.062,'#d4d3ba');
  });
  sfMap.parks.forEach(park=>{if(park.p.length>3)mesh(footprintGeometry(park.p,.07),park.name==='Rincon Park'?'#c2bfa8':park.name==='Embarcadero Plaza'?'#b7896f':'#89a66c',0,.04,0);});
  sfMap.piers.filter(p=>p.closed).forEach(pier=>mesh(footprintGeometry(pier.p,.18),pier.name==='Pier 7'?'#b5a27e':'#ccd0c3',0,-.12,0));
  // Pile-supported decks: visible bents below every mapped waterfront pier.
  function insidePier(x:number,z:number,ps:number[][]){let inside=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){const [ax,az]=ps[i],[bx,bz]=ps[j];if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;}return inside;}
  const pierSupports:{x:number;z:number}[]=[];
  function pile(x:number,z:number,timber=false){
    if(pierSupports.some(p=>Math.hypot(p.x-x,p.z-z)<.18))return;
    pierSupports.push({x,z});
    mesh(new THREE.CylinderGeometry(timber?.048:.06,timber?.062:.075,1.65,8),timber?'#857457':'#89998f',x,-.93,z);
    box(.21,.12,.21,x,-.15,z,timber?'#b39a70':'#b8baaa');
    mesh(new THREE.CylinderGeometry(.068,.076,.14,8),'#526d65',x,-.63,z);
  }
  for(const pier of sfMap.piers.filter(p=>p.closed)){
    const [cx,cz]=center(pier.p);if(cx< -90||cx>65||cz>30)continue;
    const timber=pier.name==='Pier 7';
    if(pier.name.startsWith('Ferry Building Gate'))continue;
    for(let e=1;e<pier.p.length;e++){
      const [ax,az]=pier.p[e-1],[bx,bz]=pier.p[e],len=Math.hypot(bx-ax,bz-az);if(len<.3)continue;
      const count=Math.max(1,Math.ceil(len/1.2));
      for(let i=0;i<count;i++){
        const t=(i+.5)/count,x=ax+(bx-ax)*t,z=az+(bz-az)*t,dist=Math.hypot(cx-x,cz-z)||1;
        const px=x+(cx-x)/dist*.09,pz=z+(cz-z)/dist*.09;
        if(insidePier(px,pz,pier.p))pile(px,pz,timber);
      }
      // Deep perimeter fascia hides the paper-thin slab edge.
      const beam=box(.055,.18,len,(ax+bx)/2,-.19,(az+bz)/2,timber?'#b39a70':'#b5b8aa');beam.rotation.y=Math.atan2(bx-ax,bz-az);
    }
    const minX=Math.min(...pier.p.map(p=>p[0])),maxX=Math.max(...pier.p.map(p=>p[0])),minZ=Math.min(...pier.p.map(p=>p[1])),maxZ=Math.max(...pier.p.map(p=>p[1]));
    for(let x=minX+.5;x<maxX;x+=1.35)for(let z=minZ+.5;z<maxZ;z+=1.35)if(insidePier(x,z,pier.p))pile(x,z,timber);
  }
  // Crossheads and diagonal bracing are legible from the low opening camera.
  for(const [cx,width,end,timber] of [[-17.25,.56,11.8,false],[27.28,.62,14,true]] as const){
    for(let z=.6;z<end;z+=1.3){
      box(width+.12,.13,.16,cx,-.22,z,timber?'#ad9269':'#a4ada0');
      for(const side of [-1,1])pile(cx+side*width*.36,z,timber);
      if(timber)for(const side of [-1,1])pole(new THREE.Vector3(cx+side*width*.36,-.28,z),new THREE.Vector3(cx-side*width*.36,-.68,z),.021,'#877354');
    }
  }
  const hillsWing:typeof mappedBuildings[number]={glass:false,measured:false,id:-157,name:'Hills Bros Coffee',h:1.46,minH:0,p:[[-44.35,-5.58],[-37.85,-6.55],[-38.29,-9.48],[-44.79,-8.51],[-44.35,-5.58]]};
  const hillsIds=new Set([-157,1487160484,944986473]);
  const detailedBuildings=refineReferenceMassing(refineNeighborhoodMassing([...mappedBuildings.filter(b=>![1487160485,1487160486,1487160487].includes(b.id)),hillsWing]));
  const neighborhood=neighborhoodDetail(detailedBuildings);root.add(neighborhood.root);windowPositions.push(...neighborhood.windows);
  const gardens=waterfrontGardens(detailedBuildings);root.add(gardens.root);
  detailedBuildings.forEach(b=>{
    if(['Transamerica Pyramid','Salesforce Tower','San Francisco Ferry Building'].includes(b.name))return;
    if(isMooredVessel(b)){
      if(!b.parent){const detail=mooredVessel(b,font);root.add(detail.root);windowPositions.push(...detail.windows);}
      return;
    }
    const [cx,cz]=center(b.p),h=b.h,minH=b.minH||0;
    const family=b.parent||b.id,reference=architectureProfile(b);
    const ribbed=b.name.includes('Embarcadero Center')||['Spear Tower','Steuart Tower'].includes(b.name);
    const hotel=b.name.includes('Hyatt Regency');
    const historic=['Southern Pacific Building','The Audiffred Building','Ferry Station Post Office Building','Pier 1'].includes(b.name);
    const color=hasNeighborhoodDetail(b)?neighborhoodColor(b):referenceColor(b)??characterColors[b.name]??(hillsIds.has(b.id)?'#ad7354':b.name==='Southern Pacific Building'?'#ad765d':b.name==='The Audiffred Building'?'#b57e62':historic?'#d3c4a9':ribbed||hotel?'#d4cdb9':b.id===28240176?'#66828b':h>8?['#8ba8af','#7496a5','#b3bbb6','#a8b4b3'][family%4]:['#e1c193','#caab95','#d3ccac','#9fbab0','#cf9e87'][family%5]);
    mesh(footprintGeometry(b.p,h-minH),color,0,minH,0);
    // Polygon-aligned windows follow each actual facade, with floors scaled in metres.
    if(h>.9&&cz>-64&&!reference&&!hasNeighborhoodDetail(b)&&!hillsIds.has(b.id)&&!detailedWaterfrontNames.has(b.name)&&!characterBuildings.has(b.name))for(let edge=1;edge<b.p.length;edge++){
      const [ax,az]=b.p[edge-1],[bx,bz]=b.p[edge],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
      if(len<.45)continue;
      const midx=(ax+bx)/2,midz=(az+bz)/2;let nx=dz/len,nz=-dx/len;
      if(nx*(midx-cx)+nz*(midz-cz)<0){nx=-nx;nz=-nz;}
      const distant=cz< -38||cx>38||cx< -65;const step=distant?.85:h>8?.42:.48;
      for(let f=minH+.4;f<h-.25;f+=step)for(let d=.28;d<len-.2;d+=distant?.8:.4){
        windowPositions.push({x:ax+dx*d/len+nx*.045,y:f,z:az+dz*d/len+nz*.045,ry:Math.atan2(nx,nz),w:h>8?.24:.16,h:.23});
      }
    }
    if(detailedWaterfrontNames.has(b.name)){const detail=waterfrontLandmark(b,font);root.add(detail.root);windowPositions.push(...detail.windows);}
    if(characterBuildings.has(b.name)){const detail=buildingCharacter(b,detailedBuildings,font);root.add(detail.root);windowPositions.push(...detail.windows);}
    if(reference){const detail=referenceArchitecture(b,detailedBuildings,font);root.add(detail.root);windowPositions.push(...detail.windows);}
    if(['Spear Tower','Steuart Tower'].includes(b.name)||b.id===944095688)root.add(modernBuildingAccents(b,detailedBuildings));
    if(historic&&!detailedWaterfrontNames.has(b.name)&&!characterBuildings.has(b.name)){
      const cornice=b.p.map(([x,z])=>[cx+(x-cx)*1.018,cz+(z-cz)*1.018]);
      mesh(footprintGeometry(cornice,.065),'#e1d5bd',0,h-.02,0);
      if(b.name==='The Audiffred Building'){
        const roof=b.p.map(([x,z])=>[cx+(x-cx)*.92,cz+(z-cz)*.92]);
        mesh(footprintGeometry(roof,.19),'#6e8d80',0,h+.05,0);
      }
      for(let e=1;e<b.p.length;e++){
        const [ax,az]=b.p[e-1],[bx,bz]=b.p[e],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);if(len<.35)continue;
        let nx=dz/len,nz=-dx/len;if(nx*((ax+bx)/2-cx)+nz*((az+bz)/2-cz)<0){nx=-nx;nz=-nz;}
        const facade=new THREE.Group();facade.position.set((ax+bx)/2,0,(az+bz)/2);facade.rotation.y=Math.atan2(nx,nz);root.add(facade);
        for(const y of [.11,Math.min(.8,h*.8),h-.09])box(len,.045,.095,0,y,.045,'#e1d7c2',facade);
        const bays=Math.max(1,Math.floor(len/.42));
        for(let i=0;i<bays;i++){
          const x=-len/2+(i+.5)*len/bays,w=Math.min(.23,len/bays*.66),doorH=Math.min(.53,h*.65);
          box(w,doorH,.026,x,doorH/2+.1,.065,'#344e54',facade);
          mesh(new THREE.TorusGeometry(w/2+.025,.023,4,12,Math.PI),'#e3d6ba',x,doorH+.1,.09,facade);
          for(const side of [-1,1])box(.037,doorH,.06,x+side*(w/2+.025),doorH/2+.1,.082,'#e2d4b8',facade);
          box(.018,doorH,.04,x,doorH/2+.1,.088,'#9cab9f',facade);
          if(b.name==='Southern Pacific Building'){
            for(let y=1;y<h-.25;y+=.28){box(w,.16,.035,x,y,.073,'#435d63',facade);box(w+.065,.025,.08,x,y-.095,.086,'#e0cfb1',facade);}
            box(.046,h-.94,.08,x+len/bays/2,(h+.84)/2,.075,'#ddcdb0',facade);
          }
        }
      }
    }
    if(hillsIds.has(b.id)){
      for(let e=1;e<b.p.length;e++){
        const [ax,az]=b.p[e-1],[bx,bz]=b.p[e],len=Math.hypot(bx-ax,bz-az);if(len<.5)continue;
        let nx=(bz-az)/len,nz=-(bx-ax)/len;if(nx*((ax+bx)/2-cx)+nz*((az+bz)/2-cz)<0){nx=-nx;nz=-nz;}
        const face=new THREE.Group();face.position.set((ax+bx)/2,0,(az+bz)/2);face.rotation.y=Math.atan2(nx,nz);root.add(face);
        {
          // Romanesque brick bays, stepped pilasters and recessed steel windows.
          for(const y of [.14,1.18,h-.27,h-.08])box(len+.08,.075,.15,0,y,.085,'#d2aa7d',face);
          const bays=Math.max(1,Math.round(len/.65)),spacing=len/bays;
          for(let i=0;i<bays;i++){
            const x=-len/2+(i+.5)*spacing,w=Math.min(.36,spacing*.66);
            box(w,.70,.034,x,.55,.066,'#344e50',face);
            mesh(new THREE.TorusGeometry(w/2+.028,.035,5,16,Math.PI),'#d0a174',x,.90,.105,face);
            for(const dx of [-w/2-.03,w/2+.03])box(.056,.78,.1,x+dx,.51,.095,'#bd8b62',face);
            for(let y=1.65;y<h-.55;y+=.82){
              box(w,.52,.035,x,y,.062,'#385459',face);
              for(const dx of [-w/2,0,w/2])box(.025,.55,.042,x+dx,y,.09,'#8caa9e',face);
              box(w,.022,.046,x,y,.096,'#8caa9e',face);
              box(w+.10,.045,.13,x,y-.29,.10,'#d2ae81',face);
            }
            const px=x-spacing/2+.035;
            box(.10,h-.38,.13,px,(h-.38)/2+.1,.07,'#ba8861',face);
            for(let step=0;step<3;step++)box(.12+step*.045,.05,.16,px,h-.44+step*.055,.085,'#d2aa7d',face);
          }
          // Mortar bands stay separated from the facade and window layers.
          for(let y=.25;y<h-.35;y+=.16)box(len,.012,.018,0,y,.017,'#b9815d',face);
          for(let x=-len/2+.1;x<len/2;x+=.18)box(.075,.10,.13,x,h-.20,.07,'#c79b6a',face);
        }
      }
    }
    // Structural details follow each real facade edge, including stepped building parts.
    if(ribbed||hotel||b.id===28240176||b.id===445566153||b.id===667097308){
      for(let e=1;e<b.p.length;e++){
        const [ax,az]=b.p[e-1],[bx,bz]=b.p[e],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
        if(len<.18)continue;
        let nx=dz/len,nz=-dx/len;
        if(nx*((ax+bx)/2-cx)+nz*((az+bz)/2-cz)<0){nx=-nx;nz=-nz;}
        const point=(t:number,y:number)=>new THREE.Vector3(ax+dx*t+nx*.07,y,az+dz*t+nz*.07);
        if(ribbed&&!reference)for(let d=.1;d<len;d+=.22) pole(point(d/len,minH+.04),point(d/len,h+.03),.026,'#e5dfca');
        if(hotel)for(let y=minH+.2;y<h+.04;y+=.21) pole(point(0,y),point(1,y),.037,'#e5dece');
        if(b.id===28240176||b.id===445566153){
          const bay=Math.ceil(len/1.8),floor=b.id===28240176?2.40:1.45;
          for(let i=0;i<bay;i++)for(let y=minH+.12;y<h-.15;y+=floor){
            const top=Math.min(y+floor,h);
            pole(point(i/bay,y),point((i+1)/bay,top),.034,'#d1d6ce');
            pole(point((i+1)/bay,y),point(i/bay,top),.034,'#d1d6ce');
          }
        }
      }
    }
  });
  // Salesforce and Transamerica use the mapped positions and relative heights.
  const salesforce=mappedBuildings.find(b=>b.name==='Salesforce Tower')!;const [sx,sz]=center(salesforce.p);
  mesh(new THREE.CylinderGeometry(1.04,1.55,18.2,24),'#719aa9',sx,9.1,sz);
  const sfCrown=mesh(new THREE.SphereGeometry(1.06,24,12,0,Math.PI*2,0,Math.PI/2),'#b9cdd0',sx,18.2,sz);sfCrown.scale.y=1.29;
  for(let y=.4;y<18.3;y+=.23)mesh(new THREE.CylinderGeometry(1.565-y*.0285,1.565-y*.0285,.027,24),'#b3c9c9',sx,y,sz);
  const transamerica=mappedBuildings.find(b=>b.name==='Transamerica Pyramid')!;const [tx,tz]=center(transamerica.p);
  box(2.1,1.2,2.1,tx,.6,tz,cream);
  const pyramid=mesh(new THREE.ConeGeometry(1.57,13.8,4),cream,tx,8.1,tz);pyramid.rotation.y=Math.PI/4;
  pole(new THREE.Vector3(tx,14.9,tz),new THREE.Vector3(tx,15.6,tz),.025,cream);
  for(let y=2;y<14;y+=.35){const w=(15-y)*.15;box(w,.018,w,tx,y,tz,'#bec8bb');}
  for(const dx of [-1.12,1.12])box(.24,4,.65,tx+dx,5.5,tz,cream);
  // A soft distant ridge frames the mapped city without enclosing it in a box.
  for(let i=0;i<14;i++){const hill=mesh(new THREE.SphereGeometry(12,16,8),'#a1b7a5',-110+i*17,-8,-135);hill.scale.set(1.5,.5+(i%4)*.1,1);}
  const ferryStart=new Set(root.children);
  // Ferry Building: long arcaded hall, tiled roofs, and four-sided clock tower.
  box(15, 2.35, 3.7, 1, 1.18, -.25, cream);
  box(15.5, .3, 4, 1, 2.45, -.25, '#d8c3a5');
  const hallRoof=new THREE.Group();hallRoof.position.set(1,2.57,-.25);hallRoof.rotation.y=Math.PI/2;root.add(hallRoof);gable(4.1,1.1,15.5,0,0,0,'#637b7c',hallRoof);
  // Both long elevations have layered stone arches, glazed transoms and recessed doors.
  for(const side of [-1,1]){
    const elevation=new THREE.Group();elevation.position.z=-.25+side*1.86;elevation.rotation.y=side<0?Math.PI:0;root.add(elevation);
    for(let x=-5.8;x<8.3;x+=1.05){
      box(.67,1.16,.035,x,.67,.026,'#243f46',elevation);
      mesh(new THREE.CircleGeometry(.335,16,0,Math.PI),'#29464c',x,1.25,.03,elevation);
      for(const r of [.36,.43])mesh(new THREE.TorusGeometry(r,.035,5,20,Math.PI),'#e5ddca',x,1.25,.085,elevation);
      for(const dx of [-.4,.4]){box(.085,1.16,.12,x+dx,.67,.06,cream,elevation);box(.15,.1,.18,x+dx,1.19,.09,'#d1c7b1',elevation);}
      box(.09,.16,.15,x,1.68,.09,'#ece5d5',elevation);
      for(const dx of [-.17,0,.17])box(.023,1.03,.055,x+dx,.69,.066,'#688181',elevation);
      box(.64,.035,.05,x,.88,.067,'#80918d',elevation);
      box(.035,.1,.06,x+.065,.58,.096,'#baa272',elevation);
      box(.55,.46,.04,x,2.01,.03,'#536c71',elevation);
      mesh(new THREE.TorusGeometry(.29,.035,5,16,Math.PI),'#e8dfcb',x,2.19,.075,elevation);
      for(const dx of [-.28,0,.28])box(.033,.5,.07,x+dx,2.01,.07,cream,elevation);
      box(.67,.075,.13,x,1.75,.08,cream,elevation);
    }
    for(const y of [.17,1.72,2.38,2.55])box(15.2,.065,.13,1,y,.04,'#e3dac7',elevation);
    for(let x=-6.4;x<8.5;x+=.18)box(.075,.085,.12,x,2.5,.07,'#f1e8d6',elevation);
    for(const x of [-6.35,8.35])for(let y=.25;y<2.3;y+=.19)box(.3,.06,.09,x,y,.08,'#d7cdb8',elevation);
  }
  // Standing seams, ridge cap and the long glazed nave skylight.
  box(15.4,.1,.15,1,3.66,-.25,'#a0aaa1');
  for(let x=-6.45;x<8.65;x+=.32)for(const side of [-1,1])pole(new THREE.Vector3(x,2.62,-.25+side*2),new THREE.Vector3(x,3.65,-.25),.012,'#91a29e');
  box(9.4,.18,.58,1,3.68,-.25,'#819b9f');
  for(let x=-3.7;x<5.8;x+=.35)box(.032,.2,.64,x,3.7,-.25,'#c4cdc3');
  const towerStart=new Set(root.children);
  box(2.2,4.7,2.2,1,4.05,-.1,cream);
  box(2.35,1.95,2.35,1,6.35,-.1,'#eee8d9');
  for(const [y,w] of [[3.2,2.42],[5.15,2.45],[7.25,2.6],[7.48,2.7],[8.95,2.58],[9.12,2.7]]){
    box(w,.12,w,1,y,-.1,'#e7dfcd');box(w+.12,.065,w+.12,1,y+.07,-.1,'#c4bfaf');
  }
  for(let side=0;side<4;side++){
    const a=side*Math.PI/2;
    const face=new THREE.Group();face.position.set(1,0,-.1);face.rotation.y=a;root.add(face);
    box(1.63,1.2,.05,0,8.15,1.03,'#3f5251',face);
    for(const x of [-.9,-.45,0,.45,.9]){
      pole(new THREE.Vector3(x,7.62,1.13),new THREE.Vector3(x,8.76,1.13),.062,cream,face);
      box(.19,.08,.2,x,8.77,1.13,'#eee5d3',face);box(.19,.09,.2,x,7.62,1.13,'#dad4c2',face);
    }
    for(const x of [-1.1,1.1])box(.19,1.33,.21,x,8.16,1.06,'#e4ddcc',face);
    for(const x of [-.72,-.36,0,.36,.72])box(.22,.18,.055,x,7.05,1.2,'#71817c',face);
    for(let y=3.45;y<4.8;y+=.49)box(.22,.31,.04,0,y,1.12,'#5c6d68',face);
    mesh(new THREE.CircleGeometry(.78,48),'#f4eddc',0,6.15,1.205,face);
    mesh(new THREE.TorusGeometry(.78,.035,5,48),'#65726b',0,6.15,1.23,face);
    mesh(new THREE.TorusGeometry(.49,.012,4,40),'#b1b5a5',0,6.15,1.245,face);
    const numerals=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
    for(let tick=0;tick<60;tick++){
      const t=tick*Math.PI/30;
      const m=box(.018,tick%5===0?.09:.035,.02,Math.sin(t)*.735,6.15+Math.cos(t)*.735,1.25,dark,face);m.rotation.z=-t;
      if(tick%5===0){const label=lettering(numerals[tick/5],.115,Math.sin(t)*.61,6.11+Math.cos(t)*.61,1.258,dark,face);label.scale.x=.8;}
    }
    const hand=box(.05,.47,.05,1+Math.sin(a)*1.28,6.32,-.1+Math.cos(a)*1.28,dark);
    const shortHand=box(.055,.36,.055,1+Math.sin(a)*1.28,6.15,-.1+Math.cos(a)*1.28,dark);
    clockHands.push({minute:hand,hour:shortHand,angle:a});
  }
  // Open circular lantern above the square belfry, matching the real tower silhouette.
  for(const [radius,y] of [[.85,9.27],[.85,10.1],[.62,10.23],[.61,10.87]])mesh(new THREE.CylinderGeometry(radius,radius,.12,24),'#e9e2d1',1,y,-.1);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,x=Math.sin(a),z=Math.cos(a);
    pole(new THREE.Vector3(1+x*.69,9.3,-.1+z*.69),new THREE.Vector3(1+x*.69,10.05,-.1+z*.69),.055,cream);
    pole(new THREE.Vector3(1+x*.48,10.28,-.1+z*.48),new THREE.Vector3(1+x*.48,10.83,-.1+z*.48),.04,cream);
  }
  mesh(new THREE.SphereGeometry(.56,20,10,0,Math.PI*2,0,Math.PI/2),'#667d73',1,10.9,-.1).scale.y=.6;
  pole(new THREE.Vector3(1,11,-.1),new THREE.Vector3(1,11.6,-.1),.025,dark);
  for(let stripe=0;stripe<7;stripe++)box(.56,.035,.024,1.3,11.5-stripe*.035,-.1,stripe%2?'#e5ddcd':'#aa5148');
  box(.23,.13,.028,1.14,11.45,-.12,'#45617a');
  const clockTower=new THREE.Group();root.add(clockTower);
  root.children.filter(o=>o!==clockTower&&!towerStart.has(o)).forEach(o=>clockTower.attach(o));
  clockTower.scale.set(.41,1,.66);clockTower.position.x=.59;
  for(let x=-6.3;x<8.4;x+=.35)box(.075,.35,.08,x,2.72,1.85,cream);
  box(15,.07,.15,1,2.92,1.85,cream);
  const ferryBuilding=new THREE.Group();root.add(ferryBuilding);
  root.children.filter(o=>o!==ferryBuilding&&!ferryStart.has(o)).forEach(o=>ferryBuilding.attach(o));
  ferryBuilding.position.x=-1;ferryBuilding.scale.set(1,.41,.62);
  // The full western crossing shares the city's map projection. W1 is the
  // shoreline transition; four suspension towers flank the central anchorage.
  const bridge=new THREE.Group();bridge.position.set(bridgeLayout.origin[0],0,bridgeLayout.origin[1]);bridge.rotation.y=bridgeLayout.angle;root.add(bridge);
  const deckLow=bridgeLayout.lowerDeck,deckHigh=bridgeLayout.upperDeck,bridgeEnd=bridgeLayout.length;
  const deckStart=0,deckLength=bridgeEnd-deckStart;
  for(const [y,color] of [[deckLow,'#728b91'],[deckHigh,'#98aaa9']] as const)box(1.22,.1,deckLength,0,y,(bridgeEnd+deckStart)/2,color,bridge);
  box(1.2,.025,deckLength,0,deckHigh+.064,(bridgeEnd+deckStart)/2,'#6f8389',bridge);
  for(const x of [-.65,.65]){
    for(const y of [deckLow,deckHigh])box(.055,.07,deckLength,x,y,(bridgeEnd+deckStart)/2,'#58727e',bridge);
    box(.025,.025,deckLength,x,deckHigh+.29,(bridgeEnd+deckStart)/2,'#9aafb1',bridge);
    for(let z=deckStart;z<bridgeEnd-.6;z+=.7){
      pole(new THREE.Vector3(x,deckLow,z),new THREE.Vector3(x,deckHigh,z+.7),.025,'#5f7a83',bridge);
      box(.02,.25,.02,x,deckHigh+.16,z,'#a4b5b4',bridge);
      box(1.3,.065,.045,0,deckLow-.1,z,'#57727c',bridge);
    }
  }
  for(const z of bridgeLayout.towers){
    // Shared rectangular caisson, not a pair of disconnected round feet.
    box(2.3,1.25,1.45,0,-.05,z,'#b2b8b1',bridge);
    box(2.42,.16,1.57,0,.65,z,'#c2c5b9',bridge);
    for(const side of [-1,1]){
      const x=side*.82;
      box(.22,8.6,.4,x,4.98,z,'#8aa1a5',bridge);
      for(const dx of [-.115,.115])box(.04,8.7,.43,x+dx,5,z,'#b8c4c1',bridge);
      for(const zz of [-.215,.215])for(let y=1;y<9.2;y+=.3)box(.21,.028,.027,x,y,z+zz,'#607d87',bridge);
      box(.4,.25,.62,x,9.43,z,'#a3b7b7',bridge);
      box(.29,.28,.44,x,9.69,z,'#b9c4bd',bridge);
    }
    for(const y of [4.6,6.2,7.8,9.3]){
      box(1.8,.16,.4,0,y,z,'#99b0b2',bridge);
      if(y<9)for(const zz of [-.15,.15])for(const sign of [-1,1])pole(new THREE.Vector3(sign*.72,y,z+zz),new THREE.Vector3(-sign*.72,y+1.5,z+zz),.05,'#809ca3',bridge);
    }
  }
  // Solid, stepped W1 and W4 anchorages terminate the cables visibly.
  for(const z of [15.64,bridgeLayout.anchor]){
    const central=z===bridgeLayout.anchor;
    box(central?2.9:2.2,2.5,central?3.3:2.4,0,.7,z,'#b8bbaa',bridge);
    box(central?2.6:2.3,.35,central?3.3:2.4,0,5.7,z,'#d0cfbb',bridge);
    // The two roadway openings remain clear through each anchorage.
    for(const side of [-1,1])box(.4,3.7,central?3.4:2.5,side*1.02,3.75,z,'#c2c8bb',bridge);
  }
  // Cable profile: 1,160 ft side spans and 2,310 ft main spans, twice.
  const cableLightPositions:number[]=[];
  const cableSpans=[[15.64,36.85,4.85,9.55],[36.85,79.097,9.55,9.55],[79.097,100.31,9.55,4.85],[100.31,121.524,4.85,9.55],[121.524,163.771,9.55,9.55],[163.771,bridgeEnd,9.55,4.85]];
  for(const x of [-.75,.75])for(const [from,to,ya,yb] of cableSpans){
    const points:THREE.Vector3[]=[];
    const main=Math.abs(ya-yb)<.1;
    for(let i=0;i<=96;i++){
      const t=i/96,z=from+(to-from)*t,y=ya+(yb-ya)*t-(main?4.7:1.65)*4*t*(1-t);
      points.push(new THREE.Vector3(x,y,z));
      if(i%2===0)cableLightPositions.push(x,y+.045,z);
      if(i%3===0)for(let yy=deckHigh+.15;yy<y-.05;yy+=.21)cableLightPositions.push(x,yy,z);
      if(i%3===0&&y>deckHigh+.12)pole(new THREE.Vector3(x,deckHigh+.05,z),new THREE.Vector3(x,y,z),.012,'#b3c9c8',bridge);
    }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),96,.027,5,false),'#516d79',0,0,0,bridge);
  }
  const bridgeLightMaterial=new THREE.PointsMaterial({color:'#d8e8ed',size:1.25,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  const bridgeLights=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(cableLightPositions,3)),bridgeLightMaterial);bridge.add(bridgeLights);
  const roadLightPositions:number[]=[];
  for(let z=0;z<bridgeEnd;z+=3)roadLightPositions.push(-.61,deckHigh+.64,z,.61,deckHigh+.64,z);
  const roadLightMaterial=new THREE.PointsMaterial({color:'#ffdf9e',size:2,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  bridge.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(roadLightPositions,3)),roadLightMaterial));
  // Cable tails descend into the land anchorage; steel bents carry the city approach.
  for(const x of [-.75,.75])pole(new THREE.Vector3(x,4.85,15.64),new THREE.Vector3(x,.8,-1),.033,'#5b7480',bridge);
  for(const z of [0,7]){
    for(const x of [-.85,.85])box(.22,3.75,.3,x,1.7,z,'#a8b7b3',bridge);
    box(2.1,.19,.4,0,3.55,z,'#9aa9a5',bridge);
  }
  // Mapped I-80 approaches curve inland and descend into the street network.
  bridgeApproaches.forEach((points,lane)=>{
    let distance=0;
    for(let i=1;i<points.length;i++){
      const [ax,az]=points[i-1],[bx,bz]=points[i],length=Math.hypot(bx-ax,bz-az);
      const y=(lane===0?deckHigh:deckLow)*Math.max(.025,1-distance/115);
      const nextY=(lane===0?deckHigh:deckLow)*Math.max(.025,1-(distance+length)/115);
      const approach=box(1.22,.13,Math.hypot(length,nextY-y)+.04,(ax+bx)/2,(y+nextY)/2,(az+bz)/2,'#879b9d');
      approach.rotation.y=Math.atan2(bx-ax,bz-az);approach.rotateX(-Math.atan2(nextY-y,length));
      if(length>1.5){box(.3,Math.max(.1,y-.1),.4,ax,y/2,az,'#b6bcae');}
      distance+=length;
    }
  });
  // The eastern end of the west span enters Yerba Buena Island's tunnel portals.
  const island=new THREE.Group();island.position.set(0,0,bridgeEnd+4);bridge.add(island);
  for(const [x,z,r,h] of [[-8,8,12,6],[7,11,14,9],[-3,22,16,10],[10,28,13,7]]){
    const mound=mesh(new THREE.SphereGeometry(r,16,10),'#8c9d76',x,0,z,island);mound.scale.set(1,h/r,1);
  }
  box(3.7,4.9,2.1,0,2.0,bridgeEnd+1,'#bcbdaa',bridge);
  for(const y of [deckLow+.18,deckHigh+.18])box(1.25,.48,.03,0,y,bridgeEnd-.065,'#304b53',bridge);
  for(let z=deckStart;z<bridgeEnd;z+=1.8)for(const x of [-.36,-.12,.12,.36])box(.015,.009,.55,x,deckHigh+.082,z,'#d8d6bd',bridge);
  for(let z=0;z<bridgeEnd;z+=6){pole(new THREE.Vector3(-.63,deckHigh,z),new THREE.Vector3(-.63,deckHigh+.6,z),.012,dark,bridge);box(.22,.03,.08,-.56,deckHigh+.6,z,cream,bridge);}
  const cars=Array.from({length:22},(_,i)=>box(.11,.12,.27,i%2?.24:-.24,i%2?deckHigh+.15:deckLow+.15,i*8,[rust,cream,dark][i%3],bridge));
  const coffeeSign=new THREE.Group();root.add(coffeeSign);
  // Waterfront-facing historic wing, with the silo tower behind it.
  const hillsRoof=new THREE.Group();hillsRoof.position.set(-41.35,1.50,-7.08);hillsRoof.rotation.y=.148;root.add(hillsRoof);
  const roofGable=new THREE.Group();hillsRoof.add(roofGable);roofGable.rotation.y=Math.PI/2;
  gable(1.55,.48,5.8,0,0,0,'#b9714e',roofGable);
  for(let x=-2.85;x<2.9;x+=.095)for(const side of [-1,1])pole(new THREE.Vector3(x,.03,side*.76),new THREE.Vector3(x,.48,0),.013,'#cf9060',hillsRoof);
  for(let x=-2.8;x<2.9;x+=.5){box(.24,.26,.04,x,-.12,.79,'#48696b',hillsRoof);box(.27,.028,.09,x,-.27,.82,'#dec6a0',hillsRoof);}
  // Planting and shade frames along the setback terrace.
  for(let x=-2.8;x<2.9;x+=.65){box(.46,.13,.18,x,-.005,1.0,'#ceab7c',hillsRoof);for(let n=0;n<3;n++)mesh(new THREE.IcosahedronGeometry(.10,1),'#718b52',x-.14+n*.14,.1,1.0,hillsRoof);}
  for(const id of [1487160484,944986473]){
    const tower=mappedBuildings.find(b=>b.id===id)!;const [x,z]=center(tower.p);
    const w=id===1487160484?1.80:1.03,d=id===1487160484?1.73:1.08;
    box(w+.12,.10,d+.12,x,tower.h+.025,z,'#d3ad82');
    const cap=mesh(new THREE.ConeGeometry(1,.45,4),'#b66d4b',x,tower.h+.29,z);cap.rotation.y=Math.PI/4+.148;cap.scale.set(w/1.414,1,d/1.414);
  }
  coffeeSign.position.set(-41.35,1.99,-6.94);coffeeSign.rotation.y=.148;
  const coffeeMaterial=new THREE.MeshStandardMaterial({color:'#cf5545',emissive:'#f14a2d',emissiveIntensity:0,roughness:.5});
  const coffeeLetters=lettering('HILLS BROS COFFEE',.43,0,.31,.03,'#cf5545',coffeeSign);coffeeLetters.material=coffeeMaterial;
  const signWidth=coffeeLetters.geometry.boundingBox!.max.x-coffeeLetters.geometry.boundingBox!.min.x;
  coffeeSign.scale.x=Math.min(1,5.9/signWidth);
  for(let x=-signWidth/2;x<=signWidth/2;x+=.52){
    pole(new THREE.Vector3(x,0,0),new THREE.Vector3(x,.85,0),.012,'#738578',coffeeSign);
    pole(new THREE.Vector3(x,0,-.44),new THREE.Vector3(x,.77,0),.014,'#738578',coffeeSign);
  }
  for(const y of [.2,.72])box(signWidth,.025,.025,0,y,-.025,'#758577',coffeeSign);
  // Rincon Park, a curved lawn set between boulevard and bay.
  const sculpture=new THREE.Group();sculpture.position.set(-32.29,.32,-1.16);sculpture.scale.setScalar(.43);sculpture.rotation.y=-.13;root.add(sculpture);
  const bowCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-3.8,.05,0),new THREE.Vector3(-2.9,2.7,0),new THREE.Vector3(-1.1,4.1,0),new THREE.Vector3(1.4,3.7,0),new THREE.Vector3(3.8,.05,0)]);
  mesh(new THREE.TubeGeometry(bowCurve,40,.17,8,false),'#d69b32',0,0,0,sculpture);
  pole(new THREE.Vector3(-3.8,.08,.05),new THREE.Vector3(.3,2,.05),.025,'#645244',sculpture);
  pole(new THREE.Vector3(.3,2,.05),new THREE.Vector3(3.8,.08,.05),.025,'#645244',sculpture);
  // Red fletching above the buried arrow: the recognizable Cupid's Span silhouette.
  pole(new THREE.Vector3(.1,0,.1),new THREE.Vector3(1.7,6,.1),.105,'#bb5334',sculpture);
  const featherShape=new THREE.Shape();featherShape.moveTo(0,0);featherShape.lineTo(-.92,.55);featherShape.lineTo(-1.18,2.05);featherShape.lineTo(-.14,1.38);featherShape.lineTo(.85,2.1);featherShape.lineTo(.83,.8);featherShape.closePath();
  const arrowFeather=mesh(new THREE.ExtrudeGeometry(featherShape,{depth:.12,bevelEnabled:false}),'#ce5035',1.3,4.6,.05,sculpture);arrowFeather.rotation.z=-.26;
  // Rincon Park: the sculpture sits on a tilted lawn, edged by wave-like seat walls.
  const lawn=[[-36.9,-1.55],[-34.7,-1.98],[-32.9,-2.02],[-30.6,-1.42],[-27.2,-.6],[-26.2,-.24],[-28.7,.04],[-31.2,.35],[-33.5,.8],[-35.7,1.14],[-37.3,.84]];
  mesh(footprintGeometry(lawn,.15),'#739851',0,.1,0);
  const mound=mesh(new THREE.SphereGeometry(1,24,12),'#7da153',-32.7,.12,-1.08);mound.scale.set(3.15,.22,.83);
  const parkCurve=(ps:number[][])=>new THREE.CatmullRomCurve3(ps.map(([x,z])=>new THREE.Vector3(x,0,z))).getPoints(60).map(p=>[p.x,p.z]);
  const upperWalk=parkCurve([[-38.1,-1.4],[-35.6,-1.72],[-32.7,-1.9],[-29.4,-1.07],[-25.2,-.14]]);
  linePath(upperWalk,.27,.13,'#dfd9c5');
  const promenade=parkCurve([[-45.5,-.65],[-40.3,.22],[-37.8,1.1],[-33.5,1.23],[-29,.67],[-24.9,.18]]);
  linePath(promenade,.52,.13,'#d4d0bd');
  linePath(parkCurve([[-38.8,-1.65],[-38.35,-.7],[-37.9,.3],[-37.7,1.21]]),.49,.14,'#e1dbc7');
  function shrub(x:number,z:number,r=.12){
    const bush=mesh(new THREE.IcosahedronGeometry(r,1),['#6d8973','#88976c','#adb18a'][Math.floor(Math.abs(x*7))%3],x,.2,z);bush.scale.set(1,.68,1);
  }
  const seatingCurves=[
    [[-36.8,.92],[-36.2,.75],[-35.6,.74],[-35.1,.95]],
    [[-33.8,.89],[-33.2,.55],[-32.4,.44],[-31.7,.65]],
    [[-30.4,.4],[-29.9,.13],[-29.2,.07],[-28.6,.23]],
    [[-27.5,-.01],[-26.8,-.24],[-26.3,-.18]],
  ];
  for(const points of seatingCurves){
    const curve=parkCurve(points);linePath(curve,.15,.27,'#d7cbb2');linePath(curve,.19,.36,'#e7dcc5');
    curve.filter((_,i)=>i%5===0).forEach(([x,z],i)=>{shrub(x,z-.18,.13);if(i%3===0)mesh(new THREE.SphereGeometry(.035,5,4),'#d8b277',x,.33,z-.2);});
  }
  for(let i=0;i<44;i++){const x=-36.5+i*.235,z=-1.4+(x+36.5)*.07;shrub(x,z,.10);}
  for(const [x,z] of [[-38.1,-1.5],[-25.7,-.2]])tree(x,z,.36);
  // Palms occupy the boulevard median, leaving the paths and lawn open.
  for(let x=-45;x<-23;x+=2.8){
    const z=(streetPose(x,1).z+streetPose(x,-1).z)/2;
    pole(new THREE.Vector3(x,0,z),new THREE.Vector3(x+.05,1.45,z),.055,'#8c795d');
    for(let i=0;i<9;i++){
      const a=i*Math.PI*2/9;
      const shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(.18,.26,.62,0);shape.quadraticCurveTo(.18,-.10,0,0);
      const frond=mesh(new THREE.ShapeGeometry(shape),'#668653',x+.05,1.48,z);frond.rotation.set(-Math.PI/2,0,a);frond.material=material('#668653');frond.material.side=THREE.DoubleSide;
      pole(new THREE.Vector3(x+.05,1.48,z),new THREE.Vector3(x+.05+Math.cos(a)*.62,1.35,z+Math.sin(a)*.62),.013,'#809050');
    }
  }
  // Surviving timber piles and low waterside rails follow the bay edge.
  for(let i=0;i<27;i++){
    const x=-37+i*.43,z=2.4+(i%3)*.33;
    mesh(new THREE.CylinderGeometry(.055,.066,.53+(i%4)*.04,7),'#78867a',x,-.48,z);
  }
  for(let x=-37.6;x<-25.1;x+=.6){
    const z=1.6-(x+37.6)*.092;
    pole(new THREE.Vector3(x,.04,z),new THREE.Vector3(x,.37,z),.015,'#6f8887');
    box(.61,.022,.025,x+.3,.36,z-.028,'#9aaba1');
  }
  for(const [x,z] of [[-37.4,.8],[-34.5,1],[-30.8,.6],[-27.8,.2]]){
    box(.6,.08,.19,x,.35,z,'#baa27d');for(const dx of [-.22,.22])box(.045,.25,.12,x+dx,.19,z,dark);
  }
  // Embarcadero Plaza: the historic brick room at the foot of Market Street.
  const plaza=sfMap.parks.find(p=>p.name==='Embarcadero Plaza')!;
  for(let x=-7.5;x<7.2;x+=.32)for(let z=-11.1;z<-5.3;z+=.32){
    if(![[-.15,-.15],[.15,-.15],[-.15,.15],[.15,.15]].every(([dx,dz])=>insidePier(x+dx,z+dz,plaza.p)))continue;
    const i=Math.round(x/.32),j=Math.round(z/.32);
    box(.303,.018,.303,x,.13,z,['#b5866d','#b88a70','#b1836b','#bb8e73'][Math.abs(i*7+j*3)%4]);
  }
  // Broad stepped terraces, with open routes through the centre.
  for(const [x,z,w] of [[-4.1,-7.75,4.4],[3.9,-9.7,3.8]])for(let step=0;step<3;step++)box(w,.08,.23,x,.17+step*.075,z-step*.23,'#c9b69a');
  for(const [x,z] of [[-6.7,-7],[-4.8,-8.25],[-2.1,-9.9],[1.1,-10.1],[5.9,-9.4],[6,-6.3]]){
    box(.75,.18,.75,x,.2,z,'#b9a886');tree(x,z,.34);
    for(const side of [-1,1]){box(.78,.06,.16,x,.34,z+side*.48,'#987650');for(const dx of [-.3,.3])box(.04,.2,.13,x+dx,.22,z+side*.48,dark);}
  }
  // Vaillancourt's sculptural concrete tubes, shown in the plaza's familiar historic arrangement.
  const fountain=new THREE.Group();fountain.position.set(4.65,.14,-8.12);root.add(fountain);
  box(2.3,.14,1.55,0,.025,0,'#a99f89',fountain);box(2.05,.018,1.3,0,.108,0,'#719b99',fountain);
  for(const [x,z,h,turn] of [[-.78,-.2,.95,1],[-.38,.3,.65,-1],[.1,-.3,1.2,1],[.53,.22,.80,-1],[.85,-.2,.55,-1]]){
    box(.24,h,.25,x,h/2+.13,z,'#c6bdaa',fountain);
    const elbow=box(.68,.24,.25,x+turn*.15,h+.10,z,'#c6bdaa',fountain);elbow.rotation.z=turn*.48;
    box(.016,.15,.16,x+turn*.426,h+.10,z,'#59615a',fountain);
    box(.13,.34,.13,x+turn*.39,h-.11,z,'#b8d2c5',fountain);
  }
  // Circular seating at the north end and the black/white La Chiffonniere silhouette.
  for(let tier=0;tier<3;tier++){
    const ring=mesh(new THREE.TorusGeometry(.69-tier*.10,.055,6,28,Math.PI*1.5),'#d1b999',6.12,.18+tier*.07,-7.72);ring.rotation.x=Math.PI/2;
  }
  const art=new THREE.Group();art.position.set(1.068,.14,-10.438);root.add(art);
  for(const [x,y,a] of [[0,.23,.2],[.10,.55,-.3],[-.04,.86,.28]]){
    const form=box(.32,.44,.10,x,y,0,'#efe6cd',art);form.rotation.z=a;
    for(const dx of [-.1,.02]){const stripe=box(.018,.38,.018,x+dx,y,.065,'#42565a',art);stripe.rotation.z=a;}
  }
  for(let i=0;i<16;i++){
    const x=-6.4+(i%8)*1.55,z=i<8?-6.8:-9.1;
    if(insidePier(x,z,plaza.p)&&Math.hypot(x-4.65,z+8.12)>1.5)residentPositions.push({x,z,y:.14});
  }
  // Small groups linger on the lawn and along the promenade.
  for(let i=0;i<12;i++){
    const x=-36.2+(i%6)*1.52,z=i<6?.1:-.65;
    residentPositions.push({x,z,y:.18});
  }
  // Glazed restaurant pavilions and terraces at the southern end of the park.
  for(const id of [188401113,188401115]){
    const pavilion=mappedBuildings.find(b=>b.id===id)!;const [cx,cz]=center(pavilion.p);
    const cap=pavilion.p.map(([x,z])=>[cx+(x-cx)*1.025,cz+(z-cz)*1.025]);
    mesh(footprintGeometry(cap,.06),'#b2b9ad',0,pavilion.h+.025,0);
    for(let e=1;e<pavilion.p.length;e++){
      const [ax,az]=pavilion.p[e-1],[bx,bz]=pavilion.p[e],len=Math.hypot(bx-ax,bz-az);if(len<.4)continue;
      let nx=(bz-az)/len,nz=-(bx-ax)/len;if(nx*((ax+bx)/2-cx)+nz*((az+bz)/2-cz)<0){nx=-nx;nz=-nz;}
      const face=new THREE.Group();face.position.set((ax+bx)/2,0,(az+bz)/2);face.rotation.y=Math.atan2(nx,nz);root.add(face);
      box(len-.04,pavilion.h*.7,.04,0,pavilion.h*.5,.045,'#52757a',face);
      for(let x=-len/2+.04;x<len/2;x+=.23)box(.024,pavilion.h*.78,.08,x,pavilion.h*.5,.075,'#d1c9b5',face);
    }
    for(let i=0;i<4;i++){
      const x=cx-.7+i*.47,z=cz+.8;
      mesh(new THREE.CylinderGeometry(.11,.11,.025,12),'#c8b898',x,.24,z);
      pole(new THREE.Vector3(x,.04,z),new THREE.Vector3(x,.24,z),.018,dark);
      for(const dx of [-.16,.16])box(.09,.04,.1,x+dx,.17,z,'#8b9b83');
      if(i%2===0){mesh(new THREE.ConeGeometry(.28,.09,8),'#e0d1b1',x,.7,z);pole(new THREE.Vector3(x,.1,z),new THREE.Vector3(x,.7,z),.014,dark);}
    }
  }
  // The long lamp-lined Pier 7 and slender Pier 14 retain their mapped footprints.
  for(const x of [27.12,27.46]){
    box(.025,.04,13.3,x,.58,6.4,'#d9d4bc');
    for(let z=.1;z<13.5;z+=.6)box(.023,.57,.023,x,.29,z,'#8c9d98');
    for(let z=1;z<14;z+=1.8){pole(new THREE.Vector3(x,.1,z),new THREE.Vector3(x,1.22,z),.019,dark);mesh(new THREE.SphereGeometry(.065,6,4),cream,x,1.29,z);}
  }
  for(const x of [-17.17,-17.44]){
    box(.02,.03,11.5,x,.55,5.65,'#7b9299');
    for(let z=.2;z<11.5;z+=.5)box(.018,.55,.018,x,.275,z,'#7b9299');
  }
  // Ferry Plaza: finer paving courses, furnishings and the waterside boarding apron.
  for(let x=-6.7;x<7;x+=.42)for(let z=-3.05;z<-1.9;z+=.32)box(.405,.012,.305,x,.071,z,(Math.round(x*100)+Math.round(z*100))%3?'#c8bda6':'#d8cfba');
  for(let x=-7;x<7.1;x+=.32)box(.31,.016,.9,x,.085,1.75,'#d0c6ae');
  for(const x of [-6.6,-3.5,3.5,6.4]){
    box(.85,.24,.34,x,.18,-2.1,'#bbac8d');
    for(let i=0;i<6;i++)mesh(new THREE.IcosahedronGeometry(.1,1),'#829676',x-.32+i*.13,.36,-2.1);
    box(.8,.04,.19,x,.25,-2.45,'#9b896d');
    for(const dx of [-.3,.3])box(.025,.2,.19,x+dx,.13,-2.45,dark);
  }
  for(let x=-7;x<8;x+=.7){mesh(new THREE.CylinderGeometry(.025,.033,.25,7),dark,x,.15,-1.88);mesh(new THREE.SphereGeometry(.034,6,4),'#c6bd9f',x,.28,-1.88);}
  for(const x of [-5.8,-4.9,4.6,5.5]){
    const rack=mesh(new THREE.TorusGeometry(.11,.012,4,12,Math.PI),dark,x,.14,-2.7);rack.rotation.y=Math.PI/2;
    for(const dz of [-.11,.11])box(.02,.14,.02,x,.07,-2.7+dz,dark);
  }
  for(let x=-6;x<7;x+=2.4){pole(new THREE.Vector3(x,.08,1.98),new THREE.Vector3(x,1.05,1.98),.017,dark);mesh(new THREE.SphereGeometry(.047,7,5),cream,x,1.1,1.98);}
  // A continuous piled promenade joins the South Basin gates to the shore.
  box(8.9,.22,1.05,-11.2,-.035,4.50,'#cec6ad');
  for(const x of [-15.2,-11.7,-7.3]){
    box(.82,.20,1.78,x,-.025,3.075,'#d3cab4');
    for(let z=1.2;z<4.8;z+=.85){pile(x-.28,z);pile(x+.28,z);box(.82,.12,.1,x,-.18,z,'#b2b7a7');}
  }
  for(let x=-15.4;x<-6.9;x+=.85){pile(x,4.15);pile(x,4.8);}
  for(let x=-15.5;x<-6.8;x+=.34)box(.014,.013,.95,x,.083,4.48,'#b8b29e');
  // Gangway structure is deliberately separate from the floating boarding pontoons.
  function gangway(ax:number,az:number,bx:number,bz:number,width=.40){
    const start=new THREE.Vector3(ax,.12,az),end=new THREE.Vector3(bx,.095,bz),delta=end.clone().sub(start),length=delta.length();
    const g=new THREE.Group();g.position.copy(start).add(end).multiplyScalar(.5);g.rotation.y=Math.atan2(delta.x,delta.z);root.add(g);
    box(width,.08,length,0,-.045,0,'#c4cac0',g);
    for(const side of [-1,1]){
      box(.04,.10,length,side*width/2,-.07,0,'#6e9198',g);
      for(const y of [.21,.43])box(.016,.016,length,side*width/2,y,0,'#8fa4a0',g);
      for(let z=-length/2;z<length/2;z+=.23){box(.015,.43,.015,side*width/2,.21,z,'#849996',g);}
    }
    for(let z=-length/2;z<length/2;z+=.055)box(width-.05,.009,.012,0,.005,z,'#9eaba4',g);
  }
  const ferryConnections=[{gate:'E',x:-8.2,az:4.85,bx:-8.2,bz:5.25},{gate:'F',x:-11.2,az:4.85,bx:-11.2,bz:5.2},{gate:'G',x:-14.2,az:4.85,bx:-14.2,bz:5.2},{gate:'B',x:6.2,az:2.55,bx:6.2,bz:4.7},{gate:'C',x:-1,az:2.3,bx:-1,bz:4.85},{gate:'D',x:-.8,az:5,bx:-1.65,bz:8.35}];
  for(const entry of ferryConnections){
    gangway(entry.x,entry.az,entry.bx,entry.bz);
    const y=.12;
    for(const dx of [-.28,.28])box(.027,.78,.027,entry.x+dx,y+.39,entry.az,'#66888d');
    box(.64,.12,.04,entry.x,y+.81,entry.az,'#35616a');
    lettering(entry.gate,.085,entry.x,y+.775,entry.az+.028,'#f0e4bd');
  }
  // Use the mapped ferry gate outlines for handrails, fenders and boarding thresholds.
  for(const pier of sfMap.piers.filter(p=>p.name.startsWith('Ferry Building Gate'))){
    const minZ=Math.min(...pier.p.map(p=>p[1])),maxZ=Math.max(...pier.p.map(p=>p[1]));
    for(let e=1;e<pier.p.length;e++){
      const [ax,az]=pier.p[e-1],[bx,bz]=pier.p[e],len=Math.hypot(bx-ax,bz-az);
      if(len<.4||Math.abs(az-bz)<.12&&((az+bz)/2<minZ+.2||(az+bz)/2>maxZ-.2))continue;
      pole(new THREE.Vector3(ax,.38,az),new THREE.Vector3(bx,.38,bz),.009,'#718e91');
      for(let t=0;t<=len;t+=.25){const x=ax+(bx-ax)*t/len,z=az+(bz-az)*t/len;box(.016,.38,.016,x,.19,z,'#849a98');}
    }
    const [cx,cz]=center(pier.p);
    // A deep floating hull reaches the water; guide piles locate it laterally.
    const hullOutline=pier.p.map(([x,z])=>[cx+(x-cx)*.94,cz+(z-cz)*.985]);
    mesh(footprintGeometry(hullOutline,.815),'#607b80',0,-.95,0);
    box(.4,.025,.22,cx,.085,cz,'#dcc678');
    for(const side of [-1,1])for(const fraction of [.2,.52,.82]){
      const z=minZ+(maxZ-minZ)*fraction,x=cx+side*.30;
      mesh(new THREE.CylinderGeometry(.045,.053,1.7,8),'#466776',x,-.45,z);
      mesh(new THREE.CylinderGeometry(.072,.072,.075,8),'#a5ada1',x,.26,z);
      box(.045,.13,.16,x-side*.035,-.2,z,'#283f45');
    }
    for(const side of [-1,1]){
      mesh(new THREE.TorusGeometry(.062,.02,5,12),'#2f4444',cx+side*.34,-.27,maxZ-.2).rotation.y=side*Math.PI/2;
      box(.1,.055,.04,cx+side*.22,.11,maxZ-.15,'#48616a');
    }
    for(const dx of [-.29,.29])mesh(new THREE.CylinderGeometry(.045,.05,.85,7),dark,cx+dx,-.16,cz+.3);
  }
  for(let i=0;i<18;i++){
    const x=-6.1+i*.7,z=(i%2?1.65:-2.78)+Math.sin(i*2.7)*.12;
    residentPositions.push({x,z,y:.07});
  }
  // Buckyball at the Exploratorium, north along the Embarcadero.
  const bucky=mesh(new THREE.IcosahedronGeometry(.58,0),'#bc985d',47.26,.9,.07);bucky.material=material('#bc985d');bucky.material.wireframe=true;
  for(let x=-39;x<40;x+=2.8){
    const z=x< -20?-2.1:x<0?-1.7:-1.9;
    pole(new THREE.Vector3(x,0,z),new THREE.Vector3(x,1.5,z),.025,dark);
    mesh(new THREE.SphereGeometry(.075,6,4),cream,x,1.56,z);
  }
  const streetcar=createStreetcar(),tram=streetcar.group;root.add(tram);
  // Rails and contact wire share the exact same centerline as the vehicle.
  const railPath=Array.from({length:261},(_,i)=>{const p=streetcarPose(-65+i*.5);return [p.x,p.z];});
  for(const side of [-1,1])linePath(railPath.map(([x,z])=>[x,z+side*.115]),.012,.078,'#a1aca3');
  for(let i=1;i<railPath.length;i++){const [x,z]=railPath[i],[px,pz]=railPath[i-1];pole(new THREE.Vector3(px,1.035,pz),new THREE.Vector3(x,1.035,z),.0035,'#52675f');}
  for(let x=-62;x<64;x+=6){const p=streetcarPose(x);pole(new THREE.Vector3(x,.02,p.z-.38),new THREE.Vector3(x,1.17,p.z-.38),.009,dark);pole(new THREE.Vector3(x,1.14,p.z-.38),new THREE.Vector3(x,1.035,p.z),.005,dark);}
  // Dorado-class proportions: twin slender blue hulls, green shear stripe,
  // continuous dark glazing, white wheelhouse and open aft passenger deck.
  function ferry(scale:number){
    const g=new THREE.Group();root.add(g);g.scale.setScalar(scale);
    for(const z of [-.63,.63]){
      const hull=new THREE.Shape();hull.moveTo(-2.5,-.24);hull.lineTo(1.9,-.24);hull.lineTo(2.9,0);hull.lineTo(1.9,.24);hull.lineTo(-2.5,.24);hull.closePath();
      mesh(new THREE.ExtrudeGeometry(hull,{depth:.55,bevelEnabled:false}),'#16416b',0,-.13,z,g).rotation.x=-Math.PI/2;
      box(4.9,.16,.48,-.08,.36,z,'#308471',g);
    }
    box(4.8,.22,1.67,-.05,.58,0,cream,g);
    box(3.9,.68,1.5,.35,1.01,0,cream,g);
    for(const z of [-.762,.762]){
      box(3.6,.39,.035,.45,1.11,z,'#274451',g);
      for(let x=-1.25;x<2.2;x+=.42)box(.05,.43,.065,x,1.11,z,cream,g);
      box(4.35,.09,.04,.08,.78,z,'#297a74',g);
    }
    // Sloping forward glass and a higher bridge cabin.
    box(.07,.45,1.39,2.34,1.14,0,dark,g).rotation.z=-.22;
    box(4.8,.12,1.78,-.05,1.42,0,cream,g);
    box(1.8,.54,1.3,1.12,1.72,0,cream,g);
    box(1.65,.31,.035,1.12,1.78,.66,dark,g);box(1.65,.31,.035,1.12,1.78,-.66,dark,g);
    box(.055,.31,1.2,2.05,1.78,0,dark,g).rotation.z=-.2;
    box(2.15,.12,1.56,1.04,2.04,0,cream,g);
    for(const z of [-.84,.84]){
      box(2.6,.035,.035,-1.05,1.9,z,cream,g);
      for(let x=-2.35;x<.3;x+=.32)box(.025,.43,.025,x,1.69,z,cream,g);
      for(const x of [-1.6,-.5])mesh(new THREE.TorusGeometry(.115,.035,5,12),'#d87536',x,1.69,z*1.03,g);
    }
    for(let x=-2.1;x<.2;x+=.42)for(const z of [-.45,.45]){box(.23,.12,.32,x,1.57,z,'#608791',g);box(.05,.24,.32,x-.13,1.72,z,'#608791',g);}
    for(const z of [-.44,.44]){box(.24,.54,.2,-.25,1.94,z,'#16416b',g);box(.26,.12,.23,-.25,2.23,z,dark,g);}
    pole(new THREE.Vector3(1.1,2.05,0),new THREE.Vector3(1.1,2.86,0),.032,cream,g);
    box(.7,.065,.12,1.1,2.65,0,cream,g);box(.32,.12,.25,.6,2.2,0,cream,g);
    for(const z of [-.7,.7])pole(new THREE.Vector3(-2.6,.02,z),new THREE.Vector3(-7,.02,z*2.5),.027,'#e3ece2',g);
    return g;
  }
  const ferries=[ferry(.68),ferry(.58)];
  // Market stalls, cafe tables and cyclists create a lived-in promenade.
  const marketStart=new Set(root.children);
  for(const x of [-4,-2,0,2,4]){
    box(1.5,.7,.75,x,.6,.15,'#9d896a');
    for(let stripe=0;stripe<7;stripe++){const xx=x-.95+(stripe+.5)*1.9/7;gable(1.9/7,.4,1.35,xx,2,.15,stripe%2?cream:(x%2?'#cb724b':'#5c9279'));box(1.9/7,.13,.08,xx,1.96,.86,stripe%2?cream:(x%2?'#cb724b':'#5c9279'));}
    for(const dx of [-.8,.8])pole(new THREE.Vector3(x+dx,.1,.15),new THREE.Vector3(x+dx,2,.15),.035,dark);
    for(let i=0;i<5;i++)mesh(new THREE.SphereGeometry(.095,6,4),i%2?'#bc7246':'#92975d',x-.5+i*.24,1,.2);
  }
  const market=new THREE.Group();root.add(market);
  root.children.filter(o=>o!==market&&!marketStart.has(o)).forEach(o=>market.attach(o));
  market.scale.setScalar(.4);market.position.set(0,0,1.7);
  for(const x of [-24,-21,31,34]){
    // Human-scale waterfront benches replace the oversized cafe furniture.
    for(let slat=0;slat<4;slat++)box(.65,.025,.045,x,.2,-.65+slat*.055,'#9e8966');
    for(const dx of [-.25,.25])box(.025,.2,.23,x+dx,.1,-.56,dark);
    box(.65,.17,.03,x,.3,-.69,'#aa9877');
  }
  // A swimming sea lion beside Pier 7.
  const seaLion=new THREE.Group();seaLion.position.set(24,-.6,8);seaLion.scale.setScalar(.65);seaLion.rotation.y=-.35;root.add(seaLion);
  const sealBody=mesh(new THREE.SphereGeometry(.42,10,7),'#786148',0,.15,0,seaLion);sealBody.scale.set(2.2,.75,.82);
  const sealNeck=mesh(new THREE.SphereGeometry(.3,9,6),'#786148',.7,.2,0,seaLion);sealNeck.scale.set(.9,.7,.8);
  mesh(new THREE.SphereGeometry(.30,12,9),'#98704f',.94,.3,0,seaLion);
  mesh(new THREE.SphereGeometry(.04,5,4),dark,1.15,.27,0,seaLion);
  for(const z of [-.17,.17])mesh(new THREE.SphereGeometry(.025,5,4),dark,1.08,.37,z,seaLion);
  const sealFlippers:THREE.Mesh[]=[];
  for(const side of [-1,1]){const flipper=mesh(new THREE.SphereGeometry(.2,7,5),'#786148',-.15,-.02,side*.4,seaLion);flipper.scale.set(1.5,.18,.55);flipper.rotation.y=side*.4;sealFlippers.push(flipper);}
  const people=createPeople(22+residentPositions.length);
  residentPositions.forEach((p,i)=>people.update(22+i,p.x,p.z,0,i%2?1:-1,p.y));people.flush();const pedestrians=people.group;root.add(pedestrians);
  const walkers=people.bodies,walkerHeads=people.heads;
  const streetCars=new THREE.Group();root.add(streetCars);
  const traffic=Array.from({length:10},(_,i)=>{
    const g=new THREE.Group();streetCars.add(g);
    mesh(new RoundedBoxGeometry(1.15,.34,.59,3,.11),['#cb704c','#e9c968','#5d9ba1','#af83a3','#b4bfa0'][i%5],0,.32,0,g);
    mesh(new RoundedBoxGeometry(.67,.29,.51,3,.09),'#547982',-.06,.58,0,g);
    box(.025,.026,.52,.28,.59,0,cream,g);
    for(const z of [-.18,.18])mesh(new THREE.SphereGeometry(.055,8,6),'#ffe3a1',.557,.34,z,g);
    for(const x of [-.36,.36])for(const z of [-.3,.3])mesh(new THREE.CylinderGeometry(.14,.14,.06,7),dark,x,.2,z,g).rotation.x=Math.PI/2;
    return g;
  });
  const cyclists=Array.from({length:3},(_,i)=>{
    const g=new THREE.Group();root.add(g);
    for(const x of [-.4,.4])mesh(new THREE.TorusGeometry(.25,.025,5,14),dark,x,.3,0,g);
    const color=['#ce8650','#467f8a','#b65344'][i];
    for(const [ax,ay,bx,by] of [[-.4,.3,0,.3],[0,.3,-.14,.7],[-.14,.7,-.4,.3],[0,.3,.3,.68],[.3,.68,.4,.3],[-.14,.7,.3,.68]])pole(new THREE.Vector3(ax,ay,0),new THREE.Vector3(bx,by,0),.022,color,g);
    box(.21,.06,.1,-.14,.77,0,dark,g);pole(new THREE.Vector3(.3,.65,0),new THREE.Vector3(.27,.88,0),.025,dark,g);
    pole(new THREE.Vector3(-.12,.82,0),new THREE.Vector3(.08,1.17,0),.09,color,g);
    mesh(new THREE.SphereGeometry(.115,6,5),'#bd9670',.14,1.3,0,g);
    pole(new THREE.Vector3(-.12,.83,0),new THREE.Vector3(.13,.52,.05),.04,dark,g);
    pole(new THREE.Vector3(.08,1.1,0),new THREE.Vector3(.27,.85,0),.035,'#bd9670',g);
    return g;
  });
  const gulls=new THREE.Group();root.add(gulls);
  const birds=Array.from({length:7},()=>{
    const bird=new THREE.Group();gulls.add(bird);
    const body=mesh(new THREE.SphereGeometry(.15,9,7),cream,0,0,0,bird);body.scale.set(2.1,.8,1);
    const wings=[-1,1].map(side=>{
      const wing=new THREE.Group();bird.add(wing);
      const shape=new THREE.Shape();shape.moveTo(-.12,0);shape.lineTo(.07,side*.34);shape.lineTo(-.22,side*.87);shape.lineTo(-.37,side*.38);shape.closePath();
      const feather=mesh(new THREE.ShapeGeometry(shape),cream,0,0,0,wing);feather.rotation.x=-Math.PI/2;feather.material=material('#f1eee2');feather.material.side=THREE.DoubleSide;
      return wing;
    });
    mesh(new THREE.ConeGeometry(.045,.18,5),'#c9954a',.28,0,0,bird).rotation.z=-Math.PI/2;
    return {group:bird,wings};
  });
  // Instanced windows keep the detailed city inexpensive to draw.
  const windowMaterial=new THREE.MeshStandardMaterial({color:'#597b85',roughness:.8,emissive:'#e4c89a',emissiveIntensity:0,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  applyWindowLighting(windowMaterial);
  const windowGeometry=new THREE.PlaneGeometry(1,1);
  windowGeometry.setAttribute('windowGlow',new THREE.InstancedBufferAttribute(new Float32Array(windowPositions.map(windowGlow)),1));
  const windowMesh=new THREE.InstancedMesh(windowGeometry,windowMaterial,windowPositions.length);
  const dummy=new THREE.Object3D();
  windowPositions.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.ry,0);dummy.scale.set(p.w,p.h,1);dummy.updateMatrix();windowMesh.setMatrixAt(i,dummy.matrix);windowMesh.setColorAt(i,new THREE.Color().setScalar((Math.sin(i*12.9898)*43758.5453)%1>.0?1:.72));});root.add(windowMesh);
  const ripples=new THREE.Group();root.add(ripples);
  const rippleMaterial=new THREE.MeshBasicMaterial({color:'#d6e8e5',transparent:true,opacity:.5});
  for(let i=0;i<75;i++){
    const wave=new THREE.Mesh(new THREE.PlaneGeometry(.5+(i%5)*.34,.035),rippleMaterial);wave.rotation.x=-Math.PI/2;
    wave.position.set(Math.sin(i*31.3)*54,-.68,4+(i*7.13)%38);ripples.add(wave);
  }
  const fireboat=createFireboat();root.add(fireboat.root);
  // Merge static architecture by material. Detail increases without thousands of draw calls.
  root.updateMatrixWorld(true);
  const moving=new Set<THREE.Object3D>([fireboat.root,coffeeLetters,bucky,water,windowMesh,ripples,tram,gulls,pedestrians,streetCars,seaLion,...cyclists,...ferries,...cars,...clockHands.flatMap(h=>[h.minute,h.hour])]);
  const chunks=new Map<string,THREE.BufferGeometry[]>(),staticMeshes:THREE.Mesh[]=[];
  root.traverse(o=>{
    if(!(o instanceof THREE.Mesh)||o instanceof THREE.InstancedMesh)return;
    let p:THREE.Object3D|null=o;while(p){if(moving.has(p))return;p=p.parent;}
    const mat=o.material as THREE.MeshStandardMaterial;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);
    const colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=mat.color.r;colors[i+1]=mat.color.g;colors[i+2]=mat.color.b;}
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));
    g.computeBoundingBox();const mid=g.boundingBox!.getCenter(new THREE.Vector3());
    const key=`${Math.floor(mid.x/24)},${Math.floor(mid.z/24)}`;
    const chunk=chunks.get(key)||[];chunk.push(g);chunks.set(key,chunk);staticMeshes.push(o);
  });
  const architectureMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:.02,side:THREE.FrontSide});
  const architectureChunks:THREE.Mesh[]=[];
  for(const [key,geometries] of chunks){
    const merged=mergeGeometries(geometries);if(!merged)throw new Error('Architecture merge failed');
    // Preserve hard edges and vertex colors while sharing repeated triangle vertices.
    const geometry=mergeVertices(merged,1e-5);merged.dispose();geometries.forEach(g=>g.dispose());
    geometry.computeBoundingSphere();geometry.computeBoundingBox();
    const chunk=new THREE.Mesh(geometry,architectureMaterial);chunk.name=`City block ${key}`;chunk.castShadow=true;chunk.receiveShadow=true;root.add(chunk);architectureChunks.push(chunk);
  }
  staticMeshes.forEach(o=>{o.parent?.remove(o);o.geometry.dispose();});
  // Keep each moving object intact while batching its own small components.
  for(const group of [tram,ripples,...ferries,...traffic,...cyclists]) {
    group.updateMatrixWorld(true);
    const inverse=new THREE.Matrix4().copy(group.matrixWorld).invert();
    const trafficMaterial=traffic.includes(group)?new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75}):null;
    const batches=new Map<THREE.Material,{geometries:THREE.BufferGeometry[];objects:THREE.Mesh[]}>();
    group.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;
      const sourceMaterial=o.material as THREE.MeshStandardMaterial,mat=trafficMaterial||sourceMaterial,batch=batches.get(mat)||{geometries:[],objects:[]};
      const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
      if(trafficMaterial){const colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=sourceMaterial.color.r;colors[i+1]=sourceMaterial.color.g;colors[i+2]=sourceMaterial.color.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));}
      batch.geometries.push(g);batch.objects.push(o);batches.set(mat,batch);
    });
    batches.forEach((batch,mat)=>{
      const g=mergeGeometries(batch.geometries);if(!g)throw new Error('Moving object merge failed');
      batch.objects.forEach(o=>{o.parent?.remove(o);o.geometry.dispose();});batch.geometries.forEach(g=>g.dispose());
      const m=new THREE.Mesh(g,mat);m.castShadow=group!==ripples;m.receiveShadow=true;group.add(m);
    });
  }
  // Local atmospheric falloff conceals the finite northern map boundary.
  // Applied equally to buildings, lamps and window instances, in world coordinates.
  const edgeFogColor={value:new THREE.Color('#d6e4e6')};
  const hazeMaterials=new Set<THREE.MeshStandardMaterial|THREE.MeshBasicMaterial>([architectureMaterial,windowMaterial,waterMaterial]);
  root.traverse(o=>{if(o instanceof THREE.Mesh){for(const mat of Array.isArray(o.material)?o.material:[o.material])if(mat instanceof THREE.MeshStandardMaterial||mat instanceof THREE.MeshBasicMaterial)hazeMaterials.add(mat);}});
  for(const mat of hazeMaterials){
    const previousCompile=mat.onBeforeCompile;
    const previousCacheKey=mat.customProgramCacheKey();
    mat.onBeforeCompile=(shader,renderer)=>{
      previousCompile.call(mat,shader,renderer);
      shader.uniforms.edgeFogColor=edgeFogColor;
      shader.vertexShader='varying vec3 harborPosition;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec4 harborWorld=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          harborWorld=instanceMatrix*harborWorld;
        #endif
        harborPosition=(modelMatrix*harborWorld).xyz;`);
      shader.fragmentShader='uniform vec3 edgeFogColor; varying vec3 harborPosition;\n'+shader.fragmentShader.replace('#include <fog_fragment>',`#include <fog_fragment>
        float edgeHaze=max(smoothstep(37.0,66.0,harborPosition.x),smoothstep(75.0,125.0,-harborPosition.z));
        gl_FragColor.rgb=mix(gl_FragColor.rgb,edgeFogColor,edgeHaze);`);
    };
    mat.customProgramCacheKey=()=> `${previousCacheKey}|waterfront-edge-haze-v2`;
  }
  const hitTargets:THREE.Mesh[]=[];
  const hitMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
  for(const [name,x,y,z,w,h,d] of [['waterfront',0,2.2,0,16,4.7,3],['bridge',bridgePoint(0,36.85).x,4.8,bridgePoint(0,36.85).z,2.8,10,2.8],['pyramid',26.75,7.8,-40.4,3,16,3]] as const){
    const target=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),hitMaterial);target.position.set(x,y,z);target.userData.landmark=name;root.add(target);hitTargets.push(target);
  }
  const result={ root, fireboat:fireboat as ReturnType<typeof createFireboat>|undefined, architectureChunks, residentPositions, coffeeMaterial, ferryConnections, pierSupports, people, streetcarGlazing:streetcar.glazing, streetcarLamp:streetcar.lamp, bridgeLightMaterial, roadLightMaterial, edgeFogColor, waterMaterial, waterTime, windowMaterial, ferries, cars, tram, gulls, birds, walkers, walkerHeads, traffic, cyclists, seaLion, sealFlippers, ripples, hitTargets, clockHands, ferryBuilding };
  cityTemplate=result;
  return result;
}


// The page owns one city template. Vignettes reuse its geometry, never reconstruct it.
let cityTemplate:ReturnType<typeof createLandscape>|undefined;
export function createCityVignette(variant:'street'|'plaza'):ReturnType<typeof createLandscape>{
  const source=cityTemplate||createLandscape(),root=new THREE.Group();
  const bounds=variant==='street'?new THREE.Box3(new THREE.Vector3(-62,-5,-28),new THREE.Vector3(-15,40,14)):new THREE.Box3(new THREE.Vector3(-22,-5,-32),new THREE.Vector3(32,40,22));
  const materialCopies=new Map<THREE.Material,THREE.Material>();
  function copiedMaterial(mat:THREE.Material){
    let copy=materialCopies.get(mat);if(!copy){copy=mat.clone();copy.onBeforeCompile=mat.onBeforeCompile;copy.customProgramCacheKey=mat.customProgramCacheKey;materialCopies.set(mat,copy);}return copy;
  }
  function copyMesh(mesh:THREE.Mesh){const m=mesh.clone();m.geometry=mesh.geometry;m.userData.sharedGeometry=true;m.material=Array.isArray(mesh.material)?mesh.material.map(copiedMaterial):copiedMaterial(mesh.material);return m;}
  const architectureChunks=source.architectureChunks.filter(m=>m.geometry.boundingBox!.intersectsBox(bounds)).map(m=>{const copy=copyMesh(m);root.add(copy);return copy;});
  // Only window instances inside the vignette are copied to its renderer.
  const original=source.root.children.find(o=>o instanceof THREE.InstancedMesh&&o.material===source.windowMaterial) as THREE.InstancedMesh;
  const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),indices:number[]=[];
  for(let i=0;i<original.count;i++){original.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);if(bounds.containsPoint(point))indices.push(i);}
  const windowMaterial=copiedMaterial(source.windowMaterial) as THREE.MeshStandardMaterial;
  // The tiny plane is copied so the filtered instance attributes match the vignette.
  const windowGeometry=original.geometry.clone(),glow=original.geometry.getAttribute('windowGlow');
  windowGeometry.setAttribute('windowGlow',new THREE.InstancedBufferAttribute(new Float32Array(indices.map(i=>glow.getX(i))),1));
  const windows=new THREE.InstancedMesh(windowGeometry,windowMaterial,indices.length);
  indices.forEach((index,i)=>{original.getMatrixAt(index,matrix);windows.setMatrixAt(i,matrix);const color=new THREE.Color();original.getColorAt(index,color);windows.setColorAt(i,color);});root.add(windows);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(240,240,1,1),new THREE.MeshStandardMaterial({color:'#a5ccd1',roughness:.65,metalness:.1}));water.rotation.x=-Math.PI/2;water.position.y=-.7;water.receiveShadow=true;root.add(water);
  const residents=source.residentPositions.filter(p=>bounds.containsPoint(new THREE.Vector3(p.x,p.y,p.z)));
  const people=createPeople(22+residents.length);root.add(people.group);
  const tram=source.tram.clone();tram.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.sharedGeometry=true;o.material=Array.isArray(o.material)?o.material.map(copiedMaterial):copiedMaterial(o.material);}});root.add(tram);
  const traffic=source.traffic.slice(0,6).map(car=>{const copy=car.clone();copy.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.sharedGeometry=true;o.material=Array.isArray(o.material)?o.material.map(copiedMaterial):copiedMaterial(o.material);}});root.add(copy);return copy;});
  source.root.updateMatrixWorld(true);
  source.root.traverse(o=>{if(o instanceof THREE.Mesh&&o.material===source.coffeeMaterial&&variant==='street'){const copy=copyMesh(o);copy.matrix.copy(o.matrixWorld);copy.matrix.decompose(copy.position,copy.quaternion,copy.scale);root.add(copy);}});
  // Clock hands remain live in the plaza view while sharing the source geometry.
  const clockHands=variant==='plaza'?source.clockHands.map(({minute,hour,angle})=>{
    const parent=new THREE.Group();parent.matrix.copy(minute.parent!.matrixWorld);parent.matrix.decompose(parent.position,parent.quaternion,parent.scale);root.add(parent);
    const minuteCopy=copyMesh(minute),hourCopy=copyMesh(hour);parent.add(minuteCopy,hourCopy);return {minute:minuteCopy,hour:hourCopy,angle};
  }):[];
  return {...source,root,fireboat:undefined,architectureChunks,residentPositions:residents,people,walkers:people.bodies,walkerHeads:people.heads,waterMaterial:water.material,windowMaterial,tram,traffic,
    streetcarGlazing:copiedMaterial(source.streetcarGlazing) as THREE.MeshStandardMaterial,streetcarLamp:copiedMaterial(source.streetcarLamp) as THREE.MeshStandardMaterial,
    coffeeMaterial:copiedMaterial(source.coffeeMaterial) as THREE.MeshStandardMaterial,clockHands,ferries:[],cars:[],birds:[],cyclists:[],hitTargets:[],
    seaLion:new THREE.Group(),sealFlippers:[],ripples:new THREE.Group()};
}
