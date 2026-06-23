export function DocsPage() {
  return (
    <main className="single-page docs-page">
      <section className="panel">
        <span className="eyebrow">Verify</span>
        <h1>How records work</h1>
        <p className="large-copy">ZeroScout stores the full project artifact on 0G Storage. The app keeps a small local index only so pages load quickly.</p>
        <h2>Stored artifact</h2>
        <p>Project details, links, 0G usage, generated brief, scores, risks, next steps, share copy, version delta, provider label, and timestamps.</p>
        <h2>Local index</h2>
        <p>Project name, round, scores, root hash, content hash, transaction hash, and dates.</p>
        <h2>AI path</h2>
        <p>The backend uses 0G Compute Router when configured. If a fallback provider is used, the generated artifact labels it clearly.</p>
        <h2>Production guard</h2>
        <p>If 0G upload fails, project creation fails unless local development fallback is explicitly enabled.</p>
      </section>
    </main>
  );
}
