const activeConversationStreams = new Map<string, AbortController>();

export function registerConversationStream(
  conversationId: string,
  abortController: AbortController,
) {
  activeConversationStreams.set(conversationId, abortController);
}

export function unregisterConversationStream(
  conversationId: string,
  abortController: AbortController,
) {
  const currentAbortController = activeConversationStreams.get(conversationId);

  if (currentAbortController === abortController) {
    activeConversationStreams.delete(conversationId);
  }
}

export function cancelConversationStream(conversationId: string) {
  const abortController = activeConversationStreams.get(conversationId);

  if (!abortController) {
    return false;
  }

  abortController.abort();
  return true;
}

export function mergeAbortSignals(signals: Array<AbortSignal | undefined>) {
  const mergedAbortController = new AbortController();

  const abort = () => {
    if (!mergedAbortController.signal.aborted) {
      mergedAbortController.abort();
    }
  };

  for (const signal of signals) {
    if (!signal) {
      continue;
    }

    if (signal.aborted) {
      abort();
      break;
    }

    signal.addEventListener("abort", abort, { once: true });
  }

  return mergedAbortController;
}
