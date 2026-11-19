const steps=['Loading the waterfront','Shaping the shoreline','Building the city blocks','Rigging the Bay Bridge','Fitting out the ferry landings','Painting the waterfront','Lighting the windows','Drawing the first view'];

export default function WaterfrontLoading({stage=0}:{stage?:number}){
  return <div className="world-loading">
    <span role="status">{steps[stage]}</span>
    <progress aria-label="Waterfront loading progress" max={steps.length} value={stage||undefined}/>
  </div>;
}
