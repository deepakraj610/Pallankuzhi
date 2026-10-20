import api from './api';
import * as local from '../engine/localGames';
import { STANDALONE } from '../lib/standalone';
import type { Game, PaginatedGames, Stats } from '../types';

export async function getStats(): Promise<Stats> {
  if (STANDALONE) return local.getStats();
  const { data } = await api.get<Stats>('/api/stats');
  return data;
}

export async function getInProgressGame(): Promise<Game | null> {
  if (STANDALONE) return local.listGames({ status: 'in_progress', page: 1, page_size: 1 }).items[0] ?? null;
  const { data } = await api.get<PaginatedGames>('/api/games', {
    params: { status: 'in_progress', page: 1, page_size: 1 },
  });
  return data.items[0] ?? null;
}

export async function getRecentGames(limit = 5): Promise<Game[]> {
  if (STANDALONE) return local.listGames({ page: 1, page_size: limit }).items;
  const { data } = await api.get<PaginatedGames>('/api/games', {
    params: { page: 1, page_size: limit },
  });
  return data.items;
}
