const publicPath = route => route === "/api/v1" || route.startsWith("/api/v1/");
const publicSource = source => source === "api/v1/route.ts" || source?.startsWith("api/v1/");

/** Declared methods are a surface contract, not evidence of authorization or execution. */
export function compareOperations(baseline, candidate) {
  const operations = web => new Set(web.handlers.filter(row => publicPath(row.path))
    .flatMap(row => row.declaredMethods.map(method => `${method} ${row.path}`)));
  const before = operations(baseline), after = operations(candidate);
  if (!before.size || !after.size) throw new Error("EMPTY_PUBLIC_API");
  const removed = [...before].filter(value => !after.has(value)).sort();
  const added = [...after].filter(value => !before.has(value)).sort();
  const invalid = candidate.handlers.filter(row => publicPath(row.path))
    .flatMap(row => row.exports.filter(item => item.status === "not_callable")
      .map(item => ({ path: row.path, method: item.method, reason: item.reason ?? "not_callable" })));
  const errors = candidate.review.filter(item => publicSource(item.source) && item.reason === "handler_syntax_error");
  const conflicts = candidate.conflicts.filter(item => item.sources.some(publicSource));
  const review = candidate.handlers.filter(row => publicPath(row.path))
    .flatMap(row => row.exports.filter(item => item.status === "needs_review")
      .map(item => ({ path: row.path, method: item.method, reason: item.reason ?? "needs_review" })));
  return { compatible: !removed.length && !invalid.length && !errors.length && !conflicts.length,
    removed, added, invalid, errors, conflicts, review };
}
