import * as THREE from 'three';

// Dubuffet's 22-foot, cut stainless-steel figure. The overlapping plates, open
// crown and separate shoes follow the Friends of Embarcadero Plaza site views.
type Plate=[outline:number[],depth:number,fold:number,tone:number];
const plates:Plate[]=[
  // Boots and the split, pleated skirt.
  [[348,919,357,865,381,841,404,856,411,925,393,934,359,931],15,12,2],
  [[436,928,431,880,450,839,476,846,497,879,493,915,477,934],31,-18,1],
  [[272,796,280,701,301,663,328,627,355,606,370,639,370,769,335,810,322,849,298,834],8,-28,2],
  [[287,703,280,679,298,636,317,625,333,649,340,676,316,700],-1,16,0],
  [[260,784,275,748,296,705,316,710,321,738,308,762,313,798,288,814,269,809],-20,21,1],
  [[321,687,338,630,379,600,420,584,449,598,458,652,442,707,461,748,445,789,435,865,427,879,382,874,358,857,347,819,326,812,338,764],-4,-16,1],
  [[351,780,364,724,390,699,398,675,385,648,407,629,435,647,430,693,400,718,383,749,431,718,453,719,458,747,403,755,394,769,436,772,433,817,366,812],-18,12,0],
  [[434,843,441,775,427,744,421,691,437,653,474,641,503,650,514,674,504,706,520,755,504,776,509,821,486,796,483,851,459,858],3,32,3],
  [[467,751,469,704,480,690,504,699,507,722,498,745,485,756],-20,-12,2],
  // Separate angular shoulder and sleeve plates, twisted around the central body.
  [[259,578,274,553,294,558,307,536,331,527,367,549,382,606,352,648,322,629,309,615,299,636,267,616],3,37,3],
  [[229,486,231,470,251,443,278,425,297,428,298,447,320,431,332,441,344,411,379,422,361,476,335,512,325,544,301,533,282,523,274,490,259,485,233,496],2,-32,1],
  [[281,467,289,454,337,460,347,476,337,482,290,475],-22,6,2],
  [[329,551,343,508,359,474,374,469,402,483,412,516,403,557,388,573,352,561],-29,23,1],
  [[337,424,356,408,388,409,412,423,437,414,469,416,485,455,474,501,459,541,465,574,434,599,399,612,381,596,401,561,406,518,396,490,359,467],10,-39,3],
  [[459,504,465,470,479,452,500,469,514,506,538,521,558,499,574,484,596,473,627,470,631,489,623,526,615,540,577,543,566,562,579,583,554,606,532,588,527,563,501,568,477,552],18,-21,2],
  [[459,431,466,400,482,397,505,406,519,400,527,387,520,381,527,363,540,352,556,362,569,387,584,393,589,405,577,422,574,473,550,476,543,517,514,523,497,508,494,478,478,456],-16,35,3],
  [[502,569,520,560,541,573,558,599,565,615,546,627,523,617,498,609],-30,-15,0],
  [[381,634,391,599,410,582,438,591,452,613,450,645,425,653,402,650],-34,8,2],
  // Neck, hat brim, raised tabs and the face's cut eyes, nose and mouth.
  [[371,437,383,389,389,360,443,357,468,381,460,417,447,432,415,449],15,21,3],
  [[281,258,293,237,302,216,337,263,343,280,349,250,359,220,368,216,383,232,391,251,421,237,430,228,428,186,444,178,467,175,471,204,452,214,452,228,469,262,475,227,511,234,512,253,520,255,523,209,529,205,561,221,565,234,557,283,541,289,531,289,529,296,553,302,558,311,552,326,544,334,513,325,506,338,497,323,485,361,468,368,380,361,352,363,349,333,342,327,318,359,285,362,285,312,306,322,325,332,332,293,330,284],7,-25,2],
  [[352,327,351,277,359,240,369,219,380,233,388,253,381,279,366,327],-14,-7,3],
  [[378,254,422,244,442,229,452,229,466,263,494,265,516,254,508,280,497,308,490,317,485,290,436,278,378,269],-13,10,1],
  [[375,350,379,313,397,296,419,285,447,291,467,311,472,346,465,366,456,393,444,406,422,412,398,403,385,395],-22,-17,1],
  [[387,330,392,318,404,309,415,309,413,329,406,345,396,346],-34,8,0],
  [[421,336,423,311,440,299,457,305,463,321,449,335,432,342],-37,-8,3],
  [[395,385,398,356,407,342,421,344,429,352,422,371,411,394,402,399],-40,15,2],
  [[423,388,427,366,439,355,455,354,452,375,441,390],-37,-6,3],
];
const silver=['#c9cabd','#aebbb9','#839496','#59696b'];
export function laChiffonniere(){
  const group=new THREE.Group();group.name='La Chiffonnière';
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(.080,.079,.016,24),new THREE.MeshStandardMaterial({color:'#938b78'}));
  plinth.name='Circular stone plinth';plinth.position.y=.008;group.add(plinth);
  const positions:number[]=[],colors:number[]=[],indices:number[]=[],scale=6.7056*.06/(934-175);
  const ink=new THREE.Color('#30393b');
  let reflection:(p:THREE.Vector3)=>number=()=>1;
  const vertices=new Map<string,number>();
  const triangle=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,color:THREE.Color)=>{
    for(const point of [a,b,c]){
      const key=[Math.fround(point.x),Math.fround(point.y),Math.fround(point.z),color.r,color.g,color.b].join(',');
      let index=vertices.get(key);
      if(index===undefined){
        index=positions.length/3;vertices.set(key,index);positions.push(point.x,point.y,point.z);const light=color===ink?1:reflection(point);colors.push(color.r*light,color.g*light,color.b*light);
      }
      indices.push(index);
    }
  };
  for(const [outline,depth,fold,tone] of plates){
    vertices.clear();
    const ring:THREE.Vector2[]=[];
    for(let i=0;i<outline.length;i+=2)ring.push(new THREE.Vector2(outline[i],outline[i+1]));
    if(THREE.ShapeUtils.isClockWise(ring))ring.reverse();
    const bounds=new THREE.Box2().setFromPoints(ring),mid=bounds.getCenter(new THREE.Vector2()),size=bounds.getSize(new THREE.Vector2());
    const pigment=new THREE.Color(silver[tone]);
    // A broad silver wash follows each folded plate through the diffuse city batch.
    reflection=p=>1+Math.sign(fold)*.55*((415-mid.x)-p.x/scale)/size.x+.24*(p.y/scale-(934-mid.y))/size.y;
    const point=(p:THREE.Vector2,back:boolean)=>{
      const u=p.x,v=p.y;
      const z=depth+fold*(u-mid.x)/size.x+fold*.25*(v-mid.y)/size.y;
      return new THREE.Vector3((415-u)*scale,(934-v)*scale,(z*1.62+(back?1.45:0))*scale);
    };
    for(let i=0;i<ring.length;i++){
      const p=ring[i],q=ring[(i+1)%ring.length],a=point(p,false),b=point(q,false),c=point(q,true),d=point(p,true);
      triangle(a,b,c,ink);triangle(a,c,d,ink);
    }
    vertices.clear();
    const paint=(polygon:THREE.Vector2[],color:THREE.Color)=>{
      for(let i=2;i<polygon.length;i++){
        const [a,b,c]=[polygon[0],polygon[i-1],polygon[i]];
        triangle(point(a,true),point(b,true),point(c,true),color);
        triangle(point(a,false),point(c,false),point(b,false),color);
      }
    };
    for(const indices of THREE.ShapeUtils.triangulateShape(ring,[])){
      let fill=indices.map(i=>ring[i]);
      for(let edge=0;edge<3;edge++){
        const i=indices[edge],j=indices[(edge+1)%3];
        if((i+1)%ring.length!==j)continue;
        // Partition the sheet along its actual cut edge. Even the concave crown
        // tabs have a single color at any point on the front or back plane.
        const start=ring[i],line=ring[j].clone().sub(start).normalize();
        const distance=(p:THREE.Vector2)=>line.x*(p.y-start.y)-line.y*(p.x-start.x)-3;
        const band:THREE.Vector2[]=[],inside:THREE.Vector2[]=[];
        for(let k=0;k<fill.length;k++){
          const a=fill[k],b=fill[(k+1)%fill.length],da=distance(a),db=distance(b);
          (da<0?band:inside).push(a);
          if((da<0)!==(db<0)){
            const cut=a.clone().lerp(b,da/(da-db));band.push(cut);inside.push(cut);
          }
        }
        paint(band,ink);fill=inside;
      }
      paint(fill,pigment);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
  const sheet=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.62}));
  sheet.name='Cut steel figure';sheet.position.y=.016;group.add(sheet);
  return group;
}
