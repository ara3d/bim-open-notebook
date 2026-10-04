// Paths an embed names relative to its notebook: a 3D view's model file, its
// still, a picture. A notebook is a file beside other files, so the page
// resolves each against the URL the notebook was read from (EmbedContext.base);
// a data: or absolute URL is used as it is. The build (vite/samples.ts) reads
// the same paths to copy the model files beside the notebooks.

import type { Notebook, View3dEmbed } from "./format";

/** The folder beside a notebook that holds its 3D views' model files; `model` paths start with it. */
export const MODELS_FOLDER = "models/";

/** True for a URL that needs no base: a scheme (data:, https:, blob:), or an absolute path. */
const isAbsolute = (path: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("/");

/**
 * `path` as the page should fetch it: unchanged when absolute or when the
 * notebook came from no URL (a picked file), else resolved against `base`,
 * itself resolved against the document's URL.
 */
export function resolveEmbedPath(path: string, base: string | undefined, documentUrl: string): string {
  if (isAbsolute(path) || base === undefined) return path;
  return new URL(path, new URL(base, documentUrl)).href;
}

/** Every 3D view of the notebook, current replies and earlier ones alike. */
export function view3dEmbeds(notebook: Notebook): View3dEmbed[] {
  return notebook.turns.flatMap((turn) =>
    [turn.reply, ...(turn.earlier ?? []).map((e) => e.reply)].flatMap((reply) =>
      reply.embeds.filter((e): e is View3dEmbed => e.kind === "view3d"),
    ),
  );
}

/** The distinct model files the notebook's 3D views name, in order of first use. */
export function modelFiles(notebook: Notebook): string[] {
  return [...new Set(view3dEmbeds(notebook).flatMap((e) => (e.model === undefined ? [] : [e.model])))];
}

/** The file name of a `model` path, or a sentence saying why it is not one the models folder can serve. */
export function modelFileName(path: string): { readonly file: string } | { readonly problem: string } {
  const file = path.startsWith(MODELS_FOLDER) ? path.slice(MODELS_FOLDER.length) : "";
  if (file === "" || file.includes("/") || file.includes("\\") || file === "." || file === "..")
    return { problem: `a model path is ${MODELS_FOLDER}<file name>, not "${path}"` };
  return { file };
}
