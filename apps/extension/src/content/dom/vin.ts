export function parseVin(text?: string | null) { const m = text?.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i); return m?.[1]?.toUpperCase(); }
