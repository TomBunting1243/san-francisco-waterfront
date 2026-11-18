"""Clip the regional elevation grid to NOAA CUSP through Oakland and Alameda.

Pass the N35W125.zip tile from https://nsde.ngs.noaa.gov/ . Requires pyshp and
Shapely. Work in geographic coordinates until writing the scene's triangle cuts.
"""
import json
import math
from collections import Counter
import sys
from pathlib import Path
import shapefile
from shapely import set_precision
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import polygonize, unary_union
from shapely.prepared import prep

data = Path(__file__).resolve().parents[1] / "public/data"
lat, lon = json.loads((data / "sf-waterfront.json").read_text())["origin"]
grid = json.loads((data / "bay-relief.json").read_text())["grids"][0]
step, cols = grid["step"], grid["cols"]
assert grid["name"] == "bay"
# Grid-aligned crop avoids partial raster cells at the import boundary.
bounds = (-122.346, 37.686, -122.226, 37.898)
extent = box(*bounds)
def pieces(geometry, kind):
    if geometry.is_empty:
        return []
    if geometry.geom_type == kind:
        return [geometry]
    return [child for multi in getattr(geometry, 'geoms', []) for child in pieces(multi, kind)]

segments = []
for shape in shapefile.Reader(sys.argv[1]).iterShapes(bbox=bounds):
    corners = list(shape.parts) + [len(shape.points)]
    for first, last in zip(corners, corners[1:]):
        line = LineString(shape.points[first:last]).intersection(extent)
        segments.extend(pieces(line, "LineString"))
linework=unary_union([set_precision(line,.0000001) for line in [*segments,extent.boundary]])
endpoints=Counter(p for line in pieces(linework,"LineString") for p in (line.coords[0],line.coords[-1]))
loose=[p for p,count in endpoints.items() if count==1]
# CUSP breaks at covered culverts and short bridge crossings. Join only pairs
# that select each other and leave a gap under 100 m. Preserve the charted
# paths on either side. The derived closing segments are excluded from banks.
def distance(a,b):
    return math.hypot((a[0]-b[0])*111320*math.cos(math.radians(lat)),(a[1]-b[1])*111320)
nearest={a:min((b for b in loose if b!=a),key=lambda b:distance(a,b)) for a in loose}
joins=[LineString((a,b)) for a,b in nearest.items() if a<b and nearest[b]==a and distance(a,b)<100]
faces=list(polygonize(unary_union([linework,*joins])))
bay_seed=Point(-122.338,37.816)
bay=next(p for p in faces if p.contains(bay_seed))
if bay.contains(Point(-122.27,37.805)) or bay.contains(Point(-122.309,37.786)) or bay.area<.007:
    raise ValueError("NOAA shoreline did not separate the Bay, downtown Oakland and Alameda")
water=bay.simplify(.000018,preserve_topology=True)
prepared = prep(water)
m_lon = 111320 * math.cos(math.radians(lat))
def project(p):
    e,n = (p[0]-lon)*m_lon,(p[1]-lat)*111320
    return [round(-.03552029735*e+.04836012986*n,3),round(.04836012986*e+.03552029735*n,3)]
def rings(geom):
    return [[[project(p) for p in ring.coords[:-1]] for ring in (poly.exterior,*poly.interiors)]
            for poly in pieces(geom,"Polygon") if poly.area>2e-12]

wet, mixed, tide_vertices = [], [], set()
for row in range(round((bounds[1]-grid["south"])/step),round((bounds[3]-grid["south"])/step)):
    for col in range(round((bounds[0]-grid["west"])/step),round((bounds[2]-grid["west"])/step)):
        x,y=grid["west"]+step*col,grid["south"]+step*row
        a,b,c,d=(x,y),(x+step,y),(x,y+step),(x+step,y+step)
        cell=Polygon([a,b,d,c]);index=row*cols+col
        if prepared.covers(cell):
            wet.append(index)
        else:
            tide_vertices.update((index,index+1,index+cols,index+cols+1))
            if prepared.intersects(cell):
                lower,upper=(rings(Polygon(points).difference(water)) for points in [(a,b,c),(b,d,c)])
                if lower or upper:
                    mixed.append([index,lower,upper])
                else:
                    wet.append(index)
result={"source":"NOAA NGS Continually Updated Shoreline Product, N35W125",
        "water":wet,"coastalCells":mixed,"tidalVertices":sorted(tide_vertices)}
(data/"east-bay-shore.json").write_text(json.dumps(result,separators=(',',':'))+'\n')
print(len(faces),len(wet),len(mixed),len(tide_vertices))
