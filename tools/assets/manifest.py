#!/usr/bin/env python3
"""
Typel asset manifest: docs/assets/asset-manifest.json is the source of truth;
docs/assets/ASSET_MANIFEST.md is generated from it. Never edit the .md by hand.

    python3 tools/assets/manifest.py render
    python3 tools/assets/manifest.py status ID STATUS [--note "..."] [--source PATH] [--test "..."]
    python3 tools/assets/manifest.py check        # fails if the .md is stale or a status is invalid

Approval rule: APPROVED needs an explicit owner approval; pass --note quoting it.
"""
from __future__ import annotations
import argparse, datetime, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JSON = ROOT / 'docs/assets/asset-manifest.json'
MD = ROOT / 'docs/assets/ASSET_MANIFEST.md'


def load():
    return json.loads(JSON.read_text())


def render(m) -> str:
    L = ['# Typel — Asset Manifest', '',
         '_Generated from `docs/assets/asset-manifest.json` by `tools/assets/manifest.py render`. Do not edit by hand._', '',
         'Lifecycle: ' + ' → '.join(m['lifecycle'][:7]) + ' (also REJECTED, NEEDS REVISION). An upload is GENERATED/UNDER REVIEW until the owner explicitly approves it.', '',
         '## References', '', '| ID | Name | File | Status | Provenance |', '|---|---|---|---|---|']
    for r in m['references']:
        L.append(f"| {r['id']} | {r['name']} | `{r['file']}` | {r['status']} | {r['provenance']} |")
    counts: dict[str, int] = {}
    for a in m['assets']:
        counts[a['status']] = counts.get(a['status'], 0) + 1
    L += ['', '## Summary', '', ' · '.join(f'{k}: {v}' for k, v in counts.items()), '',
          '| ID | Name | Batch | Status | Category | Format | Size | Transparency / loop |', '|---|---|---|---|---|---|---|---|']
    for a in m['assets']:
        L.append(f"| {a['id']} | {a['name']} | {a['batch']} | **{a['status']}** | {a['category']} | {a['delivery_format']} | {a['dimensions']} | {a['transparency_or_loop']} |")
    L += ['', '## Asset records', '']
    for a in m['assets']:
        p = a.get('prompt')
        L += [f"### {a['id']} · {a['name']}", '',
              f"- **Game function:** {a['function']}",
              f"- **Category:** {a['category']} · **Batch:** {a['batch']} · **Priority:** {a['priority']}" + (f" · **Depends on:** {', '.join(a['depends_on'])}" if a['depends_on'] else ''),
              f"- **Required format:** {a['delivery_format']} · **Dimensions/duration:** {a['dimensions']} · **Transparency/looping:** {a['transparency_or_loop']}",
              f"- **Source reference:** {a['source_reference']}",
              f"- **Prompt:** " + (f"v{p['version']} in `{p['file']}` ({p['style_block']})" if p else 'not yet written'),
              f"- **Status:** **{a['status']}** — history: " + '; '.join(f"{h['date']} {h['status']}" + (f" ({h['note']})" if h.get('note') else '') for h in a['status_history']),
              f"- **Approved source file:** {('`' + a['approved_source'] + '`') if a['approved_source'] else '—'}",
              f"- **Final integrated path:** {('`' + a['final_path'] + '`') if a['final_path'] else 'TBD'}",
              f"- **Integration notes:** {a['integration_notes'] or '—'}",
              f"- **Test status:** {a['test_status']}",
              f"- **Known limitations:** {a['known_limitations'] or '—'}", '']
    return '\n'.join(L)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('render'); sub.add_parser('check')
    s = sub.add_parser('status'); s.add_argument('id'); s.add_argument('status'); s.add_argument('--note'); s.add_argument('--source'); s.add_argument('--test')
    a = ap.parse_args()
    m = load()
    if a.cmd == 'status':
        if a.status not in m['lifecycle']:
            sys.exit(f'unknown status {a.status}')
        if a.status == 'APPROVED' and not a.note:
            sys.exit('APPROVED requires --note quoting the owner\'s explicit approval')
        rec = next((x for x in m['assets'] if x['id'] == a.id), None)
        if not rec:
            sys.exit(f'no asset {a.id}')
        rec['status'] = a.status
        h = {'status': a.status, 'date': datetime.date.today().isoformat()}
        if a.note:
            h['note'] = a.note
        rec['status_history'].append(h)
        if a.source:
            rec['approved_source'] = a.source
        if a.test:
            rec['test_status'] = a.test
        JSON.write_text(json.dumps(m, indent=1, ensure_ascii=False) + '\n')
    if a.cmd == 'check':
        bad = [x['id'] for x in m['assets'] if x['status'] not in m['lifecycle']]
        stale = not MD.exists() or MD.read_text() != render(m)
        if bad or stale:
            sys.exit(f'invalid statuses {bad}' if bad else 'ASSET_MANIFEST.md is stale: run tools/assets/manifest.py render')
        print('manifest ok')
        return
    MD.write_text(render(m))
    print('wrote', MD)


if __name__ == '__main__':
    main()
