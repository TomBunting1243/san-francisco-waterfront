// Parcel use and individual occupancy are unknown for the outer survey. This
// static pattern samples only actual facade apertures. Its far limit averages
// the expected lit area instead of flashing one bright room per distant pixel.
export const distantRoomsGLSL=`
  float surveyRoomHash(vec2 cell,float seed){
    vec3 h=fract(vec3(cell,seed)*vec3(.1031,.1030,.0973));
    h+=dot(h,h.yzx+33.33);
    return fract((h.x+h.y)*h.z);
  }
  vec3 surveyRoomLight(vec2 uv,vec2 fw,float aperture,float seed,float share){
    float probability=clamp(share*.70,0.,.34);
    vec2 cell=floor(uv);
    float suite=surveyRoomHash(vec2(floor((cell.x+mod(seed+cell.y,3.))/2.),cell.y),seed);
    float lit=smoothstep(1.-probability-.008,1.-probability+.008,suite);
    float cool=step(.83,surveyRoomHash(cell,seed+13.));
    vec3 warmColor=vec3(.91,.66,.37),coolColor=vec3(.66,.73,.83);
    vec3 individual=mix(warmColor,coolColor,cool)*lit*(.60+.40*surveyRoomHash(cell,seed+5.));
    // A whole short facade is often still resolvable after its windows vanish.
    // Retain its stable identity, averaging out adjacent room and floor masks.
    float activity=smoothstep(.29,.73,surveyRoomHash(vec2(seed,3.),9.));
    vec2 blockUV=uv/vec2(5.,3.),bfw=fw/vec2(5.,3.);
    vec2 edge=.5-abs(fract(blockUV)-.5);
    float interior=smoothstep(0.,1.,min(edge.x/max(.002,bfw.x),edge.y/max(.002,bfw.y)));
    float block=step(.49,surveyRoomHash(floor(blockUV),seed+19.));
    float structure=interior*(1.-smoothstep(.22,.85,max(bfw.x,bfw.y)));
    float average=probability*activity*mix(.82,block*1.6,structure);
    float lod=smoothstep(.22,.92,max(fw.x,fw.y));
    return mix(individual,mix(warmColor,coolColor,.17)*average,lod)*aperture;
  }
`;
