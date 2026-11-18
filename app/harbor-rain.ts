import * as THREE from 'three';

const capacity=960;
export type PrecipitationKind='rain'|'snow';
function fraction(i:number,base:number){
  let n=i,value=0,place=1/base;
  while(n){value+=(n%base)*place;n=Math.floor(n/base);place/=base;}
  return value;
}

/** A bounded population of nearby world-space drops. The camera frustum supplies
 * new drops only as others leave it, preserving parallax while orbiting or zooming. */
export function createHarborRain(){
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));
  geometry.setIndex([0,1,2,0,2,3]);
  const centers=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage);
  const seeds=new Float32Array(capacity);
  for(let i=0;i<capacity;i++)seeds[i]=fraction(i+1,7);
  geometry.setAttribute('dropCenter',centers);
  geometry.setAttribute('dropSeed',new THREE.InstancedBufferAttribute(seeds,1));geometry.instanceCount=0;
  const uniforms={
    viewport:{value:new THREE.Vector2(1,1)},fall:{value:new THREE.Vector3()},rain:{value:0},night:{value:0},snow:{value:0},
  };
  const material=new THREE.ShaderMaterial({
    uniforms,transparent:true,depthTest:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,
    vertexShader:`
      attribute vec3 dropCenter;
      attribute float dropSeed;
      uniform vec2 viewport;
      uniform vec3 fall;
      uniform float rain,snow;
      varying vec2 brush;
      varying float tint;
      void main(){
        vec4 view=viewMatrix*vec4(dropCenter,1.);
        vec3 v=mat3(viewMatrix)*fall;
        float depth=max(.25,-view.z);
        vec2 velocity=(v.xy+v.z*view.xy/depth)*vec2(projectionMatrix[0][0],projectionMatrix[1][1])*viewport/(2.*depth);
        vec2 along=velocity/max(.001,length(velocity)),across=vec2(-along.y,along.x);
        float streak=clamp(length(velocity)*(.048+.022*dropSeed),4.,13.+9.*rain);
        float width=(.54+.45*dropSeed+.23*rain)*mix(1.14,.85,smoothstep(2.,10.,depth));
        vec2 offset=along*(position.y*.5*streak)+across*(position.x*width);
        // Flakes retain a nearly round silhouette even where they drift across the lens.
        float radius=(1.05+1.55*dropSeed)*mix(1.15,.63,smoothstep(2.,10.,depth));
        offset=mix(offset,position.xy*radius,snow);
        gl_Position=projectionMatrix*view;
        gl_Position.xy+=offset*2./viewport*gl_Position.w;
        brush=position.xy;tint=dropSeed;
      }`,
    fragmentShader:`
      uniform float rain,night,snow;
      varying vec2 brush;
      varying float tint;
      void main(){
        float taper=1.-smoothstep(.04,1.,abs(brush.x))*.97;
        float end=1.-smoothstep(.62,1.,abs(brush.y));
        vec3 daylight=mix(vec3(.105,.16,.19),vec3(.73,.85,.88),smoothstep(.36,.62,tint));
        vec3 lamplight=mix(vec3(.22,.31,.39),vec3(.74,.82,.82),tint);
        vec3 ink=mix(daylight,lamplight,night);
        float alpha=(.39+.32*rain)*taper*end;
        if(snow>.5){
          float radius=length(brush*vec2(.9+fract(tint*19.)*.22,1.));
          ink=mix(vec3(.91,.95,.94),vec3(.40,.53,.62),smoothstep(.20,.83,radius)*(.51-.26*night));
          alpha=(1.-smoothstep(.37,1.,radius))*(.57+.33*tint);
        }
        gl_FragColor=vec4(ink,alpha);
        #include <colorspace_fragment>
      }`,
  });
  material.forceSinglePass=true;
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='Harbor rainfall';mesh.renderOrder=12;mesh.frustumCulled=false;mesh.visible=false;
  mesh.raycast=()=>{};
  let active=0,serial=0,clock=0;
  const world=new THREE.Vector3(),view=new THREE.Vector3(),lastDir=new THREE.Vector3();
  const dir=new THREE.Vector3(),lastPos=new THREE.Vector3();
  let lastFocal=0,lastHorizontal=0;
  function update(camera:THREE.PerspectiveCamera,width:number,height:number,amount:number,windFrom:THREE.Vector2,
    strength:number,night:number,dt:number,precipitationKind:PrecipitationKind='rain',quality=2){
    const snow=precipitationKind==='snow';
    const observed=THREE.MathUtils.clamp(amount,0,1);
    const stepTime=THREE.MathUtils.clamp(dt,0,.12);
    if(snow||observed>.004)clock+=stepTime;
    // A burst crosses the harbor roughly once a minute during already-heavy rain.
    const gust=snow?0:THREE.MathUtils.smoothstep(observed,.63,.92)*Math.max(0,Math.sin(clock*.11+.4*Math.sin(clock*.19)))**4;
    const rain=snow?Math.max(.66,observed):Math.min(1,observed+.19*gust);
    const budget=quality<=0?280:quality===1?520:capacity;
    const count=rain>.004?Math.min(budget,Math.max(14,Math.round(width*height/1620*(.14+.86*rain)*(1+.43*gust)))):0;
    mesh.visible=count>0;geometry.instanceCount=count;
    if(!count){active=0;return;}
    camera.updateMatrixWorld();
    camera.getWorldDirection(dir);
    const projection=camera.projectionMatrix.elements,px=projection[0],py=projection[5];
    const cameraMoving=lastDir.dot(dir)<.9999999||lastPos.distanceToSquared(camera.position)>.0001||Math.abs(py-lastFocal)>.0001||Math.abs(px-lastHorizontal)>.0001;
    const drift=THREE.MathUtils.clamp(strength,0,1)*(snow?.22:.53)*(1+.24*gust);
    const fall=uniforms.fall.value.set(-windFrom.x*drift,snow?-.095:-.55-.13*rain-.10*gust,-windFrom.y*drift);
    uniforms.snow.value=snow?1:0;uniforms.rain.value=rain;uniforms.night.value=night;uniforms.viewport.value.set(width,height);
    if(!cameraMoving&&!stepTime&&count===active)return;
    for(let i=0;i<count;i++){
      const step=stepTime*(.74+.53*seeds[i]);
      let respawn=i>=active;
      if(!respawn){
        world.fromBufferAttribute(centers,i).addScaledVector(fall,step);
        if(snow&&step){
          world.x+=Math.sin(clock*(.57+seeds[i])+seeds[i]*93.)*step*.064;
          world.z+=Math.cos(clock*.84+seeds[i]*65.)*step*.047;
        }
        view.copy(world).applyMatrix4(camera.matrixWorldInverse);
        const d=-view.z;
        respawn=d<.9||d>16||Math.abs(view.x*px/d)>1.06||Math.abs(view.y*py/d)>1.06;
      }
      if(respawn){
        const fresh=i>=active;
        const k=fresh?i+1:++serial+capacity+1;
        const d=1.45+11.75*fraction(k,5)**1.45;
        const x=(fraction(k,2)*2-1)*1.035;
        let y=(fraction(k,3)*2-1)*1.035;
        // Recycling at the top preserves the uninterrupted downward fall. Camera
        // moves refill the newly exposed region throughout its width and height.
        if(!fresh&&!cameraMoving&&view.y*py/Math.max(.1,-view.z)<-1.05)y=1.025;
        world.set(x*d/px,y*d/py,-d).applyMatrix4(camera.matrixWorld);
      }
      centers.setXYZ(i,world.x,world.y,world.z);
    }
    centers.clearUpdateRanges();centers.addUpdateRange(0,count*3);centers.needsUpdate=true;
    active=count;lastDir.copy(dir);lastPos.copy(camera.position);lastFocal=py;lastHorizontal=px;
  }
  return {mesh,update,dispose(){geometry.dispose();material.dispose();}};
}
