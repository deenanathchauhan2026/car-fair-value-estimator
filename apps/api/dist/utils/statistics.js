export const mean = (n) => n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0;
export function median(nums) { if (!nums.length)
    return 0; const s = [...nums].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
export function percentile(nums, p) { if (!nums.length)
    return 0; const s = [...nums].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))]; }
