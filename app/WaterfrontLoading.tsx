export default function WaterfrontLoading({stage=0}:{stage?:number}){
  return <div className="world-loading">
    <span role="status">Loading the interactive waterfront</span>
    <progress aria-label="Waterfront loading progress" max={8} value={stage||undefined}/>
  </div>;
}
