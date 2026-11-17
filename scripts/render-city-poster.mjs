// Render the existing city geometry into a small, dependency-free arrival image.
import * as T from 'three';
import sharp from 'sharp';
import {createLandscape} from '../app/landscape.ts';
import {sailingPose,ferryPose} from '../app/motion.ts';
import {openingCamera} from '../app/camera.ts';
const world=createLandscape(),width=1440,height=840;
const camera=new T.PerspectiveCamera(20,width/height,1.5,650);camera.setFocalLength(openingCamera.desktop.focalLength);
const target=new T.Vector3(...openingCamera.target),offset=new T.Vector3(0,openingCamera.desktop.elevation,openingCamera.desktop.distance).applyAxisAngle(new T.Vector3(0,1,0),openingCamera.yaw);
camera.position.copy(target).add(offset);camera.lookAt(target);camera.updateMatrixWorld();
const faces=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),edge=new T.Vector3(),color=new T.Color(),light=new T.Vector3(-.4,.8,.5).normalize();
const subjects=[...world.architectureChunks];
for(const [i,boat] of world.sailboats.entries()){const p=sailingPose(0,i);boat.position.set(p.x,p.y,p.z);boat.rotation.set(p.heel,p.heading,0,'YXZ');subjects.push(boat);}
for(const [i,boat] of world.ferries.entries()){const p=ferryPose(0,i);boat.position.set(p.x,p.y,p.z);boat.rotation.y=p.heading;boat.traverse(o=>{if(o.isMesh)subjects.push(o);});}
world.root.updateMatrixWorld(true);
for(const mesh of subjects){const g=mesh.geometry,pos=g.attributes.position,colors=g.attributes.color,idx=g.index;
for(let i=0;i<(idx?idx.count:pos.count);i+=3){const ia=idx?idx.getX(i):i,ib=idx?idx.getX(i+1):i+1,ic=idx?idx.getX(i+2):i+2;
a.fromBufferAttribute(pos,ia).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(pos,ib).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(pos,ic).applyMatrix4(mesh.matrixWorld);if(Math.max(a.y,b.y,c.y)<-.7)continue;normal.subVectors(b,a).cross(edge.subVectors(c,a)).normalize();if(normal.dot(edge.subVectors(camera.position,a))<=0){if(mesh.material.side!==T.DoubleSide)continue;normal.negate();}
const shade=.62+Math.max(0,normal.dot(light))*.4;const depth=(a.distanceTo(camera.position)+b.distanceTo(camera.position)+c.distanceTo(camera.position))/3;
// Clip faces at the waterline so supports descend into opaque water.
const polygon=[];const input=[a.clone(),b.clone(),c.clone()];
for(let j=0;j<3;j++){const p=input[j],q=input[(j+1)%3],inside=p.y>=-.7,nextInside=q.y>=-.7;if(inside)polygon.push(p);if(inside!==nextInside)polygon.push(p.clone().lerp(q,(-.7-p.y)/(q.y-p.y)));}
if(polygon.length<3)continue;const projected=polygon.map(p=>p.project(camera));
a.copy(projected[0]);b.copy(projected[1]);c.copy(projected[2]);if(projected.some(p=>p.z>1||p.z< -1)||projected.every(p=>Math.abs(p.x)>1.2||Math.abs(p.y)>1.2))continue;
const area=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))*width*height/8;if(area<.6)continue;
if(colors)color.fromBufferAttribute(colors,ia);else color.copy(mesh.material.color);color.multiplyScalar(shade);const xy=p=>`${((p.x+1)*width/2).toFixed(1)},${((1-p.y)*height/2).toFixed(1)}`;
faces.push({depth,svg:`<path d="M${projected.map(xy).join(' L')}Z" fill="#${color.getHexString()}"/>`});}}
// Add the same instanced facade windows used by the live scene.
const wm=new T.Matrix4(),corners=[new T.Vector3(-.5,-.5,0),new T.Vector3(.5,-.5,0),new T.Vector3(.5,.5,0),new T.Vector3(-.5,.5,0)];
world.root.traverse(o=>{if(!(o instanceof T.InstancedMesh)||o.material!==world.windowMaterial)return;
for(let i=0;i<o.count;i++){o.getMatrixAt(i,wm);const points=corners.map(p=>p.clone().applyMatrix4(wm));const depth=points.reduce((v,p)=>v+p.distanceTo(camera.position),0)/4;const projected=points.map(p=>p.project(camera));if(projected.some(p=>p.z>1||p.z< -1)||projected.every(p=>Math.abs(p.x)>1.1||Math.abs(p.y)>1.1))continue;
faces.push({depth,svg:`<path d="M${projected.map(p=>`${((p.x+1)*width/2).toFixed(1)},${((1-p.y)*height/2).toFixed(1)}`).join(' L')}Z" fill="#597b85"/>`});}});
faces.sort((a,b)=>b.depth-a.depth);
const far=camera.getWorldDirection(new T.Vector3());far.y=0;far.normalize().multiplyScalar(450).add(camera.position);far.y=-.7;
const horizon=(1-far.project(camera).y)*height/2;
const waves=Array.from({length:900},(_,i)=>{
  const frac=t=>t-Math.floor(t),u=frac(Math.sin(i*63.19)*745.38),v=frac(Math.sin(i*17.83)*4622.9);
  const y=horizon+(height-horizon)*v;
  return `<path d="M${(u*width).toFixed(1)} ${y.toFixed(1)}l${(.5+v*v*18).toFixed(1)} ${(-v*1.8).toFixed(1)}" stroke="#c5d8c9" opacity="${(.04+v*.14).toFixed(2)}"/>`;
}).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>
<linearGradient id="sky" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#abd0df"/><stop offset="1" stop-color="#e2e3d4"/></linearGradient>
<linearGradient id="bay" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#cbdad2"/><stop offset=".21" stop-color="#719f9e"/><stop offset="1" stop-color="#4c9097"/></linearGradient>
</defs><rect width="${width}" height="${horizon+1}" fill="url(#sky)"/><rect y="${horizon}" width="${width}" height="${height-horizon}" fill="url(#bay)"/>${waves}${faces.map(f=>f.svg).join('')}</svg>`;
await sharp(Buffer.from(svg)).webp({quality:78}).toFile('public/city-poster.webp');
console.log(`Rendered ${faces.length} visible city faces to public/city-poster.webp`);
