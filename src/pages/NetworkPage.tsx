// Read-only view of the whole SquadREN network (for drivers sizing up lanes).
import { useMemo, useState } from 'react';
import { useNetworkDrivers, useNow } from '../lib/freight/store';
import { liveState, STATUS_COLOR, STATUS_LABEL } from '../lib/freight/network';
import { truckTitle } from '../lib/freight/trucks';
import NetworkMap from '../components/freight/NetworkMap';
import DriverSheet from '../components/freight/DriverSheet';
import { DriverAvatar, toMapTruck } from '../components/freight/ui';

export default function NetworkPage() {
  const now = useNow(2000);
  const drivers = useNetworkDrivers();
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const trucks = useMemo(() => drivers.map(d => toMapTruck(d, now)), [drivers, now]);
  const selected = drivers.find(d => d.id === sel) ?? null;
  const list = drivers.filter(d => !q || `${d.name} ${truckTitle(d.truck)} ${d.itinerary?.stops.join(' ')}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="find-page">
      <div className="find-panel">
        <div className="search-card">
          <h1>The network</h1>
          <p className="muted">{drivers.length} trucks · {drivers.filter(d => liveState(d, now).status === 'driving').length} driving right now</p>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by driver, truck, or city…" />
        </div>
        <div className="results">
          {list.map(d => {
            const live = liveState(d, now);
            return (
              <button key={d.id} className={`result slim ${d.id === sel ? 'active' : ''}`} onClick={() => setSel(d.id)}>
                <DriverAvatar driver={d} size={32} />
                <div className="result-main">
                  <b>{d.name}</b>
                  <div className="result-sub">{truckTitle(d.truck)}</div>
                  <div className="result-sub" style={{ color: STATUS_COLOR[live.status] }}>● {STATUS_LABEL[live.status]}{live.nextStop ? ` → ${live.nextStop.name}` : ''}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="find-map">
        <NetworkMap trucks={trucks} selectedId={sel} onSelect={setSel} showRoutes="all" />
      </div>
      {selected && <DriverSheet driver={selected} cargo={selected.cargo} now={now} onClose={() => setSel(null)} onBook={() => {}} canBook={false} />}
    </div>
  );
}
