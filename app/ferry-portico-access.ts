// World coordinates on the mapped Market Street axis. A 1.20 m level change
// is divided into seven 17.1 cm rises within the existing entrance footprint.
export const ferryEntryX=-.1185,ferryPorticoZ=-1.748,ferryHallFloor=.103;
export const ferryTreads=Array.from({length:7},(_,i)=>({
  z:ferryPorticoZ-.030-i*.031,top:ferryHallFloor-i*(ferryHallFloor-.031)/7,
  depth:.036,extraWidth:i*.026,
}));

/** Finished floor on the central public entry axis, including either door leaf. */
export function ferryPorticoGround(z:number){
  for(const tread of ferryTreads)if(z>=tread.z-tread.depth/2)return tread.top;
  return .031;
}
