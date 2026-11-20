import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {selectFilmEdition} from '../app/cinematic-edition.ts';
import {cinematicOrbit} from '../app/cinematic-camera.ts';
import {waterfrontShotPose} from '../app/waterfront-shot.ts';
import {orbitOffset} from '../app/camera.ts';

function camera(eye,look,lens,dx,dy,w,h){
  const c=new THREE.PerspectiveCamera(20,w/h,.35,1800);
  c.position.fromArray(eye);c.lookAt(...look);c.setFocalLength(lens);
  c.setViewOffset(w,h,-dx,-dy,w,h);c.updateMatrixWorld();return c;
}
for(const shot of ['city-to-bridge','bridge-to-city']){
  test(shot+' passes its recorded lens, eye and direction into the navigable orbit',()=>{
    for(const [w,h] of [[1280,720],[1440,940],[390,844],[2560,1080]]){
      for(const t of [0,.18,.57,.97,1]){
        const take=waterfrontShotPose(shot,t,1280,720);
        const orbit=cinematicOrbit(shot,t,w,h);
        const offset=new THREE.Vector3();
        orbitOffset(orbit,orbit.yaw,0,offset);
        const eye=new THREE.Vector3(...orbit.target).add(offset);
        assert.ok(eye.distanceTo(new THREE.Vector3(...take.eye))<1e-10);
        const a=camera(take.eye,take.look,take.focalLength,take.shiftX,take.shiftY,1280,720);
        const b=camera(eye.toArray(),orbit.target,orbit.focalLength,orbit.shiftX,orbit.shiftY,w,h);
        const scale=Math.min(w/1280,h/720);
        for(const position of [[0,2,-1.2],[-11,6,54],[1,.2,6]]){
          const p=new THREE.Vector3(...position).project(a),q=new THREE.Vector3(...position).project(b);
          assert.ok(Math.abs(p.x*640*scale-q.x*w/2)<1e-7);
          assert.ok(Math.abs(p.y*360*scale-q.y*h/2)<1e-7);
        }
        orbitOffset(orbit,orbit.yaw+.1,.03,offset);
        assert.ok(new THREE.Vector3(...orbit.target).add(offset).distanceTo(eye)>.2);
      }
    }
  });
}

let session=0;
async function withPlayer(options,run){
  const old=new Map(),frames=[];
  const media=Object.assign(new EventTarget(),{matches:!!options.reduced});
  const data=Object.assign(new EventTarget(),{matches:false});
  const matchMedia=query=>query.includes('reduced-data')?data:media;
  const video=Object.assign(new EventTarget(),{style:{},dataset:{},readyState:4,HAVE_FUTURE_DATA:3,duration:361/24,currentTime:0,playbackRate:1,
    play(){return Promise.resolve();},pause(){},setAttribute(){},removeAttribute(){},load(){}});
  const layer={style:{},appendChild(){this.attached=true;},remove(){this.removed=true;}};
  const root={dataset:{}};
  const doc=Object.assign(new EventTarget(),{documentElement:root,closest:()=>options.inWorld?layer:null,getElementById:()=>layer,createElement:()=>video,
    querySelector:()=>({getAnimations:()=>[]})});
  const clock={now:0};
  const globals={Element:EventTarget,performance:{now:()=>clock.now},document:doc,window:Object.assign(new EventTarget(),{matchMedia}),matchMedia,location:{search:options.query},
    localStorage:{getItem:()=>options.paused?'true':null},navigator:{connection:{saveData:options.saveData}},
    requestAnimationFrame:cb=>frames.push(cb),cancelAnimationFrame:()=>{}};
  try{
    for(const [key,value] of Object.entries(globals)){
      old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
      Object.defineProperty(globalThis,key,{value,configurable:true});
    }
    const player=await import('../app/cinematic-player.ts?session='+ ++session);
    player.startCinematicOpening(selectFilmEdition(options.query,new Date('2026-09-10T19:30:00Z')));
    await run({player,video,root,layer,frames,clock,doc});
  }finally{
    for(const [key,descriptor] of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
}
test('unselected and unrecognized URLs leave the published opening in control',async()=>{
  for(const query of ['', '?opening=other'])await withPlayer({query},({player,layer})=>{
    assert.equal(player.currentOpening,undefined);assert.equal(layer.attached,undefined);
  });
});
test('the film retains its rendered endpoint until the live camera confirms the matching draw',async()=>{
  await withPlayer({query:'?opening=bridge'},async({player,video,root,layer,frames})=>{
    const current=player.currentOpening;
    player.startCinematicOpening();assert.equal(player.currentOpening,current);
    assert.equal(video.src,'./openings/city-to-bridge.mp4');
    video.currentTime=7.5;assert.equal(current.progress(),.5);current.drawn(.5);
    assert.equal(frames.length,0);video.dispatchEvent(new Event('ended'));assert.equal(current.progress(),1);
    current.drawn(.99);assert.equal(frames.length,0);
    current.drawn(1);frames.shift()();assert.equal(root.dataset.openingPhase,'handoff');
    frames.shift()();await Promise.resolve();assert.equal(root.dataset.openingPhase,'live');
    assert.equal(layer.removed,true);
  });
});
test('saved pause, reduced motion and data saver use the selected endpoint without requesting the film',async()=>{
  for(const flag of ['paused','reduced','saveData'])await withPlayer({query:'?opening=skyline',[flag]:true},({player,video,layer})=>{
    assert.equal(video.src,undefined);assert.equal(player.currentOpening.progress(),1);
    assert.match(layer.style.backgroundImage,/bridge-to-city-end.webp/);
  });
});
test('a failed stream switches to its endpoint print while the scene loads',async()=>{
  await withPlayer({query:'?opening=bridge'},({player,video,root,layer})=>{
    video.dispatchEvent(new Event('error'));
    assert.equal(player.currentOpening.progress(),1);assert.equal(video.hidden,true);
    assert.match(layer.style.backgroundImage,/city-to-bridge-end.webp/);assert.equal(root.dataset.openingPhase,'film');
  });
});

test('native playback slows against measured build time and recovers once the renderer draws',async()=>{
  await withPlayer({query:'?opening=bridge'},({player,video,clock})=>{
    const current=player.currentOpening;
    clock.now=22000;video.currentTime=3;current.stage(2);
    const slow=video.playbackRate;assert.ok(slow>0&&slow<.7);
    current.drawn(current.progress(),false);video.dispatchEvent(new Event('timeupdate'));
    assert.ok(video.playbackRate>slow&&video.playbackRate<=1);
  });
});

test('an early navigation gesture takes over at the current film position on the first matching draw',async()=>{
  await withPlayer({query:'?opening=skyline',inWorld:true},({player,video,doc,frames})=>{
    const current=player.currentOpening;
    video.currentTime=2;doc.dispatchEvent(new Event('pointerdown'));
    video.currentTime=7.5;assert.equal(current.progress(),.5);
    current.drawn(.5);assert.equal(frames.length,1);
    video.currentTime=7;assert.equal(current.progress(),.5);
    current.skipToEnd();assert.equal(current.progress(),1);
  });
});
test('a buffered film yields to the live orbit once this skyline is drawn',async()=>{
  await withPlayer({query:'?opening=bridge',inWorld:true},async({player,video,frames,clock,root,doc})=>{
    const current=player.currentOpening;
    video.currentTime=3;current.drawn(.2,false);
    assert.equal(frames.length,0);
    current.drawn(.2,true);frames.shift()();frames.shift()();await Promise.resolve();
    assert.equal(root.dataset.openingPhase,'live');
    clock.now=1500;assert.ok(Math.abs(current.progress()-.3)<1e-7);
    doc.dispatchEvent(new Event('pointerdown'));clock.now=4000;
    assert.ok(Math.abs(current.progress()-.3)<1e-7);
  });
});
test('a ready renderer continues a buffering film from its last rendered position and accepts navigation',async()=>{
  await withPlayer({query:'?opening=skyline',inWorld:true},({player,video,doc,frames,clock})=>{
    const current=player.currentOpening;
    video.currentTime=7.5;video.readyState=2;current.drawn(.5,true);
    assert.equal(frames.length,1);assert.equal(current.progress(),.5);
    clock.now=1500;assert.ok(Math.abs(current.progress()-.6)<1e-7);
    doc.dispatchEvent(new Event('keydown'));clock.now+=2200;
    assert.ok(Math.abs(current.progress()-.6)<1e-7);
    current.skipToEnd();assert.equal(current.progress(),1);
  });
});

test('the two filmed palettes follow the San Francisco sun at dawn and dusk and honor saved local time',()=>{
  const palette=(time,minutes)=>selectFilmEdition('?opening=bridge',new Date(time),minutes).palette;
  assert.equal(palette('2026-09-10T13:35:00Z'),'night');
  assert.equal(palette('2026-09-10T13:36:00Z'),'day');
  assert.equal(palette('2026-09-11T02:36:00Z'),'day');
  assert.equal(palette('2026-09-11T02:37:00Z'),'night');
  assert.equal(palette('2026-12-22T06:00:00Z',720),'day');
  assert.equal(palette('2026-12-21T20:00:00Z',0),'night');
  assert.equal(selectFilmEdition('?film=night',new Date()),undefined);
});

test('the demonstration palette applies to the film, first poster and failure fallback',async()=>{
  for(const [query,id] of [['bridge','city-to-bridge'],['skyline','bridge-to-city']]){
    for(const palette of ['day','night']){
      const path='./openings/'+id+(palette==='night'?'-night':'');
      await withPlayer({query:'?opening='+query+'&film='+palette},({video,layer})=>{
        assert.equal(video.src,path+'.mp4');
        assert.equal(video.poster,path+'.webp');
        video.dispatchEvent(new Event('error'));
        assert.equal(layer.style.backgroundImage,'url("'+path+'-end.webp")');
      });
      await withPlayer({query:'?opening='+query+'&film='+palette,saveData:true},({video})=>{
        assert.equal(video.src,undefined);assert.equal(video.poster,path+'-end.webp');
      });
    }
  }
});
