import { Link } from 'react-router-dom';
import { useT } from '../../../i18n/store';
import './Games.css';

/** Shared chrome for a single game: back link to the hub + title. */
export function GamePage({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="game-page">
      <div className="game-page-head">
        <Link to="/dashboard/games" className="game-back">
          ← {t('games.back')}
        </Link>
        <h2>
          {emoji} {title}
        </h2>
      </div>
      {children}
    </div>
  );
}
