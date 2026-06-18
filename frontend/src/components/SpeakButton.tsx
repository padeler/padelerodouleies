import { useEffect, useRef, useState } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import { useT } from '../i18n/store';
import { notifyError } from '../lib/notify';

/**
 * Speaker button that plays a spoken description of a card.
 *
 * Audio is fetched lazily from the backend TTS endpoint (synthesized on first
 * tap, cached thereafter) and played via a plain HTMLAudioElement — the only
 * thing that decodes reliably down to the Samsung Tab 4's old Android browser.
 * Playback is always user-gesture-driven (autoplay policy) and independent of
 * the sound-effects mute toggle: pressing this is an explicit request to hear it.
 *
 * Only one clip plays at a time across the page (a shared module-level handle).
 */

let activeAudio: HTMLAudioElement | null = null;

interface SpeakButtonProps {
  /** TTS audio URL, e.g. `/api/tts/chore/12.mp3`. */
  src: string;
}

type Status = 'idle' | 'loading' | 'playing';

export function SpeakButton({ src }: SpeakButtonProps) {
  const t = useT();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  // When the src URL changes (e.g. question advances), stop any current playback
  // and discard the stale audio element so the next tap fetches the new clip.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (activeAudio === audioRef.current) activeAudio = null;
      audioRef.current = null;
    }
    setStatus('idle');
  }, [src]);

  function stopActiveOther() {
    if (activeAudio && activeAudio !== audioRef.current) {
      activeAudio.pause();
    }
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation(); // never flip the card

    // Tapping again while playing stops it.
    if (status === 'playing' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setStatus('idle');
      return;
    }

    stopActiveOther();
    setStatus('loading');

    const audio = audioRef.current ?? new Audio(src);
    audioRef.current = audio;
    activeAudio = audio;

    audio.onplaying = () => setStatus('playing');
    audio.onended = () => setStatus('idle');
    audio.onpause = () => setStatus('idle');
    audio.onerror = () => {
      setStatus('idle');
      notifyError(t('common.error'));
    };

    audio.play().catch(() => {
      setStatus('idle');
      notifyError(t('common.error'));
    });
  }

  return (
    <button
      type="button"
      className={`speak-btn ${status !== 'idle' ? 'speak-btn-active' : ''}`}
      onClick={handleClick}
      aria-label={t('card.listen')}
      title={t('card.listen')}
    >
      {status === 'loading' ? (
        <Loader2 className="speak-btn-icon speak-btn-spin" size={18} aria-hidden="true" />
      ) : (
        <Volume2 className="speak-btn-icon" size={18} aria-hidden="true" />
      )}
    </button>
  );
}
