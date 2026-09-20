'use client';
import {useEffect,useId,useRef,useState} from 'react';

export default function CityCredits(){
  const [open,setOpen]=useState(true),id=useId(),host=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),touched=useRef(false);
  useEffect(()=>{
    const timer=setTimeout(()=>{if(!touched.current&&!host.current?.contains(document.activeElement))setOpen(false);},6000);
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!host.current?.contains(event.target))setOpen(false);};
    document.addEventListener('pointerdown',outside);
    return()=>{clearTimeout(timer);document.removeEventListener('pointerdown',outside);};
  },[]);
  return <div className="world-info" ref={host} onKeyDown={event=>{if(event.key==='Escape'&&open){event.stopPropagation();setOpen(false);button.current?.focus();}}}>
    <button ref={button} className="world-info-button" aria-label="About this city" aria-expanded={open} aria-controls={id} onClick={()=>{touched.current=true;setOpen(value=>!value);}}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 10.5v6M12 7v.5"/></svg></button>
    <div className="world-info-panel" id={id} hidden={!open}><p>A miniature of San Francisco.</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Map data © OpenStreetMap contributors</a><a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">Open Database License</a></div>
  </div>;
}
