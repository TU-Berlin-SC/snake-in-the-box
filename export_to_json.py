"""
Converts a solved snake/coil model into the JSON format the web viewer
(app/data/*.json) reads.

Two extraction paths, matching the two formulation styles used in this repo:

  1. Walk formulation (snake/snake_walk_formulation_v1_solve.py and similar):
     the model has time-indexed variables x[i, t], so the path order is
     already encoded in t. Use `path_from_walk_vars`.

  2. Vertex-set formulation (convert_me/coil_bigger_boxes.py and similar):
     the model only tells you *which* vertices are active (x_vertices[v].X),
     with degree constraints forcing them into a single path or cycle. The
     order isn't given directly, so `path_from_active_vertices` reconstructs
     it by walking the induced grid-adjacency subgraph.

Usage is at the bottom of this file (`if __name__ == "__main__"` has a
synthetic smoke test; see the two `# --- hook into ... ---` sections for
how to call this from an actual solve script).
"""

import json
import os
from itertools import product


# ---------------------------------------------------------------------------
# 1. walk formulation: path order comes from the time index directly
# ---------------------------------------------------------------------------

def path_from_walk_vars(x, V, T, tol=1e-6):
    """
    x: gurobipy tupledict of binary vars x[i, t], i in V, t in range(T+1)
    V: iterable of vertices (tuples of ints)
    T: max time index (path has T+1 vertices)

    Returns an ordered list of vertices, sorted by time.
    """
    path_by_time = {}
    for t in range(T + 1):
        for v in V:
            if x[v, t].X > 1 - tol:
                if t in path_by_time:
                    raise ValueError(f"multiple vertices selected at time {t}")
                path_by_time[t] = v
    times = sorted(path_by_time)
    if times != list(range(len(times))):
        raise ValueError(f"time indices are not contiguous starting at 0: {times}")
    return [path_by_time[t] for t in times]


# ---------------------------------------------------------------------------
# 2. vertex-set formulation: reconstruct order by walking the induced graph
# ---------------------------------------------------------------------------

def _manhattan1(a, b):
    diffs = [abs(x - y) for x, y in zip(a, b)]
    return sum(diffs) == 1 and max(diffs) == 1


def path_from_active_vertices(active_vertices):
    """
    active_vertices: iterable of vertex tuples (e.g. {v for v in vertices if
    x_vertices[v].X > 0.5}), as produced by coil_bigger_boxes.py-style models.

    Degree constraints in that formulation guarantee every active vertex has
    grid-degree 0 or 2 within the active set (coil / closed loop), or the
    classic snake endpoints have degree 1 (open path). This walks the
    induced subgraph and returns (ordered_path, is_cycle).
    """
    active = list(active_vertices)
    if not active:
        return [], False

    adj = {v: [] for v in active}
    active_set = set(active)
    for v in active:
        for u in active_set:
            if u != v and _manhattan1(u, v):
                adj[v].append(u)

    degrees = {v: len(neighbors) for v, neighbors in adj.items()}
    bad = {v: d for v, d in degrees.items() if d not in (1, 2)}
    if bad:
        raise ValueError(
            f"active vertex set isn't a simple path/cycle - unexpected degrees: {bad}"
        )

    endpoints = [v for v, d in degrees.items() if d == 1]
    is_cycle = len(endpoints) == 0

    start = endpoints[0] if endpoints else active[0]
    ordered = [start]
    prev = None
    current = start
    while True:
        nxt_candidates = [u for u in adj[current] if u != prev]
        if not nxt_candidates:
            break
        nxt = nxt_candidates[0]
        if is_cycle and nxt == start:
            break
        ordered.append(nxt)
        prev, current = current, nxt

    if len(ordered) != len(active):
        raise ValueError(
            f"walk only reached {len(ordered)}/{len(active)} vertices - "
            "active set may be disconnected (multiple components)"
        )
    return ordered, is_cycle


# ---------------------------------------------------------------------------
# JSON export, matching app/types/snake.ts
# ---------------------------------------------------------------------------

def export_to_json(
    path,
    d,
    n,
    algorithm_type,          # "snake" | "coil"
    out_path,
    is_cycle=None,           # inferred from algorithm_type if not given
    is_verified_optimal=True,
    note="",
):
    if algorithm_type not in ("snake", "coil"):
        raise ValueError('algorithm_type must be "snake" or "coil"')
    if is_cycle is None:
        is_cycle = algorithm_type == "coil"

    data = {
        "d": d,
        "n": n,
        "type": algorithm_type,
        "is_cycle": is_cycle,
        "path": [list(v) for v in path],
        "is_dummy": False,
        "is_verified_optimal": is_verified_optimal,
        "note": note or f"Solver output, {algorithm_type}, d={d}, n={n}.",
    }

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"wrote {out_path} ({len(path)} vertices, is_cycle={is_cycle})")


# ---------------------------------------------------------------------------
# --- hook into snake_walk_formulation_v1_solve.py ---
#
#   from scripts.export_to_json import path_from_walk_vars, export_to_json
#   ...
#   path = path_from_walk_vars(x, V, T)
#   export_to_json(
#       path, d=3, n=2,  # binary hypercube -> n=2 (coords 0/1)
#       algorithm_type="snake",
#       out_path="web/app/data/snake_n2.json",
#       note="snake_walk_formulation_v1_solve.py, Gurobi, d=3 binary hypercube",
#   )
#
# --- hook into convert_me/coil_bigger_boxes.py ---
#
#   from scripts.export_to_json import path_from_active_vertices, export_to_json
#   ...
#   active = {v for v in vertices if x_vertices[v].X > 0.5}
#   ordered_path, is_cycle = path_from_active_vertices(active)
#   export_to_json(
#       ordered_path, d=d, n=k + 1,
#       algorithm_type="coil" if is_cycle else "snake",
#       out_path=f"web/app/data/coil_n{k+1}.json",
#       note="convert_me/coil_bigger_boxes.py, Gurobi",
#   )
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    # smoke test with synthetic data, no solver required

    # (1) walk-formulation-style: fake x[i,t] dict
    class _FakeVar:
        def __init__(self, val):
            self.X = val

    V = list(product(range(2), repeat=3))  # binary 3-cube, 8 vertices
    fake_walk_path = [(0, 0, 0), (0, 0, 1), (0, 1, 1), (1, 1, 1)]
    T = len(fake_walk_path) - 1
    x = {}
    for t, v in enumerate(fake_walk_path):
        for vv in V:
            x[vv, t] = _FakeVar(1.0 if vv == v else 0.0)
    recovered = path_from_walk_vars(x, V, T)
    assert recovered == fake_walk_path, recovered
    export_to_json(
        recovered, d=3, n=2, algorithm_type="snake",
        out_path="/tmp/export_smoke_test_snake.json",
        is_verified_optimal=True,
        note="smoke test",
    )

    # (2) vertex-set-style: perimeter cycle on a 3x3 grid bottom layer
    active = {(0, 0, 0), (1, 0, 0), (2, 0, 0), (2, 1, 0),
              (2, 2, 0), (1, 2, 0), (0, 2, 0), (0, 1, 0)}
    ordered_path, is_cycle = path_from_active_vertices(active)
    assert is_cycle
    assert len(ordered_path) == len(active)
    export_to_json(
        ordered_path, d=3, n=3, algorithm_type="coil",
        out_path="/tmp/export_smoke_test_coil.json",
        is_verified_optimal=True,
        note="smoke test",
    )

    print("smoke tests passed")