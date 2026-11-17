import {useEffect,useId,useRef,useState} from 'react';
import {landmarks,type Landmark} from './landmarks';
import {lightLabels,type ScenePreferences,type HarborLight} from './scene-preferences';

type Props = {
  focus: Landmark|null; visit: (landmark:Landmark|null)=>void;
  paused: boolean; toggleMotion: ()=>void; zoom: number; changeZoom: (step:number)=>void; reset: ()=>void;
  preferences: ScenePreferences; update:(next:ScenePreferences)=>void;
};
export default function SceneControls({focus,visit,paused,toggleMotion,zoom,changeZoom,reset,preferences,update}:Props) {
  const [open,setOpen]=useState(false);
  const controls=useRef<HTMLDivElement>(null), trigger=useRef<HTMLButtonElement>(null);
  const panel=useId();
  useEffect(()=>{
    if(!open)return;
    const outside=(e:PointerEvent)=>{if(!controls.current?.contains(e.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  return <div className="world-tools" ref={controls} onBlur={e=>{if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}
    onKeyDown={e=>{if(e.key==='Escape'&&open){e.stopPropagation();setOpen(false);trigger.current?.focus();}}}>
    <div className="world-controls" role="group" aria-label="Landscape controls">
      <button className="world-settings-trigger" ref={trigger} aria-expanded={open} aria-controls={panel} onClick={()=>setOpen(!open)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h8m5 0h5M3 16h3m5 0h10"/><circle cx="13.5" cy="8" r="2.5"/><circle cx="8.5" cy="16" r="2.5"/></svg>Scene
      </button>
      <span className="tool-divider"/>
      <button onClick={()=>changeZoom(-.25)} disabled={zoom<=.75} aria-label="Zoom out" title="Zoom out">−</button>
      <button onClick={()=>changeZoom(.25)} disabled={zoom>=2.75} aria-label="Zoom in" title="Zoom in">+</button>
      <button onClick={reset} aria-label="Reset the view" title="Reset view"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9a7 7 0 1 1-.4 5M5 4v5h5"/></svg></button>
      <span className="tool-divider"/>
      <button onClick={toggleMotion} aria-pressed={paused} aria-label={paused?'Resume landscape motion':'Pause landscape motion'} title={paused?'Resume motion':'Pause motion'}>
        <svg viewBox="0 0 24 24" aria-hidden="true">{paused?<path d="m8 5 10 7-10 7Z"/>:<path d="M8 5v14M16 5v14"/>}</svg>
      </button>
    </div>
    {open&&<div className="world-panel" id={panel}>
      <fieldset><legend>Light</legend><div className="world-light-options">{(Object.keys(lightLabels) as HarborLight[]).map(key=><button key={key} aria-pressed={preferences.light===key} onClick={()=>update({...preferences,light:key})}>{lightLabels[key]}</button>)}</div></fieldset>
      <label className="world-view-label">Viewpoint<select value={focus??''} onChange={e=>visit((e.target.value||null) as Landmark|null)}><option value="">Waterfront panorama</option>{(Object.keys(landmarks) as Landmark[]).map(key=><option key={key} value={key}>{landmarks[key].label}</option>)}</select></label>
      <label className="world-economy"><input type="checkbox" checked={preferences.economy} onChange={e=>update({...preferences,economy:e.target.checked})}/> Save graphics power</label>
    </div>}
  </div>;
}
