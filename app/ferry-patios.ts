import * as THREE from 'three';
import {StreetAssembly} from './street-amenities.ts';
import {harborDatum} from './water-surface.ts';

// The operator's Sept 2026 map runs from the north end (unit 5) to the south
// end (unit 37). Patio spans follow the tenant polygons, registered to the
// surveyed ends of the hall. Table spacing and furniture are representative.
// https://www.ferrybuildingmarketplace.com/map/
// https://www.arquetrestaurant.com/privateevents
// https://hogislandoysters.com/private-dining/private-dining-san-francisco/
// https://www.ferrybuildingmarketplace.com/shops/red-bay-coffee/
// https://www.gotts.com/location/sfferrybuilding/
const patios=[
  {name:'Arquet',xs:[4.40,4.61,4.82,5.03,5.24,5.45],zs:[1.75,2.047],chairs:4,wood:'#bba284',frame:'#7e7561'},
  {name:'Hog Island Oyster Co.',xs:[1.89,2.15,2.41,2.67,2.93],zs:[1.76],chairs:4,wood:'#ac9174',frame:'#69797a'},
  {name:'Red Bay Coffee',xs:[-4.13,-3.94,-3.75],zs:[1.755],chairs:2,wood:'#a88564',frame:'#525d55'},
  {name:"Gott's Roadside",xs:[5.34,5.57,5.80],zs:[-1.84,-2.014],chairs:0,wood:'#ad8564',frame:'#677772'},
] as const;

function diningSet(spec:typeof patios[number]){
  const p=new StreetAssembly(),{wood,frame,chairs}=spec;
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>p.box(x,y,z,w,h,d,color);
  if(!chairs){
    // Gott's describes communal seating on the city-view open-air patio.
    box(0,.044,0,.141,.005,.048,wood);
    for(const side of [-1,1]){
      box(0,.027,side*.048,.140,.004,.022,wood);
      box(side*.048,.021,0,.009,.042,.026,frame);
      box(side*.048,.022,0,.009,.006,.103,frame);
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
      const table=prototype.clone();table.position.set(x,z>0?harborDatum.ferryApron:.031,z);
      root.add(table);
    }
  }
  return root;
}
