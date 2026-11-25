import {pavementCutter} from './pavement-openings.ts';
import type {MedianBed} from './median-bed-surface.ts';

// Public Works tree ID, rendered stem ID, registered centre, row bearing,
// half opening width and the surveyed sidewalk polygon that receives the cut.
// Four openings span a battered curb and are clipped against both finishes.
const sites=[
  [194320, 13605369997, -11.3669, -2.6432, -0.087, 0.04, '-11.606,-2.584'],
  [194321, 13605369996, -10.4018, -2.714, -0.08, 0.048, 'curb'],
  [194322, 13605369995, -9.6142, -2.78, -0.045, 0.048, 'curb'],
  [194323, 13605369994, -8.7898, -2.8334, -0.033, 0.04, '-11.606,-2.584'],
  [194324, 13605369993, -8.0008, -2.9095, -0.046, 0.054, '-11.606,-2.584'],
  [25668, 12793548839, 7.4362, -4.2608, 0.037, 0.062, '6.827,-3.892'],
  [26030, 12793548838, 8.2348, -4.231, -0.007, 0.062, '6.827,-3.892'],
  [26031, 12793548837, 9.0694, -4.2408, -0.006, 0.062, '6.827,-3.892'],
  [25671, 12793548836, 9.7754, -4.2162, 0.049, 0.062, '6.827,-3.892'],
  [25672, 12793548835, 10.637, -4.1715, 0.053, 0.062, '6.827,-3.892'],
  [25782, 12793548823, 14.5839, -3.1026, -0.04, 0.062, '13.797,-2.995'],
  [25783, 12793548822, 16.3343, -3.2526, 0.003, 0.062, '13.797,-2.995'],
  [25734, 12793548825, 17.7008, -3.1723, 0.047, 0.062, '13.797,-2.995'],
  [27937, 12793548827, 19.4587, -3.1058, 0.024, 0.062, '13.797,-2.995'],
  [27939, 12793548829, 21.3414, -3.0851, 0.016, 0.062, '13.797,-2.995'],
  [132130, 12793548833, 24.1047, -3.0333, 0.019, 0.062, '24.6,-2.939'],
  [25784, 12793548824, 17.705, -3.8437, 0.047, 0.062, '16.709,-3.722'],
  [25735, 12793548826, 19.5154, -3.7824, 0.035, 0.046, '16.709,-3.722'],
  [27938, 12793548828, 21.4049, -3.78, 0.009, 0.059, 'curb'],
  [132129, 12793548834, 24.1523, -3.706, 0.003, 0.048, 'curb'],
  [132131, 12793548830, 25.8966, -3.6295, 0.024, 0.054, '31.895,-3.398'],
  [132132, 12793548831, 27.581, -3.6126, 0.03, 0.062, '31.895,-3.398'],
  [132133, 12793548832, 29.2533, -3.5842, 0.022, 0.062, '31.895,-3.398'],
  [132070, 13605228880, 36.3979, -3.4302, -0.024, 0.062, '45.532,-3.015'],
  [132071, 13605228879, 37.4945, -3.4725, 0.015, 0.062, '45.532,-3.015'],
  [132072, 13605228876, 39.2748, -3.3386, 0.042, 0.062, '45.532,-3.015'],
  [132073, 13605228875, 41.0883, -3.2975, 0.035, 0.062, '45.532,-3.015'],
  [132074, 132074, 42.9522, -3.2593, 0.025, 0.062, '45.532,-3.015'],
  [132113, 13605228881, 36.3548, -2.7524, 0.053, 0.062, '43.463,-2.516'],
  [132114, 13605228878, 37.44, -2.6953, 0.034, 0.062, '43.463,-2.516'],
  [132115, 13605228877, 39.2421, -2.6553, 0.033, 0.062, '43.463,-2.516'],
  [132116, 13605228873, 41.0811, -2.5751, 0.036, 0.062, '43.463,-2.516'],
  [132117, 13605228874, 42.9559, -2.521, 0.029, 0.062, '43.463,-2.516'],
] as const;
export const medianPalmBeds=new Map<number,MedianBed & {siteId:number}>();
export const palmBedHoles=new Map<string,number[][][]>();
export const curbPalmBeds:(MedianBed & {outline:number[][]})[]=[];
for(const [siteId,stem,x,z,angle,halfWidth,slab] of sites){
  const halfLength=.07,grade=x>35?.068:.045,raised=siteId===132117;
  const bed={siteId,x,z,angle,halfWidth,halfLength,grade,raised};
  medianPalmBeds.set(stem,bed);
  const cs=Math.cos(angle),sn=Math.sin(angle);
  const outline=[[-halfLength,-halfWidth],[halfLength,-halfWidth],[halfLength,halfWidth],[-halfLength,halfWidth]]
    .map(([u,v])=>[x+cs*u-sn*v,z+sn*u+cs*v]);
  if(slab==='curb'){
    curbPalmBeds.push({...bed,outline});
  }else{
    const holes=palmBedHoles.get(slab)??[];
    holes.push(outline);palmBedHoles.set(slab,holes);
  }
}
export function openMedianSidewalk(plan:number[][][]){
  const holes=palmBedHoles.get(plan[0][0].join(','));
  return holes?[...plan,...holes]:plan;
}

export const cutCurbPalmBed=pavementCutter(curbPalmBeds.map(({outline})=>{
  const xs=outline.map(p=>p[0]),zs=outline.map(p=>p[1]);
  return {outline,xmin:Math.min(...xs),xmax:Math.max(...xs),zmin:Math.min(...zs),zmax:Math.max(...zs)};
}));
