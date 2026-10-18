export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  if ("code" in err && err.code === "23505") return true;
  if ("cause" in err) return isUniqueViolation(err.cause);
  return false;
}
