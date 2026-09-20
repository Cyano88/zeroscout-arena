export function auditFailureCode(error: unknown, signal?: AbortSignal): string {
 if(signal?.aborted)return 'deadline_exceeded';
 if(error instanceof SyntaxError)return 'invalid_json';
 if(error&&typeof error==='object'){
  const e=error as {name?:string;code?:string;status?:number;constructor?:{name?:string}};
  if(e.name==='ZodError')return 'invalid_schema';
  if(e.code==='AUDIT_EVIDENCE_REJECTED')return 'invalid_evidence';
  if(e.code==='AUDIT_PROVIDER_REFUSAL')return 'provider_refusal';
  if(e.code==='LP_OUTPUT_TRUNCATED')return 'output_truncated';
  if(e.constructor?.name==='APIConnectionTimeoutError'||['AbortError','TimeoutError','APIConnectionTimeoutError'].includes(e.name||''))return 'provider_timeout';
  if(typeof e.status==='number'&&Number.isInteger(e.status)&&e.status>=400&&e.status<=599)return 'provider_http_'+e.status;
 }
 return 'provider_or_validation_failure';
}
export function auditDiagnostic(stage:'review'|'challenge',started:number,error?:unknown,signal?:AbortSignal){
 const data={stage,outcome:error?'failed':'complete',durationMs:Date.now()-started,...(error?{code:auditFailureCode(error,signal)}:{})};
 if(error)console.warn('[contract-audit]',data);else console.info('[contract-audit]',data);
}

export function assertAuditCompletion(raw: unknown, format:'messages'|'chat-completions'){
 const data=raw as any;
 const choice=data?.choices?.[0];
 const reason=format==='messages'?data?.stop_reason:choice?.finish_reason;
 if(reason==='refusal'||reason==='content_filter'||choice?.message?.refusal){
  throw Object.assign(new Error('Provider declined this audit request.'),{code:'AUDIT_PROVIDER_REFUSAL'});
 }
}
