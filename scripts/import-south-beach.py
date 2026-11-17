#!/usr/bin/env python3
"""Bake a compact South Beach extension from the public OpenStreetMap map endpoint."""
import argparse
import datetime
import json
import math
import re
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://api.openstreetmap.org/api/0.6/map.json?bbox=-122.399,37.7755,-122.383,37.7892"
ANCHORS = {32862740, 104599978, 104599994, 104600008, 124659443, 186071977,
           260320983, 192883977, 37058284, 113103846}
FEATURES = {
    "stadium": 4786909, "field": 500283910, "wharf": 207811319, "harbor": 23749874,
    "park": 23750468, "chinaBasin": 27656676, "plaza": 26786711,
    "pier38": 104599982, "pier40": 104599990, "harborOffice": 149167938,
    "pier48": 27369603, "pier48Deck": 1151042598, "breakwater": 23605175,
    "fishingPier": 23605184, "oracleFloat": 46274021, "oracleBridge": 780006768,
    "creekBreakwater": 1365464728,
}
POINTS = {"mays": 4908344426, "maysGate": 13106059071, "secondGate": 13106059075,
          "mccovey": 302034119, "cove": 317091394, "carmens": 317124800}
ROAD_TYPES = {"primary", "secondary", "tertiary", "residential", "living_street", "unclassified"}
HIGHWAY_NAMES = {"The Embarcadero", "King Street", "2nd Street", "3rd Street", "4th Street",
                 "Brannan Street", "Bryant Street", "Townsend Street", "Delancey Street",
                 "Federal Street", "Berry Street", "Beale Street", "Harrison Street"}
PARK_FOOTWAYS = {"McCovey Cove Promenade", "China Basin Landing", "San Francisco Bay Trail",
                 "Portwalk", "Bay Trail"}


def load_source(path):
    if path:
        return json.loads(path.read_text())
    with urlopen(SOURCE, timeout=90) as response:
        return json.load(response)


def area(points):
    return abs(sum(a[0]*b[1]-b[0]*a[1] for a, b in zip(points, points[1:])))/2


def number(tag, default=None):
    if tag is None:
        return default
    match = re.match(r"^(\d+(?:\.\d+)?)\s*(m)?$", tag.strip())
    return float(match[1]) if match else default


def rotate_projection(nodes, ways, base):
    lat, lon = base["origin"]
    metres_longitude = 111320*math.cos(math.radians(lat))

    def metres(node):
        return [(node["lon"]-lon)*metres_longitude, (node["lat"]-lat)*111320, 1]

    pairs = []
    for building in base["buildings"]:
        if building["id"] not in ANCHORS:
            continue
        ids = ways[building["id"]]["nodes"]
        if len(ids) != len(building["p"]):
            raise ValueError(f"Projection anchor changed: {building['id']}")
        pairs.extend((metres(nodes[node]), p) for node, p in zip(ids, building["p"]))

    def fit(col):
        matrix = [
            [sum(x[i]*x[j] for x, _ in pairs) for j in range(3)]
            + [sum(x[i]*p[col] for x, p in pairs)]
            for i in range(3)
        ]
        for i in range(3):
            pivot = max(range(i, 3), key=lambda j: abs(matrix[j][i]))
            matrix[i], matrix[pivot] = matrix[pivot], matrix[i]
            divisor = matrix[i][i]
            matrix[i] = [x/divisor for x in matrix[i]]
            for j in range(3):
                if i != j:
                    scale = matrix[j][i]
                    matrix[j] = [a-scale*b for a, b in zip(matrix[j], matrix[i])]
        return [row[3] for row in matrix]

    projection = [fit(0), fit(1)]

    def transform(x):
        return [round(sum(a*b for a, b in zip(x, row)), 3) for row in projection]

    error = max(math.dist(transform(x), expected) for x, expected in pairs)
    if error > .003:
        raise ValueError(f"South Beach projection is misaligned: {error}")
    return lambda node: transform(metres(node)), error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="cached response from the map.json URL")
    parser.add_argument("--captured", default=datetime.date.today().isoformat())
    args = parser.parse_args()
    raw = load_source(args.input)
    base = json.loads((ROOT / "public/data/sf-waterfront.json").read_text())
    ways = {e["id"]: e for e in raw["elements"] if e["type"] == "way"}
    nodes = {e["id"]: e for e in raw["elements"] if e["type"] == "node"}
    project, error = rotate_projection(nodes, ways, base)

    def coordinates(way):
        ids = way["nodes"]
        return [project(nodes[i]) for i in ids] if all(i in nodes for i in ids) else []

    def segment_key(a, b):
        return tuple(sorted((tuple(round(v, 2) for v in a), tuple(round(v, 2) for v in b))))

    existing = {b["id"] for b in base["buildings"]}
    known_roads = {segment_key(a, b) for road in base["roads"] for a, b in zip(road["p"], road["p"][1:])}
    shoreline = coordinates(ways[237055031])
    features = {name: coordinates(ways[id]) for name, id in FEATURES.items()}
    named_points = {name: project(nodes[id]) for name, id in POINTS.items()}
    if not all(features.values()) or shoreline[-1] != [-99.993, -21.254]:
        raise ValueError("South Beach coast or landmark coverage changed")

    buildings, roads, docks, paths = [], [], [], []
    for id, way in ways.items():
        tag = way.get("tags", {})
        select = ("building" in tag or tag.get("highway") in ROAD_TYPES
                  or tag.get("man_made") == "pier" or tag.get("name") in PARK_FOOTWAYS)
        if not select:
            continue
        p = coordinates(way)
        if len(p) < 2:
            continue
        x, z = (sum(v[i] for v in (p[:-1] if p[0] == p[-1] else p))/(len(p)-int(p[0] == p[-1])) for i in range(2))
        waterfront = -117 < x < -66.5 and -81 < z < -10 and (x < -81 or z > -21)
        if tag.get("building") and id not in existing and id not in FEATURES.values() and waterfront and len(p) > 3 and p[0] == p[-1] and area(p) > .38:
            # Heights use tagged metres or documented level counts. Untagged low buildings are estimated.
            h = number(tag.get("height"))
            levels = number(tag.get("building:levels"))
            buildings.append({"id": id, "name": tag.get("name", ""), "p": p,
                "h": round(.06*(h or (levels*3.1 if levels else 9)), 3),
                "measured": h is not None, "material": tag.get("building:material", ""),
                "kind": tag["building"]})
        if tag.get("highway") in ROAD_TYPES and tag.get("name") in HIGHWAY_NAMES and not tag.get("bridge") and tag.get("layer", "0") == "0":
            spans = []
            for a, b in zip(p, p[1:]):
                sx, sz = (a[0]+b[0])/2, (a[1]+b[1])/2
                if -119 < sx < -72 and -77 < sz < -14 and (sx < -82 or sz > -22) and segment_key(a, b) not in known_roads:
                    if spans and spans[-1][-1] == a:
                        spans[-1].append(b)
                    else:
                        spans.append([a, b])
            roads.extend({"name": tag["name"], "kind": tag["highway"], "p": span} for span in spans)
        if tag.get("man_made") == "pier" and id not in FEATURES.values() and -120 < x < -92 and -44 < z < -15 and -122 < min(v[0] for v in p):
            if max(v[0] for v in p) < -92:
                docks.append({"id": id, "name": tag.get("name", ""), "p": p})
        if tag.get("highway") in {"footway", "cycleway", "pedestrian"} and tag.get("name") in PARK_FOOTWAYS and -121 < x < -72 and -75 < z < -14:
            paths.append({"name": tag["name"], "p": p})

    result = {"source": "© OpenStreetMap contributors", "license": "ODbL 1.0",
              "sourceUrl": SOURCE, "captured": args.captured, "projectionMaxError": round(error, 6),
              "shoreline": shoreline, "features": features, "points": named_points,
              "roads": roads, "buildings": buildings, "docks": docks, "paths": paths}
    (ROOT / "public/data/south-beach.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":"))+"\n")
    print({k: len(result[k]) for k in ("shoreline", "features", "roads", "buildings", "docks", "paths")})


if __name__ == "__main__":
    main()
