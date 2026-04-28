export function isFetchNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = "cause" in error ? error.cause : undefined;
  const causeCode =
    cause && typeof cause === "object" && "code" in cause
      ? String(cause.code)
      : "";

  return (
    error.message === "fetch failed" ||
    causeCode === "ECONNRESET" ||
    causeCode === "UND_ERR_CONNECT_TIMEOUT" ||
    causeCode === "ETIMEDOUT"
  );
}

export function getNetworkErrorMessage(error: unknown, fallback: string) {
  return isFetchNetworkError(error) ? fallback : null;
}
