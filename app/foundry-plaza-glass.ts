import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Wall=(s:number,h:number,d?:number)=>FacadePoint;
type Light=Map<number,[number,number,number]>;

// The two short walls meet at a re-entrant corner. Offset the joint along
// both tangents so each recessed layer meets its neighbor at the same point.
export function addFoundryPlazaGlass(f:FacadePanels,at:Wall,length:number,height:number,
  joinsAtStart:boolean,south:boolean,light:Light){
  const columns=Math.max(1,Math.round(length/3.04)),pitch=length/columns;
  const lobby=8.15,shop=-3.05,inner=-.68,shaft='#a3aeaa',trim='#7d9799';
  function along(s:number,d:number){
    if(s===0&&joinsAtStart)return d;
    if(s===length&&!joinsAtStart)return s-d;
    return s;
  }
  const vertex=(s:number,y:number,d:number)=>at(along(s,d),y,d);
  // Sample opposite corners independently to keep the glass from becoming
  // uniformly luminous. Intensities are interpretations of the dated dusk photo.
  function pane(a:number,b:number,lo:number,hi:number,d:number,color:string,glow=0,warm=true){
    const n=f.positions.length/3;
    f.quad(vertex(a,lo,d),vertex(b,lo,d),vertex(b,hi,d),vertex(a,hi,d),color);
    if(glow)for(let j=0;j<4;j++){
      const k=glow*[.52,.62,1,.84][j];
      light.set(n+j,[Math.round(k*(warm?196:126)),Math.round(k*(warm?150:163)),Math.round(k*(warm?83:174))]);
    }
  }
  function underside(a:number,b:number,d0:number,d1:number,glow:number){
    const n=f.positions.length/3;
    f.quad(vertex(a,lobby,d0),vertex(b,lobby,d0),vertex(b,lobby,d1),vertex(a,lobby,d1),'#a4a49a');
    for(let j=0;j<4;j++){
      const k=73*glow*(j<2?1:.44);
      light.set(n+j,[Math.round(k),Math.round(.77*k),Math.round(.48*k)]);
    }
  }
  // A real recess gives the storefront parallax when the camera turns.
  const end=joinsAtStart?length:0, jamb=(h:number,d:number)=>at(end,h,d);
  const side=[jamb(0,0),jamb(0,shop),jamb(lobby,shop),jamb(lobby,0)] as FacadePoint[];
  if(joinsAtStart)side.reverse();
  f.quad(side[0],side[1],side[2],side[3],'#898f88');
  for(let i=0;i<columns;i++){
    const a=i*pitch,b=(i+1)*pitch,center=a+pitch*.5;
    const glow=(south?.80:.41)*(.85+.15*Math.cos(i*2.7));
    // Recess paired doors within the straight plaza storefront. The leasing
    // plan locates entrances. Leaf widths and the setback are fitted details.
    const entrance=i===Math.floor(columns/2);
    if(entrance){
      const l=center-.96,r=center+.96,depth=shop-.70;
      pane(a,l,0,2.52,shop,'#62716e',glow*.34);
      pane(r,b,0,2.52,shop,'#62716e',glow*.34);
      f.quad(at(l,0,shop),at(l,0,depth),at(l,2.52,depth),at(l,2.52,shop),'#889895');
      f.quad(at(r,0,depth),at(r,0,shop),at(r,2.52,shop),at(r,2.52,depth),'#889895');
      f.quad(at(l,2.52,depth),at(r,2.52,depth),at(r,2.52,shop),at(l,2.52,shop),'#929389');
      f.quad(at(l,.023,shop),at(r,.023,shop),at(r,.023,depth),at(l,.023,depth),'#918e80');
      for(const [start,end] of [[l,center],[center,r]]){
        pane(start,end,.023,.17,depth,'#676f6a');
        pane(start,end,.17,2.52,depth,'#456160',glow*.23);
      }
      pane(center-.03,center+.03,.17,2.52,depth+.024,'#87918b');
      for(const offset of [-.17,.17])pane(center+offset-.02,center+offset+.02,.88,1.22,depth+.08,'#bbb8a5');
    }else{
      pane(a,b,0,.28,shop,'#626864');
      pane(a,b,.28,2.52,shop,i%3===1?'#696e63':'#657471',glow*.37);
    }
    pane(a,b,2.52,2.64,shop,trim);
    pane(a,b,2.64,5.35,shop,'#64827e',glow*.86);
    pane(a,b,5.35,5.48,shop,trim);
    pane(a,b,5.48,lobby,shop,'#738b84',glow*.79);
    pane(center-.05,center+.05,entrance?2.64:.28,lobby,shop+.055,'#62716b');
    underside(a,b,shop,-1.52,glow);underside(a,b,-1.52,0,glow*.63);
    const x=center-.055;
    f.quad(at(x,lobby-.018,-1.7),at(x+.11,lobby-.018,-1.7),at(x+.11,lobby-.018,-1.55),at(x,lobby-.018,-1.55),'#dfdac2');
    for(let j=f.positions.length/3-4;j<f.positions.length/3;j++)light.set(j,[178,148,98]);
    // One physical shaft per registered bay. The direction reverses on the
    // return; keep the end column approximately half a metre from the wing.
    const col=south&&!joinsAtStart?.69+i*3.04:joinsAtStart?b-.61:a+.61;
    for(let j=0;j<8;j++){
      const aa=j*Math.PI/4,bb=(j+1)*Math.PI/4;
      const ring=(angle:number,h:number)=>at(col+.23*Math.cos(angle),h,-.15+.23*Math.sin(angle));
      const first=f.positions.length/3;
      f.quad(ring(aa,0),ring(aa,lobby),ring(bb,lobby),ring(bb,0),shaft);
      for(const [index,angle,high] of [[0,aa,0],[1,aa,1],[2,bb,1],[3,bb,0]]){
        const k=glow*(.23+.77*Math.max(0,-Math.sin(angle)))*(high?39:21);
        light.set(first+index,[Math.round(k),Math.round(k*.77),Math.round(k*.46)]);
      }
    }
    for(let floor=0;floor<5;floor++){
      const lo=lobby+(height-lobby)*floor/5,hi=lobby+(height-lobby)*(floor+1)/5;
      const occupied=(floor*3+Math.floor(i/3)+(joinsAtStart?1:0)+(south?2:0))%5;
      const intensity=occupied<2?(south?.78:.40):occupied===3?.105:.025;
      pane(a,b,lo,lo+.36,inner,'#557a7b');
      pane(a,b,lo+.36,hi-.97,inner,['#527b80','#53777d','#638487','#4e707a'][(i+floor)%4],intensity,occupied!==3);
      pane(a,b,hi-.97,hi-.86,inner,trim);
      pane(a,b,hi-.86,hi,inner,'#779295',intensity*.86,occupied!==3);
    }
    // Outer fittings and the rear glass are separated by the wall cavity.
    // No alpha-sorted sheet, second material or per-window light is needed.
    pane(center-.047,center+.047,lobby,height,-.12,'#adbdbc');
    for(let floor=0;floor<5;floor++){
      const y=lobby+(height-lobby)*(floor+.48)/5;
      pane(center-.18,center+.18,y-.065,y+.065,.01,'#a8b6b3');
    }
  }
  // The outer screen reads blue-green even when offices behind it are lit.
  // Continuous rails take two triangles each along the entire return.
  for(let k=1;k<15;k++){
    const level=lobby+(height-lobby)*k/15;
    pane(0,length,level-.027,level+.027,-.075,k%3?'#83a6a7':'#639293');
  }
  pane(0,length,lobby,lobby+.18,.01,'#71928f');
  pane(0,length,height-.20,height,.01,'#9eafaf');
}

// Bake the contribution of the two glazed returns onto the actual stone and
// foliage vertices. The 405 evening photograph shows the interior lighting
// fading across the plaza. No photometric measurements survive in the plan.
export function bakeFoundryPlazaSpill(f:FacadePanels,first:number,south:boolean,light:Uint8Array,
  plateOrigin:FacadePoint){
  const tangentX=.0012973094,tangentZ=.0084728164;
  const acrossX=-.0084729829,acrossZ=.001296584;
  const determinant=tangentX*acrossZ-acrossX*tangentZ;
  const turnV=south?466:31,outerV=south?311:132,outerU=south?-552:-542;
  for(let j=first*3;j<f.positions.length;j+=3){
    const x=f.positions[j]-plateOrigin[0],z=f.positions[j+2]-plateOrigin[2];
    const u=(x*acrossZ-z*acrossX)/determinant,v=(z*tangentX-x*tangentZ)/determinant;
    const h=(f.positions[j+1]-plateOrigin[1])/.06;
    const a=Math.hypot(u+394,v-Math.max(Math.min(turnV,outerV),Math.min(Math.max(turnV,outerV),v)))/7;
    const b=Math.hypot(v-turnV,u-Math.max(outerU,Math.min(-394,u)))/7;
    const facing=Math.exp(-a/6.7)+Math.exp(-b/6.7);
    const relativeHeight=h>6?Math.exp(-(h-6)/7):1;
    const k=(south?76:43)*facing*relativeHeight;
    // Use the surface pigment for reflected light. The warm floor light on
    // pale granite has a different color from the same light on green leaves.
    light[j]=Math.min(255,Math.round(k*Math.sqrt(f.colors[j])));
    light[j+1]=Math.min(255,Math.round(k*.82*Math.sqrt(f.colors[j+1])));
    light[j+2]=Math.min(255,Math.round(k*.54*Math.sqrt(f.colors[j+2])));
  }
}
