// Strict allowlist: never log response text, arbitrary keys, or provider messages.
export function completionMetadata(raw: unknown, format: 'chat-completions' | 'messages', inputCharacters: number) {
  const obj = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {}
  const data = obj(raw)
  const choice = obj(Array.isArray(data.choices) ? data.choices[0] : undefined)
  const message = obj(choice.message)
  const usage = obj(data.usage)
  const reason = format === 'messages' ? data.stop_reason : choice.finish_reason
  const content = format === 'messages' ? data.content : message.content
  const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null
  return {
    format,
    inputCharacters: count(inputCharacters),
    finishReason: ['stop', 'length', 'tool_calls', 'content_filter', 'function_call', 'end_turn', 'max_tokens', 'stop_sequence', 'tool_use', 'pause_turn', 'refusal'].includes(reason) ? reason : 'unknown',
    choiceCount: Array.isArray(data.choices) ? data.choices.length : 0,
    contentShape: typeof content === 'string' ? 'string' : Array.isArray(content) ? 'blocks' : content == null ? 'absent' : 'other',
    contentCharacters: typeof content === 'string' ? content.length : Array.isArray(content) ? content.reduce((n, v) => n + (typeof obj(v).text === 'string' ? obj(v).text.length : 0), 0) : 0,
    toolCallCount: Array.isArray(message.tool_calls) ? message.tool_calls.length : 0,
    refusalPresent: Boolean(message.refusal),
    inputTokens: count(usage.prompt_tokens ?? usage.input_tokens),
    outputTokens: count(usage.completion_tokens ?? usage.output_tokens),
    reasoningTokens: count(obj(usage.completion_tokens_details).reasoning_tokens),
  }
}
