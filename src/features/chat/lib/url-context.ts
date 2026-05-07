export const MAX_URL_CONTEXT_ITEMS = 4;

export function getUrlDisplayText(url: string) {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.hostname}${parsedUrl.pathname === "/" ? "" : parsedUrl.pathname}`;
  } catch {
    return url;
  }
}

export function normalizeUrlCandidate(url: string) {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return null;
  }

  try {
    const candidateUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;
    const normalizedUrl = new URL(candidateUrl);

    if (
      normalizedUrl.protocol !== "http:" &&
      normalizedUrl.protocol !== "https:"
    ) {
      return null;
    }

    return normalizedUrl.toString();
  } catch {
    return null;
  }
}

export function areUrlListsEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((url, index) => url === right[index])
  );
}
