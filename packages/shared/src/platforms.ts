export const platforms = ['facebook_marketplace','autotrader','cargurus','craigslist','generic'] as const;
export type Platform = typeof platforms[number];
export function platformFromUrl(url: string): Platform {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes('facebook.')) return 'facebook_marketplace';
  if (host.includes('autotrader.')) return 'autotrader';
  if (host.includes('cargurus.')) return 'cargurus';
  if (host.includes('craigslist.')) return 'craigslist';
  return 'generic';
}
