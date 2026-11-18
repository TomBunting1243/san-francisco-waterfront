"""Pack SF Public Works plot widths and site descriptions for the modeled trees.

Pass the city survey cache containing mapped-tree-wells.json, queried from
https://data.sfgov.org/resource/tkzw-k3nq.json by treeid. Dimensions are feet.
"""
import json
import re
import sys
from pathlib import Path

data = Path(__file__).resolve().parents[1] / 'public/data'
rows = json.loads((Path(sys.argv[1]) / 'mapped-tree-wells.json').read_text())
output = {}
for row in rows:
    info = row.get('siteinfo', '').split(':')[-1].strip().lower()
    if info not in {'pot', 'cutout', 'yard'}:
        continue
    sizes = [float(s) for s in re.findall(r'\d+(?:\.\d+)?', row.get('plotsize', ''))]
    if not sizes:
        continue
    market = row.get('onstreet', '').strip().lower() == 'market st'
    finish = 'grate' if info == 'cutout' and market else info
    output[row['treeid']] = [finish, sizes[0], sizes[-1]]
(data / 'tree-wells.json').write_text(json.dumps(output, separators=(',', ':')) + '\n')
