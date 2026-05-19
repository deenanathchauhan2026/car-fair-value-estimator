export const platforms = ['facebook_marketplace', 'autotrader', 'cargurus', 'craigslist', 'generic'];
export function platformFromUrl(url) {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('facebook.'))
        return 'facebook_marketplace';
    if (host.includes('autotrader.'))
        return 'autotrader';
    if (host.includes('cargurus.'))
        return 'cargurus';
    if (host.includes('craigslist.'))
        return 'craigslist';
    return 'generic';
}
