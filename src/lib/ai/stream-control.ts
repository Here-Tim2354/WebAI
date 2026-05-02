const activeConversationStreams = new Map<string, AbortController>();

// 这里是进程内的轻量中断注册表，只服务当前 Next.js 进程里的活跃生成。
// 它不是持久化状态；页面刷新后的历史状态仍以 messages.status 为准。
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

  // 只移除自己注册的 controller，避免旧流 finally 把新一轮生成的 controller 删掉。
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

  // 浏览器断开、用户点击停止、服务端主动取消都汇总成一个 signal，
  // provider 层只需要监听这一个合并后的中断源。
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
