import * as THREE from 'three';

type BridgeMesh = (shape: THREE.BufferGeometry, color: string, x: number, y: number, z: number, parent: THREE.Group) => THREE.Mesh;
const laneWidth = .216;
export const bridgeLaneCenters = [-2,-1,0,1,2].map(lane=>lane*laneWidth);
const floorHalfWidth = .607;

export const roadPaintLift=.002*.06;

/** Paint film on the wearing surface. Local +Z heads to the island. */
export function addBridgeMarkings(parent:THREE.Group,mesh:BridgeMesh,from:number,to:number,asphalt:number,westbound:boolean){
  const plane=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  plane.userData.roadPaint='West span';
  function stripe(x:number,a:number,b:number,width:number,color:string,name:string){
    const m=mesh(plane,color,x,asphalt+roadPaintLift,(a+b)/2,parent);
    m.scale.set(width,1,b-a);m.name=name;m.userData.roadExposure=westbound?3:4;
  }
  const left=westbound?-1:1;
  stripe(left*.548,from,to,.011,'#c4ab72','Left shoulder');
  stripe(-left*.548,from,to,.011,'#d8d8c3','Right shoulder');
  const start=Math.max(0,Math.ceil((from-.125-.62)/.86));
  for(let i=start;.62+i*.86-.125<to;i++){
    const z=.62+i*.86,a=Math.max(from,z-.125),b=Math.min(to,z+.125);
    for(let lane=1;lane<5;lane++)stripe((lane-2.5)*laneWidth,a,b,.008,'#cbcbbb','Lane stripe');
  }
}

/** Steel-faced westbound parapet, continuous through the island approach. */
export function addUpperParapet(parent:THREE.Group,mesh:BridgeMesh,from:number,to:number,asphalt:number){
  const plate=new THREE.BoxGeometry(1,1,1);
  function panel(x:number,y:number,z:number,w:number,h:number,d:number,c:string,name:string){
    const m=mesh(plate,c,x,y,z,parent);m.scale.set(w,h,d);m.name=name;
  }
  for(const side of [-1,1]){
    panel(side*.595,asphalt+.012,(from+to)/2,.046,.030,to-from,'#96968b','Parapet toe');
    panel(side*.597,asphalt+.035,(from+to)/2,.034,.046,to-from,'#98a39e','Solid parapet face');
    panel(side*.597,asphalt+.058,(from+to)/2,.038,.004,to-from,'#aab1a8','Parapet cap');
    for(let i=Math.ceil(from/.43);i*.43<to;i++){
      panel(side*.580,asphalt+.040,i*.43,.002,.036,.004,'#868f8b','Parapet panel joint');
    }
  }
}

/** The western suspension span's two roadways form a Warren stiffening truss. */
export function addBridgeDeck(bridge: THREE.Group, mesh: BridgeMesh, length: number, lower: number, upper: number) {
  const group = new THREE.Group();
  group.name = 'West span double-deck steelwork';
  bridge.add(group);
  const plate = new THREE.BoxGeometry(1,1,1);
  function box(w:number,h:number,d:number,x:number,y:number,z:number,c:string,name='') {
    const member = mesh(plate,c,x,y,z,group);
    member.scale.set(w,h,d);
    member.name = name;
    return member;
  }
  function brace(x:number,fromY:number,fromZ:number,toY:number,toZ:number,w:number,thickness:number,color:string) {
    const dy=toY-fromY,dz=toZ-fromZ;
    const beam=box(w,thickness,Math.hypot(dy,dz)+.022,x,(fromY+toY)/2,(fromZ+toZ)/2,color,'Warren diagonal plate');
    beam.rotation.x=-Math.atan2(dy,dz);
  }
  const gray='#778c90', high='#a1aca7', low='#6c8185', braces=['#8b9c9c','#819596','#91a1a0'];
  const lowerRail=lower+.25;
  const topChord=upper-.037, bottomChord=lower-.064;
  box(floorHalfWidth*2,.094,length,0,lower,length/2,'#9ba59f','Lower eastbound deck slab');
  box(floorHalfWidth*2,.102,length,0,upper,length/2,'#a7aaa0','Upper westbound deck slab');
  box(1.135,.016,length,0,lower+.050,length/2,'#65797c').userData.roadExposure=4;
  box(1.135,.023,length,0,upper+.064,length/2,'#728383').userData.roadExposure=3;
  for (const side of [-1,1]) {
    const x=side*.628;
    box(.11,.10,length,x,bottomChord,length/2,low,'Lower chord web');
    box(.119,.024,length,x,bottomChord-.046,length/2,gray,'Lower chord flange');
    box(.12,.103,length,x,topChord,length/2,gray,'Upper chord web');
    box(.139,.024,length,x,topChord+.052,length/2,high,'Upper chord flange');
    box(.037,.044,length,side*.59,lower+.071,length/2,high);
    box(.024,.035,length,side*.602,lowerRail,length/2,'#98aaa5');
  }
  for (const x of [-.40,-.20,0,.20,.40]) {
    box(.039,.062,length,x,lower-.081,length/2,'#677d82','Longitudinal lower floor stringer');
    box(.039,.056,length,x,upper-.086,length/2,'#788a8e','Longitudinal upper floor stringer');
  }

  const panels=Math.round(length/.86), panelLength=length/panels;
  for(let i=0;i<panels;i++){
    const a=i*panelLength,b=(i+1)*panelLength,mid=(a+b)/2;
    box(1.36,.075,.065,0,lower-.069,a,gray,'Lower transverse floor beam');
    box(1.36,.076,.062,0,upper-.082,mid,'#84969a','Upper transverse floor beam');
    for(const side of [-1,1]){
      const x=side*.63;
      brace(x,bottomChord,a,topChord,mid,.047,.075,braces[i%3]);
      brace(x,topChord,mid,bottomChord,b,.047,.075,braces[(i+1)%3]);
      box(.054,topChord-bottomChord,.044,x,(topChord+bottomChord)/2,a,low,'Vertical stiffener');
      box(.017,.13,.138,x+side*.027,bottomChord+.036,a,'#8b9b9b','Lower gusset plate');
      box(.018,.12,.132,x+side*.028,topChord-.018,mid,'#94a4a2','Upper gusset plate');
      box(.022,lowerRail-lower-.07,.026,side*.607,(lowerRail+lower+.085)/2,mid,'#829896');
    }
    // Horizontal cross bracing is visible under the lower floor.
    for (const side of [-1,1]) {
      const member=box(.032,.027,Math.hypot(1.17,panelLength),0,lower-.118+side*.006,mid,'#758b8d','Lower lateral bracing');
      member.rotation.y=side*Math.atan2(1.17,panelLength);
    }
  }

  addUpperParapet(group,mesh,0,length,upper+.0755);
  addBridgeMarkings(group,mesh,0,length,upper+.0755,true);
  addBridgeMarkings(group,mesh,0,length,lower+.058,false);
  return group;
}
