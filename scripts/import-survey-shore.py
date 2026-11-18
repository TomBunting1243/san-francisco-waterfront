#!/usr/bin/env python3
"""Bake the local NOAA NGS Continually Updated Shoreline Product (CUSP) and OSM pier footprints.

Usage: python scripts/import-survey-shore.py /path/to/N35W125.zip
Requires pyshp 3 and shapely 2. NOAA download: https://nsde.ngs.noaa.gov/
"""
import json
import math
import sys
from pathlib import Path

import shapefile
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import linemerge, polygonize, unary_union

DATA = Path(__file__).resolve().parents[1] / "public/data"
base = json.loads((DATA / "sf-waterfront.json").read_text())
south = json.loads((DATA / "south-beach.json").read_text())
relief = json.loads((DATA / "bay-relief.json").read_text())
west, east = south["shoreline"][0], base["coasts"][0][-1]
# Same inland limits and waterfront termini as the detailed OSM model.
extent = Polygon([[west[0], -135], [112, -114], east, [180, east[1]+3],
                  [180, 38], [west[0], 38]])
lat, lon = base["origin"]
metres_lon = 111320 * math.cos(math.radians(lat))


def project(p):
    e, n = (p[0]-lon)*metres_lon, (p[1]-lat)*111320
    return tuple(round(v, 4) for v in (-.03552029735*e+.04836012986*n, .04836012986*e+.03552029735*n))


def parts(g, kind):
    if g.is_empty:
        return []
    if g.geom_type == kind:
        return [g]
    return [part for sub in getattr(g, "geoms", []) for part in parts(sub, kind)]


def rings(polys):
    return [[[list(map(lambda v: round(v, 4), point)) for point in ring.coords[:-1]]
             for ring in (poly.exterior, *poly.interiors)] for poly in parts(polys, "Polygon") if poly.area > .00001]


reader = shapefile.Reader(sys.argv[1])
lines, quays, walls = [], [], []
for item in reader.iterShapeRecords(bbox=(-122.435, 37.767, -122.37, 37.821)):
    # Preserve multipart feature boundaries and the common endpoints shared by records.
    breaks = list(item.shape.parts)+[len(item.shape.points)]
    for begin, end in zip(breaks, breaks[1:]):
        geom = LineString([project(p) for p in item.shape.points[begin:end]]).intersection(extent)
        for line in parts(geom, "LineString"):
            lines.append(line)
            if item.record.ATTRIBUTE == "Man-made.Wharf Or Quay":
                quays.append(line)
            if item.record.ATTRIBUTE == "Man-made.Bulkhead Or Sea Wall":
                walls.append(line)
faces = list(polygonize(unary_union(lines+[extent.boundary])))
mainland = next(poly for poly in faces if poly.contains(Point(0, -40)))
# NOAA maps the outer visible wharf edge. Join its two surveyed landfalls behind
# the pile deck. Never bridge across a water inlet if a quay turns shoreward.
quay_area = []
for run in parts(linemerge(unary_union(quays)), "LineString"):
    if len(run.coords) < 3:
        continue
    deck = Polygon(run.coords).buffer(0).intersection(mainland)
    if not deck.is_empty:
        quay_area.append(deck)
mapped = [Polygon(p["p"]).buffer(0) for p in base["piers"] if p["closed"]]
mapped.append(Polygon(south["features"]["wharf"]))
mapped_decks = unary_union(mapped)
cut_land = mainland.difference(unary_union(quay_area + [mapped_decks]))
# Two vintages of survey diverge by centimetres to metres at pier edges.
# A disconnected splinter outside a mapped apron is not an island.
land = next(poly for poly in parts(cut_land, "Polygon") if poly.contains(Point(0, -40)))
rincon = Polygon(next(park["p"] for park in base["parks"] if park["name"] == "Rincon Park")).intersection(land)
# Survey wharves without a separately modelled OSM deck still need their own slab.
# Trim tiny outer-edge slivers where the two surveys depict the same entire pier.
extra_decks = []
for poly in parts(unary_union(quay_area), "Polygon"):
    if poly.intersection(mapped_decks).area < poly.area * .80:
        extra_decks.extend(parts(poly.difference(mapped_decks), "Polygon"))
extras = unary_union(extra_decks)
# Cap only genuine seawalls. Intersect the inboard offset with solid land so
# corner joins follow the survey and never overhang a deck or navigable water.
caps = land.intersection(unary_union(walls).buffer(.065, cap_style="flat", join_style="mitre"))
# Cut only the triangles that cross the surveyed water. Retaining the original
# cell diagonals lets the runtime sample the same terrain planes on either side
# of the join. The exact survey replaces this edge, not the entire mainland.
water = extent.difference(land)
clipped = {}
tide_vertices = {}
for grid in relief["grids"]:
    cells = []
    indices = set()
    cols, rows, step = grid["cols"], grid["rows"], grid["step"]
    for row in range(rows-1):
        y = grid["south"]+row*step
        if y+step < 37.767 or y > 37.821:
            continue
        for col in range(cols-1):
            x = grid["west"]+col*step
            if x+step < -122.435 or x > -122.37:
                continue
            a, b, c, d = [project(p) for p in [(x,y),(x+step,y),(x,y+step),(x+step,y+step)]]
            cell = Polygon([a,b,d,c])
            if not water.intersects(cell):
                continue
            i = row*cols+col
            # Land outside the surveyed extent retains the source DEM.
            cells.append([i, rings(Polygon([a,b,c]).difference(water)), rings(Polygon([b,d,c]).difference(water))])
            if land.intersects(cell):
                indices.update([i,i+1,i+cols,i+cols+1])
    if cells:
        clipped[grid["name"]] = cells
        tide_vertices[grid["name"]] = sorted(indices)

# Exclude the artificial closing edges of the import crop. The remaining
# shoreline segments include both seawalls and the inboard edges of pile decks.
bank_edges = []
for r in (land.exterior, *land.interiors):
    for a, b in zip(r.coords, list(r.coords)[1:]):
        line = LineString([a,b])
        if line.length > .0001 and extent.boundary.distance(line.interpolate(.5, normalized=True)) > .0007:
            bank_edges.append([list(map(lambda v: round(v, 4), p)) for p in (a,b)])

# Only support the newly baked quay surfaces; named OSM piers have their own
# bents, and the rebuilt ferry terminal owns its apron and floating landings.
piles = []
for poly in parts(extras, "Polygon"):
    inner = poly.buffer(-.09)
    for patch in parts(inner, "Polygon"):
        if patch.area < .3:
            continue
        a, b, c, d = patch.bounds
        count = 0
        for i in range(math.ceil(a / 1.15), math.floor(c / 1.15)+1):
            for j in range(math.ceil(b / 1.15), math.floor(d / 1.15)+1):
                point = Point(i*1.15, j*1.15)
                if patch.contains(point):
                    piles.append([round(point.x, 3), round(point.y, 3)])
                    count += 1
        if not count:
            point = patch.representative_point()
            piles.append([round(point.x, 3), round(point.y, 3)])

result = dict(source="NOAA NGS CUSP N35W125; OpenStreetMap contributors",
              sourceUrl="https://nsde.ngs.noaa.gov/", land=rings(land), caps=rings(caps), rincon=rings(rincon),
              decks=rings(extras), piles=piles, coastalCells=clipped, tidalVertices=tide_vertices, bankEdges=bank_edges)
(DATA / "survey-shore.json").write_text(json.dumps(result, separators=(",", ":"))+"\n")
print("Survey area, land, unmodelled decks, cap area:", extent.area, land.area, extras.area, caps.area)
