import test from 'node:test'
import assert from 'node:assert/strict'
import { createPrivateAccess } from '../server/src/private-access.js'
async function probe(computeUsed=0,readinessUsed=0,path='/api/integrations/intelligence/readiness'){
 const writes:string[]=[];let admitted=false;let status=200
 const client={release(){},async query(sql:string,args:any[]=[]):Promise<any>{
 if(sql.startsWith('SELECT * FROM zs_private_keys'))return {rows:[{id:'test',service:'all-private',platform:'PolyDesk',daily_limit:100,minute_limit:5,concurrent_limit:2}]}
 if(sql.includes('count(*)'))return {rows:[{count:0}]}
 if(sql.includes('to_char'))return {rows:[{day:'2026-09-11',minute:'2026-09-11-17-42'}]}
 if(sql.startsWith('SELECT used'))return {rows:[{used:String(args[0]).includes(':readiness:')?readinessUsed:computeUsed}]}
 if(sql.startsWith('INSERT'))writes.push(String(args[0]))
 return {rows:[]}
 }}
 const handler=createPrivateAccess({database:async()=>({connect:async()=>client}) as any})
 const res:any={once(){},status(n:number){status=n;return this},json(){return this}}
 await handler({method:'POST',path,body:{analysisType:'polydesk-smart-market-research'},get:()=> 'Bearer zs_private_'+'a'.repeat(43)} as any,res,()=>{admitted=true})
 return {admitted,status,writes}
}
test('readiness has its own bounded counter and does not spend compute or hold a lease',async()=>{
 const old=process.env.ZEROSCOUT_PRIVATE_MODE;process.env.ZEROSCOUT_PRIVATE_MODE='true'
 try{
 const r=await probe();assert.equal(r.admitted,true);assert.deepEqual(r.writes,['test:readiness:2026-09-11-17-42'])
 assert.equal((await probe(0,30)).status,429)
 assert.equal((await probe(4)).status,429)
 assert.equal((await probe(3)).admitted,true)
 const compute=await probe(4,0,'/api/integrations/intelligence');assert.equal(compute.admitted,true);assert.equal(compute.writes.length,4)
 }finally{if(old===undefined)delete process.env.ZEROSCOUT_PRIVATE_MODE;else process.env.ZEROSCOUT_PRIVATE_MODE=old}
})
