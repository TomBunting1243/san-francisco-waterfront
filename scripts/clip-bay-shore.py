#!/usr/bin/env python3
"""Clip the existing animated grid to NOAA CUSP dry land. Requires Shapely 2.1+."""
import json
from pathlib import Path

from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

data = Path(__file__).resolve().parents[1] / 'public/data'
source = json.loads((data / 'survey-shore.json').read_text())
land = unary_union([Polygon(shell, holes) for shell, *holes in source['land']])
# Match PlaneGeometry's two apron rows and NW/SW/NE, SW/SE/NE triangle order.
size, cols, rows = 1400, 120, 110
stride = cols + 3
points, index, faces, dry = [], {}, [], []


def register(p):
    x, z = tuple(round(v, 6) for v in p)
    col, row = (x / size + .5) * cols + 1, (z / size + .5) * rows + 1
    if abs(col - round(col)) < 1e-6 and abs(row - round(row)) < 1e-6:
        return round(row) * stride + round(col)
    if (x, z) not in index:
        index[x, z] = stride * (rows + 3) + len(points)
        points.append([x, z])
    return index[x, z]


for row in range(1, rows + 1):
    z = ((row-1) / rows - .5) * size
    for col in range(1, cols + 1):
        x = ((col-1) / cols - .5) * size
        dx, dz = size / cols, size / rows
        if x > land.bounds[2] or x+dx < land.bounds[0] or z > land.bounds[3] or z+dz < land.bounds[1]:
            continue
        a, b, c, d = (x,z), (x,z+dz), (x+dx,z+dz), (x+dx,z)
        for half, corners in enumerate([(a,b,d), (b,c,d)]):
            triangle = Polygon(corners)
            if triangle.intersection(land).area < 1e-10:
                continue
            dry.append(2 * (row * (cols+2) + col) + half)
            for poly in constrained_delaunay_triangles(triangle.difference(land)).geoms:
                if poly.area < 1e-10:
                    continue
                vertices = list(poly.exterior.coords)[:3]
                if poly.exterior.is_ccw:
                    vertices.reverse()
                faces.extend(register(v) for v in vertices)

runs = []
for tri in dry:
    if runs and tri == sum(runs[-1]):
        runs[-1][1] += 1
    else:
        runs.append([tri, 1])
# Both portfolio scenes retain the original flat 240 x 240 water extent.
flat_points, flat_indices, lookup = [], [], {}
for tri in constrained_delaunay_triangles(box(-120,-120,120,120).difference(land)).geoms:
    corners = list(tri.exterior.coords)[:3]
    if tri.exterior.is_ccw:
        corners.reverse()
    for point in corners:
        if point not in lookup:
            lookup[point] = len(flat_points)
            flat_points.append([round(v, 6) for v in point])
        flat_indices.append(lookup[point])
(data/'bay-shore-cut.json').write_text(json.dumps(
    dict(grid=[size,cols,rows], removed=runs, points=points, indices=faces,
         flat=dict(points=flat_points,indices=flat_indices)), separators=(',', ':')) + '\n')
