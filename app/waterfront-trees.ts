import * as THREE from 'three';

type PlantMesh = (geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => THREE.Mesh;
type Point = THREE.Vector3;

const up = new THREE.Vector3(0, 1, 0);
const bark = ['#7f705a', '#88785f', '#746553', '#897764'];
const foliagePalettes = [
  ['#4e715b', '#648766', '#799369', '#a0ae77'],
  ['#547464', '#6e8b70', '#879b75', '#abb483'],
  ['#4b6c64', '#648977', '#7e9c81', '#a1ad79'],
].map(palette => palette.map(color => new THREE.Color(color)));
const palmPalette = ['#546f56', '#668363', '#8d9b68', '#a6ad77'].map(color => new THREE.Color(color));
function seeded(id: number) {
  return (offset: number) => {
    const value = Math.sin(id * .173 + offset * 59.313) * 43758.5453;
    return value - Math.floor(value);
  };
}

function limb(mesh: PlantMesh, from: Point, to: Point, radius: number, color: string, tipWidth = .57) {
  const delta = to.clone().sub(from), middle = from.clone().lerp(to, .5);
  const branch = mesh(new THREE.CylinderGeometry(radius * tipWidth, radius, delta.length() + radius * .28, 6),
    color, middle.x, middle.y, middle.z);
  branch.quaternion.setFromUnitVectors(up, delta.normalize());
}

class Foliage {
  private positions: number[] = [];
  private colors: number[] = [];

  triangle(a: Point, b: Point, c: Point, ac: THREE.Color, bc: THREE.Color, cc: THREE.Color) {
    // The city bake uses single-sided faces. Distinct backs keep the thin paint
    // surfaces readable from all orbit headings and preserve the folded normals.
    this.positions.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z,c.x,c.y,c.z,b.x,b.y,b.z,a.x,a.y,a.z);
    this.colors.push(ac.r,ac.g,ac.b,bc.r,bc.g,bc.b,cc.r,cc.g,cc.b,cc.r,cc.g,cc.b,bc.r,bc.g,bc.b,ac.r,ac.g,ac.b);
  }

  // Closed, softly faceted crowns keep branches and leaves joined in profile.
  lobe(at:Point,rx:number,ry:number,rz:number,angle:number,tones:THREE.Color[],seed:number){
    const latitude=[-.98,-.62,0,.61,.98],rings:Point[][]=[];
    for(let j=0;j<latitude.length;j++){
      const y=latitude[j],radius=Math.sqrt(1-y*y),ring:Point[]=[];
      for(let i=0;i<9;i++){
        const a=i*2*Math.PI/9+(j%2)*.16,n=1+.12*Math.sin(seed+2.9*i+j*.85);
        const dx=Math.cos(a)*rx*radius*n,dz=Math.sin(a)*rz*radius*n;
        ring.push(at.clone().add(new THREE.Vector3(dx*Math.cos(angle)-dz*Math.sin(angle),
          ry*y,dz*Math.cos(angle)+dx*Math.sin(angle))));
      }
      rings.push(ring);
    }
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<9;i++){
      const n=(i+1)%9,lo=tones[Math.min(2,j)],hi=tones[Math.min(3,j+1)];
      this.triangle(rings[j][i],rings[j+1][i],rings[j][n],lo,hi,lo);
      this.triangle(rings[j][n],rings[j+1][i],rings[j+1][n],lo,hi,hi);
    }
    for(const j of [0,4]){
      const pole=at.clone().addScaledVector(up,j===0?-ry:ry),color=tones[j===0?0:3];
      for(let i=0;i<9;i++)this.triangle(rings[j][i],rings[j][(i+1)%9],pole,color,color,color);
    }
  }

  mesh(mesh: PlantMesh) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.userData.paintVertices = true;
    geometry.computeVertexNormals();
    mesh(geometry, '#ffffff', 0, 0, 0);
  }
}

/** Staggered forks support irregular layered washes, with gaps through the crown. */
export function waterfrontTree(mesh: PlantMesh, x: number, y: number, z: number, id: number, height: number, species = '') {
  const fraction = seeded(id), narrow = /Populus|poplar|Lombard|Ginkgo/i.test(species);
  const trunk = height * (narrow ? .025 : .031), spread = height * (narrow ? .22 : .34 + .06*fraction(2));
  const axis = fraction(1)*Math.PI*2, lean = height*(.038 + .080*fraction(3));
  const treeBark = bark[Math.floor(fraction(74)*bark.length)];
  const tones = foliagePalettes[Math.floor(fraction(4)*foliagePalettes.length)];
  const base = new THREE.Vector3(x,y,z);
  const fork = new THREE.Vector3(x+Math.cos(axis)*lean*.52,y+height*.46,z+Math.sin(axis)*lean*.52);
  const joint = new THREE.Vector3(x+Math.cos(axis+.24)*lean,y+height*.68,z+Math.sin(axis+.24)*lean);
  const leader = new THREE.Vector3(x+Math.cos(axis-.32)*lean*1.64,y+height*.94,z+Math.sin(axis-.32)*lean*1.64);
  limb(mesh,base,fork,trunk,treeBark,.73);
  limb(mesh,fork,joint,trunk*.74,treeBark,.65);
  limb(mesh,joint,leader,trunk*.49,treeBark,.21);

  const canopy = new Foliage();
  for (let i = 0; i < 5; i++) {
    const angle = axis+i*2.39996+.60*(fraction(i+7)-.5), radial = spread*(.46+.32*fraction(i+9));
    const start = fork.clone().lerp(joint,.06+i*.18);
    const end = new THREE.Vector3(start.x+Math.cos(angle)*radial,
      y+height*((narrow?.59:.66)+.041*i+.105*fraction(i+12)),start.z+Math.sin(angle)*radial);
    const elbow = start.clone().lerp(end,.56).addScaledVector(up,-height*(.018+.04*fraction(i+13)));
    limb(mesh,start,elbow,trunk*(.44-.045*i),treeBark,.62);
    limb(mesh,elbow,end,trunk*(.26-.025*i),treeBark,.22);
    const size = spread*(.62+.28*fraction(i+35));
    canopy.lobe(end,size,size*.78,size*.85,angle,tones,100+i*271);
    if (!narrow && i===1) {
      const twig = end.clone().add(new THREE.Vector3(Math.sin(angle)*size*.27,-height*.075,-Math.cos(angle)*size*.27));
      limb(mesh,elbow,twig,trunk*.14,treeBark,.29);
      canopy.lobe(twig,size*.72,size*.60,size*.66,angle-.7,tones,1421);
    }
  }
  canopy.lobe(leader,spread*.59,height*.10,spread*.56,axis,tones,1701);
  canopy.mesh(mesh);
}

/** Date-palm leaflets peel away from arched, drooping rachises. */
export function waterfrontPalm(mesh: PlantMesh, x: number, y: number, z: number, id: number, height: number, radius: number, measuredTrunkRadius?: number) {
  const fraction = seeded(id), axis = fraction(19)*Math.PI*2;
  const lean = height*(.026+.042*fraction(8)), base = new THREE.Vector3(x,y,z);
  const top = new THREE.Vector3(x+Math.cos(axis)*lean,y+height,z+Math.sin(axis)*lean);
  const trunk = measuredTrunkRadius??Math.min(.028,height*.034);
  const joint = base.clone().lerp(top,.54).add(new THREE.Vector3(-lean*.19,0,lean*.15));
  limb(mesh,base,joint,trunk,'#8d7c61',.86);
  limb(mesh,joint,top,trunk*.88,'#a18b68',.77);
  for (let i = 0; i < 5; i++) {
    const at = top.clone().addScaledVector(up,-i*trunk*.55);
    const collar = mesh(new THREE.CylinderGeometry(trunk*(.73-i*.022),trunk*(1.04-i*.055),trunk*.38,7),
      i%2 ? '#8b795e' : '#a28b6a',at.x,at.y,at.z);
    collar.rotation.z = .13*(fraction(i)-.5);
  }

  const crown = new Foliage(), sides = [-1,1] as const;
  for (let i = 0; i < 11; i++) {
    const angle = axis+i*2.39996+(fraction(i+21)-.5)*.28;
    const outward = new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)), across = new THREE.Vector3(-outward.z,0,outward.x);
    const reach = radius*(.51+.48*fraction(i+3)), lift = radius*(.19+.16*fraction(i+27));
    const droop = radius*(.14+.32*fraction(i+44)), skew = radius*(fraction(i+60)-.5)*.35;
    const point = (t: number) => top.clone().addScaledVector(outward,reach*t)
      .addScaledVector(across,skew*t*t)
      .addScaledVector(up,lift*Math.sin(Math.PI*t)-droop*t*t + (i%3===0 ? .055 : 0));
    // One connected feather blade per frond. A shallow folded midrib and small
    // serrations describe the leaflets without scattering detached triangles.
    function edge(t:number,side:number,segment:number){
      const width=radius*(.014+.105*Math.sin(t*Math.PI)**.65)*(segment%2?.84:1);
      return point(t).addScaledVector(across,width*side).addScaledVector(up,-width*.53);
    }
    for(let j=0;j<16;j++){
      const a=j/16,b=(j+1)/16;
      for(const side of sides){
        const color=palmPalette[(i+(side===1?1:0))%3],rim=palmPalette[(i+1)%3];
        const e0=edge(a,side,j),e1=edge(b,side,j+1);
        crown.triangle(point(a),e0,e1,color,rim,rim);
        crown.triangle(point(a),e1,point(b),color,rim,color);
      }
    }
  }
  crown.mesh(mesh);
}
