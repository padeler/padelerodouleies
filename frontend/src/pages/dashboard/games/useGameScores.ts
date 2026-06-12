/**
 * Server-backed best scores for the Games tab.
 *
 * The backend is the single source of truth (scores roam across devices and
 * feed the Stats tab's "Game scores" section). The server only overwrites a
 * best when the submitted score beats it and reports back whether it did.
 */

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getGameScores, submitGameScore } from '../../../api/client';

/** The current user's best for one game, or null while loading / when unset. */
export function useGameBest(game: string): number | null {
  const { data } = useQuery({ queryKey: ['game-scores'], queryFn: getGameScores });
  return data?.[game] ?? null;
}

/**
 * Submit a finished game's score. `onResult(improved)` fires when the server
 * answers, so callers can trigger the "new best" celebration.
 */
export function useSubmitScore(): (game: string, score: number, onResult?: (improved: boolean) => void) => void {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ game, score }: { game: string; score: number }) => submitGameScore(game, score),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['game-scores'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (error) => {
      console.error('[games] failed to submit score:', error);
    },
  });
  const { mutate } = mutation;
  return useCallback(
    (game, score, onResult) => {
      mutate({ game, score }, { onSuccess: (data) => onResult?.(data.improved) });
    },
    [mutate],
  );
}
