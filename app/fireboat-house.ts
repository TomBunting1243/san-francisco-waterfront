import * as THREE from 'three';
import {ferryWalkLens} from './ferry-walk-lights.ts';
import type {Font} from 'three/addons/loaders/FontLoader.js';

type MeshFactory=(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number,parent:THREE.Group)=>THREE.Mesh;
type WindowBand=readonly [number,number,number,number,number,number?];
const metal='#b9bdba',joint='#929d9b',glass='#547073',frame='#414e50',base='#50595b';
const foot=.3048*.06;
// Room-to-room values are interpreted from the visible patches in the photographs.
const crewBays=[.47,.67,.30,.81,.75,.59,.28,.76,.87,.62,.44];
const shoreDoors=[.51,.67,.89,.81,.73];
const shoreClerestory=[.42,.56,.74,.81,.66,.52,.57,.72,.75,.63,.44];

// Port plan, sheets 12 and 15: the living quarters and observation deck face
// the bay. Abraham's completed exterior photographs resolve the glazing,
// different long elevations, roof enclosure, slats, crane and dock fittings.
export function floatingFirehouse(p:number[][],deckY:number,parent:THREE.Group,mesh:MeshFactory,font:Font){
  const [[ax,az],[bx,bz],[cx,cz]]=p;
  const width=Math.hypot(bx-ax,bz-az),length=Math.hypot(cx-bx,cz-bz),height=34*foot;
  const house=new THREE.Group();house.name='Floating firehouse';parent.add(house);
  house.position.set((ax+bx)/2,deckY,(az+bz)/2);house.rotation.y=-Math.atan2(bz-az,bx-ax);
  const windows:{x:number;y:number;z:number;ry:number;w:number;h:number;tide:true}[]=[];
  const cube=new THREE.BoxGeometry(),plane=new THREE.PlaneGeometry();
  function box(w:number,h:number,d:number,x:number,y:number,z:number,c:string,group=house){
    const part=mesh(cube,c,x,y,z,group);part.scale.set(w,h,d);return part;
  }
  function face(x:number,z:number,angle:number){
    const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=angle;
    house.add(group);group.updateWorldMatrix(true,false);return group;
  }
  const faces=new Map<THREE.Group,Map<string,number[]>>();
  function patch(g:THREE.Group,left:number,right:number,bottom:number,top:number,depth:number,color:string){
    let byColor=faces.get(g);
    if(!byColor){byColor=new Map();faces.set(g,byColor);}
    let points=byColor.get(color);
    if(!points){points=[];byColor.set(color,points);}
    points.push(left,bottom,depth,right,bottom,depth,right,top,depth,left,top,depth);
  }
  // The SF Public Works offshore photograph (Russell Abraham) and the
  // architect's shore approach image 44 resolve the normally lit end rooms.
  // https://sfpublicworks.org/fireboat-station-35
  // https://skarc.com/projects/san-francisco-fireboat-station-35/
  const roomLight=new Map<THREE.Group,number[]>();
  // Bands use fractions of each elevation, left to right as seen from outside.
  // Masonry, glazing and frame grids partition the face at their true heights.
  function elevation(g:THREE.Group,w:number,low:number,high:number,bands:readonly WindowBand[],setback=0,room?:'shore'|'crew'){
    const ribs:number[]=[];
    for(let y=.18;y<high-.004;y+=.035)if(y>=low){ribs.push(y,y+.002);}
    const sections=[...new Set([low,high,...(low<.152&&.152<high?[.152]:[]),...ribs,...bands.flatMap(b=>[b[2],b[3]])])].sort((a,b)=>a-b);
    for(let i=1;i<sections.length;i++){
      const y0=sections[i-1],y1=sections[i];
      const tint=y1<=.152?base:ribs.some((y,j)=>j%2===0&&y0>=y&&y1<=y+.002)?'#a2aaa7':metal;
      let start=0;
      for(const [a,b] of bands.filter(b=>b[2]<=y0&&b[3]>=y1).sort((a,b)=>a[0]-b[0])){
        if(a>start)patch(g,(start-.5)*w,(a-.5)*w,y0,y1,setback,tint);
        start=b;
      }
      if(start<1)patch(g,(start-.5)*w,w*.5,y0,y1,setback,tint);
    }
    for(const [a,b,y,h,cols,rows=1] of bands){
      const left=(a-.5)*w,right=(b-.5)*w,step=(right-left)/cols;
      patch(g,left,right,y,h,setback,frame);
      const row=(h-y)/rows;
      for(let j=0;j<cols;j++)for(let k=0;k<rows;k++){
        const x=left+(j+.5)*step,cy=y+(k+.5)*row,iw=step-.008,ih=row-.007;
        patch(g,x-iw/2,x+iw/2,cy-ih/2,cy+ih/2,setback+.002,glass);
        if(room){
          let channels=roomLight.get(g);
          if(!channels){
            // The offshore wall already contains its original lower glazing.
            const previous=(faces.get(g)!.get(glass)!.length-12);
            channels=Array(previous).fill(0);roomLight.set(g,channels);
          }
          const clerestory=room==='shore'&&y>.28;
          const bay=room==='crew'?crewBays:clerestory?shoreClerestory:shoreDoors;
          // Cooler corridor glass behind the louvers; retain a shaded sill
          // and more variation in the inhabited lower half of the bay room.
          const intensity=bay[j]*(k===0?(room==='crew'?.60:.84):1);
          const green=clerestory?.94:.83,blue=clerestory?.81:.60;
          for(let v=0;v<4;v++){
            const value=Math.round(255*intensity*(v<2&&k===0?.79:1));
            channels.push(value,Math.round(value*green),Math.round(value*blue));
          }
          continue;
        }
        // The city glass shader uses polygon offset. Register its instances to
        // individual panes so a long bright rectangle cannot erase its muntins.
        if(rows===1||y>=.28||cols<=3){
          const wp=g.localToWorld(new THREE.Vector3(x,cy,setback+.003));
          windows.push({x:wp.x,y:wp.y,z:wp.z,ry:g.rotation.y+house.rotation.y,w:iw,h:ih,tide:true});
        }
      }
    }
  }
  const north=face(width/2,length/2,Math.PI/2),south=face(-width/2,length/2,-Math.PI/2);
  elevation(north,length,0,height,[
    [.06,.32,.358,.431,6],[.32,.61,.437,.471,4],[.64,.91,.354,.425,5],
    [.07,.23,.167,.204,4],[.26,.34,.012,.145,2],[.49,.75,.008,.221,5,4],[.84,.91,.018,.142,2]
  ]);
  elevation(south,length,0,height,[
    [.077,.238,.367,.434,3],[.24,.524,.482,.512,5],[.528,.85,.367,.434,7],[.85,.95,.482,.512,2],
    [.115,.233,.009,.144,3],[.381,.42,.009,.245,1],[.422,.815,.009,.245,6,4],[.817,.85,.009,.245,1]
  ]);
  // The southwest protrusion in the mapped roof is the canopy over the
  // drive-through apparatus openings, with open apron underneath.
  const sw=p[5],canopyDepth=Math.hypot(sw[0]-p[4][0],sw[1]-p[4][1]);
  const canopyLength=Math.hypot(p[5][0]-p[6][0],p[5][1]-p[6][1]);
  const canopyStart=Math.hypot(p[7][0]-ax,p[7][1]-az);
  box(canopyDepth,.014,canopyLength,-(width+canopyDepth)/2,.258,canopyStart+canopyLength/2,joint);
  // Both completed long elevations carry silver department lettering at the
  // shoreward end. The conspicuous red rectangle in the bay photograph is
  // the moored boat's funnel.
  for(const [label,size,y] of [['SAN FRANCISCO FIRE DEPARTMENT',.029,.550],['PIER 22 1/2',.024,.515]] as const){
    const glyphs=new THREE.ShapeGeometry(font.generateShapes(label,size),2);
    glyphs.computeBoundingBox();
    const extent=glyphs.boundingBox!.max.x-glyphs.boundingBox!.min.x;
    for(const [g,x] of [[south,-length*.475],[north,length*.475-extent]] as const)
      mesh(glyphs,'#828b89',x,y,.005,g);
  }
  // SF Planning, Pier 22½ initial study, impact AE-4: the everyday
  // perimeter lighting is building-mounted, shielded and low-level.
  // https://sfplanning.s3.amazonaws.com/sfmea/Revised_PMND_Fire_Station_35.pdf
  function apronLight(side:THREE.Group,x:number){
    box(.039,.023,.032,x,.148,.012,base,side);
    const lens=box(.029,.004,.022,x,.135,.019,'#d6dbd0',side);
    ferryWalkLens(lens,'Station 35 shielded apron light',.61,.69);
  }
  for(const [side,stations] of [[north,[-.44,-.165,.29,.454]],[south,[-.45,-.145,.37,.465]]] as const)
    for(const station of stations)apronLight(side,station*length);
  const shore=face(0,0,Math.PI);
  apronLight(shore,-width*.445);
  elevation(shore,width,0,height,[[.047,.95,.374,.557,11,2],[.46,.95,.008,.236,5,2]],0,'shore');
  for(let i=0;i<11;i++)patch(shore,-width*.45,width*.45,.245+i*.026,.251+i*.026,.008,frame);
  for(let i=0;i<8;i++)patch(shore,-width*.45,-width*.055,.018+i*.025,.024+i*.025,.008,frame);
  const water=face(0,length,0),stepBack=.112;
  for(const side of [-1,1])apronLight(water,width*.478*side);
  elevation(water,width,0,.280,[[.055,.28,.011,.252,2,3],[.29,.948,.008,.254,7,3]]);
  for(let i=0;i<8;i++)patch(water,-width*.21,width*.45,.023+i*.028,.031+i*.028,.007,joint);
  elevation(water,width,.28,height,[[.047,.953,.30,.565,11,2]],-stepBack,'crew');
  // The lateral returns and slab form the recessed bay-end balcony.
  for(const side of [-1,1]){
    const x=side*width*.5;
    patch(water,Math.min(x,x-side*.035),Math.max(x,x-side*.035),.29,height-.054,0,metal);
    const reveal=face(x-side*.035,length-stepBack/2,-side*Math.PI/2);
    patch(reveal,-stepBack/2,stepBack/2,.29,height-.054,0,joint);
  }
  box(width,.023,stepBack+.023,0,.281,length-stepBack/2+.008,joint);
  patch(water,-width/2,width/2,height-.054,height,0,metal);
  const soffit=mesh(plane,joint,0,height-.054,length-stepBack/2,house);
  soffit.scale.set(width,stepBack,1);soffit.rotation.x=Math.PI/2;
  for(const x of [-.45,-.225,0,.225,.45])box(.006,.065,.006,x*width,.325,length+.012,frame);
  for(const y of [.309,.328,.349])box(.918*width,.004,.004,0,y,length+.012,frame);

  const roof=mesh(plane,metal,0,height,length/2,house);
  roof.rotation.x=-Math.PI/2;roof.scale.set(width,length,1);
  // The orthophoto resolves a narrow central mechanical enclosure with a
  // clear perimeter walkway. The individual plant units are simplified.
  const plantWidth=width*.38,plantLength=length*.67,mid=length*.51;
  for(const side of [-1,1]){
    box(.012,.055,plantLength,side*plantWidth/2,height+.0275,mid,'#a3a9a5');
    box(plantWidth-.012,.055,.012,0,height+.0275,mid+side*(plantLength-.012)/2,'#a3a9a5');
  }
  for(const [u,w,d] of [[.25,.16,.14],[.40,.14,.18],[.56,.17,.20],[.70,.13,.12]])
    box(w,.045,d,0,height+.0225,length*u,'#788380');
  // The work side carries the small handling crane in the completed photo.
  const craneX=-width/2-.27,craneZ=length*.80;
  box(.06,.026,.07,craneX,.013,craneZ,base);
  box(.026,.27,.03,craneX,.157,craneZ,frame);
  box(.028,.031,.20,craneX,.295,craneZ+.08,frame);
  box(.012,.037,.009,craneX,.265,craneZ+.168,joint);
  for(const x of [-width/2-.30,width/2+.14])for(const z of [.25,length*.48,length-.13]){
    box(.031,.014,.025,x,.007,z,frame);box(.052,.01,.023,x,.019,z,frame);
  }
  // Register one indexed face mesh per material before the regular city bake.
  for(const [g,byColor] of faces)for(const [color,points] of byColor){
    const geometry=new THREE.BufferGeometry(),indices:number[]=[];
    for(let i=0;i<points.length/3;i+=4)indices.push(i,i+1,i+2,i,i+2,i+3);
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    const emission=roomLight.get(g);
    if(color===glass&&emission){
      geometry.setAttribute('signLight',new THREE.Uint8BufferAttribute(emission,3,true));
      // Recover the cool daylight value of the retired upper glass overlay.
      // The lower apparatus doors retain their original, darker pigment.
      const raw=new THREE.Color(glass),sky=new THREE.Color('#8698a7'),day:number[]=[];
      for(let i=0;i<points.length;i+=3){
        if(points[i+1]>.285)day.push(sky.r/raw.r,sky.g/raw.g,sky.b/raw.b);
        else day.push(1,1,1);
      }
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(day,3));
      geometry.userData.paintVertices=true;
    }
    geometry.setIndex(indices);geometry.computeVertexNormals();
    mesh(geometry,color,0,0,0,g);
  }
  return windows;
}
