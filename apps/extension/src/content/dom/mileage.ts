export function parseMileage(text?: string | null) { const m = text?.replace(/,/g,'').match(/(\d{1,6})\s*(?:mi|miles|mile|odometer)/i); return m ? Number(m[1]) : undefined; }
