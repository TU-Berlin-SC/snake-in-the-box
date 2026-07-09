// d=2면 [x, y], d=3이면 [x, y, z] — 차원에 따라 길이가 달라짐
export type Vertex = number[];
export type AlgorithmType = "snake" | "coil";

export interface SnakeData {
  d: number;
  n: number;
  type: AlgorithmType; // "snake" = 열린 경로, "coil" = 닫힌 루프
  is_cycle: boolean; // true면 path의 마지막 점이 첫 점과 다시 이어짐
  path: Vertex[];
  is_dummy: boolean;
  is_verified_optimal: boolean;
  note: string;
}
