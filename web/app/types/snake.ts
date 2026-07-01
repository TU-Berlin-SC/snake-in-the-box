export type Vertex = [number, number, number];

export interface SnakeData {
  d: number;
  n: number;
  path: Vertex[];
  is_dummy: boolean;
  is_verified_optimal: boolean;
  note: string;
}
