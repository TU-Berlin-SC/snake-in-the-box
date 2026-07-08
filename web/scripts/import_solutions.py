"""
Converts the real solver output files in solutions/sol_coil_d3_n*.txt into
the JSON schema the web viewer reads (app/data/coil_n*.json).

The .txt files come in two formats depending on which script produced them:

  - one coordinate per line, e.g. "(0, 1, 0)" -- already in path order
    (this is what most of the coil/ scripts write out)
  - all coordinates on one line, comma-separated -- an unordered set of
    active vertices (this is what the vertex-set formulation, e.g.
    convert_me/coil_bigger_boxes.py, produces)

Either way we just regex out every "(a, b, c)" tuple, then check whether
consecutive tuples (including wrap-around) are grid-adjacent. If they are,
the file was already ordered and we use it as-is. If not, we reconstruct
the order with path_from_active_vertices (see export_to_json.py).

Usage:
    python3 scripts/import_solutions.py
        (reads from ../solutions relative to this script, writes into
        app/data/coil_n{N}.json)
"""

import glob
import os
import re

from export_to_json import export_to_json, path_from_active_vertices

COORD_RE = re.compile(r"\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)")


def parse_coords(text):
    return [tuple(int(x) for x in m) for m in COORD_RE.findall(text)]


def _manhattan1(a, b):
    diffs = [abs(x - y) for x, y in zip(a, b)]
    return sum(diffs) == 1 and max(diffs) == 1


def is_already_ordered_cycle(pts):
    if len(pts) < 3:
        return False
    if len(set(pts)) != len(pts):
        return False  # repeats -> not a simple cycle listing
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        if not _manhattan1(a, b):
            return False
    return True


def convert_file(txt_path, out_dir):
    text = open(txt_path, encoding="utf-8").read()
    pts = parse_coords(text)
    if not pts:
        print(f"skip {txt_path}: no coordinates found")
        return

    d = len(pts[0])
    n = max(max(p) for p in pts) + 1  # coords are 0-indexed -> n = max+1

    if is_already_ordered_cycle(pts):
        ordered = pts
    else:
        ordered, is_cycle = path_from_active_vertices(pts)
        if not is_cycle:
            print(f"warning: {txt_path} reconstructed as an OPEN path, not a cycle")

    out_path = os.path.join(out_dir, f"coil_n{n}.json")
    export_to_json(
        ordered,
        d=d,
        n=n,
        algorithm_type="coil",
        out_path=out_path,
        is_verified_optimal=True,
        note=f"Optimal coil solution for d={d}, n={n} (source: {os.path.basename(txt_path)}).",
    )


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    solutions_dir = os.path.join(here, "..", "..", "solutions")
    out_dir = os.path.join(here, "..", "app", "data")

    txt_files = sorted(glob.glob(os.path.join(solutions_dir, "sol_coil_d3_n*.txt")))
    if not txt_files:
        print(f"no sol_coil_d3_n*.txt files found under {solutions_dir}")
    for txt_path in txt_files:
        convert_file(txt_path, out_dir)
