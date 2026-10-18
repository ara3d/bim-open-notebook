// A small inline form for the 3D pane's review controls: labelled text fields,
// an "Add to graph" submit, and "Cancel". An empty required field does nothing
// but take focus. Built with DOM calls only, so it works headless.

export interface FormField { name: string; label: string; required?: boolean }

export interface FormSpec<K extends string> {
  fields: readonly (FormField & { name: K })[];
  /** Runs with the trimmed values; the form closes when it resolves and stays open when it throws. */
  onSubmit(values: Record<K, string>): Promise<void>;
}

/** Shows the form in `host` (replacing any earlier one) and returns a function that removes it. */
export function openForm<K extends string>(host: HTMLElement, spec: FormSpec<K>, className: string): () => void {
  const doc = host.ownerDocument;
  const form = doc.createElement("form");
  form.className = className;
  const inputs = new Map<K, HTMLInputElement>();
  for (const field of spec.fields) {
    const label = doc.createElement("label");
    label.textContent = field.label;
    const input = doc.createElement("input");
    input.type = "text";
    input.name = field.name;
    label.append(input);
    form.append(label);
    inputs.set(field.name, input);
  }
  const submit = doc.createElement("button");
  submit.type = "submit";
  submit.textContent = "Add to graph";
  const cancel = doc.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  const buttons = doc.createElement("div");
  buttons.className = "bof-panes-form-buttons";
  buttons.append(submit, cancel);
  form.append(buttons);
  const close = () => form.remove();
  cancel.addEventListener("click", close);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = {} as Record<K, string>;
    for (const field of spec.fields) {
      const input = inputs.get(field.name)!;
      values[field.name] = input.value.trim();
      if (field.required && values[field.name] === "") { input.focus(); return; }
    }
    spec.onSubmit(values).then(close, () => {});
  });
  host.replaceChildren(form);
  inputs.get(spec.fields[0].name)?.focus();
  return close;
}
