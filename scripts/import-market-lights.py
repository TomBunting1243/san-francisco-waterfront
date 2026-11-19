"""Project the public SFPUC Path of Gold inventory onto the lower Market model."""
import json
import math
import sys
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

DATA = Path(__file__).resolve().parents[1] / 'public/data'
SERVICE = 'https://services.arcgis.com/Zs2aNLFN00jrS4gG/arcgis/rest/services/SFPUC_Streetlights/FeatureServer/0'
params = dict(where="street_name LIKE 'MARKET%' AND status='ACTIVE' AND pole_type='TP-POGsteel'",
              geometry='-122.408,37.786,-122.393,37.795', geometryType='esriGeometryEnvelope',
              inSR=4326, outSR=4326, outFields='objectid,pole_type,street_name,status', f='geojson')
reply = (json.loads(Path(sys.argv[1]).read_text()) if len(sys.argv) > 1 else
         json.load(urlopen(SERVICE + '/query?' + urlencode(params), timeout=40)))
if not reply.get('features') or reply.get('exceededTransferLimit'):
    raise ValueError('Incomplete SFPUC pole inventory')
lat, lon = json.loads((DATA / 'sf-waterfront.json').read_text())['origin']
pavement = json.loads((DATA / 'survey-blocks.json').read_text())['streets']


def inside(x, z, ring):
    hit = False
    for (ax, az), (bx, bz) in zip(ring, ring[1:] + ring[:1]):
        if (az > z) != (bz > z) and x < ax + (bx - ax) * (z - az) / (bz - az):
            hit = not hit
    return hit


def grade(x, z):
    for kind, y in [('curb', .049), ('sidewalk', .045), ('street', .031)]:
        for outer, *holes in pavement[kind]:
            if inside(x, z, outer) and not any(inside(x, z, h) for h in holes):
                return y
    return .031


poles = []
for feature in reply['features']:
    p = feature['properties']
    if p['pole_type'] != 'TP-POGsteel' or p['status'] != 'ACTIVE' or not p['street_name'].startswith('MARKET'):
        continue
    lng, latitude = feature['geometry']['coordinates']
    east = (lng - lon) * 111320 * math.cos(math.radians(lat))
    north = (latitude - lat) * 111320
    x = -.03552029735 * east + .04836012986 * north
    z = .04836012986 * east + .03552029735 * north
    if -61 <= z < -9:
        poles.append([p['objectid'], round(x, 4), round(z, 4), grade(x, z)])
poles.sort(key=lambda p: -p[2])
if not poles or len({p[0] for p in poles}) != len(poles):
    raise ValueError('Missing or repeated lower Market pole IDs')
(DATA / 'market-lights.json').write_text(json.dumps(dict(source=SERVICE, poles=poles), separators=(',', ':')) + '\n')
