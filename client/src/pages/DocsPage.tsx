export function DocsPage() {
  return (
    <main className="page-narrow">
      <header className="page-heading">
        <span className="eyebrow">Verify</span>
        <h1>How proof works</h1>
        <p>ZeroScout turns a project into a verifiable Project Passport. The full record lives on 0G. The app only keeps a small index so pages load quickly.</p>
      </header>

      <section className="surface surface-pad docs">
        <h2>What ZeroScout does</h2>
        <p>It takes a builder's repo, demo, and checkpoint notes and creates a public Project Passport. The page includes an AI Scout Signal, readiness signal, next steps, and ready-to-share copy.</p>

        <h2>How programs plug in</h2>
        <p>Organizations can use a hosted campaign link today, embed a campaign widget with an iframe, or read campaign/project data through API endpoints. Zero Cup and Grail Builders University are built-in campaign templates.</p>

        <h2>How intelligence is generated</h2>
        <p>The backend asks 0G Compute Router to draft the brief, signal, risks, and share copy. If the router is unavailable, a clearly labelled fallback provider is used and recorded in the artifact.</p>

        <h2>Where the proof lives</h2>
        <p>The full project artifact is uploaded to 0G as a content-addressed record. You get a <code>root</code> and a <code>content hash</code>. If 0G upload fails in production, profile creation fails - there is no silent fallback.</p>

        <h2>The local index</h2>
        <p>The list of profiles you see on the Projects and Campaigns pages comes from a small local index used purely for discovery. The index never overrides the canonical record on 0G.</p>

        <h2>How to verify</h2>
        <p>Open any Project Passport, click <code>Verify JSON</code> to fetch the artifact, and compare its <code>content hash</code> against the <code>root</code>. The transaction link opens the 0G explorer for that storage tx.</p>

        <h2>No fake claims</h2>
        <p>If a profile shows the <code>Local</code> tag, the artifact was not stored on 0G. The success state, including the full-color proof badge, only appears for capsules that successfully landed on 0G.</p>
      </section>
    </main>
  );
}
