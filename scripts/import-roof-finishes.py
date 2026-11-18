"""Paint stable roof-interior observations from the USDA NAIP 2022 RGB mosaic.
Usage: survey-env/bin/python scripts/import-roof-finishes.py <external tile cache>
The local cache holds square, EPSG:3857, one-projected-metre pixels.
"""
import argparse
import json
import math
import subprocess
import warnings
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlencode

import numpy as np
from affine import Affine
import rasterio
from rasterio.io import MemoryFile
from rasterio.errors import NotGeoreferencedWarning
from rasterio.features import geometry_mask
from shapely.geometry import Polygon, mapping

DATA = Path(__file__).resolve().parents[1] / 'public/data'
SOURCE = 'https://gis.wildlife.ca.gov/images/rest/services/Base_Remote_Sensing/NAIP_2022/ImageServer'
SIZE = 1536
SCALE = .06

def web(x, z):
    east = (-.03552029735*x+.04836012986*z)/.0036
    north = (.04836012986*x+.03552029735*z)/.0036
    lon = -122.39348 + east/(111320*math.cos(math.radians(37.79554)))
    lat = 37.79554 + north/111320
    return 6378137*math.radians(lon), 6378137*math.asinh(math.tan(math.radians(lat)))

def tile_reader(cache):
    cache.mkdir(parents=True, exist_ok=True)
    # PNG coordinates are carried in the exact export bounds, not a sidecar.
    warnings.filterwarnings('ignore', category=NotGeoreferencedWarning, module=r'rasterio(\.|$)')
    @lru_cache(maxsize=16)
    def tile(col, row):
        left, bottom = col*SIZE, row*SIZE
        file = cache/f'naip2022-rgb-{left}-{bottom}-{SIZE}.png'
        if not file.exists():
            query = urlencode(dict(bbox=f'{left},{bottom},{left+SIZE},{bottom+SIZE}',bboxSR=3857,
                imageSR=3857,size=f'{SIZE},{SIZE}',bandIds='0,1,2',format='png24',f='image'))
            raw=subprocess.check_output(['curl','-fsSL','--retry','2','--max-time','60',SOURCE+'/exportImage?'+query])
            with MemoryFile(raw) as buffer, buffer.open() as image:
                if (image.width,image.height,image.count)!=(SIZE,SIZE,3):
                    raise ValueError('Unexpected NAIP image dimensions or channel count')
                image.read(1)
            temp=file.with_suffix('.part')
            temp.write_bytes(raw)
            temp.replace(file)
        with rasterio.open(file) as image:
            return image.read().transpose(1,2,0)
    return tile

def sample(interior, tile):
    # Project the inset outline before rasterisation. The narrow local extent
    # allows straight edges in Web Mercator without visible chord error.
    def ring(r):
        return [web(x,z) for x,z in r.coords]
    polygon=Polygon(ring(interior.exterior),[ring(r) for r in interior.interiors])
    x0,y0,x1,y1=polygon.bounds
    x0,y0,x1,y1=math.floor(x0),math.floor(y0),math.ceil(x1),math.ceil(y1)
    raster=np.empty((y1-y0,x1-x0,3),dtype=np.uint8)
    for col in range(x0//SIZE,(x1-1)//SIZE+1):
        for row in range(y0//SIZE,(y1-1)//SIZE+1):
            tx,ty=col*SIZE,row*SIZE
            a,b=max(x0,tx),max(y0,ty)
            c,d=min(x1,tx+SIZE),min(y1,ty+SIZE)
            raster[y1-d:y1-b,a-x0:c-x0]=tile(col,row)[ty+SIZE-d:ty+SIZE-b,a-tx:c-tx]
    mask=geometry_mask([mapping(polygon)],out_shape=raster.shape[:2],
        transform=Affine(1,0,x0,0,-1,y1),invert=True)
    rows,cols=np.where(mask)
    if len(rows)<36:
        return None
    rgb=raster[rows,cols].astype(float)
    r,g,b=rgb.T
    light=rgb@np.array([.2126,.7152,.0722])
    vegetation=(g-r>5)&(g-b>9)
    good=(~vegetation)&(light>=58)&(light<=241)&(rgb.min(axis=1)>28)
    if good.mean()<.79 or good.sum()<30:
        return None
    median=np.median(rgb[good],axis=0)
    residual=np.max(np.abs(rgb-median),axis=1)
    if np.quantile(residual[good],.8)>22 or (good&(residual<=20)).mean()<.62:
        return None
    # A single bright patch in a shaded or mixed roof is insufficient.
    q=(rows>=np.median(rows)).astype(int)*2+(cols>=np.median(cols))
    groups=[rgb[good&(q==i)] for i in range(4)]
    if any(len(group)<4 or np.max(np.abs(np.median(group,axis=0)-median))>14 for group in groups):
        return None
    return median

def pigment(rgb):
    # Preserve observed lightness ordering and muted cast under the city wash.
    luminance=rgb@np.array([.2126,.7152,.0722])
    paint=.66*(luminance+.55*(rgb-luminance))+.34*np.array([211,205,191])
    return '#'+''.join(f'{round(v):02x}' for v in paint)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cache',type=Path)
    args=parser.parse_args()
    survey=json.loads((DATA/'downtown-roofs.json').read_text())
    roofs=survey['roofs']
    buildings=json.loads((DATA/'sf-waterfront.json').read_text())['buildings']
    parents={b.get('parent') for b in buildings if b.get('part')}
    finishes={}
    tile=tile_reader(args.cache)
    for b in buildings:
        key=str(b['id'])
        if survey['profiles'].get(key,[0])[0]>2022:
            continue
        if key not in roofs or b.get('part') or b['id'] in parents or b.get('minH',0)>0:
            continue
        height=roofs[key][0]
        if b['measured'] and abs(height-b['h'])>=max(.19,.19*b['h']):
            continue
        footprint=Polygon(b['p']).buffer(0)
        # Discount 20% of observed building height for possible off-nadir
        # lean plus 1.8 m for footprint registration, parapets and resampling.
        inset=footprint.buffer(-(1.8*SCALE+.20*height))
        if inset.geom_type!='Polygon' or inset.area<30*SCALE**2:
            continue
        observed=sample(inset,tile)
        if observed is not None:
            finishes[key]=pigment(observed)
    out={'source':SOURCE,'year':2022,'finishes':finishes}
    (DATA/'roof-finishes.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
    print(f'{len(finishes)} confident roof interiors')
if __name__=='__main__':
    main()
