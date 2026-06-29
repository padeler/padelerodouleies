import { Link } from 'react-router-dom';
import { useT } from '../../../i18n/store';
import './Games.css';

const GAMES = [
  { path: 'memory', emoji: '🃏', titleKey: 'games.memory.title', descKey: 'games.memory.desc' },
  { path: 'simon', emoji: '🚦', titleKey: 'games.simon.title', descKey: 'games.simon.desc' },
  { path: 'catcher', emoji: '⭐', titleKey: 'games.catcher.title', descKey: 'games.catcher.desc' },
  { path: 'snake', emoji: '🐍', titleKey: 'games.snake.title', descKey: 'games.snake.desc' },
  { path: 'whack', emoji: '🐹', titleKey: 'games.whack.title', descKey: 'games.whack.desc' },
  { path: 'numbers', emoji: '🔢', titleKey: 'games.numbers.title', descKey: 'games.numbers.desc' },
  { path: 'letters', emoji: '🔤', titleKey: 'games.letters.title', descKey: 'games.letters.desc' },
];

export function GamesHub() {
  const t = useT();
  return (
    <div className="games-hub">
      <h2>🎮 {t('games.title')}</h2>
      <div className="games-grid">
        {GAMES.map((game) => (
          <Link key={game.path} to={game.path} className="game-card">
            <span className="game-card-emoji">{game.emoji}</span>
            <span className="game-card-title">{t(game.titleKey)}</span>
            <span className="game-card-desc">{t(game.descKey)}</span>
            <span className="game-card-play">{t('games.play')} ▶</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
