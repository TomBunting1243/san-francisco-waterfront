import {bayReliefPosition} from './bay-relief.ts';

// Appendix B identifies the freestanding public-service cabinets. Appendix A
// separately identifies the automatic toilets at Broadway/Pier 7 and Harrison.
// The scope follows The Embarcadero from the bridge to Pier 7 and lower Market
// from the ferry to Beale. IDs are physical cabinets, shared by their two ads.
// Other nearby licenses at California/Davis, Sacramento/Davis and Mission/Main
// have intersection-level coordinates only. The Folsom transit landing has a
// separate mapped column with no matching Appendix B ID. None is a model pin.
export const kioskLicenseSource='https://sfgov.legistar.com/View.ashx?GUID=00652937-F745-49DF-A219-FDB2336676A7&ID=7545140&M=F';
const inventory='https://www.arcgis.com/sharing/rest/content/items/f37939f040844f349b871275fe65737b/data';
const cityGPS='https://sfgov.legistar.com/View.ashx?GUID=88DE3E84-A105-4FF4-89C8-966E4475EEC0&ID=5429086&M=F';
// The approved design supersedes the original green street furniture by phases.
// Photographed example: https://hoodline.com/2015/12/zine-enthusiast-sells-quirky-tomes-at-grand-newsstand/
// Official siting map with georeferenced symbols, Attachment A:
// https://commissions.sfplanning.org/hpcpackets/2017-009220COAPTA.pdf
const vendorMap='https://www.sfartscommission.org/sites/default/files/maps/31.%20Market%20St%20%28Lottery%20Version%29.pdf';

type Site={
  id:string;name:string;latitude:number;longitude:number;footY:number;
  // Local +Z faces out through the first commercial panel. The other two
  // faces follow at 120 degree intervals. Bearings are curb-aligned estimates.
  yaw:number;kind:'column'|'vending';style?:'modern'|'historic';
  // Survey coordinates remain intact when the simplified curb needs a model offset.
  pavingOffset?:readonly [number,number];
  source:string;evidence:string;precision:'mapped object'|'sales pin'|'block face'|'city GPS';
};
function cabinet(site:Site){
  const [x,z]=bayReliefPosition(site.longitude,site.latitude);
  const [dx,dz]=site.pavingOffset??[0,0];
  return {...site,x:x+dx,z:z+dz};
}

export const waterfrontKioskSites=[
  cabinet({id:'SFO0002SF',name:'Ferry Building',latitude:37.7950349,longitude:-122.3937997,footY:.040644,yaw:1.55,kind:'column',style:'modern',
    source:'https://www.openstreetmap.org/node/12001925668',evidence:'Mapped object matches the SFO0002KD digital sales pin on the Embarcadero median.',precision:'mapped object'}),
  cabinet({id:'SFO0003SF',name:'Market at Steuart',latitude:37.7942592,longitude:-122.3952306,footY:.045,yaw:1.72,kind:'vending',style:'historic',
    source:vendorMap,evidence:'SFAC map 31 marks the kiosk on the Hyatt curb. The Grand Newsstand was photographed in this green cabinet in 2015. Pin reconstructed from frontage.',precision:'block face'}),
  cabinet({id:'SFO0004SF',name:'Market at Spear',latitude:37.7938031,longitude:-122.3955049,pavingOffset:[.026,.546],footY:.045,yaw:-1.42,kind:'vending',
    source:'https://www.openstreetmap.org/node/10822453728',evidence:'Mapped advertising column on the licensed 1 Market block face. Vending designation from the city inventory.',precision:'mapped object'}),
  cabinet({id:'SFO0005SF',name:'Drumm at Market',latitude:37.7936536,longitude:-122.3962588,pavingOffset:[-.052,.104],footY:.04535,yaw:1.72,kind:'column',style:'modern',
    source:'https://www.openstreetmap.org/way/1358500530',evidence:'Mapped kiosk footprint by the cable-car terminal agrees with the SFO0005KD digital sales pin.',precision:'mapped object'}),
  cabinet({id:'SFO0006SF',name:'Market at Main',latitude:37.7929552,longitude:-122.3966005,pavingOffset:[-.156,.130],footY:.045,yaw:-1.42,kind:'column',
    source:'https://www.openstreetmap.org/node/10869882887',evidence:'Mapped advertising column at licensed 245 Market, separately mapped from the adjacent flat billboard.',precision:'mapped object'}),
  cabinet({id:'SFO0007SF',name:'Market at Davis',latitude:37.79295,longitude:-122.39694,pavingOffset:[-.026,0],footY:.045,yaw:1.72,kind:'column',style:'historic',
    source:inventory,evidence:'The 234 Market address matches the paired SFO0207SF pillar faces in the media sales inventory. Round pillar form inferred from that format.',precision:'sales pin'}),
  cabinet({id:'SFO0008SF',name:'Market at Beale',latitude:37.792026,longitude:-122.397797,pavingOffset:[-.182,.078],footY:.045,yaw:-1.42,kind:'column',
    source:cityGPS,evidence:'City GPS record for 333 Market and matching Appendix B address. The current cabinet generation is unverified.',precision:'city GPS'}),
  cabinet({id:'SFO0079SF',name:'Spear at Mission',latitude:37.7924569,longitude:-122.3938618,pavingOffset:[.052,.078],footY:.045,yaw:.1,kind:'vending',
    source:'https://www.openstreetmap.org/node/12001976986',evidence:'Mapped column outside licensed 91 Spear, on the block face approaching Mission.',precision:'mapped object'}),
  cabinet({id:'SFO0110SF',name:'Embarcadero at Bryant',latitude:37.7876827,longitude:-122.3880621,footY:.045,yaw:1.7,kind:'column',
    source:'https://www.openstreetmap.org/node/10869899398',evidence:'Lit advertising column on licensed 494 Embarcadero frontage. The city symbol marks the intersection, about 65 m farther along the curb.',precision:'mapped object'}),
  cabinet({id:'SFO0111SF',name:'Embarcadero between Howard and Mission',latitude:37.7929308,longitude:-122.3918553,footY:.045,yaw:1.55,kind:'column',
    source:'https://www.openstreetmap.org/node/10869899355',evidence:'Mapped lit column on the 150 Embarcadero block specified in Appendix B, within 5 m of the city GeoPDF symbol.',precision:'mapped object'}),
  cabinet({id:'SFO0113SF',name:'Ferry Building north frontage',latitude:37.7954574,longitude:-122.3939531,pavingOffset:[.286,.884],footY:.04394,yaw:-1.55,kind:'vending',
    source:'https://www.openstreetmap.org/node/12001925665',evidence:'Separate Ferry frontage newsstand ID. Both city symbols share one address pin. This mapped lit column is nearest that pin (5 m); assigning the ID to the north object is approximate. The model requires a 15.5 m correction toward the forecourt to clear its street and steps.',precision:'mapped object'}),
];
