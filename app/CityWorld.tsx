'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { landmarks, type Landmark } from './landmarks';
import { pacificLighting } from './lighting';
import SceneControls from './SceneControls';
import { ferryPose, birdPose, sailingPose } from './motion';
import {waterHeight} from './water-surface';
import { streetPose, streetcarPose } from './streets';
import { bridgeLayout } from './bridge-layout';
import { openingCamera, openingLens, openingYaw, orbitPitch, dampCameraAxis } from './camera';
import { starfieldData } from './sky';
import {bicycleScale,bicycleWheelBottom,waterfrontCyclist,waterfrontWalker} from './waterfront-routes';
import {readMotionPreference,writeMotionPreference,motionEvent,clampZoom,createQualityMonitor,drawingPixelRatio} from './city-runtime';

const clampTilt=(angle:number)=>Math.min(.72,Math.max(-.095,angle));

export default function CityWorld({ onVisit, variant='harbor', passerbyLines=[], overlay, fallback }: { onVisit?: (landmark: Landmark) => void; variant?: 'harbor'|'street'|'plaza'; passerbyLines?: readonly string[]; overlay?: ReactNode; fallback?: ReactNode }) {
  const streetView=variant!=='harbor';
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
  const [paused, setPaused] = useState(false);
  useEffect(()=>{const sync=()=>setPaused(readMotionPreference());sync();window.addEventListener(motionEvent,sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener(motionEvent,sync);window.removeEventListener('storage',sync);};},[]);
  const toggleMotion=()=>{const next=!paused;setPaused(next);writeMotionPreference(next);};
  const [zoom,setZoom]=useState(openingCamera.zoom);
  const changeZoom=(amount:number)=>setZoom(value=>clampZoom(value*Math.exp(amount)));
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const settings = useRef({ paused, zoom, tilt: 0, yaw: openingCamera.yaw });
  const wake = useRef<()=>void>(()=>{});
  const reducedMotion = useRef(false);
  useEffect(()=>{settings.current.paused=paused;settings.current.zoom=zoom;wake.current();},[paused,zoom]);
  useEffect(() => {
    const host = mount.current!;
    const localLight=pacificLighting();
    if(!streetView&&host.parentElement){
      host.parentElement.dataset.solar=localLight.night>.55?'night':'day';
      if(localLight.night>.55)host.closest('main')?.setAttribute('data-harbor-light','dark');
    }
    let disposed = false;
    let teardown = () => {};
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = motionQuery.matches;
    const onMotion = () => { reducedMotion.current = motionQuery.matches;setPaused(readMotionPreference());wake.current(); };
    motionQuery.addEventListener('change', onMotion);
    Promise.all([import('three'), import('./landscape'),import('./harbor-sky')]).then(([THREE, { createLandscape, createCityVignette },{createHarborSky}]) => {
      if (disposed) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: streetView ? 'default' : 'high-performance' }); }
      catch { setStatus('fallback'); return; }
      renderer.shadowMap.autoUpdate=false;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.info.autoReset=false;
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;
      renderer.domElement.setAttribute('aria-hidden', 'true'); host.appendChild(renderer.domElement);
      const scene = new THREE.Scene(); scene.background = new THREE.Color('#d6e4e6'); scene.fog = new THREE.Fog('#d6e4e6', 250, 470);
      const sky=streetView?null:createHarborSky();if(sky)scene.add(sky.dome);
      const camera = new THREE.PerspectiveCamera(20,1,.35,1800);
      const ambient = new THREE.HemisphereLight('#ffffff','#94a8a3',2.5); scene.add(ambient);
      const sun = new THREE.DirectionalLight('#fff0d2',3.2); sun.position.set(-30,55,28); sun.castShadow=true;
      const shadowSize=Math.min(renderer.capabilities.maxTextureSize,streetView?2048:4096);
      sun.shadow.mapSize.set(shadowSize,shadowSize);
      Object.assign(sun.shadow.camera,{left:-59,right:59,top:51,bottom:-51,far:190});
      sun.shadow.camera.updateProjectionMatrix();sun.shadow.radius=2.3;
      sun.target.position.set(streetView&&variant==='street'?-32:-9,0,-7);scene.add(sun.target);
      sun.shadow.normalBias=.023; sun.shadow.bias=-.00008; scene.add(sun);
      const fill = new THREE.DirectionalLight('#c6e1ef',.5); fill.position.set(40,20,-20); scene.add(fill);
      const world = streetView?createCityVignette(variant):createLandscape(); scene.add(world.root);
      let maxQuality=streetView||host.clientWidth<650?1:2,qualityMonitor=createQualityMonitor(maxQuality);
      let quality=maxQuality;
      let width=1, height=1, elapsed=0, last=0, frame=0, lastMotion=-1, lastDraw=0, lastInput=0, renderedFrames=0, lastFpsReport=performance.now(), visible=true, intersecting=true, rendering=true, presented=false, lastVisual='',lastInk='';
      const startYaw=openingYaw(host.clientWidth,host.clientHeight);settings.current.yaw=startYaw;
      const target = new THREE.Vector3(...openingCamera.target);
      const cameraAxes={yaw:{value:startYaw,velocity:0},tilt:{value:0,velocity:0},zoom:{value:1,velocity:0}};
      const economy=window.matchMedia('(prefers-reduced-data: reduce)').matches;
      let lighting=localLight;
      let nightPrint=document.documentElement.dataset.palette==='ink';
      const refreshPalette=()=>{nightPrint=document.documentElement.dataset.palette==='ink';lastLightingCheck=-Infinity;requestFrame();};
      window.addEventListener('portfolio-palette-change',refreshPalette);
      let appliedFocalLength=0;
      let shadowRegion='',lastShadowSun='', nextDraw=0, timer:ReturnType<typeof setTimeout>|undefined;
      function requestFrame(){
        if(timer!==undefined){clearTimeout(timer);timer=undefined;}
        if(!disposed&&!frame&&visible&&rendering&&!document.hidden)frame=requestAnimationFrame(animate);
      }
      wake.current=requestFrame;
      let figureViewX=NaN,figureViewZ=NaN;
      let lastLightingCheck=0, duskAmount=lighting.night, yaw=startYaw, hoveredPerson=-1;
      const mistTint=new THREE.Color(.93,.85,.70);
      const skyColor=new THREE.Color(lighting.sky),waterColor=new THREE.Color(lighting.water),sunColor=new THREE.Color(lighting.sun);
      (scene.background as InstanceType<typeof THREE.Color>).copy(skyColor);world.waterMaterial.color.copy(waterColor);
      const starData=starfieldData();
      const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(starData.positions,3));starGeometry.setAttribute('color',new THREE.BufferAttribute(starData.colors,3));
      const starMaterial=new THREE.PointsMaterial({size:1.5,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:lighting.night,depthWrite:false,fog:false,toneMapped:false});
      const stars=new THREE.Points(starGeometry,starMaterial);stars.scale.setScalar(3.8);scene.add(stars);
      let conversation: {person:number;until:number}|null=null, speechCount=0;
      const personMatrix=new THREE.Matrix4(), head=new THREE.Vector3(), foot=new THREE.Vector3();
      const shoes=world.people.group.getObjectByName('Shoes') as InstanceType<typeof THREE.InstancedMesh>;
      const sightRay=new THREE.Raycaster();
      let hoveredSince=0, nextQuip=18;
      function personScreen(index:number){
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
      type PersonProjection=ReturnType<typeof personScreen>;
      function seen(person:PersonProjection){
        // A visible head may project in front of a building across the bay.
        // Only test the actual depth of a candidate when opening a conversation.
        sightRay.setFromCamera(new THREE.Vector2(person.x/width*2-1,1-person.y/height*2),camera);
        sightRay.far=Math.max(.01,person.distance-.028);
        return !sightRay.intersectObjects(world.architectureChunks,false).length;
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
          zoom:settings.current.zoom,tilt:cameraAxes.tilt.value,intent:'pending'};
        wasPinch=true;pointer.down=false;
      }
      function movePair(a:Contact,b:Contact){
        if(!pair)return;
        const distance=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
        const spread=Math.abs(distance-pair.distance),travel=(a.clientY+b.clientY)/2-pair.midY;
        if(pair.intent==='pending'){
          if(spread>=4 && spread>=Math.abs(travel)*.7)pair.intent='lens';
          else if(Math.abs(travel)>=10 && Math.abs(travel)>spread*1.7)pair.intent='tilt';
        }
        if(pair.intent==='lens')setZoom(clampZoom(pair.zoom*distance/pair.distance));
        if(pair.intent==='tilt')settings.current.tilt=clampTilt(pair.tilt+travel/height);
        lastInput=performance.now();requestFrame();
      }
      const pointerContacts=()=>Array.from(touches.values(),p=>({clientX:p.x,clientY:p.y}));
      const raycaster=new THREE.Raycaster(), mouse=new THREE.Vector2();
      function pick(e:PointerEvent){const rect=host.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);return raycaster.intersectObjects(world.hitTargets)[0]?.object.userData.landmark as Landmark|undefined;}
      function zoomHere(){
        if(streetView)return;
        conversation=null;setSpeech(null);setZoom(value=>clampZoom(value*1.65));setFocus(null);wake.current();
      }
      host.addEventListener('dblclick',zoomHere);
      function resize() {
        width=host.clientWidth; height=host.clientHeight;
        if(!width||!height)return;
        const viewportQuality=economy?0:streetView||width<650?1:2;
        if(viewportQuality!==maxQuality){maxQuality=viewportQuality;qualityMonitor=createQualityMonitor(maxQuality);quality=maxQuality;}
        renderer.setPixelRatio(drawingPixelRatio(width,height,window.devicePixelRatio||1,economy,streetView)); renderer.setSize(width,height);
        renderer.shadowMap.enabled=quality>0&&duskAmount<.85;renderer.shadowMap.needsUpdate=true;host.dataset.quality=String(quality);host.dataset.shadows=String(renderer.shadowMap.enabled);
        camera.aspect=width/height;appliedFocalLength=0;lastVisual='';requestFrame();
      }
      const resizeObserver=new ResizeObserver(resize); resizeObserver.observe(host); resize();
      const onDown=(e:PointerEvent)=>{
        if(streetView||e.button!==0)return;requestFrame();
        lastInput=performance.now();
        if(e.pointerType==='touch'){
          touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
          if(touches.size>=2){const [a,b]=pointerContacts();if(touches.size===2)beginPair(a,b);return;}
          wasPinch=false;
        }
        pointer.down=true;pointer.startX=e.clientX;pointer.startY=e.clientY;pointer.startYaw=cameraAxes.yaw.value;pointer.startTilt=cameraAxes.tilt.value;settings.current.yaw=pointer.startYaw;cameraAxes.yaw.velocity=0;host.setPointerCapture(e.pointerId);host.focus({preventScroll:true});
      };
      const onMove=(e:PointerEvent)=>{
        if(streetView)return;requestFrame();
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
        nativeTouchPair=true;e.preventDefault();beginPair(e.touches[0],e.touches[1]);
      };
      const onTouchMove=(e:TouchEvent)=>{
        if(!nativeTouchPair||e.touches.length!==2)return;
        e.preventDefault();movePair(e.touches[0],e.touches[1]);
      };
      const onTouchEnd=(e:TouchEvent)=>{if(e.touches.length<2){nativeTouchPair=false;pair=null;}};
      host.addEventListener('touchstart',onTouchStart,{passive:false});host.addEventListener('touchmove',onTouchMove,{passive:false});
      host.addEventListener('touchend',onTouchEnd);host.addEventListener('touchcancel',onTouchEnd);
      const onWheel=(e:WheelEvent)=>{if(!streetView&&e.ctrlKey){lastInput=performance.now();e.preventDefault();setZoom(value=>clampZoom(value*Math.exp(-e.deltaY*.008)));}};
      host.addEventListener('wheel',onWheel,{passive:false});
      const onLeave=()=>{hoveredPerson=-1;};
      const onCancel=(e:PointerEvent)=>{touches.delete(e.pointerId);pointer.down=false;};
      const onUp=(e:PointerEvent)=>{lastInput=performance.now();touches.delete(e.pointerId);if(wasPinch){if(touches.size===0){wasPinch=false;pair=null;}pointer.down=false;return;}if(pointer.down&&Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)<7){const person=pickPerson(e,true);if(person>=0)say(person);else{const key=pick(e);if(key){setFocus(prev=>prev===key?null:key);visitRef.current?.(key);}}}pointer.down=false;};
      host.addEventListener('pointerdown',onDown);host.addEventListener('pointermove',onMove);host.addEventListener('pointerup',onUp);host.addEventListener('pointercancel',onCancel);host.addEventListener('pointerleave',onLeave);
      const onLost=(e:Event)=>{e.preventDefault();rendering=false;setStatus('fallback');}; renderer.domElement.addEventListener('webglcontextlost',onLost);
      const onVisibility=()=>{
        visible=intersecting&&!document.hidden;
        if(visible){last=0;lastDraw=0;nextDraw=0;requestFrame();}
        else {cancelAnimationFrame(frame);frame=0;clearTimeout(timer);timer=undefined;}
      };
      document.addEventListener('visibilitychange',onVisibility);
      const observer=new IntersectionObserver(([entry])=>{intersecting=entry.isIntersecting;onVisibility();}); observer.observe(host);
      const offset=new THREE.Vector3(), axis=new THREE.Vector3(0,1,0);
      function animate(now:number) {
        frame=0;if(disposed||!visible||!rendering||document.hidden)return;
        const frameMs=now-last;last=now;
        const movingCamera=pointer.down||touches.size>0||now-lastInput<1200||Math.abs(cameraAxes.yaw.value-settings.current.yaw)>.0005||Math.abs(cameraAxes.tilt.value-settings.current.tilt)>.0005||Math.abs(cameraAxes.zoom.value-settings.current.zoom)>.0005;
        // Let the main scene follow the display. Carry fractional frame time for paced views.
        const interval=economy||streetView?1000/30:0;
        if(interval&&now+.8<nextDraw){requestFrame();return;}
        nextDraw=interval?now+interval-Math.max(0,now-nextDraw)%interval:now;
        const dt=lastDraw?Math.min((now-lastDraw)/1000,.12):1/60;lastDraw=now;
        // A deliberately paced idle scene is not evidence that the GPU is struggling.
        if(!streetView&&movingCamera&&!settings.current.paused&&!reducedMotion.current){const nextQuality=qualityMonitor.sample(frameMs,now);if(nextQuality!==quality){quality=nextQuality;resize();lastVisual='';}}
        const config=settings.current, still=config.paused;
        if(!still)elapsed+=dt;
        yaw=dampCameraAxis(cameraAxes.yaw,config.yaw,dt,pointer.down?9:4.5,reducedMotion.current);
        const magnification=dampCameraAxis(cameraAxes.zoom,config.zoom,dt,4,reducedMotion.current);
        const lens=openingLens(width,height);
        const tilt=dampCameraAxis(cameraAxes.tilt,config.tilt,dt,pointer.down?9:4.5,reducedMotion.current);
        const horizontal=lens.distance, vertical=lens.elevation;
        const radius=Math.hypot(horizontal,vertical), angle=orbitPitch(yaw,tilt,Math.atan2(vertical,horizontal));
        offset.set(0,Math.sin(angle)*radius,Math.cos(angle)*radius).applyAxisAngle(axis,yaw);camera.position.copy(target).add(offset);
        const headroom=width/height>1.8?Math.min(1.5,(width/height-1.8)*2.7):0;
        camera.lookAt(target.x,target.y+headroom,target.z);
        // A lens change crops the same sightline and preserves foreground/background alignment.
        const focalLength=streetView?42:lens.focalLength*magnification;
        if(focalLength!==appliedFocalLength){
          camera.setFocalLength(focalLength);
          appliedFocalLength=focalLength;
        }
        if(streetView){
          // Locked view across the promenade at Cupid's Span; movement belongs to the street.
          if(variant==='plaza'){camera.position.set(11,13,17);camera.lookAt(0,0,0);}else{camera.position.set(-24,17,13);camera.lookAt(width<650?-32:-35,0,-3);}
        }
        stars.position.copy(camera.position);
        const lightChanged=lastLightingCheck===0;
        if(lightChanged||now-lastLightingCheck>30000||lastLightingCheck===0){
          const local=pacificLighting();
          if(!streetView&&host.parentElement)host.parentElement.dataset.solar=local.night>.55?'night':'day';
          lighting=nightPrint?{...local,sky:0x253b59,water:0x234854,sun:0x91b9dc,night:1,ambient:.87,sunIntensity:.83}:local;
          host.dataset.light=nightPrint?'night-print':lighting.phase;lastLightingCheck=now;skyColor.setHex(lighting.sky);waterColor.setHex(lighting.water);sunColor.setHex(lighting.sun);}
        const lightEase=reducedMotion.current||lightChanged||!presented?1:1-Math.exp(-dt*4.2);
        duskAmount=THREE.MathUtils.lerp(duskAmount,lighting.night,lightEase);
        const shadows=!economy&&quality>0&&duskAmount<.85;
        if(renderer.shadowMap.enabled!==shadows){renderer.shadowMap.enabled=shadows;if(shadows)renderer.shadowMap.needsUpdate=true;host.dataset.shadows=String(shadows);}
        (scene.background as InstanceType<typeof THREE.Color>).lerp(skyColor,lightEase);
        (scene.fog as InstanceType<typeof THREE.Fog>).color.copy(scene.background as InstanceType<typeof THREE.Color>);
        // Edge haze is mixed after Three's output colour-space conversion.
        world.edgeFogColor.value.copy(scene.background as InstanceType<typeof THREE.Color>);
        if(sky)world.edgeFogColor.value.lerp(mistTint,(1-duskAmount)*.53);
        world.edgeFogColor.value.convertLinearToSRGB();
        world.nightInk.value=duskAmount;world.lampGlow.opacity=duskAmount*.96;
        world.coffeeMaterial.emissiveIntensity=duskAmount*2.6;
        world.bridgeLightMaterial.opacity=duskAmount*.8;world.roadLightMaterial.opacity=duskAmount;world.streetcarGlazing.emissiveIntensity=duskAmount*.7;world.streetcarLamp.emissiveIntensity=.35+duskAmount*1.3;
        world.waterMaterial.roughness=.49+duskAmount*.18;
        world.waterMaterial.color.lerp(waterColor,lightEase);world.windowMaterial.emissiveIntensity=duskAmount*2.15;
        ambient.intensity=THREE.MathUtils.lerp(ambient.intensity,lighting.ambient*.78,lightEase);
        sun.intensity=THREE.MathUtils.lerp(sun.intensity,lighting.sunIntensity,lightEase);sun.color.lerp(sunColor,lightEase);fill.intensity=.4+duskAmount*.25;
        if(shadows&&!streetView){
          // Fixed extents avoid shadow crawl during orbit. A closer investigation can use all
          // shadow texels around the chosen address, without updating the map every frame.
          const span=config.zoom>=10?9:config.zoom>=4?23:59;
          const sx=span===59?-9:Math.round(target.x), sz=span===59?-7:Math.round(target.z);
          const region=span+','+sx+','+sz;
          if(region!==shadowRegion){
            shadowRegion=region;sun.target.position.set(sx,0,sz);
            Object.assign(sun.shadow.camera,{left:-span,right:span,top:span*.87,bottom:-span*.87});
            sun.shadow.camera.updateProjectionMatrix();renderer.shadowMap.needsUpdate=true;
          }
        }
        const azimuth=lighting.azimuth*Math.PI/180;
        sun.position.set(Math.sin(azimuth)*60,Math.max(5,Math.sin(lighting.altitude*Math.PI/180)*75),-Math.cos(azimuth)*60).add(sun.target.position);
        if(sky){
          sky.dome.position.copy(camera.position);
          sky.uniforms.skyTint.value.copy(scene.background as InstanceType<typeof THREE.Color>);
          sky.uniforms.sunTint.value.copy(sun.color);
          sky.uniforms.sunDirection.value.set(Math.sin(azimuth)*Math.cos(lighting.altitude*Math.PI/180),Math.sin(lighting.altitude*Math.PI/180),-Math.cos(azimuth)*Math.cos(lighting.altitude*Math.PI/180));
          sky.uniforms.nightAmount.value=duskAmount;
          world.bayHorizon.value.copy(sky.uniforms.skyTint.value).lerp(mistTint,(1-duskAmount)*.53).convertLinearToSRGB();
        }
        const ink=duskAmount>.55?'#e7eee4':'#24434b';if(ink!==lastInk){host.closest('main')?.setAttribute('data-harbor-light',duskAmount>.55?'dark':'light');host.parentElement?.style.setProperty('--world-ink',ink);host.parentElement?.style.setProperty('--world-halo',duskAmount>.55?'#132536':'#cddbdd');lastInk=ink;}
        starMaterial.opacity=Math.max(0,(duskAmount-.55)*1.8);stars.visible=!streetView&&starMaterial.opacity>.001;
        world.clockHands.forEach(({minute,hour,angle})=>{
          for(const [hand,t,length] of [[minute,lighting.minutes/60*Math.PI*2,.47],[hour,(lighting.hours%12+lighting.minutes/60)/12*Math.PI*2,.36]] as const){
            const xx=Math.sin(t)*length/2, yy=Math.cos(t)*length/2;
            hand.position.set(1+Math.sin(angle)*1.28+Math.cos(angle)*xx,6.15+yy,-.1+Math.cos(angle)*1.28-Math.sin(angle)*xx);
            hand.rotation.set(0,angle,-t);
          }
        });
        const motionChanged=elapsed!==lastMotion;
        const viewerChanged=camera.position.x!==figureViewX||camera.position.z!==figureViewZ;
        if(motionChanged||viewerChanged){
          figureViewX=camera.position.x;figureViewZ=camera.position.z;
          world.people.setViewer(figureViewX,figureViewZ);
          for(let i=0;i<22;i++){
            const region=streetView?variant:undefined;
            const poseAt=(offset:number)=>waterfrontWalker(elapsed+offset,i,region);
            const p=poseAt(0);
            world.people.update(i,p.x,p.z,elapsed,1,p.y,hoveredPerson===i?1:0,false,p.heading,poseAt);
          }
          world.residentPositions.forEach((p,i)=>world.people.update(22+i,p.x,p.z,elapsed*.20,i%2?1:-1,p.y,hoveredPerson===22+i?1:(i%7===0&&elapsed%18<3?.7:0),true));
          world.people.flush();
        }
        if(motionChanged){
        world.updateApproach(elapsed);
        if(world.fireboat){const fireboatPose=world.fireboat.update(elapsed);host.dataset.fireboat=fireboatPose.phase;}
        world.sailboats.forEach((boat,i)=>{const p=sailingPose(elapsed,i);boat.position.set(p.x,p.y,p.z);boat.rotation.set(p.heel,p.heading,0,'YXZ');});
        world.ferries.forEach((boat,i)=>{const pose=ferryPose(elapsed,i);boat.position.set(pose.x,pose.y,pose.z);boat.rotation.set(0,pose.heading,Math.sin(elapsed*1.2+i)*.007);});
        world.cars.forEach((car,i)=>{car.position.z=((elapsed*(i%2?1.1:-1.1)+i*8+bridgeLayout.length*5)%bridgeLayout.length);});
        world.traffic.forEach((car,i)=>{const direction=i%2?1:-1,p=streetPose(streetView?((elapsed*(direction*1.2)+i*4+320)%32)-(variant==='plaza'?12:48):((elapsed*(direction*1.2)+i*16+640)%160)-80,direction);car.scale.setScalar(.25);car.position.set(p.x,.04025,p.z);car.rotation.y=p.heading;});
        const sealT=elapsed*.14;
        const sealX=24+Math.sin(sealT)*1.1,sealZ=8+Math.cos(sealT)*3;
        world.seaLion.position.set(sealX,waterHeight(sealX,sealZ,elapsed)-.011,sealZ);
        world.seaLion.rotation.set(Math.sin(elapsed*2)*.06,Math.atan2(Math.sin(sealT)*3,Math.cos(sealT)*1.1),Math.sin(elapsed*2)*.025);
        world.sealFlippers.forEach((flipper,i)=>{flipper.rotation.x=Math.sin(elapsed*2.5+i*Math.PI)*.38;});
        world.cyclists.forEach((bike,i)=>{
          const p=waterfrontCyclist(elapsed,i);
          bike.scale.setScalar(bicycleScale);
          bike.position.set(p.x,p.y-bicycleScale*bicycleWheelBottom,p.z);
          bike.rotation.y=-p.heading;
        });
        const tramPose=streetcarPose(streetView?((elapsed*.85+7)%32)-(variant==='plaza'?12:48):((elapsed*.85+42)%130)-65);world.tram.position.set(tramPose.x,tramPose.y,tramPose.z);world.tram.rotation.y=tramPose.heading;
        world.birds.forEach((bird,i)=>{const pose=birdPose(elapsed,i);bird.group.position.set(pose.x,pose.y,pose.z);bird.group.rotation.set(0,pose.heading,Math.cos(elapsed*.1+i)*.12);bird.wings[0].rotation.x=pose.flap;bird.wings[1].rotation.x=-pose.flap;});
        lastMotion=elapsed;
        }
        camera.updateMatrixWorld();
        if(!still&&!reducedMotion.current&&!streetView&&!conversation&&!pointer.down&&linesRef.current.length){
          if(hoveredPerson>=0&&hoveredSince>0&&now-hoveredSince>850){
            hoveredSince=0;
            if(seen(personScreen(hoveredPerson)))say(hoveredPerson);
          }else if(magnification>1.6&&elapsed>=nextQuip&&now-lastInput>2200){
            nextQuip=elapsed+20;
            const listener=centralPasserby();if(listener>=0)say(listener);
          }
        }
        if(conversation){
          if(now>conversation.until){conversation=null;setSpeech(null);}
          else if(bubble.current){
            const p=personScreen(conversation.person),half=bubble.current.offsetWidth/2+12;
            const x=Math.max(half,Math.min(width-half,p.x));
            bubble.current.style.left=`${x}px`;bubble.current.style.top=`${Math.max(125,p.y-16)}px`;
            bubble.current.style.setProperty('--tail-x',`${p.x-x}px`);
            bubble.current.style.visibility=p.visible?'visible':'hidden';
          }
        }
        if(!streetView)world.relief.update(elapsed,duskAmount,.58,world.bayHorizon.value);
        world.waterTime.value=elapsed;
        if(!streetView)world.updateMarina();
        world.ferries.forEach((boat,i)=>world.hullShadows[i].set(boat.position.x,boat.position.z,boat.rotation.y));
        world.sailboats.forEach((boat,i)=>world.hullShadows[i+2].set(boat.position.x,boat.position.z,boat.rotation.y));
        const visual=[width,height,target.x.toFixed(4),target.y.toFixed(4),target.z.toFixed(4),yaw.toFixed(4),tilt.toFixed(4),focalLength.toFixed(4),duskAmount.toFixed(4),lighting.hours,lighting.minutes,(scene.background as InstanceType<typeof THREE.Color>).getHexString()].join(',');
        const exploring=Math.abs(magnification-1)>.07||Math.abs(Math.sin((yaw-startYaw)/2))>.06||Math.abs(tilt)>.06;
        if(host.parentElement?.dataset.exploring!==String(exploring)&&host.parentElement)host.parentElement.dataset.exploring=String(exploring);
        const motionState=still?'paused':'playing';if(host.dataset.motion!==motionState)host.dataset.motion=motionState;
        const changed=visual!==lastVisual;
        if(!still||changed){
          // Rigid architecture casts the depth map. Moving hull shadows travel with the water shader.
          const shadowSun=lighting.azimuth.toFixed(2)+','+lighting.altitude.toFixed(2);
          if(shadows&&lastShadowSun!==shadowSun){renderer.shadowMap.needsUpdate=true;lastShadowSun=shadowSun;}
          renderer.info.reset();renderer.render(scene,camera);renderedFrames++;if(!presented){presented=true;setStatus('ready');}const triangles=String(renderer.info.render.triangles);if(host.dataset.triangles!==triangles)host.dataset.triangles=triangles;}lastVisual=visual;
        if(now-lastFpsReport>=1000){host.dataset.fps=String(Math.round(renderedFrames*1000/(now-lastFpsReport)));renderedFrames=0;lastFpsReport=now;}
        if(still&&!movingCamera&&!changed&&!conversation&&Math.abs(duskAmount-lighting.night)<.0001){timer=setTimeout(requestFrame,30000);}
        else requestFrame();
      }
      requestFrame();
      teardown=()=>{
        window.removeEventListener('portfolio-palette-change',refreshPalette);clearTimeout(timer);wake.current=()=>{};cancelAnimationFrame(frame);resizeObserver.disconnect();observer.disconnect();
        host.removeEventListener('dblclick',zoomHere);host.removeEventListener('touchstart',onTouchStart);host.removeEventListener('touchmove',onTouchMove);host.removeEventListener('touchend',onTouchEnd);host.removeEventListener('touchcancel',onTouchEnd);host.removeEventListener('wheel',onWheel);host.removeEventListener('pointerdown',onDown);host.removeEventListener('pointermove',onMove);host.removeEventListener('pointerup',onUp);host.removeEventListener('pointerleave',onLeave);host.removeEventListener('pointercancel',onCancel);document.removeEventListener('visibilitychange',onVisibility);renderer.domElement.removeEventListener('webglcontextlost',onLost);
        const geometries=new Set<InstanceType<typeof THREE.BufferGeometry>>(), mats=new Set<InstanceType<typeof THREE.Material>>();
        world.root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){if(!o.userData.sharedGeometry)geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}});
        sky?.dome.geometry.dispose();sky?.dome.material.dispose();starGeometry.dispose();starMaterial.dispose();geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());sun.shadow.dispose();renderer.dispose();renderer.domElement.remove();
      };
    }).catch(error=>{if(!disposed){console.error('Waterfront renderer could not start',error);setStatus('fallback');}});
    return()=>{disposed=true;teardown();motionQuery.removeEventListener('change',onMotion);};
  },[streetView,variant]);
  const reset=()=>{wake.current();settings.current.tilt=0;dismissSpeech.current();setFocus(null);setZoom(openingCamera.zoom);const yaw=settings.current.yaw,home=openingYaw(mount.current?.clientWidth||0,mount.current?.clientHeight||0);settings.current.yaw=yaw+Math.atan2(Math.sin(home-yaw),Math.cos(home-yaw));};
  if(streetView)return <div className="contact-street-world">
    <div className="world-scene" ref={mount} aria-hidden="true"/>
  </div>;
  return <section className="world" aria-label="Explore the Embarcadero. Drag or use the arrow keys to rotate. Double-click, pinch or use plus and minus to zoom around the Ferry Building. Slide two fingers up or down together to tilt. Escape returns to the opening view. Press Enter to hear from a passerby." tabIndex={0} onKeyDown={e=>{if(e.target!==e.currentTarget&&e.target!==mount.current)return;wake.current();if(e.key==='+'||e.key==='='){changeZoom(.25);e.preventDefault();}if(e.key==='-'){changeZoom(-.25);e.preventDefault();}if(e.key==='ArrowLeft'){settings.current.yaw-=.18;e.preventDefault();}if(e.key==='ArrowRight'){settings.current.yaw+=.18;e.preventDefault();}if(e.key==='ArrowUp'||e.key==='ArrowDown'){settings.current.tilt=clampTilt(settings.current.tilt+(e.key==='ArrowUp'?.07:-.07));e.preventDefault();}if(e.key==='Escape')reset();if(e.key==='Enter'&&(e.target===e.currentTarget||e.target===mount.current)){speak.current();e.preventDefault();}}}>
    <div className="world-poster" data-state={status} data-still={paused} aria-hidden="true"><div className="world-arrival-fog"/></div><div className="world-scene" ref={mount} tabIndex={-1} data-ready={status==='ready'}/>
    {overlay}{focus&&<div className="world-place" role="status">{landmarks[focus].label}</div>}
    {speech&&<div className="passerby-bubble" ref={bubble} role="status" key={speech.serial}><span>{speech.text}</span></div>}
    {status==='loading'&&<div className="world-loading" role="status"><span className="sr-only">Loading the waterfront</span></div>}
    {status==='fallback'&&fallback}
    {status==='ready'&&<SceneControls paused={paused} toggleMotion={toggleMotion} zoom={zoom} changeZoom={changeZoom} reset={reset}/>}

  </section>;
}
