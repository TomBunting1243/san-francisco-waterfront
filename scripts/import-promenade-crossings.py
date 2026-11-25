"""Trace individual paint bars on San Francisco's 2024 orthophoto.

Input is the local scene-grid aerial (132 px per world unit, x increasing to
the right from -56, z decreasing down from +2). Seed corridors below bracket
separate carriageways; their coordinates are in a 44 px/unit overview. The
brightness profile locates actual stripe centers and skips medians and gaps.
Clips the traced polygons to the rendered street and gutter survey, then bakes
paint triangles at a 4 mm offset. Requires NumPy, Rasterio and Shapely >= 2.1.
"""
import argparse,json
from pathlib import Path
import numpy as np
import rasterio
from shapely import Polygon, STRtree, constrained_delaunay_triangles, union_all
from shapely.geometry import LineString, box

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
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('aerial',type=Path)
parser.add_argument('--leg',type=int,help='rebuild one zero-based crossing in the existing survey')
args=parser.parse_args()
with rasterio.open(args.aerial) as src:
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
# The two signalized Market midblock legs are unusually wide. A single
# median brightness profile would confuse forecourt stone courses with bars
# and miss the interrupted markings. Trace both endpoints in the registered
# full-resolution 2024 crop: upper-left (-3, 2-420/132), 132 px/scene unit.
def market_point(u,v):
 return [round(-3+u/132,6),round(2-(420+v)/132,6)]
def market_bar(left,v0,right,v1,width,pieces=None):
 bars=[]
 for a,b in pieces or [(left,right)]:
  def point(u,d):
   return market_point(u,v0+(v1-v0)*(u-left)/(right-left)+d)
  bars.append([point(a,-width/2),point(b,-width/2),point(b,width/2),point(a,width/2)])
 return bars
east=[]
for i,(a,b) in enumerate([(176.4,174.9),(189.4,187.9),(201.9,200.1),(214.7,212.2),(227.1,225.4),(240.2,238.3),(252.8,250.9)]):
 east+=market_bar(264.2,a,465.4,b,4.8,[(264.2,333.2),(342.1,465.4)] if i==4 else None)
west=[]
for i,(a,b) in enumerate([(578.1,583.1),(591.7,596.5),(605.6,610.5),(619.1,624.0),(631.0,635.4),(644.0,648.2)]):
 west+=market_bar(217,a,314.3,b,5.0,[(217,284.8),(288.6,314.3)] if i==4 else None)
# A separate stop stripe runs transversely upstream of each crossing.
def stop_bar(u0,v0,u1,v1,width):
 return [market_point(u0-width/2,v0),market_point(u0+width/2,v0),
         market_point(u1+width/2,v1),market_point(u1-width/2,v1)]
east.append(stop_bar(237.3,203.5,238.3,251.3,4.4))
west.append(stop_bar(331.9,572.4,331.0,655.5,4.6))
market_start=len(records)
records.extend([east,west])

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
 x,z,nx,nz=station[:4]
 return [x+nx*offset,z+nz*offset]
for source,median,line in curbs['lines']:
 if source in curbs.get('westCityLanding',{}).get('retiredCurbs',[]):continue
 for a,b in zip(line,line[1:]):
  back=.157 if min(a[4],b[4])<1 else .031
  # A ramp station may set its own sidewalk-side width in curbSection.
  a_back=a[5] if len(a)>5 else back
  b_back=b[5] if len(b)>5 else back
  qa,qb=edge(a,.0023),edge(b,.0023)
  if not Polygon([qa,qb,edge(b,-b_back),edge(a,-a_back)]).envelope.intersects(bounds):continue
  # A very tight curb can fold over itself in plan. Mask the projections
  # of the same triangles rendered by addSurveyCurbs, including its ramp.
  for outer,inner_a,inner_b in [(.0023,0,0),(0,-.011,-.011),(-.011,-a_back,-b_back)]:
   for corners in [[edge(a,outer),edge(b,outer),edge(b,inner_b)],[edge(a,outer),edge(b,inner_b),edge(a,inner_a)]]:
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
def on_pavement(region):
 footprint=region.intersection(road)
 faces=[]
 candidates=tree.query(footprint,predicate='intersects')
 for k in candidates:
  band=exposed_gutter(footprint.intersection(gutters[k]),k,candidates)
  faces+=triangles(band,levels[k])
 footprint=footprint.difference(union_all([gutters[k] for k in candidates]))
 return faces+triangles(footprint,(0,0,.031))

paint=[[tri for corners in bars for tri in on_pavement(Polygon(corners))] for bars in records]

# Howard and The Embarcadero. Coordinates in the 650 x 600 crop starting at
# pixel (3870,300) in the same city orthophoto. The two white outlines cross
# the rail reservation. Their diagonal hatching is interrupted at each rail.
def howard_point(u,v):
 return ((3870+u)/132-56,2-(300+v)/132)

strokes=[]
def stripe(width,*points):
 line=LineString([howard_point(*p) for p in points])
 strokes.append(line.buffer(width/(2*132),cap_style='flat',join_style='mitre'))

stripe(1.9,(267,182),(278,185),(286,187),(294,193),(301,200),(305,207),
       (305,214),(295,275),(291,283),(281,292),(265,303),(251,309),(267,182))
stripe(1.9,(400,144),(392,143),(386,145),(380,150),(375,158),(372,167),
       (357,268),(357,279),(361,286),(367,290),(376,289),(400,144))
for a,b in [((264,215),(294,192)),((260,247),(305,211)),
            ((256,277),(300,243)),((252,306),(294,274)),
            ((372,167),(398,147)),((368,192),(396,170)),
            ((364,219),(392,196)),((360,245),(389,221)),
            ((357,271),(384,248)),((361,286),(381,268))]:
 stripe(1.8,a,b)

# The eastbound left and right pockets have staggered limit lines on Howard.
stripe(2.8,(218,520),(241,524))
stripe(2.8,(246,513),(272,517))
stripe(1.8,(235,598),(246,513))
stripe(2.6,(197.8,94),(200.8,167))
stripe(2.6,(478,273),(480.5,295))
stripe(2.6,(473,298),(475.3,320))
stripe(2.6,(468.2,323),(474.5,384))
for outline in [
 [(237,558),(233.5,558),(232.3,552),(229.5,548.5),(225,546),(224,549),(219.5,542.5),(225.5,539),(225,542.5),(231,545.3),(235,550)],
 [(242.5,553.8),(246.2,554),(249.4,549),(255,545.4),(259,545),(259.3,548.2),(264.7,543),(260,537.6),(259.2,541.1),(254.3,541.8),(247.2,546.4)],
]:
 strokes.append(Polygon([howard_point(*p) for p in outline]))

# Use the same individual segment offsets and end extension as buildStreetcarTrack.
rails=[]
for line in json.loads((data/'embarcadero-tracks.json').read_text())['tracks']:
 for a,b in zip(line,line[1:]):
  if max(a[0],b[0]) < -27 or min(a[0],b[0]) > -21:continue
  a,b=np.array(a),np.array(b)
  tangent=(b-a)/np.linalg.norm(b-a)
  normal=np.array([-tangent[1],tangent[0]])
  for sign in (-1,1):
   offset=normal*sign*(1.435+.068)*.06/2
   rails.append(LineString([a+offset-tangent*.0005,b+offset+tangent*.0005]).buffer(.068*.06/2+.0003,cap_style='flat'))
crossing_bars=[Polygon(b) for leg in records for b in leg if -27<b[0][0]<-21]
junction=on_pavement(union_all(strokes).difference(union_all(rails+crossing_bars)))
out=data/'promenade-crossings.json'
result={'survey':'San Francisco 2024 8 cm orthophoto','source':'https://tile.sf.gov','marketStart':market_start,'crossings':paint,'howardJunction':junction}
if args.leg is not None:
 if not 0<=args.leg<len(records):parser.error('crossing leg outside the survey')
 result=json.loads(out.read_text())
 if len(result['crossings'])!=len(records) or result['marketStart']!=market_start:
  parser.error('crossing inventory changed; rebuild the entire survey')
 result['crossings'][args.leg]=paint[args.leg]
out.write_text(json.dumps(result,separators=(',',':'))+'\n')
print(len(records),'crossing legs;',sum(map(len,records)),'source paint bars;',sum(map(len,result['crossings'])),'road and gutter paint triangles')
