import {openingCamera,openingLens,openingYaw} from './camera.ts';
import {ferryEntryX,ferryTowerZ} from './ferry-portico-access.ts';

export type WaterfrontShot='city-to-bridge'|'bridge-to-city';
export const openingSeconds=8;
type Point=[number,number,number];
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(t:number)=>t*t*(3-2*t);

export function waterfrontShotPose(shot:WaterfrontShot,progress:number,width:number,height:number){
  const t=Math.max(0,Math.min(1,progress));
  const cityFirst=shot==='city-to-bridge',portrait=height>width;
  const normal=openingLens(width,height);
  // Enter the turn already moving and ease the bearing to rest on the landing.
  const turn=1-(1-t)**2*(1+.7*t);
  const yaw=mix(cityFirst?-.36:3.25,cityFirst?openingYaw(width,height):1.225,turn);
  // A small immediate retreat keeps the clock large on entry. The squared
  // time moves most of the pullback into the second half of the same orbit.
  const retreat=.10*t*(2-t)+.90*smooth(t*t);
  const radius=mix(mix(2.82,3.35,turn),cityFirst?normal.distance:portrait?14.6:17.9,retreat);
  const centerX=mix(ferryEntryX,cityFirst?openingCamera.target[0]:-.7,retreat);
  const centerZ=mix(ferryTowerZ,cityFirst?openingCamera.target[2]:-.45,retreat);
  const targetY=mix(2.73,cityFirst?openingCamera.target[1]:3.30,retreat);
  const eyeY=mix(2.90+.42*turn,cityFirst?openingCamera.target[1]+normal.elevation:portrait?4.85:5.35,retreat);
  const eye:Point=[centerX+radius*Math.sin(yaw),eyeY,centerZ+radius*Math.cos(yaw)];
  const look:Point=[centerX,targetY,centerZ];
  const firstLens=portrait?26:23.3,lastLens=cityFirst?normal.focalLength:portrait?14.5:17.3;
  const lensTurn=.24*t*(2-t)+.76*smooth(t);
  const focalLength=Math.exp(mix(Math.log(firstLens),Math.log(lastLens),lensTurn));
  const shiftX=mix(portrait?-.075:-.15,cityFirst?0:portrait?.005:.045,retreat)*width;
  return {eye,look,focalLength,shiftX,shiftY:0};
}
