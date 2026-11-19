import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from './harbor-font.json' with {type:'json'};
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import {stationSites} from './embarcadero-station-sites.ts';

type Surface=(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
const grade=.045,font=new FontLoader().parse(fontData);
const painted=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7});
const labelFont=new Map<string,THREE.ShapeGeometry>();
const steel='#9ca9a7',shadow='#606d6e',sill='#677675',glint='#bbd0c9',dark='#323e40';

export function addEmbarcaderoEntrance(mesh:Surface,id:number){
  const site=stationSites.get(id);if(!site)return false;
  const {point,front,end,width,escalatorSide,well,back}=site;
  const paint=new FacadePanels();
  const P=(x:number,y:number,z:number):FacadePoint=>{const [u,v]=point(x,z);return [u,grade+y*.06,v];};
  type V=[number,number,number];
  const quad=(a:V,b:V,c:V,d:V,color:string)=>paint.quad(P(...a),P(...b),P(...c),P(...d),color);
  function box(l:number,r:number,b:number,t:number,f:number,e:number,color:string,top=color){
    quad([l,t,f],[l,t,e],[r,t,e],[r,t,f],top);
    quad([l,b,f],[r,b,f],[r,b,e],[l,b,e],shadow);
    quad([l,b,f],[l,t,f],[r,t,f],[r,b,f],color);
    quad([r,b,e],[r,t,e],[l,t,e],[l,b,e],color);
    quad([l,b,e],[l,t,e],[l,t,f],[l,b,f],color);
    quad([r,b,f],[r,t,f],[r,t,e],[r,b,e],color);
  }
  function tube(x:number,z:number,r:number,b:number,t:number){
    for(let k=0;k<12;k++){
      const a=k*Math.PI/6,c=(k+1)*Math.PI/6;
      const l=x+r*Math.cos(a),f=z+r*Math.sin(a),u=x+r*Math.cos(c),e=z+r*Math.sin(c);
      quad([l,b,f],[l,t,f],[u,t,e],[u,b,e],k%5===0?'#adb5af':steel);
    }
  }
  // BART's ES1 longitudinal section and the completed Drumm/Beale photos
  // show a slender level rim with an FRP soffit sagging between its supports.
  const roof=4.34,half=width/2,span=end-front;
  box(-half,half,roof-.13,roof,front,end,'#889494','#c6c8bd');
  for(const v of [front+2.0,end-2.0])box(-.66,.66,roof,roof+.055,v-.45,v+.45,'#a5ada5','#b7bcb1');
  const soffit=(v:number)=>roof-.19-.48*Math.sin(Math.PI*(v-front)/span);
  for(let i=0;i<18;i++){
    const a=front+span*i/18,b=front+span*(i+1)/18,ya=soffit(a),yb=soffit(b);
    quad([-half,ya,a],[half,ya,a],[half,yb,b],[-half,yb,b],'#d0cab7');
    for(const s of [-1,1]){
      const x=s*half;
      const face:V[]=[[x,ya,a],[x,yb,b],[x,roof-.126,b],[x,roof-.126,a]];
      if(s>0)face.reverse();
      quad(face[0],face[1],face[2],face[3],'#798481');
    }
  }
  const posts=[front+span*.15,end-span*.13],wall=well/2+.20;
  for(const side of [-1,1]){
    const x=side*wall;
    for(const z of posts)tube(x,z,.115,0,soffit(z)+.07);
    // Clear glazing is represented by its glass edges, reflection and fittings.
    // Open areas retain the street sightline after opaque city batching.
    box(x-.035,x+.035,.06,.16,posts[0],posts[1],sill);
    box(x-.026,x+.026,2.72,2.77,posts[0],posts[1],steel);
    for(let i=0;i<=8;i++){
      const z=posts[0]+(posts[1]-posts[0])*i/8;
      box(x-.008,x+.008,.16,2.72,z-.011,z+.011,glint);
      if(i%2===1)box(x-.013,x+.013,.19,.27,z-.035,z+.035,steel);
    }
  }
  const cabinet=escalatorSide*wall,frontPost=posts[0],farPost=posts[1];
  box(cabinet-.26,cabinet+.26,0,2.78,frontPost-.30,frontPost+.76,steel);
  box(-cabinet-.26,-cabinet+.26,0,2.78,farPost-.68,farPost+.26,steel);
  box(-cabinet-.192,-cabinet+.192,1.33,1.72,farPost+.262,farPost+.276,dark);
  // The BART blue/black and Muni red identifiers and vertically reading
  // station name are on the entry cabinet. No simulated arrival times.
  function lettering(text:string,x:number,y:number,size:number,tint:string,down=false){
    let g=labelFont.get(text);
    if(!g){g=new THREE.ShapeGeometry(font.generateShapes(text,1),2);labelFont.set(text,g);}
    const v=g.attributes.position,idx=g.index!;
    function at(k:number){
      const u=v.getX(k)*size,w=v.getY(k)*size;
      // An arriving rider faces +v: their right points along -u. Rotate
      // the glyph clockwise in their view before projecting onto that basis.
      return P(x-(down?w:u),y+(down?-u:w),frontPost-.305);
    }
    for(let i=0;i<idx.count;i+=3){
      const a=at(idx.getX(i)),b=at(idx.getX(i+1)),c=at(idx.getX(i+2));
      paint.triangle(a,b,c,tint);
    }
  }
  // BART's two joined bowls, black ascending b and blue a, with the
  // agency name above them. Draw directly into the existing facade batch.
  const black='#232b2e',blue='#2379a0';
  const mark=(u:number,y:number,inkDepth=0):FacadePoint=>P(cabinet-u,y,frontPost-.305-inkDepth);
  for(const [cx,tint,depth] of [[-.087,black,0],[.087,blue,.001]] as const){
    const rim=(r:number,i:number)=>mark(cx+r*Math.cos(i*Math.PI/12),2.39+r*Math.sin(i*Math.PI/12),depth);
    for(let i=0;i<24;i++)paint.quad(rim(.097,i),rim(.097,i+1),rim(.040,i+1),rim(.040,i),tint);
  }
  // Stems share the outermost tangent of each bowl.
  paint.quad(mark(-.184,2.39,.002),mark(-.126,2.458,.002),mark(-.126,2.594,.002),mark(-.184,2.594,.002),black);
  paint.quad(mark(.126,2.292,.002),mark(.184,2.292,.002),mark(.184,2.39,.002),mark(.126,2.345,.002),blue);
  lettering('BART',cabinet+.068,2.516,.064,black);
  lettering('MUNI',cabinet+.205,2.07,.103,'#b3423b');
  lettering('EMBARCADERO',cabinet+.07,1.90,.144,'#303b40',true);
  const halfWell=well/2;
  // Exterior stairs and escalator share the mapped opening. The lowest visible
  // tread is 1.22 m below grade, above the continuous regional relief surface.
  const step=.31,rise=.153,count=8,min=-rise*count;
  const boundary=escalatorSide*(halfWell-1.38);
  const stairL=escalatorSide>0?-halfWell:boundary,stairR=escalatorSide>0?boundary:halfWell;
  const escL=escalatorSide>0?boundary:-halfWell,escR=escalatorSide>0?halfWell:boundary;
  for(let i=0;i<count;i++){
    const start=.10+i*step,next=start+step,y=-rise*(i+1);
    for(const [l,r,tone] of [[stairL,stairR,'#a7a597'],[escL,escR,'#788383']] as const){
      quad([l,y,start],[l,y,next],[r,y,next],[r,y,start],tone);
      quad([r,y,start],[r,y+rise,start],[l,y+rise,start],[l,y,start],'#787b71');
    }
  }
  quad([-halfWell,min,.10+count*step],[-halfWell,min,back],[halfWell,min,back],[halfWell,min,.10+count*step],'#444e4d');
  for(const x of [-halfWell,halfWell]){
    box(x-.041,x+.041,min,.105,.095,back+.06,sill);
  }
  box(-halfWell,halfWell,min,.10,back,back+.10,sill);
  for(const x of [boundary,escalatorSide*(halfWell-.10)]){
    for(const [a,b,ya,yb] of [[-.58,.15,.81,.90],[.15,.67,.90,.85],[.67,3.1,.85,-.33],[3.1,back,-.33,-.34]]){
      const l=x-.058,r=x+.058;
      quad([l,ya,a],[l,yb,b],[r,yb,b],[r,ya,a],dark);
      for(const side of [-1,1]){
        const e=side<0?l:r;
        const face:V[]=[[e,-1.225,a],[e,ya,a],[e,yb,b],[e,-1.225,b]];
        if(side<0)face.reverse();
        quad(face[0],face[1],face[2],face[3],steel);
      }
    }
  }
  const g=paint.mesh(painted).geometry;
  g.userData.paintVertices=true;
  const model=mesh(g,'#ffffff',0,0,0);
  model.name='Market Street station entrance canopy';
  model.userData.entrance=id;model.userData.station='Embarcadero';model.userData.street=site.name;
  return true;
}
