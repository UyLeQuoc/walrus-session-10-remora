export function applyComposerAction(input: {
  busy: boolean;
  text: string;
  send: (text: string) => void;
  stop: () => void;
}): void {
  if (input.busy) {
    input.stop();
    return;
  }
  input.send(input.text);
}
