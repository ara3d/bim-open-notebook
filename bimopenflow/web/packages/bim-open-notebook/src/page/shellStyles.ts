// The look of the notebook page around the turns: the toolbar, the problem
// list, the live progress of a running request, and the request box. Uses the
// custom properties styles.ts defines (light, and dark under
// prefers-color-scheme), so the two sheets theme together.

export const shellCss = `
.nb-shell { min-height: 100vh; display: flex; flex-direction: column; }
.nb-brand {
  display: flex; align-items: center; gap: 8px; flex: none;
  padding: 6px 16px; min-height: 22px; background: var(--nb-surface); border-bottom: 1px solid var(--nb-border);
  font-size: 12px; line-height: 1.4; color: var(--nb-dim); overflow: hidden; white-space: nowrap;
}
.nb-brand-mark { flex: none; fill: var(--nb-accent); }
.nb-brand-name {
  display: inline-flex; gap: 4px; font: 700 15px/1 var(--nb-font-brand); letter-spacing: -0.01em;
  color: var(--nb-text); overflow: hidden; text-overflow: ellipsis;
}
.nb-brand-family { font-weight: 600; color: var(--nb-dim); }
.nb-brand-link { flex: none; margin-left: auto; color: var(--nb-dim); text-decoration: none; }
.nb-brand-link:hover, .nb-brand-link:focus { color: var(--nb-accent); text-decoration: underline; }
.nb-toolbar {
  position: sticky; top: 0; z-index: 10; display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
  padding: 8px 16px; background: var(--nb-surface); border-bottom: 1px solid var(--nb-border);
}
.nb-title {
  flex: 1 1 220px; min-width: 120px; font: 600 18px/1.2 var(--nb-font-brand); color: var(--nb-text);
  background: transparent; border: 1px solid transparent; border-radius: 4px; padding: 4px 6px;
}
.nb-title:hover, .nb-title:focus { border-color: var(--nb-border); outline: none; }
.nb-toolbar button, .nb-toolbar select, .nb-ask button {
  font: 600 13px/1.4 var(--nb-font); padding: 4px 10px; border: 1px solid var(--nb-edge); border-radius: 4px;
  background: var(--nb-surface); color: var(--nb-text); cursor: pointer;
}
.nb-ask .nb-send:not(:disabled) { background: var(--nb-accent); border-color: var(--nb-accent); color: #fff; }
.nb-toolbar button:disabled, .nb-toolbar select:disabled, .nb-ask button:disabled { color: var(--nb-dim); cursor: default; }
.nb-toolbar-sep { width: 1px; align-self: stretch; background: var(--nb-border); margin: 0 4px; }
.nb-status { flex-basis: 100%; font-size: 12px; color: var(--nb-dim); min-height: 1em; }
.nb-status:empty { display: none; }
.nb-problems {
  margin: 12px auto 0; max-width: var(--nb-column-width); padding: 10px 14px; border: 1px solid var(--nb-red);
  border-radius: 8px; color: var(--nb-text); background: var(--nb-surface);
}
.nb-problems-heading { font-weight: 600; color: var(--nb-red); }
.nb-problems ul { margin: 6px 0; padding-left: 18px; font: 400 12px/1.5 var(--nb-font-mono); }
.nb-empty { color: var(--nb-dim); text-align: center; padding: 32px 0; }
.nb-note { color: var(--nb-dim); font-style: italic; margin: 0 0 12px; border-left: 3px solid var(--nb-border); padding-left: 10px; }
.nb-live {
  border: 1px dashed var(--nb-accent); border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;
  background: var(--nb-surface);
}
.nb-live-request { font-weight: 600; white-space: pre-wrap; margin-bottom: 6px; }
.nb-live ul { margin: 0; padding-left: 18px; font-size: 13px; }
.nb-live-ok { color: var(--nb-text); }
.nb-live-failed { color: var(--nb-red); }
.nb-live-note { color: var(--nb-dim); }
.nb-ask {
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px 0 16px; background: var(--nb-bg);
}
@media (min-height: 600px) {
  .nb-ask { position: sticky; bottom: 0; }
}
.nb-ask textarea {
  width: 100%; box-sizing: border-box; min-height: 64px; resize: vertical; font: inherit; padding: 8px;
  color: var(--nb-text); background: var(--nb-surface); border: 1px solid var(--nb-edge); border-radius: 6px;
}
.nb-ask textarea:focus { outline: none; border-color: var(--nb-accent); }
.nb-ask textarea:disabled { color: var(--nb-dim); }
.nb-ask-row { display: flex; align-items: center; gap: 8px; }
.nb-ask-row .nb-send { margin-left: auto; }
.nb-ask-note { font-size: 12px; color: var(--nb-dim); }
`;

const STYLE_ID = "nb-shell-styles";

/** Injects the page-shell stylesheet once per document; safe to call again. */
export function ensureShellStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = shellCss;
  doc.head.appendChild(style);
}
