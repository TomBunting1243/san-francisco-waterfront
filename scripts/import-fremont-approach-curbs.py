"""Rebuild the Fremont approach curb profiles from municipal polygons and the
2024 SF 8 cm orthophoto. The Fremont/Howard plate is 7 px/m; (245,245)
is 37.78932357434, -122.39498414125. The surveyed first-floor wall belongs
to 215 Fremont. Its threshold meets the civic sidewalk at u206, v311.
"""
import bisect
import json
import math
from pathlib import Path

from shapely import constrained_delaunay_triangles, get_parts
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

BASE=Path(__file__).resolve().parents[1]/'public/data'
def read(name):
    return json.loads((BASE/(name+'.json')).read_text())

parcels=read('survey-blocks')['streets']
overrides=read('curb-survey')['overrides']
registered=read('fremont-corner-curbs')['stations']
source_parcels={}
for kind,index in [('sidewalk',224),('curb',350),('sidewalk',226),('curb',349),('sidewalk',223)]:
    source=overrides.get(kind,{}).get(str(index),[parcels[kind][index]])
    (outline,*holes),*other=source
    stations=registered.get(kind,{}).get(str(index),{})
    source_parcels[kind+str(index)]=[[[p for i,pt in enumerate(outline) for p in stations.get(str(i),[pt])],*holes],*other]

# Each measured patch is bounded by the colored 2024 aerial pixels. Panel
# footprints and ramp slopes are fitted; the image does not resolve domes.
east_panels=unary_union([
    Polygon([(189.7,301.7),(194.55,301.95),(194.3,309.6),(189.45,309.35)]),
    Polygon([(201.35,288.0),(209.65,287.1),(210.2,291.65),(201.9,292.55)]),
])
a = 0.0012973094
b = -0.0084729829
c = 0.0084728164
d = 0.001296584
X = -27.00800104
Z = -33.37263659
def uv(q):
    x, z = (q[0] - X, q[1] - Z)
    return (round((d * x - b * z) / (a * d - b * c), 5), round((-c * x + a * z) / (a * d - b * c), 5))
def plate_ring(q):
    return [uv(p) for p in q]
def shape(poly):
    return Polygon(plate_ring(poly[0]), [plate_ring(r) for r in poly[1:]]).buffer(0)
world = {k: [shape(o) for o in v] for k, v in source_parcels.items()}
def polygons(g):
    return [p for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon' and p.area > 1e-06]
def scene(u, v):
    return [round(X + a * u + b * v, 6), round(Z + c * u + d * v, 6)]
def pack(poly):
    return [[scene(u, v) for u, v in list(r.coords)[:-1]] for r in [poly.exterior, *poly.interiors]]
over = {}
vertices = []
indices = {}
index = {}
def emit(points, color, face=None):
    ids = []
    if face is None and Polygon([(u, v) for u, h, v in points]).exterior.is_ccw:
        points = points[::-1]
    for u, y, v in points:
        key = (round(u, 3), round(v, 3), round(y, 6))
        if key not in index:
            index[key] = len(vertices)
            vertices.append(key)
        ids.append(index[key])
    if len(set(ids)) == 3:
        indices.setdefault(color, []).extend(ids)
def fill(poly, height, color):
    for part in polygons(poly):
        for tri in get_parts(constrained_delaunay_triangles(part)):
            if tri.area < 1e-05:
                continue
            pts = list(tri.exterior.coords)[:3]
            emit([(u, height(u, v), v) for u, v in pts], color)
def const(h):
    return lambda u, v: h
# Municipal tree positions are independent of the curb. A single inventory
# width is known; fit a square wherever it fits behind the intact stone cap.
# By partitioning the original polygons the earth inherits the actual slope.
ginkgos = read('fremont-ginkgos')
stem_points = [Point(uv(row[1:3])) for row in ginkgos]
beds = unary_union([box(pt.x-half, pt.y-half, pt.x+half, pt.y+half)
                    for row, pt in zip(ginkgos, stem_points)
                    for half in [row[4]*.3048*7/2]])
stem_grades = [None]*len(stem_points)
def plant_cutouts(poly, height):
    if not poly.intersects(beds):
        return poly
    soil = poly.intersection(beds)
    fill(soil, height, 'soil')
    for i, pt in enumerate(stem_points):
        if soil.covers(pt):
            stem_grades[i] = round(height(pt.x, pt.y), 7)
    return poly.difference(beds)

for side, wi, ci, lo, hi in [('west', 224, 350, -16, 90), ('east', 226, 349, 165, 494)]:
    clip = box(lo, 285, hi, 790.5)
    for k in ['sidewalk' + str(wi), 'curb' + str(ci)]:
        # Preserve untouched components in their original order.
        over[k] = [pack(poly) for p in world[k] for poly in polygons(p.difference(clip))]
    patch = unary_union(world['sidewalk' + str(wi)] + world['curb' + str(ci)]).intersection(clip)
    if side == 'east':
        patch = patch.union(unary_union([box(198, 311, 206, 790.5), box(199, 305.5, 494, 311)]))
    else:
        # 2023 point-cloud west wall runs from u30 at v311 to u27 at v893.
        west_end = 30 - 3 * (790.5 - 311) / (893 - 311)
        wall_walk = Polygon([(30, 311), (40, 311), (40, 790.5), (west_end, 790.5)])
        patch = patch.union(unary_union([wall_walk, box(lo, 308.7, 40, 312)]))
    outer = max(polygons(patch), key=lambda p: p.area)
    ring = list(outer.exterior.coords)[:-1]
    # Find outer street-facing path between its two clipped ends.
    ends = [i for i, (u, v) in enumerate(ring) if abs(u - (lo if side == 'west' else hi)) < 0.0001]
    start = min(ends, key=lambda i: ring[i][1])
    ends = [i for i, (u, v) in enumerate(ring) if abs(v - 790.5) < 0.0001]
    end = (max if side == 'west' else min)(ends, key=lambda i: ring[i][0])
    n = len(ring)
    paths = []
    for direction in [-1, 1]:
        p = [ring[start]]
        j = start
        while j != end:
            j = (j + direction) % n
            p.append(ring[j])
        paths.append(p)
    path = next((p for p in paths if all((v < 790.49 for u, v in p[1:-1])) and all((abs(u - (lo if side == 'west' else hi)) > 0.001 for u, v in p[1:-1]))))
    if side == 'east':
        # The first four controls follow the Howard-side lip, the last four tie
        # back into the straight Fremont curb. The corner behind the car is fitted
        # between the visible yellow rectangles and the adjoining straight edges.
        old = LineString(path)
        near = old.interpolate(old.project(Point(258, 291))).coords[0]
        far = old.interpolate(old.project(Point(189.4, 365))).coords[0]
        n0 = next((i for i, p in enumerate(path) if p[0] < 258))
        n1 = next((i for i, p in enumerate(path) if p[1] > 365))
        middle=[near,(240,287.6),(222,286.4),(212,285.65),(206,286.10),
                                        (200,286.85),(196,288.45),(192.5,291.4),(189.6,295.3),
                                        (188.25,299.4),(188.05,304.1),(188.15,309.6),(187.9,317.4),
                                        (188.5,336),far]
        delta = Polygon([near, *path[n0:n1], far, *reversed(middle[1:-1])]).buffer(0)
        outer = outer.union(delta)
        path = [*path[:n0], *middle, *path[n1:]]
        # Clip only the local street face. Start with Natoma's municipal
        # remainder so the separated crossing on the same road parcel is preserved.
        road = read('natoma-landings')['remainder']['street78']
        road_cut = outer.intersection(box(164, 280, 259, 365))
        over['street78'] = [pack(r) for part in road for r in polygons(shape(part).difference(road_cut))]
    axis = LineString(path)
    original = [axis.project(Point(pt)) for pt in path]
    centers = [axis.project(Point(pt)) for pt in ([(33.3, 293.2), (52.5, 309.7)] if side == 'west' else [(205.8, 289.8), (192.0, 305.65)])]
    half_mouth = 6.8 if side == 'east' else 4.2
    flare = 5.8 if side == 'east' else 4.8
    stations = sorted(set(original + [q + delta for q in centers for delta in [-half_mouth - flare, -half_mouth, half_mouth, half_mouth + flare]]))
    def normal(i):
        x0, y0 = path[i]
        x1, y1 = path[i + 1]
        dx, dy = (x1 - x0, y1 - y0)
        length = math.hypot(dx, dy)
        sign = 1 if side == 'west' else -1
        return (-dy / length * sign, dx / length * sign)
    def section(s):
        i = min(len(path) - 2, bisect.bisect_right(original, s) - 1)
        u, v = axis.interpolate(s).coords[0]
        nx, ny = normal(i)
        if i > 0 and abs(s - original[i]) < 1e-06:
            ax, ay = normal(i - 1)
            factor = 1 + ax * nx + ay * ny
            nx, ny = ((nx + ax) / factor, (ny + ay) / factor)
        q = min(1, max(0, (min((abs(s - p) for p in centers)) - half_mouth) / flare))
        top = 0.03145 + q * 0.00925
        rear = 2.8 + (1 - q) * 12.0
        return [(u, 0.031, v), (u, top, v), (u + 1.55 * nx, top, v + 1.55 * ny), (u + rear * nx, 0.045, v + rear * ny)]
    # A single grade field for the convex 215 corner keeps the two ramps
    # continuous where their inward station normals converge.
    cap_back = [section(s)[2] for s in stations]
    gutter_axis = LineString([(u, v) for u, h, v in cap_back])
    gutter_stations = [gutter_axis.project(Point(u, v)) for u, h, v in cap_back]
    def corner_grade(u, v):
        pt = Point(u, v)
        at = gutter_axis.project(pt)
        i = max(0, min(len(stations) - 2, bisect.bisect_right(gutter_stations, at) - 1))
        length = gutter_stations[i + 1] - gutter_stations[i]
        t = (at - gutter_stations[i]) / length if length > 1e-06 else 0
        h = cap_back[i][1] + t * (cap_back[i + 1][1] - cap_back[i][1])
        raised = max(0, min(1, (h - 0.03145) / 0.00925))
        run = 1.25 + (1 - raised) * 12
        return h + (0.045 - h) * min(1, gutter_axis.distance(pt) / run)
    repaired = []
    first_station = axis.project(Point(240, 287.6))
    last_station = axis.project(Point(188.5, 336))
    covered = []
    for start, end in zip(stations, stations[1:]):
        first_section, last_section = (section(start), section(end))
        # Winding gives outward-facing vertical road side for each side's travel.
        for tri in [[first_section[0], last_section[1], last_section[0]], [first_section[0], first_section[1], last_section[1]]]:
            emit(tri if side == 'west' else tri[::-1], 'face', True)
        in_repair = side == 'east' and first_station - 0.0001 <= start and (end <= last_station + 0.0001)
        if in_repair:
            if not repaired:
                repaired.append(first_section)
            repaired.append(last_section)
        for j in [1, 2]:
            if j == 2 and in_repair:
                continue
            pts = [first_section[j], last_section[j], last_section[j + 1], first_section[j + 1]]
            for ids in [(0, 1, 2), (0, 2, 3)]:
                facet = [pts[k] for k in ids]
                foot = Polygon([(u, v) for u, h, v in facet])
                if foot.area < 1e-05:
                    continue
                r = foot.intersection(outer)
                # Avoid tiny overlaps at sharp changes of tangent near the ramp shoulders.
                if covered:
                    r = r.difference(unary_union(covered[-8:]))
                triCoords = [(u, v) for u, h, v in facet]
                h0 = facet[0][1]
                u0, v0 = triCoords[0]
                du1, dv1 = (triCoords[1][0] - u0, triCoords[1][1] - v0)
                du2, dv2 = (triCoords[2][0] - u0, triCoords[2][1] - v0)
                denom = du1 * dv2 - du2 * dv1
                def grade(u, v):
                    return h0 + ((u - u0) * dv2 - (v - v0) * du2) / denom * (facet[1][1] - h0) + (du1 * (v - v0) - dv1 * (u - u0)) / denom * (facet[2][1] - h0)
                if not r.is_empty:
                    apron = 'warning' if j == 2 and min((abs((start + end) / 2 - p) for p in centers)) <= 4.2 else 'shoulder'
                    if apron == 'warning' and side == 'west':
                        # Short ochre detectable strip just behind the curb, not a yellow full ramp.
                        band = axis.buffer(5.7).difference(axis.buffer(1.7))
                        fill(r.intersection(band), grade, apron)
                        fill(r.difference(band), grade, 'shoulder')
                    else:
                        if j == 1:
                            fill(r, grade, 'cap')
                        else:
                            fill(plant_cutouts(r, grade), grade, 'shoulder')
                    covered.append(r)
    if repaired:
        back = [(row[2][0], row[2][2]) for row in repaired]
        tail = repaired[-1][3]
        head = repaired[0][3]
        boundary = Polygon([*back, (tail[0], tail[2]), (222, 336), (240, 315), (head[0], head[2])])
        interior = boundary.intersection(outer).difference(unary_union(covered))
        # At a tight convex corner the two ramps meet inside the radius of the
        # turn. Triangulate the shared apron once, with a continuous grade field.
        # The grid samples the slope, not individual detectable domes.
        spacing = 4
        for u in range(184, 244, spacing):
            for v in range(280, 340, spacing):
                cell = interior.intersection(box(u, v, u + spacing, v + spacing))
                if cell.is_empty:
                    continue
                for tri in get_parts(constrained_delaunay_triangles(cell)):
                    if tri.area < 1e-05:
                        continue
                    (x0, y0), (x1, y1), (x2, y2) = list(tri.exterior.coords)[:3]
                    h0, h1, h2 = (corner_grade(x, y) for x, y in [(x0, y0), (x1, y1), (x2, y2)])
                    det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
                    dx = ((h1 - h0) * (y2 - y0) - (h2 - h0) * (y1 - y0)) / det
                    dy = ((h2 - h0) * (x1 - x0) - (h1 - h0) * (x2 - x0)) / det
                    def plane(x, y):
                        return h0 + (x - x0) * dx + (y - y0) * dy
                    fill(tri.intersection(east_panels), plane, 'warning')
                    fill(tri.difference(east_panels), plane, 'shoulder')
        covered.append(interior)
    flat = outer.difference(unary_union(covered))
    # A narrow scored joint separates real concrete panels across the approach sidewalk.
    joints = unary_union([box(lo, v - 0.1, hi, v + 0.1) for v in range(334, 791, 22)])
    # Remove paving scores within the planting plots.
    flat = plant_cutouts(flat, const(0.045))
    fill(flat.intersection(joints), const(0.045), 'joint')
    fill(flat.difference(joints), const(0.045), 'walk')
# The Foundry I ground returns also identify a slim missing strip behind the
# opposite sidewalk. Add only the actual gap outside that municipal plan.
nw = unary_union([box(32, -200, 45, 140), box(-16, 134, 45, 146)]).difference(unary_union(world['sidewalk223']))
fill(nw, const(0.045), 'walk')
payload = {'source': '2024 SF 8 cm orthophoto and city survey; Fremont southern corner returns. Local coordinates are seven pixels/metre.', 'remainder': over, 'vertices': vertices, 'faces': indices}
assert all(h is not None for h in stem_grades)
payload['ginkgoGrades'] = stem_grades
dst = BASE / 'fremont-approach-curbs.json'
dst.write_text(json.dumps(payload, separators=(',', ':')) + '\n')
print('verts/triangles', len(vertices), sum(map(len, indices.values())) // 3, 'bytes', dst.stat().st_size)
