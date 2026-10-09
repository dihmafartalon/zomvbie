import type { CollisionWorld, XZ } from './Collision';

/**
 * Tiny visibility-graph path finder. Maps place nodes around large obstacles
 * (buildings); agents walk straight at their target when the line is clear and
 * otherwise route through the nodes with Dijkstra. Small props are handled by
 * collision sliding in the agent itself.
 */
export class NavGraph {
  private readonly adjacency: number[][];
  private readonly dist: Float64Array;
  private readonly prev: Int32Array;
  private readonly done: Uint8Array;
  private readonly path: number[] = [];

  constructor(
    private readonly world: CollisionWorld,
    readonly nodes: readonly XZ[],
    private readonly clearance = 0.3,
    /** Agents closer than this to a node treat it as reached and aim for the next. */
    private readonly reachRadius = 0.7,
  ) {
    this.adjacency = nodes.map((a, i) =>
      nodes
        .map((_, j) => j)
        .filter((j) => j !== i && world.navLineClear(a, nodes[j], clearance)),
    );
    this.dist = new Float64Array(nodes.length);
    this.prev = new Int32Array(nodes.length);
    this.done = new Uint8Array(nodes.length);
  }

  isClear(a: XZ, b: XZ): boolean {
    return this.world.navLineClear(a, b, this.clearance);
  }

  /**
   * Returns the point an agent at `from` should walk toward to reach `to`.
   * Returns `to` itself (same object) when it can walk straight there or no
   * route exists.
   */
  nextWaypoint(from: XZ, to: XZ): XZ {
    if (this.isClear(from, to)) return to;
    const n = this.nodes.length;
    const { dist, prev, done } = this;
    dist.fill(Infinity);
    prev.fill(-1);
    done.fill(0);

    for (let i = 0; i < n; i++) {
      if (this.isClear(from, this.nodes[i])) dist[i] = distance(from, this.nodes[i]);
    }
    for (let iter = 0; iter < n; iter++) {
      let u = -1;
      for (let i = 0; i < n; i++) {
        if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      }
      if (u < 0) break;
      done[u] = 1;
      for (const v of this.adjacency[u]) {
        const alt = dist[u] + distance(this.nodes[u], this.nodes[v]);
        if (alt < dist[v]) {
          dist[v] = alt;
          prev[v] = u;
        }
      }
    }

    let best = -1;
    let bestCost = Infinity;
    for (let i = 0; i < n; i++) {
      if (dist[i] === Infinity) continue;
      const total = dist[i] + distance(this.nodes[i], to);
      if (total < bestCost && this.isClear(this.nodes[i], to)) {
        best = i;
        bestCost = total;
      }
    }
    if (best < 0) return to;

    const path = this.path;
    path.length = 0;
    for (let i = best; i >= 0; i = prev[i]) path.push(i);
    // path is goal-side first; walk from the start side and skip reached nodes.
    for (let k = path.length - 1; k >= 0; k--) {
      const node = this.nodes[path[k]];
      if (distance(from, node) > this.reachRadius) return node;
    }
    return to;
  }
}

function distance(a: XZ, b: XZ): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
