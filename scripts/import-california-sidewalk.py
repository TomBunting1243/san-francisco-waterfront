"""Rebuild Robert Frost Plaza from SF's 2024 8 cm aerial (z20 p2024_rgb8cm).
Plate origin (-5,-21), 210 pixels per scene unit, X to the right and Z down.
Cached SFMTA curb faces/ROW and SF Public Works inventory ch9w-7kih are
already registered by import-curb-survey.py. Run with the survey-env Python.
"""
import json
from pathlib import Path
from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union
from shapely.geometry.polygon import orient

D=Path(__file__).resolve().parents[1]/'public/data'
def load(n):return json.loads((D/n).read_text())
def xy(p):return [-5+p[0]/210,-21+p[1]/210]
def poly(ps):return Polygon([xy(p) for p in ps])
def rounded(p):return [round(x,5) for x in p]
def polys(g):
    if g.is_empty:return []
    if g.geom_type=='Polygon':return [g]
    return [p for c in getattr(g,'geoms',[]) for p in polys(c)]
def serial(p):
    p=orient(p)
    return [[rounded(pt) for pt in r.coords[:-1]] for r in [p.exterior,*p.interiors]]
def triangles(g):return [[rounded(p) for p in t.exterior.coords[:-1]] for p in polys(g) for t in constrained_delaunay_triangles(p).geoms if t.area>1e-9]
# Market curb, curved crossover mouth, photographed Drumm return, then
# Hyatt's building edge. Southern seam ends at the BART/Spear approach.
face_px=[(581,1044),(553,818),(536,713),(516,557),(493,397),(484,340),(485,320),(492,299),(507,282),(526,272),(546,268),(563,270),(586,280),(850,407),(867,418),(878,433),(883,449),(882,464),(875,507),(856,640)]
face=[xy(p) for p in face_px]
plaza=poly(face_px+[(838,655),(758,830),(752,849),(739,872),(709,966),(698,991),(652,1045)])
curves=load('curb-survey.json');surveys=load('survey-blocks.json');market=load('market-street.json');rail=load('california-terminal.json')
line=LineString(face)
# Ramps: frontage point and back landing in the aerial. Length is at
# least 1:12 for the .0135 unit model rise; flat landings remain behind each.
ramps=[
 [(881,462),(842,457),.129],[(550,853),(590,848),.17],[(558,273),(553,314),.16],
 [(944,495),(977,518),.122],[(987,462),(1007,497),.148],
 [(1031,211),(1044,174),.129],[(1012,163),(1050,176),.129],
 [(350,956),(344,917),.148],[(362,1146),(368,1185),.148],
 [(452,1209),(411,1215),.148],[(604,1184),(645,1178),.148],
 [(406,865),(365,871),.148],
]
ramps=[[xy(a),xy(b),w] for a,b,w in ramps]
def trapezoid(a,b,w):
    x,z=b[0]-a[0],b[1]-a[1];l=(x*x+z*z)**.5;n=[-z/l,x/l]
    return Polygon([(p[0]+n[0]*s,p[1]+n[1]*s) for p,s in [(a,-w),(b,-w-.065),(b,w+.065),(a,w)]])
rampPolys=[trapezoid(a,b,w) for a,b,w in ramps]
# The two landings opposite the plaza have pale concrete, visible tactile pads.
extra=unary_union(rampPolys[3:])
cable=LineString([rail['nodes'][str(i)] for i in rail['outbound']])
stub=LineString([rail['nodes'][str(i)] for i in rail['stub']])
# Split the track approach where its ground grade starts and ends changing.
tracks=unary_union([cable,stub,LineString([rail['nodes'][str(i)] for i in rail['inbound']])])
sleeve=tracks.buffer(.074,quad_segs=3).intersection(plaza)
approach=tracks.buffer(.074,quad_segs=3).intersection(box(-1.75,-19.73,-.22,-18.8)).difference(plaza)
rim=line.buffer(.026,cap_style='flat').intersection(plaza)
walk=plaza.difference(unary_union([sleeve,rim]))
# Let existing BART access geometry and the mapped Muni island occupy their
# surveyed outlines. The brick surface continues beneath them at sidewalk level.
# Paint polygons are the four actual crossing fields, plus both north/south
# approaches to Drumm (SF 2024). Feathered/tyre-worn stripe ends are simplified.
sites=[
 ('Drumm south',[(894,435),(887,479)],[(945,453),(937,499)],3,8),
 ('California east',[(1015,201),(1047,214)],[(957,441),(995,458)],12,8),
 ('Drumm north',[(898,72),(876,113)],[(1021,133),(1002,173)],8,8),
 ('Market at Spear',[(404,818),(419,924)],[(541,802),(562,905)],8,9),
 ('Spear at Market',[(280,970),(410,942)],[(306,1158),(440,1132)],11,8),
 ('Market east of Spear',[(448,1149),(465,1266)],[(592,1129),(610,1244)],9,9),
 ('California west',[(450,-97),(594,-29)],[(499,257),(638,294)],20,7),
]
def lerp(a,b,t):return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]
def paint(first,last,count,width):
    delta=[last[0][0]-first[0][0],last[0][1]-first[0][1]]
    d=(delta[0]**2+delta[1]**2)**.5;off=[v/d*width/2 for v in delta]
    for i in range(count):
        a,b=[lerp(first[k],last[k],i/(count-1)) for k in [0,1]]
        yield poly([[p[0]+s*off[0],p[1]+s*off[1]] for p,s in [(a,-1),(a,1),(b,1),(b,-1)]])
railcuts=tracks.buffer(.041)
# The pale paired rail foundations in the 8 cm aerial average 19 px toward
# the street from the OSM centerlines along Frost Plaza. Return smoothly
# to the adjoining unmodified line, well beyond the brick field.
transition=[-22.05,-21.45,-15.85,-15.25]
def amount(z):return max(0,min(1,(z-transition[0])/.60,(transition[-1]-z)/.60))
def registered(p):
    points=[]
    for a,b in zip(p,p[1:]):
        ts=[0]+sorted((z-a[1])/(b[1]-a[1]) for z in transition if min(a[1],b[1])<z<max(a[1],b[1]))
        for t in ts:
            x,z=lerp(a,b,t);points.append([round(x-.092*amount(z),5),round(z,5)])
    x,z=p[-1];return points+[[round(x-.092*amount(z),5),round(z,5)]]
fTracks={str(i):registered(p) for i,c,p in market['tracks'] if not c and LineString(p).intersects(box(-5,-22.05,-1,-15.25))}
fBed=[]
for i,c,p in market['tracks']:
    if c:continue
    railLine=LineString(fTracks.get(str(i),p))
    for d in [-.04305,.04305]:railcuts=railcuts.union(railLine.offset_curve(d).buffer(.004))
    if str(i) in fTracks:fBed.append(railLine.buffer(.058).intersection(box(-5,transition[1],-.8,transition[2])))
fBed=unary_union(fBed)
bars={};road=[]
for key,a,b,n,w in sites:
    stripes=list(paint(a,b,n,w))
    bars[key]=triangles(unary_union(stripes).difference(railcuts))
    road.append(unary_union(stripes).convex_hull.buffer(.018))
asphalt=unary_union([*road,fBed]).difference(unary_union([plaza,extra]))
# The modern ramp mouths supersede the legacy sidewalk beneath the raised
# Drumm corner. The cuts remove overlapping flat survey triangles by index.
mask=unary_union([plaza,extra,approach,asphalt,line.buffer(.033,cap_style='flat')])
gutter=mask.difference(unary_union([plaza,extra,asphalt,approach])).difference(sleeve)
def plan(p):return Polygon(p[0],p[1:])
changes={}
for typ in ['sidewalk','curb','street','alley','courtyard','garden']:
    if typ not in surveys['streets']:continue
    for i,p in enumerate(surveys['streets'][typ]):
        old=[plan(a) for a in curves['overrides'].get(typ,{}).get(str(i),[p])]
        if not any(a.intersection(mask).area>1e-8 for a in old):continue
        changes.setdefault(typ,{})[i]=[serial(v) for a in old for v in polys(a.difference(mask)) if v.area>1e-7]
# Only replace curb-run segments at the actual rebuilt site. Existing
# survey data outside this mask retain their own ramp flags and normals.
replaced={}
for i,(_,_,points) in enumerate(curves['lines']):
    if not LineString([p[:2] for p in points]).intersects(mask):continue
    groups=[];current=[]
    for a,b in zip(points,points[1:]):
        seg=LineString([a[:2],b[:2]])
        if seg.length<1e-9:continue
        kept=seg.difference(mask);parts=[kept] if kept.geom_type=='LineString' else list(getattr(kept,'geoms',[]))
        for v in parts:
            if v.geom_type!='LineString' or v.length<1e-6:continue
            ends=[]
            for end in (v.coords[0],v.coords[-1]):
                t=seg.project(Point(end),normalized=True);ends.append(rounded([j+(k-j)*t for j,k in zip(a,b)]))
            if not current or current[-1]!=ends[0]:
                if len(current)>1:groups.append(current)
                current=[ends[0]]
            current.append(ends[1])
    if len(current)>1:groups.append(current)
    replaced[i]=groups

# Constrain triangles at each ramp edge, tactile footprint, and cable grade
# sample so support and the chosen finish refer to identical vertices.
pads=[poly(p) for p in [[(858,451),(871,454),(869,473),(856,470)],[(948,479),(963,485),(956,506),(941,500)]]]
def divided(g):
    pieces=polys(g)
    for clip in rampPolys+pads+[line.buffer(.095),line.buffer(.025)]+[box(-10,-30,10,-19.7+k*.05) for k in range(11)]:
        pieces=[p for part in pieces for cut in [part.intersection(clip),part.difference(clip)] for p in polys(cut) if p.area>1e-8]
    return [t for p in pieces for t in triangles(p)]
rampsUnion=unary_union(rampPolys)
pad=unary_union(pads)
brick=walk.difference(rampsUnion)
conc=unary_union([walk.intersection(rampsUnion),extra,rim]).difference(unary_union([sleeve,pad]))
out={'fTracks':fTracks,'transition':transition,'outline':serial(plaza)[0],'brick':divided(brick),'concrete':divided(conc),'warnings':divided(pad),'railBed':divided(sleeve.union(approach)),'asphalt':triangles(asphalt.union(gutter).difference(approach)),'bars':bars,'ramps':ramps,'face':[rounded(p) for p in face],'overrides':changes,'curbs':replaced}
(D/'california-sidewalk.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
