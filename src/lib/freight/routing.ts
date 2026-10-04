// Road-like route suggestions: Dijkstra over a city graph whose edges are the
// interstate corridors the seeded network already drives, plus short links to
// each city's nearest neighbours so every gazetteer city is reachable.
import { haversine } from '../geo';
import { CITIES, CITY_BY_ID } from './cities';
import { SEED_DRIVERS } from './seed';

type Graph = Map<string, Map<string, number>>;
let graph: Graph | null = null;

function addEdge(g: Graph, a: string, b: string, w: number) {
  if (a === b) return;
  if (!g.has(a)) g.set(a, new Map());
  if (!g.has(b)) g.set(b, new Map());
  const cur = g.get(a)!.get(b);
  if (cur === undefined || w < cur) { g.get(a)!.set(b, w); g.get(b)!.set(a, w); }
}

function buildGraph(): Graph {
  const g: Graph = new Map();
  for (const d of SEED_DRIVERS) {
    const s = d.itinerary?.stops ?? [];
    for (let i = 1; i < s.length; i++) addEdge(g, s[i - 1], s[i], haversine(CITY_BY_ID[s[i - 1]], CITY_BY_ID[s[i]]));
  }
  // Off-corridor links are penalised so real corridors are preferred.
  for (const c of CITIES) {
    const near = CITIES.filter(o => o.id !== c.id)
      .map(o => ({ o, d: haversine(c, o) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const { o, d } of near) addEdge(g, c.id, o.id, d * 1.25);
  }
  return g;
}

export function suggestRoute(fromId: string, toId: string): string[] {
  if (!CITY_BY_ID[fromId] || !CITY_BY_ID[toId]) return [fromId, toId].filter(Boolean);
  if (fromId === toId) return [fromId];
  graph ??= buildGraph();
  const dist = new Map<string, number>([[fromId, 0]]);
  const prev = new Map<string, string>();
  const open = new Set<string>([fromId]);
  const done = new Set<string>();
  while (open.size) {
    let u = '';
    let best = Infinity;
    for (const id of open) { const d = dist.get(id)!; if (d < best) { best = d; u = id; } }
    open.delete(u);
    if (u === toId) break;
    done.add(u);
    for (const [v, w] of graph.get(u) ?? []) {
      if (done.has(v)) continue;
      const nd = best + w;
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); open.add(v); }
    }
  }
  if (!prev.has(toId)) return [fromId, toId];
  const path = [toId];
  while (path[0] !== fromId) path.unshift(prev.get(path[0])!);
  return path;
}
