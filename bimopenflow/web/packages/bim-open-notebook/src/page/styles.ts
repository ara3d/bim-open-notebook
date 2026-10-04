// The notebook's look: one injected stylesheet under the "nb-" prefix, themed
// by CSS custom properties, light by default and dark under
// prefers-color-scheme (same approach as packages/app/src/styles.ts). Both
// the turn view and the notebook view (a later chunk) call
// ensureNotebookStyles; the second call is a no-op.
//
// The values follow docs/BRANDING.md: the notebook's ink-violet accent, the
// family's neutrals and status colours, Instrument Sans for the wordmark and
// headings, Public Sans for the interface, Fira Code for ids and tool lines,
// and the notebook reading scale (requests at 15 px, replies at 14.5 px on a
// 1.55 line height). The dark values are the same hues lifted onto dark
// surfaces; the guide specifies the light page only.

export const notebookCss = `
:root {
  --nb-bg: #f4f5f7;
  --nb-surface: #ffffff;
  --nb-border: #e3e6ea;
  --nb-edge: #cfd4db;
  --nb-text: #171a1f;
  --nb-dim: #5a606c;
  --nb-accent: #5a47c7;
  --nb-accent-soft: #ece8fb;
  --nb-green: #16a34a;
  --nb-amber: #d97706;
  --nb-red: #dc2626;
  --nb-request-bg: #ece8fb;
  --nb-reply-bg: #ffffff;
  --nb-font-brand: "Instrument Sans", "Public Sans", "Segoe UI", system-ui, sans-serif;
  --nb-font: "Public Sans", "Segoe UI", system-ui, sans-serif;
  --nb-font-mono: "Fira Code", "Cascadia Mono", Consolas, ui-monospace, monospace;
  --nb-column-width: 1140px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --nb-bg: #16181d;
    --nb-surface: #1f2228;
    --nb-border: #30343c;
    --nb-edge: #454a54;
    --nb-text: #e8eaee;
    --nb-dim: #9aa0ab;
    --nb-accent: #9d8ff0;
    --nb-accent-soft: #2b2650;
    --nb-green: #4ade80;
    --nb-amber: #fbbf24;
    --nb-red: #f87171;
    --nb-request-bg: #2b2650;
    --nb-reply-bg: #1f2228;
  }
}
body { margin: 0; background: var(--nb-bg); color: var(--nb-text); font: 400 14.5px/1.55 var(--nb-font); }
.nb-column { width: 100%; max-width: var(--nb-column-width); box-sizing: border-box; margin: 0 auto; padding: 24px 16px; }
.nb-turn { margin-bottom: 24px; border-bottom: 1px solid var(--nb-border); padding-bottom: 16px; }
.nb-request { background: var(--nb-request-bg); border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; }
.nb-request-text { white-space: pre-wrap; font-size: 15px; font-weight: 500; }
.nb-request-edit { width: 100%; box-sizing: border-box; min-height: 60px; font: inherit; padding: 6px; border-radius: 4px; border: 1px solid var(--nb-border); }
.nb-controls { display: flex; gap: 8px; margin-top: 6px; }
.nb-controls button {
  font: inherit; padding: 3px 10px; border: 1px solid var(--nb-border); border-radius: 4px;
  background: var(--nb-surface); color: var(--nb-text); cursor: pointer;
}
.nb-controls button:disabled { color: var(--nb-dim); cursor: default; }
.nb-reply { background: var(--nb-reply-bg); border-radius: 8px; padding: 10px 14px; }
.nb-reply p { max-width: 68ch; line-height: 1.55; margin: 0 0 10px; }
.nb-reply p:last-child { margin-bottom: 0; }
.nb-reply code { font: 400 12px/1.4 var(--nb-font-mono); background: var(--nb-bg); border-radius: 3px; padding: 0 4px; }
.nb-reply pre { background: var(--nb-bg); border: 1px solid var(--nb-border); border-radius: 6px; padding: 8px 10px; overflow-x: auto; margin: 0 0 10px; }
.nb-reply pre code { background: none; padding: 0; }
.nb-reply ul, .nb-reply ol { margin: 0 0 10px; padding-left: 22px; }
.nb-reply li { line-height: 1.5; margin-bottom: 4px; }
.nb-reply a { color: var(--nb-accent); }
.nb-md-heading { font-family: var(--nb-font-brand); font-weight: 600; margin: 10px 0 6px; }
h1.nb-md-heading { font-size: 15px; }
h2.nb-md-heading { font-size: 14px; }
h3.nb-md-heading { font-size: 13px; }
.nb-error { color: var(--nb-red); font-weight: 600; margin-bottom: 8px; }
.nb-tools { margin-bottom: 8px; }
.nb-tools summary { cursor: pointer; color: var(--nb-dim); }
.nb-tools ul { margin: 6px 0 0; padding-left: 18px; font: 400 11.5px/1.6 var(--nb-font-mono); }
.nb-tool-mark { display: inline-block; width: 1.2em; }
.nb-tool-ok .nb-tool-mark { color: var(--nb-green); }
.nb-tool-failed .nb-tool-mark { color: var(--nb-red); }
.nb-agent-info { color: var(--nb-dim); font-size: 12px; margin-top: 8px; }
.nb-embed { border: 1px solid var(--nb-border); border-radius: 8px; margin: 12px 0; overflow: hidden; }
.nb-embed-header {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  background: var(--nb-surface); border-bottom: 1px solid var(--nb-border);
}
.nb-embed-caption { font-weight: 600; }
.nb-embed-kind { font: 500 11px/1.5 var(--nb-font); text-transform: uppercase; padding: 0 6px; border-radius: 4px; background: var(--nb-accent-soft); color: var(--nb-accent); }
.nb-embed-body { padding: 10px; overflow-x: auto; }
.nb-badge { margin-left: auto; font-size: 11px; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
.nb-badge-snapshot { background: var(--nb-bg); border: 1px solid var(--nb-border); color: var(--nb-dim); }
.nb-badge-current { background: var(--nb-green); color: #fff; }
.nb-badge-changed { background: var(--nb-amber); color: #171a1f; }
.nb-badge-unavailable { background: var(--nb-red); color: #fff; }
.nb-stale { margin-top: 10px; color: var(--nb-amber); }
.nb-earlier { margin-top: 10px; }
.nb-earlier-entry { color: var(--nb-dim); margin-top: 6px; }
.nb-earlier-entry summary { cursor: pointer; }
.nb-earlier-request, .nb-earlier-reply { white-space: pre-wrap; margin: 4px 0; }
.notebook-graph-open { margin-left: 12px; }
.notebook-graph-canvas { position: relative; border: 1px solid var(--nb-border); border-radius: 6px; overflow: hidden; }
.notebook-graph-canvas[hidden] { display: none; }
.notebook-graph-cell { display: block; width: 100%; height: 100%; }
.notebook-graph-text-fold { margin-top: 8px; }
`;

const STYLE_ID = "nb-styles";

/** Injects the notebook stylesheet once per document; safe to call again. */
export function ensureNotebookStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = notebookCss;
  doc.head.appendChild(style);
}
