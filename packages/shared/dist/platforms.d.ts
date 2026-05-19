export declare const platforms: readonly ["facebook_marketplace", "autotrader", "cargurus", "craigslist", "generic"];
export type Platform = typeof platforms[number];
export declare function platformFromUrl(url: string): Platform;
