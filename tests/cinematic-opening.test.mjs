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
    for(const [w,h] of [[1280,720],[1440,940],[390,844],[378,880],[720,1280],[844,390],[1000,1000],[2560,1080]]){
      const [sw,sh]=h>=w?[720,1280]:[1280,720];
      for(const t of [0,.18,.57,.97,1]){
        const take=waterfrontShotPose(shot,t,sw,sh);
        const orbit=cinematicOrbit(shot,t,w,h);
        const offset=new THREE.Vector3();
        orbitOffset(orbit,orbit.yaw,0,offset);
        const eye=new THREE.Vector3(...orbit.target).add(offset);
        assert.ok(eye.distanceTo(new THREE.Vector3(...take.eye))<1e-10);
        const a=camera(take.eye,take.look,take.focalLength,take.shiftX,take.shiftY,sw,sh);
        const b=camera(eye.toArray(),orbit.target,orbit.focalLength,orbit.shiftX,orbit.shiftY,w,h);
        const scale=Math.max(w/sw,h/sh);
        for(const position of [[0,2,-1.2],[-11,6,54],[1,.2,6]]){
          const p=new THREE.Vector3(...position).project(a),q=new THREE.Vector3(...position).project(b);
          const anchorX=h>=w&&shot==='bridge-to-city'?.25:.5;
          assert.ok(Math.abs(p.x*sw/2*scale+(.5-anchorX)*(sw*scale-w)-q.x*w/2)<1e-7);
          const extraHeight=sh*scale-h;
          const anchor=h>=w?.66:.86;
          assert.ok(Math.abs(p.y*sh/2*scale+(anchor-.5)*extraHeight-q.y*h/2)<1e-7);
        }
        orbitOffset(orbit,orbit.yaw+.1,.03,offset);
        assert.ok(new THREE.Vector3(...orbit.target).add(offset).distanceTo(eye)>.2);
      }
    }
  });
}

test('the lens widens gently during the close orbit and arrives smoothly at the selected bridge bearing',()=>{
  for(const shot of ['bridge-to-city','city-to-bridge'])for(const [w,h] of [[1280,720],[720,1280]]){
    const pose=t=>waterfrontShotPose(shot,t,w,h);
    const first=pose(0),half=pose(.5);
    const ratio=half.focalLength/first.focalLength;
    assert.ok(ratio>.86&&ratio<.95);
    assert.deepEqual(first.look,half.look);
    assert.ok(Math.hypot(first.eye[0]-half.eye[0],first.eye[2]-half.eye[2])>3);
    const end=pose(1);
    assert.ok(end.focalLength<=half.focalLength);
    if(shot==='bridge-to-city'){
      assert.ok(Math.abs(Math.atan2(end.eye[0]-end.look[0],end.eye[2]-end.look[2])-1.225)<1e-8);
    }
  }
});

const shotTime=fraction=>fraction*(12-1/24);
let session=0;
async function withPlayer(options,run){
  const old=new Map(),frames=[];
  const media=Object.assign(new EventTarget(),{matches:!!options.reduced});
  const data=Object.assign(new EventTarget(),{matches:false});
  const orientation=Object.assign(new EventTarget(),{matches:!!options.portrait});
  const matchMedia=query=>query.includes('reduced-data')?data:query.includes('orientation')?orientation:media;
  const videos=[],requests=[],blobURLs=[],revoked=[];
  class MediaURL extends URL{
    static createObjectURL(){const src='blob:film-'+blobURLs.length;blobURLs.push(src);return src;}
    static revokeObjectURL(src){revoked.push(src);}
  }
  const fetch=(src,{signal})=>new Promise(resolve=>{
    requests.push({src,signal,finish:async(ok=true)=>{
      resolve({ok,blob:async()=>new Blob(['one whole HTTP 200 response'],{type:'video/mp4'})});
      await new Promise(done=>setImmediate(done));
    }});
  });
  function makeVideo(){const node=Object.assign(new EventTarget(),{style:{},dataset:{},readyState:4,HAVE_FUTURE_DATA:3,duration:12,currentTime:0,playbackRate:1,
    play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;},setAttribute(){},removeAttribute(name){if(name==='src')this.src=undefined;},load(){},remove(){this.removed=true;}});
    videos.push(node);return node;
  }
  const layer={style:{},appendChild(){this.attached=true;},remove(){this.removed=true;}};
  const root={dataset:{}};
  const doc=Object.assign(new EventTarget(),{documentElement:root,closest:()=>options.inWorld?layer:null,getElementById:()=>layer,createElement:makeVideo,
    querySelector:()=>({getAnimations:()=>[]})});
  const clock={now:0};
  const globals={fetch,URL:MediaURL,Element:EventTarget,performance:{now:()=>clock.now},document:doc,window:Object.assign(new EventTarget(),{matchMedia}),matchMedia,location:{search:options.query},
    localStorage:{getItem:()=>options.paused?'true':null},navigator:{connection:{saveData:options.saveData}},
    requestAnimationFrame:cb=>frames.push(cb),cancelAnimationFrame:()=>{}};
  try{
    for(const [key,value] of Object.entries(globals)){
      old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
      Object.defineProperty(globalThis,key,{value,configurable:true});
    }
    const player=await import('../app/cinematic-player.ts?session='+ ++session);
    player.startCinematicOpening(selectFilmEdition(options.query,new Date('2026-09-10T19:30:00Z')));
    await run({player,video:videos[0],videos,root,layer,frames,clock,doc,orientation,requests,blobURLs,revoked});
  }finally{
    for(const [key,descriptor] of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
}
test('the root and unfamiliar links open from Bay Bridge to city; a comparison link can reverse it',async()=>{
  for(const query of ['', '?opening=other'])await withPlayer({query},({player,layer})=>{
    assert.equal(player.currentOpening.shot,'bridge-to-city');assert.equal(layer.attached,true);
  });
  assert.equal(selectFilmEdition('?opening=bridge',new Date()).shot,'city-to-bridge');
});
test('the film retains its rendered endpoint until the live camera confirms the matching draw',async()=>{
  await withPlayer({query:'?opening=bridge'},async({player,video,root,layer,frames})=>{
    const current=player.currentOpening;
    player.startCinematicOpening();assert.equal(player.currentOpening,current);
    assert.equal(video.src,'./openings/city-to-bridge.mp4');
    video.currentTime=shotTime(.5);assert.equal(current.progress(),.5);current.drawn(.5);
    assert.equal(frames.length,0);video.dispatchEvent(new Event('ended'));assert.equal(current.progress(),1);
    current.drawn(.99,true);assert.equal(frames.length,0);
    current.drawn(1,false);assert.equal(frames.length,0);
    current.drawn(1,true);frames.shift()();assert.equal(root.dataset.openingPhase,'handoff');
    frames.shift()();await Promise.resolve();assert.equal(root.dataset.openingPhase,'live');
    assert.equal(layer.removed,true);
  });
});
test('saved pause, reduced motion and data saver use the selected endpoint without requesting the film',async()=>{
  for(const flag of ['paused','reduced','saveData'])await withPlayer({query:'?opening=skyline',[flag]:true},({player,video,layer,frames})=>{
    assert.equal(video.src,undefined);assert.equal(player.currentOpening.progress(),1);
    assert.match(layer.style.backgroundImage,/bridge-to-city-end.webp/);
    player.currentOpening.drawn(1,false);assert.equal(frames.length,0);
    player.currentOpening.drawn(1,true);assert.equal(frames.length,1);
  });
});
test('a visitor can take control while the endpoint print waits for the skyline',async()=>{
  await withPlayer({query:'',saveData:true,inWorld:true},({player,doc,frames})=>{
    const current=player.currentOpening;
    current.drawn(1,false);assert.equal(frames.length,0);
    doc.dispatchEvent(new Event('pointerdown'));
    current.drawn(1,false);assert.equal(frames.length,1);
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
    clock.now=22000;video.currentTime=shotTime(.2);current.stage(2);
    const slow=video.playbackRate;assert.ok(slow>=.8&&slow<1);
    current.drawn(current.progress(),false);video.dispatchEvent(new Event('timeupdate'));
    assert.ok(video.playbackRate>slow&&video.playbackRate<=1);
  });
});

test('an early navigation gesture takes over at the current film position on the first matching draw',async()=>{
  await withPlayer({query:'?opening=skyline',inWorld:true},({player,video,doc,frames})=>{
    const current=player.currentOpening;
    video.currentTime=2;doc.dispatchEvent(new Event('pointerdown'));
    video.currentTime=shotTime(.5);assert.equal(current.progress(),.5);
    current.drawn(.5);assert.equal(frames.length,1);
    video.currentTime=7;assert.equal(current.progress(),.5);
    current.skipToEnd();assert.equal(current.progress(),1);
  });
});
test('a buffered film yields to the live orbit once this skyline is drawn',async()=>{
  await withPlayer({query:'?opening=bridge',inWorld:true},async({player,video,frames,clock,root,doc})=>{
    const current=player.currentOpening;
    video.currentTime=shotTime(.2);current.drawn(.2,false);
    assert.equal(frames.length,0);
    current.drawn(.2,true);frames.shift()();frames.shift()();await Promise.resolve();
    assert.equal(root.dataset.openingPhase,'live');
    clock.now=shotTime(.1)*1000;assert.ok(Math.abs(current.progress()-.3)<1e-7);
    doc.dispatchEvent(new Event('pointerdown'));clock.now=4000;
    assert.ok(Math.abs(current.progress()-.3)<1e-7);
  });
});
test('a ready renderer continues a buffering film from its last rendered position and accepts navigation',async()=>{
  await withPlayer({query:'?opening=skyline',inWorld:true},({player,video,doc,frames,clock})=>{
    const current=player.currentOpening;
    video.currentTime=shotTime(.5);video.readyState=2;current.drawn(.5,true);
    assert.equal(frames.length,1);assert.equal(current.progress(),.5);
    clock.now=shotTime(.1)*1000;assert.ok(Math.abs(current.progress()-.6)<1e-7);
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
  assert.deepEqual(selectFilmEdition('?film=night',new Date()),{shot:'bridge-to-city',palette:'night'});
});

test('disposing a portfolio hero during handoff leaves its layer reusable and the standalone player alone',async()=>{
  await withPlayer({query:''},async({player,root,layer,frames,videos})=>{
    const standalone=player.currentOpening;
    const host={dataset:{},querySelector:q=>q==='#cinematic-opening'?layer:{getAnimations:()=>[]},contains:()=>false};
    const hero=player.startCinematicOpening(selectFilmEdition('',new Date()),host);
    assert.equal(hero.shot,'bridge-to-city');assert.equal(host.dataset.openingPhase,'film');
    hero.drawn(0,true);frames.shift()();frames.shift()();
    hero.dispose();await Promise.resolve();
    assert.equal(host.dataset.openingPhase,undefined);assert.equal(layer.removed,undefined);assert.equal(videos[1].removed,true);assert.equal(videos[0].removed,undefined);
    assert.equal(player.currentOpening,standalone);assert.equal(root.dataset.openingPhase,'film');
    standalone.dispose();assert.equal(player.currentOpening,undefined);
  });
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


test('all native portrait editions select matching first and endpoint prints',async()=>{
  for(const [dir,shot] of [['bridge','city-to-bridge'],['skyline','bridge-to-city']])for(const light of ['day','night']){
    const query='?opening='+dir+'&film='+light,base='./openings/'+shot+(light==='night'?'-night':'')+'-portrait';
    await withPlayer({query,portrait:true},({video})=>{
      assert.equal(video.src,base+'.mp4');assert.equal(video.poster,base+'.webp');
    });
    await withPlayer({query,portrait:true,reduced:true},({video,layer,orientation})=>{
      assert.equal(video.src,undefined);assert.equal(video.poster,base+'-end.webp');
      orientation.matches=false;orientation.dispatchEvent(new Event('change'));
      assert.equal(layer.style.backgroundImage,'url("'+base.replace('-portrait','')+'-end.webp")');
      assert.equal(video.src,undefined);
    });
  }
});

test('rotating during construction swaps decoded frames at the same time and cancels obsolete requests',async()=>{
  await withPlayer({query:'?film=night'},async({player,video,videos,orientation,frames,requests,blobURLs,revoked})=>{
    const open=player.currentOpening,rotate=value=>{orientation.matches=value;orientation.dispatchEvent(new Event('change'));};
    video.currentTime=shotTime(.5);rotate(true);
    assert.equal(video.paused,true);assert.equal(videos[1].src,undefined);assert.equal(requests[0].src,'./openings/bridge-to-city-night-portrait.mp4');
    open.drawn(.5,false);assert.equal(frames.length,0);
    rotate(false);assert.equal(videos[1].removed,true);assert.equal(video.paused,false);
    assert.equal(requests[0].signal.aborted,true);await requests[0].finish();
    assert.deepEqual(blobURLs,[]);
    rotate(true);const replacement=videos[2];await requests[1].finish();
    assert.equal(requests.length,2);assert.equal(requests[1].src,requests[0].src);
    assert.equal(replacement.src,blobURLs[0]);replacement.dispatchEvent(new Event('loadedmetadata'));
    assert.equal(replacement.currentTime,shotTime(.5));assert.equal(video.removed,undefined);
    replacement.dispatchEvent(new Event('seeked'));assert.equal(video.removed,true);assert.equal(open.progress(),.5);
    replacement.currentTime=shotTime(.6);assert.equal(open.progress(),.6);
    assert.deepEqual(revoked,[]);open.dispose();assert.deepEqual(revoked,blobURLs);
  });
});

test('a ready renderer waits for the rotated frame or its native endpoint after a failed seek',async()=>{
  await withPlayer({query:''},async({player,video,videos,orientation,frames,requests,revoked,blobURLs})=>{
    video.currentTime=shotTime(.2);orientation.matches=true;orientation.dispatchEvent(new Event('change'));
    player.currentOpening.drawn(.2,true);
    assert.equal(frames.length,0);
    await requests[0].finish();videos[1].dispatchEvent(new Event('stalled'));assert.deepEqual(revoked,blobURLs);assert.equal(player.currentOpening.progress(),1);
    player.currentOpening.drawn(.2,true);assert.equal(frames.length,0);
    player.currentOpening.drawn(1,true);assert.equal(frames.length,1);
  });
});

test('disposing during a rotation discards both decoders and ignores their late events',async()=>{
  await withPlayer({query:''},async({player,video,videos,orientation,layer,requests,blobURLs})=>{
    orientation.matches=true;orientation.dispatchEvent(new Event('change'));
    const next=videos[1];player.currentOpening.dispose();
    assert.equal(requests[0].signal.aborted,true);await requests[0].finish();assert.deepEqual(blobURLs,[]);
    assert.ok(video.removed&&next.removed);assert.equal(player.currentOpening,undefined);
    next.dispatchEvent(new Event('seeked'));next.dispatchEvent(new Event('error'));
    orientation.matches=false;orientation.dispatchEvent(new Event('change'));
    assert.equal(videos.length,2);assert.equal(layer.removed,undefined);
  });
});
test('a navigation gesture during a rotated seek uses the confirmed matching frame',async()=>{
  await withPlayer({query:'',inWorld:true},async({player,video,videos,doc,orientation,frames,requests})=>{
    const open=player.currentOpening;video.currentTime=shotTime(.4);
    open.drawn(.4,false);orientation.matches=true;orientation.dispatchEvent(new Event('change'));
    doc.dispatchEvent(new Event('pointerdown'));open.drawn(.4,true);
    assert.equal(frames.length,0);await requests[0].finish();const next=videos[1];next.dispatchEvent(new Event('loadedmetadata'));
    next.dispatchEvent(new Event('seeked'));open.drawn(.4,true);
    assert.equal(frames.length,1);assert.equal(open.progress(),.4);
  });
});

test('an HTTP error on rotation uses the native endpoint without retrying the media URL',async()=>{
  await withPlayer({query:'?film=night'},async({player,video,videos,orientation,layer,requests,blobURLs})=>{
    assert.equal(requests.length,0);video.currentTime=shotTime(.3);
    orientation.matches=true;orientation.dispatchEvent(new Event('change'));await requests[0].finish(false);
    assert.equal(requests.length,1);assert.deepEqual(blobURLs,[]);assert.equal(videos[1].src,undefined);
    assert.equal(player.currentOpening.progress(),1);assert.match(layer.style.backgroundImage,/night-portrait-end.webp/);
  });
});
