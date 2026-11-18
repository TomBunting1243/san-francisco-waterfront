#!/usr/bin/env python3
"""Bake waterfront streets and buildings from cached DataSF and SFMTA GeoJSON.
Run with Shapely 2: python scripts/import-survey-blocks.py <survey-dir>.
Coordinates, heights, and distances below are scene units (0.06 per metre).
"""
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

from shapely import STRtree, set_precision
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.geometry.polygon import orient
from shapely.ops import polygonize, unary_union

data = Path(__file__).resolve().parents[1] / "public/data"
survey = Path(sys.argv[1])
def read(path):
    return json.loads(path.read_text())

base = read(data/"sf-waterfront.json")
south = read(data/"south-beach.json")
gardens = read(data/"waterfront-landscape.json")
shore = read(data/"survey-shore.json")
approach = read(data/"approach-soma.json")
lat, lon = base["origin"]
east = 111320 * math.cos(math.radians(lat))
a, b, c, d = -.03552029735*east, .04836012986*111320, .04836012986*east, .03552029735*111320
transform = [a,b,c,d,-lon*a-lat*b,-lon*c-lat*d]
window = [-112, -62, 35, 6]
extent = box(*window)
land = unary_union([Polygon(r[0], r[1:]) for r in shore["land"]])
area = extent.intersection(land)
def polygons(g):
    if g.is_empty:
        return []
    if g.geom_type == "Polygon":
        return [g]
    return [p for part in getattr(g, "geoms", []) for p in polygons(part)]

def features(file, margin=0):
    bounds = extent.buffer(margin)
    for f in read(survey/file)["features"]:
        g = affine_transform(shape(f["geometry"]), transform)
        if g.intersects(bounds):
            yield f["properties"], g if g.is_valid else g.buffer(0)

def pack(poly):
    poly = orient(poly, sign=1)
    return [[[round(x,3),round(z,3)] for x,z in r.coords[:-1]] for r in (poly.exterior,*poly.interiors)]

def osm_poly(p):
    return Polygon(p).buffer(0)

parks = [osm_poly(p["p"]) for p in base["parks"] if len(p["p"])>3]
parks += [osm_poly(p["p"]) for p in gardens["areas"] if len(p["p"])>3 and p["kind"]!="park-hole"]
parks += [osm_poly(south["features"][k]) for k in ("stadium","park","chinaBasin","plaza")]
protected = unary_union(parks)
existing = []
for obj in base["buildings"]:
    p = osm_poly(obj["p"])
    x,z = [sum(v[i] for v in obj["p"])/len(obj["p"]) for i in (0,1)]
    if p.area>(.08 if obj.get("part") else 1.2) and -95<x<72 and -112<z<26:
        existing.append((obj,p))
other = [osm_poly(obj["p"]) for obj in south["buildings"]]
other += [osm_poly(obj["points"]) for obj in approach["buildings"]]
occupied = unary_union([p for _,p in existing]+other)
surveyed = [(props,p) for props,g in features("sf-buildings.geojson")
            for p in polygons(g) if p.area>.065 and area.covers(p)]
tree = STRtree([p for _,p in surveyed])
matches = {}
parents = {b.get("parent") for b,p in existing}
for b,p in existing:
    if b.get("part") or b.get("measured") or b["id"] in parents:
        continue
    for index in tree.query(p,predicate="intersects"):
        props, footprint = surveyed[index]
        overlap = p.intersection(footprint).area
        height = float(props.get("hgt_median_m") or 0)*.06
        # Prevent a historic low podium or a neighboring tower from taking over
        # a modern model. Measured OSM heights and modeled assemblies take priority.
        if overlap/max(p.area,footprint.area)>.83 and .19<height<9:
            matches[b["id"]] = round(height,3)
            break
extras = []
for props,p in surveyed:
    h = float(props.get("hgt_median_m") or 0)*.06
    if .19<h<9 and p.area>.13 and not occupied.intersects(p.buffer(-.012)) and not protected.intersects(p):
        extras.append([round(h,3),pack(p.simplify(.012))])
# Separate the sidewalk side of each actual curb from the vehicle side.
# The polygonized road network makes whole blocks and traffic islands. A
# block surrounds land outside the right of way. Unlike a fixed curb offset,
# intersecting that block with ROW preserves variable sidewalk widths.
rows = defaultdict(list)
for props,g in features("row.geojson",18):
    layer = props["LAYER"].strip()
    if layer not in {"STREETS","PRIVATE","Streets_Pedestri",""} or props["ST_TYPE"].strip() in {"PLZ","TUNL"}:
        continue
    kind = "sidewalk" if layer=="Streets_Pedestri" else "private" if layer=="PRIVATE" else "alley" if props["ST_TYPE"].strip() in {"ALY","LN","CT","PL"} else "street"
    rows[kind].append(g)
rows = {kind:unary_union(items) for kind,items in rows.items()}
right_of_way = unary_union(list(rows.values()))
curbs = [set_precision(g,.001) for props,g in features("curbs.geojson",24) if props["INT_Z"]==0 and props["STATUS"]=="Active"]
curb_union = unary_union(curbs)
interiors = [p for p in polygonize(curb_union) if p.area>.014 and p.intersection(right_of_way).area < .66*p.area]
# Enclosed islands entirely inside the public right of way remain separate
# when SF explicitly labels their perimeter an island.
island_edges = [set_precision(g,.001) for props,g in features("curbs.geojson",24) if props["INT_Z"]==0 and props["CBB_TYPE"]=="ISL"]
islands = list(polygonize(unary_union(island_edges)))
walks = unary_union(interiors+islands)
mask = area.difference(unary_union([protected,occupied]+[p for _,p in surveyed]))
surfaces = {}
for kind,g in rows.items():
    if kind!="sidewalk":
        surfaces[kind]=g.difference(walks).intersection(mask)
surfaces["sidewalk"] = right_of_way.intersection(walks.union(rows.get("sidewalk",Polygon()))).intersection(mask)
surfaces["curb"] = curb_union.buffer(.012,quad_segs=1).intersection(right_of_way).intersection(mask)
# Tile broad streets before triangulation. Adjacent pieces share identical
# boundaries, while the GPU can cull streets on the opposite side of town.
tiles = defaultdict(list)
for kind,g in surfaces.items():
    for x in range(-120,36,12):
        for z in range(-72,7,12):
            tile=g.intersection(box(x,z,x+12,z+12))
            for p in polygons(tile):
                if p.area>.001:
                    for simple in polygons(set_precision(p.simplify(.008),.001)):
                        if simple.area>.001:
                            tiles[kind].append(pack(simple))
# Hand-traced private pedestrian circulation and the two pool basins on
# the 2022 orthophoto. Its 800 x 700 preview spans 32 x 28 scene units.
def plate(i,j):
    return (-83+i*.04,-37+j*.04)
def trace(points):
    return Polygon([plate(*p) for p in points])
court = trace([(205,118),(445,90),(497,423),(241,450)])
pools = [trace(points) for points in [
    [(342,367),(359,358),(370,364),(370,373),(339,375)],
    [(393,181),(401,177),(405,203),(398,204)]]]
walkways = [LineString([plate(*p) for p in line]).buffer(.115,quad_segs=2)
            for line in [[(247,420),(301,343),(351,289),(390,224),(411,155)],
                         [(244,251),(310,273),(351,289),(404,303),(458,313)],
                         [(298,201),(321,245),(351,289),(379,336),(436,397)],
                         [(267,381),(306,366),(337,339),(379,335),(421,353)]]]
walkways.append(Point(plate(351,289)).buffer(.67,quad_segs=12))
clear = court.difference(occupied).difference(protected)
for kind,geom in [("garden",clear),("courtyard",unary_union(walkways)),("pool",unary_union(pools))]:
    for p in polygons(geom.intersection(clear)):
        if p.area>.02:
            tiles[kind].append(pack(p))
# Off-street lot behind the Embarcadero storefronts. Keep curb cuts open;
# clip paint and paving to the parcel interior, outside all building plans.
lot=trace([(306,508),(396,501),(433,487),(469,483),(486,506),(502,549),
           (519,602),(513,626),(501,637),(420,580)]).difference(occupied).difference(right_of_way)
for poly in polygons(lot):
    if poly.area>.01:
        tiles["parking"].append(pack(poly))
for origin,count in [((371,514),8),((411,532),9),((437,550),8),((463,576),7),((469,595),6)]:
    x,y=origin
    for n in range(count):
        # Typical stall is 2.5 m wide and 4.8 m deep in this survey.
        start=plate(x+3.7*n,y-.54*n)
        end=plate(x+3.7*n+1.0,y-.54*n+7.2)
        for poly in polygons(LineString([start,end]).buffer(.004,cap_style="flat").intersection(lot)):
            tiles["stall"].append(pack(poly))
# Preserve stepped OSM plans on the Bayside Village block. A true inward
# buffer produces an open parapet and follows individual projecting wings.
fronts = {}
for b,p in existing:
    if b["id"] in {37058253,37058255,37058259,37058279,37058283,37058284,
                   288714169,288714170,288714171,125401311,125401316,125401320}:
        outline=p.simplify(.018)
        cap=outline.difference(outline.buffer(-.044,join_style="mitre"))
        fronts[b["id"]] = dict(plan=pack(outline),parapets=[pack(r) for r in polygons(cap)])
outside=[]
for road in base["roads"]+south["roads"]:
    if len(road["p"])<2:
        continue
    line = LineString(road["p"]).difference(extent)
    for segment in ([line] if line.geom_type=="LineString" else getattr(line,"geoms",[])):
        if segment.length>.01:
            outside.append({"name":road["name"],"kind":road["kind"],"p":[[round(x,3),round(z,3)] for x,z in segment.coords]})
url="https://services.sfmta.com/arcgis/rest/services/ROW/rightofway/MapServer/"
out = dict(sources=["https://data.sf.gov/d/ynuv-fyni",url+"1",url+"6","https://gis.wildlife.ca.gov/images/rest/services/Base_Remote_Sensing/NAIP_2022/ImageServer"],window=window,
           heights=matches, fronts=fronts, buildings=extras, streets=tiles, outsideRoads=outside)
(data/"survey-blocks.json").write_text(json.dumps(out,separators=(",",":"))+"\n")
print("Building additions, matched heights:",len(extras),len(matches))
print("Curb faces:",len(interiors),"islands:",len(islands))
print("Surface areas:",{k:round(v.area,2) for k,v in surfaces.items()})
