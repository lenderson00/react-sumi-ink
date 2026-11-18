export function Code({ code }: { code: string }) {
  return (
    <pre className="code-snippet">
      <code>{code}</code>
    </pre>
  );
}

const INSTALL = 'npm i react-sumi-ink';

export function InstallPill() {
  return (
    <button
      type="button"
      className="install-pill"
      onClick={() => navigator.clipboard.writeText(INSTALL)}
      title="Copiar comando"
    >
      <span className="muted">$</span> {INSTALL}
    </button>
  );
}