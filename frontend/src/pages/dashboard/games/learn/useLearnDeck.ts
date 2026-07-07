/**
 * Loads a Learning Adventure deck and pre-fetches its spoken-word audio so a
 * tap during play is instant — there is no lazy synthesis mid-round (the server
 * also warms the cache at startup; this is the client-side half of "precompute
 * before the game starts").
 *
 * Audio is held as plain HTMLAudioElements (the only thing that decodes down to
 * the Samsung Tab 4's old browser), one per token, replayed by resetting
 * currentTime. `prefetch` resolves once every requested clip is loadable (or has
 * errored / timed out — one bad clip must not wedge the loading gate).
 *
 * Playback is single-channel: starting any clip stops the one currently playing
 * so two spoken words (a level intro and a target word, or rapid taps) never
 * overlap into garbled audio.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getLearnDeck,
  learnFindAllUrl,
  learnFindStartsWithUrl,
  learnFindUrl,
  learnSayUrl,
  learnSuccessUrl,
  learnVocabUrl,
  learnWrongUrl,
} from '../../../../api/client';
import type { Deck, DeckItem, LevelType, Track } from './learnEngine';

const PREFETCH_TIMEOUT_MS = 4000;
const PHRASE_TIMEOUT_MS = 4000;
const ALL_LEVELS: readonly LevelType[] = ['count', 'match', 'hear', 'order', 'whats_next'];

interface UseLearnDeck {
  deck: Deck | undefined;
  ready: boolean;
  prefetch: (tokens: string[]) => Promise<void>;
  playToken: (token: string) => void;
  /** Speak a level's intro sentence; resolves when the clip ends (or times out). */
  playPhrase: (level: LevelType) => Promise<void>;
  /** Speak the "find this one" prompt for the falling-targets level. */
  playFind: (token: string) => void;
  /** Speak the "find them all" prompt (multi-target variant). */
  playFindAll: (token: string) => void;
  /** Speak the "find an object that starts with this letter" prompt (starts-with variant). */
  playFindStartsWith: (token: string) => void;
  /** Speak the vocabulary word behind a letter's icon tile ("γάτα" for 🐱),
   * keyed by the shown entry's id (the picture is random per round). */
  playVocab: (id: string) => void;
  /** Speak the praise played on a correct answer. */
  playSuccessPhrase: () => void;
  /** Speak the explanation of a mistake (picked vs. correct; picked null = timed out). */
  playWrongPhrase: (correctToken: string, pickedToken: string | null) => void;
  /** Stop whatever clip is currently playing (e.g. on round teardown). */
  stopAudio: () => void;
}

export function useLearnDeck(track: Track): UseLearnDeck {
  const { data } = useQuery({
    queryKey: ['learn-deck', track],
    queryFn: () => getLearnDeck(track),
    staleTime: Infinity, // decks are static
  });

  const deck: Deck | undefined = data;
  const itemsByToken = useMemo<Record<string, DeckItem>>(
    () => (deck ? Object.fromEntries(deck.items.map((it) => [it.token, it])) : {}),
    [deck],
  );
  const cache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const phraseCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const findCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const findStartsWithCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const successRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef<HTMLAudioElement | null>(null);

  // Single-channel playback: stop the current clip before starting another so
  // spoken words never overlap into garbled audio.
  const playAudio = useCallback((audio: HTMLAudioElement): void => {
    const prev = playingRef.current;
    if (prev && prev !== audio) {
      prev.pause();
      try {
        prev.currentTime = 0;
      } catch {
        // Some browsers throw if the media isn't seekable yet — safe to ignore.
      }
    }
    playingRef.current = audio;
    audio.currentTime = 0;
    audio.play().catch((err) => console.warn('[learn] audio play blocked', err));
  }, []);

  const stopAudio = useCallback((): void => {
    const cur = playingRef.current;
    if (!cur) return;
    cur.pause();
    try {
      cur.currentTime = 0;
    } catch {
      // ignore non-seekable media
    }
    playingRef.current = null;
  }, []);

  // Warm the (track-agnostic) level-intro clips so the first intro is instant.
  useEffect(() => {
    for (const level of ALL_LEVELS) {
      if (phraseCache.current.has(level)) continue;
      const audio = new Audio(learnSayUrl(level));
      audio.preload = 'auto';
      audio.load();
      phraseCache.current.set(level, audio);
    }
  }, []);

  const ensure = useCallback(
    (token: string): HTMLAudioElement | null => {
      const existing = cache.current.get(token);
      if (existing) return existing;
      const item = itemsByToken[token];
      if (!item) {
        console.warn('[learn] no deck item for token', token);
        return null;
      }
      const audio = new Audio(item.audio_url);
      audio.preload = 'auto';
      audio.load();
      cache.current.set(token, audio);
      return audio;
    },
    [itemsByToken],
  );

  const prefetch = useCallback(
    async (tokens: string[]): Promise<void> => {
      await Promise.all(
        tokens.map(
          (token) =>
            new Promise<void>((resolve) => {
              const audio = ensure(token);
              if (!audio) return resolve();
              if (audio.readyState >= 3 /* HAVE_FUTURE_DATA */) return resolve();
              const done = (): void => {
                audio.removeEventListener('canplaythrough', done);
                audio.removeEventListener('error', done);
                resolve();
              };
              audio.addEventListener('canplaythrough', done);
              audio.addEventListener('error', done);
              window.setTimeout(done, PREFETCH_TIMEOUT_MS);
            }),
        ),
      );
    },
    [ensure],
  );

  const playToken = useCallback(
    (token: string): void => {
      const audio = ensure(token);
      if (!audio) return;
      playAudio(audio);
    },
    [ensure, playAudio],
  );

  const playPhrase = useCallback(
    (level: LevelType): Promise<void> => {
      let audio = phraseCache.current.get(level);
      if (!audio) {
        audio = new Audio(learnSayUrl(level));
        audio.preload = 'auto';
        phraseCache.current.set(level, audio);
      }
      const clip = audio;
      playAudio(clip);
      return new Promise<void>((resolve) => {
        const done = (): void => {
          clip.removeEventListener('ended', done);
          clip.removeEventListener('error', done);
          resolve();
        };
        clip.addEventListener('ended', done);
        clip.addEventListener('error', done);
        window.setTimeout(done, PHRASE_TIMEOUT_MS);
      });
    },
    [playAudio],
  );

  // "Find X" prompt for the falling-targets level — cached per token (finite set).
  const playFind = useCallback(
    (token: string): void => {
      let audio = findCache.current.get(token);
      if (!audio) {
        audio = new Audio(learnFindUrl(track, token));
        audio.preload = 'auto';
        findCache.current.set(token, audio);
      }
      playAudio(audio);
    },
    [track, playAudio],
  );

  // "Find them all" prompt for the multi-target variant — cached per token (finite set).
  const findAllCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const playFindAll = useCallback(
    (token: string): void => {
      let audio = findAllCache.current.get(token);
      if (!audio) {
        audio = new Audio(learnFindAllUrl(track, token));
        audio.preload = 'auto';
        findAllCache.current.set(token, audio);
      }
      playAudio(audio);
    },
    [track, playAudio],
  );

  // "Find an object starting with X" prompt — cached per token (letters only, finite set).
  const playFindStartsWith = useCallback(
    (token: string): void => {
      let audio = findStartsWithCache.current.get(token);
      if (!audio) {
        audio = new Audio(learnFindStartsWithUrl(token));
        audio.preload = 'auto';
        findStartsWithCache.current.set(token, audio);
      }
      playAudio(audio);
    },
    [playAudio],
  );

  // Vocabulary word behind an icon tile — cached per entry id (finite set).
  const vocabCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const playVocab = useCallback(
    (id: string): void => {
      let audio = vocabCache.current.get(id);
      if (!audio) {
        audio = new Audio(learnVocabUrl(id));
        audio.preload = 'auto';
        vocabCache.current.set(id, audio);
      }
      playAudio(audio);
    },
    [playAudio],
  );

  const playSuccessPhrase = useCallback((): void => {
    let audio = successRef.current;
    if (!audio) {
      audio = new Audio(learnSuccessUrl());
      audio.preload = 'auto';
      successRef.current = audio;
    }
    playAudio(audio);
  }, [playAudio]);

  // Mistake explanations are combinatorial (picked × correct), so they are not
  // cached here — a fresh element per play is fine on the button-gated pause.
  const playWrongPhrase = useCallback(
    (correctToken: string, pickedToken: string | null): void => {
      playAudio(new Audio(learnWrongUrl(track, correctToken, pickedToken)));
    },
    [track, playAudio],
  );

  return {
    deck,
    ready: !!deck,
    prefetch,
    playToken,
    playPhrase,
    playFind,
    playFindAll,
    playFindStartsWith,
    playVocab,
    playSuccessPhrase,
    playWrongPhrase,
    stopAudio,
  };
}
