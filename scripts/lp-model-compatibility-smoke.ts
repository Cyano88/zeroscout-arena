import assert from 'node:assert/strict'
process.env.ZG_COMPUTE_API_KEY='test-only'
process.env.ZG_COMPUTE_BASE_URL='https://router.example.test/v1'
process.env.ZEROSCOUT_LP_MODEL='claude-fable-5'
process.env.ZEROSCOUT_LP_VERIFIER_MODEL='claude-sonnet-5'
process.env.ZEROSCOUT_LP_VERIFIER_ENABLED='true'
process.env.ZEROSCOUT_FULL_PLATFORM_MODEL='claude-normal-control'
const originalFetch=globalThis.fetch
const captured:Array<{url:string;body:Record<string,unknown>}>=[]
let chatOnly=false
const result={summary:'No candidate passed.',signals:[],riskFlags:[],recommendedActions:['Review the saved findings.'],dataGaps:[],intelligenceScore:50,confidence:40,intelligenceRating:7,strengths:[],gaps:[],recommendation:'Review'}
globalThis.fetch=async(url,init={})=>{
 const body=JSON.parse(String(init.body));const endpoint=String(url);captured.push({url:endpoint,body})
 if(chatOnly && endpoint.endsWith('/messages')) return new Response(JSON.stringify({error:{message:'supported: [openai]'}}),{status:400})
 const output=endpoint.endsWith('/messages')?{content:[{type:'text',text:JSON.stringify(result)}]}:{choices:[{message:{content:JSON.stringify(result)}}]}
 return new Response(JSON.stringify(output),{status:200,headers:{'content-type':'application/json'}})
}
try {
 const {generateCustomIntelligence}=await import('../server/src/services/ai.js')
 const lp={partner:'PolyDesk',productType:'prediction-market',analysisType:'lp-market-intelligence',objective:'Review saved evidence',outputStyle:'brief',data:{proofClass:'paid_lp_scout_proof',scout:{opportunities:[]}}}
 const first=await generateCustomIntelligence(lp)
 assert.equal(first.summary,result.summary)
 assert.equal(captured.length,2)
 assert(captured.every(r=>!('temperature' in r.body)))
 assert(captured.every(r=>r.body.max_tokens===2400))
 assert(first.modelReview)
 captured.length=0;chatOnly=true
 const alternate=await generateCustomIntelligence(lp)
 assert.equal(alternate.summary,first.summary)
 assert(captured.some(r=>r.url.endsWith('/chat/completions')))
 assert(captured.every(r=>!('temperature' in r.body)))
 captured.length=0;chatOnly=false
 await generateCustomIntelligence({...lp,productType:'custom-platform',analysisType:'custom-intelligence',data:{message:'normal schema control'}})
 assert(captured.length>0)
 assert(captured.every(r=>r.body.temperature===0.35),'Non-LP transport must keep previous parameters')
 console.log('LP primary + verifier omit deprecated sampling in both transports; normal intelligence parameters and result shape preserved. No live compute.')
} finally {globalThis.fetch=originalFetch}
