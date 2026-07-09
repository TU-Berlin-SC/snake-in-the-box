"""
Converts solver output files in solutions/sol_{type}_d{d}_n{n}.txt into the
JSON schema the web viewer reads (app/data/{type}_d{d}_n{n}.json).

Handles both problem types and any dimension:
  - sol_coil_d3_n2.txt   -> coil (closed cycle), d=3
  - sol_snake_d3_n3.txt  -> snake (open path), d=3
  - sol_snake_d2_n8.txt  -> snake, d=2 (coords are 2-tuples)
  - sol_coil_d7_n2.txt   -> SKIPPED (d>3 can't be visualized yet; prints a note)

The .txt files come in two formats depending on which script produced them:
  - one coordinate per line -- already in path order
  - all coordinates on one line -- an unordered vertex set, in which case the
    order is reconstructed via path_from_active_vertices (export_to_json.py)

Usage:
    python3 scripts/import_solutions.py
        (reads from ../../solutions relative to this script, writes into
        ../app/data/)
"""

import glob
import os
import re

from export_to_json import export_to_json, path_from_active_vertices

FILENAME_RE = re.compile(r"sol_(snake|coil)_d(\d+)_n(\d+)\.txt$")
TUPLE_RE = re.compile(r"\(([\d\s,]+)\)")

# d > MAX_VISUALIZABLE_D is exported nowhere: the viewer can only draw 2D/3D.
# (d=7,8 hypercube results would need a projection strategy first.)
MAX_VISUALIZABLE_D = 3


def parse_coords(text):
    """Extract every (a, b, ...) tuple of any arity."""
    pts = []
    for m in TUPLE_RE.findall(text):
        pts.append(tuple(int(x) for x in m.split(",")))
    return pts


def _manhattan1(a, b):
    diffs = [abs(x - y) for x, y in zip(a, b)]
    return sum(diffs) == 1 and max(diffs) == 1


def is_already_ordered_cycle(pts):
    if len(pts) < 3:
        return False
    if len(set(pts)) != len(pts):
        return False
    return all(_manhattan1(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts)))


def is_already_ordered_path(pts):
    """Open path: consecutive adjacency required, but no wrap-around."""
    if len(pts) < 2:
        return False
    if len(set(pts)) != len(pts):
        return False
    return all(_manhattan1(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def canonicalize_cycle(pts):
    """
    Cosmetic only: rotate the cycle to start at the lexicographically smallest
    vertex, direction chosen so the second vertex is smaller. The cycle itself
    is unchanged -- the animation just always starts from a predictable corner.
    """
    if len(pts) < 3:
        return pts
    start_idx = min(range(len(pts)), key=lambda i: pts[i])
    rotated = pts[start_idx:] + pts[:start_idx]
    forward = rotated
    backward = [rotated[0]] + list(reversed(rotated[1:]))
    return forward if forward[1] <= backward[1] else backward


def canonicalize_path(pts):
    """Cosmetic only: orient open paths so the smaller endpoint comes first."""
    if len(pts) < 2:
        return pts
    return pts if pts[0] <= pts[-1] else list(reversed(pts))


def convert_file(txt_path, out_dir):
    fname = os.path.basename(txt_path)
    m = FILENAME_RE.search(fname)
    if not m:
        print(f"skip {fname}: filename doesn't match sol_{{type}}_d{{d}}_n{{n}}.txt")
        return
    algo_type, d, n = m.group(1), int(m.group(2)), int(m.group(3))

    if d > MAX_VISUALIZABLE_D:
        print(f"skip {fname}: d={d} > {MAX_VISUALIZABLE_D}, viewer can only draw 2D/3D "
              "(needs a projection strategy first)")
        return

    text = open(txt_path, encoding="utf-8").read()
    pts = parse_coords(text)
    if not pts:
        print(f"skip {fname}: no coordinates found")
        return
    if len(pts[0]) != d:
        print(f"warning: {fname} says d={d} but coords have {len(pts[0])} components")

    if algo_type == "coil":
        if is_already_ordered_cycle(pts):
            ordered = pts
        else:
            ordered, is_cycle = path_from_active_vertices(pts)
            if not is_cycle:
                print(f"warning: {fname} reconstructed as an OPEN path, not a cycle")
        ordered = canonicalize_cycle(ordered)
    else:  # snake
        if is_already_ordered_path(pts):
            ordered = pts
        else:
            ordered, is_cycle = path_from_active_vertices(pts)
            if is_cycle:
                print(f"warning: {fname} reconstructed as a CYCLE, expected open path")
        ordered = canonicalize_path(ordered)

    out_path = os.path.join(out_dir, f"{algo_type}_d{d}_n{n}.json")
    export_to_json(
        ordered,
        d=d,
        n=n,
        algorithm_type=algo_type,
        out_path=out_path,
        is_verified_optimal=True,
        note=f"Optimal {algo_type} solution for d={d}, n={n} (source: {fname}).",
    )


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    solutions_dir = os.path.join(here, "..", "..", "solutions")
    out_dir = os.path.join(here, "..", "app", "data")

    txt_files = sorted(glob.glob(os.path.join(solutions_dir, "sol_*_d*_n*.txt")))
    if not txt_files:
        print(f"no sol_*_d*_n*.txt files found under {solutions_dir}")
    for txt_path in txt_files:
        convert_file(txt_path, out_dir)
