// Adjacent front-plaza counters. Each visitor stays on one stretch of the
// apron, clear of the entrance and vendors standing behind the tables.
const visits=[
  {left:-4.88,right:-4.41,firstLook:8,secondLook:12,walk:9,offset:2},
  {left:-3.17,right:-2.70,firstLook:13,secondLook:9,walk:10,offset:17},
  {left:1.94,right:2.41,firstLook:11,secondLook:14,walk:8.8,offset:26},
  {left:3.65,right:4.12,firstLook:10,secondLook:8,walk:9.5,offset:5},
] as const;

export const frontMarketShopperCount=visits.length;

// Stagger visits once tables and merchandise are in place. The same reversible
// thresholds empty each aisle before the stalls are packed away.
function shopperCount(progress:number,capacity:number){
  return Math.max(0,Math.min(capacity,Math.floor((progress-.80)/.17*capacity)));
}

export function marketShopperAttendance(frontStart:number,rearSlots:readonly number[]){
  const frontSlots=frontStart<0?[]:visits.map((_,i)=>frontStart+i);
  const absent=new Set<number>();
  let lastFront=-1,lastRear=-1;
  return {
    absent,
    update({front,rear}:{front:number;rear:number}){
      const frontCount=shopperCount(front,frontSlots.length),rearCount=shopperCount(rear,rearSlots.length);
      if(frontCount===lastFront&&rearCount===lastRear)return false;
      lastFront=frontCount;lastRear=rearCount;
      absent.clear();
      for(let i=frontCount;i<frontSlots.length;i++)absent.add(frontSlots[i]);
      for(let i=rearCount;i<rearSlots.length;i++)absent.add(rearSlots[i]);
      return true;
    },
  };
}

export function frontMarketShopperPose(time:number,index:number){
  const {left,right,firstLook,secondLook,walk,offset}=visits[index];
  const period=firstLook+secondLook+walk*2;
  const phase=((time+offset)%period+period)%period;
  const stopZ=-1.944,y=.031,faceCounter=Math.PI/2;
  if(phase<firstLook)return {x:left,y,z:stopZ,heading:faceCounter,standing:true};
  const returning=phase>=firstLook+walk;
  if(returning&&phase<firstLook+walk+secondLook)
    return {x:right,y,z:stopZ,heading:faceCounter,standing:true};

  const t=(phase-(returning?firstLook+walk+secondLook:firstLook))/walk;
  // Ease to a stop, stepping out into the aisle between adjacent counters.
  const u=(1-Math.cos(Math.PI*t))/2,dx=returning?left-right:right-left;
  const bow=returning ? .058 : .081,sine=Math.sin(Math.PI*u);
  const x=(returning?right:left)+dx*u,z=stopZ-bow*sine*sine;
  const tangent=Math.atan2(-bow*Math.PI*Math.sin(2*Math.PI*u),dx);
  const turn=Math.min(t/.16,(1-t)/.16,1);
  const angle=tangent-faceCounter;
  const heading=faceCounter+Math.atan2(Math.sin(angle),Math.cos(angle))*turn*turn*(3-2*turn);
  return {x,y,z,heading,standing:false};
}
