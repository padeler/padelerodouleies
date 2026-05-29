import './PageBackground.css';

export type BgVariant =
  | 'login'
  | 'chores'
  | 'rewards'
  | 'history'
  | 'leaderboard'
  | 'approvals'
  | 'users'
  | 'fulfillment'
  | 'activity';

/**
 * Maps a route pathname to a tab-specific background variant. Each variant
 * carries its own (theme-aware) colour palette evoking the tab's purpose.
 */
export function bgVariantForPath(pathname: string): BgVariant {
  if (pathname.startsWith('/admin')) {
    if (pathname.includes('/chores')) return 'chores';
    if (pathname.includes('/rewards')) return 'rewards';
    if (pathname.includes('/users')) return 'users';
    if (pathname.includes('/fulfillment')) return 'fulfillment';
    if (pathname.includes('/activity')) return 'activity';
    return 'approvals';
  }
  if (pathname.startsWith('/dashboard')) {
    if (pathname.includes('/marketplace')) return 'rewards';
    if (pathname.includes('/history')) return 'history';
    if (pathname.includes('/leaderboard')) return 'leaderboard';
    return 'chores';
  }
  return 'login';
}

/** Decorative, full-window animated background. Sits behind all page content. */
export function PageBackground({ variant }: { variant: BgVariant }) {
  return (
    <div className={`page-bg page-bg-${variant}`} aria-hidden="true">
      <span className="bg-blob blob-a" />
      <span className="bg-blob blob-b" />
      <span className="bg-blob blob-c" />
    </div>
  );
}
