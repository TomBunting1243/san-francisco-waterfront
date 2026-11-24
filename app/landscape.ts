import {addWestSpanTowers} from './west-span-towers.ts';
import {howardGlassName} from './301-howard-front.ts';
import {padelScreenName} from './park-padel.ts';
import {fireboatStation,firehouseFloat} from './fireboat-station.ts';
import {northWaterfrontGrade} from './streets.ts';
import {hillsBuildings,hillsSign} from './hills-plaza.ts';
export {setPccFrontDoor,setPccExitDoor} from './streetcar.ts';
import {rinconGardenBorder} from './rincon-curb-edge.ts';
import {addSteuartShelterLights,createPromenadeTransit} from './promenade-transit.ts';
import {kioskCampaignMaterial} from './kiosk-campaigns.ts';
import {billboardPrintMaterial} from './billboard-editions.ts';
import {applyWalkPanelJoints} from './promenade-pavement.ts';
import {ferryFleet,ferryPose} from './motion.ts';
import {collectFerryWalkPools} from './ferry-walk-lights.ts';
import {collectStreetGlobes,createSignalHousings} from './street-illumination.ts';
export {createStreetIllumination} from './street-illumination.ts';
import {addRinconPathLighting} from './rincon-path-lighting.ts';
import {buildPromenadeLighting} from './promenade-lighting.ts';
import {createCanopyMaterial} from './canopy-pigment.ts';
import {createFerryMarket} from './ferry-market.ts';
import {southPlazaTop} from './plaza-survey.ts';
import {ferryClockTower} from './ferry-clock-tower.ts';
import {createFerryFlag} from './ferry-flag.ts';
export {updateFerryFlag,ferryFlagFlutterRate} from './ferry-flag.ts';
export {setFerryClockTime} from './ferry-clock-tower.ts';
import {downtownBuilding,applyDowntownGlazing,bindFacadeClock,createFacadeClock} from './downtown-buildings.ts';
import {addSurveyShore,seawallAt} from './survey-shore.ts';
import {bayReliefBankHeight,bayReliefStages} from './bay-relief.ts';
import {createSalesforceTower,createTransamericaPyramid} from './skyline-towers.ts';
import {marketArchitecture} from './market-architecture.ts';
import {createSouthBeach} from './south-beach.ts';
import {addHyattRegency} from './hyatt-regency.ts';
import {addFinancialDistrictBuilding} from './financial-district.ts';
import {backgroundFrontage} from './background-frontages.ts';
import {addSurveyBlocks,addSurveyFront,outsideSurveyRoads,surveyedHeight} from './survey-blocks.ts';
import {addHowardParking} from './howard-parking.ts';
import {addHowardBikeway} from './howard-bikeway.ts';
import {hasShorelineFacade,shorelineFacade} from './shoreline-facades.ts';
import * as THREE from 'three';
import {buildStreetcarTrack} from './streets.ts';
import {addFerryMarketPlatforms} from './ferry-market-platform.ts';
import {bakePccBody,createStreetcar} from './streetcar.ts';
import {createWaterfrontTraffic} from './waterfront-traffic.ts';
import {createPlazaSkaters} from './plaza-skaters.ts';
import {createPeople} from './people.ts';
import {pier14Visitors,updatePier14Visitors} from './pier14-visitors.ts';
import {bicycleScale,bicycleWheelBottom,rinconGround,rinconApproach,rinconExit,routes,routeWidth,walkSurface,waterfrontCyclist,waterfrontWalker,waterfrontWalkerCount} from './waterfront-routes.ts';
import {harborBuilding,smallHarborBuildings,harborPublicPiers,ferryPortal} from './harbor-architecture.ts';
import {buildFerryTerminal,prepareFerryTerminalTide,createBoardingBrows,ferryConnections,fixedFerryApron} from './ferry-terminal.ts';
import {ferryHall,ferryPublicRealm} from './ferry-architecture.ts';
import {laChiffonniere} from './la-chiffonniere.ts';
import {embarcaderoPlaza,plazaStandingHeight} from './embarcadero-plaza.ts';
import {addRinconRestaurant} from './rincon-restaurants.ts';
import {createRememberedWaterfront} from './remembered-waterfront.ts';
import {bindFountainWaterClock,fountainWaterName} from './fountain-flow.ts';
import {bindVesselLighting,setVesselLightingPhase} from './vessel-lighting.ts';
import {createFireboat} from './fireboat.ts';
import {ferryPassengerCount,updateFerryPassengers} from './ferry-passengers.ts';
import {createServiceFerry,serviceFerryPaint,updatePyxisBoardingDoor} from './service-ferries.ts';
import {ferryClockAt,vessels} from './ferry-service.ts';
import {createDaySailer} from './sailing.ts';
import {baySurfaceGeometry,vignetteBaySurfaceGeometry,configureBayWater,marineDistanceFog} from './bay-water.ts';
import {bakeBlockGroups,bakeRigidChunk,freezeBakedArchitecture,retireBakedMeshes} from './city-blocks.ts';
import {bakeTreeBatches,createTreeDraw} from './tree-batches.ts';
import {harborDatum,waterHeight,waterSurface} from './water-surface.ts';
import {buildingCharacter,modernBuildingAccents,characterBuildings,characterColors} from './building-character.ts';
import {hasNeighborhoodDetail,neighborhoodColor,neighborhoodDetail,refineNeighborhoodMassing} from './neighborhood-detail.ts';
import {waterfrontGardens,waterfrontLandscape} from './waterfront-gardens.ts';
import {createEmbarcaderoCenter} from './embarcadero-center.ts';
import {cupidsSpan,knollHeight,rinconGrass,rinconKnoll,rinconPoint,rinconUplights} from './rincon-park.ts';
import {createBridgeTraffic} from './traffic-batches.ts';
import {streetVehicleMaterial} from './street-vehicles.ts';
import {architectureProfile,referenceColor,refineReferenceMassing,referenceArchitecture} from './reference-architecture.ts';
import {isMooredVessel,mooredVessel,pierThreeFloat} from './moored-vessels.ts';
import {paintedLight} from './gouache-light.ts';
import {windowGlow,applyWindowLighting} from './window-lighting.ts';
import {waterfrontLandmark,detailedWaterfrontNames} from './waterfront-landmarks.ts';
import {bridgeLayout,bridgePoint} from './bridge-layout.ts';
import {addWestSpanSuspenders} from './west-span-suspenders.ts';
import {createBayLights} from './bay-lights.ts';
import {buildApproachRoad} from './approach-road.ts';
import {buildApproachBlocks} from './approach-blocks.ts';
import {hillsCoffeeTubes} from './coffee-neon.ts';
import {buildApproachBillboards} from './approach-billboards.ts';
import {addOneMarketTower} from './one-market-towers.ts';
import {cloneTidalGeometry,createTideUpdater} from './tidal-berths.ts';
import {installOrderedArchitecture} from './ordered-architecture.ts';
import {addFiftyFremont} from './fifty-fremont.ts';
import {addProvidianBuilding} from './providian-building.ts';
import {addAveryBuilding} from './avery-building.ts';
import {addPgeBuilding} from './pge-building.ts';
import {addMillenniumTower} from './millennium-tower.ts';
import {addRinconTower} from './rincon-tower.ts';
import {addDrummFrontage} from './drumm-frontages.ts';
import {addLuminaTower} from './lumina-tower.ts';
import {addGoldenGatewayGarage,refineMaritimeLandings} from './golden-gateway-garage.ts';
import {addRinconCenter} from './rincon-center.ts';
import {addLuminaMainStreet} from './building-421816059.ts';
import {add388Beale} from './building-288645692.ts';
import {addAppraisersBuilding} from './appraisers-building.ts';
import {add101Mission} from './101-mission.ts';
import {addBridgeview} from './bridgeview.ts';
import {add221Main} from './221-main.ts';
import {add360Spear} from './360-spear.ts';
import {add160Spear} from './160-spear.ts';
import {add211Main} from './211-main.ts';
import {add300Mission} from './300-mission.ts';
import {add100Pine} from './100-pine.ts';
import {addMarketCenterPlaza} from './market-center-plaza.ts';
import {addMarketCenter} from './market-center.ts';
import {addEmbarcaderoCenterWest} from './embarcadero-center-west.ts';
import {add500Folsom} from './500-folsom.ts';
import {addMetropolitanTowers,addBayCrestWings} from './rincon-residential.ts';
import {add199Fremont} from './199-fremont.ts';
import {add425Market} from './425-market.ts';
import {add455Market} from './455-market.ts';
import {add333Market} from './333-market.ts';
import {addCaliforniaCenter} from './california-center.ts';
import {addHarrison} from './harrison.ts';
import {addParkTower} from './park-tower.ts';
import {surveyedShopfrontFactory} from './surveyed-shopfronts.ts';
import {addBechtelPlaza} from './bechtel-plaza.ts';
import {add201Spear} from './201-spear.ts';
import {addFortyFiveFremont} from './forty-five-fremont.ts';
import {addMarketFlatiron} from './market-flatiron.ts';
import {addFolgerBuilding} from './folger-building.ts';
import {addMarketHistoricFrontage} from './market-historic-frontages.ts';
import {addBridgeDeck,addBridgeMarkings,addUpperParapet} from './bridge-deck.ts';
import {addBridgeAnchorages} from './bridge-anchorage.ts';
import {sfMap,mappedBuildings,footprintGeometry,center} from './sf-map.ts';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontData from './harbor-font.json' with { type: 'json' };
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** San Francisco waterfront footprints with selectively detailed landmark models. */
export function* landscapeStages(shouldYield:()=>boolean=()=>false) {
  const root = new THREE.Group();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const windowPositions: { x: number; y: number; z: number; ry: number; w: number; h: number; tide?:boolean }[] = [];
  const residentPositions:{x:number;z:number;y:number;rearShopper?:boolean}[]=[];
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
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#a5ccd1', roughness: .38, metalness: .15 });
  const waterTime = { value: 0 };
  const nightInk={value:0};
  const hullShadows=Array.from({length:ferryFleet.length+2},()=>new THREE.Vector4(10000,10000,1,0));
  const artClock={value:0};
  const bayWeather=configureBayWater(waterMaterial,waterTime,hullShadows,nightInk,artClock);
  const water = new THREE.Mesh(baySurfaceGeometry(), waterMaterial);
  water.rotation.x = -Math.PI / 2; water.position.y = waterSurface.level; water.receiveShadow = true; root.add(water);
  addSurveyShore(mesh,bayReliefBankHeight);
  if(shouldYield())yield 1;
  function linePath(points:number[][],width:number,y:number,color:string,road=false){
    for(let i=1;i<points.length;i++){
      const [ax,az]=points[i-1],[bx,bz]=points[i],length=Math.hypot(bx-ax,bz-az);
      if(length<.02)continue;
      const m=box(width,.028,length,(ax+bx)/2,y,(az+bz)/2,color);m.rotation.y=Math.atan2(bx-ax,bz-az);
      if(road)m.userData.roadExposure=1;
    }
  }
  function northRoadStrip(points:number[][],width:number,lift:number,color:string){
    // The road survey ends at a constant x station. Match that section
    // so the outer wheel track stays paved across the angled boundary.
    const vertices:number[]=[];
    for(let i=1;i<points.length;i++){
      const [a,b]=points[i-1][0]<points[i][0]?[points[i-1],points[i]]:[points[i],points[i-1]];
      if(b[0]===a[0])continue;
      const half=.5*width*Math.hypot(1,(b[1]-a[1])/(b[0]-a[0]));
      const ay=northWaterfrontGrade(a[0])+lift,by=northWaterfrontGrade(b[0])+lift;
      const left=[a[0],ay,a[1]-half],right=[a[0],ay,a[1]+half];
      const nextLeft=[b[0],by,b[1]-half],nextRight=[b[0],by,b[1]+half];
      vertices.push(...left,...right,...nextLeft,...nextLeft,...right,...nextRight);
    }
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.computeVertexNormals();mesh(geometry,color,0,0,0).userData.roadExposure=1;
  }
  addSurveyBlocks(mesh);
  addHowardParking(root);
  addHowardBikeway(root);
  outsideSurveyRoads.forEach(road=>{
    const width=road.name.includes('Embarcadero')?1.02:road.name==='Market Street'?1.45:road.kind==='primary'?.8:.48;
    if(road.name==='The Embarcadero'&&road.p.every(([x])=>x>=35)){
      northRoadStrip(road.p,width,0,'#889b9a');northRoadStrip(road.p,.027,.0009,'#d4d3ba');
    }else{
      linePath(road.p,width,.04,'#889b9a',true);
      if(road.name.includes('Embarcadero'))linePath(road.p,.027,.062,'#d4d3ba',true);
    }
  });
  sfMap.parks.forEach(park=>{
    if(addBechtelPlaza(park,root))return;
    if(park.p.length>3&&park.name!=='Rincon Park'&&park.name!=='Embarcadero Plaza')mesh(footprintGeometry(park.p,.07),'#89a66c',0,.04,0);
  });
  sfMap.piers.filter(p=>p.closed&&p!==firehouseFloat&&p!==pierThreeFloat&&p!==fixedFerryApron&&!p.name.startsWith('Ferry Building Gate')).forEach(pier=>mesh(footprintGeometry(pier.p,harborDatum.pierSlabThickness),pier.name==='Pier 7'?'#b5a27e':'#ccd0c3',0,harborDatum.pierDeck-harborDatum.pierSlabThickness,0));
  const southernWaterfront=createSouthBeach(font,waterTime);
  root.add(southernWaterfront.root);
  windowPositions.push(...southernWaterfront.windows);
  // Pile-supported decks: visible bents below every mapped waterfront pier.
  function insidePier(x:number,z:number,ps:number[][]){let inside=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){const [ax,az]=ps[i],[bx,bz]=ps[j];if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;}return inside;}
  const pierSupports:{x:number;z:number}[]=[];
  function pile(x:number,z:number,timber=false){
    if(pierSupports.some(p=>Math.hypot(p.x-x,p.z-z)<.18))return;
    pierSupports.push({x,z});
    const cap=harborDatum.pierDeck-harborDatum.pierSlabThickness,toe=waterSurface.level-.33;
    mesh(new THREE.CylinderGeometry(timber?.048:.06,timber?.062:.075,cap-toe,8),timber?'#857457':'#89998f',x,(cap+toe)/2,z);
    box(.18,.042,.18,x,cap-.021,z,timber?'#b39a70':'#b8baaa');
    mesh(new THREE.CylinderGeometry(.062,.072,.023,8),'#526d65',x,waterSurface.level,z);
  }
  for(const pier of sfMap.piers.filter(p=>p.closed)){
    const [cx,cz]=center(pier.p);if(cx< -90||cx>65||cz>30)continue;
    const timber=pier.name==='Pier 7';
    if(pier===firehouseFloat||pier===pierThreeFloat||pier===fixedFerryApron||pier.name.startsWith('Ferry Building Gate'))continue;
    for(let e=1;e<pier.p.length;e++){
      const [ax,az]=pier.p[e-1],[bx,bz]=pier.p[e],len=Math.hypot(bx-ax,bz-az);if(len<.3)continue;
      const count=Math.max(1,Math.ceil(len/1.2));
      for(let i=0;i<count;i++){
        const t=(i+.5)/count,x=ax+(bx-ax)*t,z=az+(bz-az)*t,dist=Math.hypot(cx-x,cz-z)||1;
        const px=x+(cx-x)/dist*.09,pz=z+(cz-z)/dist*.09;
        if(insidePier(px,pz,pier.p))pile(px,pz,timber);
      }
      // Deep perimeter fascia hides the paper-thin slab edge.
      const beam=box(.055,.076,len,(ax+bx)/2,harborDatum.pierDeck-.042,(az+bz)/2,timber?'#b39a70':'#b5b8aa');beam.rotation.y=Math.atan2(bx-ax,bz-az);
    }
    const minX=Math.min(...pier.p.map(p=>p[0])),maxX=Math.max(...pier.p.map(p=>p[0])),minZ=Math.min(...pier.p.map(p=>p[1])),maxZ=Math.max(...pier.p.map(p=>p[1]));
    for(let x=minX+.5;x<maxX;x+=1.35)for(let z=minZ+.5;z<maxZ;z+=1.35)if(insidePier(x,z,pier.p))pile(x,z,timber);
  }
  // Crossheads and diagonal bracing are legible from the low opening camera.
  for(const [cx,width,end,timber] of [[-17.25,.56,11.8,false],[27.28,.62,14,true]] as const){
    for(let z=.6;z<end;z+=1.3){
      box(width+.12,.039,.10,cx,harborDatum.pierDeck-harborDatum.pierSlabThickness-.0195,z,timber?'#ad9269':'#a4ada0');
      for(const side of [-1,1])pile(cx+side*width*.36,z,timber);
      if(timber)for(const side of [-1,1])pole(new THREE.Vector3(cx+side*width*.36,-.018,z),new THREE.Vector3(cx-side*width*.36,waterSurface.level-.16,z),.021,'#877354');
    }
  }
  yield 2;
  // The orphaned lower outlines at 303 Second and the four-corner MIRA duplicate
  // lie inside their named buildings. Render the continuous named envelopes.
  const redundantOutlines=new Set([1486849221,1486849222,693630796]);
  const detailedBuildings=refineMaritimeLandings(refineReferenceMassing(refineNeighborhoodMassing([...mappedBuildings.map(b=>b.id===1487160484?{...b,minH:1.52,h:3.63}:b).filter(b=>!redundantOutlines.has(b.id)&&![1487160485,1487160486,1487160487].includes(b.id)),...hillsBuildings])));
  const neighborhood=neighborhoodDetail(detailedBuildings);root.add(neighborhood.root);windowPositions.push(...neighborhood.windows);
  if(shouldYield())yield 2;
  const gardens=waterfrontGardens(detailedBuildings,font);root.add(gardens.root);
  if(shouldYield())yield 2;
  const centerComplex=createEmbarcaderoCenter(waterfrontLandscape.areas,waterfrontLandscape.paths,detailedBuildings);
  root.add(centerComplex.root);windowPositions.push(...centerComplex.windows);
  addMarketCenterPlaza(root);
  const buildingParents=new Set(detailedBuildings.map(b=>b.parent).filter(Boolean));
  function addBuilding(b:typeof detailedBuildings[number]){
    if(['Transamerica Pyramid','Salesforce Tower','San Francisco Ferry Building'].includes(b.name))return;
    if(b.name==='Fireboat Station 35'){
      const station=fireboatStation(b,font,mesh);root.add(station.root);windowPositions.push(...station.windows);return;
    }
    if(isMooredVessel(b)){
      if(!b.parent){const detail=mooredVessel(b,font);root.add(detail.root);windowPositions.push(...detail.windows);}
      return;
    }
    if(b.name==='1 Hotel San Francisco'){
      const hotel=buildingCharacter(b,detailedBuildings,font);root.add(hotel.root);windowPositions.push(...hotel.windows);return;
    }
    if(addGoldenGatewayGarage(b,root,windowPositions))return;
    if(addOneMarketTower(b,root,windowPositions)||addMarketHistoricFrontage(b,root,windowPositions,font))return;
    if(addRinconRestaurant(b,root,windowPositions)||addMillenniumTower(b,root,windowPositions)||addRinconTower(b,root,windowPositions))return;
    if(addDrummFrontage(b,root,windowPositions)||addLuminaTower(b,root,windowPositions)||addLuminaMainStreet(b,root,windowPositions))return;
    if(addFortyFiveFremont(b,root,windowPositions)||add201Spear(b,root,windowPositions)||addRinconCenter(b,root,windowPositions))return;
    if(add388Beale(b,root,windowPositions))return;
    if(add101Mission(b,root,windowPositions)||addBridgeview(b,root,windowPositions,font))return;
    if(add221Main(b,root,windowPositions,font)||addAppraisersBuilding(b,root,windowPositions,font))return;
    if(add360Spear(b,root,windowPositions)||add160Spear(b,root,windowPositions,font))return;
    if(add211Main(b,root,windowPositions)||add300Mission(b,root,windowPositions))return;
    if(addParkTower(b,root,windowPositions)||addHarrison(b,root,windowPositions)||add100Pine(b,root,windowPositions))return;
    if(addEmbarcaderoCenterWest(b,root,windowPositions))return;
    if(add500Folsom(b,root,windowPositions))return;
    if(addMetropolitanTowers(b,root,windowPositions)||addBayCrestWings(b,root,windowPositions))return;
    if(add425Market(b,root,windowPositions)||add199Fremont(b,root,windowPositions))return;
    if(add455Market(b,root,windowPositions))return;
    if(add333Market(b,root,windowPositions)||addCaliforniaCenter(b,root,windowPositions))return;
    if(addMarketCenter(b,root,windowPositions)||addMarketFlatiron(b,root,windowPositions))return;
    if(addAveryBuilding(b,root,windowPositions)||addPgeBuilding(b,root,windowPositions))return;
    if(addFiftyFremont(b,root,windowPositions)||addProvidianBuilding(b,root,windowPositions))return;
    if(addFolgerBuilding(b,root,windowPositions)||addHyattRegency(b,root,windowPositions))return;
    if(addFinancialDistrictBuilding(b,root,windowPositions))return;
    const harbor=harborBuilding(b,font);
    if(harbor){root.add(harbor.root);windowPositions.push(...harbor.windows);return;}
    const [cx,cz]=center(b.p),minH=b.minH||0;
    const family=b.parent||b.id,reference=architectureProfile(b);
    const market=marketArchitecture(b,detailedBuildings,font);
    if(market){if(market.root)root.add(market.root);windowPositions.push(...market.windows);return;}
    if(b.name==='Southern Pacific Building'||b.name==='One Market Plaza'){
      const detail=waterfrontLandmark(b,font);root.add(detail.root);windowPositions.push(...detail.windows);return;
    }
    if(addSurveyFront(mesh,b.id,b.h))return;
    const h=(!reference&&!hasNeighborhoodDetail(b)&&!hasShorelineFacade(b)&&!characterBuildings.has(b.name)&&!detailedWaterfrontNames.has(b.name)?surveyedHeight(b.id):undefined)??b.h;
    const background=backgroundFrontage(b,h,font);
    if(background){root.add(background.root);windowPositions.push(...background.windows);return;}
    const ribbed=b.name.includes('Embarcadero Center');
    const hotel=b.name.includes('Hyatt Regency');
    const historic=['Southern Pacific Building','The Audiffred Building','Ferry Station Post Office Building','Pier 1'].includes(b.name);
    const color=hasNeighborhoodDetail(b)?neighborhoodColor(b):referenceColor(b)??characterColors[b.name]??(b.name==='Southern Pacific Building'?'#ad765d':b.name==='The Audiffred Building'?'#b57e62':historic?'#d3c4a9':ribbed||hotel?'#d4cdb9':b.id===28240176?'#66828b':h>8?['#8ba8af','#7496a5','#b3bbb6','#a8b4b3'][family%4]:['#e1c193','#caab95','#d3ccac','#9fbab0','#cf9e87'][family%5]);
    if(!reference&&hasShorelineFacade(b)){
      const detail=shorelineFacade(b,detailedBuildings,color);root.add(detail.root);windowPositions.push(...detail.windows);return;
    }
    if(!reference&&!ribbed&&!hotel&&!historic&&!hasNeighborhoodDetail(b)&&!detailedWaterfrontNames.has(b.name)&&!characterBuildings.has(b.name)){
      downtownBuilding(surveyedShopfrontFactory(b,mesh),b,h,buildingParents.has(b.id));return;
    }
    if((ribbed||hotel)&&!reference)
      downtownBuilding(mesh,b,h,buildingParents.has(b.id),color);
    else mesh(footprintGeometry(b.p,h-minH),color,0,minH,0);
    if(detailedWaterfrontNames.has(b.name)){const detail=waterfrontLandmark(b,font);root.add(detail.root);windowPositions.push(...detail.windows);}
    if(characterBuildings.has(b.name)){const detail=buildingCharacter(b,detailedBuildings,font);root.add(detail.root);windowPositions.push(...detail.windows);}
    if(reference){const detail=referenceArchitecture(b,detailedBuildings,font);root.add(detail.root);windowPositions.push(...detail.windows);}
    if(b.id===944095688)root.add(modernBuildingAccents(b,detailedBuildings));
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
  }
  for(const building of [...detailedBuildings,...smallHarborBuildings]){
    addBuilding(building);
    if(shouldYield())yield 2;
  }
  const salesforce=createSalesforceTower(mappedBuildings.find(b=>b.name==='Salesforce Tower')!,nightInk,artClock);
  const transamerica=createTransamericaPyramid(mappedBuildings.find(b=>b.name==='Transamerica Pyramid')!);
  root.add(salesforce,transamerica.root);windowPositions.push(...transamerica.windows);
  const hall=ferryHall(font), ferryBuilding=hall.root;
  root.add(ferryBuilding);
  const clockTower=ferryClockTower(font);
  clockTower.root.position.set(hall.towerX,0,hall.towerZ);
  ferryBuilding.add(clockTower.root);
  const clockHands=clockTower.hands;
  const ferryFlag=clockTower.flag;
  // The full western crossing shares the city's map projection. W1 is the
  // shoreline transition; four suspension towers flank the central anchorage.
  const bridge=new THREE.Group();bridge.position.set(bridgeLayout.origin[0],0,bridgeLayout.origin[1]);bridge.rotation.y=bridgeLayout.angle;root.add(bridge);
  const deckLow=bridgeLayout.lowerDeck,deckHigh=bridgeLayout.upperDeck,bridgeEnd=bridgeLayout.length;
  addBridgeDeck(bridge,mesh,bridgeEnd,deckLow,deckHigh);
  addWestSpanTowers(bridge,mesh);
  addBridgeAnchorages(bridge,mesh,deckLow,deckHigh);
  yield 3;
  const cableLightPositions=addWestSpanSuspenders(bridge,mesh);
  const bayLights=createBayLights(cableLightPositions,artClock);bridge.add(bayLights.lights);
  const roadLightPositions:number[]=[];
  // Westbound driver photograph: AARoads, I-80 West, Bay Bridge. Both railings
  // carry swept silver arms, with a shallow lamp housing over the outer lane.
  const lampPole=new THREE.CylinderGeometry(.0048,.008,.51,8);
  const lampArm=new THREE.TubeGeometry(new THREE.CubicBezierCurve3(
    new THREE.Vector3(0,0,0),new THREE.Vector3(.046,.025,0),
    new THREE.Vector3(.071,.065,0),new THREE.Vector3(.143,.059,0)),6,.0038,6,false);
  const lampShell=new THREE.SphereGeometry(1,10,6);
  for(let i=0,z=1.2;z<bridgeEnd;z+=2.45,i++){
    const side=i%2===0?-1:1,x=side*.62,base=deckHigh+.0755;
    mesh(lampPole,'#929e9e',x,base+.255,z,bridge);
    const arm=mesh(lampArm,'#a2afae',x,base+.506,z,bridge);
    if(side>0)arm.rotation.y=Math.PI;
    const tip=x-side*.15;
    mesh(lampShell,'#9caba9',tip,base+.565,z,bridge).scale.set(.029,.009,.014);
    mesh(lampShell,'#dbdecd',tip,base+.560,z,bridge).scale.set(.026,.006,.011);
    roadLightPositions.push(tip,base+.552,z);
  }
  const roadLightMaterial=new THREE.PointsMaterial({color:'#ffdf9e',size:2,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  bridge.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(roadLightPositions,3)),roadLightMaterial));
  // Bents carry the city approach between the anchorage and the shore.
  for(const z of [0,7]){
    for(const x of [-.85,.85])box(.22,3.75,.3,x,1.7,z,'#a8b7b3',bridge);
    box(2.1,.19,.4,0,3.55,z,'#9aa9a5',bridge);
  }
  const updateApproach=buildApproachRoad(mesh,root);
  if(shouldYield())yield 3;
  buildApproachBlocks(mesh,root);
  buildApproachBillboards(mesh,root,font);
  if(shouldYield())yield 3;
  // Carry the viaduct from its west-span anchorage to the rising tunnel cut.
  const leadLength=10.1,leadMiddle=bridgeEnd+leadLength/2;
  for(const deck of [deckLow,deckHigh]){
    // Butt the lead-in to the span. Recess the upper concrete beneath the wearing surface.
    const westbound=deck===deckHigh;
    const lead=box(1.4,westbound?.126:.15,leadLength,0,deck-(westbound?.012:0),leadMiddle,'#91a1a0',bridge);
    if(!westbound)lead.userData.roadExposure=4;
    if(!westbound)for(const side of [-1,1])box(.065,.19,leadLength,side*.69,deck+.12,leadMiddle,'#a9b4a8',bridge);
  }
  box(1.135,.023,leadLength,0,deckHigh+.064,leadMiddle,'#728383',bridge).userData.roadExposure=3;
  addUpperParapet(bridge,mesh,bridgeEnd,bridgeEnd+leadLength,deckHigh+.0755);
  addBridgeMarkings(bridge,mesh,bridgeEnd,bridgeEnd+leadLength,deckHigh+.0755,true);
  for(const side of [-1,1])box(.19,2,1.05,side*.81,deckHigh-.60,bridgeEnd+8.6,'#a79e89',bridge);
  box(1.83,.22,1.15,0,deckHigh+.46,bridgeEnd+8.6,'#b9b09c',bridge);
  const vehiclePaint=streetVehicleMaterial();
  const bridgeTraffic=createBridgeTraffic(vehiclePaint),cars=bridgeTraffic.cars;
  bridge.add(bridgeTraffic.batch);
  const coffeeSign=new THREE.Group();coffeeSign.name='Hills Bros Coffee rooftop neon';root.add(coffeeSign);
  coffeeSign.position.set(hillsSign.point[0],1.505,hillsSign.point[1]);coffeeSign.rotation.y=.148;
  const coffeeMaterial=new THREE.MeshStandardMaterial({color:'#d93825',emissive:'#ff361a',emissiveIntensity:0,roughness:.44});
  const tubes=hillsCoffeeTubes(),signWidth=tubes.boundingBox!.max.x-tubes.boundingBox!.min.x;
  coffeeSign.scale.x=hillsSign.width/signWidth;
  const coffeeLetters=mesh(tubes,'#d93825',0,.32,.035,coffeeSign);coffeeLetters.name='HILLS BROS COFFEE';coffeeLetters.material=coffeeMaterial;
  // Low roof monitor and angled steel backstays below the exposed neon.
  const monitor=new THREE.Shape();monitor.moveTo(-.29,0);monitor.lineTo(.29,0);monitor.lineTo(.29,.092);monitor.lineTo(0,.245);monitor.lineTo(-.29,.092);monitor.closePath();
  const monitorRoof=mesh(new THREE.ExtrudeGeometry(monitor,{depth:signWidth+.10,bevelEnabled:false}),'#986b52',-(signWidth+.10)/2,0,-.21,coffeeSign);monitorRoof.rotation.y=Math.PI/2;
  for(let i=0;i<=8;i++){
    const x=signWidth*(i/8-.5);
    pole(new THREE.Vector3(x,.05,-.03),new THREE.Vector3(x,.84,-.03),.007,'#716e61',coffeeSign);
    pole(new THREE.Vector3(x,.07,-.48),new THREE.Vector3(x,.74,-.03),.008,'#757467',coffeeSign);
  }
  for(const y of [.28,.45,.77])box(signWidth,.014,.018,0,y,-.04,'#726a5a',coffeeSign);
  // Rincon Park, a curved lawn set between boulevard and bay.
  mesh(footprintGeometry(rinconGardenBorder,.009),'#9a9878',0,.108,0);
  for(const bed of waterfrontLandscape.areas.filter(a=>[32862580,1164309758,1164309759,1164309760].includes(a.id))){
    mesh(footprintGeometry(bed.p,.008),'#889969',0,.109,0);
  }
  for(const [u,v] of [[401,148],[415,145],[432,146],[451,150],[473,154],[494,159],[516,166],
    [540,175],[567,181],[650,209],[666,213],[685,220],[713,220],[732,218]]){
    const [x,z]=rinconPoint(u,v-4.5);
    const shrub=mesh(new THREE.IcosahedronGeometry(.06,1),'#828968',x,.13,z);shrub.scale.set(1.55,.59,1);
  }
  root.add(cupidsSpan(),rinconUplights());
  mesh(rinconKnoll(),'#ffffff',0,0,0).name='Rincon lawn knoll';
  mesh(rinconGrass(),'#ffffff',0,0,0).name='Rincon crest grasses';
  mesh(walkSurface(routes.rincon,routeWidth.rincon,.05),'#d4cbb7',0,0,0).name='Rincon shared promenade';
  for(const approach of [rinconApproach,rinconExit])mesh(walkSurface(approach,.24,.06),'#d4cbb7',0,0,0);
  // The wave-shaped seat walls sit in the scallops along the water side of the actual lawn.
  for(const points of [[[369,254],[378,254],[389,255],[401,258]],[[482,250],[498,250],[514,248],[530,243]],
    [[558,238],[575,237],[589,237],[605,240]]]){
    const curve=new THREE.CatmullRomCurve3(points.map(([u,v])=>{
      const [x,z]=rinconPoint(u,v);return new THREE.Vector3(x,rinconGround+.027,z);
    }));
    mesh(walkSurface(curve,.038,.065),'#cbbda3',0,0,0).name='Rincon concrete seat wall';
    for(const t of [.16,.33,.52,.70,.86]){
      const p=curve.getPointAt(t),r=.031;
      const bush=mesh(new THREE.IcosahedronGeometry(r,1),'#778a67',p.x,knollHeight(p.x,p.z-.045)+r*.32,p.z-.045);
      bush.scale.set(1.6,.74,1);
    }
  }
  // Surviving pile heads traced in the 2024 city orthophoto. The missing
  // piles and second row are visible from the promenade.
  for(const [v,start,count] of [[332,379,1],[325,440,2],[320,476,1],[317,492,2],
    [314,510,6],[308,510,3],[304,544,2],[300,570,6],[310,570,4],[295,604,3],
    [292,640,1],[290,657,1],[267,831,8],[277,832,8],[286,833,2]]){
    for(let k=0;k<count;k++){
      const [x,z]=rinconPoint(start+k*8.9,v-k*.94);
      const top=waterSurface.level+.043+.013*Math.sin(x*11),bottom=waterSurface.level-.28;
      mesh(new THREE.CylinderGeometry(.016,.021,top-bottom,8),'#788178',x,(top+bottom)/2,z);
    }
  }
  const railLine=[-37.70,-35.953,-31.273,-27.403,-25.6].map(x=>[x,seawallAt(x)!.z-.035]);
  linePath(railLine,.006,rinconGround+.061,'#839a91');
  for(let i=1;i<railLine.length;i++){
    const [ax,az]=railLine[i-1],[bx,bz]=railLine[i],n=Math.ceil(Math.hypot(bx-ax,bz-az)/.3);
    for(let j=0;j<n;j++){
      const x=ax+(bx-ax)*j/n,z=az+(bz-az)*j/n;
      pole(new THREE.Vector3(x,.012,z),new THREE.Vector3(x,rinconGround+.061,z),.004,'#6f8887');
    }
  }
  function waterfrontBench(x:number,y:number,z:number,angle=0){
    const g=new THREE.Group();g.name='Promenade bench';g.position.set(x,y,z);g.rotation.y=angle;g.scale.setScalar(.53);root.add(g);
    for(let slat=0;slat<3;slat++)box(.254,.010,.023,0,.048,-.024+slat*.025,'#ac9573',g);
    for(const dx of [-.098,.098]){
      box(.014,.048,.057,dx,.024,0,dark,g);
      box(.012,.065,.014,dx,.069,-.035,dark,g);
    }
    for(const y of [.079,.099])box(.254,.015,.010,0,y,-.041,'#a89170',g);
  }
  const plaza=embarcaderoPlaza();
  root.add(plaza);
  const rememberedWaterfront=createRememberedWaterfront(font,waterTime,nightInk);
  root.add(rememberedWaterfront);
  const fountainWater=rememberedWaterfront.getObjectByName(fountainWaterName)!;
  const art=laChiffonniere();
  art.position.set(1.068,plazaStandingHeight(plaza,1.068,-10.438),-10.438);root.add(art);
  for(const [x,z] of [[2.22,-8.74],[-5.26,-7.12],[-3.02,-7.09],[-1.02,-7.46]]){
    residentPositions.push({x,z,y:plazaStandingHeight(plaza,x,z)});
  }
  // Visitors gather on the grass, clear of the shared route, furnishings and sculpture.
  for(const [u,v] of [[350,222],[376,213],[396,236],[424,221],[474,230],[502,219],[556,225]]){
    const [x,z]=rinconPoint(u,v);residentPositions.push({x,z,y:knollHeight(x,z)});
  }
  // Glazed restaurant pavilions and terraces at the southern end of the park.
  // Terrace furniture on the water side of the pavilions. The tabletop is
  // 760 mm above the terrace, the chair seats 450 mm and parasols 2.3 m.
  for(const [i,[u,v]] of [[111,226],[117,230],[127,231],[143,233],[151,233],[78,214],[89,214]].entries()){
    const [x,z]=rinconPoint(u,v),ground=.11;
    mesh(new THREE.CylinderGeometry(.029,.029,.003,12),'#c8b898',x,ground+.0456,z);
    pole(new THREE.Vector3(x,ground,z),new THREE.Vector3(x,ground+.044,z),.003,dark);
    for(const dx of [-.044,.044]){
      box(.028,.003,.027,x+dx,ground+.027,z,'#8b9b83');
      for(const side of [-.010,.010])box(.0025,.027,.024,x+dx+side,ground+.0135,z,dark);
      box(.003,.022,.027,x+dx+Math.sign(dx)*.013,ground+.038,z,'#8b9b83');
    }
    if(i%3===1){
      mesh(new THREE.ConeGeometry(.072,.019,10),'#e0d1b1',x,ground+.138,z);
      pole(new THREE.Vector3(x,ground,z),new THREE.Vector3(x,ground+.138,z),.002,dark);
    }
  }
  root.add(harborPublicPiers(sfMap.piers,font));
  if(shouldYield())yield 3;
  root.add(ferryPublicRealm());
  // People meet on the granite paving or pause outside the restaurant threshold.
  residentPositions.push({x:-9.83,z:1.51,y:southPlazaTop+.009});
  for(const [x,z] of [[-9.67,1.48],[-9.18,.61],[-8.21,.23],[-7.57,1.25]])residentPositions.push({x,z,y:southPlazaTop});

  yield 4;
  const terminal=buildFerryTerminal(mesh,root);
  for(const entry of ferryConnections)root.add(ferryPortal(entry,font));
  mesh(walkSurface(routes.ferry,routeWidth.ferry,.016),'#bdb8a6',0,0,0).name='Ferry landing promenade';
  for(const [x,z] of [[-4.63,2.98],[-4.24,3.10],[-3.40,4.73],[-4.30,4.95],[-3.70,5.30],[-3.49,5.66]])residentPositions.push({x,z,y:.096,rearShopper:true});
  // Buckyball at the Exploratorium, north along the Embarcadero.
  const bucky=mesh(new THREE.IcosahedronGeometry(.58,0),'#bc985d',47.26,.9,.07);bucky.material=material('#bc985d');bucky.material.wireframe=true;
  addRinconPathLighting(root);
  const lanterns=buildPromenadeLighting(root);
  root.userData.ferryWalkPools=collectFerryWalkPools(root);
  root.userData.shelterPools=addSteuartShelterLights(root);
  const streetGlobes=collectStreetGlobes(root,lanterns);root.add(createSignalHousings());
  const streetcar=createStreetcar(),tram=streetcar.group;root.add(tram);
  // Rails and contact wire share the exact same centerline as the vehicle.
  buildStreetcarTrack(box,pole);
  addFerryMarketPlatforms(root);
  const ferryClock=ferryClockAt(new Date());
  const ferries=vessels.map((_,i)=>createServiceFerry(mesh,i));
  root.add(...ferries);
  for(const [i,ferry] of ferries.entries())for(const side of [-1,1]){
    const vessel=vessels[i];
    if(vessel.family!=='dorado'){
      const small=vessel.family==='prop',gga=vessel.family==='spaulding'||vessel.family==='mendocino';
      const title=small?'TREASURE ISLAND':gga?'GOLDEN GATE FERRY':'SAN FRANCISCO BAY FERRY';
      const flank=side*vessel.beam*.03*(small?.83:.93);
      const name=lettering(vessel.name.toUpperCase(),small?.017:.026,.01,vessel.sill+.032,flank,'#304757',ferry);
      const operator=lettering(title,small?.011:.018,-vessel.length*.007,vessel.sill+.032,flank,'#31485b',ferry);
      name.rotation.y=operator.rotation.y=side<0?Math.PI:0;
      name.scale.z=operator.scale.z=.05;
      continue;
    }
    const name=lettering(ferry.name.toUpperCase(),.092,1.445,.563,side*.766,'#344e5d',ferry);
    name.rotation.y=side<0?Math.PI:0;
    const operator=lettering('SAN FRANCISCO BAY FERRY',.059,-.36,1.066,side*.762,'#476570',ferry);
    operator.rotation.y=side<0?Math.PI:0;
  }
  const ferryMarket=createFerryMarket();root.add(ferryMarket.root);
  if(shouldYield())yield 4;
  waterfrontBench(-26.917,.11,.125,.11);
  for(const x of [-21,31,34]){
    const edge=seawallAt(x);
    if(edge)waterfrontBench(x,-.01,edge.z-.18,-edge.angle);
  }
  // A swimming sea lion beside Pier 7.
  const seaLion=new THREE.Group();seaLion.position.set(24,waterHeight(24,8,0)-.011,8);seaLion.scale.setScalar(.073);seaLion.rotation.y=-.35;root.add(seaLion);
  const sealBody=mesh(new THREE.SphereGeometry(.42,10,7),'#786148',0,.15,0,seaLion);sealBody.scale.set(2.2,.75,.82);
  const sealNeck=mesh(new THREE.SphereGeometry(.3,9,6),'#786148',.7,.2,0,seaLion);sealNeck.scale.set(.9,.7,.8);
  mesh(new THREE.SphereGeometry(.30,12,9),'#98704f',.94,.3,0,seaLion);
  mesh(new THREE.SphereGeometry(.04,5,4),dark,1.15,.27,0,seaLion);
  for(const z of [-.17,.17])mesh(new THREE.SphereGeometry(.025,5,4),dark,1.08,.37,z,seaLion);
  const sealFlippers:THREE.Mesh[]=[];
  for(const side of [-1,1]){const flipper=mesh(new THREE.SphereGeometry(.2,7,5),'#786148',-.15,-.02,side*.4,seaLion);flipper.scale.set(1.5,.18,.55);flipper.rotation.y=side*.4;sealFlippers.push(flipper);}
  const walkerCount=waterfrontWalkerCount();
  const skaters=createPlazaSkaters();root.add(skaters.root);
  const passengerStart=walkerCount+residentPositions.length,seatStart=passengerStart+ferryPassengerCount;
  const people=createPeople(seatStart+pier14Visitors.length,pier14Visitors.length);
  for(let i=0;i<walkerCount;i++){
    const poseAt=(offset:number)=>waterfrontWalker(offset,i);
    const p=poseAt(0);
    people.update(i,p.x,p.z,0,1,p.y,0,p.standing,p.heading,poseAt);
  }
  residentPositions.forEach((p,i)=>people.update(walkerCount+i,p.x,p.z,0,i%2?1:-1,p.y,0,true));
  updateFerryPassengers(people,passengerStart,0,ferryPose(0,0,ferryClock),-1);
  updatePier14Visitors(people,seatStart,pier14Visitors,0);
  people.flush();const pedestrians=people.group;root.add(pedestrians);
  const walkers=people.bodies,walkerHeads=people.heads;
  const convoy=createWaterfrontTraffic(vehiclePaint),streetCars=convoy.root,traffic=convoy.traffic;
  root.add(streetCars);
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
    const bird=new THREE.Group();bird.scale.setScalar(.061);gulls.add(bird);
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
  const windowMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.8,emissive:0xffffff,emissiveIntensity:0,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  const facadeClock=createFacadeClock();
  applyWindowLighting(windowMaterial,bayLights.clock,facadeClock.litShare,facadeClock.night);
  const windowGeometry=new THREE.PlaneGeometry(1,1);
  windowGeometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),Math.hypot(.533,.554));
  windowGeometry.setAttribute('windowGlow',new THREE.InstancedBufferAttribute(new Float32Array(windowPositions.map(windowGlow)),1));
  const windowMesh=new THREE.InstancedMesh(windowGeometry,windowMaterial,windowPositions.length);
  const dummy=new THREE.Object3D();
  windowPositions.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.ry,0);dummy.scale.set(p.w,p.h,1);dummy.updateMatrix();windowMesh.setMatrixAt(i,dummy.matrix);windowMesh.setColorAt(i,new THREE.Color().setScalar((Math.sin(i*12.9898)*43758.5453)%1>.0?1:.72));});root.add(windowMesh);
  const sailboats=[createDaySailer('#aa5038'),createDaySailer('#386676')];root.add(...sailboats);
  const fireboat=createFireboat(nightInk);root.add(fireboat.root);
  // Merge static architecture by material. Detail increases without thousands of draw calls.
  root.updateMatrixWorld(true);
  yield 5;
  const architectureMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:.02,side:THREE.FrontSide});
  prepareFerryTerminalTide(terminal);
  const tidalPanes=windowPositions.flatMap((p,i)=>p.tide?[{i,y:p.y}]:[]);
  function updateTide(offset:number,updatePane?:(i:number)=>void){
    water.position.y=waterSurface.level+offset;updateTidalChunks(offset);
    for(const {i,y} of tidalPanes){windowMesh.instanceMatrix.array[i*16+13]=y+offset;updatePane?.(i);}
    if(tidalPanes.length)windowMesh.instanceMatrix.needsUpdate=true;
  }
  const moving=new Set<THREE.Object3D>([ferryFlag,salesforce.getObjectByName('Perforated aluminum lantern')!,root.getObjectByName('Market granite and herringbone promenade')!,root.getObjectByName('Halprin brick court')!,root.getObjectByName(padelScreenName)!,root.getObjectByName(howardGlassName)!,rememberedWaterfront.getObjectByName('Sinbad display glass')!,...sailboats,fireboat.root,coffeeLetters,bucky,water,fountainWater,windowMesh,tram,gulls,pedestrians,streetCars,skaters.root,seaLion,...cyclists,...ferries,bridgeTraffic.batch,...clockHands.flatMap(h=>[h.minute,h.hour])]);
  const staticMeshes:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]=[];
  root.traverse(o=>{
    if(!(o instanceof THREE.Mesh)||o instanceof THREE.InstancedMesh)return;
    for(let parent:THREE.Object3D|null=o;parent;parent=parent.parent)if(moving.has(parent))return;
    staticMeshes.push(o);
  });
  // A few depth units separate thin paint from pavement even at grazing angles.
  const roadPaintMaterial=architectureMaterial.clone();
  roadPaintMaterial.polygonOffset=true;roadPaintMaterial.polygonOffsetUnits=-3;
  // Flat markings share three draws. Their index ranges still cull by distance
  // through installOrderedArchitecture, including from the driver's seat.
  const paintRegions=new Map<string,typeof staticMeshes>();
  for(const m of staticMeshes){
    const region=m.geometry.userData.roadPaint;
    if(!region)continue;
    const parts=paintRegions.get(region);
    if(parts)parts.push(m);else paintRegions.set(region,[m]);
  }
  const paintChunks=Array.from(paintRegions,([region,parts])=>{
    const chunk=bakeRigidChunk(region+' paint',parts,roadPaintMaterial);
    chunk.castShadow=false;installOrderedArchitecture(chunk,1300);return chunk;
  });
  const walkMaterial=architectureMaterial.clone();applyWalkPanelJoints(walkMaterial);
  const facadeMaterial=architectureMaterial.clone();

  applyDowntownGlazing(facadeMaterial,facadeClock);
  const leafSun={value:new THREE.Vector3()};
  const canopyMaterial=createCanopyMaterial(architectureMaterial,leafSun);
  const treeBatches=bakeTreeBatches(staticMeshes,canopyMaterial);
  const treeDraw=createTreeDraw(treeBatches,canopyMaterial);if(treeDraw)root.add(treeDraw);
  if(shouldYield())yield 5;
  function* bakeSection(parts:typeof staticMeshes,mat:THREE.MeshStandardMaterial){
    const blocks=bakeBlockGroups(parts,mat,shouldYield);
    let block=blocks.next();
    while(!block.done){yield 5;block=blocks.next();}
    return block.value;
  }
  const ordinary=staticMeshes.filter(m=>!m.userData.plantAnchor&&!m.geometry.userData.roadPaint&&
    !m.geometry.hasAttribute('facadeGrid')&&!m.geometry.hasAttribute('walkPanel')&&!m.geometry.hasAttribute('billboardPrint')&&!m.geometry.hasAttribute('kioskPrint'));
  const architectureChunks=yield* bakeSection(ordinary,architectureMaterial);
  architectureChunks.push(...paintChunks);
  // Each print atlas uses one material for every street and rooftop mount.
  architectureChunks.push(bakeRigidChunk('Waterfront poster faces',staticMeshes.filter(m=>m.geometry.hasAttribute('billboardPrint')),billboardPrintMaterial()));
  const kioskPrints=staticMeshes.filter(m=>m.geometry.hasAttribute('kioskPrint'));
  if(kioskPrints.length)architectureChunks.push(bakeRigidChunk('Kiosk campaign prints',kioskPrints,kioskCampaignMaterial()));
  for(const [attribute,mat] of [['walkPanel',walkMaterial],['facadeGrid',facadeMaterial]] as const){
    const chunks=yield* bakeSection(staticMeshes.filter(m=>m.geometry.hasAttribute(attribute)),mat);
    architectureChunks.push(...chunks);
  }
  yield 6;
  const updateTidalChunks=createTideUpdater(architectureChunks);
  for(const chunk of architectureChunks){
    installOrderedArchitecture(chunk);
    if(shouldYield())yield 6;
  }
  const illuminatedArchitecture=architectureMaterial.clone();
  for(const chunk of architectureChunks)if(chunk.geometry.hasAttribute('signLight'))chunk.material=illuminatedArchitecture;
  root.add(...architectureChunks);
  retireBakedMeshes(staticMeshes);
  // Keep each moving object intact while batching its own small components.
  const ferryPaint=serviceFerryPaint;
  bakePccBody(tram,streetcar.glazing,streetcar.lamp);
  for(const group of [...ferries,...cyclists]) {
    const isFerry=ferries.includes(group);
    const boardingBody=group.children.find(o=>o.userData.pyxisBoardingBody) as THREE.Mesh|undefined;
    group.updateMatrixWorld(true);
    const inverse=new THREE.Matrix4().copy(group.matrixWorld).invert();
    const batches=new Map<THREE.Material,{geometries:THREE.BufferGeometry[];objects:THREE.Mesh[]}>();
    group.traverse(o=>{
      if(!(o instanceof THREE.Mesh)||o===boardingBody)return;
      const source=o.material as THREE.MeshStandardMaterial;
      const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
      // Solid livery and opaque glazing share a draw. A separate transparent
      // or lit part can still supply its own material.
      const solidFerryPaint=isFerry&&source instanceof THREE.MeshStandardMaterial&&!source.transparent&&!source.map&&!source.vertexColors&&
        source.opacity===1&&source.emissive.getHex()===0&&source.roughness===.86&&source.metalness===.02;
      const mat=solidFerryPaint?ferryPaint:source;
      if(mat===ferryPaint)g.deleteAttribute('uv');
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
      if(boardingBody&&mat===ferryPaint){
        // Keep the hull's original vertex indices so the sliding door and
        // the rigid hull lettering can share the same draw and position buffer.
        for(const part of batch.geometries)part.setIndex(Array.from({length:part.getAttribute('position').count},(_,i)=>i));
        const hull=boardingBody.geometry;
        const painted=mergeGeometries([hull,...batch.geometries]);
        if(!painted)throw new Error('Boarding ferry lettering merge failed');
        boardingBody.geometry=painted;hull.dispose();
        batch.objects.forEach(o=>{o.removeFromParent();o.geometry.dispose();});
        batch.geometries.forEach(g=>g.dispose());
        return;
      }
      const g=mergeGeometries(batch.geometries);if(!g)throw new Error('Moving object merge failed');
      batch.objects.forEach(o=>{o.parent?.remove(o);o.geometry.dispose();});batch.geometries.forEach(g=>g.dispose());
      const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;group.add(m);
    });
  }
  const ferryMaterials=new Set<THREE.Material>();
  for(const [i,boat] of ferries.entries()){
    const vessel=vessels[i];
    const bridgeSill=vessel.family==='dorado'?1.47:vessel.sill+(vessel.family==='prop'?2.1:5)*.06;
    boat.traverse(part=>{
      if(!(part instanceof THREE.Mesh)||part.material!==ferryPaint)return;
      part.material=ferryPaint.clone();
      ferryMaterials.add(part.material);
      bindVesselLighting(boat,part,nightInk,bridgeSill);
    });
  }
  for(const object of moving)object.traverse(child=>{child.castShadow=false;});
  const transit=createPromenadeTransit();root.add(transit.root);
  if(shouldYield())yield 6;
  // One small, tileable sheet holds wash density, dried wash edges and paper tooth.
  // All three fields share mip levels, so the pigment resolves into a continuous tint at a distance.
  const tileSide=128,grainBytes=new Uint8Array(tileSide*tileSide*4);
  let seed=1921;
  function lattice(cols:number,rows:number){
    const cells=Array.from({length:cols*rows},()=>{
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      return seed/4294967296;
    });
    return (u:number,v:number)=>{
      const x=u*cols,y=v*rows,ix=Math.floor(x),iy=Math.floor(y);
      const fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
      const at=(dx:number,dy:number)=>cells[((iy+dy)%rows)*cols+(ix+dx)%cols];
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(0,0),at(1,0),sx),THREE.MathUtils.lerp(at(0,1),at(1,1),sx),sy);
    };
  }
  const wash=lattice(5,6),brokenEdge=lattice(13,17),tooth=lattice(53,91);
  for(let y=0;y<tileSide;y++)for(let x=0;x<tileSide;x++){
    const u=x/tileSide,v=y/tileSide,i=(y*tileSide+x)*4;
    const tide=wash(u,v)*.76+brokenEdge(u,v)*.24;
    const rim=1-THREE.MathUtils.smoothstep(Math.abs(tide-.4),.006,.061);
    grainBytes[i]=Math.round(tide*255);grainBytes[i+1]=Math.round(rim*255);
    grainBytes[i+2]=Math.round(tooth(u,v)*255);grainBytes[i+3]=255;
  }
  const pigment=new THREE.DataTexture(grainBytes,tileSide,tileSide,THREE.RGBAFormat);
  pigment.wrapS=pigment.wrapT=THREE.RepeatWrapping;pigment.generateMipmaps=true;
  pigment.minFilter=THREE.LinearMipmapLinearFilter;pigment.magFilter=THREE.LinearFilter;pigment.needsUpdate=true;
  architectureMaterial.addEventListener('dispose',()=>pigment.dispose());
  const seaMist={value:new THREE.Vector2()};
  const rainOnStone={value:0};
  const edgeFogColor={value:new THREE.Color('#d6e4e6')};
  const hazeMaterials=new Set<THREE.MeshStandardMaterial|THREE.MeshBasicMaterial>([architectureMaterial,windowMaterial,waterMaterial]);
  root.traverse(o=>{if(o instanceof THREE.Mesh){for(const mat of Array.isArray(o.material)?o.material:[o.material])if(mat instanceof THREE.MeshStandardMaterial||mat instanceof THREE.MeshBasicMaterial)hazeMaterials.add(mat);}});
  for(const mat of hazeMaterials){
    // Keep printed lettering, glass, water, and transparent wakes on their own material treatments.
    const washSurface=mat instanceof THREE.MeshStandardMaterial&&!mat.transparent&&!mat.map&&
      mat!==windowMaterial&&mat!==waterMaterial&&mat.roughness>.55;
    const marine=mat===waterMaterial||ferryMaterials.has(mat);
    const previousCompile=mat.onBeforeCompile;
    const previousCacheKey=mat.customProgramCacheKey();
    mat.onBeforeCompile=(shader,renderer)=>{
      previousCompile.call(mat,shader,renderer);
      if(washSurface||mat===windowMaterial)shader.fragmentShader=paintedLight(shader.fragmentShader);
      if(mat===windowMaterial){
        shader.uniforms.glassSky=facadeClock.glassSky;
        shader.fragmentShader='uniform vec3 glassSky;\n'+shader.fragmentShader.replace('#include <color_fragment>',
          '#include <color_fragment>\ndiffuseColor.rgb*=glassSky;');
      }
      if(mat===architectureMaterial||mat===facadeMaterial||mat===illuminatedArchitecture){
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
          '#include <color_fragment>\ndiffuseColor.rgb*=mix(.90,1.10,clamp(harborPosition.y/13.,0.,1.));');
      }
      if(marine){shader.uniforms.bayHorizon=bayWeather.bayHorizon;shader.fragmentShader='uniform vec3 bayHorizon;\n'+shader.fragmentShader;}
      shader.uniforms.edgeFogColor=edgeFogColor;shader.uniforms.seaMistBank=seaMist;shader.uniforms.rainOnStone=rainOnStone;
      shader.uniforms.pigmentSheet={value:pigment};shader.uniforms.nightInk=nightInk;
      shader.vertexShader='varying vec3 pigmentPosition; varying vec3 harborPosition;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec4 harborWorld=vec4(transformed,1.0);
        #ifdef USE_BATCHING
          harborWorld=batchingMatrix*harborWorld;
        #endif
        #ifdef USE_INSTANCING
          harborWorld=instanceMatrix*harborWorld;
        #endif
        harborPosition=(modelMatrix*harborWorld).xyz;
        pigmentPosition=transformed;`);
      if(mat===illuminatedArchitecture){
        shader.vertexShader='attribute vec3 signLight; varying vec3 nightSignLight;\n'+
          shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nnightSignLight=signLight;');
      }
      shader.fragmentShader='uniform float rainOnStone; uniform vec2 seaMistBank; uniform float nightInk; uniform sampler2D pigmentSheet; varying vec3 pigmentPosition; uniform vec3 edgeFogColor; varying vec3 harborPosition;\n'+shader.fragmentShader.replace('#include <fog_fragment>',`
        float value=dot(gl_FragColor.rgb,vec3(.24,.61,.15));
        ${washSurface?`
        // Oblique coordinates span quay paving, wall faces and roofs continuously.
        vec2 paper=pigmentPosition.xz+pigmentPosition.y*vec2(.34,.86);
        vec3 sheet=texture2D(pigmentSheet,paper*.145).rgb;
        float tooth=texture2D(pigmentSheet,paper*.43+vec2(.27,.61)).b;
        float middle=smoothstep(.12,.39,value)*(1.-smoothstep(.78,.98,value));
        float density=(sheet.r-.5)*.15+sheet.g*.028+(tooth-.5)*.033;
        gl_FragColor.rgb*=1.-density*middle*(1.-nightInk*.62);
        // Cool pigments collect in half-shadow. Sun-facing paper retains its light.
        float shade=(1.-smoothstep(.31,.72,value))*smoothstep(.065,.26,value);
        gl_FragColor.rgb*=mix(vec3(1.),vec3(.89,.96,1.07),shade*(.56+.44*sheet.r)*(1.-nightInk*.6));
        float sunlit=smoothstep(.59,.92,value)*(1.-nightInk);
        gl_FragColor.rgb+=vec3(.022,.012,.001)*sunlit;
        // Rain darkens paving and leaves a broken reflection of the silver sky along the quay.
        if(rainOnStone>.005 && harborPosition.y>-.055 && harborPosition.y<.19){
          float upFacing=smoothstep(.89,.995,inverseTransformDirection(normal,viewMatrix).y);
          float green=diffuseColor.g-max(diffuseColor.r,diffuseColor.b);
          float paved=upFacing*(1.-smoothstep(.008,.035,green));
          float damp=paved*rainOnStone;
          float grazing=1.-abs(normalize(cameraPosition-harborPosition).y);
          float sheen=smoothstep(.35,.72,sheet.r)*grazing*grazing*.24;
          gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*.74+edgeFogColor*sheen,damp);
        }
        `:''}
        ${mat===waterMaterial?'':`
        gl_FragColor.rgb*=mix(vec3(1.),vec3(.77,.85,.99),nightInk);
         ${mat===illuminatedArchitecture?'gl_FragColor.rgb+=nightSignLight*smoothstep(.18,.95,nightInk);':''}`}
        float sightline=distance(cameraPosition,harborPosition);
        ${marine?'':`float boundary=max(smoothstep(65.,102.,harborPosition.x),smoothstep(128.,198.,-harborPosition.z));
        float edgeHaze=max(boundary*smoothstep(18.,112.,sightline)*${mat===waterMaterial||mat.transparent?'1.0':'.51'},
          smoothstep(42.,180.,sightline)*mix(.15,.075,nightInk));
        gl_FragColor.rgb=mix(gl_FragColor.rgb,edgeFogColor,edgeHaze);`}
        if(seaMistBank.x>.005){
          float bank=texture2D(pigmentSheet,harborPosition.xz*.006+vec2(seaMistBank.y*.00048,0.)).r;
          float below=1.-smoothstep(.2,5.4,harborPosition.y+(bank-.5)*5.);
          float depth=smoothstep(12.,104.,sightline);
          gl_FragColor.rgb=mix(gl_FragColor.rgb,edgeFogColor,seaMistBank.x*below*depth*(.20+.34*bank));
        }
        ${marine?marineDistanceFog:'#include <fog_fragment>'}`);
      if(mat===illuminatedArchitecture)shader.fragmentShader='varying vec3 nightSignLight;\n'+shader.fragmentShader;
    };
    mat.customProgramCacheKey=()=> `${previousCacheKey}|waterfront-wash-v5|${marine}|${washSurface}|${mat===architectureMaterial}|${mat===waterMaterial||mat.transparent}|${mat===illuminatedArchitecture?'|sign-lights':''}`;
  }
  // Haloes share one transparent batch and sit at the coordinates of the promenade lamps.
  const lampGlow=new THREE.PointsMaterial({color:'#ffb45e',size:.105,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:true,opacity:0});
  lampGlow.onBeforeCompile=shader=>{
    // The inventory locates the bulb center, behind its opaque glass model.
    // Draw its glow on the near glass face, retaining depth occlusion by the city.
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      mvPosition.xyz-=normalize(mvPosition.xyz)*.024;
      gl_Position=projectionMatrix*mvPosition;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float lens=length(gl_PointCoord-vec2(.5))*2.;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.82,.49),1.-smoothstep(.09,.31,lens));
    diffuseColor.a*=exp(-5.*lens*lens)*(1.-smoothstep(.6,1.,lens));`);};
  const glowGeometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(streetGlobes,3));
  const pierLamps=new THREE.Points(glowGeometry,lampGlow);pierLamps.name='Waterfront streetlamp halos';root.add(pierLamps);
  const hitTargets:THREE.Mesh[]=[];
  const hitMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
  for(const [name,x,y,z,w,h,d] of [['waterfront',0,2.2,0,16,4.7,3],['bridge',bridgePoint(0,36.85).x,4.8,bridgePoint(0,36.85).z,2.8,10,2.8],['pyramid',26.75,7.8,-40.4,3,16,3]] as const){
    const target=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),hitMaterial);target.position.set(x,y,z);target.userData.landmark=name;root.add(target);hitTargets.push(target);
  }
  if(shouldYield())yield 6;
  const reliefStages=bayReliefStages(shouldYield);
  let part=reliefStages.next();
  while(!part.done){yield 6;part=reliefStages.next();}
  const relief=part.value;root.add(relief.root);
  const boardingBrows=createBoardingBrows(ferries.length);
  root.add(boardingBrows.mesh);
  ferries.forEach((boat,i)=>{
    const pose=ferryPose(0,i,ferryClock);
    setVesselLightingPhase(boat,pose.phase);
    boat.position.set(pose.x,pose.y,pose.z);boat.rotation.y=pose.heading;
    boardingBrows.update(i,pose);
  });
  freezeBakedArchitecture(root,architectureChunks,moving);
  const result={ root, tidalPanes,updateTide, windowMesh, clockCenter:new THREE.Vector3(hall.towerX,2.035,hall.towerZ), seatStart, updateFerryPassengers, updatePyxisBoardingDoor, glassSky:facadeClock.glassSky,setFacadeClock:facadeClock.setFacadeClock, pier14Visitors, ferryClock, streetGlobes, boardingBrows, updateBridgeTraffic:bridgeTraffic.update, updateTraffic:convoy.update, walkerCount, skaters:skaters as ReturnType<typeof createPlazaSkaters>|undefined, transit:transit as typeof transit|undefined, ferryFlag:ferryFlag as typeof ferryFlag|undefined, leafSun, treeDraw, treeBatches, ferryMarket, lampGlow, nightInk, relief, updateApproach, updateMarina:southernWaterfront.updateMarina, hullShadows, ...bayWeather, sailboats, fireboat:fireboat as ReturnType<typeof createFireboat>|undefined, architectureChunks, residentPositions, coffeeMaterial, ferryConnections, pierSupports, people, streetcarGlazing:streetcar.glazing, streetcarLamp:streetcar.lamp, seaMist, rainOnStone, bayLights, roadLightMaterial, edgeFogColor, waterMaterial, waterTime, windowMaterial, ferries, cars, tram, gulls, birds, walkers, walkerHeads, traffic, cyclists, seaLion, sealFlippers, hitTargets, clockHands, ferryBuilding };
  return result;
}


// Offline geometry checks and the small portfolio vignettes use the same builder.
export function createLandscape() {
  const stages=landscapeStages();
  let step=stages.next();
  while(!step.done)step=stages.next();
  cityTemplate=step.value;
  return step.value;
}

export function rememberLandscape(world:ReturnType<typeof createLandscape>){
  cityTemplate=world;
  return world;
}

// The page owns one city template. Vignettes reuse its geometry, never reconstruct it.
let cityTemplate:ReturnType<typeof createLandscape>|undefined;
export function createCityVignette(variant:'street'|'plaza'):ReturnType<typeof createLandscape>{
  const source=cityTemplate||createLandscape(),root=new THREE.Group(),waterTime={value:0};
  root.userData.ferryWalkPools=source.root.userData.ferryWalkPools;
  root.userData.shelterPools=source.root.userData.shelterPools;
  const bounds=variant==='street'?new THREE.Box3(new THREE.Vector3(-62,-5,-28),new THREE.Vector3(-15,40,14)):new THREE.Box3(new THREE.Vector3(-22,-5,-32),new THREE.Vector3(32,40,22));
  const facadeClock=createFacadeClock();
  const streetGlobes:number[]=[];
  const globePoint=new THREE.Vector3();
  for(let i=0;i<source.streetGlobes.length;i+=3){
    globePoint.fromArray(source.streetGlobes,i);
    if(bounds.containsPoint(globePoint))streetGlobes.push(globePoint.x,globePoint.y,globePoint.z);
  }
  const lampGlow=source.lampGlow.clone();
  lampGlow.onBeforeCompile=source.lampGlow.onBeforeCompile;
  const haloGeometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(streetGlobes,3));
  const halos=new THREE.Points(haloGeometry,lampGlow);halos.name='Waterfront streetlamp halos';root.add(halos);
  const materialCopies=new Map<THREE.Material,THREE.Material>();
  function copiedMaterial(mat:THREE.Material){
    let copy=materialCopies.get(mat);if(!copy){copy=mat.clone();copy.onBeforeCompile=mat.onBeforeCompile;copy.customProgramCacheKey=mat.customProgramCacheKey;
      if(mat.userData.surveyedDowntownGlazing||mat===source.windowMaterial)bindFacadeClock(copy,facadeClock);
      materialCopies.set(mat,copy);}return copy;
  }
  function copyMesh(mesh:THREE.Mesh){const m=mesh.clone();m.geometry=mesh.geometry;m.userData.sharedGeometry=true;m.material=Array.isArray(mesh.material)?mesh.material.map(copiedMaterial):copiedMaterial(mesh.material);return m;}
  const treeBatches=source.treeBatches.filter(t=>t.high.boundingBox!.intersectsBox(bounds)).map(t=>{const mesh=copyMesh(t.mesh);return {...t,mesh};});
  const treeDraw=source.treeDraw&&createTreeDraw(treeBatches,copiedMaterial(source.treeDraw.material));if(treeDraw)root.add(treeDraw);
  const architectureChunks=source.architectureChunks.filter(m=>m.geometry.boundingBox!.intersectsBox(bounds)).map(m=>{
    const copy=copyMesh(m),geometry=cloneTidalGeometry(m.geometry);
    if(geometry){copy.geometry=geometry;delete copy.userData.sharedGeometry;}
    root.add(copy);return copy;
  });
  const updateVignetteTide=createTideUpdater(architectureChunks);
  // Only window instances inside the vignette are copied to its renderer.
  const original=source.windowMesh;
  const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),indices:number[]=[];
  for(let i=0;i<original.count;i++){original.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);if(bounds.containsPoint(point))indices.push(i);}
  const windowMaterial=copiedMaterial(source.windowMaterial) as THREE.MeshStandardMaterial;
  // The tiny plane is copied so the filtered instance attributes match the vignette.
  const windowGeometry=original.geometry.clone(),glow=original.geometry.getAttribute('windowGlow');
  windowGeometry.setAttribute('windowGlow',new THREE.InstancedBufferAttribute(new Float32Array(indices.map(i=>glow.getX(i))),1));
  const windows=new THREE.InstancedMesh(windowGeometry,windowMaterial,indices.length);
  indices.forEach((index,i)=>{original.getMatrixAt(index,matrix);windows.setMatrixAt(i,matrix);const color=new THREE.Color();original.getColorAt(index,color);windows.setColorAt(i,color);});root.add(windows);
  const tidalPanes=source.tidalPanes.map(({i,y})=>({i:indices.indexOf(i),y})).filter(p=>p.i>=0);
  const water=new THREE.Mesh(vignetteBaySurfaceGeometry(),new THREE.MeshStandardMaterial({color:'#a5ccd1',roughness:.65,metalness:.1}));water.rotation.x=-Math.PI/2;water.position.y=waterSurface.level;water.receiveShadow=true;root.add(water);
  const residents=source.residentPositions.filter(p=>bounds.containsPoint(new THREE.Vector3(p.x,p.y,p.z)));
  const walkerCount=waterfrontWalkerCount(variant);
  const skaters=variant==='plaza'&&source.skaters?createPlazaSkaters(copiedMaterial(source.skaters.material) as THREE.MeshStandardMaterial):undefined;if(skaters)root.add(skaters.root);
  const visitors=source.pier14Visitors.filter(p=>bounds.containsPoint(new THREE.Vector3(p.x,.06,p.z)));
  const seatStart=walkerCount+residents.length;
  const people=createPeople(seatStart+visitors.length,visitors.length);people.group.traverse(o=>{o.castShadow=false;});root.add(people.group);
  for(let i=0;i<walkerCount;i++){
    const poseAt=(offset:number)=>waterfrontWalker(offset,i,variant);
    const p=poseAt(0);
    people.update(i,p.x,p.z,0,1,p.y,0,p.standing,p.heading,poseAt);
  }
  residents.forEach((p,i)=>people.update(walkerCount+i,p.x,p.z,0,i%2?1:-1,p.y,0,true));
  updatePier14Visitors(people,seatStart,visitors,0);people.flush();
  const cyclists=variant==='street'?source.cyclists.map(bike=>{
    const copy=bike.clone();
    copy.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.sharedGeometry=true;o.material=Array.isArray(o.material)?o.material.map(copiedMaterial):copiedMaterial(o.material);}});
    root.add(copy);return copy;
  }):[];
  const tram=source.tram.clone();tram.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.sharedGeometry=true;o.material=Array.isArray(o.material)?o.material.map(copiedMaterial):copiedMaterial(o.material);}});root.add(tram);
  const convoy=createWaterfrontTraffic(copiedMaterial(source.traffic[0].material as THREE.MeshStandardMaterial) as THREE.MeshStandardMaterial,variant,source.traffic);
  const traffic=convoy.traffic;root.add(convoy.root);
  source.root.updateMatrixWorld(true);
  source.root.traverse(o=>{if(o instanceof THREE.Mesh&&o.material===source.coffeeMaterial&&variant==='street'){const copy=copyMesh(o);copy.matrix.copy(o.matrixWorld);copy.matrix.decompose(copy.position,copy.quaternion,copy.scale);root.add(copy);}});
  if(variant==='street'){
    const sourceGlass=source.root.getObjectByName(howardGlassName) as THREE.Mesh;
    const glass=copyMesh(sourceGlass);sourceGlass.matrixWorld.decompose(glass.position,glass.quaternion,glass.scale);root.add(glass);
  }
  // The plaza shares the fountain geometry while following its own pausable clock.
  if(variant==='plaza'){
    for(const name of ['Market granite and herringbone promenade','Halprin brick court',padelScreenName]){
      const paving=source.root.getObjectByName(name) as THREE.Mesh;
      const walk=copyMesh(paving);
      paving.matrixWorld.decompose(walk.position,walk.quaternion,walk.scale);root.add(walk);
    }
    const glass=source.root.getObjectByName('Sinbad display glass') as THREE.Mesh;
    const glazing=copyMesh(glass);glass.matrixWorld.decompose(glazing.position,glazing.quaternion,glazing.scale);root.add(glazing);
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
  const ferryFlag=variant==='plaza'&&source.ferryFlag?createFerryFlag():undefined;
  if(ferryFlag&&source.ferryFlag){
    source.ferryFlag.matrixWorld.decompose(ferryFlag.position,ferryFlag.quaternion,ferryFlag.scale);
    root.add(ferryFlag);
  }
  const ferryMarket=variant==='plaza'?createFerryMarket():source.ferryMarket;if(variant==='plaza')root.add(ferryMarket.root);
  const transit=variant==='plaza'&&source.transit?createPromenadeTransit(copiedMaterial(source.transit.batch.material) as THREE.MeshStandardMaterial):undefined;if(transit)root.add(transit.root);
  return {...source,root,windowMesh:windows,tidalPanes,updateTide:(offset:number,updatePane?:(i:number)=>void)=>{
    water.position.y=waterSurface.level+offset;updateVignetteTide(offset);
    for(const {i,y} of tidalPanes){windows.instanceMatrix.array[i*16+13]=y+offset;updatePane?.(i);}
    if(tidalPanes.length)windows.instanceMatrix.needsUpdate=true;
  },seatStart,streetGlobes,lampGlow,glassSky:facadeClock.glassSky,setFacadeClock:facadeClock.setFacadeClock,pier14Visitors:visitors,updateBridgeTraffic:()=>{},updateTraffic:convoy.update,walkerCount,skaters,transit,ferryFlag,treeDraw,treeBatches,ferryMarket,updateApproach:()=>{},sailboats:[],fireboat:undefined,architectureChunks,residentPositions:residents,people,walkers:people.bodies,walkerHeads:people.heads,waterMaterial:water.material,waterTime,windowMaterial,tram,traffic,
    streetcarGlazing:copiedMaterial(source.streetcarGlazing) as THREE.MeshStandardMaterial,streetcarLamp:copiedMaterial(source.streetcarLamp) as THREE.MeshStandardMaterial,
    coffeeMaterial:copiedMaterial(source.coffeeMaterial) as THREE.MeshStandardMaterial,clockHands,ferries:[],cars:[],birds:[],cyclists,hitTargets:[],
    seaLion:new THREE.Group(),sealFlippers:[]};
}
