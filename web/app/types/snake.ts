export type Vertex = [number, number, number];
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

export interface AlgorithmOption {
  id: string;
  type: AlgorithmType;
  label: string; // 드롭다운에 표시될 이름
  script: string; // 원본 저장소에서 이 알고리즘을 계산하는 스크립트 경로
}