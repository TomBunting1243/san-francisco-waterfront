'use client';
import {useLayoutEffect,useRef} from 'react';
import {attachClockArrival,finishClockArrival} from './clock-arrival';

export default function WaterfrontPoster({state='loading',still=false}:{state?:'loading'|'ready'|'fallback';still?:boolean}){
  const ref=useRef<HTMLDivElement>(null);
  const staticView=state==='fallback'||still;
  useLayoutEffect(()=>{if(staticView){finishClockArrival();return;}return attachClockArrival(ref.current!);},[staticView]);
  return <div ref={ref} className="world-poster" data-state={state} data-still={still} aria-hidden="true">
    <div className="world-clock-wide"/><div className="world-clock-detail"/><div className="world-arrival-fog"/>
  </div>;
}
