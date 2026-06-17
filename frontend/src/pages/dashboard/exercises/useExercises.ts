/**
 * React-query hooks for the Exercises tab.
 *
 * The bundle list is age-filtered + completion-stamped server-side, the manifest
 * is the answer-stripped kid view, and answers are graded on the server. On a
 * bundle completion the server credits stars and broadcasts `stars_changed`; we
 * mirror the Games tab by invalidating the bundle list and the Stats query so
 * the "completed" badge and the stats scoreboard refresh.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getExerciseBundle,
  getExerciseBundles,
  postExerciseAnswer,
} from '../../../api/client';
import type { ExerciseAnswerResult } from '../../../lib/types';

export function useExerciseBundles() {
  return useQuery({ queryKey: ['exercise-bundles'], queryFn: getExerciseBundles });
}

export function useExerciseBundle(bundleId: string) {
  return useQuery({
    queryKey: ['exercise-bundle', bundleId],
    queryFn: () => getExerciseBundle(bundleId),
    enabled: bundleId.length > 0,
  });
}

/**
 * Submit one answer. Returns the async mutate so callers can await the graded
 * result and drive feedback. Completion invalidates the list + stats.
 */
export function useSubmitAnswer(bundleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ exerciseId, response }: { exerciseId: string; response: unknown }) =>
      postExerciseAnswer(bundleId, exerciseId, response),
    onSuccess: (result: ExerciseAnswerResult) => {
      if (result.completed) {
        void queryClient.invalidateQueries({ queryKey: ['exercise-bundles'] });
        void queryClient.invalidateQueries({ queryKey: ['stats'] });
      }
    },
    onError: (error) => {
      console.error('[exercises] failed to submit answer:', error);
    },
  });
}
