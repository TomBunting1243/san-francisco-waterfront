import {createBayRelief} from './bay-relief.ts';
import {createSouthBeach,southBeach} from './south-beach.ts';
import {hasShorelineFacade,shorelineFacade} from './shoreline-facades.ts';
import * as THREE from 'three';
import {streetPose,streetcarPose} from './streets.ts';
import {createStreetcar} from './streetcar.ts';
import {createPeople} from './people.ts';
import {bicycleScale,bicycleWheelBottom,rinconGround,rinconLawn,rinconLawnHeight,rinconApproach,rinconExit,routes,routeWidth,walkSurface,waterfrontCyclist,waterfrontWalker} from './waterfront-routes.ts';
import {harborBuilding,harborDiners,harborPublicPiers,ferryPortal} from './harbor-architecture.ts';
import {buildFerryTerminal,ferryConnections} from './ferry-terminal.ts';
import {ferryHall,ferryPublicRealm} from './ferry-architecture.ts';
import {cutPavingAtBasin} from './vaillancourt-plan.ts';
import {createRememberedWaterfront,fountainPavingCut} from './remembered-waterfront.ts';
import {bindFountainWaterClock,fountainWaterName} from './fountain-flow.ts';
import {createFireboat} from './fireboat.ts';
import {createDoradoFerry} from './dorado-ferry.ts';
import {createDaySailer} from './sailing.ts';
import {configureBayWater} from './bay-water.ts';
import {bakeBlocks} from './city-blocks.ts';
import {waterSurface} from './water-surface.ts';
import {buildingCharacter,modernBuildingAccents,characterBuildings,characterColors} from './building-character.ts';
import {hasNeighborhoodDetail,neighborhoodColor,neighborhoodDetail,refineNeighborhoodMassing} from './neighborhood-detail.ts';
import {waterfrontGardens} from './waterfront-gardens.ts';
import {waterfrontPalm,waterfrontTree} from './waterfront-trees.ts';
import {createStreetVehicle,streetVehicleMaterial} from './street-vehicles.ts';
import {architectureProfile,referenceColor,refineReferenceMassing,referenceArchitecture} from './reference-architecture.ts';
import {isMooredVessel,mooredVessel} from './moored-vessels.ts';
import {windowGlow,applyWindowLighting} from './window-lighting.ts';
import {waterfrontLandmark,detailedWaterfrontNames} from './waterfront-landmarks.ts';
import {bridgeLayout,bridgePoint} from './bridge-layout.ts';
import {buildApproachRoad} from './approach-road.ts';
import {buildApproachBlocks} from './approach-blocks.ts';
import {buildApproachBillboards} from './approach-billboards.ts';
import {addBridgeDeck,bridgeLaneCenters} from './bridge-deck.ts';
import {addBridgeAnchorages} from './bridge-anchorage.ts';
import {sfMap,mappedBuildings,footprintGeometry,center} from './sf-map.ts';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontData from './harbor-font.json' with { type: 'json' };
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** San Francisco waterfront footprints with selectively detailed landmark models. */
export function createLandscape() {
  const root = new THREE.Group();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const windowPositions: { x: number; y: number; z: number; ry: number; w: number; h: number }[] = [];
  const clockHands: { minute:THREE.Mesh; hour:THREE.Mesh; angle:number }[] = [];
  const residentPositions:{x:number;z:number;y:number}[]=[];
  const cream = '#ede4d3', dark = '#345564';
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
  function tree(x:number,z:number,s=1,ground=.08){
    waterfrontTree(mesh,x,ground,z,Math.round(x*113+z*439),s*3.58);
  }
  // Water and a long, softened waterfront. Nothing is a texture or image.
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#a5ccd1', roughness: .38, metalness: .15 });
  const waterTime = { value: 0 };
  const nightInk={value:0};
  const hullShadows=Array.from({length:4},()=>new THREE.Vector3(10000,10000,0));
  const bayHorizon=configureBayWater(waterMaterial,waterTime,hullShadows,nightInk);
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
  const mappedEdge=chain.length?chain:shore;
  const southEdge=southBeach.shoreline;
  // The surveyed South Beach chain joins the existing city at the first shared coast vertex.
  const joined=Math.hypot(southEdge.at(-1)![0]-mappedEdge[0][0],southEdge.at(-1)![1]-mappedEdge[0][1])<.003;
  const landEdge=joined?[...southEdge.slice(0,-1),...mappedEdge]:mappedEdge;
  const landPoints=joined?[...landEdge,[112,-114],[-174.16,-135]]:[...landEdge,[112,-114],[-100,-114]];
  mesh(footprintGeometry(landPoints,.72),'#b9bba9',0,-.73,0).name='Continuous mapped San Francisco shoreline';
  function linePath(points:number[][],width:number,y:number,color:string){
    for(let i=1;i<points.length;i++){
      const [ax,az]=points[i-1],[bx,bz]=points[i],length=Math.hypot(bx-ax,bz-az);
      if(length<.02)continue;
      const m=box(width,.028,length,(ax+bx)/2,y,(az+bz)/2,color);m.rotation.y=Math.atan2(bx-ax,bz-az);
    }
  }
  linePath(mappedEdge,1.1,.03,'#ddcfb7');
  if(joined)linePath(southEdge,.34,.027,'#c7bca6');
  [...sfMap.roads,...southBeach.roads].forEach(road=>{
    const width=road.name.includes('Embarcadero')?1.02:road.name==='Market Street'?1.45:road.kind==='primary'?.8:.48;
    linePath(road.p,width,.04,'#889b9a');
    if(road.name.includes('Embarcadero'))linePath(road.p,.027,.062,'#d4d3ba');
  });
  sfMap.parks.forEach(park=>{if(park.p.length>3)mesh(footprintGeometry(park.p,.07),park.name==='Rincon Park'?'#c2bfa8':park.name==='Embarcadero Plaza'?'#b7896f':'#89a66c',0,.04,0);});
  sfMap.piers.filter(p=>p.closed&&!p.name.startsWith('Ferry Building Gate')).forEach(pier=>mesh(footprintGeometry(pier.p,.18),pier.name==='Pier 7'?'#b5a27e':'#ccd0c3',0,-.12,0));
  const southernWaterfront=createSouthBeach(font,waterTime);
  root.add(southernWaterfront.root);
  windowPositions.push(...southernWaterfront.windows);
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
  const detailedBuildings=refineReferenceMassing(refineNeighborhoodMassing([...mappedBuildings.filter(b=>![1487160485,1487160486,1487160487].includes(b.id)),hillsWing]));
  const neighborhood=neighborhoodDetail(detailedBuildings);root.add(neighborhood.root);windowPositions.push(...neighborhood.windows);
  const gardens=waterfrontGardens(detailedBuildings);root.add(gardens.root);
  [...detailedBuildings,...harborDiners.filter(diner=>!detailedBuildings.some(b=>b.id===diner.id))].forEach(b=>{
    if(['Transamerica Pyramid','Salesforce Tower','San Francisco Ferry Building'].includes(b.name))return;
    if(isMooredVessel(b)){
      if(!b.parent){const detail=mooredVessel(b,font);root.add(detail.root);windowPositions.push(...detail.windows);}
      return;
    }
    const harbor=harborBuilding(b,font);
    if(harbor){root.add(harbor.root);windowPositions.push(...harbor.windows);return;}
    const [cx,cz]=center(b.p),h=b.h,minH=b.minH||0;
    const family=b.parent||b.id,reference=architectureProfile(b);
    const ribbed=b.name.includes('Embarcadero Center')||['Spear Tower','Steuart Tower'].includes(b.name);
    const hotel=b.name.includes('Hyatt Regency');
    const historic=['Southern Pacific Building','The Audiffred Building','Ferry Station Post Office Building','Pier 1'].includes(b.name);
    const color=hasNeighborhoodDetail(b)?neighborhoodColor(b):referenceColor(b)??characterColors[b.name]??(b.name==='Southern Pacific Building'?'#ad765d':b.name==='The Audiffred Building'?'#b57e62':historic?'#d3c4a9':ribbed||hotel?'#d4cdb9':b.id===28240176?'#66828b':h>8?['#8ba8af','#7496a5','#b3bbb6','#a8b4b3'][family%4]:['#e1c193','#caab95','#d3ccac','#9fbab0','#cf9e87'][family%5]);
    if(!reference&&hasShorelineFacade(b)){
      const detail=shorelineFacade(b,detailedBuildings,color);root.add(detail.root);windowPositions.push(...detail.windows);return;
    }
    mesh(footprintGeometry(b.p,h-minH),color,0,minH,0);
    // Polygon-aligned windows follow each actual facade, with floors scaled in metres.
    if(h>.9&&(cz>-64||h>3)&&!reference&&!hasNeighborhoodDetail(b)&&!detailedWaterfrontNames.has(b.name)&&!characterBuildings.has(b.name))for(let edge=1;edge<b.p.length;edge++){
      const [ax,az]=b.p[edge-1],[bx,bz]=b.p[edge],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
      if(len<.45)continue;
      const midx=(ax+bx)/2,midz=(az+bz)/2;let nx=dz/len,nz=-dx/len;
      if(nx*(midx-cx)+nz*(midz-cz)<0){nx=-nx;nz=-nz;}
      const backdrop=cz<=-64,distant=cz< -38||cx>38||cx< -65;
      const step=backdrop?1.05:distant?.85:h>8?.42:.48;
      for(let f=minH+.4;f<h-.25;f+=step)for(let d=.28;d<len-.2;d+=backdrop?1:distant?.8:.4){
        windowPositions.push({x:ax+dx*d/len+nx*.045,y:f,z:az+dz*d/len+nz*.045,ry:Math.atan2(nx,nz),w:backdrop?.52:h>8?.24:.16,h:backdrop?.32:.23});
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
    // Shallow cornices and inset roof plant give anonymous mid-rise blocks a skyline
    // at this scale. Named landmarks and separately mapped building parts keep their own roofs.
    if(!b.name&&!b.part&&!b.parent&&h>3&&h<14&&b.p.length<=7&&cz> -70){
      const inset=b.p.map(([x,z])=>[cx+(x-cx)*.94,cz+(z-cz)*.94]);
      mesh(footprintGeometry(inset,.072),'#9da8a1',0,h,0);
      if(b.id%3===0&&b.p.length===5){
        const plant=b.p.map(([x,z])=>[cx+(x-cx)*.36,cz+(z-cz)*.36]);
        mesh(footprintGeometry(plant,.17),'#a2a79b',0,h+.067,0);
      }
      if(b.id%2===0){
        for(let e=1;e<b.p.length;e++){
          const [ax,az]=b.p[e-1],[bx,bz]=b.p[e],len=Math.hypot(bx-ax,bz-az);
          if(len<.24)continue;
          const rim=box(.065,.07,len,(ax+bx)/2,h-.13,(az+bz)/2,'#c3c4b2');rim.rotation.y=Math.atan2(bx-ax,bz-az);
        }
      }
    }
    // Structural details follow each real facade edge, including stepped building parts.
    if(ribbed||hotel||b.id===28240176||b.id===667097308){
      for(let e=1;e<b.p.length;e++){
        const [ax,az]=b.p[e-1],[bx,bz]=b.p[e],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
        if(len<.18)continue;
        let nx=dz/len,nz=-dx/len;
        if(nx*((ax+bx)/2-cx)+nz*((az+bz)/2-cz)<0){nx=-nx;nz=-nz;}
        const point=(t:number,y:number)=>new THREE.Vector3(ax+dx*t+nx*.07,y,az+dz*t+nz*.07);
        if(ribbed&&!reference)for(let d=.1;d<len;d+=.22) pole(point(d/len,minH+.04),point(d/len,h+.03),.026,'#e5dfca');
        if(hotel)for(let y=minH+.2;y<h+.04;y+=.21) pole(point(0,y),point(1,y),.037,'#e5dece');
        if(b.id===28240176){
          const bay=Math.ceil(len/1.8),floor=2.40;
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
  const transamerica=mappedBuildings.find(b=>b.name==='Transamerica Pyramid')!;
  const [cornerA,cornerB]=transamerica.p,opposite=transamerica.p.at(-2)!;
  const tx=(cornerB[0]+opposite[0])/2,tz=(cornerB[1]+opposite[1])/2;
  const towerAngle=-Math.atan2(cornerA[1]-cornerB[1],cornerA[0]-cornerB[0]);
  const pyramid=new THREE.Group();pyramid.position.set(tx,0,tz);pyramid.rotation.y=towerAngle;root.add(pyramid);
  const halfBase=Math.hypot(cornerA[0]-cornerB[0],cornerA[1]-cornerB[1])/2;
  const halfWidth=(y:number)=>halfBase*(15.6-y)/(15.6-1.18);
  function pyramidSection(bottom:number,top:number,color:string){
    const body=mesh(new THREE.CylinderGeometry(halfWidth(top)*Math.SQRT2,halfWidth(bottom)*Math.SQRT2,top-bottom,4),color,0,(bottom+top)/2,0,pyramid);
    body.rotation.y=Math.PI/4;
  }
  box(halfBase*1.44,1.18,halfBase*1.44,0,.59,0,'#526260',pyramid);
  pyramidSection(1.18,12.35,'#d9d6c5');pyramidSection(12.35,15.6,'#e5e1ce');
  for(let side=0;side<4;side++){
    const face=new THREE.Group();face.rotation.y=side*Math.PI/2;pyramid.add(face);
    for(let i=0;i<4;i++){
      const x=-halfBase+i*halfBase*.5;
      for(const edge of [0,1])pole(new THREE.Vector3(x+halfBase*.25,.06,halfBase*.88),new THREE.Vector3(x+edge*halfBase*.5,1.18,halfBase),.065,'#cfcbb8',face);
    }
    const angle=towerAngle+side*Math.PI/2;
    for(let floor=0;floor<46;floor++){
      const y=1.33+floor*.235, half=halfWidth(y), panes=Math.max(1,Math.round(2*half/.19));
      for(let lane=0;lane<panes;lane++){
        const x=-half+(lane+.5)*2*half/panes, z=half+.019;
        windowPositions.push({x:tx+Math.cos(angle)*x+Math.sin(angle)*z,y,z:tz-Math.sin(angle)*x+Math.cos(angle)*z,ry:angle,w:half*1.42/panes,h:.14});
      }
    }
    if(side%2===0){
      box(.37,3.25,.28,0,7.67,.91,'#dfd9c7',face);
      for(let i=0;i<4;i++)box(.38,.16,.28-i*.053,0,9.34+i*.13,.91-i*.026,'#dfd9c7',face);
    }
  }
  const hall=ferryHall(font), ferryBuilding=hall.root;
  root.add(ferryBuilding);
  // Keep the clock movement in its existing local coordinates as the tower moves to the portico.
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
  clockTower.scale.set(.41,.41,.4092);
  clockTower.position.set(hall.towerX-.41,0,hall.towerZ+.04092);
  ferryBuilding.add(clockTower);
  // The full western crossing shares the city's map projection. W1 is the
  // shoreline transition; four suspension towers flank the central anchorage.
  const bridge=new THREE.Group();bridge.position.set(bridgeLayout.origin[0],0,bridgeLayout.origin[1]);bridge.rotation.y=bridgeLayout.angle;root.add(bridge);
  const deckLow=bridgeLayout.lowerDeck,deckHigh=bridgeLayout.upperDeck,bridgeEnd=bridgeLayout.length;
  addBridgeDeck(bridge,mesh,bridgeEnd,deckLow,deckHigh);
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
  addBridgeAnchorages(bridge,mesh,deckLow,deckHigh);
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
      if(i%3===0&&y>deckHigh+.12)pole(new THREE.Vector3(x,deckHigh+.05,z),new THREE.Vector3(x,y,z),.017,'#94aaa9',bridge);
    }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),96,.027,5,false),'#516d79',0,0,0,bridge);
  }
  const bridgeLightMaterial=new THREE.PointsMaterial({color:'#d8e8ed',size:1.25,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  const bridgeLights=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(cableLightPositions,3)),bridgeLightMaterial);bridge.add(bridgeLights);
  const roadLightPositions:number[]=[];
  for(let z=0;z<bridgeEnd;z+=3)roadLightPositions.push(-.61,deckHigh+.64,z,.61,deckHigh+.64,z);
  const roadLightMaterial=new THREE.PointsMaterial({color:'#ffdf9e',size:2,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  bridge.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(roadLightPositions,3)),roadLightMaterial));
  // Bents carry the city approach between the anchorage and the shore.
  for(const z of [0,7]){
    for(const x of [-.85,.85])box(.22,3.75,.3,x,1.7,z,'#a8b7b3',bridge);
    box(2.1,.19,.4,0,3.55,z,'#9aa9a5',bridge);
  }
  const updateApproach=buildApproachRoad(mesh,root);
  buildApproachBlocks(mesh,root);
  buildApproachBillboards(mesh,root,font);
  // Carry the viaduct from its west-span anchorage to the rising tunnel cut.
  for(const deck of [deckLow,deckHigh]){
    box(1.4,.15,10.2,0,deck,bridgeEnd+5,'#91a1a0',bridge);
    for(const side of [-1,1])box(.065,.19,10.2,side*.69,deck+.12,bridgeEnd+5,'#a9b4a8',bridge);
  }
  for(const side of [-1,1])box(.19,2,1.05,side*.81,deckHigh-.60,bridgeEnd+8.6,'#a79e89',bridge);
  box(1.83,.22,1.15,0,deckHigh+.46,bridgeEnd+8.6,'#b9b09c',bridge);
  for(let z=0;z<bridgeEnd;z+=6){pole(new THREE.Vector3(-.63,deckHigh,z),new THREE.Vector3(-.63,deckHigh+.6,z),.012,dark,bridge);box(.22,.03,.08,-.56,deckHigh+.6,z,cream,bridge);}
  const vehiclePaint=streetVehicleMaterial();
  const cars=Array.from({length:22},(_,i)=>{
    const car=createStreetVehicle(i,vehiclePaint,true);
    car.scale.setScalar(.25);
    const westbound=i%2===0;
    const lane=bridgeLaneCenters[Math.floor(i/2)%bridgeLaneCenters.length];
    car.position.set(lane,westbound?deckHigh+.063:deckLow+.044,i*8);
    car.rotation.y=westbound?Math.PI/2:-Math.PI/2;
    bridge.add(car);
    return car;
  });
  const coffeeSign=new THREE.Group();root.add(coffeeSign);
  // The steel sign frame rises from behind the plant's low brick parapet.
  coffeeSign.position.set(-41.35,1.46,-6.94);coffeeSign.rotation.y=.148;
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
  const sculpture=new THREE.Group();sculpture.position.set(-32.29,rinconLawnHeight(-1.16),-1.16);sculpture.scale.setScalar(.43);sculpture.rotation.y=-.13;root.add(sculpture);
  const bowCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-3.8,.05,0),new THREE.Vector3(-2.9,2.7,0),new THREE.Vector3(-1.1,4.1,0),new THREE.Vector3(1.4,3.7,0),new THREE.Vector3(3.8,.05,0)]);
  mesh(new THREE.TubeGeometry(bowCurve,40,.17,8,false),'#d69b32',0,0,0,sculpture);
  pole(new THREE.Vector3(-3.8,.08,.05),new THREE.Vector3(.3,2,.05),.025,'#645244',sculpture);
  pole(new THREE.Vector3(.3,2,.05),new THREE.Vector3(3.8,.08,.05),.025,'#645244',sculpture);
  // Red fletching above the buried arrow: the recognizable Cupid's Span silhouette.
  pole(new THREE.Vector3(.1,0,.1),new THREE.Vector3(1.7,6,.1),.105,'#bb5334',sculpture);
  const featherShape=new THREE.Shape();featherShape.moveTo(0,0);featherShape.lineTo(-.92,.55);featherShape.lineTo(-1.18,2.05);featherShape.lineTo(-.14,1.38);featherShape.lineTo(.85,2.1);featherShape.lineTo(.83,.8);featherShape.closePath();
  const arrowFeather=mesh(new THREE.ExtrudeGeometry(featherShape,{depth:.12,bevelEnabled:false}),'#ce5035',1.3,4.6,.05,sculpture);arrowFeather.rotation.z=-.26;
  // The tilted grass plane meets continuous paths and low concrete seat walls.
  const lawn=footprintGeometry(rinconLawn,.13), lawnPosition=lawn.attributes.position;
  for(let i=0;i<lawnPosition.count;i++)lawnPosition.setY(i,lawnPosition.getY(i)-.13+rinconLawnHeight(lawnPosition.getZ(i)));
  lawn.computeVertexNormals();
  mesh(lawn,'#829b61',0,0,0).name='Rincon tilted lawn';
  mesh(walkSurface(routes.rincon,routeWidth.rincon,.11),'#d4cbb7',0,0,0).name='Rincon shared promenade';
  for(const approach of [rinconApproach,rinconExit])mesh(walkSurface(approach,.48,.10),'#d4cbb7',0,0,0);
  function shrub(x:number,z:number,r=.12){
    const bush=mesh(new THREE.IcosahedronGeometry(r,1),'#849472',x,rinconLawnHeight(z)+r*.36,z);bush.scale.set(1,.68,1);
  }
  const seatingCurves=[
    [[-36.01,.64],[-35.70,.59],[-35.31,.53],[-34.94,.57]],
    [[-33.81,.43],[-33.38,.36],[-32.94,.32],[-32.58,.34]],
    [[-31.34,.18],[-30.93,.105],[-30.44,.07],[-30.10,.09]],
    [[-29.08,-.078],[-28.73,-.14],[-28.32,-.18],[-27.99,-.16]],
  ];
  for(const points of seatingCurves){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,.198,z)));
    mesh(walkSurface(curve,.107,.075),'#d3cbb4',0,0,0).name='Rincon concrete seat wall';
    for(const t of [.20,.47,.75]){
      const p=curve.getPointAt(t);
      shrub(p.x,p.z-.104,.066);
    }
  }
  for(const [x,z] of [[-38.1,-1.5],[-25.7,-.2]])tree(x,z,.36);
  // Palms occupy the boulevard median, leaving the paths and lawn open.
  for(let x=-45;x<-23;x+=2.8){
    const z=(streetPose(x,1).z+streetPose(x,-1).z)/2;
    waterfrontPalm(mesh,x,0,z,Math.round(x*413),1.45,.78);
  }
  // Surviving timber piles and low waterside rails follow the bay edge.
  for(let i=0;i<27;i++){
    const x=-37+i*.43,z=2.4+(i%3)*.33;
    mesh(new THREE.CylinderGeometry(.055,.066,.53+(i%4)*.04,7),'#78867a',x,-.48,z);
  }
  const railLine=[[-37.70,1.43],[-35.4,1.36],[-32.9,1.15],[-29.8,.78],[-27.1,.47],[-25.6,.24]];
  linePath(railLine,.017,rinconGround+.113,'#839a91');
  for(let i=1;i<railLine.length;i++){
    const [ax,az]=railLine[i-1],[bx,bz]=railLine[i],n=Math.ceil(Math.hypot(bx-ax,bz-az)/.3);
    for(let j=0;j<n;j++){
      const x=ax+(bx-ax)*j/n,z=az+(bz-az)*j/n;
      pole(new THREE.Vector3(x,.06,z),new THREE.Vector3(x,rinconGround+.12,z),.0075,'#6f8887');
    }
  }
  function waterfrontBench(x:number,y:number,z:number,angle=0){
    const g=new THREE.Group();g.name='Promenade bench';g.position.set(x,y,z);g.rotation.y=angle;root.add(g);
    for(let slat=0;slat<3;slat++)box(.254,.010,.023,0,.048,-.024+slat*.025,'#ac9573',g);
    for(const dx of [-.098,.098]){
      box(.014,.048,.057,dx,.024,0,dark,g);
      box(.012,.065,.014,dx,.069,-.035,dark,g);
    }
    for(const y of [.079,.099])box(.254,.015,.010,0,y,-.041,'#a89170',g);
  }
  waterfrontBench(-37.70,rinconGround,.69,-.13);
  for(const [x,z] of [[-35.08,.361],[-31.26,-.04],[-28.10,-.365]])waterfrontBench(x,rinconLawnHeight(z),z,-.13);
  // Embarcadero Plaza: the historic brick room at the foot of Market Street.
  const plaza=sfMap.parks.find(p=>p.name==='Embarcadero Plaza')!;
  for(let x=-7.5;x<7.2;x+=.32)for(let z=-11.1;z<-5.3;z+=.32){
    if(![[-.15,-.15],[.15,-.15],[-.15,.15],[.15,.15]].every(([dx,dz])=>insidePier(x+dx,z+dz,plaza.p)))continue;
    const i=Math.round(x/.32),j=Math.round(z/.32);
    const pigment=['#b5866d','#b88a70','#b1836b','#bb8e73'][Math.abs(i*7+j*3)%4];
    if(x<3.0||x>6.35||z< -9.55||z> -6.65){box(.311,.018,.311,x,.13,z,pigment);continue;}
    const tile=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([dx,dz])=>[x+.1555*dx,z+.1555*dz]);
    for(const part of cutPavingAtBasin(tile,fountainPavingCut))mesh(footprintGeometry(part,.018),pigment,0,.121,0);
  }
  // Halprin's brick room is open toward the fountain. The steps follow its western and southern edges.
  for(const [x,z,w] of [[-4.1,-7.75,4.4],[2.0,-10.14,2.6]])for(let step=0;step<3;step++)box(w,.027,.096,x,.15+step*.019,z-step*.097,'#c4ae91');
  for(const [x,z] of [[-6.7,-7],[-4.8,-8.25],[-2.1,-9.9],[1.1,-10.1],[6.37,-9.82],[6.56,-6.32]]){
    box(.35,.079,.35,x,.179,z,'#bead91');tree(x,z,.27,.218);
    waterfrontBench(x,.139,z+.246);waterfrontBench(x,.139,z-.246,Math.PI);
  }
  const rememberedWaterfront=createRememberedWaterfront(font,waterTime,nightInk);
  root.add(rememberedWaterfront);
  const fountainWater=rememberedWaterfront.getObjectByName(fountainWaterName)!;
  const art=new THREE.Group();art.position.set(1.068,.14,-10.438);root.add(art);
  for(const [x,y,a] of [[0,.23,.2],[.10,.55,-.3],[-.04,.86,.28]]){
    const form=box(.32,.44,.10,x,y,0,'#efe6cd',art);form.rotation.z=a;
    for(const dx of [-.1,.02]){const stripe=box(.018,.38,.018,x+dx,y,.065,'#42565a',art);stripe.rotation.z=a;}
  }
  for(const [x,z] of [[-5.26,-7.12],[-3.02,-7.09],[-1.02,-7.46],[2.22,-8.74]])residentPositions.push({x,z,y:.139});
  // Visitors gather on the grass, clear of the shared route, furnishings and sculpture.
  for(const [x,z] of [[-36.26,-.20],[-35.57,-.16],[-34.67,-.29],[-30.85,-.27],[-30.47,-.39],[-28.89,-.30],[-27.66,-.28]]){
    residentPositions.push({x,z,y:rinconLawnHeight(z)});
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
  root.add(harborPublicPiers(sfMap.piers,font));
  root.add(ferryPublicRealm());
  // People meet on the granite paving or pause outside the restaurant threshold.
  for(const [x,z] of [[-9.83,1.51],[-9.67,1.48],[-9.18,.61],[-8.21,.23],[-7.57,1.25]])residentPositions.push({x,z,y:.088});

  buildFerryTerminal(mesh,root);
  for(const entry of ferryConnections)root.add(ferryPortal(entry,font));
  mesh(walkSurface(routes.ferry,routeWidth.ferry,.016),'#bdb8a6',0,0,0).name='Ferry landing promenade';
  for(const [x,z] of [[-4.63,2.98],[-4.24,3.10],[-3.40,4.73],[-4.30,4.95],[-3.70,5.30],[-3.49,5.66]])residentPositions.push({x,z,y:.096});
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
  const ferries=[createDoradoFerry(mesh,.68,'Dorado'),createDoradoFerry(mesh,.58,'Delphinus')];
  root.add(...ferries);
  for(const ferry of ferries)for(const side of [-1,1]){
    const name=lettering(ferry.name.toUpperCase(),.092,1.445,.563,side*.766,'#344e5d',ferry);
    name.rotation.y=side<0?Math.PI:0;
    const operator=lettering('SAN FRANCISCO BAY FERRY',.059,-.36,1.066,side*.762,'#476570',ferry);
    operator.rotation.y=side<0?Math.PI:0;
  }
  // Market canvas shares one ridge per stall. Seams run down the pitch to the
  // scalloped edge; each fabric strip follows the same roof plane as its neighbour.
  const fruitColors=['#a95840','#969856','#ca944f'];
  for(const [stall,x] of [-3.57,-3.06,-2.55,-.15,.36,.87].entries()){
    const canopy=new THREE.Group();canopy.position.set(x,.096,1.84);root.add(canopy);
    const w=.456,run=.149,rise=.090,eave=.308;
    for(const side of [-1,1])for(const dx of [-.194,.194]){
      box(.009,eave,.009,dx,eave/2,side*.129,'#7e8071',canopy);
    }
    const fabric=['#9e6151','#9b7357','#6f8982'][stall%3];
    for(let stripe=0;stripe<7;stripe++){
      const xx=(stripe-3)*w/7,color=stripe%2?'#e7ddc4':fabric;
      for(const side of [-1,1]){
        const leaf=box(w/7,.006,Math.hypot(run,rise),xx,eave+rise/2,side*run/2,color,canopy);
        leaf.rotation.x=side*Math.atan2(rise,run);
        box(w/7,.032,.006,xx,eave-.015,side*run,color,canopy);
      }
    }
    box(.38,.015,.15,0,.119,.046,'#ac9069',canopy);
    for(const xx of [-.149,.149])for(const zz of [-.012,.102])box(.011,.114,.012,xx,.057,zz,'#837b67',canopy);
    for(let bin=0;bin<3;bin++){
      const bx=(bin-1)*.115;
      box(.103,.023,.09,bx,.137,.046,'#967f5e',canopy);
      for(let k=0;k<8;k++)mesh(new THREE.IcosahedronGeometry(.016+(k%3)*.001,0),fruitColors[(bin+stall)%3],bx+(k%4-1.5)*.021,.155,.046+(k<4?-.017:.010),canopy);
    }
  }
  waterfrontBench(-24,rinconGround,-.29,-.10);
  for(const x of [-21,31,34]){
    const segment=landEdge.findIndex(([bx],i)=>i>0&&(x-landEdge[i-1][0])*(x-bx)<=0&&bx!==landEdge[i-1][0]);
    if(segment<1)continue;
    const [ax,az]=landEdge[segment-1],[bx,bz]=landEdge[segment];
    const z=az+(bz-az)*(x-ax)/(bx-ax)-.12;
    waterfrontBench(x,.044,z,-Math.atan2(bz-az,bx-ax));
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
  for(let i=0;i<22;i++){
    const poseAt=(offset:number)=>waterfrontWalker(offset,i);
    const p=poseAt(0);
    people.update(i,p.x,p.z,0,1,p.y,0,false,p.heading,poseAt);
  }
  residentPositions.forEach((p,i)=>people.update(22+i,p.x,p.z,0,i%2?1:-1,p.y,0,true));
  people.flush();const pedestrians=people.group;root.add(pedestrians);
  const walkers=people.bodies,walkerHeads=people.heads;
  const streetCars=new THREE.Group();root.add(streetCars);
  const traffic=Array.from({length:10},(_,i)=>{
    const car=createStreetVehicle(i,vehiclePaint);
    streetCars.add(car);
    return car;
  });
  const cyclists=Array.from({length:3},(_,i)=>{
    const g=new THREE.Group();root.add(g);
    const p=waterfrontCyclist(0,i);
    g.scale.setScalar(bicycleScale);g.position.set(p.x,p.y-bicycleScale*bicycleWheelBottom,p.z);g.rotation.y=-p.heading;
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
    const bird=new THREE.Group();bird.scale.setScalar(.56);gulls.add(bird);
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
  const sailboats=[createDaySailer('#aa5038'),createDaySailer('#386676')];root.add(...sailboats);
  const fireboat=createFireboat();root.add(fireboat.root);
  // Merge static architecture by material. Detail increases without thousands of draw calls.
  root.updateMatrixWorld(true);
  const moving=new Set<THREE.Object3D>([...sailboats,fireboat.root,coffeeLetters,bucky,water,fountainWater,windowMesh,tram,gulls,pedestrians,streetCars,seaLion,...cyclists,...ferries,...cars,...clockHands.flatMap(h=>[h.minute,h.hour])]);
  const staticMeshes:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]=[];
  root.traverse(o=>{
    if(!(o instanceof THREE.Mesh)||o instanceof THREE.InstancedMesh)return;
    for(let parent:THREE.Object3D|null=o;parent;parent=parent.parent)if(moving.has(parent))return;
    staticMeshes.push(o);
  });
  const architectureMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:.02,side:THREE.FrontSide});
  const architectureChunks=bakeBlocks(staticMeshes,architectureMaterial);
  const illuminatedArchitecture=architectureMaterial.clone();
  for(const chunk of architectureChunks)if(chunk.geometry.hasAttribute('signLight'))chunk.material=illuminatedArchitecture;
  root.add(...architectureChunks);
  staticMeshes.forEach(o=>{o.parent?.remove(o);o.geometry.dispose();});
  // Keep each moving object intact while batching its own small components.
  const ferryPaint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:.02});
  for(const group of [tram,...ferries,...cyclists]) {
    const isFerry=ferries.includes(group);
    group.updateMatrixWorld(true);
    const inverse=new THREE.Matrix4().copy(group.matrixWorld).invert();
    const batches=new Map<THREE.Material,{geometries:THREE.BufferGeometry[];objects:THREE.Mesh[]}>();
    group.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;
      const source=o.material as THREE.MeshStandardMaterial;
      const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
      // Solid livery and opaque glazing share a draw. A separate transparent
      // or lit part can still supply its own material.
      const solidFerryPaint=isFerry&&source instanceof THREE.MeshStandardMaterial&&!source.transparent&&!source.map&&!source.vertexColors&&
        source.opacity===1&&source.emissive.getHex()===0&&source.roughness===.86&&source.metalness===.02;
      const mat=solidFerryPaint?ferryPaint:source;
      if(solidFerryPaint){
        const {r,g:green,b}=source.color;
        const paint=new Float32Array(g.getAttribute('position').count*3);
        for(let i=0;i<paint.length;i+=3){paint[i]=r;paint[i+1]=green;paint[i+2]=b;}
        g.setAttribute('color',new THREE.BufferAttribute(paint,3));
      }
      const batch=batches.get(mat)||{geometries:[],objects:[]};
      batch.geometries.push(g);batch.objects.push(o);batches.set(mat,batch);
    });
    batches.forEach((batch,mat)=>{
      const g=mergeGeometries(batch.geometries);if(!g)throw new Error('Moving object merge failed');
      batch.objects.forEach(o=>{o.parent?.remove(o);o.geometry.dispose();});batch.geometries.forEach(g=>g.dispose());
      const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;group.add(m);
    });
  }
  for(const object of moving)object.traverse(child=>{child.castShadow=false;});
  // Local atmospheric falloff conceals the finite northern map boundary.
  // Applied equally to buildings, lamps and window instances, in world coordinates.
  // A mipmapped sheet of pigment granulation. Surface coordinates keep the strokes
  // still during camera moves and let fine marks dissolve naturally in the distance.
  const tileSide=128, grainBytes=new Uint8Array(tileSide*tileSide);
  let seed=1921;
  for(let i=0;i<grainBytes.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;grainBytes[i]=seed>>>24;}
  const pigment=new THREE.DataTexture(grainBytes,tileSide,tileSide,THREE.RedFormat);
  pigment.wrapS=pigment.wrapT=THREE.RepeatWrapping;pigment.generateMipmaps=true;
  pigment.minFilter=THREE.LinearMipmapLinearFilter;pigment.magFilter=THREE.LinearFilter;pigment.needsUpdate=true;
  architectureMaterial.addEventListener('dispose',()=>pigment.dispose());
  const edgeFogColor={value:new THREE.Color('#d6e4e6')};
  const hazeMaterials=new Set<THREE.MeshStandardMaterial|THREE.MeshBasicMaterial>([architectureMaterial,windowMaterial,waterMaterial]);
  root.traverse(o=>{if(o instanceof THREE.Mesh){for(const mat of Array.isArray(o.material)?o.material:[o.material])if(mat instanceof THREE.MeshStandardMaterial||mat instanceof THREE.MeshBasicMaterial)hazeMaterials.add(mat);}});
  for(const mat of hazeMaterials){
    const previousCompile=mat.onBeforeCompile;
    const previousCacheKey=mat.customProgramCacheKey();
    mat.onBeforeCompile=(shader,renderer)=>{
      previousCompile.call(mat,shader,renderer);
      shader.uniforms.edgeFogColor=edgeFogColor;
      shader.uniforms.pigmentSheet={value:pigment};shader.uniforms.nightInk=nightInk;
      const towerCenter=new THREE.Vector2(hall.towerX,hall.towerZ);shader.uniforms.ferryTowerCenter={value:towerCenter};
      shader.vertexShader='varying vec3 pigmentPosition; varying vec3 harborPosition;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec4 harborWorld=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          harborWorld=instanceMatrix*harborWorld;
        #endif
        harborPosition=(modelMatrix*harborWorld).xyz;
        pigmentPosition=transformed;`);
      if(mat===illuminatedArchitecture){
        shader.vertexShader='attribute vec3 signLight; varying vec3 nightSignLight;\n'+
          shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nnightSignLight=signLight;');
      }
      shader.fragmentShader='uniform float nightInk; uniform vec2 ferryTowerCenter; uniform sampler2D pigmentSheet; varying vec3 pigmentPosition; uniform vec3 edgeFogColor; varying vec3 harborPosition;\n'+shader.fragmentShader.replace('#include <fog_fragment>',`#include <fog_fragment>
        vec2 paper=pigmentPosition.xz*.63+vec2(pigmentPosition.y*.23,pigmentPosition.y*.89);
        float bloom=texture2D(pigmentSheet,paper*.015).r;
        float fiber=texture2D(pigmentSheet,paper*.16).r;
        float value=dot(gl_FragColor.rgb,vec3(.25,.61,.14));
        float shade=smoothstep(.12,.68,1.-value);
        vec3 wet=mix(vec3(.105,.158,.22),vec3(.24,.28,.35),bloom);
        gl_FragColor.rgb=mix(gl_FragColor.rgb,wet,shade*(.10+.12*bloom));
        gl_FragColor.rgb+=vec3(.044,.028,.005)*smoothstep(.55,.91,value);
        gl_FragColor.rgb+=(bloom-.5)*.046+(fiber-.5)*.024;
        vec3 P=harborPosition;
        // Warm floodlighting on the Ferry Building and clock; pale concrete takes ink in shadow.
        vec2 fromTower=P.xz-ferryTowerCenter;
        float towerLight=(1.-smoothstep(.45,.83,length(fromTower)))*smoothstep(1.0,2.4,P.y)*(1.-smoothstep(4.6,5.,P.y));
        float arcade=(1.-smoothstep(5.7,7.3,abs(P.x)))*(1.-smoothstep(.25,1.2,abs(P.z-1.52)))*(1.-smoothstep(.9,1.9,P.y));
        float wash=nightInk*(towerLight*.83+arcade*.49);
        gl_FragColor.rgb*=mix(vec3(1.),vec3(.68,.80,.99),nightInk*(1.-min(1.,wash)));
        gl_FragColor.rgb+=vec3(.60,.34,.09)*wash*max(.2,value);
        ${mat===illuminatedArchitecture?'gl_FragColor.rgb+=nightSignLight*smoothstep(.18,.95,nightInk);':''}
        float edgeHaze=max(smoothstep(65.0,102.0,harborPosition.x),smoothstep(128.0,198.0,-harborPosition.z))*smoothstep(18.,112.,distance(cameraPosition,harborPosition));
        gl_FragColor.rgb=mix(gl_FragColor.rgb,edgeFogColor,edgeHaze);`);
      if(mat===illuminatedArchitecture)shader.fragmentShader='varying vec3 nightSignLight;\n'+shader.fragmentShader;
    };
    mat.customProgramCacheKey=()=> `${previousCacheKey}|waterfront-edge-haze-v2${mat===illuminatedArchitecture?'|sign-lights':''}`;
  }
  // Haloes share one transparent batch and sit at the coordinates of the promenade lamps.
  const lanterns:number[]=[];
  for(let x=-39;x<40;x+=2.8)lanterns.push(x,1.56,x< -20?-2.1:x<0?-1.7:-1.9);
  for(let x=-6;x<7;x+=2.4)lanterns.push(x,1.10,1.98);
  const lampGlow=new THREE.PointsMaterial({color:'#ffd799',size:.35,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:true,opacity:0});
  lampGlow.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float lens=length(gl_PointCoord-vec2(.5))*2.;
    diffuseColor.a*=exp(-5.*lens*lens)*(1.-smoothstep(.6,1.,lens));`);};
  const glowGeometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(lanterns,3));
  const pierLamps=new THREE.Points(glowGeometry,lampGlow);root.add(pierLamps);
  const hitTargets:THREE.Mesh[]=[];
  const hitMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
  for(const [name,x,y,z,w,h,d] of [['waterfront',0,2.2,0,16,4.7,3],['bridge',bridgePoint(0,36.85).x,4.8,bridgePoint(0,36.85).z,2.8,10,2.8],['pyramid',26.75,7.8,-40.4,3,16,3]] as const){
    const target=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),hitMaterial);target.position.set(x,y,z);target.userData.landmark=name;root.add(target);hitTargets.push(target);
  }
  const relief=createBayRelief();root.add(relief.root);
  const result={ root, lampGlow, nightInk, relief, updateApproach, updateMarina:southernWaterfront.updateMarina, hullShadows, bayHorizon, sailboats, fireboat:fireboat as ReturnType<typeof createFireboat>|undefined, architectureChunks, residentPositions, coffeeMaterial, ferryConnections, pierSupports, people, streetcarGlazing:streetcar.glazing, streetcarLamp:streetcar.lamp, bridgeLightMaterial, roadLightMaterial, edgeFogColor, waterMaterial, waterTime, windowMaterial, ferries, cars, tram, gulls, birds, walkers, walkerHeads, traffic, cyclists, seaLion, sealFlippers, hitTargets, clockHands, ferryBuilding };
  cityTemplate=result;
  return result;
}


// The page owns one city template. Vignettes reuse its geometry, never reconstruct it.
let cityTemplate:ReturnType<typeof createLandscape>|undefined;
export function createCityVignette(variant:'street'|'plaza'):ReturnType<typeof createLandscape>{
  const source=cityTemplate||createLandscape(),root=new THREE.Group(),waterTime={value:0};
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
  const people=createPeople(22+residents.length);people.group.traverse(o=>{o.castShadow=false;});root.add(people.group);
  for(let i=0;i<22;i++){
    const poseAt=(offset:number)=>waterfrontWalker(offset,i,variant);
    const p=poseAt(0);
    people.update(i,p.x,p.z,0,1,p.y,0,false,p.heading,poseAt);
  }
  residents.forEach((p,i)=>people.update(22+i,p.x,p.z,0,i%2?1:-1,p.y,0,true));people.flush();
  const cyclists=variant==='street'?source.cyclists.map(bike=>{
    const copy=bike.clone();
    copy.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.sharedGeometry=true;o.material=Array.isArray(o.material)?o.material.map(copiedMaterial):copiedMaterial(o.material);}});
    root.add(copy);return copy;
  }):[];
  const tram=source.tram.clone();tram.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.sharedGeometry=true;o.material=Array.isArray(o.material)?o.material.map(copiedMaterial):copiedMaterial(o.material);}});root.add(tram);
  const traffic=source.traffic.slice(0,6).map(car=>{const copy=car.clone();copy.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.sharedGeometry=true;o.material=Array.isArray(o.material)?o.material.map(copiedMaterial):copiedMaterial(o.material);}});root.add(copy);return copy;});
  source.root.updateMatrixWorld(true);
  source.root.traverse(o=>{if(o instanceof THREE.Mesh&&o.material===source.coffeeMaterial&&variant==='street'){const copy=copyMesh(o);copy.matrix.copy(o.matrixWorld);copy.matrix.decompose(copy.position,copy.quaternion,copy.scale);root.add(copy);}});
  // The plaza shares the fountain geometry while following its own pausable clock.
  if(variant==='plaza'){
    const surface=source.root.getObjectByName(fountainWaterName)!;
    const copy=new THREE.Group();copy.name=fountainWaterName;
    surface.matrixWorld.decompose(copy.position,copy.quaternion,copy.scale);
    for(const object of surface.children)if(object instanceof THREE.Mesh){
      const layer=copyMesh(object);bindFountainWaterClock(layer,waterTime,source.nightInk);copy.add(layer);
    }
    root.add(copy);
  }
  // Clock hands remain live in the plaza view while sharing the source geometry.
  const clockHands=variant==='plaza'?source.clockHands.map(({minute,hour,angle})=>{
    const parent=new THREE.Group();parent.matrix.copy(minute.parent!.matrixWorld);parent.matrix.decompose(parent.position,parent.quaternion,parent.scale);root.add(parent);
    const minuteCopy=copyMesh(minute),hourCopy=copyMesh(hour);parent.add(minuteCopy,hourCopy);return {minute:minuteCopy,hour:hourCopy,angle};
  }):[];
  return {...source,root,updateApproach:()=>{},sailboats:[],fireboat:undefined,architectureChunks,residentPositions:residents,people,walkers:people.bodies,walkerHeads:people.heads,waterMaterial:water.material,waterTime,windowMaterial,tram,traffic,
    streetcarGlazing:copiedMaterial(source.streetcarGlazing) as THREE.MeshStandardMaterial,streetcarLamp:copiedMaterial(source.streetcarLamp) as THREE.MeshStandardMaterial,
    coffeeMaterial:copiedMaterial(source.coffeeMaterial) as THREE.MeshStandardMaterial,clockHands,ferries:[],cars:[],birds:[],cyclists,hitTargets:[],
    seaLion:new THREE.Group(),sealFlippers:[]};
}
