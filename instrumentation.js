// Runs once when the Next.js server starts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAutoSync } = await import('./lib/scraper.js');
    startAutoSync();
  }
}
