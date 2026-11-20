import * as THREE from 'three';
import {StreetAssembly} from './street-amenities.ts';
import {taylorPicnic} from './taylors-refresher.ts';
import {ferryHallFloor} from './ferry-portico-access.ts';
import {harborDatum} from './water-surface.ts';

// The operator's Sept 2026 map runs from the north end (unit 5) to the south
// end (unit 37). Patio spans follow the tenant polygons, registered to the
// surveyed ends of the hall. Table spacing and furniture are representative.
// https://www.ferrybuildingmarketplace.com/map/
// The northeast corner depicts the 2004 Slanted Door in its historic footprint.
// https://lundbergdesign.com/project/the-slanted-door/
// https://hogislandoysters.com/private-dining/private-dining-san-francisco/
// https://www.ferrybuildingmarketplace.com/shops/red-bay-coffee/
// https://www.niallkennedy.com/blog/2006/08/wordcamp-kickoff-party.html
const patios=[
  {name:'The Slanted Door',xs:[4.64,4.84,5.04,5.24,5.44,5.64],zs:[1.549],chairs:4,wood:'#ad8762',frame:'#606865'},
  {name:'Hog Island Oyster Co.',xs:[1.89,2.15,2.41,2.67,2.93],zs:[1.76],chairs:4,wood:'#ac9174',frame:'#69797a'},
  {name:'Red Bay Coffee',xs:[-4.13,-3.94,-3.75],zs:[1.755],chairs:2,wood:'#a88564',frame:'#525d55'},
  {name:taylorPicnic.name,xs:taylorPicnic.xs,zs:taylorPicnic.zs,chairs:0,wood:'#ad8564',frame:'#677772'},
] as const;

function diningSet(spec:typeof patios[number]){
  const p=new StreetAssembly(),{wood,frame,chairs}=spec;
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>p.box(x,y,z,w,h,d,color);
  if(!chairs){
    // Kennedy's 2006 dinner met on the city-side patio.
    for(const z of [-.0152,0,.0152])box(0,.044,z,.126,.004,.0143,wood);
    for(const side of [-1,1]){
      box(0,.026,side*taylorPicnic.seatOffset,.126,.004,.018,wood);
      for(const z of [-.025,.025])box(side*.042,.021,z,.005,.042,.005,frame);
      box(side*.042,.022,0,.006,.004,.092,frame);
    }
  }else{
    const cafe=chairs===2;
    if(cafe)p.add(new THREE.CylinderGeometry(.028,.028,.004,10),wood,0,.044,0);
    else box(0,.044,0,.058,.004,.054,wood);
    box(0,.021,0,.010,.042,.010,frame);
    box(0,.002,0,.033,.004,.031,frame);
    for(let i=0;i<chairs;i++){
      const along=i<2,sign=i%2===0?-1:1,dx=along?sign:0,dz=along?0:sign;
      const x=dx*.049,z=dz*.047;
      if(spec.name==='The Slanted Door'&&!along){
        // Lundberg fabricated outdoor log benches. These paired short seats
        // retain the mapped dining aisle; their spacing is reconstructed.
        box(x,.021,z,.064,.018,.021,wood);
        for(const end of [-1,1])box(x+end*.021,.007,z,.009,.014,.014,frame);
        continue;
      }
      box(x,.027,z,.026,.003,.026,wood);
      box(x+dx*.012,.042,z+dz*.012,along?.003:.027,.017,along?.027:.003,frame);
      // Open-sided chair frames keep the ground visible underneath each seat.
      for(const k of [-1,1])box(x+k*(along?0:.010),.013,z+k*(along?.010:0),
        along?.020:.003,.026,along?.003:.020,frame);
    }
  }
  return p.bake(spec.name+' outdoor table');
}

export function ferryPatios(){
  const root=new THREE.Group();root.name='Ferry Building outdoor dining';
  for(const patio of patios){
    const prototype=diningSet(patio);
    for(const x of patio.xs)for(const z of patio.zs){
      const table=prototype.clone();
      const tucked=patio.name==='The Slanted Door';
      if(tucked)table.scale.set(.84,1,.84);
      table.position.set(x,tucked?ferryHallFloor:z>0?harborDatum.ferryApron:taylorPicnic.ground,z);
      root.add(table);
    }
  }
  return root;
}
