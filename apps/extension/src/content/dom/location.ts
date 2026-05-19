export function parseLocation(text?: string | null) { return text?.match(/(?:location|posted in|city)[:\s]+([^\n]{2,80})/i)?.[1]?.trim(); }
