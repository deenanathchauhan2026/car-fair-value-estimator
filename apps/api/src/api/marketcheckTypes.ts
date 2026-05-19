export type MarketCheckSearchInput = {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  vin?: string;
  zip?: string;
  radius?: number;
  rows?: number;
};

export type MarketCheckListing = {
  id?: string | number;
  vin?: string;
  heading?: string;
  price?: number;
  miles?: number;
  vdp_url?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  build?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
  };
  dealer?: {
    name?: string;
    city?: string;
    state?: string;
    zip?: string;
    seller_type?: string;
  };
};

export type MarketCheckPredictedPrice = {
  predicted_price: number;
  range_low?: number;
  range_high?: number;
  confidence?: string | number;
};

export type MarketCheckVinDecode = {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  [key: string]: unknown;
};

export type MarketCheckSearchResponse = {
  listings?: MarketCheckListing[];
  num_found?: number;
  stats?: unknown;
};
