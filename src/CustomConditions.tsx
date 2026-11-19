import {useEffect,useId,useRef,useState,type RefObject} from 'react';
import {sanFranciscoTime,timeMinutes,timeText,weatherLabels,type Conditions,type Weather} from './conditions.ts';

const rideNames={bridge:'Bay Bridge drive',streetcar:'F-line streetcar'} as const;
export type Ride={mode:keyof typeof rideNames;paused:boolean};
type Props={
  value:Conditions;change:(value:Conditions)=>void;
  ride:Ride|null;startRide:(mode:Ride['mode'])=>void;toggleRide:()=>void;endRide:()=>void;
  customButton:RefObject<HTMLButtonElement|null>;
};

export default function CustomConditions({value,change,ride,startRide,toggleRide,endRide,customButton}:Props){
  const [open,setOpen]=useState(false),[liveTime,setLiveTime]=useState(sanFranciscoTime);
  const anchor=useRef<HTMLDivElement>(null),pause=useRef<HTMLButtonElement>(null),liveSwitch=useRef<HTMLInputElement>(null),panel=useId();
  const mode=ride?.mode;
  const [harbor,setHarbor]=useState<{tide:string;sailing:string}>();
  useEffect(()=>{
    if(!open)return;
    let active=true;
    const refresh=async()=>{
      const {harborConditionsAt,refreshHarborTide}=await import('../app/harbor-conditions.ts');
      const show=()=>{
        if(!active)return;
        const {tide,next}=harborConditionsAt(new Date(),value.minutes);
        const height=(tide.meters*3.28084).toFixed(1);
        const sailing=next.status==='scheduled'?
          (next.daysAhead===1?'Tomorrow ':next.daysAhead?'In '+next.daysAhead+' days ':'')+
          timeText(next.minutes)+' · '+next.destination+' · Gate '+next.gate:
          next.status==='outside feed'?'Outside published timetable':'No further published sailing';
        setHarbor({tide:tide.source==='mean level'?'Mean sea level · observation unavailable':
          height+' ft MLLW · '+(tide.source==='observed'?'NOAA observation':'NOAA prediction'),sailing});
      };
      show();
      if(value.minutes===undefined){await refreshHarborTide(new Date());show();}
    };
    void refresh();
    const timer=setInterval(()=>void refresh(),60000);
    return()=>{active=false;clearInterval(timer);};
  },[open,value.minutes]);
  useEffect(()=>{
    if(mode)pause.current?.focus({preventScroll:true});
  },[mode]);
  useEffect(()=>{
    if(!open&&!mode)return;
    function escape(event:KeyboardEvent){
      if(event.key!=='Escape'||event.isComposing)return;
      event.preventDefault();event.stopPropagation();
      if(event.repeat)return;
      if(open){setOpen(false);customButton.current?.focus({preventScroll:true});}
      else endRide();
    }
    document.addEventListener('keydown',escape,true);
    return()=>document.removeEventListener('keydown',escape,true);
  },[open,mode,endRide,customButton]);
  const live=value.minutes===undefined,custom=!live||value.weather!==undefined;
  useEffect(()=>{
    if(!open)return;
    function dismiss(e:PointerEvent){
      if(!anchor.current?.contains(e.target as Node))setOpen(false);
    }
    document.addEventListener('pointerdown',dismiss,true);
    return()=>document.removeEventListener('pointerdown',dismiss,true);
  },[open]);
  useEffect(()=>{
    if(!open||!live)return;
    const timer=window.setInterval(()=>setLiveTime(sanFranciscoTime()),1000);
    return()=>window.clearInterval(timer);
  },[open,live]);
  return <div className="standalone-custom" ref={anchor} onBlur={e=>{
    if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget))setOpen(false);
  }}>
    {ride&&<div className="standalone-ride-toolbar" role="group" aria-label={rideNames[ride.mode]+' controls'}>
      <button ref={pause} type="button" onClick={toggleRide} aria-label={ride.paused?'Resume ride':'Pause ride'}>
        {ride.paused?'Resume':'Pause'}
      </button>
      <button type="button" onClick={endRide} aria-label="Return to waterfront">Return</button>
    </div>}
    <button type="button" ref={customButton} className="standalone-custom-trigger" aria-expanded={open} aria-controls={panel}
      data-custom={custom} onClick={()=>{setLiveTime(sanFranciscoTime());setOpen(!open);}}>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M2 6h4m4 0h8M2 14h8m4 0h4"/><circle cx="8" cy="6" r="2"/><circle cx="12" cy="14" r="2"/>
      </svg>
      Custom
    </button>
    <div id={panel} className="standalone-custom-panel" hidden={!open} role="group" aria-label="Custom conditions">
      <div className="standalone-custom-view">
        <label htmlFor={panel+'-view'}>View</label>
        <select id={panel+'-view'} value={mode??'waterfront'} onChange={e=>{
          const selection=e.target.value;
          setOpen(false);
          if(selection==='bridge'||selection==='streetcar')startRide(selection);
          else endRide();
        }}>
          <option value="waterfront">Waterfront</option>
          <option value="bridge">{rideNames.bridge}</option>
          <option value="streetcar">{rideNames.streetcar}</option>
        </select>
      </div>
      <div className="standalone-custom-time">
        <label htmlFor={panel+'-time'}>San Francisco time</label>
        <label className="standalone-custom-live">
          <input ref={liveSwitch} type="checkbox" aria-label="Use live San Francisco time" checked={live} onChange={e=>{
            setLiveTime(sanFranciscoTime());
            change({...value,minutes:e.target.checked?undefined:timeMinutes(sanFranciscoTime())});
          }}/> Live
        </label>
      </div>
      <input id={panel+'-time'} type="time" disabled={live} value={value.minutes===undefined?liveTime:timeText(value.minutes)}
        onChange={e=>{const minutes=timeMinutes(e.target.value);if(minutes!==undefined)change({...value,minutes});}}/>
      <label className="standalone-custom-weather" htmlFor={panel+'-weather'}>Weather</label>
      <select id={panel+'-weather'} value={value.weather??''} onChange={e=>change({...value,weather:(e.target.value||undefined) as Weather|undefined})}>
        <option value="">Live San Francisco</option>
        {Object.entries(weatherLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select>
      {harbor&&<dl className="standalone-harbor-data">
        <div><dt>Tide</dt><dd>{harbor.tide}</dd></div>
        <div><dt>Next SF Bay Ferry sailing</dt><dd>{harbor.sailing}</dd></div>
      </dl>}
      <button className="standalone-custom-reset" type="button" disabled={!custom}
        onClick={()=>{setLiveTime(sanFranciscoTime());change({});liveSwitch.current?.focus();}}>Reset to live</button>
    </div>
  </div>;
}
