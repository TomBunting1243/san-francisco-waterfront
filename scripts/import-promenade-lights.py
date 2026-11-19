"""Import the SFPUC's public lamp inventory. Optional argv[1] is cached GeoJSON."""
import json
import math
import sys
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

DATA = Path(__file__).resolve().parents[1] / 'public/data'
SERVICE = 'https://services.arcgis.com/Zs2aNLFN00jrS4gG/arcgis/rest/services/SFPUC_Streetlights/FeatureServer/0'
params = dict(where="status='ACTIVE' AND pole_type='SL-FluteSteel' AND street_name IN ('EMBARCADERO_SOUTH','EMBARCADERO_NORTH')",
              geometry='-122.401,37.786,-122.382,37.804', geometryType='esriGeometryEnvelope',
              inSR=4326, outSR=4326, outFields='objectid,pole_type,street_name,status', f='geojson')
inventory = json.loads(Path(sys.argv[1]).read_text()) if len(sys.argv) > 1 else json.load(urlopen(SERVICE+'/query?'+urlencode(params),timeout=40))
if inventory.get('exceededTransferLimit') or not inventory.get('features'):
    raise ValueError('Incomplete SFPUC streetlight response')
sf = json.loads((DATA/'sf-waterfront.json').read_text())
lat, lon = sf['origin']
segments = [(a,b) for road in sf['roads'] if road['name']=='The Embarcadero'
            for a,b in zip(road['p'],road['p'][1:]) if abs(a[0]-b[0])>.01]
bridgeStart, bridgeEnd = sf['bridge']['centerline'][:2]
bridgeSlope=(bridgeEnd[0]-bridgeStart[0])/(bridgeEnd[1]-bridgeStart[1])
pier = next(p['p'] for p in sf['piers'] if p['name']=='Pier 7')
pierX = (min(p[0] for p in pier)+max(p[0] for p in pier))/2
# City General Plan Policy 10.15: double heads between the Agriculture Building
# and Pier 1. The inventory has pole type and location but no luminaire counts.
doubleStart = min(p[0] for p in next(b['p'] for b in sf['buildings'] if b['name']=='Ferry Station Post Office Building'))
doubleEnd = min(p[0] for p in next(b['p'] for b in sf['buildings'] if b['name']=='Pier 1'))
curb, inland = [], []
for feature in inventory['features']:
    props=feature['properties']
    if props['street_name'] not in ('EMBARCADERO_NORTH','EMBARCADERO_SOUTH') or props['pole_type']!='SL-FluteSteel' or props['status']!='ACTIVE':
        continue
    lng,latitude=feature['geometry']['coordinates']
    e,n=(lng-lon)*111320*math.cos(math.radians(lat)),(latitude-lat)*111320
    x,z=-.03552029735*e+.04836012986*n,.04836012986*e+.03552029735*n
    if x<bridgeStart[0]+bridgeSlope*(z-bridgeStart[1]) or x>pierX:
        continue
    surfaces=[(a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]),(b[1]-a[1])/(b[0]-a[0])) for a,b in segments if min(a[0],b[0])<=x<=max(a[0],b[0])]
    if not surfaces:
        continue
    outer,inner=max(surfaces),min(surfaces)
    if .1 < z-outer[0] < 1.0:
        group,slope=curb,outer[1]
    elif .1 < inner[0]-z < 1.0:
        group,slope=inland,inner[1]
    else:
        continue
    group.append([props['objectid'],round(x,4),round(z,4),round(math.atan2(-1,-slope),4),2 if doubleStart<=x<=doubleEnd else 1])
curb.sort(key=lambda p:p[1])
inland.sort(key=lambda p:p[1])
# Centers picked on the 2024 8-cm SF orthophoto. Reprojection:
# x = 28.52 - pixelY/145 ; z = -1 + pixelX/145. Right is offshore.
# Each pair has a footing and a pole shadow on each side. The wider middle
# platform has a gap in the lamp row where its benches occupy the edges.
columns=[29,96,175,255,335,414,493,573,652,732,811,891,970,1131,1210,
         1289,1368,1448,1527,1607,1677,1745,1815,1884,1953,2022,2091,2167,2246]
pierRows=[]
for col in columns:
    z=-1+col/145
    crossings=sorted(a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]) for a,b in zip(pier,pier[1:]) if min(a[1],b[1])<z<max(a[1],b[1]))
    # Align the two aerial rows to the local OSM deck center. The ~1 m
    # transverse registration correction keeps all bases on the rendered deck.
    drift=(crossings[0]+crossings[-1])/2-(28.52-190/145)
    xs=[min(crossings[-1]-.012,max(crossings[0]+.012,28.52-row/145+drift)) for row in (222,158)]
    pierRows.append([round(z,4),*(round(x,4) for x in xs)])
result=dict(source=SERVICE,classification='SF General Plan NE Waterfront 10.15',ortho='https://tile.sf.gov/api/tiles/p2024_rgb8cm',
            curb=curb,inland=inland,pier=pierRows)
(DATA/'promenade-lights.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
