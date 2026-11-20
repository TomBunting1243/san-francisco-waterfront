import {openingCamera,openingLens,openingYaw} from './camera.ts';
import {ferryEntryX,ferryTowerZ} from './ferry-portico-access.ts';

export type WaterfrontShot='city-to-bridge'|'bridge-to-city';
type Point=[number,number,number];
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(t:number)=>t*t*(3-2*t);

export function waterfrontShotPose(shot:WaterfrontShot,progress:number,width:number,height:number){
  const t=Math.max(0,Math.min(1,progress)),turn=smooth(t);
  const cityFirst=shot==='city-to-bridge',portrait=height>width;
  const normal=openingLens(width,height);
  // The clock, colonnade and lantern stay together in the frame as the camera
  // rounds the stone corners. Only the pullback changes the focus of the orbit.
  const retreat=smooth(Math.max(0,(t-.575)/.425));
  let yaw=mix(cityFirst?-.36:3.25,cityFirst?openingYaw(width,height):.04,turn);
  if(!cityFirst&&t>.5){
    // Carry the clock orbit's midpoint bearing, speed and acceleration into
    // the pullback. Brake the rotation before revealing the skyline broadside.
    const midYaw=(3.25+.04)/2,midSpeed=(3.25-.04)*1.5,landingYaw=1.225;
    const brakeDuration=2*(midYaw-landingYaw)/midSpeed;
    const u=Math.min(1,(t-.5)/brakeDuration);
    yaw=landingYaw+(midYaw-landingYaw)*(1+u)*(1-u)**3;
  }
  const radius=mix(mix(2.82,3.35,turn),cityFirst?normal.distance:17.9,retreat);
  const centerX=mix(ferryEntryX,cityFirst?openingCamera.target[0]:-.7,retreat);
  const centerZ=mix(ferryTowerZ,cityFirst?openingCamera.target[2]:-.45,retreat);
  const targetY=mix(2.73,cityFirst?openingCamera.target[1]:3.30,retreat);
  const eyeY=mix(2.90+.42*turn,cityFirst?openingCamera.target[1]+normal.elevation:5.35,retreat);
  const eye:Point=[centerX+radius*Math.sin(yaw),eyeY,centerZ+radius*Math.cos(yaw)];
  const look:Point=[centerX,targetY,centerZ];
  const lastLens=cityFirst?normal.focalLength:portrait?16:17.3;
  const focalLength=mix(portrait?22:23.3,lastLens,retreat);
  const shiftX=mix(-.15,cityFirst?0:.045,retreat)*width;
  return {eye,look,focalLength,shiftX,shiftY:0};
}
