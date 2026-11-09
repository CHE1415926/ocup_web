// Swap this adapter for the future chat service. The terminal passes an AbortSignal.
export async function requestReply(message, { signal } = {}) {
  signal?.throwIfAborted();
  return `电文已收到，共 ${[...message].length} 字。请保持联络。`;
}
