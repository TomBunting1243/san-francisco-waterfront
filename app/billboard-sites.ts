// World positions use the Ferry Building survey axes. The frontage disappeared
// during redevelopment: archival pins below are block-face reconstructions,
// with supports fitted to today's modeled roof or street edge.
import {bayReliefPosition} from './bay-relief.ts';
import {approachGround} from './approach-road.ts';

const foot=.3048*.06;
export type BillboardSite={
  name:string;x:number;z:number;y:number;footY:number;yaw:number;width:number;height:number;
  mounting:'rack'|'wall'|'poster'; corridor:'I-80'|'Embarcadero'; source:string;
  evidence:'documented address'|'operator sheet'|'archival approximation';
  latitude?:number;longitude?:number; bearingSpread?:number;
};
function roadside(name:string,latitude:number,longitude:number,facing:number,width:number,height:number,aboveGrade:number,
  roof:number,source:string,evidence:BillboardSite['evidence']):BillboardSite{
  const [x,z]=bayReliefPosition(longitude,latitude),grade=approachGround(x,z);
  return {name,latitude,longitude,x,z,y:grade+aboveGrade,footY:grade+roof,yaw:Math.atan2(.04836012986,.03552029735)-facing*Math.PI/180,
    width:width*foot,height:height*foot,mounting:'rack',corridor:'I-80',source,evidence};
}
function archived(name:string,photo:string,x:number,z:number,y:number,footY:number,yaw:number,width:number,height:number,mounting:BillboardSite['mounting']):BillboardSite{
  return {name,x,z,y,footY,yaw,width,height,mounting,corridor:'Embarcadero',evidence:'archival approximation',source:'https://www.opensfhistory.org/Display/'+photo+'.jpg'};
}
export const billboardSites:BillboardSite[]=[
  roadside('451 Sixth Street',37.7767809,-122.4032385,201,65,20,1.71,.23,'https://commons.wikimedia.org/wiki/File:Yahoo!_Vacancy.jpg','documented address'),
  roadside('701 Bryant Street',37.777545,-122.400403,212,70,30,97*foot,.77,'https://investors.coca-colacompany.com/news-events/press-releases/detail/512/coca-cola-lights-refurbished-landmark-sign-at-historic-south-of-market-san-francisco-location','documented address'),
  roadside('Fourth Street I-80 bulletin',37.7795941,-122.400674,200,68+2/12,25,2.17,.63,'https://cco.my.salesforce-sites.com/slickspdf?ids=169804&specsheet=0','operator sheet'),
  roadside('Bryant and Seventh Street bulletin',37.774504,-122.404293,270,48,14,.855,.57,'https://brandedcities.com/wp-assets/photosheets/sf/sf_bryantst_ps.pdf','operator sheet'),
  // The views from Howard and Folsom show the same hotel and rooftop rack.
  archived('Howard · Seaboard Hotel roof','wnp14.2626',-26.63,-7.35,4.43,4.0,1.34,1.24,.43,'rack'),
  archived('Howard · Seaboard Hotel upper wall','wnp14.2626',-25.57,-7.30,1.61,0,1.73,.58,.46,'wall'),
  archived('Howard · Seaboard lot frontage north','wnp14.2626',-25.68,-6.65,.20,0,.16,.45,.18,'poster'),
  archived('Howard · Seaboard lot frontage south','wnp14.2626',-26.20,-6.56,.20,0,.16,.45,.18,'poster'),
  archived('Mission at Steuart · parking lot bulletin','wnp14.2310',-11.96,-7.39,.28,.01,.14,.57,.23,'poster'),
  // At Market the Sunkist/Lucky Strike face and neighboring smaller board
  // occupy separate racks. They recur in multiple years of Ferry Loop photos.
  // The hotel terrace and adjacent vent deck have different elevations. Inset the feet
  // between the terrace railings and carry the lower edge above the adjoining planter and rail.
  {...archived('Market · Ferry Loop long roof face','wnp14.12866',-8.90,-7.04,1.32,.8502,.145,.99,.33,'rack'),bearingSpread:.30},
  archived('Market · Ferry Loop neighboring face','wnp14.12866',-8.65,-5.55,.53,.329,.145,.48,.21,'rack'),
  archived('Clay · Harbor Garage roof rack','wnp27.50187',8.83,-10.60,.64,.137,.91,.70,.31,'rack'),
];
