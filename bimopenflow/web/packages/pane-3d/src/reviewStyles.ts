// Layout for the 3D pane's header (toolbar, comment form, status) and the
// review forms. The panes package styles the toolbar and status as separate
// floating chips in the studio, which collide once the toolbar grows; here
// they share one header that stacks them. Colours come from the panes' CSS
// variables (with the panes defaults as fallbacks) so both themes read.

const STYLE_ID = "bof-pane3d-styles";

export const reviewCss = `
.bof-panes-hud { display: flex; flex-direction: column; }
.bof-studio .bof-panes-view3d > .bof-panes-hud {
  position: absolute; top: 8px; left: 8px; right: 8px; z-index: 2;
  align-items: flex-end; gap: 4px; pointer-events: none;
}
.bof-studio .bof-panes-view3d > .bof-panes-hud > * { pointer-events: auto; max-width: 100%; box-sizing: border-box; }
.bof-studio .bof-panes-view3d .bof-panes-hud > .bof-panes-toolbar,
.bof-studio .bof-panes-view3d .bof-panes-hud > .bof-panes-viewstatus { position: static; }
.bof-studio .bof-panes-view3d .bof-panes-hud > .bof-panes-viewstatus { align-self: flex-start; }
.bof-panes-form {
  display: flex; flex-direction: column; gap: 6px; padding: 8px; align-self: stretch;
  background: var(--bof-panes-bg, #ffffff); color: var(--bof-panes-fg, #1f2430);
  border: 1px solid var(--bof-panes-border, #d7dbe0); border-radius: 8px; font-size: 12px;
}
.bof-panes-form label { display: flex; flex-direction: column; gap: 2px; color: var(--bof-panes-fg, #1f2430); }
.bof-panes-form input {
  width: 100%; box-sizing: border-box; padding: 4px 6px; font: inherit;
  background: var(--bof-panes-bg, #ffffff); color: var(--bof-panes-fg, #1f2430);
  border: 1px solid var(--bof-panes-border, #d7dbe0); border-radius: 5px;
}
.bof-panes-view3d { position: relative; }
.bof-panes-labels { position: absolute; overflow: hidden; pointer-events: none; z-index: 1; }
.bof-panes-label {
  position: absolute; left: 0; top: 0; max-width: 220px; padding: 1px 5px; box-sizing: border-box;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; user-select: none;
  font-size: 11px; line-height: 1.35; border-radius: 4px;
  color: var(--bof-panes-fg, #1f2430); border: 1px solid var(--bof-panes-border, #d7dbe0);
  background: var(--bof-panes-bg, #ffffff);
  background: color-mix(in srgb, var(--bof-panes-bg, #ffffff) 88%, transparent);
}
.bof-panes-label[hidden] { display: none; }
.bof-panes-form-buttons { display: flex; gap: 6px; }
.bof-panes-form button, .bof-panes-edit-open {
  padding: 4px 9px; cursor: pointer; font: inherit;
  background: var(--bof-panes-bg, #ffffff); color: var(--bof-panes-fg, #1f2430);
  border: 1px solid var(--bof-panes-border, #d7dbe0); border-radius: 5px;
}
.bof-panes-form button:disabled, .bof-panes-edit-open:disabled { opacity: 0.5; cursor: default; }
`;

/** Adds the stylesheet to the document once. */
export const ensureReviewStyles = (doc: Document): void => {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = reviewCss;
  doc.head.append(style);
};
