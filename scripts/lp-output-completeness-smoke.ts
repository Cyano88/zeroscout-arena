import assert from 'node:assert/strict';
process.env.ZG_COMPUTE_API_KEY='test-only';
process.env.ZG_COMPUTE_BASE_URL='https://router.example.test/v1';
process.env.ZEROSCOUT_LP_VERIFIER_ENABLED='false';
process.env.ZEROSCOUT_LP_MODEL='claude-primary';
process.env.ZEROSCOUT_FULL_PLATFORM_MODEL='claude-fallback';
const { generateCustomIntelligence }=await import('../server/src/services/ai.js');
const { config }=await import('../server/src/config.js');
const originalFetch=globalThis.fetch;
const lp={partner:'PolyDesk',productType:'prediction-market',analysisType:'lp-market-intelligence',objective:'Review saved evidence',outputStyle:'brief',data:{scout:{candidateAudit:{scanned:80,conservativePassed:0,rejectedCandidates:[]}}}};
const valid={summary:'80 scanned, no passing candidate; missing records remain unknown.',intelligenceScore:32,confidence:55};
try {
 for(const transport of ['messages','chat']) {
  config.computeLpModel=transport==='messages'?'claude-primary':'deepseek-primary';
  const calls:Array<{model:string;max_tokens:number}>=[];
  globalThis.fetch=async (_url, init={})=>{
   const body=JSON.parse(String(init.body));calls.push(body);
   const primary=body.model===config.computeLpModel;
   const native=String(_url).endsWith('/messages');
   // Even syntactically valid output must be rejected if provider says truncated.
   const content=JSON.stringify(primary?{summary:'MUST NOT ACCEPT'}:valid);
   return new Response(JSON.stringify(native?{stop_reason:primary?'max_tokens':'end_turn',content:[{type:'text',text:content}]}:{choices:[{finish_reason:primary?'length':'stop',message:{content}}]}),{status:200,headers:{'content-type':'application/json'}});
  };
  const result=await generateCustomIntelligence(lp);
  assert.equal(result.summary,valid.summary);
  assert.equal(calls.filter(x=>x.model===config.computeLpModel).length,1,'No same-model replay on output exhaustion');
  assert(calls.every(x=>x.max_tokens===4096),'LP output budget applies to both transports');
 }
 for(const bad of ['{"summary":"partial"} trailing {"summary":', '{"summary":', '{}', '', '[]']) {
  let calls=0;
  globalThis.fetch=async (_url, init={})=>{
   calls++;const native=String(_url).endsWith('/messages');
   return new Response(JSON.stringify(native?{stop_reason:'end_turn',content:[{type:'text',text:bad}]}:{choices:[{finish_reason:'stop',message:{content:bad}}]}),{status:200,headers:{'content-type':'application/json'}});
  };
  await assert.rejects(generateCustomIntelligence(lp),/no partial report was accepted/);
  assert(calls>0);
 }
 console.log('LP output completeness passed: both transport truncation flags, 4096-token budget, no same-model truncation replay, malformed/partial/empty JSON rejected. No live compute.');
}finally{globalThis.fetch=originalFetch;}
