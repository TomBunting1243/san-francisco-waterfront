"""Rebuild seven Frost Plaza crown envelopes from the cached CA_SanFrancisco_1_B23
USGS EPT and the 2024 San Francisco 8 cm aerial (p2024_rgb8cm). Pass the
san-francisco-2023 cache used by import-downtown-roofs.py. The measured outlines
below refer to the rectified aerial with pixel origin (-5,-21) at 210 px/unit.
Dependencies: numpy, laspy[lazrs], shapely.
"""
import json
import math
import sys
from pathlib import Path

import laspy
import numpy as np
import shapely
from shapely.geometry import Polygon

root = Path(__file__).resolve().parents[1]
cache = Path(sys.argv[1])
bounds = json.loads((cache / 'ept.json').read_text())['bounds']
east_scale = 111320 * math.cos(math.radians(37.79554))
earth_radius = 6378137


def mercator(x, z):
    lon = -122.39348 + (-.03552029735*x + .04836012986*z) / (.0036*east_scale)
    lat = 37.79554 + (.04836012986*x + .03552029735*z) / (.0036*111320)
    return earth_radius*math.radians(lon), earth_radius*math.asinh(math.tan(math.radians(lat)))


corners = np.array([mercator(x, z) for x in (-3.1, -.8) for z in (-19.8, -15)])
west, south = corners.min(axis=0)
east, north = corners.max(axis=0)
tiles = []
for path in sorted(cache.glob('ept-data_*.laz')):
    level, i, j, _ = map(int, path.stem.removeprefix('ept-data_').split('-'))
    step = (bounds[3]-bounds[0]) / 2**level
    left, bottom = bounds[0]+i*step, bounds[1]+j*step
    if level>7 or left+step<west or bottom+step<south or left>east or bottom>north:
        continue
    cloud = laspy.read(path)
    e = (np.rad2deg(np.asarray(cloud.x)/earth_radius)+122.39348)*east_scale
    n = (np.rad2deg(np.arctan(np.sinh(np.asarray(cloud.y)/earth_radius)))-37.79554)*111320
    x, z = -.03552029735*e+.04836012986*n, .04836012986*e+.03552029735*n
    keep = (x>-3.1) & (x<-.8) & (z>-19.8) & (z<-15)
    tiles.append(np.column_stack([x[keep], z[keep], np.asarray(cloud.z)[keep],
                                  np.asarray(cloud.classification)[keep]]))
points = np.concatenate(tiles)
trees = {i: np.array(pt) for i, pt, _, _ in json.loads((root/'public/data/market-street.json').read_text())['trees']}

# Registered aerial outlines. The four contiguous crowns share one perimeter.
joined = [13452,13453,13451,13450]
joined_outline=[(569,879),(578,849),(602,841),(637,825),(681,823),(700,808),(719,810),(729,840),(747,855),(741,905),(709,979),(732,997),(720,1031),(678,1054),(631,1059),(594,1042),(576,997),(562,952),(553,927)]
rings={13457:[(518,684),(527,637),(547,606),(579,587),(612,588),(653,596),(669,619),(663,650),(674,676),(665,710),(649,742),(608,743),(560,732),(529,708)],13455:[(638,771),(649,765),(658,768),(659,779),(650,791),(637,790)],13456:[(752,716),(761,701),(771,698),(783,704),(787,717),(777,728),(763,728)],**{i: joined_outline for i in joined}}

stems = np.array([trees[i] for i in joined])
nearest = np.square(points[:,:2,None]-stems.T[None,:,:]).sum(axis=1).argmin(axis=1)
px, pz = (points[:,0]+5)*210, (points[:,1]+21)*210
rows = {}
for tree_id, outline in rings.items():
    x, z = trees[tree_id]
    nearby_ground = (np.hypot(points[:,0]-x, points[:,1]-z)<.30) & (points[:,3]==2)
    ground = np.median(points[nearby_ground,2])
    height = points[:,2]-ground
    mask = shapely.contains_xy(Polygon(outline), px, pz) & (points[:,3]==1) & (height>1.4) & (height<16)
    if tree_id in joined:
        mask &= nearest==joined.index(tree_id)
    heights = height[mask]
    if len(heights)<5:
        raise ValueError(f'Insufficient cached returns at tree {tree_id}')
    # The two young crowns have too few returns to measure their horizontal extent.
    if tree_id in (13455,13456):
        xy = (np.asarray(outline)/210+[-5,-21]-trees[tree_id])/.06
        left, back = xy.min(axis=0)
        right, front = xy.max(axis=0)
    else:
        left, right = np.percentile((points[mask,0]-x)/.06, [1,99])
        back, front = np.percentile((points[mask,1]-z)/.06, [1,99])
    low, high = np.percentile(heights, [5,98])
    rows[tree_id] = dict(returns=len(heights), groundM=round(float(ground),2),
                         boundsM=[round(float(v),2) for v in (left,right,back,front,low,high)])
(root/'public/data/frost-trees.json').write_text(json.dumps(rows,indent=2)+'\n')
