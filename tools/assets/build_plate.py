#!/usr/bin/env python3
"""
Build the clean background plate from the approved region edits (D-094).

    python3 tools/assets/build_plate.py docs/assets/plate-build.json OUT.png

plate-build.json lists the chosen source file per region, e.g.
  {"base": "assets-src/reference/REF-001_typel-concept-primary_v1_1920x1080.png",
   "edits": {"PLT-001": "assets-src/flow/PLT-001/PLT-001_clean-sky_v1_a.png", ...}}
Regions and their order come from docs/assets/plate-regions.json ("order" in
the config picks which build order list, default "build_order"). Every edit is
aligned to the base first (tools/assets/prep.py align), then composited.
"""
import json, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1].parent
PREP = ROOT / 'tools/assets/prep.py'


def run(*a):
    r = subprocess.run([sys.executable, str(PREP), *map(str, a)], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr)
    return r.stdout


def main():
    cfg = json.loads(Path(sys.argv[1]).read_text())
    out = Path(sys.argv[2])
    regions = json.loads((ROOT / 'docs/assets/plate-regions.json').read_text())
    tmp = Path(tempfile.mkdtemp())
    cur = ROOT / cfg['base']
    for i, name in enumerate(regions[cfg.get('order', 'build_order')]):
        src = cfg['edits'].get(name)
        if not src:
            print(f'{name}: no edit chosen, keeping base')
            continue
        aligned = tmp / f'{name}_aligned.png'
        print(name, run('align', ROOT / src, ROOT / cfg['base'], aligned).splitlines()[0])
        nxt = tmp / f'step{i}.png'
        run('composite', cur, aligned, nxt, '--name', name, '--feather', str(cfg.get('feather', 24)))
        cur = nxt
    out.parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_bytes(Path(cur).read_bytes())
    print('wrote', out)


if __name__ == '__main__':
    main()
