'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { landmarks, type Landmark } from './landmarks';
import {harborConditionsAt,refreshHarborTide} from './harbor-conditions';
import { harborWash, directSunVisibility, harborSunDirection, pacificLighting } from './lighting';
import { cityDate,cityWeather,type CityConditions } from './city-conditions';
import { harborChristmasSnow,readWaterfrontWeather,type WaterfrontWeather } from './waterfront-weather';
import WaterfrontLoading from './WaterfrontLoading';
import WaterfrontPoster from './WaterfrontPoster';
import {arrivalProgress,beginClockArrival,finishClockArrival} from './clock-arrival';
import SceneControls,{PassengerZoom} from './SceneControls';
import { ferryPose, birdPose, sailingPose } from './motion';
import {waterHeight} from './water-surface';
import { streetcarPose } from './streets';
import {ambientStreetcarCall,washingtonDoorOpening} from './washington-call';
import {setVesselLightingPhase} from './vessel-lighting';
import {setVehiclePaintLight} from './street-vehicles';
import type { RideMode } from './driver-rides';
type Ride = {mode:RideMode; paused:boolean};
import {updateTreeBatches} from './tree-batches';
import {cinematicOrbit} from './cinematic-camera';
import type {CinematicOpening} from './cinematic-player';
import { clockArrivalFrame,clockArrivalFraming,openingCamera, openingLens, openingYaw, orbitOffset, dampCameraAxis, moveWaterfrontFocus } from './camera';
import { harborStars, starVisibility } from './sky';
import {updatePier14Visitors} from './pier14-visitors';
import {howardBealeAttendance,howardBealeWalkerCount} from './howard-beale-walkers';
import {marketShopperAttendance} from './market-shoppers';
import {bicycleScale,bicycleWheelBottom,frontMarketShopperStart,howardBealeWalkerStart,waterfrontCyclist,waterfrontWalker} from './waterfront-routes';
import {readMotionPreference,writeMotionPreference,motionEvent,clampZoom,compactDevice,createQualityMonitor,drawingPixelRatio} from './city-runtime';

const seatMaxZoom=4;
const clampSeatLens=(zoom:number)=>Math.min(seatMaxZoom,Math.max(1,zoom));
const clampTilt=(angle:number)=>Math.min(.72,Math.max(-.095,angle));

export default function CityWorld({ onVisit, variant='harbor', passerbyLines=[], overlay, fallback, conditions, ride=null, onRideEnd, cinematic }: { onVisit?: (landmark: Landmark) => void; variant?: 'harbor'|'street'|'plaza'; passerbyLines?: readonly string[]; overlay?: ReactNode; fallback?: ReactNode; conditions?: CityConditions; ride?:Ride|null; onRideEnd?:()=>void;cinematic?:CinematicOpening }) {
  const streetView=variant!=='harbor',enableRides=!!onRideEnd;
  const mount = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [speech, setSpeech] = useState<{text:string;serial:number}|null>(null);
  const dismissSpeech = useRef<()=>void>(()=>{});
  const speak = useRef<()=>void>(()=>{});
  const visitRef = useRef(onVisit);
  const linesRef = useRef(passerbyLines);
  useEffect(()=>{linesRef.current=passerbyLines;},[passerbyLines]);
  useEffect(()=>{visitRef.current=onVisit;},[onVisit]);
  const [focus, setFocus] = useState<Landmark | null>(null);
  const [ferryLabel,setFerryLabel]=useState('');
  const selectedFerry=useRef(-1),cycleFerry=useRef(()=>{});
  const [paused, setPaused] = useState(false);
  useEffect(()=>{const sync=()=>setPaused(readMotionPreference());sync();window.addEventListener(motionEvent,sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener(motionEvent,sync);window.removeEventListener('storage',sync);};},[]);
  const toggleMotion=()=>{const next=!paused;setPaused(next);writeMotionPreference(next);};
  const [zoom,setZoom]=useState(openingCamera.zoom);
  const changeZoom=(amount:number)=>setZoom(value=>clampZoom(value*Math.exp(amount)));
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [loadStage,setLoadStage]=useState(0);
  const [renderedRide,setRenderedRide]=useState<RideMode|null>(null);
  const [rideError,setRideError]=useState('');
  const [passengerLens,setPassengerLens]=useState({mode:ride?.mode,zoom:1});
  if(passengerLens.mode!==ride?.mode)setPassengerLens({mode:ride?.mode,zoom:1});
  const changeSeatZoom=(amount:number)=>setPassengerLens(previous=>({...previous,zoom:clampSeatLens(previous.zoom*Math.exp(amount))}));
  const seatLook=useRef({yaw:0,pitch:0});
  const settings = useRef({ paused, zoom, seatZoom:1, tilt: 0, yaw: openingCamera.yaw });
  const travelKeys=useRef(new Set<string>());
  const tapKeys=useRef(new Set<string>());
  const resetTravel=useRef(()=>{});
  const reviewHomeYaw=useRef<number|null>(null);
  const wake = useRef<()=>void>(()=>{});
  const reducedMotion = useRef(false);
  const rideRef=useRef(ride),endRideRef=useRef(onRideEnd);
  useEffect(()=>{
    rideRef.current=ride;
    endRideRef.current=onRideEnd;
    wake.current();
  },[ride,onRideEnd]);
  const minutes=conditions?.minutes, weather=conditions?.weather;
  const conditionsRef=useRef<CityConditions>({minutes,weather});
  const applyConditions=useRef<()=>void>(()=>{});
  useEffect(()=>{
    conditionsRef.current={minutes,weather};
    applyConditions.current();
  },[minutes,weather]);
  useEffect(()=>{settings.current.paused=paused;settings.current.zoom=zoom;settings.current.seatZoom=passengerLens.zoom;wake.current();},[paused,zoom,passengerLens.zoom]);
  useEffect(() => {
    const host = mount.current!;
    const localLight=pacificLighting(cityDate(new Date(),conditionsRef.current.minutes));
    if(!streetView&&host.parentElement){
      host.parentElement.dataset.solar=localLight.night>.55?'night':'day';
      const darkPrint=conditionsRef.current.minutes===undefined&&document.documentElement.dataset.palette==='ink';
      document.documentElement.dataset.clockLight=darkPrint||localLight.night>.55?'night':'day';
      if(localLight.night>.55)host.closest('main')?.setAttribute('data-harbor-light','dark');
    }
    let disposed = false;
    let teardown = () => {};
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = motionQuery.matches;
    const onMotion = () => { reducedMotion.current = motionQuery.matches;setPaused(readMotionPreference());wake.current(); };
    motionQuery.addEventListener('change', onMotion);
    const paintStep=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
    Promise.all([import('three'), import('./landscape'),import('./harbor-sky'),import('./harbor-rain'),streetView?null:import('./harbor-print'),streetView?null:import('./harbor-instances')]).then(async ([THREE, { landscapeStages,rememberLandscape, createStreetIllumination, setPccFrontDoor, setPccExitDoor, createCityVignette, courtyardVisitorOpen, updateCourtyardVisitor, setFerryClockTime, updateFerryFlag, ferryFlagFlutterRate },{createHarborSky},{createHarborRain},printModule,instanceModule]) => {
      if (disposed) return;
      setLoadStage(1);
      await paintStep();
      if(disposed)return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: streetView ? 'default' : 'high-performance' }); }
      catch { if(rideRef.current)endRideRef.current?.();setStatus('fallback');return; }
      teardown=()=>{renderer.dispose();renderer.domElement.remove();};
      // Overlap the municipal survey download with the staged waterfront bake.
      // The first waterfront frame never waits for this optional module.
      const surveyModule=streetView?null:import('./urban-context').catch(()=>null);
      const navigatorHints=navigator as Navigator & {deviceMemory?:number;connection?:{saveData?:boolean}};
      const economy=window.matchMedia('(prefers-reduced-data: reduce)').matches||navigatorHints.connection?.saveData===true;
      const compact=compactDevice(navigator.maxTouchPoints>0,navigator.hardwareConcurrency,navigatorHints.deviceMemory);
      renderer.shadowMap.autoUpdate=false;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.info.autoReset=false;
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.domElement.setAttribute('aria-hidden', 'true'); host.appendChild(renderer.domElement);
      const scene = new THREE.Scene(); scene.background = new THREE.Color('#d6e4e6'); scene.fog = new THREE.Fog('#d6e4e6', 118, 465);
      const sky=streetView?null:createHarborSky();if(sky)scene.add(sky.dome);
      const precipitation=createHarborRain();scene.add(precipitation.mesh);
      const camera = new THREE.PerspectiveCamera(20,1,.35,1800);
      const loadRides=()=>Promise.all([import('./driver-rides'),import('./ride-interior')]);
      let rides:Awaited<ReturnType<typeof loadRides>>|undefined,loadingRide=false;
      let interiors:ReturnType<typeof import('./ride-interior').createRideInteriors>|undefined;
      const lampPosition=new THREE.Vector3(),lampAim=new THREE.Vector3();
      let preparedRide:RideMode|null=null,presentedRide:RideMode|null=null;
      const gl=renderer.getContext() as WebGL2RenderingContext;
      let rideFence:WebGLSync|null=null;
      let lookDrag:{id:number;x:number;y:number;yaw:number;pitch:number}|null=null;
      const clampHeadPitch=(r:number)=>THREE.MathUtils.clamp(r,-1.10,1.04);
      let previousPlatformTime=NaN;
      let rideMode:RideMode|null=null,rideSeconds=0,rideEnded=false,rideMoving=false;
      scene.add(camera);
      const ambient = new THREE.HemisphereLight('#d5e5f2','#99a6b5',2.1); scene.add(ambient);
      const sun = new THREE.DirectionalLight('#fff0d2',3.2); sun.position.set(-30,55,28); sun.castShadow=true;
      const shadowSize=Math.min(renderer.capabilities.maxTextureSize,compact?1024:streetView||host.clientWidth<650?2048:4096);
      sun.shadow.mapSize.set(shadowSize,shadowSize);
      Object.assign(sun.shadow.camera,{left:-59,right:59,top:51,bottom:-51,far:190});
      sun.shadow.camera.updateProjectionMatrix();sun.shadow.radius=2.3;
      sun.target.position.set(streetView&&variant==='street'?-32:-9,0,-7);scene.add(sun.target);
      sun.shadow.normalBias=.023; sun.shadow.bias=-.00008; scene.add(sun);
      const nightDirection=new THREE.Vector3(-.42,.56,.63).normalize();
      let world:ReturnType<typeof rememberLandscape>;
      if(streetView){world=createCityVignette(variant);}
      else{
        // Inside an expensive stage, release the main thread between real
        // buildings or mesh batches so the Custom menu and ride controls can respond.
        let deadline=performance.now()+40,shownStage=1;
        const stages=landscapeStages(()=>performance.now()>=deadline);
        let step=stages.next();
        while(!step.done){
          if(step.value!==shownStage){
            shownStage=step.value;setLoadStage(shownStage);await paintStep();
          }else{
            await new Promise<void>(resolve=>setTimeout(resolve,0));
          }
          if(disposed)return;
          deadline=performance.now()+40;
          step=stages.next();
        }
        world=rememberLandscape(step.value);
      }
      if(!streetView){
        setLoadStage(7);
        await paintStep();
        if(disposed)return;
      }
      scene.add(world.root);
      let neighborhoods:ReturnType<typeof import('./urban-context').createUrbanContext>|undefined;
      let surveyUnavailable=false,firstSurveyDrawn=false;
      let surveyTask:ReturnType<typeof setTimeout>|undefined;
      function loadNeighborhoods(){
        void surveyModule?.then(module=>{
          if(disposed)return;
          if(module){
            neighborhoods=module.createUrbanContext();neighborhoods.autoUpdate=false;
            world.root.add(neighborhoods);
          }else surveyUnavailable=true;
          lastVisual='';requestFrame();
        }).catch(()=>{if(!disposed){surveyUnavailable=true;lastVisual='';requestFrame();}});
      }
      // On a busy GPU, tying every 2–5 ms tile slice to another full scene
      // draw leaves the CPU idle between frames. Advance the first visible
      // survey in short tasks as well. The frame itself checks its exact camera
      // frustum again before reporting that the submitted skyline is ready.
      function scheduleSurvey(){
        if(firstSurveyDrawn||surveyTask!==undefined)return;
        surveyTask=setTimeout(()=>{
          surveyTask=undefined;
          if(disposed||!neighborhoods||!visible||!rendering||document.hidden||rideRef.current||firstSurveyDrawn)return;
          if(neighborhoods.prepareOrbitView(camera,6)){
            lastVisual='';requestFrame();
          }else scheduleSurvey();
        },0);
      }
      const print=printModule?.createHarborPrint(renderer,world.clockCenter);
      const ferryClock={...world.ferryClock,tideOffset:0};
      let tideOffset=NaN,serviceSelection:number|undefined,serviceInitialized=false;
      const streetIllumination=createStreetIllumination(world.root,world.streetGlobes,world.waterMaterial,enableRides);
      const culled=instanceModule?.cullHarborInstances(renderer,world.root,world.windowMesh);
      let maxQuality=economy?0:compact||streetView||host.clientWidth<650?1:2;
      let quality=compact?0:maxQuality,qualityMonitor=createQualityMonitor(maxQuality,quality);
      let width=1, height=1, elapsed=0, frame=0, lastMotion=-1, lastTransitMinute=-1, lastDraw=0, lastInput=0, renderedFrames=0, lastFpsReport=performance.now(), visible=true, intersecting=true, rendering=true, presented=false, lastVisual='',lastInk='';
      let lens=openingLens(host.clientWidth,host.clientHeight);
      let clockFraming=clockArrivalFraming(host.clientWidth,host.clientHeight);
      let arrivalComplete=streetView||!!cinematic;
      const clockCapture=/^city-clock/.test((window as Window & {cityPosterCapture?:string}).cityPosterCapture??'');
      const startYaw=openingYaw(host.clientWidth,host.clientHeight);settings.current.yaw=startYaw;
      const target = new THREE.Vector3(...openingCamera.target);
      let shotTime=-1,shotWidth=0,shotHeight=0;
      let shotOrbit:ReturnType<typeof cinematicOrbit>|undefined;
      const clearKeys=()=>{travelKeys.current.clear();tapKeys.current.clear();};
      resetTravel.current=()=>{
        clearKeys();cinematic?.skipToEnd();updateShot();
        target.fromArray(shotOrbit?.target??openingCamera.target);requestFrame();
      };
      const releaseKey=(event:KeyboardEvent)=>{travelKeys.current.delete(event.key.toLowerCase());};
      window.addEventListener('keyup',releaseKey);window.addEventListener('blur',clearKeys);
      const cameraAxes={yaw:{value:startYaw,velocity:0},tilt:{value:0,velocity:0},zoom:{value:1,velocity:0}};
      function updateShot(){
        if(!cinematic)return;
        const t=cinematic.progress();
        if(t===shotTime&&width===shotWidth&&height===shotHeight)return;
        shotTime=t;shotWidth=width;shotHeight=height;
        const next=cinematicOrbit(cinematic.shot,t,width,height);
        const previous=shotOrbit?.target??openingCamera.target;
        target.x+=next.target[0]-previous[0];target.y+=next.target[1]-previous[1];target.z+=next.target[2]-previous[2];
        const delta=next.yaw-(shotOrbit?.yaw??startYaw);
        settings.current.yaw+=delta;cameraAxes.yaw.value+=delta;
        reviewHomeYaw.current=next.yaw;shotOrbit=next;
      }
      let lighting=localLight;
      const shouldUseNightPrint=()=>conditionsRef.current.minutes===undefined&&document.documentElement.dataset.palette==='ink';
      let nightPrint=shouldUseNightPrint();
      const refreshPalette=()=>{nightPrint=shouldUseNightPrint();lastLightingCheck=-Infinity;requestFrame();};
      window.addEventListener('portfolio-palette-change',refreshPalette);
      let appliedFocalLength=0,appliedShiftX=0,appliedShiftY=0;
      let shadowRegion='',lastShadowSun='', nextDraw=0, timer:ReturnType<typeof setTimeout>|undefined;
      function requestFrame(){
        if(timer!==undefined){clearTimeout(timer);timer=undefined;}
        if(!disposed&&!frame&&visible&&rendering&&!document.hidden)frame=requestAnimationFrame(animate);
      }
      wake.current=requestFrame;
      const refreshPrint=()=>{lastVisual='';requestFrame();};
      window.addEventListener('waterfront-print-loaded',refreshPrint);
      let figureViewX=NaN,figureViewZ=NaN;
      let lastPatioSheltered=false;
      let snowfall=false,customEpoch:number|undefined,expressEpochSeconds=0,expressWallOffset=0;
      let lastLightingCheck=0, duskAmount=lighting.night, yaw=startYaw, hoveredPerson=-1;
      const skyColor=new THREE.Color(lighting.sky),waterColor=new THREE.Color(lighting.water),sunColor=new THREE.Color(lighting.sun);
      const horizonColor=new THREE.Color(lighting.horizon),fillColor=new THREE.Color(lighting.fill),groundColor=new THREE.Color(lighting.bounce);
      const marineGray=new THREE.Color('#b4c1c4'),rainWater=new THREE.Color('#687f86'),weatherTint=new THREE.Color();
      const coastalHorizon=new THREE.Color(),stratusHorizon=new THREE.Color();
      const weatherTarget=new THREE.Vector4(0,0,0,465),weatherNow=weatherTarget.clone();
      const windTarget=new THREE.Vector2(.188,.982);
      const flagDownwind=new THREE.Vector2(-windTarget.x,-windTarget.y);
      let flagHeading=Math.atan2(flagDownwind.y,flagDownwind.x),targetFlagHeading=flagHeading;
      let flagWindKph=16,targetFlagWindKph=16,flagPhase=0,cloudClock=0;
      let chopTarget=.5,nextWeatherCheck=0,weatherSettling=false;
      let latestObservation:WaterfrontWeather|null=null;
      function applyWeather(){
        const choice=conditionsRef.current.weather;
        const reading=cityWeather(latestObservation,choice);
        weatherTarget.set(reading?.cloudCover??0,reading?.rain??0,reading?.fog??0,
          reading?.visibilityKm!=null?THREE.MathUtils.clamp(90+reading.visibilityKm*35,90,465):465);
        const bearing=reading?.windFromDegrees;
        if(bearing!=null){const [x,,z]=harborSunDirection(bearing,0);windTarget.set(x,z);}
        else windTarget.set(.188,.982);
        targetFlagWindKph=reading?.windKph??16;
        if(bearing!=null||reading?.windKph==null)targetFlagHeading=Math.atan2(-windTarget.y,-windTarget.x);
        chopTarget=reading?.windKph!=null?THREE.MathUtils.clamp(reading.windKph/32,.04,1):.5;
        host.dataset.weather=choice?'custom':latestObservation?'local':'unavailable';
        host.dataset.rain=String(reading?.rain??0);host.dataset.rainSource=choice?'custom':latestObservation?.rainSource??'unavailable';
        if(choice)host.dataset.weatherChoice=choice;else delete host.dataset.weatherChoice;
        if(!choice&&latestObservation){host.dataset.weatherAt=latestObservation.observedAt;host.dataset.weatherSource=latestObservation.station;}
        else {delete host.dataset.weatherAt;delete host.dataset.weatherSource;}
        host.dataset.precipitation=(choice==='snow'||(!choice&&snowfall))?'snow':weatherTarget.y>.004?'rain':'dry';
        weatherSettling=true;lastVisual='';requestFrame();
      }
      function refreshWeather(){
        if(!streetView&&conditionsRef.current.minutes===undefined)void refreshHarborTide(new Date()).then(()=>{if(!disposed){lastLightingCheck=-Infinity;requestFrame();}});
        void readWaterfrontWeather().then(observation=>{
          if(disposed)return;
          latestObservation=observation;
          if(!conditionsRef.current.weather)applyWeather();
        });
      }
      applyConditions.current=()=>{
        nightPrint=shouldUseNightPrint();
        lastLightingCheck=presented?-Infinity:0;
        applyWeather();
      };
      if(conditionsRef.current.weather)applyWeather();
      (scene.background as InstanceType<typeof THREE.Color>).copy(skyColor);world.waterMaterial.color.copy(waterColor);
      const stars=harborStars(THREE);scene.add(stars);
      const figureRegion=streetView?variant:undefined;
      const howardStart=howardBealeWalkerStart(figureRegion);
      const howardEnd=howardStart<0?-1:howardStart+howardBealeWalkerCount;
      let previousHowardAttendance=-1;
      const {courtyardSlot}=world;
      let courtyardWasOpen=false,lastCourtyardTime=NaN;
      const rearSlots=world.residentPositions.flatMap((p,i)=>p.rearShopper?[world.walkerCount+i]:[]);
      const marketAttendance=marketShopperAttendance(frontMarketShopperStart(figureRegion),rearSlots);
      let conversation: {person:number;until:number}|null=null, speechCount=0;
      const personMatrix=new THREE.Matrix4(), head=new THREE.Vector3(), foot=new THREE.Vector3();
      const shoes=world.people.group.getObjectByName('Shoes') as InstanceType<typeof THREE.InstancedMesh>;
      const sightRay=new THREE.Raycaster();
      let hoveredSince=0, nextQuip=18;
      function personScreen(index:number){
        if(world.people.isHidden(index))return {x:0,y:0,fx:0,fy:0,distance:Infinity,visible:false};
        if(index<world.walkerHeads.count){
          world.walkerHeads.getMatrixAt(index,personMatrix);
          head.setFromMatrixPosition(personMatrix).applyMatrix4(world.walkerHeads.matrixWorld);
          shoes.getMatrixAt(index*2,personMatrix);
          foot.setFromMatrixPosition(personMatrix).applyMatrix4(shoes.matrixWorld);
        }else{
          const bike=world.cyclists[index-world.walkerHeads.count];
          head.set(.14,1.30,0).applyMatrix4(bike.matrixWorld);
          foot.set(0,-.24,0).applyMatrix4(bike.matrixWorld);
        }
        const distance=camera.position.distanceTo(head);
        head.project(camera);foot.project(camera);
        return {x:(head.x+1)*width/2,y:(1-head.y)*height/2,
          fx:(foot.x+1)*width/2,fy:(1-foot.y)*height/2,distance,
          visible:head.z>-1&&head.z<1&&Math.abs(head.x)<1&&Math.abs(head.y)<1};
      }
      const sightObstacles=world.treeDraw?[...world.architectureChunks,world.treeDraw]:world.architectureChunks;
      const ferryPoint=new THREE.Vector3();
      let lastFerryLabel='';
      function routeLabel(i:number,p:ReturnType<typeof ferryPose>){
        return p.phase==='off service'?world.ferries[i].name+' · '+p.route+' · Off service':
            world.ferries[i].name+' · '+p.origin+' → '+p.destination+' · Gate '+p.berth;
      }
      function identifyFerry(i:number){
        selectedFerry.current=i;
        let label='';
        if(i>=0){
          const p=ferryPose(elapsed,i,ferryClock);
          label=routeLabel(i,p);
          setFocus(null);
        }
        lastFerryLabel=label;setFerryLabel(label);
      }
      cycleFerry.current=()=>{
        for(let n=1;n<=world.ferries.length;n++){
          const i=(selectedFerry.current+n)%world.ferries.length;
          const boat=world.ferries[i];
          ferryPoint.copy(boat.position);ferryPoint.y+=.16;
          const distance=camera.position.distanceTo(ferryPoint);
          ferryPoint.project(camera);
          if(Math.abs(ferryPoint.x)>.99||Math.abs(ferryPoint.y)>.98||Math.abs(ferryPoint.z)>1)continue;
          mouse.set(ferryPoint.x,ferryPoint.y);sightRay.setFromCamera(mouse,camera);
          sightRay.far=Math.max(.01,distance-.15);
          if(!sightRay.intersectObjects(sightObstacles,false).length){identifyFerry(i);return;}
        }
        identifyFerry(-1);
      };
      type PersonProjection=ReturnType<typeof personScreen>;
      function seen(person:PersonProjection){
        if(!person.visible)return false;
        // A visible head may project in front of a building across the bay.
        // Only test the actual depth of a candidate when opening a conversation.
        sightRay.setFromCamera(new THREE.Vector2(person.x/width*2-1,1-person.y/height*2),camera);
        sightRay.far=Math.max(.01,person.distance-.028);
        return !sightRay.intersectObjects(sightObstacles,false).length;
      }
      const closeConversation=()=>{conversation=null;setSpeech(null);};
      dismissSpeech.current=closeConversation;
      function say(person:number){
        if(!linesRef.current.length)return;
        requestFrame();conversation={person,until:performance.now()+6500};nextQuip=elapsed+58;
        setSpeech({text:linesRef.current[speechCount%linesRef.current.length],serial:speechCount++});
      }
      function centralPasserby(){
        const options=[];
        for(let i=0;i<world.walkerHeads.count;i++){
          const p=personScreen(i);
          if(p.visible&&p.y>110&&p.y<height-45)options.push({i,p,d:Math.hypot(p.x-width*.5,p.y-height*.61)});
        }
        for(const candidate of options.sort((a,b)=>a.d-b.d))if(seen(candidate.p))return candidate.i;
        return -1;
      }
      speak.current=()=>{const person=centralPasserby();if(person>=0)say(person);};
      function pickPerson(e:PointerEvent,confirm=false){
        const rect=host.getBoundingClientRect(),px=e.clientX-rect.left,py=e.clientY-rect.top;
        const options=[];
        for(let i=0;i<world.walkerHeads.count+world.cyclists.length;i++){
          const p=personScreen(i);if(!p.visible)continue;
          const dx=p.fx-p.x,dy=p.fy-p.y,len=dx*dx+dy*dy;
          const t=len?Math.max(0,Math.min(1,((px-p.x)*dx+(py-p.y)*dy)/len)):0;
          const d=Math.hypot(p.x+t*dx-px,p.y+t*dy-py);
          if(d<(e.pointerType==='touch'?21:8)+Math.min(7,Math.sqrt(len)*.13))options.push({i,p,d});
        }
        for(const c of options.sort((a,b)=>a.d-b.d||a.p.distance-b.p.distance))if(!confirm||seen(c.p))return c.i;
        return -1;
      }
      const pointer = {down:false,startX:0,startY:0,startYaw:0,startTilt:0};
      const touches=new Map<number,{x:number;y:number}>();
      let wasPinch=false, nativeTouchPair=false;
      type Contact={clientX:number;clientY:number};
      let pair:{distance:number;midY:number;zoom:number;tilt:number;intent:'pending'|'lens'|'tilt'}|null=null;
      function beginPair(a:Contact,b:Contact){
        pair={distance:Math.max(1,Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)),midY:(a.clientY+b.clientY)/2,
          zoom:rideRef.current?settings.current.seatZoom:settings.current.zoom,tilt:cameraAxes.tilt.value,intent:'pending'};
        wasPinch=true;pointer.down=false;
      }
      function movePair(a:Contact,b:Contact){
        if(!pair)return;
        const distance=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
        const spread=Math.abs(distance-pair.distance),travel=(a.clientY+b.clientY)/2-pair.midY;
        if(pair.intent==='pending'){
          if(spread>=4 && spread>=Math.abs(travel)*.7)pair.intent='lens';
          else if(!rideRef.current&&Math.abs(travel)>=10 && Math.abs(travel)>spread*1.7)pair.intent='tilt';
        }
        if(pair.intent==='lens'){
          const lens=pair.zoom*distance/pair.distance;
          if(rideRef.current)setPassengerLens(previous=>({...previous,zoom:clampSeatLens(lens)}));
          else setZoom(clampZoom(lens));
        }
        if(pair.intent==='tilt')settings.current.tilt=clampTilt(pair.tilt+travel/height);
        lastInput=performance.now();requestFrame();
      }
      const pointerContacts=()=>Array.from(touches.values(),p=>({clientX:p.x,clientY:p.y}));
      const raycaster=new THREE.Raycaster(), mouse=new THREE.Vector2();
      function pick(e:PointerEvent){const rect=host.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);return raycaster.intersectObjects(world.hitTargets)[0]?.object.userData.landmark as Landmark|undefined;}
      function zoomHere(){
        if(rideRef.current){seatLook.current.yaw=0;seatLook.current.pitch=0;requestFrame();return;}
        if(streetView)return;
        conversation=null;setSpeech(null);setZoom(value=>clampZoom(value*1.65));setFocus(null);wake.current();
      }
      host.addEventListener('dblclick',zoomHere);
      function resize() {
        width=host.clientWidth; height=host.clientHeight;
        if(!width||!height)return;
        lens=openingLens(width,height);clockFraming=clockArrivalFraming(width,height);
        const viewportQuality=economy?0:compact||streetView||width<650?1:2;
        if(viewportQuality!==maxQuality){maxQuality=viewportQuality;qualityMonitor=createQualityMonitor(maxQuality);quality=maxQuality;}
        renderer.setPixelRatio(drawingPixelRatio(width,height,Math.min(window.devicePixelRatio||1,compact?1.5:Infinity),economy,streetView,maxQuality-quality)); renderer.setSize(width,height);print?.resize(quality,compact);
        renderer.shadowMap.enabled=quality>0&&duskAmount<.85;renderer.shadowMap.needsUpdate=true;host.dataset.quality=String(quality);host.dataset.shadows=String(renderer.shadowMap.enabled);
        camera.aspect=width/height;appliedFocalLength=0;lastVisual='';requestFrame();
      }
      const resizeObserver=new ResizeObserver(resize); resizeObserver.observe(host); resize();
      const onDown=(e:PointerEvent)=>{
        if(streetView||e.button!==0)return;
        if(rideRef.current){
          if(!e.isPrimary){lookDrag=null;return;}
          lookDrag={id:e.pointerId,x:e.clientX,y:e.clientY,...seatLook.current};
          host.setPointerCapture(e.pointerId);host.focus({preventScroll:true});
          return;
        }
        requestFrame();
        lastInput=performance.now();
        if(e.pointerType==='touch'){
          touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
          if(touches.size>=2){const [a,b]=pointerContacts();if(touches.size===2)beginPair(a,b);return;}
          wasPinch=false;
        }
        pointer.down=true;pointer.startX=e.clientX;pointer.startY=e.clientY;pointer.startYaw=cameraAxes.yaw.value;pointer.startTilt=cameraAxes.tilt.value;settings.current.yaw=pointer.startYaw;cameraAxes.yaw.velocity=0;host.setPointerCapture(e.pointerId);host.focus({preventScroll:true});
      };
      const onMove=(e:PointerEvent)=>{
        if(streetView)return;
        if(rideRef.current){
          if(lookDrag?.id===e.pointerId){
            const scale=Math.PI/Math.max(320,Math.min(width,height));
            seatLook.current.yaw=lookDrag.yaw+(e.clientX-lookDrag.x)*scale;
            seatLook.current.pitch=clampHeadPitch(lookDrag.pitch+(e.clientY-lookDrag.y)*scale);
            lastInput=performance.now();requestFrame();
          }
          return;
        }
        requestFrame();
        lastInput=performance.now();
        if(touches.has(e.pointerId)){
          touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
          if(touches.size>=2){if(!nativeTouchPair&&touches.size===2){const [a,b]=pointerContacts();movePair(a,b);}return;}
        }
        if(pointer.down){settings.current.yaw=pointer.startYaw+(e.clientX-pointer.startX)/Math.max(width,320)*Math.PI*.85;
          if(e.pointerType!=='touch')settings.current.tilt=clampTilt(pointer.startTilt+(e.clientY-pointer.startY)/height);
        }
        else if(e.pointerType==='mouse'){
          const candidate=pickPerson(e);if(candidate!==hoveredPerson){hoveredPerson=candidate;hoveredSince=performance.now();}host.style.cursor=hoveredPerson>=0?'pointer':'grab';
        }
      };
      // One finger scrolls the page vertically. A two-finger gesture locks to a lens
      // change or a vertical tilt so incidental drift during a pinch cannot re-aim it.
      const onTouchStart=(e:TouchEvent)=>{
        if(streetView||e.touches.length!==2)return;
        lookDrag=null;
        nativeTouchPair=true;e.preventDefault();beginPair(e.touches[0],e.touches[1]);
      };
      const onTouchMove=(e:TouchEvent)=>{
        if(!nativeTouchPair||e.touches.length!==2)return;
        e.preventDefault();movePair(e.touches[0],e.touches[1]);
      };
      const onTouchEnd=(e:TouchEvent)=>{if(e.touches.length<2){nativeTouchPair=false;pair=null;}};
      host.addEventListener('touchstart',onTouchStart,{passive:false});host.addEventListener('touchmove',onTouchMove,{passive:false});
      host.addEventListener('touchend',onTouchEnd);host.addEventListener('touchcancel',onTouchEnd);
      const onWheel=(e:WheelEvent)=>{
        if(streetView||(!rideRef.current&&!e.ctrlKey))return;
        e.preventDefault();lastInput=performance.now();
        const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);
        const factor=Math.exp(-delta*(e.ctrlKey ? .008 : .002));
        if(rideRef.current)setPassengerLens(previous=>({...previous,zoom:clampSeatLens(previous.zoom*factor)}));
        else setZoom(value=>clampZoom(value*factor));
      };
      host.addEventListener('wheel',onWheel,{passive:false});
      const onLeave=()=>{hoveredPerson=-1;};
      const onCancel=(e:PointerEvent)=>{if(lookDrag?.id===e.pointerId)lookDrag=null;touches.delete(e.pointerId);pointer.down=false;};
      const onUp=(e:PointerEvent)=>{
        if(rideRef.current){if(lookDrag?.id===e.pointerId)lookDrag=null;return;}
        lastInput=performance.now();touches.delete(e.pointerId);
        if(wasPinch){if(touches.size===0){wasPinch=false;pair=null;}pointer.down=false;return;}
        if(pointer.down&&Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)<7){
          const person=pickPerson(e,true);
          if(person>=0){identifyFerry(-1);say(person);}
          else{
            const key=pick(e); // Also sets the ray from this pointer event.
            const hit=raycaster.intersectObjects(world.ferries,true)[0];
            let ferry=-1;
            if(hit){
              sightRay.ray.copy(raycaster.ray);sightRay.far=hit.distance;
              if(!sightRay.intersectObjects(sightObstacles,false).length)
                ferry=world.ferries.findIndex(boat=>boat===hit.object.parent);
            }
            identifyFerry(ferry>=0&&selectedFerry.current===ferry?-1:ferry);
            if(ferry<0&&key){setFocus(prev=>prev===key?null:key);visitRef.current?.(key);}
          }
        }
        pointer.down=false;
      };
      host.addEventListener('pointerdown',onDown);host.addEventListener('pointermove',onMove);host.addEventListener('pointerup',onUp);host.addEventListener('pointercancel',onCancel);host.addEventListener('pointerleave',onLeave);
      const onLost=(e:Event)=>{e.preventDefault();rendering=false;if(rideRef.current)endRideRef.current?.();setStatus('fallback');}; renderer.domElement.addEventListener('webglcontextlost',onLost);
      const onVisibility=()=>{
        visible=intersecting&&!document.hidden;
        if(visible){lastDraw=0;nextDraw=0;lastLightingCheck=0;requestFrame();}
        else {clearKeys();cancelAnimationFrame(frame);frame=0;clearTimeout(timer);timer=undefined;}
      };
      document.addEventListener('visibilitychange',onVisibility);
      const observer=new IntersectionObserver(([entry])=>{intersecting=entry.isIntersecting;onVisibility();}); observer.observe(host);
      const offset=new THREE.Vector3();
      function animate(now:number) {
        frame=0;if(disposed||!visible||!rendering||document.hidden)return;
        // Custom is available while the opening is building. Present that first
        // waterfront frame so it can start the neighborhood survey a ride needs.
        const ride=presented&&enableRides?rideRef.current:null,mode=ride?.mode??null;
        // Let the browser paint the route change before issuing the first cab draw.
        if(preparedRide!==mode){
          preparedRide=mode;presentedRide=null;setRenderedRide(null);rideMoving=false;
          if(rideFence){gl.deleteSync(rideFence);rideFence=null;}
          if(mode){requestFrame();return;}
          neighborhoods?.endRideView();
        }
        if(mode&&!rides){
          if(!loadingRide){
            loadingRide=true;setRideError('');
            loadRides().then(modules=>{
              if(disposed)return;
              rides=modules;loadingRide=false;requestFrame();
            }).catch(()=>{
              if(disposed)return;
              loadingRide=false;
              if(rideRef.current){
                setRideError('The ride couldn’t load. Reload to try again.');
                endRideRef.current?.();
              }
            });
          }
          return;
        }
        if(rideFence){
          const result=gl.clientWaitSync(rideFence,0,0);
          if(result===gl.TIMEOUT_EXPIRED){requestFrame();return;}
          gl.deleteSync(rideFence);rideFence=null;
          if(gl.isContextLost())return;
          // On a driver sync error, fall back to presentation on the next animation frame.
          if(result===gl.WAIT_FAILED){lastVisual='';}
          presentedRide=mode;setRenderedRide(mode);
        }
        const modeChanged=mode!==rideMode;
        if(modeChanged){
          rideMode=mode;rideSeconds=0;rideEnded=false;
          if(mode&&rides&&!interiors){
            interiors=rides[1].createRideInteriors();scene.add(interiors.root);
          }
          seatLook.current.yaw=0;seatLook.current.pitch=0;lookDrag=null;
          if(!mode){presentedRide=null;setRenderedRide(null);streetIllumination.setCabLamp(lampPosition,lampAim,0);}
          interiors?.show(mode==='bridge'?'sedan':mode==='streetcar'?'tram':null);
          world.tram.visible=mode!=='streetcar';
          clearKeys();touches.clear();pointer.down=false;pair=null;nativeTouchPair=false;
          hoveredPerson=-1;closeConversation();identifyFerry(-1);setFocus(null);
          host.style.cursor='grab';
          lastVisual='';lastMotion=-1;
        }
        if(cinematic)updateShot();
        const usingKeys=travelKeys.current.size>0||tapKeys.current.size>0;
        const movingCamera=ride?(!ride.paused||usingKeys||lookDrag!==null):usingKeys||pointer.down||touches.size>0||now-lastInput<1200||Math.abs(cameraAxes.yaw.value-settings.current.yaw)>.0005||Math.abs(cameraAxes.tilt.value-settings.current.tilt)>.0005||Math.abs(cameraAxes.zoom.value-settings.current.zoom)>.0005;
        // A stationary visitor can watch the waterfront at 30 fps. Give gestures
        // up to 60 fps, including on displays that refresh at 120 or 144 Hz.
        const interval=1000/(movingCamera&&!economy&&!streetView?60:30);
        if(interval&&now+.8<nextDraw){requestFrame();return;}
        nextDraw=interval?now+interval-Math.max(0,now-nextDraw)%interval:now;
        const frameMs=lastDraw?now-lastDraw:interval;
        const dt=Math.min(frameMs/1000,.12);lastDraw=now;
        if(presented&&now>=nextWeatherCheck){nextWeatherCheck=now+5*60_000;refreshWeather();}
        if(weatherSettling){
          const step=reducedMotion.current||settings.current.paused?1:1-Math.exp(-dt*1.6);
          weatherNow.lerp(weatherTarget,step);
          if(!streetView){world.bayChop.value=THREE.MathUtils.lerp(world.bayChop.value,chopTarget,step);world.bayWind.value.lerp(windTarget,step);}
          weatherSettling=Math.abs(weatherNow.w-weatherTarget.w)>.01||Math.abs(weatherNow.x-weatherTarget.x)+Math.abs(weatherNow.y-weatherTarget.y)+Math.abs(weatherNow.z-weatherTarget.z)>.001||(!streetView&&
            (Math.abs(world.bayChop.value-chopTarget)>.001||world.bayWind.value.distanceToSquared(windTarget)>.00001));
        }
        const cloud=weatherNow.x,rain=weatherNow.y,fog=weatherNow.z;
        if(!streetView&&(ride?!ride.paused:!settings.current.paused&&!reducedMotion.current)){
          const nextQuality=qualityMonitor.sample(frameMs,now,!movingCamera||economy);
          if(nextQuality!==quality){quality=nextQuality;resize();lastVisual='';}
        }
        const config=settings.current, still=ride?.paused??config.paused;
        const advancing=!!mode&&!still&&presentedRide===mode;
        if(mode&&rides&&advancing&&rideMoving){
          const duration=rides[0].rideDuration(mode);
          rideSeconds=Math.min(rideSeconds+dt,duration);
          if(rideSeconds===duration&&!rideEnded){rideEnded=true;endRideRef.current?.();}
        }
        rideMoving=advancing;
        const driver=mode&&rides?rides[0].driverPose(mode,rideSeconds):null;
        if(!still)elapsed+=dt;
        if(usingKeys){
          const key=(...names:string[])=>Number(names.some(k=>travelKeys.current.has(k)||tapKeys.current.has(k)));
          const turn=key('e')-key('q');
          const keyDt=tapKeys.current.size?Math.max(dt,.09):dt;
          if(mode){
            seatLook.current.yaw+=(key('arrowleft','q')-key('arrowright','e'))*1.55*keyDt;
            seatLook.current.pitch=clampHeadPitch(seatLook.current.pitch+(key('arrowup')-key('arrowdown'))*1.15*keyDt);
          }else{
            config.yaw+=turn*1.22*keyDt;
            const next=moveWaterfrontFocus(target.x,target.z,cameraAxes.yaw.value,key('w','arrowup')-key('s','arrowdown'),key('d','arrowright')-key('a','arrowleft'),keyDt);
            target.x=next.x;target.z=next.z;
          }
          lastInput=now;tapKeys.current.clear();
        }
        // A ride owns the projection for its duration. Keep the waterfront's
        // position, lens and in-flight damping state for the return trip.
        let magnification=cameraAxes.zoom.value,tilt=cameraAxes.tilt.value,focalLength:number;
        if(driver&&rides){
          const viewAngle=THREE.MathUtils.lerp(71,52,THREE.MathUtils.smoothstep(camera.aspect,.65,1.45));
          focalLength=config.seatZoom*camera.getFilmHeight()/(2*Math.tan(THREE.MathUtils.degToRad(viewAngle*.5)));
          camera.position.set(driver.eye.x,driver.eye.y,driver.eye.z);
          camera.lookAt(driver.look.x,driver.look.y,driver.look.z);
          // The cab and headlights follow the vehicle. Turning your head changes only the view.
          if(interiors){interiors.root.position.copy(camera.position);interiors.root.quaternion.copy(camera.quaternion);}
          const tram=mode==='streetcar';
          lampPosition.set(tram ? .018:.023,tram?-.072:-.038,tram?-.075:-.13);
          lampAim.set(0,-.23,-2.7).sub(lampPosition).normalize().applyQuaternion(camera.quaternion);
          lampPosition.applyQuaternion(camera.quaternion).add(camera.position);
          rides[1].placePassenger(camera,tram?'tram':'sedan');
          camera.rotateY(seatLook.current.yaw);camera.rotateX(seatLook.current.pitch);
        }else{
          yaw=dampCameraAxis(cameraAxes.yaw,config.yaw,dt,pointer.down?9:4.5,reducedMotion.current);
          magnification=dampCameraAxis(cameraAxes.zoom,config.zoom,dt,4,reducedMotion.current);
          tilt=dampCameraAxis(cameraAxes.tilt,config.tilt,dt,pointer.down?9:4.5,reducedMotion.current);
          focalLength=streetView?42:(shotOrbit?.focalLength??lens.focalLength)*magnification;
          if(streetView){
            if(variant==='plaza'){camera.position.set(11,13,17);camera.lookAt(0,0,0);}
            else{camera.position.set(-24,17,13);camera.lookAt(width<650?-32:-35,0,-3);}
          }else{
            orbitOffset(shotOrbit??lens,yaw,tilt,offset);camera.position.copy(target).add(offset);
            camera.lookAt(target);
          }
        }
        let progress=1;
        if(!arrivalComplete){
          if(rideRef.current||still||reducedMotion.current)finishClockArrival();
          beginClockArrival(now);
          progress=clockCapture?0:arrivalProgress(now);
          arrivalComplete=progress===1;
        }
        const arrival=progress<1?clockArrivalFrame(clockFraming,progress):null;
        if(arrival)focalLength*=arrival.gain;
        const near=driver ? .013 : .35;
        const shiftX=driver?0:arrival?.shiftX??shotOrbit?.shiftX??0,shiftY=driver?0:arrival?.shiftY??shotOrbit?.shiftY??0;
        if(focalLength!==appliedFocalLength||camera.near!==near||shiftX!==appliedShiftX||shiftY!==appliedShiftY){
          appliedShiftX=shiftX;appliedShiftY=shiftY;
          camera.near=near;camera.setFocalLength(focalLength);
          if(shiftX||shiftY)camera.setViewOffset(width,height,-shiftX,-shiftY,width,height);
          else if(camera.view?.enabled)camera.clearViewOffset();
          appliedFocalLength=focalLength;
        }
        let neighborhoodsReady=true;
        if(neighborhoods){
          camera.updateMatrixWorld();
          neighborhoodsReady=mode?neighborhoods.prepareRideView(camera,7):neighborhoods.prepareOrbitView(camera,movingCamera?2:5);
          if(!mode&&!neighborhoodsReady)scheduleSurvey();
        }else if(mode){neighborhoodsReady=surveyUnavailable;}
        if(mode&&!neighborhoodsReady&&presentedRide!==mode){requestFrame();return;}
        stars.position.copy(camera.position);
        const lightChanged=lastLightingCheck===0;
        if(lightChanged||now-lastLightingCheck>30000||lastLightingCheck===0){
          const selection=conditionsRef.current;
          const wallNow=new Date(),localNow=cityDate(wallNow,selection.minutes);
          customEpoch=selection.minutes===undefined?undefined:localNow.getTime();
          snowfall=selection.weather?selection.weather==='snow':harborChristmasSnow(localNow);
          const harbor=harborConditionsAt(wallNow,selection.minutes);
          const civilSeconds=harbor.clock.minutes*60+localNow.getUTCSeconds()+localNow.getUTCMilliseconds()/1000;
          expressWallOffset=civilSeconds-localNow.getTime()/1000;
          if(!serviceInitialized||serviceSelection!==selection.minutes||ferryClock.date!==harbor.clock.date){
            Object.assign(ferryClock,harbor.clock);
            expressEpochSeconds=civilSeconds-elapsed;
            // Timetable playback advances one service minute per six seconds of scene time.
            ferryClock.minutes-=elapsed/6;serviceSelection=selection.minutes;serviceInitialized=true;
            lastMotion=-1;
          }
          if(tideOffset!==harbor.tideOffset){
            tideOffset=harbor.tideOffset;ferryClock.tideOffset=tideOffset;
            world.updateTide(tideOffset,culled?.updateTidalPane);lastMotion=-1;lastVisual='';
          }
          const local=pacificLighting(localNow);
          host.dataset.clock=String(local.hours).padStart(2,'0')+':'+String(local.minutes).padStart(2,'0');
          host.dataset.precipitation=snowfall?'snow':weatherTarget.y>.004?'rain':'dry';
          if(!streetView&&host.parentElement){
            host.parentElement.dataset.solar=local.night>.55?'night':'day';
            document.documentElement.dataset.clockLight=nightPrint||local.night>.55?'night':'day';
          }
          lighting=nightPrint?{...local,...harborWash(-15,0),night:1}:local;
          host.dataset.light=nightPrint?'night-print':lighting.phase;
          lastLightingCheck=now;
          skyColor.setHex(lighting.sky);waterColor.setHex(lighting.water);sunColor.setHex(lighting.sun);
          horizonColor.setHex(lighting.horizon);fillColor.setHex(lighting.fill);groundColor.setHex(lighting.bounce);
        }
        const lightEase=still||reducedMotion.current||lightChanged||!presented?1:1-Math.exp(-dt*4.2);
        duskAmount=THREE.MathUtils.lerp(duskAmount,lighting.night,lightEase);
        world.setFacadeClock(lighting.hours,lighting.minutes,duskAmount,lighting.litShare);
        if(mode)streetIllumination.setCabLamp(lampPosition,lampAim,2.1*Math.max(duskAmount,Math.min(.36,fog*.4+rain*.22)));
        interiors?.setNight(duskAmount);
        neighborhoods?.setNight(duskAmount,lighting.litShare);
        world.transit?.setNight(duskAmount);
        interiors?.updateRain(snowfall?0:rain,dt,still||reducedMotion.current);
        const directSun=nightPrint?0:directSunVisibility(lighting.altitude,cloud,fog);
        world.people.setPaintLight(fillColor,lighting.direction,directSun,duskAmount);
        sun.shadow.intensity=directSun;
        const shadows=!economy&&quality>0&&directSun>.015;
        if(renderer.shadowMap.enabled!==shadows){renderer.shadowMap.enabled=shadows;if(shadows)renderer.shadowMap.needsUpdate=true;host.dataset.shadows=String(shadows);}
        const morning=lighting.hours<12?1:.55;
        const mist=fog*(.62+.38*cloud)*morning*(1-rain*.45);
        const glow=nightPrint?0:lighting.sunset*(1-rain*.91)*(1-fog*.86)*(1-cloud*.72);
        if(!still&&!reducedMotion.current)cloudClock+=dt;
        if(!streetView){
          world.seaMist.value.set(mist,cloudClock);
          world.leafSun.value.set(...lighting.direction).multiplyScalar(directSun);
          world.baySunset.value.set(lighting.direction[0],lighting.direction[2],0).normalize().z=glow;
          world.baySun.value.set(...lighting.direction,directSun);
        }
        world.rainOnStone.value=snowfall?0:rain;
        const skyBackground=scene.background as InstanceType<typeof THREE.Color>;
        skyBackground.lerp(weatherTint.copy(skyColor).lerp(marineGray,Math.max(cloud*.63,fog*.82)*(1-duskAmount)),lightEase);
        const marineFog=scene.fog as InstanceType<typeof THREE.Fog>;
        marineFog.near=Math.min(118,weatherNow.w*.36)*(1-fog*.30);
        marineFog.far=weatherNow.w;
        coastalHorizon.copy(horizonColor);
        const horizonLight=coastalHorizon.r*.2126+coastalHorizon.g*.7152+coastalHorizon.b*.0722;
        stratusHorizon.setRGB(.91-.15*duskAmount,.98-.04*duskAmount,1.025+.07*duskAmount).multiplyScalar(horizonLight*(1-rain*.24));
        const ceiling=Math.max(cloud,rain*.84);
        coastalHorizon.lerp(stratusHorizon,THREE.MathUtils.smoothstep(ceiling,.18,.88));
        marineFog.color.copy(coastalHorizon);
        world.glassSky.value.copy(coastalHorizon).lerp(skyBackground,.70).multiplyScalar(.66-.16*duskAmount);
        setVehiclePaintLight(world.traffic[0].material,world.glassSky.value,lighting.direction,directSun);
        // Edge haze is mixed after Three's output colour-space conversion.
        world.edgeFogColor.value.copy(scene.background as InstanceType<typeof THREE.Color>);
        if(sky)world.edgeFogColor.value.copy(coastalHorizon);
        world.edgeFogColor.value.convertLinearToSRGB();
        const roadSeconds=mode==='bridge'?rideSeconds:elapsed;
        streetIllumination.update(roadSeconds,duskAmount,true,world.rainOnStone.value);
        world.nightInk.value=duskAmount;world.lampGlow.opacity=duskAmount*.96;
        world.coffeeMaterial.emissiveIntensity=duskAmount*2.6;
        if(!streetView)world.bayLights.update(duskAmount,reducedMotion.current?0:elapsed);
        world.roadLightMaterial.opacity=duskAmount;world.streetcarGlazing.emissiveIntensity=duskAmount*.7;world.streetcarLamp.emissiveIntensity=.35+duskAmount*1.3;
        world.waterMaterial.roughness=.49+duskAmount*.18;
        world.waterMaterial.color.lerp(weatherTint.copy(waterColor).lerp(rainWater,Math.max(cloud*.56,rain*.72)*(1-duskAmount)),lightEase);
        world.windowMaterial.emissiveIntensity=1;
        ambient.intensity=THREE.MathUtils.lerp(ambient.intensity,lighting.ambient*(1+cloud*.10),lightEase);
        ambient.color.lerp(fillColor,lightEase);
        ambient.groundColor.lerp(groundColor,lightEase);
        sun.intensity=THREE.MathUtils.lerp(sun.intensity,lighting.sunIntensity*(1-Math.max(cloud*.88,fog*.79)),lightEase);
        sun.color.lerp(sunColor,lightEase);
        if(shadows&&!streetView){
          // Fixed extents avoid shadow crawl during orbit. A closer investigation can use all
          // shadow texels around the chosen address, without updating the map every frame.
          const span=driver?18:config.zoom>=10?9:config.zoom>=4?23:59;
          const sx=driver?Math.round(driver.eye.x/6)*6:span===59?-9:Math.round(target.x);
          const sz=driver?Math.round(driver.eye.z/6)*6:span===59?-7:Math.round(target.z);
          const region=span+','+sx+','+sz;
          if(region!==shadowRegion){
            shadowRegion=region;sun.target.position.set(sx,0,sz);
            Object.assign(sun.shadow.camera,{left:-span,right:span,top:span*.87,bottom:-span*.87});
            sun.shadow.camera.updateProjectionMatrix();renderer.shadowMap.needsUpdate=true;
          }
        }
        const [sunX,sunY,sunZ]=lighting.direction;
        sun.position.set(sunX,Math.max(.012,sunY),sunZ).lerp(nightDirection,nightPrint?1:1-THREE.MathUtils.smoothstep(lighting.altitude,-15,-6)).normalize().multiplyScalar(86).add(sun.target.position);
        if(sky){
          sky.dome.position.copy(camera.position);
          sky.uniforms.skyTint.value.copy(scene.background as InstanceType<typeof THREE.Color>);
          sky.uniforms.sunTint.value.copy(sun.color);
          sky.uniforms.sunDirection.value.set(sunX,sunY,sunZ);
          sky.uniforms.nightAmount.value=duskAmount;
          sky.uniforms.afterglow.value=glow;sky.uniforms.seaMist.value=mist;sky.uniforms.cloudDrift.value=cloudClock;
          sky.uniforms.cloudCover.value=cloud;sky.uniforms.rainAmount.value=rain;
          sky.uniforms.coastalHorizon.value.copy(coastalHorizon);
          world.bayHorizon.value.copy(coastalHorizon).convertLinearToSRGB();
        }
        const ink=duskAmount>.55?'#e7eee4':'#24434b';if(ink!==lastInk){host.closest('main')?.setAttribute('data-harbor-light',duskAmount>.55?'dark':'light');host.parentElement?.style.setProperty('--world-ink',ink);host.parentElement?.style.setProperty('--world-halo',duskAmount>.55?'#132536':'#cddbdd');lastInk=ink;}
        stars.material.opacity=starVisibility(duskAmount,cloud,fog);stars.visible=!streetView&&stars.material.opacity>.001;
        setFerryClockTime(world.clockHands,lighting.hours,lighting.minutes);
        const civilEpoch=customEpoch??Date.now();
        const marketRevision=variant==='street'?0:world.ferryMarket.update(civilEpoch,still||reducedMotion.current);
        const attendanceChanged=marketAttendance.update(world.ferryMarket.activity);
        const howardAttendance=howardBealeAttendance(lighting.hours);
        const howardChanged=howardAttendance!==previousHowardAttendance;
        previousHowardAttendance=howardAttendance;
        const courtyardOpen=courtyardSlot>=0&&courtyardVisitorOpen(ferryClock.weekend,(civilEpoch/1000+expressWallOffset)/60);
        const courtyardChanged=courtyardOpen!==courtyardWasOpen||(courtyardOpen&&roadSeconds!==lastCourtyardTime);
        courtyardWasOpen=courtyardOpen;lastCourtyardTime=roadSeconds;
        const motionChanged=elapsed!==lastMotion;
        const viewerChanged=camera.position.x!==figureViewX||camera.position.z!==figureViewZ;
        const pyxisPose=world.ferries.length&&(motionChanged||viewerChanged)?ferryPose(elapsed,0,ferryClock):null;
        if(motionChanged||viewerChanged||attendanceChanged||howardChanged||courtyardChanged){
          figureViewX=camera.position.x;figureViewZ=camera.position.z;
          world.people.setViewer(figureViewX,figureViewZ);
          for(let i=0;i<world.walkerCount;i++){
            if(marketAttendance.absent.has(i)||(i<howardEnd&&i>=howardStart+howardAttendance)){
              world.people.hide(i);continue;
            }
            const poseAt=(offset:number)=>waterfrontWalker(roadSeconds+offset,i,figureRegion);
            const p=poseAt(0);
            world.people.update(i,p.x,p.z,elapsed,1,p.y,hoveredPerson===i?1:0,p.standing,p.heading,poseAt);
          }
          world.residentPositions.forEach((p,i)=>{
            const person=world.walkerCount+i;
            if(marketAttendance.absent.has(person)){world.people.hide(person);return;}
            world.people.update(person,p.x,p.z,elapsed*.20,i%2?1:-1,p.y,hoveredPerson===person?1:(i%7===0&&elapsed%18<3?.7:0),true);
          });
          if(pyxisPose)world.updateFerryPassengers(world.people,world.walkerCount+world.residentPositions.length,elapsed,pyxisPose,hoveredPerson);
          updatePier14Visitors(world.people,world.seatStart,world.pier14Visitors,elapsed,hoveredPerson);
          if(courtyardSlot>=0)updateCourtyardVisitor(world.people,courtyardSlot,roadSeconds,courtyardOpen,hoveredPerson===courtyardSlot?1:0);
          world.people.flush();
        }
        const localMinutes=lighting.hours*60+lighting.minutes;
        const ambientTram=ambientStreetcarCall(roadSeconds,variant==='plaza');
        const platformTime=mode==='streetcar'&&rides?rideSeconds-rides[0].washingtonRideArrival:
          variant==='street'?-Infinity:ambientTram.t;
        const ferryTime=mode==='streetcar'&&rides?rideSeconds-rides[0].museumLegDuration:
          variant==='street'?-Infinity:ambientTram.ferryTime;
        const passengerTime=mode==='streetcar'?ferryTime:variant==='street'?-Infinity:ambientTram.passengerTime;
        const station=variant==='street'?((elapsed*.85+7)%32)-48:ambientTram.station;
        const tramPose=driver?.body??streetcarPose(station);
        const callChanged=platformTime!==previousPlatformTime;
        const patioSheltered=snowfall||rain>.35;
        if(motionChanged||callChanged||lastTransitMinute!==localMinutes||patioSheltered!==lastPatioSheltered){
          const expressSeconds=customEpoch===undefined?Date.now()/1000+expressWallOffset:expressEpochSeconds+elapsed;
          world.transit?.update(elapsed,localMinutes,patioSheltered,ferryClock.date,platformTime,tramPose,passengerTime,expressSeconds,roadSeconds,mode==='bridge');
          lastTransitMinute=localMinutes;lastPatioSheltered=patioSheltered;
        }
        if(motionChanged){
        world.updateApproach(mode==='bridge'?rideSeconds:elapsed);
        if(world.fireboat){const fireboatPose=world.fireboat.update(elapsed,tideOffset);host.dataset.fireboat=fireboatPose.phase;}
        world.sailboats.forEach((boat,i)=>{const p=sailingPose(elapsed,i,tideOffset);boat.position.set(p.x,p.y,p.z);boat.rotation.set(p.heel,p.heading,0,'YXZ');});
        world.ferries.forEach((boat,i)=>{
          const pose=i===0&&pyxisPose?pyxisPose:ferryPose(elapsed,i,ferryClock);
          setVesselLightingPhase(boat,pose.phase);
          if(i===0)world.updatePyxisBoardingDoor(boat,pose.brow);
          if(i===selectedFerry.current){
            const label=routeLabel(i,pose);
            if(label!==lastFerryLabel){lastFerryLabel=label;setFerryLabel(label);}
          }
          world.boardingBrows.update(i,pose);
          world.ferryWakes.value[i]=pose.wake;
          boat.position.set(pose.x,pose.y,pose.z);
          boat.rotation.set(0,pose.heading,Math.sin(elapsed*1.2+i)*.007*(1-pose.brow));
        });
        world.updateBridgeTraffic(mode==='bridge'?rideSeconds:elapsed);
        world.skaters?.update(roadSeconds);
        world.updateTraffic(roadSeconds);
        const sealT=elapsed*.14;
        const sealX=24+Math.sin(sealT)*1.1,sealZ=8+Math.cos(sealT)*3;
        world.seaLion.position.set(sealX,waterHeight(sealX,sealZ,elapsed,tideOffset)-.011,sealZ);
        world.seaLion.rotation.set(Math.sin(elapsed*2)*.06,Math.atan2(Math.sin(sealT)*3,Math.cos(sealT)*1.1),Math.sin(elapsed*2)*.025);
        world.sealFlippers.forEach((flipper,i)=>{flipper.rotation.x=Math.sin(elapsed*2.5+i*Math.PI)*.38;});
        world.cyclists.forEach((bike,i)=>{
          const p=waterfrontCyclist(elapsed,i);
          bike.scale.setScalar(bicycleScale);
          bike.position.set(p.x,p.y-bicycleScale*bicycleWheelBottom,p.z);
          bike.rotation.y=-p.heading;
        });
        world.birds.forEach((bird,i)=>{const pose=birdPose(elapsed,i);bird.group.position.set(pose.x,pose.y,pose.z);bird.group.rotation.set(0,pose.heading,Math.cos(elapsed*.1+i)*.12);bird.wings[0].rotation.x=pose.flap;bird.wings[1].rotation.x=-pose.flap;});
        lastMotion=elapsed;
        }
        if(motionChanged||callChanged){
          world.tram.position.set(tramPose.x,tramPose.y,tramPose.z);
          world.tram.rotation.y=tramPose.heading;world.tram.rotation.z=driver?.body?.pitch??0;
          rides?.[0].setStreetcarTrucks(world.tram,driver?.body);
          const exitOpening=washingtonDoorOpening(ferryTime);
          const opening=Math.max(exitOpening,washingtonDoorOpening(platformTime));
          setPccExitDoor(world.tram,exitOpening);interiors?.setExitDoor(exitOpening);
          setPccFrontDoor(world.tram,opening);interiors?.setFrontDoor(opening);
          previousPlatformTime=platformTime;
        }
        camera.updateMatrixWorld();
        if(!ride&&!still&&!reducedMotion.current&&!streetView&&!conversation&&!pointer.down&&linesRef.current.length){
          if(hoveredPerson>=0&&hoveredSince>0&&now-hoveredSince>850){
            hoveredSince=0;
            if(seen(personScreen(hoveredPerson)))say(hoveredPerson);
          }else if(magnification>1.6&&elapsed>=nextQuip&&now-lastInput>2200){
            nextQuip=elapsed+20;
            const listener=centralPasserby();if(listener>=0)say(listener);
          }
        }
        if(conversation){
          if(now>conversation.until||world.people.isHidden(conversation.person)){conversation=null;setSpeech(null);}
          else if(bubble.current){
            const p=personScreen(conversation.person),half=bubble.current.offsetWidth/2+12;
            const x=Math.max(half,Math.min(width-half,p.x));
            bubble.current.style.left=`${x}px`;bubble.current.style.top=`${Math.max(125,p.y-16)}px`;
            bubble.current.style.setProperty('--tail-x',`${p.x-x}px`);
            bubble.current.style.visibility=p.visible?'visible':'hidden';
          }
        }
        if(!streetView)world.relief.update(elapsed,duskAmount,.74-.2*duskAmount,world.bayHorizon.value,weatherNow.w,lighting.litShare);
        world.waterTime.value=elapsed;
        if(!streetView)world.updateMarina(tideOffset);
        world.ferries.forEach((boat,i)=>world.hullShadows[i].set(boat.position.x,boat.position.z,Math.cos(boat.rotation.y),-Math.sin(boat.rotation.y)));
        world.sailboats.forEach((boat,i)=>world.hullShadows[i+world.ferries.length].set(boat.position.x,boat.position.z,Math.cos(boat.rotation.y),-Math.sin(boat.rotation.y)));
        precipitation.update(camera,width,height,rain,windTarget,chopTarget,duskAmount,still||reducedMotion.current?0:frameMs/1000,snowfall?'snow':'rain',quality);
        const visual=[mode,rideSeconds,neighborhoods?.children.length??0,seatLook.current.yaw,seatLook.current.pitch,marketRevision,snowfall,rain.toFixed(3),width,height,target.x.toFixed(4),target.y.toFixed(4),target.z.toFixed(4),yaw.toFixed(4),tilt.toFixed(4),focalLength.toFixed(4),duskAmount.toFixed(4),lighting.hours,lighting.minutes,(scene.background as InstanceType<typeof THREE.Color>).getHexString()].join(',');
        const exploring=Math.hypot(target.x-(shotOrbit?.target[0]??0),target.z-(shotOrbit?.target[2]??0))>.03||Math.abs(magnification-1)>.07||Math.abs(Math.sin((yaw-(shotOrbit?.yaw??startYaw))/2))>.06||Math.abs(tilt)>.06;
        if(host.parentElement?.dataset.exploring!==String(exploring)&&host.parentElement)host.parentElement.dataset.exploring=String(exploring);
        const motionState=still?'paused':'playing';if(host.dataset.motion!==motionState)host.dataset.motion=motionState;
        const changed=visual!==lastVisual;
        if(!still||changed){
          if(world.ferryFlag){
            const settle=still||reducedMotion.current?1:1-Math.exp(-dt*1.6);
            const turn=targetFlagHeading-flagHeading;
            flagHeading+=Math.atan2(Math.sin(turn),Math.cos(turn))*settle;
            flagWindKph=THREE.MathUtils.lerp(flagWindKph,targetFlagWindKph,settle);
            flagDownwind.set(Math.cos(flagHeading),Math.sin(flagHeading));
            const wet=snowfall?0:rain;
            if(!still&&!reducedMotion.current)flagPhase+=dt*ferryFlagFlutterRate(flagWindKph,wet);
            updateFerryFlag(world.ferryFlag,flagPhase,flagDownwind,flagWindKph,wet);
          }
          const treeDetailChanged=updateTreeBatches(world.treeBatches,camera,height);
          // Rigid architecture casts the depth map. Moving hull shadows travel with the water shader.
          const shadowSun=lighting.azimuth.toFixed(2)+','+lighting.altitude.toFixed(2);
          if(shadows&&(lastShadowSun!==shadowSun||treeDetailChanged)){renderer.shadowMap.needsUpdate=true;lastShadowSun=shadowSun;}
          renderer.info.reset();
          if(print)print.render(scene,camera,magnification,!!driver,quality,target,ambient.groundColor);
          else renderer.render(scene,camera);
          if(neighborhoods&&neighborhoodsReady&&!mode)firstSurveyDrawn=true;
          renderedFrames++;cinematic?.drawn(shotTime,(!!neighborhoods&&neighborhoodsReady)||surveyUnavailable);if(!presented){presented=true;setStatus('ready');if(!streetView)loadNeighborhoods();}const triangles=String(renderer.info.render.triangles);if(host.dataset.triangles!==triangles)host.dataset.triangles=triangles;}lastVisual=visual;
        // A fence confirms the GPU finished the first cab image without blocking input.
        if(mode&&presentedRide!==mode){
          rideFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
          if(rideFence){gl.flush();requestFrame();return;}
          presentedRide=mode;setRenderedRide(mode);
        }
        if(now-lastFpsReport>=1000){host.dataset.fps=String(Math.round(renderedFrames*1000/(now-lastFpsReport)));renderedFrames=0;lastFpsReport=now;}
        if(still&&neighborhoodsReady&&!movingCamera&&!changed&&!conversation&&Math.abs(duskAmount-lighting.night)<.0001){timer=setTimeout(requestFrame,30000);}
        else requestFrame();
      }
      requestFrame();
      teardown=()=>{
        clearTimeout(surveyTask);
        window.removeEventListener('waterfront-print-loaded',refreshPrint);window.removeEventListener('keyup',releaseKey);window.removeEventListener('blur',clearKeys);clearKeys();resetTravel.current=()=>{};
        window.removeEventListener('portfolio-palette-change',refreshPalette);clearTimeout(timer);applyConditions.current=()=>{};wake.current=()=>{};cancelAnimationFrame(frame);resizeObserver.disconnect();observer.disconnect();
        host.removeEventListener('dblclick',zoomHere);host.removeEventListener('touchstart',onTouchStart);host.removeEventListener('touchmove',onTouchMove);host.removeEventListener('touchend',onTouchEnd);host.removeEventListener('touchcancel',onTouchEnd);host.removeEventListener('wheel',onWheel);host.removeEventListener('pointerdown',onDown);host.removeEventListener('pointermove',onMove);host.removeEventListener('pointerup',onUp);host.removeEventListener('pointerleave',onLeave);host.removeEventListener('pointercancel',onCancel);document.removeEventListener('visibilitychange',onVisibility);renderer.domElement.removeEventListener('webglcontextlost',onLost);
        const geometries=new Set<InstanceType<typeof THREE.BufferGeometry>>(), mats=new Set<InstanceType<typeof THREE.Material>>();
        world.root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){if(!o.userData.sharedGeometry)geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}});
        world.root.traverse(o=>{if(o instanceof THREE.BatchedMesh){geometries.delete(o.geometry);o.dispose();}});
        if(rideFence)gl.deleteSync(rideFence);interiors?.dispose();culled?.dispose();print?.dispose();streetIllumination.dispose();precipitation.dispose();sky?.dome.geometry.dispose();sky?.dome.material.dispose();stars.geometry.dispose();stars.material.dispose();geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());sun.shadow.dispose();renderer.dispose();renderer.domElement.remove();
      };
    }).catch(error=>{if(!disposed){console.error('Waterfront renderer could not start',error);if(rideRef.current)endRideRef.current?.();setStatus('fallback');}});
    return()=>{disposed=true;teardown();motionQuery.removeEventListener('change',onMotion);};
  },[streetView,variant,enableRides,cinematic]);
  useEffect(()=>{if(status==='fallback')cinematic?.unavailable();},[status,cinematic]);
  const reset=()=>{selectedFerry.current=-1;setFerryLabel('');setRideError('');resetTravel.current();wake.current();settings.current.tilt=0;dismissSpeech.current();setFocus(null);setZoom(openingCamera.zoom);const yaw=settings.current.yaw,home=reviewHomeYaw.current??openingYaw(mount.current?.clientWidth||0,mount.current?.clientHeight||0);settings.current.yaw=yaw+Math.atan2(Math.sin(home-yaw),Math.cos(home-yaw));};
  if(streetView)return <div className="contact-street-world">
    <div className="world-scene" ref={mount} aria-hidden="true"/>
  </div>;
  return <section className="world" aria-label={ride?'Passenger view. Drag or use arrow keys to look around. Pinch, scroll or use plus and minus to zoom. Double-click or press Home to face forward. Escape returns to the waterfront.':"Explore the Embarcadero. Drag to orbit. W A S D or arrow keys move along the waterfront. Q and E turn. Double-click, pinch or use plus and minus to zoom. Slide two fingers together to tilt. Escape returns to the Ferry Building. F identifies a visible ferry and its gate. Enter speaks to a passerby."} data-view={ride?.mode??'waterfront'} tabIndex={0}
    onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)||e.relatedTarget!==mount.current){travelKeys.current.clear();tapKeys.current.clear();}}}
    onKeyDown={e=>{
      if(ride){
        if(e.metaKey||e.ctrlKey||e.altKey||(e.target instanceof HTMLElement&&e.target.closest('select,input,textarea,[contenteditable=true]')))return;
        const key=e.key.toLowerCase();
        if(['arrowleft','arrowright','arrowup','arrowdown','q','e'].includes(key)){
          if(!e.repeat){travelKeys.current.add(key);tapKeys.current.add(key);}
        }else if(key==='home'){seatLook.current.yaw=0;seatLook.current.pitch=0;}
        else if(key==='+'||key==='=')changeSeatZoom(.25);
        else if(key==='-')changeSeatZoom(-.25);
        else return;
        e.preventDefault();wake.current();return;
      }
      if((e.target!==e.currentTarget&&e.target!==mount.current)||e.metaKey||e.ctrlKey||e.altKey)return;
      const key=e.key.toLowerCase();
      if(['w','a','s','d','q','e','arrowleft','arrowright','arrowup','arrowdown'].includes(key)){
        if(!e.repeat){travelKeys.current.add(key);tapKeys.current.add(key);}
      }else if(key==='+'||key==='=')changeZoom(.25);
      else if(key==='-')changeZoom(-.25);
      else if(key==='escape')reset();
      else if(key==='f')cycleFerry.current();
      else if(key==='enter')speak.current();
      else return;
      e.preventDefault();wake.current();
    }}>
    <WaterfrontPoster state={status} still={paused}/><div className="world-scene" ref={mount} tabIndex={-1} data-ready={status==='ready'}/>
    {ride&&status==='ready'&&<div className="ride-boarding" data-ready={renderedRide===ride.mode} aria-hidden={renderedRide===ride.mode} role="status">
      <div><strong>{ride.mode==='bridge'?'Bay Bridge drive':'F-line streetcar'}</strong><span>Drag to look around</span></div>
    </div>}
    {overlay}{(ferryLabel||focus||rideError)&&<div className="world-place" role="status">{ferryLabel||(focus&&landmarks[focus].label)||rideError}</div>}
    {speech&&<div className="passerby-bubble" ref={bubble} role="status" key={speech.serial}><span>{speech.text}</span></div>}
    {status==='loading'&&<WaterfrontLoading stage={loadStage}/>}
    {status==='fallback'&&fallback}
    {ride&&renderedRide===ride.mode&&<PassengerZoom zoom={passengerLens.zoom} min={1} max={seatMaxZoom} changeZoom={changeSeatZoom}/>}
    {status==='ready'&&!ride&&<SceneControls paused={paused} toggleMotion={toggleMotion} zoom={zoom} changeZoom={changeZoom} reset={reset}/>}

  </section>;
}
