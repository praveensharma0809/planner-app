export function normalizePlannerName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

export function findDependencyCycle(
  edges: Map<string, string[]>
): string[] | null {
  const visited = new Set<string>()
  const active = new Set<string>()
  const path: string[] = []

  function dfs(node: string): string[] | null {
    if (active.has(node)) {
      const cycleStart = path.lastIndexOf(node)
      return [...path.slice(cycleStart), node]
    }

    if (visited.has(node)) {
      return null
    }

    visited.add(node)
    active.add(node)
    path.push(node)

    for (const next of edges.get(node) ?? []) {
      const cycle = dfs(next)
      if (cycle) {
        return cycle
      }
    }

    path.pop()
    active.delete(node)
    return null
  }

  for (const node of edges.keys()) {
    const cycle = dfs(node)
    if (cycle) {
      return cycle
    }
  }

  return null
}