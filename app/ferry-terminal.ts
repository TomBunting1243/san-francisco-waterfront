import * as THREE from 'three';
import {doradoBoardingFreeboard} from './dorado-ferry.ts';
import {berthThresholds} from './ferry-service.ts';
import {center,footprintGeometry,sfMap} from './sf-map.ts';
import {harborDatum,waterSurface} from './water-surface.ts';

type PlanPoint=[x:number,z:number];
type TerminalMesh=(shape:THREE.BufferGeometry,color:string,x:number,y:number,z:number,parent:THREE.Group)=>THREE.Mesh;
type Gate='B'|'C'|'D'|'E'|'F'|'G';
export type FerryConnection={
  gate:Gate;
  from:PlanPoint;
  to:PlanPoint;
  landY:number;
  deckY:number;
  width:number;
  covered:boolean;
};
const apronY=harborDatum.ferryApron, floatY=waterSurface.level+harborDatum.ferryFloatFreeboard;
// OpenStreetMap 780026874, 740435234, 740435237 and 780026870–72.
// C and D board on separate spurs from the outer edge of the same apron.
export const ferryConnections:FerryConnection[]=[
  {gate:'B',from:[6.208,2.691],to:[6.22,4.505],landY:apronY,deckY:floatY,width:.244,covered:true},
  {gate:'C',from:[-1.575,4.751],to:[-1.476,4.797],landY:apronY,deckY:.084,width:.123,covered:false},
  {gate:'D',from:[-1.965,8.147],to:[-1.833,8.312],landY:apronY,deckY:.077,width:.13,covered:false},
  {gate:'E',from:[-8.202,3.007],to:[-8.194,5.103],landY:apronY,deckY:floatY,width:.269,covered:true},
  {gate:'F',from:[-11.205,2.969],to:[-11.202,5.051],landY:apronY,deckY:floatY,width:.269,covered:true},
  {gate:'G',from:[-14.217,2.95],to:[-14.216,5.066],landY:apronY,deckY:floatY,width:.269,covered:true},
];
const cream='#dddac3', steel='#869b99', blueSteel='#638395', gray='#a5aaa0', fender='#455e60', yellow='#cbb775';
export const boardingStops:Record<Gate,PlanPoint>={
  B:[5.843,6.462], C:[.061,5.436], D:[-.831,9.348],
  E:[-7.819,7.08], F:[-10.811,7.135], G:[-13.831,7.137],
};
// The short telescoping brow retracts inside the pontoon threshold before
// a vessel backs away. One instance per operating berth shares the same draw.
export function createBoardingBrows(count:number){
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#b4b8ab',roughness:.83}),count);
  mesh.name='Telescoping ferry boarding brows';mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const part=new THREE.Object3D();
  function update(i:number,pose:{gate:Gate;x:number;y:number;brow:number;stopX?:number;stopZ?:number;hullHalfBeam?:number;boardingFreeboard?:number}){
    const [fallbackX,fallbackZ]=boardingStops[pose.gate];
    const x=pose.stopX??fallbackX,z=pose.stopZ??fallbackZ,side=Math.sign(pose.x-x);
    const sill=pose.boardingFreeboard??doradoBoardingFreeboard;
    if(pose.brow<=0){
      part.position.set(x,waterSurface.level,z);part.scale.set(0,0,0);
    }else{
      const shore=pose.gate==='C'?.084+.0495:waterSurface.level+sill;
      const start=x+side*(pose.gate==='C'?.026:.020),end=pose.x-side*((pose.hullHalfBeam??.315)-.007);
      const rise=(pose.y+sill-shore)*pose.brow,run=(end-start)*pose.brow;
      part.position.set(start+run/2,shore-.004+rise/2,z);
      part.rotation.z=Math.atan2(rise,run);
      part.scale.set(Math.hypot(run,rise),.008,.091);
    }
    part.updateMatrix();mesh.setMatrixAt(i,part.matrix);mesh.instanceMatrix.needsUpdate=true;
  }
  return {mesh,update};
}
function pointInPolygon(x:number,z:number,polygon:number[][]){
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [a,b]=polygon[i],[c,d]=polygon[j];
    if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)inside=!inside;
  }
  return inside;
}

// The exact wharf polygon also contains the short landing necks for Gates B and E–G.
export const fixedFerryApron=sfMap.piers.find(pier=>!pier.name&&pointInPolygon(-3.7,6.2,pier.p))!;
export function buildFerryTerminal(mesh:TerminalMesh,root:THREE.Group){
  const terminal=new THREE.Group();
  terminal.name='Ferry terminal boarding decks';root.add(terminal);
  const boxGeometry=new THREE.BoxGeometry(1,1,1);
  const cylinders=new THREE.CylinderGeometry(1,1,1,8);
  function box(w:number,h:number,d:number,x:number,y:number,z:number,color:string,parent:THREE.Group){
    const m=mesh(boxGeometry,color,x,y,z,parent);m.scale.set(w,h,d);return m;
  }
  function cylinder(radius:number,h:number,x:number,y:number,z:number,color:string,parent:THREE.Group) {
    const m=mesh(cylinders,color,x,y,z,parent);m.scale.set(radius,h,radius);return m;
  }
  function link(a:THREE.Vector3,b:THREE.Vector3,tube:number,color:string,parent:THREE.Group,width=tube){
    const delta=b.clone().sub(a),m=box(width,tube,delta.length(),(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,color,parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),delta.normalize());
    return m;
  }
  function roof(cx:number,span:number,from:number,to:number,eave:number,rise:number,parent:THREE.Group){
    const sections=8;
    for(let i=0;i<sections;i++){
      const q=Math.PI*(i/sections),r=Math.PI*((i+1)/sections);
      const ax=cx-Math.cos(q)*span/2,bx=cx-Math.cos(r)*span/2;
      const ay=eave+Math.sin(q)*rise,by=eave+Math.sin(r)*rise;
      const roofPanel=box(Math.hypot(bx-ax,by-ay)+.002,.014,to-from,(ax+bx)/2,(ay+by)/2,(from+to)/2,i%3===1?'#e7e3cd':cream,parent);
      roofPanel.rotation.z=Math.atan2(by-ay,bx-ax);
    }
    for(let j=0;j<=Math.round((to-from)/.34);j++){
      const z=THREE.MathUtils.lerp(from,to,j/Math.round((to-from)/.34));
      for(let i=1;i<=sections;i++){
        const a=Math.PI*(i-1)/sections,b=Math.PI*i/sections;
        link(new THREE.Vector3(cx-Math.cos(a)*span/2,eave+Math.sin(a)*rise-.015,z),
          new THREE.Vector3(cx-Math.cos(b)*span/2,eave+Math.sin(b)*rise-.015,z),.008,steel,parent);
      }
    }
  }
  for(const connection of ferryConnections){
    const {gate,from,to,landY,deckY,covered,width}=connection;
    const plate=sfMap.piers.find(pier=>pier.name==='Ferry Building Gate '+gate)!;
    const landing=new THREE.Group();
    landing.name=covered?`Gate ${gate} floating pontoon`:`Gate ${gate} hydraulic landing`;
    terminal.add(landing);
    const [cx,cz]=center(plate.p.slice(0,-1)), depth=covered?.035:harborDatum.pierSlabThickness;
    const hullTint=covered?'#607679':'#677b7d';
    // A steel buoyancy box reaches below the water only where the pier is floating.
    // The Golden Gate berths use short hydraulically adjusted platforms.
    const hullOutline=plate.p.map(([x,z])=>[cx+(x-cx)*.908,cz+(z-cz)*.986]);
    if(covered){
      const keel=waterSurface.level-.12;
      mesh(footprintGeometry(hullOutline,deckY-depth+.018-keel),hullTint,0,keel,0,landing).name='Floating steel hull';
    }
    mesh(footprintGeometry(plate.p,depth),covered?'#aaa99b':'#a5aba0',0,deckY-depth,0,landing).name='Boarding deck';
    const start=new THREE.Vector3(from[0],landY,from[1]),end=new THREE.Vector3(to[0],deckY,to[1]);
    const [stopX,stopZ]=boardingStops[gate];
    const gangway=new THREE.Group();
    gangway.name=covered?`Gate ${gate} articulated gangway`:`Gate ${gate} short boarding link`;
    gangway.position.copy(start);
    terminal.add(gangway);
    const delta=end.clone().sub(start),length=delta.length();
    gangway.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),delta.normalize());
    box(width,.032,length+.012,0,-.016,length/2,'#aab5ac',gangway).name='Gangway walking surface';
    for(const side of [-1,1]){
      const x=side*(width/2-.007);
      const upright=covered?.223:.063;
      const steps=Math.max(1,Math.round(length/(covered?.164:.071)));
      box(.019,.046,length,x,-.023,length/2,covered?steel:blueSteel,gangway);
      box(.011,.010,length,x,.064,length/2,covered?steel:blueSteel,gangway);
      if(covered)box(.012,.012,length,x,upright,length/2,steel,gangway);
      for(let j=0;j<=steps;j++){
        const z=length*j/steps;
        box(.01,upright,.01,x,upright/2,z,covered?steel:blueSteel,gangway);
        if(covered&&j<steps)link(new THREE.Vector3(x,.028,z),new THREE.Vector3(x,upright,z+length/steps),.009,cream,gangway);
      }
    }
    for(let at=.035;at<length-.015;at+=.072)box(width-.026,.004,.007,0,.003,at,'#919e96',gangway);
    box(width*.92,.008,.027,0,.004,.015,yellow,gangway);
    if(covered){
      roof(0,width*1.07,.023,length-.024,.226,.036,gangway);
      const shoreZ=Math.min(...plate.p.map(p=>p[1])),tip=Math.max(...plate.p.map(p=>p[1]));
      roof(cx,.51,shoreZ+.083,tip-.17,deckY+.234,.073,landing);
      for(const side of [-1,1]){
        for(let z=shoreZ+.14;z<tip-.15;z+=.34){
          cylinder(.015,.236,cx+side*.235,deckY+.118,z,cream,landing);
        }
        // Steel bearing guides are separate from the float and dark rubber fenders
        // lie below the edge, clear of the deck and passenger path.
        for(const z of [shoreZ+.08,tip-.067]){
          cylinder(.053,1.07,cx+side*.454,deckY-.405,z,fender,landing).name='Independent guide pile';
          cylinder(.055,.019,cx+side*.454,deckY+.133,z,gray,landing);
        }
        for(let z=shoreZ+.15;z<tip-.075;z+=.22){
          box(.048,.169,.102,cx+side*.409,deckY-.134,z,fender,landing);
          box(.054,.032,.109,cx+side*.410,deckY-.058,z,'#546a66',landing);
        }
      }
      // The flat float sits below the high-freeboard ferries. A longitudinal
      // boarding ramp rises to a short transverse brow at the service opening.
      const thresholds=[{x:stopX,z:stopZ,freeboard:doradoBoardingFreeboard}];
      if(gate==='E'||gate==='F'){
        const [x,z]=berthThresholds[gate==='E'?'E2':'F2'];
        thresholds.push({x,z,freeboard:doradoBoardingFreeboard});
      }
      if(gate==='B')thresholds.push({x:6.617,z:6.456,freeboard:.084});
      for(const {x:stopX,z:stopZ,freeboard} of thresholds){
        const side=Math.sign(stopX-cx), rampX=stopX-side*.091;
        const sill=waterSurface.level+freeboard;
        const rampStart=new THREE.Vector3(rampX,deckY-.006,stopZ-1.79);
        const rampEnd=new THREE.Vector3(rampX,sill-.006,stopZ);
        link(rampStart,rampEnd,.012,'#aab4ad',landing,.123).name='Adjustable vessel boarding ramp';
        for(const offset of [-.057,.057]){
          const rail=new THREE.Vector3(offset,.065,0);
          link(rampStart.clone().add(rail),rampEnd.clone().add(rail),.007,steel,landing);
          for(let i=0;i<=5;i++){
            const at=rampStart.clone().lerp(rampEnd,i/5);
            box(.008,.065,.008,at.x+offset,at.y+.0325,at.z,steel,landing);
          }
        }
        box(.177,.012,.126,stopX-side*.065,sill-.006,stopZ,'#b4b8ab',landing).name='Vessel boarding threshold';
        box(.022,.003,.127,stopX+side*.012,sill+.0015,stopZ,yellow,landing);
      }
    }else{
      for(const [x,z] of [to,[stopX-.15,stopZ]]){
        const cap=deckY-depth, toe=waterSurface.level-.32;
        cylinder(.031,cap-toe,x,(cap+toe)/2,z,'#778681',landing).name='Golden Gate hydraulic support';
        box(.108,.053,.123,x,cap-.012,z,'#8c9a92',landing);
      }
      const stopSign=stopX>cx?1:-1;
      for(let i=0;i<5;i++){
        const z=stopZ+(i-2)*.077,x=stopX+.043*stopSign;
        cylinder(.024,deckY+.03-(waterSurface.level-.21),x,(deckY+.03+waterSurface.level-.21)/2,z,'#605e4e',landing);
        box(.036,.14,.048,x+.017*stopSign,deckY-.043,z,fender,landing);
      }
      box(.053,.056,.395,stopX+.042*stopSign,waterSurface.level+.012,stopZ,'#6b7e79',landing);
      box(.086,.063,.395,stopX+.026*stopSign,deckY+.018,stopZ,'#7e887a',landing);
      box(.091,.009,.13,stopX-stopSign*.069,deckY+.004,stopZ,yellow,landing);
    }
    // Keep the handrail outside the two threshold passages and out of the cutouts
    // at each transverse walkway used to board either side of the float.
    const boundary=plate.p;
    for(let i=1;i<boundary.length;i++){
      const [ax,az]=boundary[i-1],[bx,bz]=boundary[i],w=Math.hypot(bx-ax,bz-az);
      if(w<.089)continue;
      const count=Math.max(1,Math.ceil(w/.122));
      for(let j=0;j<count;j++){
        const t=(j+.5)/count,x=THREE.MathUtils.lerp(ax,bx,t),z=THREE.MathUtils.lerp(az,bz,t);
        const threshold=Math.hypot(x-to[0],z-to[1])<width*.61;
        const dual=gate==='B'||gate==='E'||gate==='F';
        const berth=Math.hypot(x-stopX,z-stopZ)<.165||(dual&&Math.abs(z-stopZ)<.16&&Math.abs(x-cx)>.30);
        const sideLoading=covered&&Math.abs(x-cx)>.31&&[6.19,6.43,7.1].some(shipZ=>Math.abs(z-(gate==='B'?shipZ-.61:shipZ))<.085);
        if(threshold||berth||sideLoading)continue;
        const a=new THREE.Vector3(THREE.MathUtils.lerp(ax,bx,j/count),deckY+.065,THREE.MathUtils.lerp(az,bz,j/count));
        const b=new THREE.Vector3(THREE.MathUtils.lerp(ax,bx,(j+1)/count),deckY+.065,THREE.MathUtils.lerp(az,bz,(j+1)/count));
        link(a,b,.008,covered?steel:blueSteel,landing);
        box(.009,.066,.009,a.x,deckY+.033,a.z,steel,landing);
      }
    }
  }
  const boundary=fixedFerryApron.p, underside=apronY-harborDatum.pierSlabThickness;
  mesh(footprintGeometry(boundary,harborDatum.pierSlabThickness),'#b9b8a6',0,underside,0,terminal).name='Surveyed fixed ferry apron';
  const support=new THREE.Group();support.name='Fixed ferry apron piles';terminal.add(support);
  const guard=new THREE.Group();guard.name='Fixed ferry apron edge guard';terminal.add(guard);
  const tip=waterSurface.level-.32;
  const snapped=new Map<string,PlanPoint>();
  function pile(x:number,z:number){
    if(!pointInPolygon(x,z,boundary)||z<-.14)return;
    const key=Math.round(x/.14)+','+Math.round(z/.14);
    if(snapped.has(key))return;
    snapped.set(key,[x,z]);
    const top=underside-.008;
    cylinder(.043,top-tip,x,(top+tip)/2,z,'#8b9a90',support).name='Continuous fixed concrete pile';
    box(.146,.071,.138,x,underside-.022,z,'#a4a99c',support).name='Pile-to-deck cap';
    cylinder(.047,.306,x,waterSurface.level-.112,z,'#6b7d74',support).name='Splash-zone pile collar';
  }
  // Photograph the exposed bents as repeated rows. Keep the darker pile bases
  // below the minimum animated water level, including at the shallow berth heads.
  for(let z=.35;z<10.4;z+=.59){
    for(let x=-14.46;x<6.44;x+=.78)pile(x,z);
  }
  const orient=Math.sign(boundary.reduce((s,[x,z],i)=>{
    const [a,b]=boundary[(i+1)%boundary.length];return s+x*b-z*a;
  },0));
  for(let i=1;i<boundary.length;i++){
    const a=boundary[i-1],b=boundary[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<.035||Math.max(a[1],b[1])<1.57)continue;
    const nx=-orient*dz/length,nz=orient*dx/length;
    const at=(t:number,y:number,offset=0)=>new THREE.Vector3(a[0]+dx*t+nx*offset,y,a[1]+dz*t+nz*offset);
    link(at(0,underside+.031,.011),at(1,underside+.031,.011),.056,'#a1aa9e',support,.057).name='Fixed apron recessed edge beam';
    link(at(0,apronY-.009),at(1,apronY-.009),.019,'#c9c2ad',support,.027);
    const intervals=Math.max(1,Math.ceil(length/.47));
    for(let span=0;span<intervals;span++){
      const loc=at((span+.5)/intervals,underside,.082);
      if(length>.17)pile(loc.x,loc.z);
    }
    const gaps=ferryConnections.flatMap(({from,to,width})=>[from,to].flatMap(([x,z])=>{
      const t=((x-a[0])*dx+(z-a[1])*dz)/(length*length);
      const nearest=at(t,0,.025),distance=Math.hypot(x-nearest.x,z-nearest.z);
      const radius=width*.86;
      if(distance>=radius)return [];
      const slice=Math.sqrt(radius*radius-distance*distance)/length;
      return [[Math.max(0,t-slice),Math.min(1,t+slice)]];
    })).filter(([from,to])=>from<to).sort((a,b)=>a[0]-b[0]);
    let guardStart=0;
    for(const [stop,resume] of [...gaps,[1,1]]){
      const run=(stop-guardStart)*length;
      if(run>.042&&at((guardStart+stop)/2,0).z>2.17){
        for(const height of [.026,.053,.077]){
          link(at(guardStart,apronY+height,.025),at(stop,apronY+height,.025),.006,'#567b85',guard,.007).name='Human-scale apron handrail';
        }
        const spans=Math.ceil(run/.31);
        for(let post=0;post<=spans;post++){
          const upright=at(THREE.MathUtils.lerp(guardStart,stop,post/spans),apronY+.039,.025);
          box(.008,.078,.008,upright.x,upright.y,upright.z,'#607f86',guard);
        }
      }
      guardStart=Math.max(guardStart,resume);
    }
  }
  for(let z=2.58;z<10.45;z+=.57){
    const a=-7.003+(z-2.23)*.151,b=-1.288-(z-2.995)*.123;
    link(new THREE.Vector3(a+.09,apronY+.0005,z),new THREE.Vector3(b-.135,apronY+.0005,z),.002,'#9d9b8b',terminal,.005);
  }
  for(const [x,z] of [[-4.78,8.7],[-5.60,4.92],[-4.13,9.58],[3.88,1.99],[-6.64,3.35]]){
    box(.28,.014,.081,x,apronY+.034,z,'#ae9877',terminal);
    box(.28,.037,.009,x,apronY+.055,z-.038,'#a89070',terminal);
    for(const side of [-1,1])box(.015,.036,.069,x+side*.095,apronY+.017,z,'#65756e',terminal);
  }
  // Steuart Tower's aerial shows a long corrugated gable, with detached low kiosk roofs.
  // The water and waiting room photographs show the red lattice above the concrete posts.
  const waiting=new THREE.Group();waiting.name='Golden Gate Ferry Terminal waiting shelter';
  waiting.position.set(-2.236,0,4.408);waiting.rotation.y=-.119;
  terminal.add(waiting);
  const halfSpan=.446, halfLength=1.687, eave=.474, rise=.102, sill=.096;
  const silver=['#c3c8c5','#c7cbc6','#bbc4c0','#c8cbc6','#bec5bf'];
  const red='#936052',roofEdge='#b0b5ac',under='#b8a882',pier='#a7aaa0';
  function at(x:number,y:number,z:number){return new THREE.Vector3(x,y,z);}
  function roofSlope(side:number,w:number,h:number,d:number,x:number,y:number,z:number,color:string){
    const sheet=box(w,h,d,side*x,y,z,color,waiting);
    sheet.rotation.z=-side*Math.atan2(rise,halfSpan);return sheet;
  }
  const slant=Math.hypot(halfSpan,rise),sheets=32,sheetWidth=2*halfLength/sheets;
  for(const side of [-1,1]){
    for(let i=0;i<sheets;i++){
      const z=-halfLength+(i+.5)*sheetWidth;
      roofSlope(side,slant,.011,sheetWidth,halfSpan/2,eave+rise/2,z,silver[Math.floor(i/3+side+1)%silver.length]).name='Galvanized roof panel';
      roofSlope(side,slant-.004,.007,.0047,halfSpan/2,eave+rise/2+.007,z-sheetWidth*.48,'#aab6b2').name='Raised roof seam';
    }
    roofSlope(side,slant-.006,.004,2*halfLength-.017,halfSpan/2,eave+rise/2-.007,0,under);
    box(.024,.022,2*halfLength+.023,side*halfSpan,eave-.007,0,roofEdge,waiting);
    box(.013,.012,2*halfLength-.025,side*(halfSpan-.017),eave-.045,0,red,waiting);
    for(let i=0;i<24;i++){
      const from=-halfLength+.013+i*(2*halfLength-.026)/24,to=-halfLength+.013+(i+1)*(2*halfLength-.026)/24;
      link(at(side*(halfSpan-.020),eave-(i%2?.037:.014),from),
        at(side*(halfSpan-.020),eave-(i%2?.014:.037),to),.0071,red,waiting);
    }
  }
  box(.034,.012,2*halfLength+.018,0,eave+rise+.006,0,'#a9b5b0',waiting).name='Gable ridge flashing';
  for(const edge of [-halfLength+.009,halfLength-.009]){
    for(const side of [-1,1])link(at(0,eave+rise-.004,edge),at(side*(halfSpan+.006),eave-.008,edge),.017,roofEdge,waiting);
  }
  for(const z of [-1.49,-.91,-.32,.27,.86,1.45]){
    const base=eave-.116;
    for(const side of [-1,1]){
      // The flared steel knees spring from cast columns and leave the access aisle clear.
      const x=side*.347;
      box(.048,base-sill,.047,x,(base+sill)/2,z,pier,waiting).name='Concrete shelter column';
      box(.075,.029,.067,x,sill+.014,z,'#9a9e94',waiting);
      link(at(x,base,z),at(side*.239,eave+.021,z),.017,red,waiting).name='Red lattice knee brace';
      link(at(x,base,z),at(side*.414,eave-.026,z),.014,red,waiting);
      link(at(x,eave-.036,z),at(0,eave+rise-.016,z),.012,red,waiting);
      for(let i=0;i<4;i++){
        const a=i*.104,b=(i+1)*.104;
        const lower=(d:number)=>eave+.018-d*.139;
        const upper=(d:number)=>eave+rise*(1-d/halfSpan)-.018;
        link(at(side*a,i%2?lower(a):upper(a),z),at(side*b,i%2?upper(b):lower(b),z),.0065,red,waiting);
      }
    }
    link(at(-.342,eave-.037,z),at(.342,eave-.037,z),.010,red,waiting);
  }
  // Longitudinal purlins and glazing sit beneath the canopy and keep the bays open.
  for(const x of [-.205,0,.205]){
    const y=eave+rise*(1-Math.abs(x)/halfSpan)-.020;
    box(.011,.015,2*halfLength-.04,x,y,0,red,waiting);
  }
  for(const z of [-.96,1.24]){
    box(.21,.173,.018,-.12,.232,z,'#7496a1',waiting);
    for(const x of [-.226,-.12,-.014])box(.012,.21,.034,x,.230,z,blueSteel,waiting);
    box(.235,.016,.036,-.12,.326,z,blueSteel,waiting);
  }
  for(const [x,z,w,d,h] of [[-.794,-.169,.641,.829,.174],[-.721,1.342,.443,.335,.157]] as const){
    const kiosk=new THREE.Group();kiosk.name='Separate Golden Gate service canopy';
    kiosk.position.set(x,0,z);waiting.add(kiosk);
    box(w*.82,h,d*.77,0,sill+h/2,0,'#ad9d85',kiosk);
    box(w,.027,d,0,sill+h+.008,0,'#bfc3b9',kiosk);
    box(w-.029,.007,d-.028,0,sill+h+.024,0,'#a3a7a0',kiosk);
    for(const end of [-1,1]){
      box(w,.014,.016,0,sill+h+.022,end*(d/2-.008),'#c9c9bb',kiosk);
      box(.016,.014,d,end*(w/2-.008),sill+h+.022,0,'#c9c9bb',kiosk);
      box(.141,.121,.014,end*w*.16,sill+.075,d*.391,'#7795a0',kiosk);
    }
  }
  return terminal;
}
