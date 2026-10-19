export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "4rem auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Hirzo</h1>
      <p style={{ opacity: 0.8, marginBottom: "1.5rem" }}>
        Employer backend is ready. Use the API routes under{" "}
        <code>/api/auth</code>, <code>/api/employers</code>, and{" "}
        <code>/api/applications</code>. See README for examples.
      </p>
      <ul style={{ lineHeight: 1.8 }}>
        <li>Employer register / login / session</li>
        <li>Job posts with qualification &amp; video questions</li>
        <li>Application review → shortlist → interview → hire</li>
      </ul>
    </main>
  );
}
