import { maxZoom, minZoom } from './city-runtime';

type ZoomProps={zoom:number;min:number;max:number;changeZoom:(step:number)=>void};
type Props={paused:boolean;toggleMotion:()=>void;zoom:number;changeZoom:ZoomProps['changeZoom'];reset:()=>void};
function ZoomButtons({zoom,min,max,changeZoom}:ZoomProps){
  return <>
    <button onClick={()=>changeZoom(-.35)} disabled={zoom<=min} aria-label="Zoom out" title="Zoom out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>
    <button onClick={()=>changeZoom(.35)} disabled={zoom>=max} aria-label="Zoom in" title="Zoom in"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg></button>
  </>;
}
export function PassengerZoom(props:ZoomProps){
  return <div className="world-tools"><div className="world-controls" role="group" aria-label="Passenger zoom"><ZoomButtons {...props}/></div></div>;
}
export default function SceneControls({paused,toggleMotion,zoom,changeZoom,reset}:Props) {
  return <div className="world-tools"><div className="world-controls" role="group" aria-label="Waterfront controls">
    <ZoomButtons zoom={zoom} min={minZoom} max={maxZoom} changeZoom={changeZoom}/>
    <span className="tool-divider"/>
    <button onClick={reset} aria-label="Reset the view" title="Return to the opening view"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9a7 7 0 1 1-.4 5M5 4v5h5"/></svg></button>
    <button onClick={toggleMotion} aria-pressed={paused} aria-label={paused?'Resume landscape motion':'Pause landscape motion'} title={paused?'Resume motion':'Pause motion'}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{paused?<path d="m8 5 10 7-10 7Z"/>:<path d="M8 5v14M16 5v14"/>}</svg>
    </button>
  </div></div>;
}
