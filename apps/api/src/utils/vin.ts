export const isLikelyVin = (vin?: string) => !!vin && /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
