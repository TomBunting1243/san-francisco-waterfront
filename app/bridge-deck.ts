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

// HAER CA-32 photos 182 (Frank Deras Jr.) and 183 (Dennis Hill): the
// suspenders penetrate the raised service tread, inboard of the riveted wall.
// https://www.loc.gov/resource/hhh.ca1352.photos.383153p
// Chris English's October 2013 drive shows the pale painted plates at road level.
// https://commons.wikimedia.org/wiki/File:2013,_Approaching_Exit_2C,_Bay_Bridge_Southbound_-_panoramio.jpg
export function addUpperParapet(parent:THREE.Group,mesh:BridgeMesh,from:number,to:number,asphalt:number){
  const paint=['#88928f','#b0b7aa','#949d95','#717d77','#8f9b95','#aab5ab','#85958d','#71847b','#b4beb2'].map(c=>new THREE.Color(c));
  // Cross section from the rolled roadward curb to the outer plate return.
  // The top is level across both lanes of hanger sockets (x=.581604, .625404).
  const profile=[
    [.560,-.025,0],[.560,.010,0],[.564,.015,1],[.571,.016,2],
    [.6265,.016,2],[.632,.016,3],[.632,.020,3],[.633,.022,4],
    [.633,.059,4],[.631,.059,6],[.631,.062,5],[.650,.062,5],
    [.650,.059,6],[.647,.059,6],[.647,-.025,6],
  ];
  const pitch=.43,panelsPerChunk=54;
  for(const side of [-1,1]){
    for(let start=from;start<to;){
      const end=Math.min(to,(Math.floor((start+.000001)/(pitch*panelsPerChunk))+1)*pitch*panelsPerChunk);
      const positions:number[]=[],colors:number[]=[],indices:number[]=[];
      const origin=(start+end)/2;
      function vertex(x:number,y:number,z:number,pigment:number){
        positions.push(x*side,y,z-origin);
        const tint=paint[pigment];colors.push(tint.r,tint.g,tint.b);
      }
      function face(i:number){
        if(side>0)indices.push(i,i+1,i+2,i,i+2,i+3);
        else indices.push(i,i+2,i+1,i,i+3,i+2);
      }
      for(let j=0;j<profile.length-1;j++){
        const [x,y,tint]=profile[j],[xx,yy]=profile[j+1],i=positions.length/3;
        vertex(x,y,start,tint);vertex(x,y,end,tint);vertex(xx,yy,end,tint);vertex(xx,yy,start,tint);face(i);
      }
      // Flush pigment for seam returns and alternating bright/dark rivet heads.
      // Group several visible fasteners per panel at driving distance. All heads,
      // tread joints and plates are packed into this same ordinary opaque chunk.
      for(let n=Math.floor(start/pitch);n*pitch<end;n++){
        const seam=n*pitch;
        if(seam>=start&&seam+.0018<=end){
          let i=positions.length/3;
          vertex(.6327,.022,seam,7);vertex(.6327,.022,seam+.0018,7);
          vertex(.6327,.059,seam+.0018,7);vertex(.6327,.059,seam,7);face(i);
          if(n%2===0){
            i=positions.length/3;
            vertex(.565,.01618,seam,7);vertex(.565,.01618,seam+.0018,7);
            vertex(.632,.01618,seam+.0018,7);vertex(.632,.01618,seam,7);face(i);
          }
        }
        for(let f=0;f<4;f++){
          const z=seam+.008+f*pitch/4;
          if(z-.0017<start||z+.0017>end)continue;
          for(const y of f===0?[.025,.040,.056]:f===2?[.025,.056]:[.056]){
            const i=positions.length/3;
            vertex(.6325,y-.0014,z-.0017,7);vertex(.6325,y-.0014,z+.0017,7);vertex(.6325,y+.0018,z,8);
            if(side>0)indices.push(i,i+1,i+2);else indices.push(i,i+2,i+1);
          }
        }
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      g.setIndex(indices);g.computeVertexNormals();g.userData.paintVertices=true;
      mesh(g,'#ffffff',0,asphalt,origin,parent).name='Raised service tread and riveted outer guard';
      start=end;
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
