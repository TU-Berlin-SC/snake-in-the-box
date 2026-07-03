import type { AlgorithmOption } from "../types/snake";

// snake-in-the-box-main 저장소에 있는 실제 solve 스크립트들.
// 같은 type(snake/coil) 안에서는 지금은 더미 데이터를 공유하지만,
// 나중에 각 스크립트의 실제 solver 결과로 교체하면 서로 다른 경로를 보여주게 됨.
export const ALGORITHMS: AlgorithmOption[] = [
  {
    id: "snake_walk_gurobi",
    type: "snake",
    label: "Snake · Walk formulation (Gurobi)",
    script: "snake/snake_walk_formulation_v1_solve.py",
  },
  {
    id: "snake_flow_gurobi",
    type: "snake",
    label: "Snake · Flow formulation (Gurobi)",
    script: "snake/snake_flow_formulation_v1.py",
  },
  {
    id: "snake_walk_xpress",
    type: "snake",
    label: "Snake · Walk formulation (Xpress)",
    script: "snake/xpress_snake_walk.py",
  },
  {
    id: "coil_walk_v1",
    type: "coil",
    label: "Coil · Walk formulation v1 (Gurobi)",
    script: "coil/coil_walk_formulation_v1_solve.py",
  },
  {
    id: "coil_walk_v2",
    type: "coil",
    label: "Coil · Walk formulation v2 (Gurobi)",
    script: "coil/coil_walk_formulation_v2.py",
  },
  {
    id: "coil_walk_v3",
    type: "coil",
    label: "Coil · Walk formulation v3 (Gurobi)",
    script: "coil/coil_walk_formulation_v3.py",
  },
  {
    id: "coil_xpress",
    type: "coil",
    label: "Coil · All symmetric (Xpress)",
    script: "coil/xpress_coil_all.py",
  },
  {
    id: "grid_coil_bigger_boxes",
    type: "coil",
    label: "Coil · n grid (bigger boxes)",
    script: "convert_me/coil_bigger_boxes.py",
  },
];