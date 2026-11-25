"""Build Fremont approach and Howard east-block paint from 2024 SF 8 cm imagery.

Input units are pixels at 7 px/m with image right at 45 degrees from north.
(245,245) = 37.78932357434, -122.39498414125. Intersection paint has been
registered independently from the Beale crossing at the far end of the block.
"""
import json
from pathlib import Path

from shapely import LineString, Polygon, union_all
from shapely.affinity import affine_transform
from shapely.geometry import box

from road_paint_surface import BASE, road_paint_surface

TRACES = Path(__file__).with_name('fremont-marking-traces.json')
# The six coefficients fit the city's local scene grid to the rectified photo.
PLATE_TO_SCENE = [.0012973094, -.0084729829, .0084728164, .0012965840,
                  -27.00800104, -33.37263659]

def build():
    records = json.loads(TRACES.read_text())
    inks = {color: [] for color in ('white', 'green', 'yellow')}
    for record in records:
        points = record['points']
        width = record.get('width')
        plate = (LineString(points).buffer(width / 2, cap_style='flat', join_style='mitre')
                 if width else Polygon(points))
        inks[record['color']].append(affine_transform(plate, PLATE_TO_SCENE))
    inks = {color: union_all(shapes) for color, shapes in inks.items()}
    # Cut the white pocket edges out of the green before triangulation.
    inks['green'] = inks['green'].difference(inks['white'])
    inks['yellow'] = inks['yellow'].difference(inks['white'])
    bounds = box(*union_all(list(inks.values())).buffer(.06).bounds)
    clip = road_paint_surface(bounds, bounds)
    batches = []
    for color, surface in inks.items():
        vertices, index, faces = [], {}, []
        def vertex(p):
            key = tuple(p)
            if key not in index:
                index[key] = len(vertices)
                vertices.append([p[0], p[2], p[1]])
            return index[key]
        for a, b, c in clip(surface):
            up = (b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1])
            if abs(up) > 1e-10:
                faces.extend(vertex(p) for p in ((a,b,c) if up > 0 else (a,c,b)))
        batches.append({'ink': color, 'vertices': vertices, 'indices': faces})
    data = {'batches': batches}
    (BASE/'fremont-markings.json').write_text(json.dumps(data, separators=(',',':'))+'\n')
    print(f"{len(records)} traces, {sum(len(b['vertices']) for b in batches)} vertices, {sum(len(b['indices']) for b in batches)//3} triangles")

if __name__ == '__main__':
    build()
