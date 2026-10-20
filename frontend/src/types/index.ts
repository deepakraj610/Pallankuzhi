export type Difficulty = 'easy' | 'medium';
export type Player = 'human' | 'ai';
export type GameStatus = 'in_progress' | 'human_won' | 'ai_won' | 'draw' | 'abandoned';

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  oauth_provider: string | null;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name?: string;
}

export interface Move {
  id: number;
  game_id: number;
  move_number: number;
  player: Player;
  cup_index: number;
  seeds_sown: number;
  seeds_captured: number;
  board_after: number[];
  created_at: string;
}

export interface Game {
  id: number;
  user_id: number;
  difficulty: Difficulty;
  board: number[];
  human_score: number;
  ai_score: number;
  current_player: Player;
  status: GameStatus;
  created_at: string;
  updated_at: string | null;
  finished_at: string | null;
  moves?: Move[];
}

export interface GameListParams {
  page?: number;
  page_size?: number;
  status?: GameStatus;
}

export interface PaginatedGames {
  items: Game[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateGamePayload {
  difficulty: Difficulty;
}

export interface MovePayload {
  cup_index: number;
}

export interface TraceStep {
  kind: 'pickup' | 'drop' | 'capture';
  cup: number;
  count: number;
}

export interface SweepStep {
  cup: number;
  count: number;
  owner: Player;
}

export interface MoveResult {
  game: Game;
  human_move: Move;
  ai_move: Move | null;
  human_trace?: TraceStep[];
  ai_trace?: TraceStep[];
  sweep?: SweepStep[];
}

export interface DifficultyRecord {
  wins: number;
  losses: number;
  draws: number;
}

export interface Stats {
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
  by_difficulty: Record<Difficulty, DifficultyRecord>;
  avg_captured: number;
  current_streak: number;
}
