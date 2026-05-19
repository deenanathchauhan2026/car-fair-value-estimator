export const isLikelyVin = (vin) => !!vin && /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
