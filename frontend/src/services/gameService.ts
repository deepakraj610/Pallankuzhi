import api from './api';
import * as local from '../engine/localGames';
import { STANDALONE } from '../lib/standalone';
import type {
  CreateGamePayload,
  Game,
  GameListParams,
  MovePayload,
  MoveResult,
  PaginatedGames,
} from '../types';

export const createGame = async (payload: CreateGamePayload): Promise<Game> => {
  if (STANDALONE) return local.createGame(payload);
  const { data } = await api.post<Game>('/api/games', payload);
  return data;
};

export const listGames = async (params: GameListParams = {}): Promise<PaginatedGames> => {
  if (STANDALONE) return local.listGames(params);
  const { data } = await api.get<PaginatedGames>('/api/games', { params });
  return data;
};

export const getGame = async (id: number): Promise<Game> => {
  if (STANDALONE) return local.getGame(id);
  const { data } = await api.get<Game>(`/api/games/${id}`);
  return data;
};

export const playMove = async (id: number, payload: MovePayload): Promise<MoveResult> => {
  if (STANDALONE) return local.playMove(id, payload);
  const { data } = await api.post<MoveResult>(`/api/games/${id}/moves`, payload);
  return data;
};

export const abandonGame = async (id: number): Promise<void> => {
  if (STANDALONE) return local.abandonGame(id);
  await api.delete(`/api/games/${id}`);
};

export const extractError = (err: unknown, fallback: string): string => {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
};
