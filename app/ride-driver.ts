import {Vector3} from 'three';
import type {CabGeometry,CabPoint,RideInteriorMode} from './ride-interior.ts';

// Baked into the vehicle so turning the viewer's head leaves the operator at the controls.
export function addSeatedDriver(g:CabGeometry,mode:RideInteriorMode){
  const tram=mode==='tram';
  const shirt=tram?'#495e69':'#a15943',cuff=tram?'#a2adb0':'#be8061';
  const skin=tram?'#a97852':'#b88465',hair=tram?'#413c37':'#51413a';
  const light=tram?.62:0;
  function ring(x:number,y:number,z:number,w:number,d:number):CabPoint[]{
    return Array.from({length:10},(_,i)=>{
      const a=2*Math.PI*i/10;
      return [x+Math.cos(a)*w,y,z+Math.sin(a)*d];
    });
  }
  function band(a:CabPoint[],b:CabPoint[],color:string){
    for(let i=0;i<a.length;i++){
      const j=(i+1)%a.length;
      g.panel(a[i],b[i],b[j],a[j],color,light);
    }
  }
  function lid(points:CabPoint[],color:string){
    for(let i=1;i<points.length-1;i+=2)g.panel(points[0],points[i],points[i+1],points[Math.min(i+2,points.length-1)],color,light);
  }
  function limb(a:CabPoint,b:CabPoint,r:number,end:number,color:string){
    const axis=new Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize();
    const u=new Vector3().crossVectors(axis,Math.abs(axis.x)<.85?new Vector3(1,0,0):new Vector3(0,1,0)).normalize();
    const v=new Vector3().crossVectors(axis,u);
    function rim(at:CabPoint,radius:number):CabPoint[]{
      return Array.from({length:7},(_,i)=>{
        const theta=i*2*Math.PI/7,p=radius*Math.cos(theta),q=radius*Math.sin(theta);
        return [at[0]+p*u.x+q*v.x,at[1]+p*u.y+q*v.y,at[2]+p*u.z+q*v.z];
      });
    }
    const tip=rim(b,end);band(rim(a,r),tip,color);lid(tip,color);
  }
  if(tram){
    g.seat(-.31,.26,.27,-.69,-.27,'#62574a');
    // The PCC is pedal-controlled. Its operator has an instrument shelf and a side console.
    g.level(-.52,-.51,-.28,-.55,-.10,'#52605c');
    g.side(-.28,-1.15,-.52,-.55,-.10,'#485550');
  }
  const hips=ring(-.03,-.68,.025,.165,.15),waist=ring(-.025,-.51,.052,.165,.126);
  const shoulders=ring(-.033,-.236,.029,.218,.128),collar=ring(-.03,-.172,.012,.084,.085);
  band(hips,waist,shirt);band(waist,shoulders,shirt);band(shoulders,collar,shirt);
  const jaw=ring(-.031,-.134,-.027,.071,.087),cheeks=ring(-.032,-.050,-.029,.098,.111);
  const brow=ring(-.031,.037,-.019,.100,.107),crown=ring(-.029,.103,.001,.076,.089);
  band(collar,jaw,skin);band(jaw,cheeks,skin);
  for(let i=0;i<cheeks.length;i++){
    const j=(i+1)%cheeks.length;
    g.panel(cheeks[i],brow[i],brow[j],cheeks[j],i<5?hair:skin,light);
  }
  band(brow,crown,hair);lid(crown,hair);
  g.panel([-.048,.005,-.131],[-.031,-.059,-.159],[-.015,-.049,-.131],[-.021,.015,-.127],skin,light);
  for(const side of [-1,1]){
    const x=-.032+side*.095;
    g.panel([x,.016,-.026],[x,-.064,-.037],[x+side*.011,-.051,-.006],[x+side*.009,.004,.006],skin,light);
  }
  if(tram){
    const hat=ring(-.031,.058,-.019,.112,.120),top=ring(-.033,.126,-.005,.102,.101);
    band(hat,top,'#303f48');lid(top,'#3f5058');
    g.panel([-.127,.064,-.076],[.061,.064,-.076],[.046,.054,-.196],[-.106,.054,-.196],'#344047',light);
  }
  for(const side of [-1,1]){
    const shoulder:CabPoint=[-.032+side*.173,-.268,.003];
    const elbow:CabPoint=[-.030+side*.224,-.45,-.150];
    const grip:CabPoint=tram?(side<0?[-.36,-.503,-.365]:[.124,-.531,-.346]):[-.027+side*.156,-.330,-.608];
    const wrist:CabPoint=[grip[0]+side*.014,grip[1]-.016,grip[2]+.065];
    limb(shoulder,elbow,.083,.061,shirt);limb(elbow,wrist,.065,.040,shirt);
    limb(wrist,[wrist[0],wrist[1],wrist[2]-.026],.044,.042,cuff);
    limb([wrist[0],wrist[1],wrist[2]-.019],grip,.041,.036,skin);
    const knee:CabPoint=[-.02+side*.116,-.675,-.358];
    const ankle:CabPoint=[knee[0]+side*.019,tram?-1.05:-.943,-.47];
    limb([-.025+side*.087,-.656,.00],knee,.099,.082,'#4a5355');
    limb(knee,ankle,.077,.049,'#444e51');
    limb(ankle,[ankle[0],ankle[1]-.050,ankle[2]-.132],.055,.045,'#45413d');
  }
}
