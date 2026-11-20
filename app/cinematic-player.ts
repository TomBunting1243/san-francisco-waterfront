import {openingSeconds,type WaterfrontShot} from './waterfront-shot.ts';
import {filmAssetPath,portraitFilmQuery,type FilmEdition} from './cinematic-edition.ts';
import {readMotionPreference,motionEvent} from './city-runtime.ts';

export type CinematicOpening={
  shot:WaterfrontShot;
  progress:()=>number;
  stage:(stage:number)=>void;
  drawn:(progress:number,sceneryReady:boolean)=>void;
  skipToEnd:()=>void;
  unavailable:()=>void;
  dispose:()=>void;
};

export let currentOpening:CinematicOpening|undefined;

export function startCinematicOpening(edition?:FilmEdition,scope?:HTMLElement):CinematicOpening|undefined{
  const element=scope?scope.querySelector<HTMLElement>('#cinematic-opening'):document.getElementById('cinematic-opening');
  if(!edition||!element)return;
  if(!scope&&currentOpening)return currentOpening;
  const {shot}=edition;
  const layer=element;
  const root=scope??document.documentElement,orientation=matchMedia(portraitFilmQuery);
  let video=makeVideo(),pending:HTMLVideoElement|undefined,rotationRequest:AbortController|undefined;
  root.dataset.openingPhase='film';
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const data=matchMedia('(prefers-reduced-data: reduce)');
  const network=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection;
  const asset=()=>filmAssetPath(edition,orientation.matches);
  let path=asset();
  let live=false,stopped=false,failed=false,release=false,disposed=false,progress=0,stage=0,raf=0;
  let liveClock:{from:number;start:number;duration:number}|undefined;
  const started=performance.now();
  function makeVideo(){
    const node=document.createElement('video');
    node.muted=true;node.defaultMuted=true;node.playsInline=true;node.disablePictureInPicture=true;
    node.setAttribute('aria-hidden','true');return node;
  }
  video.poster=path+(preferences()?'-end':'')+'.webp';layer.style.backgroundImage='url("'+video.poster+'")';
  layer.appendChild(video);
  // The endpoint occupies the final 1/24s of each film.
  function position(){
    if(stopped)return progress;
    if(liveClock)return Math.min(1,liveClock.from+(document.hidden?0:performance.now()-liveClock.start)/liveClock.duration);
    return Number.isFinite(video.duration)?Math.min(1,video.currentTime/Math.max(.1,video.duration-1/24)):0;
  }
  function preferences(){return media.matches||data.matches||network?.saveData===true||readMotionPreference();}
  function stop(at:number){
    progress=at;stopped=true;video.pause();
    if(liveClock){liveClock=undefined;cleanup();}
  }
  function handoff(){
    if(disposed||failed)return;
    const canvas=(scope??document).querySelector<HTMLElement>('.world-scene[data-ready=true]');
    if(!canvas){raf=requestAnimationFrame(handoff);return;}
    root.dataset.openingPhase='handoff';
    raf=requestAnimationFrame(()=>{
      const transitions=canvas.getAnimations().map(a=>a.finished);
      void Promise.allSettled(transitions).then(()=>{
        if(failed||disposed)return;
        root.dataset.openingPhase='live';releaseVideo();
        if(!scope)layer.remove();
      });
    });
  }
  function syncRate(){
    if(stopped||release||!Number.isFinite(video.duration))return;
    const t=position();
    // Ease playback toward the measured build progress. Even a blocked renderer
    // continues to play, then retains the final frame until the city can draw it.
    const elapsed=(performance.now()-started)/1000;
    const complete=(stage+.5)/9;
    const projectedSecondsLeft=Math.max(1.5,elapsed*(1-complete)/complete);
    const filmLeft=(1-t)*video.duration;
    const desired=live?1:Math.max(.8,Math.min(1,filmLeft/projectedSecondsLeft));
    video.playbackRate+=(desired-video.playbackRate)*.6;
  }
  let requestedControl=false;
  function skip(e:Event){
    if(failed||disposed)return;
    const target=e.target;if(!(target instanceof Element)||!target.closest('.world')||(scope&&!scope.contains(target)))return;
    // If the visitor asks to explore during construction, keep the film moving
    // until a rendered frame exists, then give that position to the controls.
    requestedControl=true;
    if(live&&!stopped)stop(position());
  }
  function visibility(){
    if(stopped||failed||pending)return;
    if(liveClock){
      const now=performance.now();
      if(document.hidden)liveClock.from=Math.min(1,liveClock.from+(now-liveClock.start)/liveClock.duration);
      liveClock.start=now;
    }else if(document.hidden)video.pause();else play(video);
  }
  function pauseForPreference(){if(preferences()){if(liveClock)stop(1);else videoFailed();}}
  function unavailable(){
    if(disposed)return;
    failed=true;cancelPending();cancelAnimationFrame(raf);
    if(root.dataset.openingPhase==='live'){delete root.dataset.openingPhase;cleanup();return;}
    root.dataset.openingPhase='fallback';stop(1);cleanup();video.hidden=true;
    layer.style.backgroundImage='url("'+asset()+'-end.webp")';discard(video);
  }
  function finish(){if(!release)stop(1);}
  function videoFailed(){
    if(release||disposed||failed)return;
    cancelPending();stop(1);video.hidden=true;layer.style.backgroundImage='url("'+asset()+'-end.webp")';
    if(video.src)discard(video);
  }
  function cleanup(){
    document.removeEventListener('visibilitychange',visibility);
    document.removeEventListener('pointerdown',skip,true);document.removeEventListener('keydown',skip,true);document.removeEventListener('wheel',skip,true);
    media.removeEventListener('change',pauseForPreference);data.removeEventListener('change',pauseForPreference);
    window.removeEventListener(motionEvent,pauseForPreference);window.removeEventListener('storage',pauseForPreference);
  }
  function discard(node:HTMLVideoElement){
    const src=node.src;node.pause();node.removeAttribute('src');node.load();node.remove();
    if(src?.startsWith('blob:'))URL.revokeObjectURL(src);
  }
  function cancelPending(){
    if(!pending)return;
    const previous=pending;pending=undefined;rotationRequest?.abort();rotationRequest=undefined;discard(previous);
  }
  function releaseVideo(){
    orientation.removeEventListener('change',rotate);cancelPending();discard(video);
  }
  function play(node:HTMLVideoElement){
    if(!document.hidden)void node.play().catch((error:Error)=>{
      if(error.name!=='AbortError'&&node===video&&!pending&&!stopped)videoFailed();
    });
  }
  function listen(node:HTMLVideoElement){
    node.addEventListener('timeupdate',()=>{if(node===video&&!pending)syncRate();});
    node.addEventListener('ended',()=>{if(node===video&&!pending)finish();});
    node.addEventListener('error',()=>{if(node===video&&!pending)videoFailed();});
    node.addEventListener('playing',()=>{node.dataset.playing='true';});
  }
  function rotate(){
    if(disposed||release)return;
    cancelPending();
    if(failed||preferences()||(stopped&&progress===1)){
      video.hidden=true;layer.style.backgroundImage='url("'+asset()+'-end.webp")';return;
    }
    if(asset()===path){if(!stopped)play(video);return;}
    // Keep the last decoded frame visible. Seek the new native edition to
    // that same shot time before replacing it, including a paused gesture.
    const at=position(),next=makeVideo(),nextPath=asset();
    const request=new AbortController();rotationRequest=request;
    pending=next;video.pause();next.preload='auto';
    function ready(event:Event){
      if(pending!==next||next.readyState<2||next.seeking||!Number.isFinite(next.duration))return;
      const target=at*Math.max(.1,next.duration-1/24);
      if(Math.abs(next.currentTime-target)>1/48){if(event.type==='seeked')videoFailed();return;}
      const old=video;pending=undefined;rotationRequest=undefined;video=next;path=nextPath;
      next.dataset.playing='true';next.playbackRate=old.playbackRate;
      listen(next);layer.appendChild(next);discard(old);
      if(!stopped)play(next);
    }
    next.addEventListener('loadedmetadata',()=>{
      if(pending===next&&Number.isFinite(next.duration))next.currentTime=at*Math.max(.1,next.duration-1/24);
    },{once:true});
    next.addEventListener('loadeddata',ready);next.addEventListener('seeked',ready);
    const failedSwap=()=>{if(pending===next)videoFailed();};
    next.addEventListener('error',failedSwap,{once:true});
    next.addEventListener('stalled',failedSwap,{once:true});
    // The public host can ignore Range and return the whole movie. A local
    // Blob supports seeking to the held frame without fetching the film twice.
    async function download(){
      const timeout=setTimeout(failedSwap,openingSeconds*1000);
      try{
        const response=await fetch(nextPath+'.mp4',{signal:request.signal});
        if(!response.ok)throw new Error('Film unavailable');
        const blob=await response.blob();
        if(request.signal.aborted||pending!==next)return;
        next.src=URL.createObjectURL(blob);next.load();
      }catch{failedSwap();}finally{clearTimeout(timeout);}
    }
    void download();
  }
  function dispose(){
    if(disposed)return;
    disposed=true;orientation.removeEventListener('change',rotate);cancelAnimationFrame(raf);cleanup();releaseVideo();
    delete root.dataset.openingPhase;
    if(currentOpening===opening)currentOpening=undefined;
  }
  const opening:CinematicOpening={shot,progress:position,stage(value){stage=Math.max(stage,value);syncRate();},skipToEnd(){requestedControl=true;stop(1);if(!release)videoFailed();},unavailable,dispose,
    drawn(rendered,sceneryReady){
      if(failed||disposed)return;
      if(release){if(liveClock&&rendered>=1)stop(1);return;}
      live=true;
      if(pending)return;
      if(!stopped&&requestedControl)stop(position());
      // The endpoint print contains the full skyline, including on data saver.
      if(!sceneryReady&&!requestedControl)return;
      if(stopped){
        if(Math.abs(rendered-progress)>.0001)return;
        cleanup();
      }else{
        // The native decoder covers construction. As soon as the skyline in
        // this view is ready, continue the authored orbit in the live city.
        const duration=(Number.isFinite(video.duration)?video.duration:openingSeconds)-1/24;
        liveClock={from:rendered,start:performance.now(),duration:Math.max(.1,duration)*1000};
        video.playbackRate=1;
      }
      release=true;raf=requestAnimationFrame(handoff);
    }};
  if(!scope)currentOpening=opening;
  for(const event of ['pointerdown','keydown','wheel'])document.addEventListener(event,skip,{capture:true,passive:true});
  media.addEventListener('change',pauseForPreference);data.addEventListener('change',pauseForPreference);
  window.addEventListener(motionEvent,pauseForPreference);window.addEventListener('storage',pauseForPreference);
  orientation.addEventListener('change',rotate);
  if(preferences()){videoFailed();return opening;}
  document.addEventListener('visibilitychange',visibility);
  listen(video);video.src=path+'.mp4';play(video);
  return opening;
}
