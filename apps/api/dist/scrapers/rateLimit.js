const lastRequestAt = new Map();
const cooldownMs = Number(process.env.SCRAPER_COOLDOWN_MS ?? 10000);
const jitterMs = 1000;
export async function waitForSourceCooldown(source) {
    if (process.env.NODE_ENV === 'test')
        return;
    const last = lastRequestAt.get(source) ?? 0;
    const wait = Math.max(0, last + cooldownMs + Math.floor(Math.random() * jitterMs) - Date.now());
    if (wait > 0)
        await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt.set(source, Date.now());
}
export const scraperHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};
