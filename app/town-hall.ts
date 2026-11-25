import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9});
const brick='#a6634c', shade='#794737', stone='#ab7962', frame='#473d39';
const length=213/7, depth=72/7;
// Intersection of the surveyed Howard and Fremont walls. Local metres run
// bayward along Howard (u) and away from Howard along Fremont (v).
function point(u:number,v:number,h:number):FacadePoint{
  return [-27.880726+.00908125*u+.05931031*v,.054+.06*h,-31.426779+.05930954*u-.00907626*v];
}
function wall(u:number,v:number,tu:number,tv:number){
  return (s:number,h:number,d=0)=>point(u+tu*s+tv*d,v+tv*s-tu*d,h);
}
type Wall=ReturnType<typeof wall>;
function panel(f:FacadePanels,at:Wall,a:number,b:number,y:number,z:number,color:string,d=0){
  f.quad(at(a,y,d),at(b,y,d),at(b,z,d),at(a,z,d),color);
}
function box(f:FacadePanels,u:number,v:number,x:number,z:number,lo:number,hi:number,color:string,top:string){
  panel(f,wall(u,v,1,0),0,x-u,lo,hi,color);
  panel(f,wall(x,v,0,1),0,z-v,lo,hi,color);
  panel(f,wall(x,z,-1,0),0,x-u,lo,hi,color);
  panel(f,wall(u,z,0,-1),0,z-v,lo,hi,color);
  f.quad(point(u,v,hi),point(x,v,hi),point(x,z,hi),point(u,z,hi),top);
}
const letters:Record<string,number[][]>={
  T:[[0,1,1,1],[.5,1,.5,0]],O:[[.18,1,.82,1],[.82,1,1,.82],[1,.82,1,.18],[1,.18,.82,0],[.82,0,.18,0],[.18,0,0,.18],[0,.18,0,.82],[0,.82,.18,1]],
  W:[[0,1,.21,0],[.21,0,.5,.57],[.5,.57,.79,0],[.79,0,1,1]],N:[[0,0,0,1],[0,1,1,0],[1,0,1,1]],
  H:[[0,0,0,1],[0,.52,1,.52],[1,0,1,1]],A:[[0,0,.5,1],[.5,1,1,0],[.23,.43,.77,.43]],L:[[0,1,0,0],[0,0,1,0]],
};
function cornerSign(f:FacadePanels,at:Wall,center:number,illumination:Map<number,number>){
  const start=f.positions.length/3;
  panel(f,at,center-.43,center+.43,6.0,13.58,'#dfd5b9',.044);
  // The pale backing catches light from the pier fixtures. Keep the painted
  // letters dark and vary the spill over the height of the sign.
  [.29,.28,.20,.22].forEach((strength,i)=>illumination.set(start+i,strength));
  [...'TOWNHALL'].forEach((letter,i)=>{
    const base=12.68-i*.83-(i>=4?.30:0);
    for(const [ax,ay,bx,by] of letters[letter]){
      const x=center-.23+ax*.46,y=base+ay*.67,dx=(bx-ax)*.46,dy=(by-ay)*.67;
      const half=.042/Math.hypot(dx,dy),nx=-dy*half,ny=dx*half;
      f.quad(at(x-nx,y-ny,.07),at(x+dx-nx,y+dy-ny,.07),at(x+dx+nx,y+dy+ny,.07),at(x+nx,y+ny,.07),'#322e2a');
    }
  });
}
function awning(f:FacadePanels,at:Wall,a:number,b:number,corner?:'start'|'end'){
  // At Fremont the two roof panels share a diagonal from the brick corner
  // to the projecting hem. Both panels use the same crest and lip on that seam.
  const top=corner?4.29:4.02,lip=corner?3.85:3.52,reach=corner?1.38:1.04;
  const left=corner==='start'?a-reach:a,right=corner==='end'?b+reach:b;
  const backLeft=at(a,top),backRight=at(b,top);
  const frontLeft=at(left,lip,reach),frontRight=at(right,lip,reach);
  f.quad(frontLeft,frontRight,backRight,backLeft,'#a64842');
  panel(f,at,left,right,lip-.20,lip,'#913c38',reach);
  // Passengers can look up under the cloth. Give that side its own pigment.
  const thickness=.025;
  f.quad(at(b,top-thickness),at(right,lip-thickness,reach),at(left,lip-thickness,reach),at(a,top-thickness),'#783836');
  if(corner!=='start')f.triangle(at(a,lip,reach),backLeft,at(a,lip),'#823831');
  if(corner!=='end')f.triangle(at(b,lip),backRight,at(b,lip,reach),'#823831');
}
// The restaurant exterior photograph shows paired vertical washes centered
// on each intervening brick pier and a second fixture below the awnings.
// Store the wash on the masonry itself for the city's existing dusk pass.
function litPier(f:FacadePanels,at:Wall,a:number,b:number,illumination:Map<number,number>,bottom=0){
  const heights=[0,2.1,3.24,3.53,4.45,5.55,7.5,8.78,9.06,9.34,10.75,12.7,14.61];
  const levels=[.03,.17,.60,.15,.48,.04,.11,.82,.08,.86,.30,.14,.24];
  for(let i=0;i+1<heights.length;i++){
    if(heights[i]<bottom)continue;
    for(let col=0;col<2;col++){
      const start=f.positions.length/3,mid=(a+b)/2;
      panel(f,at,col?mid:a,col?b:mid,heights[i],heights[i+1],brick);
      const lower=levels[i],upper=levels[i+1];
      [col?lower:lower*.15,col?lower*.15:lower,col?upper*.15:upper,col?upper:upper*.15]
        .forEach((value,j)=>illumination.set(start+j,value));
    }
  }
}
// The restaurant-era short elevation had dark joinery, transom lights and
// slender round supports. The same shopfront turned into the first Howard bay.
function timberShopfront(f:FacadePanels,at:Wall,width:number,divisions:number,shortFace:boolean,illumination:Map<number,number>){
  const inset=-.13,timber='#493a31';
  panel(f,at,0,width,0,.19,'#6b5d4c',inset);
  panel(f,at,0,width,.19,.71,timber,inset);
  panel(f,at,0,width,2.52,2.69,timber,inset);
  panel(f,at,0,width,3.56,4.45,timber,inset);
  for(let i=0;i<divisions;i++){
    const a=width*i/divisions,b=width*(i+1)/divisions;
    for(const [lo,hi] of [[.71,2.52],[2.69,3.56]]){
      panel(f,at,a,a+.07,lo,hi,timber,inset);
      panel(f,at,b-.07,b,lo,hi,timber,inset);
      const start=f.positions.length/3;
      panel(f,at,a+.07,b-.07,lo,hi,lo>2?'#626159':'#444746',inset);
      const warm=(lo>2?.40:.105)*(.76+.24*Math.cos(i*2.12));
      for(let j=0;j<4;j++)illumination.set(start+j,warm*(j<2?.64:1));
    }
  }
  f.quad(at(0,4.45,inset),at(width,4.45,inset),at(width,4.45),at(0,4.45),'#544436');
  const end=shortFace?0:width;
  f.quad(at(end,0),at(end,0,inset),at(end,4.45,inset),at(end,4.45),'#544436');
  const supports=shortFace?[.17,width/2,width-.04]:[];
  const profile=[[0,.19],[.23,.19],[.30,.12],[3.17,.12],[3.38,.23],[3.54,.23]];
  for(const center of supports){
    for(let j=1;j<profile.length;j++){
      const [lo,lr]=profile[j-1],[hi,hr]=profile[j];
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
        const vertex=(h:number,r:number,angle:number)=>at(center+r*Math.cos(angle),h,r*Math.sin(angle));
        f.quad(vertex(lo,lr,a),vertex(hi,hr,a),vertex(hi,hr,b),vertex(lo,lr,b),hi>3.2?'#ac9a79':'#55443a');
      }
    }
  }
}
function frontage(f:FacadePanels,at:Wall,width:number,count:number,cornerAtStart:boolean,windows:Pane[],illumination:Map<number,number>){
  const pitch=(width-1.0)/count,inner=.48,margin=.50;
  const origin=at(0,0),out=at(0,0,1),ry=Math.atan2(out[0]-origin[0],out[2]-origin[2]);
  const endPier=margin+inner;
  const shopTop=4.45;
  panel(f,at,0,endPier,shopTop,14.61,brick);
  panel(f,at,width-endPier,width,cornerAtStart?0:shopTop,14.61,brick);
  for(let i=1;i<count;i++)litPier(f,at,margin+i*pitch-inner,margin+i*pitch+inner,illumination,cornerAtStart?0:shopTop);
  const shopWidth=cornerAtStart?margin+pitch-inner:width;
  timberShopfront(f,at,shopWidth,cornerAtStart?3:7,!cornerAtStart,illumination);
  for(const [floor,lo,hi] of [[0,.56,4.2],[1,5.45,8.70],[2,9.75,13.18]]){
    for(let bay=0;bay<count;bay++){
      const a=margin+bay*pitch+inner,b=margin+(bay+1)*pitch-inner;
      if(floor===0){
        const shop=!cornerAtStart||bay===0;
        for(const [bottom,top] of [[shop?shopTop:4.2,5.45],[8.70,9.75],[13.18,14.61]])panel(f,at,a,b,bottom,top,brick);
        if(cornerAtStart)awning(f,at,bay===0?0:a-.15,b+.15,bay===0?'start':undefined);
        if(shop)continue;
        panel(f,at,a,b,0,.56,brick);
      }
      const inset=-.22;
      // Four returns enclose the opening; the backs are individual glass
      // lights and narrow sash members with disjoint interiors.
      f.quad(at(a,lo),at(a,lo,inset),at(a,hi,inset),at(a,hi),shade);
      f.quad(at(b,lo,inset),at(b,lo),at(b,hi),at(b,hi,inset),shade);
      f.quad(at(a,lo),at(b,lo),at(b,lo,inset),at(a,lo,inset),stone);
      f.quad(at(a,hi,inset),at(b,hi,inset),at(b,hi),at(a,hi),shade);
      const rowHeight=(hi-lo)/2,cell=(b-a)/3;
      for(let i=0;i<3;i++){
        const x=a+i*cell;
        panel(f,at,x,x+.07,lo,hi,frame,inset);
        for(let j=0;j<2;j++){
          const y=lo+j*rowHeight,l=x+.07,r=x+cell-.025,bottom=y+.07,top=y+rowHeight-.025;
          panel(f,at,l,r,bottom,top,floor?'#505653':'#464b46',inset);
          panel(f,at,l,r,y,bottom,frame,inset);
          panel(f,at,l,r,top,y+rowHeight,frame,inset);
          if((bay*7+floor*5+(cornerAtStart?0:2))%4===0){
            const [wx,wy,wz]=at((l+r)/2,(top+bottom)/2,inset+.018);
            windows.push({x:wx,y:wy,z:wz,ry,w:(r-l)*.06,h:(top-bottom)*.06});
          }
        }
        panel(f,at,x+cell-.025,x+cell,lo,hi,frame,inset);
      }
    }
  }
  if(!cornerAtStart)awning(f,at,0,width,'end');
  cornerSign(f,at,cornerAtStart?.49:width-.49,illumination);
}
export function addTownHall(building:{id:number},root:THREE.Group,windows:Pane[]){
  if(building.id!==192883914)return false;
  const f=new FacadePanels(),illumination=new Map<number,number>();
  frontage(f,wall(0,0,1,0),length,7,true,windows,illumination);
  frontage(f,wall(0,depth,0,-1),depth,2,false,windows,illumination);
  const patio=wall(length,0,0,1);
  panel(f,patio,0,depth,3.5,14.61,brick);
  panel(f,patio,0,3.0,0,3.5,brick);
  panel(f,patio,depth-2.0,depth,0,3.5,brick);
  panel(f,patio,3.0,depth-2.0,0,3.5,'#444746',-.14);
  for(const s of [3.0,(depth+1)/2,depth-2.12])panel(f,patio,s,s+.12,0,3.5,frame,-.10);
  panel(f,wall(length,depth,-1,0),0,length,0,14.61,brick);
  awning(f,wall(length,0,0,1),2.05,depth-1.15);
  // Projecting masonry cornice and parapet enclose a lower flat roof.
  const cornice=f.positions.length/3;
  box(f,-.13,-.13,length+.13,depth+.13,14.61,14.97,shade,stone);
  // Uplight reaches the two street-facing cornices in the night photograph.
  // Leave the flat roof and the walls toward the neighboring building dark.
  for(const side of [0,3])for(let i=0;i<4;i++)illumination.set(cornice+4*side+i,i<2?.23:.15);
  const rim=.47,over=.32,high=15.39;
  box(f,-over,-over,length+over,rim,14.97,high,brick,stone);
  box(f,-over,depth-rim,length+over,depth+over,14.97,high,brick,stone);
  box(f,-over,rim,rim,depth-rim,14.97,high,brick,stone);
  box(f,length-rim,rim,length+over,depth-rim,14.97,high,brick,stone);
  box(f,4.15,7.25,18.86,9.49,14.97,17.17,'#998c7d','#aaa49a');
  box(f,21.57,5.14,25.43,8.28,14.97,19.05,'#958778','#aca49a');
  const mesh=f.mesh(material),light=new Uint8Array(f.positions.length);
  for(const [vertex,strength] of illumination){
    light[vertex*3]=Math.round(196*strength);
    light[vertex*3+1]=Math.round(112*strength);
    light[vertex*3+2]=Math.round(50*strength);
  }
  mesh.geometry.setAttribute('signLight',new THREE.Uint8BufferAttribute(light,3,true));
  mesh.name='Marine Electric Building / former Town Hall, 342 Howard';root.add(mesh);
  return true;
}
