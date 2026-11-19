"""Trace the California cable tracks from an OSM map extract, retaining the switch and stop nodes."""
import json
import math
from pathlib import Path
import sys

source = json.loads(Path(sys.argv[1]).read_text())['elements']
nodes = {e['id']: e for e in source if e['type'] == 'node'}
ways = {e['id']: e['nodes'] for e in source if e['type'] == 'way'}
origin_lat, origin_lon = 37.79554, -122.39348
terminal = 5150140443

def join(parts):
    result = list(parts[0])
    for part in parts[1:]:
        if result[-1] != part[0]:
            raise ValueError('Disconnected California cable track')
        result.extend(part[1:])
    return result

# The downtown surface district ends inland. Retain both approaches through
# Kearny, well past the readable Market Street view; the hidden trip continues west.
outbound = join([ways[680987090], ways[144783747]])
outbound = outbound[:outbound.index(5150140437) + 1]
up = ways[142961070]
inbound = join([up[up.index(6315233708):], ways[775883312], ways[680987092], ways[680987090][::-1]])
assert inbound[-1] == outbound[0] == terminal

def project(i):
    n = nodes[i]
    e = (n['lon'] - origin_lon) * 111320 * math.cos(math.radians(origin_lat))
    k = (n['lat'] - origin_lat) * 111320
    return [round(-.03552029735*e + .04836012986*k, 4), round(.04836012986*e + .03552029735*k, 4)]

data = {'source': 'OpenStreetMap, California cable line. Coordinates in the waterfront local grid.',
        'outbound': outbound, 'inbound': inbound, 'stub': ways[30035709],
        'nodes': {i: project(i) for i in sorted(set(outbound + inbound + ways[30035709]))},
        'stops': [i for i in sorted(set(outbound + inbound)) if nodes[i].get('tags', {}).get('public_transport') == 'stop_position']}
dest = Path(__file__).resolve().parents[1] / 'public/data/california-terminal.json'
dest.write_text(json.dumps(data, separators=(',', ':')) + '\n')
