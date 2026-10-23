export const MONTHLY_PAPER_PATH = '/monthly-paper';

/** Paper of the Month ids whose check is a whiteboard, in place of the quiz. */
const MONTHLY_PAPER_BOARDS: Record<string, string> = {
  gfs: 'gfs-01-crawl-append-timeout',
};

export function boardChallengeForPaper(paperId: string): string | null {
  return MONTHLY_PAPER_BOARDS[paperId] || null;
}

/** "October 2026" — the month a paper was picked in, or the current month for the default pick. */
export function monthLabel(at: number | null): string {
  return new Date(at ?? Date.now()).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
