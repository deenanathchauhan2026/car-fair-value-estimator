export function parsePrice(text?: string | null) { const m = text?.replace(/,/g,'').match(/\$\s*(\d{3,7})(?:\.\d{2})?/); return m ? Number(m[1]) : undefined; }
