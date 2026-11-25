import * as THREE from 'three';
import {medianGrade,westMarketGround} from './curb-survey.ts';

type StoneMesh=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number,parent:THREE.Group)=>THREE.Mesh;
const metre=.06;
// Centers read from the rectified 2024 city orthophoto, from Mission toward Washington.
// Seven south of the crossing and ten north. Space at the crossing is intentional.
const centers=[
  [6757,867],[6826,891],[6895,915],[6964,933],[7033,948],[7102,962],[7172,970],
  [7404,980],[7481,976],[7557,970],[7627,960],[7696,948],[7765,933],[7833,915],
  [7902,896],[7972,876],[8040,856],
];
const plate=(u:number,v:number)=>({x:-56+u/132,z:2-v/132});

// The photographed stone meets the pavement in a small flat disk. Terminate the
// sphere there so its shadow also reaches its foot. The shared vertex tint gives
// a little grain and darker weathering underneath without a texture or another draw.
function dressedStone(){
  const buried=.06,visible=1-buried;
  const shape=new THREE.SphereGeometry(.5,16,9,0,Math.PI*2,0,Math.acos(2*buried-1));
  const pos=shape.attributes.position,tints:number[]=[];
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const h=(y+.5-buried)/visible;
    const grain=.02*Math.sin(26*x+19*y+11*z)*Math.sin(13*y-15*z);
    const stone=.91+.09*THREE.MathUtils.smoothstep(h,0,.4)+grain;
    tints.push(stone,stone*.997,stone*.99);pos.setY(i,h);
  }
  shape.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));
  shape.userData.paintVertices=true;
  return shape;
}

export function addMarketStoneBollards(mesh:StoneMesh,root:THREE.Group){
  const shared=dressedStone(),box=new THREE.BoxGeometry();
  const row=new THREE.Group();row.name='Harry Bridges Plaza stone bollards';root.add(row);
  for(const [u,v] of centers){
    const {x,z}=plate(u,v);
    const ball=mesh(shared,'#a8aaa3',x,medianGrade(x,z),z,row);
    ball.scale.set(.92*metre,.87*metre,.92*metre);
  }
  // The two bigger stones stand on their own square blocks on the western walk.
  // The LiDAR heights are relative to the adjacent sloping pedestrian passage.
  for(const [u,v,shoulder,crown] of [[7157.1,1147,1.23,2.30],[7335,1174.3,1.25,2.26]]){
    const {x,z}=plate(u,v),plinth=new THREE.Group();
    plinth.name='Market Street gateway plinth';plinth.position.set(x,westMarketGround(x,z)+.00035,z);
    plinth.rotation.y=.155;root.add(plinth);
    const top=shoulder*metre,sleeve=.013;
    const side=mesh(box,'#aaa99e',0,(top-sleeve)/2,0,plinth);
    side.scale.set(1.94*metre,top+sleeve,1.94*metre);
    const ball=mesh(shared,'#b5b5a8',0,top,0,plinth);
    ball.scale.set(1.14*metre,(crown-shoulder)*metre,1.14*metre);
  }
}
