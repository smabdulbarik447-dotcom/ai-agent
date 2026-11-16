// Runs once when the Next.js server starts
export async function register() {
  // On Vercel there's no long-running server; scheduled work comes from Vercel Cron (/api/cron)
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.VERCEL) {
    const { startAutoSync } = await import('./lib/scraper.js');
    startAutoSync();
  }
}
