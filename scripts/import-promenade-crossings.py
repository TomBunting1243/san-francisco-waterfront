"""Trace individual paint bars on San Francisco's 2024 orthophoto.

Input is the local scene-grid aerial (132 px per world unit, x increasing to
the right from -56, z decreasing down from +2). Seed corridors below bracket
separate carriageways; their coordinates are in a 44 px/unit overview. The
brightness profile locates actual stripe centers and skips medians and gaps.
Clips the traced polygons to the rendered street and gutter survey, then bakes
paint triangles at a 4 mm offset. Requires NumPy, Rasterio and Shapely >= 2.1.
"""
import json,sys
from pathlib import Path
import numpy as np
import rasterio
from shapely import Polygon, STRtree, constrained_delaunay_triangles, union_all
from shapely.geometry import box

# overview strip, centerline start/end pixels, strip width in pixels
strips=[
 (0,(331,150),(330,171),18),(0,(325,219),(324,237),18),(0,(408,151),(405,172),16),(0,(391,217),(388,240),17),
 (0,(848,196),(842,238),18),(0,(914,200),(909,235),17),(0,(838,265),(834,289),17),(0,(902,278),(898,316),18),(0,(839,309),(879,319),15),
 (1,(115,117),(107,159),16),(1,(180,120),(176,150),16),(1,(103,214),(93,253),17),(1,(172,177),(166,218),18),(1,(96,252),(152,234),17),
 (1,(624,160),(622,194),17),(1,(690,168),(686,199),16),(1,(618,215),(613,258),17),(1,(685,222),(680,258),18),(1,(620,267),(663,268),13),
 (1,(920,186),(919,223),13),(1,(923,260),(903,294),15),
 (2,(205,187),(205,222),13),(2,(245,279),(247,312),14),(2,(213,266),(234,277),12),
 (2,(443,186),(443,231),17),(2,(540,190),(540,220),16),(2,(444,269),(445,301),18),(2,(538,261),(539,297),17),(2,(458,313),(526,311),17),
 (2,(955,187),(954,221),18),(2,(925,245),(925,286),18)]
with rasterio.open(sys.argv[1]) as src:
 # Same fixed-point luminance as Pillow's RGB -> L converter.
 red,green,blue=src.read((1,2,3),out_dtype='uint32')
 im=((red*19595+green*38470+blue*7471+32768)>>16).astype('uint8')
records=[]
for row,start,end,width in strips:
 a,b=np.array(start,dtype=float),np.array(end,dtype=float)
 along=b-a;length=np.linalg.norm(along);axis=along/length;side=np.array([-axis[1],axis[0]])
 origin=np.array([1261*row,0]);a+=origin
 t=np.arange(0,length,.16);cross=np.linspace(-.36*width,.36*width,23)
 points=(a+t[:,None,None]*axis+cross[None,:,None]*side)*3
 profile=np.median(im[np.round(points[:,:,1]).astype(int),np.round(points[:,:,0]).astype(int)],axis=1)
 # Compare each little strip of paint to the same crossing on either side.
 baseline=np.percentile(np.lib.stride_tricks.sliding_window_view(np.pad(profile,16,mode='edge'),33),23,axis=1)
 mask=profile-baseline>max(5,np.percentile(profile-baseline,86)*.43)
 runs=np.where(np.diff(np.r_[False,mask,False]))[0].reshape(-1,2)
 bars=[]
 for low,high in runs:
  if not .5<.16*(high-low)<3.65:continue
  def coord(d,offset):
   x,z=a+axis*d+side*offset
   return [round(x/44-56,4),round(2-z/44,4)]
  # Preserve width, skew, asymmetrical approaches and missing stripe positions.
  bars.append([coord(low*.16,-width/2),coord(high*.16,-width/2),coord(high*.16,width/2),coord(low*.16,width/2)])
 if len(bars)>=2:records.append(bars)
# Register the orthophoto bars to the modeled Public Works right of way.
# Raised islands, ramp landings and curb faces never carry a painted roadway bar.
data=Path(__file__).resolve().parents[1]/'public/data'
blocks=json.loads((data/'survey-blocks.json').read_text())
curbs=json.loads((data/'curb-survey.json').read_text())
bounds=box(-53,-8,27,2)
def parcels(kind):
 for i,original in enumerate(blocks['streets'][kind]):
  patches=curbs['overrides'].get(kind,{}).get(str(i),[original])
  for outer,*holes in patches:
   region=Polygon(outer,holes)
   if region.intersects(bounds):yield region
road=union_all(list(parcels('street'))).difference(union_all([*parcels('sidewalk'),*parcels('curb'),
   *[Polygon(f) for f in curbs['medianSlab']+curbs['westFlanks']]]))
# Store the asphalt-gutter seam in the paint as well: z-fighting or a raised
# paint strip is conspicuous when walking up to a ramp. These are the same
# two gutter edge offsets and heights used in addSurveyCurbs.
gutters=[]; levels=[]; faces=[]
def edge(station,offset):
 x,z,nx,nz,_=station
 return [x+nx*offset,z+nz*offset]
for _,median,line in curbs['lines']:
 for a,b in zip(line,line[1:]):
  back=.157 if min(a[4],b[4])<1 else .031
  qa,qb=edge(a,.0023),edge(b,.0023)
  if not Polygon([qa,qb,edge(b,-back),edge(a,-back)]).envelope.intersects(bounds):continue
  # A very tight curb can fold over itself in plan. Mask the projections
  # of the same triangles rendered by addSurveyCurbs, including its ramp.
  for outer,inner in zip([.0023,0,-.011],[0,-.011,-back]):
   for corners in [[edge(a,outer),edge(b,outer),edge(b,inner)],[edge(a,outer),edge(b,inner),edge(a,inner)]]:
    face=Polygon(corners)
    if face.area>0:faces.append(face)
  # Match the renderer's diagonal as each gutter quad can bend around a corner.
  for coords,heights in [([edge(a,.037),edge(b,.037),qb],[.032,.032,.0315]),([edge(a,.037),qb,qa],[.032,.0315,.0315])]:
   tri=Polygon(coords)
   if tri.area<1.e-10:continue
   gutters.append(tri);levels.append(np.linalg.solve([[x,z,1] for x,z in coords],heights))
road=road.difference(union_all(faces))
tree=STRtree(gutters)
def triangles(region,plane):
 result=[]
 for tri in constrained_delaunay_triangles(region).geoms:
  pts=list(tri.exterior.coords)[:3]
  if tri.area<.00000008:continue
  result.append([[round(x,6),round(z,6),round(plane[0]*x+plane[1]*z+plane[2]+.00024,7)] for x,z in pts])
 return result
def exposed_gutter(band,k,candidates):
 # Consecutive gully triangles can overlap around a tight turn. The physical
 # contact surface is the upper envelope, independent of STRtree query order.
 for j in candidates:
  if j==k or not band.intersects(gutters[j]):continue
  delta=levels[j]-levels[k]
  dx,dz,offset=delta
  length=np.hypot(dx,dz)
  if length<1.e-12:
   if offset>1.e-12 or abs(offset)<=1.e-12 and j<k:band=band.difference(gutters[j])
   continue
  overlap=band.intersection(gutters[j])
  if overlap.area<=0:continue
  x0,z0,x1,z1=overlap.bounds
  corners=[np.array([x0,z0]),np.array([x1,z0]),np.array([x1,z1]),np.array([x0,z1])]
  heights=[dx*x+dz*z+offset for x,z in corners]
  if max(heights)<=0:continue
  if min(heights)>=0:
   band=band.difference(gutters[j]);continue
  above=[]
  for i,a in enumerate(corners):
   b=corners[(i+1)%4];ha,hb=heights[i],heights[(i+1)%4]
   if ha>=0:above.append(a)
   if ha*hb<0:above.append(a+(b-a)*ha/(ha-hb))
  if len(above)>=3:band=band.difference(overlap.intersection(Polygon(above)))
 return band
paint=[]
for bars in records:
 leg=[]
 for corners in bars:
  footprint=Polygon(corners).intersection(road)
  faces=[]
  candidates=tree.query(footprint,predicate='intersects')
  for k in candidates:
   band=exposed_gutter(footprint.intersection(gutters[k]),k,candidates)
   faces+=triangles(band,levels[k])
  footprint=footprint.difference(union_all([gutters[k] for k in candidates]))
  faces+=triangles(footprint,(0,0,.031))
  if faces:leg.extend(faces)
 paint.append(leg)
out=data/'promenade-crossings.json'
out.write_text(json.dumps({'survey':'San Francisco 2024 8 cm orthophoto','source':'https://tile.sf.gov','crossings':paint},separators=(',',':'))+'\n')
print(len(records),'crossing legs;',sum(map(len,records)),'source paint bars;',sum(map(len,paint)),'road and gutter paint triangles')
