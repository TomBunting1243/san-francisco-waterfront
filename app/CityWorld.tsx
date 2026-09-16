'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { landmarks, type Landmark } from './landmarks';
import { pacificLighting } from './lighting';
import { ferryPose, birdPose } from './motion';
import { streetPose, streetcarPose } from './streets';
import { bridgeLayout } from './bridge-layout';
import { openingCamera } from './camera';
import {readMotionPreference,writeMotionPreference,motionEvent,clampZoom,edgeOrbit,createQualityMonitor,walkingTime} from './city-runtime';

export default function CityWorld({ onVisit, variant='harbor', passerbyLines=[], overlay, fallback }: { onVisit?: (landmark: Landmark) => void; variant?: 'harbor'|'street'|'plaza'; passerbyLines?: readonly string[]; overlay?: ReactNode; fallback?: ReactNode }) {
  const streetView=variant!=='harbor';
  const mount = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [speech, setSpeech] = useState<{text:string;serial:number}|null>(null);
  const speak = useRef<()=>void>(()=>{});
  const visitRef = useRef(onVisit);
  const linesRef = useRef(passerbyLines);
  useEffect(()=>{linesRef.current=passerbyLines;},[passerbyLines]);
  useEffect(()=>{visitRef.current=onVisit;},[onVisit]);
  const [focus, setFocus] = useState<Landmark | null>(null);
  const [paused, setPaused] = useState(false);
  useEffect(()=>{const sync=()=>setPaused(readMotionPreference());sync();window.addEventListener(motionEvent,sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener(motionEvent,sync);window.removeEventListener('storage',sync);};},[]);
  const toggleMotion=()=>{const next=!readMotionPreference();setPaused(next);writeMotionPreference(next);};
  const [zoom,setZoom]=useState(openingCamera.zoom);
  const changeZoom=(amount:number)=>setZoom(value=>clampZoom(value+amount));
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const settings = useRef({ focus, paused, zoom, yaw: openingCamera.yaw });
  const reducedMotion = useRef(false);
  const stopEdgeTurn = useRef(()=>{});
  useEffect(()=>{settings.current.focus=focus;settings.current.paused=paused;settings.current.zoom=zoom;},[focus,paused,zoom]);
  useEffect(() => {
    const host = mount.current!;
    let disposed = false;
    let teardown = () => {};
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = motionQuery.matches;
    const onMotion = () => { reducedMotion.current = motionQuery.matches; };
    motionQuery.addEventListener('change', onMotion);
    Promise.all([import('three'), import('./landscape'), import('./cinematic')]).then(([THREE, { createLandscape, createCityVignette }, { createCinematicView }]) => {
      if (disposed) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' }); }
      catch { setStatus('fallback'); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.info.autoReset=false;
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;
      renderer.domElement.setAttribute('aria-hidden', 'true'); host.appendChild(renderer.domElement);
      const scene = new THREE.Scene(); scene.background = new THREE.Color('#d6e4e6'); scene.fog = new THREE.Fog('#d6e4e6', 250, 470);
      const camera = new THREE.PerspectiveCamera(20,1,1.5,650);
      const ambient = new THREE.HemisphereLight('#ffffff','#94a8a3',2.5); scene.add(ambient);
      const sun = new THREE.DirectionalLight('#fff0d2',3.2); sun.position.set(-30,55,28); sun.castShadow=true;
      sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-70; sun.shadow.camera.right=70; sun.shadow.camera.top=60; sun.shadow.camera.bottom=-60;
      sun.shadow.normalBias=.06; sun.shadow.bias=-.00015; scene.add(sun);
      const fill = new THREE.DirectionalLight('#c6e1ef',.5); fill.position.set(40,20,-20); scene.add(fill);
      const world = streetView?createCityVignette(variant):createLandscape(); scene.add(world.root);
      const cinematic = createCinematicView(renderer,scene,camera);
      const maxQuality=streetView||window.innerWidth<650?1:2,qualityMonitor=createQualityMonitor(maxQuality);
      let quality=maxQuality;
      let width=1, height=1, elapsed=0, last=0, frame=0, lastMotion=-1, lastDraw=0, visible=true, intersecting=true, rendering=true, presented=false, lastVisual='';
      const target = new THREE.Vector3(...openingCamera.target), destination = target.clone();
      let lighting=pacificLighting();
      let lastLightingCheck=0, duskAmount=lighting.night, yaw=openingCamera.yaw, edgeTurn=0, edgeSince=0, hoveredPerson=-1;
      stopEdgeTurn.current=()=>{edgeTurn=0;};
      const skyColor=new THREE.Color(lighting.sky),waterColor=new THREE.Color(lighting.water),sunColor=new THREE.Color(lighting.sun);
      (scene.background as InstanceType<typeof THREE.Color>).copy(skyColor);world.waterMaterial.color.copy(waterColor);
      const starPositions=new Float32Array(180*3);
      for(let i=0;i<180;i++){starPositions[i*3]=Math.sin(i*127.1)*120;starPositions[i*3+1]=17+(i*17.31)%80;starPositions[i*3+2]=-100-(i%5)*10;}
      const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
      const starMaterial=new THREE.PointsMaterial({color:0xfff8df,size:.12,transparent:true,opacity:lighting.night,depthWrite:false});
      const stars=new THREE.Points(starGeometry,starMaterial);scene.add(stars);
      let conversation: {person:number;until:number}|null=null, speechCount=0;
      const personMatrix=new THREE.Matrix4(), personPoint=new THREE.Vector3();
      function personScreen(index:number){
        if(index<world.walkerHeads.count){world.walkerHeads.getMatrixAt(index,personMatrix);personPoint.setFromMatrixPosition(personMatrix).applyMatrix4(world.walkerHeads.matrixWorld);}
        else {personPoint.set(.14,1.3,0).applyMatrix4(world.cyclists[index-world.walkerHeads.count].matrixWorld);}
        personPoint.project(camera);
        return {x:(personPoint.x+1)*width/2,y:(1-personPoint.y)*height/2,visible:personPoint.z>-1&&personPoint.z<1&&Math.abs(personPoint.x)<1&&Math.abs(personPoint.y)<1};
      }
      function say(person:number){if(!linesRef.current.length)return;conversation={person,until:performance.now()+6500};setSpeech({text:linesRef.current[speechCount%linesRef.current.length],serial:speechCount++});}
      speak.current=()=>{
        // Keyboard entry chooses the passerby closest to the middle of the view.
        let nearest=0,distance=Infinity;
        for(let i=0;i<world.walkerHeads.count;i++){const p=personScreen(i),d=Math.abs(p.x-width/2);if(p.visible&&d<distance){nearest=i;distance=d;}}
        if(Number.isFinite(distance))say(nearest);
      };
      function pickPerson(e:PointerEvent){
        const rect=host.getBoundingClientRect(),px=e.clientX-rect.left,py=e.clientY-rect.top;
        let nearest=-1,distance=e.pointerType==='touch'?23:13;
        for(let i=0;i<world.walkerHeads.count+world.cyclists.length;i++){const p=personScreen(i),d=Math.hypot(p.x-px,p.y-py);if(p.visible&&d<distance){nearest=i;distance=d;}}
        return nearest;
      }
      const pointer = {down:false,startX:0,startY:0,startYaw:0};
      const touches=new Map<number,{x:number;y:number}>();let pinchDistance=0,pinchZoom=1,wasPinch=false;
      const touchDistance=()=>{const [a,b]=[...touches.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;};
      const raycaster=new THREE.Raycaster(), mouse=new THREE.Vector2();
      function pick(e:PointerEvent){const rect=host.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);return raycaster.intersectObjects(world.hitTargets)[0]?.object.userData.landmark as Landmark|undefined;}
      function resize() {
        width=host.clientWidth; height=host.clientHeight;renderer.setPixelRatio(Math.min(window.devicePixelRatio,quality===2?1.65:quality===1?1.25:1)); renderer.setSize(width,height);
        cinematic.setQuality(quality);renderer.shadowMap.enabled=quality>0;renderer.shadowMap.needsUpdate=true;host.dataset.quality=String(quality);
        camera.aspect=width/height;camera.setFocalLength(streetView?42:(width<650?openingCamera.mobile:openingCamera.desktop).focalLength);camera.updateProjectionMatrix();cinematic.resize(width,height);
      }
      const resizeObserver=new ResizeObserver(resize); resizeObserver.observe(host); resize();
      const onDown=(e:PointerEvent)=>{
        if(streetView||e.button!==0)return;
        if(e.pointerType==='touch'){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2){pinchDistance=touchDistance();pinchZoom=settings.current.zoom;wasPinch=true;pointer.down=false;return;}wasPinch=false;}
        pointer.down=true;pointer.startX=e.clientX;pointer.startY=e.clientY;pointer.startYaw=settings.current.yaw;host.setPointerCapture(e.pointerId);host.focus({preventScroll:true});edgeTurn=0;
      };
      const onMove=(e:PointerEvent)=>{
        if(streetView)return;
        if(touches.has(e.pointerId)){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size>=2&&pinchDistance>0){e.preventDefault();setZoom(clampZoom(pinchZoom*touchDistance()/pinchDistance));return;}}
        if(pointer.down){settings.current.yaw=pointer.startYaw+(e.clientX-pointer.startX)*.004;edgeTurn=0;}
        else if(e.pointerType==='mouse'){
          const r=host.getBoundingClientRect(),next=edgeOrbit((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);
          if(Math.sign(next)!==Math.sign(edgeTurn))edgeSince=performance.now();edgeTurn=next;
          hoveredPerson=pickPerson(e);host.style.cursor=hoveredPerson>=0?'pointer':'grab';
        }
      };
      // Keep one-finger page scrolling; prevent browser zoom only for a two-finger city gesture.
      const onTouchStart=(e:TouchEvent)=>{if(!streetView&&e.touches.length===2){pinchDistance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);pinchZoom=settings.current.zoom;wasPinch=true;}};
      const onTouchMove=(e:TouchEvent)=>{if(!streetView&&e.touches.length===2){e.preventDefault();const distance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);if(pinchDistance>0)setZoom(clampZoom(pinchZoom*distance/pinchDistance));}};
      host.addEventListener('touchstart',onTouchStart,{passive:true});host.addEventListener('touchmove',onTouchMove,{passive:false});
      const onWheel=(e:WheelEvent)=>{if(!streetView&&e.ctrlKey){e.preventDefault();setZoom(value=>clampZoom(value*Math.exp(-e.deltaY*.008)));}};
      host.addEventListener('wheel',onWheel,{passive:false});
      const onLeave=()=>{edgeTurn=0;hoveredPerson=-1;};
      const onCancel=(e:PointerEvent)=>{touches.delete(e.pointerId);pointer.down=false;edgeTurn=0;};
      const onUp=(e:PointerEvent)=>{touches.delete(e.pointerId);if(wasPinch){if(touches.size===0){wasPinch=false;pinchDistance=0;}pointer.down=false;return;}if(pointer.down&&Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)<7){const person=pickPerson(e);if(person>=0)say(person);else{const key=pick(e);if(key){setFocus(prev=>prev===key?null:key);visitRef.current?.(key);}}}else if(pointer.down){const nearest=openingCamera.yaw+Math.round((settings.current.yaw-openingCamera.yaw)/(Math.PI*2))*Math.PI*2;if(Math.abs(settings.current.yaw-nearest)<.10)settings.current.yaw=nearest;}pointer.down=false;};
      host.addEventListener('pointerdown',onDown);host.addEventListener('pointermove',onMove);host.addEventListener('pointerup',onUp);host.addEventListener('pointercancel',onCancel);host.addEventListener('pointerleave',onLeave);
      const onLost=(e:Event)=>{e.preventDefault();rendering=false;setStatus('fallback');}; renderer.domElement.addEventListener('webglcontextlost',onLost);
      const onVisibility=()=>{visible=intersecting&&!document.hidden;}; document.addEventListener('visibilitychange',onVisibility);
      const observer=new IntersectionObserver(([entry])=>{intersecting=entry.isIntersecting;visible=intersecting&&!document.hidden;},{rootMargin:'80px'}); observer.observe(host);
      const baseOffset=new THREE.Vector3(0,openingCamera.desktop.elevation,openingCamera.desktop.distance), offset=new THREE.Vector3(), axis=new THREE.Vector3(0,1,0);
      function animate(now:number) {
        if(disposed)return; frame=requestAnimationFrame(animate);
        const frameMs=now-last,dt=Math.min(frameMs/1000,.05); last=now; if(!visible||!rendering)return;
        if(now-lastDraw<(streetView?1000/30:0))return;const motionDt=streetView?Math.min((now-lastDraw)/1000,.1):dt;lastDraw=now;
        if(!streetView&&!settings.current.paused&&!reducedMotion.current){const nextQuality=qualityMonitor.sample(frameMs,now);if(nextQuality!==quality){quality=nextQuality;resize();lastVisual='';}}
        const config=settings.current, still=config.paused||reducedMotion.current;
        if(!still)elapsed+=motionDt;
        if(!still&&!pointer.down&&now-edgeSince>650)config.yaw+=edgeTurn*dt*.14;
        const point=config.focus ? landmarks[config.focus].position : [0,5,-8];
        destination.set(config.focus ? point[0]*.85 : openingCamera.target[0],config.focus ? 4 : openingCamera.target[1],config.focus ? point[2]*.75-3 : openingCamera.target[2]);
        target.lerp(destination,reducedMotion.current?1:1-Math.exp(-dt*4.5));
        yaw=THREE.MathUtils.lerp(yaw,config.yaw,reducedMotion.current?1:1-Math.exp(-dt*6));
        offset.copy(baseOffset);if(width<650){offset.z=openingCamera.mobile.distance;offset.y=openingCamera.mobile.elevation;}offset.applyAxisAngle(axis,yaw); camera.position.copy(target).add(offset); camera.lookAt(target);
        camera.zoom=THREE.MathUtils.lerp(camera.zoom,config.zoom*(config.focus ? (width<650?1.12:1.18) : 1),reducedMotion.current?1:1-Math.exp(-dt*4)); camera.updateProjectionMatrix();
        if(streetView){
          // Locked view across the promenade at Cupid's Span; movement belongs to the street.
          if(variant==='plaza'){camera.position.set(11,13,17);camera.lookAt(0,0,0);}else{camera.position.set(-24,17,13);camera.lookAt(width<650?-32:-35,0,-3);}camera.zoom=1;camera.updateProjectionMatrix();
        }
        if(now-lastLightingCheck>30000||lastLightingCheck===0){lighting=pacificLighting();lastLightingCheck=now;skyColor.setHex(lighting.sky);waterColor.setHex(lighting.water);sunColor.setHex(lighting.sun);}
        const lightEase=reducedMotion.current?1:1-Math.exp(-dt*2);
        duskAmount=THREE.MathUtils.lerp(duskAmount,lighting.night,lightEase);
        (scene.background as InstanceType<typeof THREE.Color>).lerp(skyColor,lightEase);
        (scene.fog as InstanceType<typeof THREE.Fog>).color.copy(scene.background as InstanceType<typeof THREE.Color>);
        world.edgeFogColor.value.copy(scene.background as InstanceType<typeof THREE.Color>);
        world.coffeeMaterial.emissiveIntensity=duskAmount*2.6;
        world.bridgeLightMaterial.opacity=duskAmount*.8;world.roadLightMaterial.opacity=duskAmount;world.streetcarGlazing.emissiveIntensity=duskAmount*.7;world.streetcarLamp.emissiveIntensity=.35+duskAmount*1.3;
        world.waterMaterial.roughness=.38+duskAmount*.3;
        world.waterMaterial.color.lerp(waterColor,lightEase);world.windowMaterial.emissiveIntensity=duskAmount*2.2;
        ambient.intensity=THREE.MathUtils.lerp(ambient.intensity,lighting.ambient*.78,lightEase);
        sun.intensity=THREE.MathUtils.lerp(sun.intensity,lighting.sunIntensity,lightEase);sun.color.lerp(sunColor,lightEase);fill.intensity=.4+duskAmount*.25;
        const azimuth=lighting.azimuth*Math.PI/180;
        sun.position.set(Math.sin(azimuth)*60,Math.max(5,Math.sin(lighting.altitude*Math.PI/180)*75),-Math.cos(azimuth)*60);
        host.parentElement?.style.setProperty('--world-ink',duskAmount>.55?'#e7eee4':'#24434b');
        starMaterial.opacity=Math.max(0,(duskAmount-.55)*1.4);
        world.clockHands.forEach(({minute,hour,angle})=>{
          for(const [hand,t,length] of [[minute,lighting.minutes/60*Math.PI*2,.47],[hour,(lighting.hours%12+lighting.minutes/60)/12*Math.PI*2,.36]] as const){
            const xx=Math.sin(t)*length/2, yy=Math.cos(t)*length/2;
            hand.position.set(1+Math.sin(angle)*1.28+Math.cos(angle)*xx,6.15+yy,-.1+Math.cos(angle)*1.28-Math.sin(angle)*xx);
            hand.rotation.set(0,angle,-t);
          }
        });
        const motionChanged=elapsed!==lastMotion;
        if(motionChanged){
        if(world.fireboat){const fireboatPose=world.fireboat.update(elapsed);host.dataset.fireboat=fireboatPose.phase;}
        world.ferries.forEach((boat,i)=>{const pose=ferryPose(elapsed,i);boat.position.set(pose.x,pose.y,pose.z);boat.rotation.set(0,pose.heading,Math.sin(elapsed*1.2+i)*.007);});
        world.cars.forEach((car,i)=>{car.position.z=((elapsed*(i%2?1.1:-1.1)+i*8+bridgeLayout.length*5)%bridgeLayout.length);});
        world.traffic.forEach((car,i)=>{const direction=i%2?1:-1,p=streetPose(streetView?((elapsed*(direction*1.2)+i*4+320)%32)-(variant==='plaza'?12:48):((elapsed*(direction*1.2)+i*16+640)%160)-80,direction);car.scale.setScalar(.5);car.position.set(p.x,.02,p.z);car.rotation.y=p.heading;});
        for(let i=0;i<22;i++){
          const walk=walkingTime(elapsed,i);
          const x=streetView?((i*.83+walk*(i%2?.18:-.14)+180)%18)-(variant==='plaza'?10:42):((i*4.37+walk*(i%2?.18:-.14)+320)%80)-36,z=streetPose(x).z+.7+(i%3)*.12;
          world.people.update(i,x,z,walk,i%2?1:-1,0,hoveredPerson===i?1:0);
        }
        world.residentPositions.forEach((p,i)=>world.people.update(22+i,p.x,p.z,elapsed*.20,i%2?1:-1,p.y,hoveredPerson===22+i?1:(i%7===0&&elapsed%18<3?.7:0),true));
        world.people.flush();
        const sealT=elapsed*.14;
        world.seaLion.position.set(24+Math.sin(sealT)*1.1,-.56+Math.sin(elapsed*2)*.045,8+Math.cos(sealT)*3);
        world.seaLion.rotation.set(Math.sin(elapsed*2)*.06,Math.atan2(Math.sin(sealT)*3,Math.cos(sealT)*1.1),Math.sin(elapsed*2)*.025);
        world.sealFlippers.forEach((flipper,i)=>{flipper.rotation.x=Math.sin(elapsed*2.5+i*Math.PI)*.38;});
        world.cyclists.forEach((bike,i)=>{const p=streetPose(streetView?((elapsed*(i%2?-.55:.7)+i*7+220)%22)-43:((elapsed*(i%2?-.55:.7)+i*26+400)%100)-48);bike.scale.setScalar(.35);bike.position.set(p.x,.03,p.z+.65);bike.rotation.y=p.heading+(i%2?Math.PI:0);});
        const tramPose=streetcarPose(streetView?((elapsed*.85+7)%32)-(variant==='plaza'?12:48):((elapsed*.85+42)%130)-65);world.tram.position.set(tramPose.x,.05,tramPose.z);world.tram.rotation.y=tramPose.heading;
        world.birds.forEach((bird,i)=>{const pose=birdPose(elapsed,i);bird.group.position.set(pose.x,pose.y,pose.z);bird.group.rotation.set(0,pose.heading,Math.cos(elapsed*.1+i)*.12);bird.wings[0].rotation.x=pose.flap;bird.wings[1].rotation.x=-pose.flap;});
        world.ripples.position.x=Math.sin(elapsed*.18)*.25;lastMotion=elapsed;
        }
        world.root.updateMatrixWorld(); camera.updateMatrixWorld();
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
        world.waterTime.value=elapsed;
        const visual=[width,height,target.x.toFixed(4),target.z.toFixed(4),yaw.toFixed(4),camera.zoom.toFixed(4),duskAmount.toFixed(4),lighting.hours,lighting.minutes,(scene.background as InstanceType<typeof THREE.Color>).getHexString()].join(',');
        host.dataset.motion=still?'paused':'playing';
        if(!still||visual!==lastVisual){renderer.info.reset();cinematic.render();if(!presented){presented=true;setStatus('ready');}host.dataset.triangles=String(renderer.info.render.triangles);}lastVisual=visual;
      }
      frame=requestAnimationFrame(animate);
      teardown=()=>{
        cancelAnimationFrame(frame);resizeObserver.disconnect();observer.disconnect();
        host.removeEventListener('touchstart',onTouchStart);host.removeEventListener('touchmove',onTouchMove);host.removeEventListener('wheel',onWheel);host.removeEventListener('pointerdown',onDown);host.removeEventListener('pointermove',onMove);host.removeEventListener('pointerup',onUp);host.removeEventListener('pointerleave',onLeave);host.removeEventListener('pointercancel',onCancel);document.removeEventListener('visibilitychange',onVisibility);renderer.domElement.removeEventListener('webglcontextlost',onLost);
        const geometries=new Set<InstanceType<typeof THREE.BufferGeometry>>(), mats=new Set<InstanceType<typeof THREE.Material>>();
        world.root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){if(!o.userData.sharedGeometry)geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}});
        cinematic.dispose();starGeometry.dispose();starMaterial.dispose();geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();
      };
    }).catch(()=>{if(!disposed)setStatus('fallback');});
    return()=>{disposed=true;teardown();motionQuery.removeEventListener('change',onMotion);};
  },[streetView,variant]);
  const reset=()=>{stopEdgeTurn.current();setFocus(null);setZoom(openingCamera.zoom);settings.current.yaw=openingCamera.yaw;};
  if(streetView)return <div className="contact-street-world">
    <div className="world-scene" ref={mount} aria-hidden="true"/>
  </div>;
  return <section className="world" aria-label="Explore the waterfront: drag to look around, click a landmark to move closer; click a person or press Enter to hear from a passerby" tabIndex={0} onKeyDown={e=>{if(e.key==='+'||e.key==='='){changeZoom(.25);e.preventDefault();}if(e.key==='-'){changeZoom(-.25);e.preventDefault();}if(e.key==='ArrowLeft'){settings.current.yaw-=.18;e.preventDefault();}if(e.key==='ArrowRight'){settings.current.yaw+=.18;e.preventDefault();}if(e.key==='Escape'){reset();setSpeech(null);}if(e.key==='Enter'&&(e.target===e.currentTarget||e.target===mount.current)){speak.current();e.preventDefault();}}}>
    <div className="world-poster" aria-hidden="true"/><div className="world-scene" ref={mount} tabIndex={-1} data-ready={status==='ready'}/>
    {overlay}
    {speech&&<div className="passerby-bubble" ref={bubble} role="status" key={speech.serial}><span>{speech.text}</span></div>}
    {status==='loading'&&<div className="world-loading" role="status"><span className="sr-only">Loading the waterfront</span></div>}
    {status==='fallback'&&fallback}
    <a className="world-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a><div className="world-tools"><div className="world-controls" aria-label="Landscape controls"><button onClick={()=>changeZoom(-.25)} disabled={zoom<=.75} aria-label="Zoom out" title="Zoom out (−)">−</button><button onClick={()=>changeZoom(.25)} disabled={zoom>=2.75} aria-label="Zoom in" title="Zoom in (+)">+</button><span className="tool-divider"/><button onClick={reset} aria-label="Reset the view" title="Reset view and zoom">↺</button><span className="tool-divider"/><button onClick={toggleMotion} aria-pressed={paused} aria-label={paused?'Resume landscape motion':'Pause landscape motion'}>{paused?'▷':'Ⅱ'}</button></div></div>

  </section>;
}
