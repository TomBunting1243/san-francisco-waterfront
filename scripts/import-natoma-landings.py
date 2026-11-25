"""Fit the two Fremont/Natoma curb mouths to the 2024 SF orthophoto.

The 24 px/m coordinates are an enlargement of the station-local 8 px/m
plate, not additional image resolution. See the tile 20/167784/405242.
The 2018 Yalonda M. James photograph confirms the right warning and curb.
Heights and obscured curb stations are fitted to adjoining municipal assets.
"""
import json
import math
from pathlib import Path

from shapely import LineString, Polygon, constrained_delaunay_triangles, union_all
from shapely.affinity import affine_transform

DATA = Path(__file__).resolve().parents[1] / 'public/data'
read = lambda name: json.loads((DATA / (name+'.json')).read_text())
blocks = read('survey-blocks')['streets']
overrides = read('curb-survey')['overrides']
stations = read('fremont-corner-curbs')['stations']
ex = .15135
ez = math.sqrt(1-ex**2)
scale = .06/24
ox, oz = -22.938495, -32.902787
world = [scale*ex, -scale*ez, scale*ez, scale*ex,
         ox-scale*(414*ex+543*ez), oz+scale*(543*ex-414*ez)]
plate = [ex/scale, ez/scale, -ez/scale, ex/scale,
         414-(ox*ex+oz*ez)/scale, -543+(ox*ez-oz*ex)/scale]

def parcels(kind, index):
    parts = overrides.get(kind,{}).get(str(index),[blocks[kind][index]])
    for j,(outer,*holes) in enumerate(parts):
        adjusted=stations.get(kind,{}).get(str(index),{}) if j==0 else {}
        yield Polygon([p for i,pt in enumerate(outer) for p in adjusted.get(str(i),[pt])],holes)

# Image station, road lip, fraction of the full raised curb height.
# A fraction of .50 produces a nominal 15 cm ordinary curb. At either end
# the earlier cap reaches 30 cm, so taper to that existing survey height.
# Shadow obscures the eastern apex. Keep the eighth narrow paint bar clear.
mouths = [
    ('west',347,[(278,None,1),(290,177,.50),(298,191,.32),(307,204,0),
                 (324,212,0),(337,214,0),(350,216,.32),(365,219,.50),(389,None,1)],
     [(181,315),(203,304),(207,328),(184,337)]),
    ('east',346,[(190,None,1),(201,530,.50),(210,524,.32),(219,518,0),
                 (235,511,0),(249,509,0),(263,509,.32),(281,513,.50),
                 (303,521,.50),(334,535,.50),(374,None,1)],
     [(520,231),(544,211),(550,236),(521,245)])]
vertices=[]; lookup={}; faces={}; patches=[]

def triangle(kind, points):
    out=faces.setdefault(kind,[])
    for u,v,h in points:
        p=(round(u,4),round(v,4),round(h,7))
        if p not in lookup:lookup[p]=len(vertices);vertices.append(p)
        out.append(lookup[p])

def paving(kind, pts, warning):
    (a,b,c)=pts
    det=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    if abs(det)<.00001:return
    if det>0:b,c=c,b;det=-det
    poly=Polygon([a[:2],b[:2],c[:2]])
    if warning is None or not poly.intersects(warning):
        triangle(kind,[a,b,c]);return
    for region,paint in [(poly.difference(warning),kind),(poly.intersection(warning),'warning')]:
        for t in constrained_delaunay_triangles(region).geoms:
            if t.area<.001:continue
            pts=[]
            for u,v in list(t.exterior.coords)[:3]:
                f=((u-a[0])*(c[1]-a[1])-(v-a[1])*(c[0]-a[0]))/det
                g=((b[0]-a[0])*(v-a[1])-(b[1]-a[1])*(u-a[0]))/det
                pts.append((u,v,a[2]+f*(b[2]-a[2])+g*(c[2]-a[2])))
            if not t.exterior.is_ccw:triangle(paint,pts)
            else:triangle(paint,pts[::-1])

for side,index,samples,warn in mouths:
    legacy=affine_transform(union_all(list(parcels('curb',index))),plate)
    sign=1 if side=='west' else -1
    rows=[];warning=Polygon(warn)
    for j,(v,u,raised) in enumerate(samples):
        cut=legacy.intersection(LineString([(90,v),(625,v)]))
        x0,_,x1,_=cut.bounds
        old_front=x1 if sign==1 else x0
        end=j in (0,len(samples)-1)
        if end:u=old_front
        width=x1-x0 if end else 4.8
        cap=.0312+raised*(.049-.0312)
        back=.045 if end else cap
        inside=min(u*sign,old_front*sign)-width-49
        outside=max(u*sign,old_front*sign)+10
        rows.append([(sign*outside,v,.031),(u,v,.031),(u,v,cap),
                     (u-sign*width,v,cap),(u-sign*width,v,back),(sign*inside,v,.045)])
    patch=Polygon([r[0][:2] for r in rows]+[r[-1][:2] for r in reversed(rows)])
    patches.append(patch)
    # These two municipal assets supply only a horizontal curb top. Close
    # its exposed street-facing side along the adjoining straight and return,
    # stopping at the next corner or the original endpoint on Natoma.
    ring=affine_transform(next(parcels('curb',index)),plate).exterior
    first,last=(15,21) if side=='west' else (24,31)
    path=list(ring.coords)[first:last+1]
    for start,end in zip(path,path[1:]):
        edge=LineString([start,end]).difference(patch)
        for part in getattr(edge,'geoms',[edge]):
            if part.is_empty or part.length<.001:continue
            a,b=part.coords[0],part.coords[-1]
            # GEOS preserves the source line direction when clipping.
            A,B=(*a,.031),(*b,.031)
            C,D=(*b,.049),(*a,.049)
            for tri in ([A,B,C],[A,C,D]):
                triangle('face',tri[::-1] if ring.is_ccw else tri)

    for a,b in zip(rows,rows[1:]):
        for k,name in enumerate(['asphalt','face','cap','face','walk']):
            for pts in ([a[k],b[k],b[k+1]],[a[k],b[k+1],a[k+1]]):
                if k in (1,3):
                    if len(set(pts))==3:triangle(name,pts[::-1] if sign==1 else pts)
                else:paving(name,pts,warning if k==4 else None)

def rings(p):
    return [[[round(x,8),round(z,8)] for x,z in list(r.coords)[:-1]]
            for r in (p.exterior,*p.interiors)]

cut=affine_transform(union_all(patches),world)
remaining={}
for kind,ids in [('street',[78]),('curb',[346,347]),('sidewalk',[223,225])]:
    for i in ids:
        out=[]
        for poly in parcels(kind,i):
            result=poly.difference(cut)
            out.extend(rings(p) for p in getattr(result,'geoms',[result]) if p.area>1e-10)
        remaining[kind+str(i)]=out
(DATA/'natoma-landings.json').write_text(json.dumps(dict(vertices=vertices,faces=faces,remainder=remaining),separators=(',',':'))+'\n')
print(len(vertices),'vertices;',sum(map(len,faces.values()))//3,'triangles')
