"""Select active SFPUC street-light poles near the separately modeled road surfaces."""
import base64
import json
import math
from pathlib import Path
import struct
import sys

data = Path(__file__).resolve().parents[1] / 'public/data'
source = 'https://services.arcgis.com/Zs2aNLFN00jrS4gG/arcgis/rest/services/SFPUC_Streetlights/FeatureServer/0'
# Input GeoJSON: WGS84, ordered by objectid, all result pages, within
# -122.424,37.763,-122.379,37.806; active SL-* and TP-POG* poles.
features = json.loads(Path(sys.argv[1]).read_text())['features']
survey = json.loads((data / 'survey-blocks.json').read_text())
extensions = json.loads((data / 'sightline-streets.json').read_text())
approach = json.loads((data / 'approach-soma.json').read_text())
paths = [r['points'] for r in approach['roads']] + [r['p'] for r in survey['outsideRoads']]
for kind in ('street', 'alley', 'private'):
    for outer, *_ in survey['streets'].get(kind, []):
        paths.append(outer + outer[:1])
for outer, *_ in extensions['street']:
    paths.append(outer + outer[:1])

cells = set()
for path in paths:
    for a, b in zip(path, path[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]
        steps = max(1, math.ceil(math.hypot(dx, dz)))
        for i in range(steps + 1):
            x, z = math.floor((a[0] + dx*i/steps)/2), math.floor((a[1] + dz*i/steps)/2)
            cells.update((x+j, z+k) for j in (-1, 0, 1) for k in (-1, 0, 1))
lat, lon = json.loads((data / 'sf-waterfront.json').read_text())['origin']
points = []
for f in features:
    lng, latitude = f['geometry']['coordinates']
    e = (lng-lon)*111320*math.cos(math.radians(lat))
    n = (latitude-lat)*111320
    x, z = -.03552029735*e+.04836012986*n, .04836012986*e+.03552029735*n
    if (math.floor(x/2), math.floor(z/2)) in cells:
        points.append((round(x*100), round(z*100)))
points.sort()
encoded = base64.b64encode(b''.join(struct.pack('<hh', *p) for p in points)).decode()
result = dict(source=source, count=len(points), coordinates=encoded)
(data / 'authored-street-lamps.json').write_text(json.dumps(result,separators=(',', ':'))+'\n')
print(len(points), 'of', len(features), 'active features selected')
