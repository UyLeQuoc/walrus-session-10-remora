/**
 * Long ids inside text read short (ADR-0103: a 66-character package id ran off a phone's screen and
 * repeated ten times on Home): "0xcc05…5d6d". The full id stays in what you copy or hover.
 */
export const shortIds = (text: string) =>
  text.replace(/\b0x([0-9a-fA-F]{4})[0-9a-fA-F]{12,}([0-9a-fA-F]{4})\b/g, "0x$1…$2");
