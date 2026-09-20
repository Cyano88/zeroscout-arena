import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {auditFailureCode,auditDiagnostic,assertAuditCompletion} from '../server/src/services/audit-diagnostics.js';
test('diagnostics distinguish parse, schema, truncation and deadline failures',()=>{
 assert.equal(auditFailureCode(new SyntaxError('secret output')),'invalid_json');
 const parsed=z.string().safeParse(4);assert.equal(auditFailureCode(parsed.success?null:parsed.error),'invalid_schema');
 assert.equal(auditFailureCode({code:'LP_OUTPUT_TRUNCATED'}),'output_truncated');
 const abort=new AbortController();abort.abort();assert.equal(auditFailureCode(Error('private source'),abort.signal),'deadline_exceeded');
 assert.equal(auditFailureCode({status:429}),'provider_http_429');
 assert.equal(auditFailureCode({name:'APIConnectionTimeoutError'}),'provider_timeout');
});
test('diagnostics never log error text, stack, source or arbitrary provider codes',()=>{
 const original=console.warn;const captured:unknown[]=[];console.warn=(...args)=>{captured.push(args)};
 try{auditDiagnostic('review',Date.now(),{message:'SECRET',stack:'SOURCE',code:'TOKEN',status:9999});}finally{console.warn=original;}
 const text=JSON.stringify(captured);for(const forbidden of ['SECRET','SOURCE','TOKEN'])assert.equal(text.includes(forbidden),false);
 assert.equal(text.includes('provider_or_validation_failure'),true);
});

test('provider refusal rejects partial text and complete-looking JSON alike',()=>{
 for(const content of ['partial','{"summary":"looks complete"}']){
  assert.throws(()=>assertAuditCompletion({stop_reason:'refusal',content:[{type:'text',text:content}]},'messages'),(e:any)=>auditFailureCode(e)==='provider_refusal');
 }
 assert.throws(()=>assertAuditCompletion({choices:[{finish_reason:'content_filter',message:{content:'{}'}}]},'chat-completions'));
 assert.throws(()=>assertAuditCompletion({choices:[{finish_reason:'stop',message:{refusal:'declined'}}]},'chat-completions'));
 assert.doesNotThrow(()=>assertAuditCompletion({stop_reason:'end_turn'},'messages'));
});

test('SDK timeout subclasses are classified even when Error.name is generic',()=>{
 class APIConnectionTimeoutError extends Error {}
 assert.equal(auditFailureCode(new APIConnectionTimeoutError('private request text')),'provider_timeout');
});
