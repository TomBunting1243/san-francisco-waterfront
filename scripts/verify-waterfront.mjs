// Exercise the rendered public CityWorld through Chrome's keyboard, mouse and
// touch input. Neither test assertions nor console output include dialogue text.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import sharp from 'sharp';
import {Matrix4,Vector3} from 'three';

function observeArrivalFog() {
  if(window!==window.top)return;
  const fog={loading:false,shown:false,masked:false,moving:false,reduced:false};
  globalThis.waterfrontFogObservation=fog;
  let firstTransform;
  function sample(){
    const poster=document.querySelector('.world > .world-poster');
    const curtain=poster?.querySelector('.world-arrival-fog');
    if(poster?.dataset.state==='loading'&&curtain){
      const style=getComputedStyle(curtain);
      const drift=getComputedStyle(curtain,'::before');
      fog.loading=true;
      fog.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      const visible=style.display!=='none'&&style.visibility==='visible'&&Number(style.opacity)>.5;
      fog.shown||=visible;
      fog.masked||=visible&&drift.maskImage.includes('harbor-fog.webp');
      if(visible&&drift.animationPlayState==='running'){
        firstTransform??=drift.transform;
        fog.moving||=drift.transform!==firstTransform;
      }
    }
    if(poster?.dataset.state!=='ready'&&poster?.dataset.state!=='fallback')requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}

// Read the two matrices actually uploaded to the visible framebuffer. This keeps
// the check independent of the scene implementation and excludes the shadow map.
function observeCameraMatrices(){
  const gl=WebGL2RenderingContext.prototype, names=new WeakMap();
  const location=gl.getUniformLocation, upload=gl.uniformMatrix4fv;
  const matrices=globalThis.waterfrontMatrices={};
  gl.getUniformLocation=function(program,name){
    const value=location.call(this,program,name);
    if(value&&(name==='viewMatrix'||name==='projectionMatrix'))names.set(value,name);
    return value;
  };
  gl.uniformMatrix4fv=function(value,transpose,data,...rest){
    const name=names.get(value);
    if(name&&this.canvas.closest('.world > .world-scene')&&this.getParameter(this.FRAMEBUFFER_BINDING)===null)matrices[name]=Array.from(data);
    return upload.call(this,value,transpose,data,...rest);
  };
}

function sceneState(){
  const world=document.querySelector('.world'),scene=world?.querySelector(':scope > .world-scene');
  const controls=world?.querySelector('.world-controls');
  const curtain=world?.querySelector('.world-arrival-fog');
  return {
    ready:scene?.dataset.ready==='true'&&!!scene.querySelector('canvas')&&Number(scene.dataset.triangles)>0,
    exploring:world?.dataset.exploring,
    motion:scene?.dataset.motion,
    pressed:controls?.querySelector('[aria-pressed]')?.getAttribute('aria-pressed'),
    timeOrigin:performance.timeOrigin,
    reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
    fog:globalThis.waterfrontFogObservation,
    fogDisplay:curtain&&getComputedStyle(curtain).display,
    fogSettled:curtain&&getComputedStyle(curtain).visibility==='hidden'&&getComputedStyle(curtain,'::before').animationPlayState==='paused',
  };
}

function bubblePlacement(){
  const scene=document.querySelector('.world > .world-scene');
  const bubble=document.querySelector('.world > .passerby-bubble[role="status"]');
  if(!scene||!bubble)return null;
  const style=getComputedStyle(bubble),tail=getComputedStyle(bubble,'::after');
  const {left,right,top,bottom,width,height}=bubble.getBoundingClientRect();
  const view=scene.getBoundingClientRect();
  if(style.visibility!=='visible'||!width||!height||!parseFloat(style.top))return null;
  // Read the head anchor from the rendered offset, independently of how the
  // CSS triangle is centered. The body starts just below the head.
  const anchorX=(left+right)/2+(parseFloat(style.getPropertyValue('--tail-x'))||0);
  const tipX=left+parseFloat(tail.left)+parseFloat(tail.borderLeftWidth)
    +(tail.transform==='none'?0:new DOMMatrixReadOnly(tail.transform).m41);
  const tapX=anchorX,tapY=bottom+19;
  const text=bubble.textContent.trim();
  return {
    text,box:{left,right,top,bottom},view:{left:view.left,top:view.top,right:view.right,bottom:view.bottom},
    tail:{x:tipX,y:bottom+parseFloat(tail.borderTopWidth)},
    tap:{x:tapX,y:tapY},clamped:parseFloat(style.top)<=125.01,
    tapHitsCanvas:document.elementFromPoint(tapX,tapY)?.closest('.world-scene')===scene,
  };
}

function visibleControl(label){
  const target=Array.from(document.querySelectorAll('.world .world-controls button')).find(button=>button.getAttribute('aria-label')===label);
  if(!target||target.disabled)return null;
  const box=target.getBoundingClientRect();
  const x=box.x+box.width/2,y=box.y+box.height/2;
  return target.contains(document.elementFromPoint(x,y))?{x,y}:null;
}

const keys={
  Home:{key:'Home',code:'Home',windowsVirtualKeyCode:36},
  Enter:{key:'Enter',code:'Enter',windowsVirtualKeyCode:13},
  Escape:{key:'Escape',code:'Escape',windowsVirtualKeyCode:27},
  E:{key:'e',code:'KeyE',windowsVirtualKeyCode:69},
  ArrowRight:{key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39},
};
function validatePlacement(placement){
  const {box,view,tail,tap,tapHitsCanvas,clamped}=placement;
  assert.ok([box.left,box.right,box.top,box.bottom,tail.x,tail.y,tap.x,tap.y].every(Number.isFinite),'Invalid speech placement');
  assert.ok(box.left>=view.left&&box.right<=view.right&&box.top>=view.top&&box.bottom<=view.bottom,'Speech must fit inside the viewport');
  assert.ok(tail.y>box.bottom&&tap.y>tail.y&&tapHitsCanvas,'Speech must leave an exposed pointer target on the canvas');
  assert.ok(!clamped,'The selected passerby should be below the top bubble-placement clamp');
}

export async function verifyWaterfront(send,evaluate,url,signal,{evidenceDir,checkFog,checkRides,ridesOnly}={}){
  const read=fn=>evaluate(send,`(${fn})()`);
  async function waitFor(description,readValue,accept,timeout=7500){
    const end=Date.now()+timeout;
    while(Date.now()<end){
      signal.throwIfAborted();
      try{
        const result=await readValue();
        if(accept(result))return result;
      }catch(error){
        if(!/Cannot find (default )?(execution )?context|Execution context was destroyed/.test(error.message))throw error;
      }
      await delay(80,undefined,{signal});
    }
    const state=await read(sceneState);
    throw new Error('Timed out waiting for '+description+'. Scene '+JSON.stringify(state));
  }
  const awaitScene=(description,accept,timeout)=>waitFor(description,()=>read(sceneState),state=>state.ready&&accept(state),timeout);
  const awaitBubble=(description,accept)=>waitFor(description,()=>read(bubblePlacement),accept,4700);
  async function focusWorld(){
    const focused=await evaluate(send,`(() => {
      const world=document.querySelector('.world');
      world?.focus({preventScroll:true});
      return world&&document.activeElement===world;
    })()`);
    assert.ok(focused,'The visible waterfront must accept keyboard focus');
  }
  async function press(key){
    const physical=keys[key];
    await send('Input.dispatchKeyEvent',{...physical,type:'rawKeyDown'});
    await send('Input.dispatchKeyEvent',{...physical,type:'keyUp'});
  }
  async function clickControl(ariaLabel){
    const {x,y}=await waitFor(ariaLabel,()=>evaluate(send,`(${visibleControl})(${JSON.stringify(ariaLabel)})`),Boolean);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,x,y});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x,y});
  }
  const readMatrices=()=>evaluate(send,'globalThis.waterfrontMatrices');
  async function verifyRides(){
    const waterfront=await waitFor('waterfront matrices',readMatrices,m=>m?.viewMatrix&&m.projectionMatrix);
    const eye=m=>new Vector3().setFromMatrixPosition(new Matrix4().fromArray(m).invert());
    for(const mode of ['bridge','streetcar']){
      // The native select change goes through the same React handler as keyboard selection.
      await evaluate(send,`document.querySelector('.standalone-custom-trigger').click()`);
      const selected=await evaluate(send,`(() => {
        const select=document.querySelector('.standalone-custom-view select');
        if(!select?.getClientRects().length)return false;
        select.value=${JSON.stringify(mode)};
        return select.dispatchEvent(new Event('change',{bubbles:true}));
      })()`);
      assert.ok(selected,'The standalone View selector must be visible');
      await waitFor(mode+' boarding',()=>evaluate(send,`document.querySelector('.world').dataset.view===${JSON.stringify(mode)}&&!!document.querySelector('.ride-boarding[data-ready="true"]')`),Boolean,90_000);
      await evaluate(send,`document.querySelector('button[aria-label="Pause ride"]').click()`);
      await awaitScene('paused '+mode,state=>state.motion==='paused');
      const seated=await readMatrices();
      const aspect=seated.projectionMatrix[5]/seated.projectionMatrix[0];
      const u=Math.max(0,Math.min(1,(aspect-.65)/.8));
      const expectedFov=71-19*u*u*(3-2*u);
      assert.ok(Math.abs(2*Math.atan(1/seated.projectionMatrix[5])*180/Math.PI-expectedFov)<.02,'ride vertical field of view');
      await focusWorld();await press('ArrowRight');
      const looking=await waitFor(mode+' head turn',readMatrices,m=>seated.viewMatrix.slice(0,12).some((v,i)=>Math.abs(v-m.viewMatrix[i])>.025));
      assert.deepEqual(looking.projectionMatrix,seated.projectionMatrix,'looking must preserve the lens');
      assert.ok(eye(looking.viewMatrix).distanceTo(eye(seated.viewMatrix))<.0001,'looking must preserve the seated eye');
      const center=await evaluate(send,`(() => {const r=document.querySelector('.world-scene canvas').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await send('Input.dispatchMouseEvent',{type:'mouseWheel',...center,deltaX:0,deltaY:-100,modifiers:2});
      await press('Home');
      const forward=await waitFor(mode+' forward reset',readMatrices,m=>seated.viewMatrix.every((v,i)=>Math.abs(v-m.viewMatrix[i])<.0001));
      assert.deepEqual(forward.projectionMatrix,seated.projectionMatrix,'wheel zoom must leave the ride lens fixed');
      await screenshot(mode+'-fixed-lens');
      await evaluate(send,`document.querySelector('button[aria-label="Return to waterfront"]').click()`);
      await waitFor('restored waterfront camera',readMatrices,m=>['viewMatrix','projectionMatrix'].every(
        name=>waterfront[name].every((v,i)=>Math.abs(v-m[name][i])<.0001)));
    }
    console.log('Both paused driver views turned and recentered with a fixed lens and returned to the waterfront camera.');
  }
  async function screenshot(name){
    if(!evidenceDir)return;
    const {data}=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
    await writeFile(join(evidenceDir,name+'.png'),Buffer.from(data,'base64'));
  }
  async function scenePixels(){
    const rect=await evaluate(send,`(() => {
      const r=document.querySelector('.world > .world-scene').getBoundingClientRect();
      return {x:r.left+r.width*.25+scrollX,y:r.top+r.height*.31+scrollY,
        width:r.width*.57,height:r.height*.47,scale:1};
    })()`);
    const {data}=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false,clip:rect});
    return sharp(Buffer.from(data,'base64')).resize(72,50).removeAlpha().raw().toBuffer();
  }
  function difference(a,b){
    assert.equal(a.length,b.length);
    let sum=0;
    for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);
    return sum/a.length;
  }
  async function media(reduced){
    await send('Emulation.setEmulatedMedia',{features:[
      {name:'prefers-color-scheme',value:'light'},
      {name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'},
      {name:'prefers-reduced-data',value:'no-preference'},
    ]});
  }
  async function reloadAfter(previous,description,accept){
    await send('Page.reload');
    return awaitScene(description,state=>state.timeOrigin!==previous.timeOrigin&&accept(state),90_000);
  }
  const normal=state=>state.motion==='playing'&&state.pressed==='false';
  const paused=state=>state.motion==='paused'&&state.pressed==='true';

  if(evidenceDir)await mkdir(evidenceDir,{recursive:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:940,deviceScaleFactor:1,mobile:false});
  await media(false);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`(${observeCameraMatrices})()`});
  if(checkFog)await send('Page.addScriptToEvaluateOnNewDocument',{source:`(${observeArrivalFog})()`});
  const navigation=await send('Page.navigate',{url});
  if(navigation.errorText)throw new Error(navigation.errorText);
  const running=await awaitScene('the live scene under normal motion preference',normal,90_000);
  if(checkFog)await awaitScene('the loading fog to clear after the first live frame',state=>state.fogSettled);
  if(checkFog)assert.ok(running.fog?.loading&&running.fog.shown&&running.fog.masked&&running.fog.moving,
    'On normal load the masked arrival fog must appear and drift before the scene becomes ready');

  if(checkRides)await verifyRides();
  if(ridesOnly)return;

  await clickControl('Pause landscape motion');
  const stopped=await awaitScene('the scene to pause',paused);
  const persisted=await reloadAfter(stopped,'pause preference after a full reload',paused);
  console.log('Pause persisted through reload.');

  await focusWorld();
  await press('Enter');
  const first=await awaitBubble('visible keyboard-activated speech',bubble=>Boolean(bubble?.text));
  validatePlacement(first);
  await screenshot('keyboard-passerby');
  // Capture can take time in a software renderer. Refresh the current target
  // immediately before dispatching the tap through Chrome.
  const target=await awaitBubble('the rendered pointer target',bubble=>Boolean(bubble?.text));
  validatePlacement(target);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...target.tap,id:1}]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const second=await awaitBubble('a new message after tapping the exposed figure',bubble=>Boolean(bubble?.text&&bubble.text!==target.text));
  validatePlacement(second);
  assert.ok(Math.hypot(second.tap.x-target.tap.x,second.tap.y-target.tap.y)<13,'The tap should speak from the targeted figure');
  await screenshot('pointer-passerby');
  if(evidenceDir){
    const placement=({box,view,tail,tap})=>({box,view,tail,tap});
    const evidence={keyboard:placement(first),pointer:placement(second)};
    await writeFile(join(evidenceDir,'bubble-placement.json'),JSON.stringify(evidence,null,2)+'\n');
  }
  console.log(`Passerby keyboard and touch input passed at (${Math.round(first.tap.x)}, ${Math.round(first.tap.y)}) CSS px.`);

  await focusWorld();
  await press('Escape');
  await waitFor('Escape to dismiss speech',
    ()=>evaluate(send,"!document.querySelector('.world > .passerby-bubble')"),Boolean);
  await awaitScene('Escape to restore the opening view',state=>state.exploring==='false');
  const opening=await scenePixels();
  const homeCamera=await readMatrices();
  await clickControl('Zoom in');
  await awaitScene('the zoomed view',state=>state.exploring==='true');
  await waitFor('the canvas pixels to change after zoom',scenePixels,pixels=>difference(opening,pixels)>.35);
  const telephoto=await waitFor('a longer focal length',readMatrices,
    value=>value.projectionMatrix[0]>homeCamera.projectionMatrix[0]*1.05);
  assert.deepEqual(telephoto.viewMatrix,homeCamera.viewMatrix,'Zoom must preserve the camera position and direction');
  await clickControl('Reset the view');
  await awaitScene('the reset view',state=>state.exploring==='false');
  await delay(1250,undefined,{signal});
  const beforeOrbit=await scenePixels();
  await focusWorld();
  await press('E');
  await delay(140,undefined,{signal});
  await press('E');
  await awaitScene('the rotated view',state=>state.exploring==='true');
  await waitFor('the canvas pixels to change after rotating',scenePixels,pixels=>difference(beforeOrbit,pixels)>.35);
  await press('Escape');
  await awaitScene('Escape to reset the camera after rotation',state=>state.exploring==='false');
  await focusWorld();await press('ArrowRight');
  await awaitScene('travel along the waterfront',state=>state.exploring==='true');
  await press('Escape');
  await awaitScene('return to the Ferry Building',state=>state.exploring==='false');
  console.log('Zoom, rotation, waterfront travel, reset and speech dismissal passed.');

  await clickControl('Resume landscape motion');
  await awaitScene('motion to resume',normal);
  await reloadAfter(persisted,'resume preference after a full reload',normal);
  // Fixture setup only. The prior reload exercised stored user preferences
  // through the visible buttons. Clear this one preference to test the OS default.
  await evaluate(send,`localStorage.removeItem('tom-city-motion-paused')`);
  const beforeReduced=await read(sceneState);
  await media(true);
  const reduced=await reloadAfter(beforeReduced,'reduced-motion default',state=>state.reduced&&paused(state));
  if(checkFog){
    assert.ok(reduced.fog?.loading&&reduced.fog.reduced&&!reduced.fog.shown&&reduced.fogDisplay==='none',
      'Reduced motion should suppress arrival fog during loading');
    console.log('Arrival fog moved on normal load and stayed hidden in reduced motion.');
  }
  console.log('Resume persisted through reload, and an unset preference honored reduced motion.');
}
