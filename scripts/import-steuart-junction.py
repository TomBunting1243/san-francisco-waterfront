"""Rebuild the Don Chee wye from the same rail extract as import-market-street.py.

Usage: python3 scripts/import-steuart-junction.py /path/to/reference-survey
Compare the four mapped curves against SFMTA Central Segment Existing (2021)
and SF's p2024_rgb8cm orthophoto. Both scheduled F movements bend north.
The cut at z=-5.3 is the existing Market import envelope.
"""
import json
import math
import sys
from pathlib import Path

source = Path(sys.argv[1]) / "embarcadero-rail-map.json"
dest = Path(__file__).resolve().parents[1] / "public/data/steuart-junction.json"
elements = json.loads(source.read_text())["elements"]
ways = {e["id"]: e["nodes"] for e in elements if e["type"] == "way"}
nodes = {}
for node in elements:
    if node["type"] != "node":
        continue
    e = (node["lon"] + 122.39348) * 111320 * math.cos(math.radians(37.79554))
    n = (node["lat"] - 37.79554) * 111320
    nodes[node["id"]] = [
        round(-.03552029735 * e + .04836012986 * n, 4),
        round(.04836012986 * e + .03552029735 * n, 4),
    ]


def coordinates(way):
    return [nodes[node] for node in ways[way]]


def waterside_tail(way):
    path = coordinates(way)
    if path[0][1] > path[-1][1]:
        path.reverse()
    for i in range(len(path) - 1, 0, -1):
        a, b = path[i-1:i+1]
        if a[1] <= -5.3 < b[1]:
            fraction = (-5.3-a[1])/(b[1]-a[1])
            return [[round(a[0]+fraction*(b[0]-a[0]), 4), -5.3], *path[i:]]
    raise ValueError(f"No Market clip edge in tram way {way}")


curves = []
for way in [93448545, 93448549, 93448548, 27570590]:
    points = coordinates(way)
    if points[0][1] > points[-1][1]:
        points.reverse()
    curves.append({"way": way, "points": points})
result = {
    "source": "OpenStreetMap contributors (ODbL), way geometries projected with import-market-street.py. SF 2024 orthophoto confirms the four junction branches and the two platform approaches.",
    "curves": curves,
    "landings": [coordinates(w) for w in [675498896, 675498897]],
    "westJoin": waterside_tail(331003151),
    "eastJoin": waterside_tail(160305461),
}
dest.write_text(json.dumps(result, separators=(",", ":")) + "\n")
