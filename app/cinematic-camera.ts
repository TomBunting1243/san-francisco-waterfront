import {waterfrontShotPose,type WaterfrontShot} from './waterfront-shot.ts';

export function cinematicOrbit(shot:WaterfrontShot,t:number,width:number,height:number){
  // The review movies were photographed through a 1280x720 sensor. Fit that
  // rectangle into the viewport exactly; the live image fills its letterbox.
  const pose=waterfrontShotPose(shot,t,1280,720),scale=Math.min(width/1280,height/720);
  const focalLength=pose.focalLength*1280*scale/Math.max(width,height);
  const [x,y,z]=pose.eye,[tx,ty,tz]=pose.look;
  return {target:pose.look,yaw:Math.atan2(x-tx,z-tz),distance:Math.hypot(x-tx,z-tz),
    elevation:y-ty,focalLength,shiftX:pose.shiftX*scale,shiftY:pose.shiftY*scale};
}
