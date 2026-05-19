import { useEffect, useState } from 'react';
import { AlertCircle, Database, DollarSign, RefreshCw, TrendingUp } from 'lucide-react';
import type { ExtensionMessage } from '../shared/messages';
import type { ListingInput, ValuationResponse, ComparableListing } from '../shared/types';
import { API_BASE_URL } from '../shared/constants';
import ListingSummary from './components/ListingSummary';
import ConfidenceMeter from './components/ConfidenceMeter';
import ComparableTable from './components/ComparableTable';
import FairValueBadge from './components/FairValueBadge';

function send<T extends ExtensionMessage>(message: ExtensionMessage) {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

function confidenceLabel(result: ValuationResponse) {
  const tier = result.valuation.confidenceTier;
  if (tier) return tier.replace('-', ' ').replace(/^./, (letter) => letter.toUpperCase());
  return `${Math.round(result.valuation.confidenceScore * 100)}%`;
}

export default function App() {
  const [listing, setListing] = useState<ListingInput | null>(null);
  const [result, setResult] = useState<ValuationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [compsLoading, setCompsLoading] = useState(false);
  const [scrapedComps, setScrapedComps] = useState<ComparableListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extract = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await send<ExtensionMessage>({ type: 'EXTRACT_LISTING' });
      if (res.type === 'LISTING_EXTRACTED') {
        setListing(res.listing);
        setScrapedComps(null);
        if (res.listing) void lookupComps(res.listing);
      } else if (res.type === 'VALUATION_ERROR') setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not extract listing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void extract();
  }, []);

  const lookupComps = async (nextListing: ListingInput) => {
    setCompsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/comps/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextListing)
      });
      if (!res.ok) throw new Error(`Comps API error ${res.status}`);
      const data = (await res.json()) as { comps: ComparableListing[] };
      setScrapedComps(data.comps);
    } catch {
      setScrapedComps([]);
    } finally {
      setCompsLoading(false);
    }
  };

  const estimate = async () => {
    if (!listing) return;
    setLoading(true);
    setError(null);
    try {
      const res = await send<ExtensionMessage>({ type: 'REQUEST_VALUATION', listing });
      if (res.type === 'VALUATION_RESULT') setResult(res.result);
      else if (res.type === 'VALUATION_ERROR') setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Valuation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 16, display: 'grid', gap: 12 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>
          <TrendingUp size={20} /> Fair Value
        </h1>
        <button className="btn" onClick={extract} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      {error && (
        <div className="card" style={{ color: '#991b1b' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {listing ? <ListingSummary listing={listing} /> : <div className="card muted">{loading ? 'Scanning page…' : 'No listing detected'}</div>}

      <button className="btn" onClick={estimate} disabled={!listing || loading}>
        <DollarSign size={16} /> Estimate Fair Value
      </button>

      {listing && !result && (
        <section className="card">
          <h3>Comparable listings</h3>
          {compsLoading ? <p className="muted">Finding comparable listings...</p> : <ComparableTable comps={scrapedComps ?? []} />}
        </section>
      )}

      {result && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h2>
              ${result.valuation.fairValueLow.toLocaleString()}–${result.valuation.fairValueHigh.toLocaleString()}
            </h2>
            <FairValueBadge pos={result.marketPosition} />
          </div>
          <p>
            Median estimate: <b>${result.valuation.fairValueMedian.toLocaleString()}</b> from {result.valuation.comparableCount}{' '}
            comparable{result.valuation.comparableCount === 1 ? '' : 's'}.
          </p>
          <div className="card" style={{ background: '#f8fafc', padding: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Database size={14} /> Estimate source
              </span>
              <b>{confidenceLabel(result)} confidence</b>
            </div>
            <small className="muted">{result.valuation.estimateSource ?? 'Based on available comparable data'}</small>
          </div>
          <ConfidenceMeter score={result.valuation.confidenceScore} />
          <h3>Comparables</h3>
          <ComparableTable comps={result.valuation.comparables} />
        </section>
      )}
    </main>
  );
}
