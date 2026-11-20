import type {WaterfrontShot} from './waterfront-shot.ts';
import {filmAssetPath,type FilmEdition} from './cinematic-edition.ts';
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
  const root=scope??document.documentElement,video=document.createElement('video');
  root.dataset.openingPhase='film';
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const data=matchMedia('(prefers-reduced-data: reduce)');
  const network=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection;
  const path=filmAssetPath(edition);
  let live=false,stopped=false,failed=false,release=false,disposed=false,progress=0,stage=0,raf=0;
  let liveClock:{from:number;start:number;duration:number}|undefined;
  const started=performance.now();
  video.muted=true;video.defaultMuted=true;video.playsInline=true;video.disablePictureInPicture=true;
  video.poster=path+(preferences()?'-end':'')+'.webp';layer.style.backgroundImage='url("'+video.poster+'")';
  video.setAttribute('aria-hidden','true');layer.appendChild(video);
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
    const desired=live?1:Math.max(.18,Math.min(1,filmLeft/projectedSecondsLeft));
    video.playbackRate+=(desired-video.playbackRate)*.6;
  }
  function skip(e:Event){
    if(failed||stopped)return;
    const target=e.target;if(!(target instanceof Element)||!target.closest('.world')||(scope&&!scope.contains(target)))return;
    // If the visitor asks to explore during construction, keep the film moving
    // until a rendered frame exists, then give that position to the controls.
    if(live)stop(position());else pendingInput=true;
  }
  let pendingInput=false;
  function visibility(){
    if(stopped||failed)return;
    if(liveClock){
      const now=performance.now();
      if(document.hidden)liveClock.from=Math.min(1,liveClock.from+(now-liveClock.start)/liveClock.duration);
      liveClock.start=now;
    }else if(document.hidden)video.pause();else void video.play().catch(videoFailed);
  }
  function pauseForPreference(){if(preferences()){if(liveClock)stop(1);else videoFailed();}}
  function unavailable(){
    if(disposed)return;
    failed=true;cancelAnimationFrame(raf);
    if(root.dataset.openingPhase==='live'){delete root.dataset.openingPhase;cleanup();return;}
    root.dataset.openingPhase='fallback';stop(1);cleanup();video.hidden=true;
    layer.style.backgroundImage='url("'+path+'-end.webp")';video.removeAttribute('src');video.load();
  }
  function finish(){if(!release)stop(1);}
  function videoFailed(){
    if(release||disposed||failed)return;
    stop(1);video.hidden=true;layer.style.backgroundImage='url("'+path+'-end.webp")';
  }
  function cleanup(){
    document.removeEventListener('visibilitychange',visibility);
    document.removeEventListener('pointerdown',skip,true);document.removeEventListener('keydown',skip,true);document.removeEventListener('wheel',skip,true);
    media.removeEventListener('change',pauseForPreference);data.removeEventListener('change',pauseForPreference);
    window.removeEventListener(motionEvent,pauseForPreference);window.removeEventListener('storage',pauseForPreference);
  }
  function releaseVideo(){
    video.pause();video.removeAttribute('src');video.load();video.remove();
  }
  function dispose(){
    if(disposed)return;
    disposed=true;cancelAnimationFrame(raf);cleanup();releaseVideo();
    delete root.dataset.openingPhase;
    if(currentOpening===opening)currentOpening=undefined;
  }
  const opening:CinematicOpening={shot,progress:position,stage(value){stage=Math.max(stage,value);syncRate();},skipToEnd(){stop(1);},unavailable,dispose,
    drawn(rendered,sceneryReady){
      if(failed||disposed)return;
      if(release){if(liveClock&&rendered>=1)stop(1);return;}
      live=true;
      if(!stopped&&pendingInput)stop(position());
      if(stopped){
        if(Math.abs(rendered-progress)>.0001)return;
        cleanup();
      }else{
        if(!sceneryReady)return;
        // The native decoder covers construction. As soon as the skyline in
        // this view is ready, continue the authored orbit in the live city.
        const duration=Number.isFinite(video.duration)?video.duration-1/24:15;
        liveClock={from:rendered,start:performance.now(),duration:Math.max(.1,duration)*1000};
        video.playbackRate=1;
      }
      release=true;raf=requestAnimationFrame(handoff);
    }};
  if(!scope)currentOpening=opening;
  for(const event of ['pointerdown','keydown','wheel'])document.addEventListener(event,skip,{capture:true,passive:true});
  media.addEventListener('change',pauseForPreference);data.addEventListener('change',pauseForPreference);
  window.addEventListener(motionEvent,pauseForPreference);window.addEventListener('storage',pauseForPreference);
  if(preferences()){videoFailed();return opening;}
  document.addEventListener('visibilitychange',visibility);
  video.addEventListener('timeupdate',syncRate);video.addEventListener('ended',finish,{once:true});
  video.addEventListener('error',videoFailed,{once:true});video.addEventListener('playing',()=>{video.dataset.playing='true';},{once:true});
  video.src=path+'.mp4';void video.play().catch(videoFailed);
  return opening;
}
