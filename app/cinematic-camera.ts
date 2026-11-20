import {waterfrontShotPose,type WaterfrontShot} from './waterfront-shot.ts';

export function cinematicOrbit(shot:WaterfrontShot,t:number,width:number,height:number){
  // Match the film's CSS cover crop. Weight spare height toward the dial,
  // which sits below the lantern in the lower part of the opening frame.
  const portrait=height>=width;
  const sensorWidth=portrait?720:1280,sensorHeight=portrait?1280:720;
  const pose=waterfrontShotPose(shot,t,sensorWidth,sensorHeight);
  const scale=Math.max(width/sensorWidth,height/sensorHeight);
  const cropShiftY=(.5-(portrait?.66:.86))*Math.max(0,sensorHeight*scale-height);
  const focalLength=pose.focalLength*1280*scale/Math.max(width,height);
  const [x,y,z]=pose.eye,[tx,ty,tz]=pose.look;
  return {target:pose.look,yaw:Math.atan2(x-tx,z-tz),distance:Math.hypot(x-tx,z-tz),
    elevation:y-ty,focalLength,shiftX:pose.shiftX*scale,shiftY:pose.shiftY*scale+cropShiftY};
}
