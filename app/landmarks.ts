import {bridgePoint} from './bridge-layout';
export type Landmark = 'waterfront' | 'bridge' | 'pyramid';
const tower=bridgePoint(0,36.85);

/** Aim at the middle of the visible structure, leaving space above its roof. */
export const landmarks = {
  waterfront: {label:'Ferry Building',position:[0,2.5,0],zoom:1.35},
  bridge: {label:'Bay Bridge',position:[tower.x,5.2,tower.z],zoom:1.05},
  pyramid: {label:'Transamerica Pyramid',position:[27,7.7,-41],zoom:.87},
} satisfies Record<Landmark,{label:string;position:[number,number,number];zoom:number}>;
