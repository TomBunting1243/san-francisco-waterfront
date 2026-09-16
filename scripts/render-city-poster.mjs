// Render the existing city geometry into a small, dependency-free arrival image.
import * as T from 'three';
import sharp from 'sharp';
import {createLandscape} from '../app/landscape.ts';
import {openingCamera} from '../app/camera.ts';
const world=createLandscape(),width=1280,height=800;
const camera=new T.PerspectiveCamera(20,width/height,1.5,650);camera.setFocalLength(openingCamera.desktop.focalLength);
const target=new T.Vector3(...openingCamera.target),offset=new T.Vector3(0,openingCamera.desktop.elevation,openingCamera.desktop.distance).applyAxisAngle(new T.Vector3(0,1,0),openingCamera.yaw);
camera.position.copy(target).add(offset);camera.lookAt(target);camera.updateMatrixWorld();
const faces=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),edge=new T.Vector3(),color=new T.Color(),light=new T.Vector3(-.4,.8,.5).normalize();
for(const mesh of world.architectureChunks){const g=mesh.geometry,pos=g.attributes.position,colors=g.attributes.color,idx=g.index;
for(let i=0;i<(idx?idx.count:pos.count);i+=3){const ia=idx?idx.getX(i):i,ib=idx?idx.getX(i+1):i+1,ic=idx?idx.getX(i+2):i+2;
a.fromBufferAttribute(pos,ia);b.fromBufferAttribute(pos,ib);c.fromBufferAttribute(pos,ic);if(Math.max(a.y,b.y,c.y)<-.7)continue;normal.subVectors(b,a).cross(edge.subVectors(c,a)).normalize();if(normal.dot(edge.subVectors(camera.position,a))<=0)continue;
const shade=.62+Math.max(0,normal.dot(light))*.4;const depth=(a.distanceTo(camera.position)+b.distanceTo(camera.position)+c.distanceTo(camera.position))/3;
// Clip faces at the waterline so supports descend into opaque water.
const polygon=[];const input=[a.clone(),b.clone(),c.clone()];
for(let j=0;j<3;j++){const p=input[j],q=input[(j+1)%3],inside=p.y>=-.7,nextInside=q.y>=-.7;if(inside)polygon.push(p);if(inside!==nextInside)polygon.push(p.clone().lerp(q,(-.7-p.y)/(q.y-p.y)));}
if(polygon.length<3)continue;const projected=polygon.map(p=>p.project(camera));
a.copy(projected[0]);b.copy(projected[1]);c.copy(projected[2]);if(projected.some(p=>p.z>1||p.z< -1)||projected.every(p=>Math.abs(p.x)>1.2||Math.abs(p.y)>1.2))continue;
const area=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))*width*height/8;if(area<.6)continue;
color.fromBufferAttribute(colors,ia).multiplyScalar(shade);const xy=p=>`${((p.x+1)*width/2).toFixed(1)},${((1-p.y)*height/2).toFixed(1)}`;
faces.push({depth,svg:`<path d="M${projected.map(xy).join(' L')}Z" fill="#${color.getHexString()}"/>`});}}
// Add the same instanced facade windows used by the live scene.
const wm=new T.Matrix4(),corners=[new T.Vector3(-.5,-.5,0),new T.Vector3(.5,-.5,0),new T.Vector3(.5,.5,0),new T.Vector3(-.5,.5,0)];
world.root.traverse(o=>{if(!(o instanceof T.InstancedMesh)||o.material!==world.windowMaterial)return;
for(let i=0;i<o.count;i++){o.getMatrixAt(i,wm);const points=corners.map(p=>p.clone().applyMatrix4(wm));const depth=points.reduce((v,p)=>v+p.distanceTo(camera.position),0)/4;const projected=points.map(p=>p.project(camera));if(projected.some(p=>p.z>1||p.z< -1)||projected.every(p=>Math.abs(p.x)>1.1||Math.abs(p.y)>1.1))continue;
faces.push({depth,svg:`<path d="M${projected.map(p=>`${((p.x+1)*width/2).toFixed(1)},${((1-p.y)*height/2).toFixed(1)}`).join(' L')}Z" fill="#597b85"/>`});}});
faces.sort((a,b)=>b.depth-a.depth);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#cbdde0"/><rect y="290" width="100%" height="510" fill="#8dbabe"/>${faces.map(f=>f.svg).join('')}</svg>`;
await sharp(Buffer.from(svg)).webp({quality:78}).toFile('public/city-poster.webp');
console.log(`Rendered ${faces.length} visible city faces to public/city-poster.webp`);
