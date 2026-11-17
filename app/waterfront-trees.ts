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
const blotOutline = [
  [-.56,.03], [-.48,-.29], [-.22,-.55], [.13,-.51], [.37,-.32], [.55,.02],
  [.39,.27], [.16,.51], [-.11,.44], [-.34,.53],
] as const;
const brushColor = new THREE.Color();

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

  blot(at: Point, long: Point, wide: Point, pigment: THREE.Color, tip: THREE.Color, seed: number) {
    const center = at.clone().addScaledVector(up, .12 * wide.length());
    const rim = blotOutline.map(([along, across], i) => at.clone()
      .addScaledVector(long, along * (1 + .12 * Math.sin(seed+i*4.19)))
      .addScaledVector(wide, across * (1 + .22 * Math.cos(seed+i*2.71))));
    for (let i = 0; i < rim.length; i++) {
      const next = (i+1) % rim.length;
      brushColor.copy(tip).multiplyScalar(i % 3 === 0 ? .90 : .98);
      this.triangle(center,rim[i],rim[next],pigment,brushColor,tip);
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
  function wash(tip: Point, angle: number, size: number, seed: number, sunlit: boolean) {
    // The crown widens along the branch and stacks outward and upward, with
    // one side catching light and occasional holes under the windward tips.
    const forward = new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
    const transverse = new THREE.Vector3(-forward.z,0,forward.x);
    for (let i = 0; i < 5; i++) {
      const s = seed + i*13, d = i===0 ? 0 : (.34 + .12*fraction(s)) * size;
      const a = angle + i*2.4 + fraction(s+1)*.5;
      const at = tip.clone().addScaledVector(forward,d*Math.cos(a-angle)*1.15)
        .addScaledVector(transverse,d*Math.sin(a-angle))
        .addScaledVector(up,height*(.12*fraction(s+2)-.037));
      const length = size*(i===0 ? .92 : .48+.38*fraction(s+4));
      const slope = (fraction(s+6)-.44)*1.54;
      const along = new THREE.Vector3(Math.cos(a),slope,Math.sin(a)).setLength(length);
      const across = new THREE.Vector3(-Math.sin(a),fraction(s+8)-.5,Math.cos(a)).setLength(length*(.55+.38*fraction(s+9)));
      const tone = sunlit ? (i===0 ? 1 : 2) : i%3===0 ? 0 : 1;
      canopy.blot(at,along,across,tones[tone],tones[tone+1],fraction(s+5)*6.28);
    }
  }

  for (let i = 0; i < 5; i++) {
    const angle = axis+i*2.39996+.60*(fraction(i+7)-.5), radial = spread*(.46+.32*fraction(i+9));
    const start = fork.clone().lerp(joint,.06+i*.18);
    const end = new THREE.Vector3(start.x+Math.cos(angle)*radial,
      y+height*((narrow?.59:.66)+.041*i+.105*fraction(i+12)),start.z+Math.sin(angle)*radial);
    const elbow = start.clone().lerp(end,.56).addScaledVector(up,-height*(.018+.04*fraction(i+13)));
    limb(mesh,start,elbow,trunk*(.44-.045*i),treeBark,.62);
    limb(mesh,elbow,end,trunk*(.26-.025*i),treeBark,.22);
    const size = spread*(.62+.28*fraction(i+35));
    wash(end,angle,size,100+i*271,Math.cos(angle-1.45)>.0 || i===4);
    if (!narrow && i===1) {
      const twig = end.clone().add(new THREE.Vector3(Math.sin(angle)*size*.27,-height*.075,-Math.cos(angle)*size*.27));
      limb(mesh,elbow,twig,trunk*.14,treeBark,.29);
      wash(twig,angle-.7,size*.76,1421,false);
    }
  }
  wash(leader,axis,spread*(narrow?.78:.70),1701,true);
  canopy.mesh(mesh);
}

/** Date-palm leaflets peel away from arched, drooping rachises. */
export function waterfrontPalm(mesh: PlantMesh, x: number, y: number, z: number, id: number, height: number, radius: number) {
  const fraction = seeded(id), axis = fraction(19)*Math.PI*2;
  const lean = height*(.026+.042*fraction(8)), base = new THREE.Vector3(x,y,z);
  const top = new THREE.Vector3(x+Math.cos(axis)*lean,y+height,z+Math.sin(axis)*lean);
  const trunk = height*.041;
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
    for (let segment = 0; segment < 10; segment++) {
      const t = segment/10, next = (segment+1)/10, a = point(t), b = point(next);
      const bladeWidth = radius*.027*(1-.75*t), tint = palmPalette[(i+segment%2)%3];
      crown.triangle(a.clone().addScaledVector(across,bladeWidth),a.clone().addScaledVector(across,-bladeWidth),
        b,tint,tint,palmPalette[2]);
      if (segment===0) continue;
      // Stagger the two sets of pinnae, narrowing and sweeping them forward near the tip.
      for (const side of sides) {
        const v = t+(side===1?.031:0), start = point(v), offset = side * radius * (.08+.147*Math.sin(Math.PI*v));
        const tip = point(Math.min(1,v+.17)).addScaledVector(across,offset)
          .addScaledVector(up,-radius*(.035+.055*v)*Math.sin(Math.PI*v));
        const shoulder = start.clone().lerp(tip,.47);
        const leafWidth = radius*(.025+.021*Math.sin(Math.PI*v))*(1-.61*v);
        crown.triangle(start,shoulder.clone().addScaledVector(outward,-leafWidth),tip,tint,palmPalette[2],palmPalette[3]);
        crown.triangle(start,tip,shoulder.addScaledVector(outward,leafWidth),tint,palmPalette[3],palmPalette[(i+1)%3]);
      }
    }
  }
  crown.mesh(mesh);
}
