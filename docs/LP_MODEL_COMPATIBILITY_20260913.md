# LP-only Claude request compatibility

The paid LP verification failed with a deprecated-parameter error on Claude models before timing out on fallback models. The request builder supplied temperature=0.35. Current Anthropic documentation says models after Opus 4.6 reject non-default temperature and recommends omitting it: https://platform.claude.com/docs/en/about-claude/model-deprecations

An explicit internal lpCompatibility option now omits temperature only when the LP primary or optional LP verifier uses a Claude model. Both native Messages and a router-selected chat-completions fallback retain this behavior. Other models and non-LP call sites retain their previous parameters.

No changes were made to research inputs, output JSON fields, direct-trade validation, model selection, token limits, approvals, payment flows, search retrieval, or general-market research schema. The request flag is internal, not a new public schema field.

Mocked LP tests cover primary/verifier requests in both formats, result shape, and unchanged normal-intelligence sampling. Existing direct-trade and PolyDesk general research regression suites are required before deployment. No live model request or paid-job retry is part of this repair. Removal of the documented incompatible parameter is not a live latency or provider-availability guarantee; the prior 75-second abort and slow model fallbacks remain separately relevant to any later controlled retry.
