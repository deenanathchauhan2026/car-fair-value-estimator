export function roughLocationMatch(a?: string, b?: string) { if (!a || !b) return 0.4; return a.toLowerCase().split(/[ ,]+/).some(x => x.length > 2 && b.toLowerCase().includes(x)) ? 1 : 0.5; }
