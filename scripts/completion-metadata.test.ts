import test from 'node:test'
import assert from 'node:assert/strict'
import { completionMetadata } from '../server/src/services/completion-metadata.js'

test('captures empty content and token exhaustion without leaking response contents', () => {
  const meta = completionMetadata({ secret: 'PRIVATE', choices: [{ finish_reason: 'length', message: { content: '', refusal: 'PRIVATE', tool_calls: [{ arguments: 'PRIVATE' }] } }], usage: { completion_tokens: 1200, completion_tokens_details: { reasoning_tokens: 1200 } } }, 'chat-completions', 16000)
  assert.equal(meta.finishReason, 'length')
  assert.equal(meta.reasoningTokens, 1200)
  assert.equal(meta.contentCharacters, 0)
  assert.equal(meta.refusalPresent, true)
  assert.equal(JSON.stringify(meta).includes('PRIVATE'), false)
})
test('messages metadata and malformed fields remain sanitized', () => {
  const meta = completionMetadata({ stop_reason: 'PRIVATE', content: [{ text: 'PRIVATE' }], usage: { input_tokens: -1, output_tokens: 'PRIVATE' } }, 'messages', 10)
  assert.equal(meta.finishReason, 'unknown')
  assert.equal(meta.contentCharacters, 7)
  assert.equal(meta.inputTokens, null)
  assert.equal(meta.outputTokens, null)
  assert.equal(JSON.stringify(meta).includes('PRIVATE'), false)
  assert.equal(completionMetadata(null, 'chat-completions', 0).contentShape, 'absent')
})
