import {bridgePoint} from './bridge-layout';
export type Landmark = 'waterfront' | 'bridge' | 'pyramid';
export const landmarks = {
  waterfront: {label:'Ferry Building',position:[0,4.5,0]},
  bridge: {label:'Bay Bridge',position:[bridgePoint(0,36.85).x,9.5,bridgePoint(0,36.85).z]},
  pyramid: {label:'Transamerica Pyramid',position:[26.75,15,-40.4]},
} satisfies Record<Landmark,{label:string;position:number[]}>;
