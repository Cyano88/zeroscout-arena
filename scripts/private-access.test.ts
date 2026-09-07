import test from 'node:test'
import assert from 'node:assert/strict'
import { Wallet } from 'ethers'
import { PRIVATE_OWNER, privateLimits, ownerActionMessage, verifyPrivateOwner } from '../server/src/private-policy.js'
import { privateAccess } from '../server/src/private-access.js'

test('staging preserves legacy traffic but never exposes unsigned private management', async () => {
  const previous=process.env.ZEROSCOUT_PRIVATE_MODE, oldStage=process.env.ZEROSCOUT_PRIVATE_KEYS_STAGING
  process.env.ZEROSCOUT_PRIVATE_MODE='false'; process.env.ZEROSCOUT_PRIVATE_KEYS_STAGING='true'
  try {
    for(const [method,path,token,expected,nextExpected] of [
      ['POST','/api/integrations/intelligence','Bearer legacy',0,true],
      ['POST','/api/private/keys','',401,false],
      ['GET','/private-keys','',0,true],
      ['POST','/api/integrations/intelligence','Bearer zs_private_invalid',401,false],
    ] as const) {
      let status=0,next=false
      const req={method,path,body:{},get:(name:string)=>name==='authorization'?token:undefined}
      const res={status:(n:number)=>{status=n;return res},json:()=>res}
      await privateAccess(req as any,res as any,()=>{next=true})
      assert.equal(status,expected,path);assert.equal(next,nextExpected,path)
    }
  } finally {
    if(previous===undefined)delete process.env.ZEROSCOUT_PRIVATE_MODE;else process.env.ZEROSCOUT_PRIVATE_MODE=previous
    if(oldStage===undefined)delete process.env.ZEROSCOUT_PRIVATE_KEYS_STAGING;else process.env.ZEROSCOUT_PRIVATE_KEYS_STAGING=oldStage
  }
})

test('limits are bounded and cannot be disabled with invalid numbers', () => {
  assert.deepEqual(privateLimits(), {daily:100,minute:5,concurrent:2,days:30})
  for (const daily of [0,-1,101,Infinity,NaN,'100']) assert.throws(() => privateLimits({daily}))
  assert.equal(privateLimits({daily:10}).daily,10)
})
test('owner authorizations bind action, body, nonce, expiry, and reject other wallets', async () => {
  const wallet=Wallet.createRandom(), nonce='ab'.repeat(32), expiry=Date.now()+60000
  const message=ownerActionMessage('POST','/api/private/keys',{name:'test'},nonce,expiry)
  assert(message.includes(PRIVATE_OWNER))
  assert.notEqual(message,ownerActionMessage('POST','/api/private/keys',{name:'changed'},nonce,expiry))
  const signature=await wallet.signMessage(message)
  assert.throws(() => verifyPrivateOwner('POST','/api/private/keys',{name:'test'},nonce,expiry,signature),/Owner signature/)
  assert.throws(() => verifyPrivateOwner('POST','/api/private/keys',{},nonce,0,signature),/expired/)
})
test('private middleware blocks legacy, public compute, billing and unsigned owner creation before handlers', async () => {
  const previous=process.env.ZEROSCOUT_PRIVATE_MODE
  process.env.ZEROSCOUT_PRIVATE_MODE='true'
  try {
    for (const [method,path,token,expected] of [
      ['POST','/api/dashboard/keys','',403], ['POST','/api/admin/integration-keys','admin',403],
      ['POST','/api/projects','',403], ['POST','/api/matchups','',403], ['GET','/api/ai/health','',403],
      ['POST','/api/dashboard/topups/verify','',403], ['POST','/api/integrations/intelligence','legacy',401],
      ['POST','/api/private/keys','',401],
    ] as const) {
      let status=0, next=false
      const req={method,path,body:{wallet:PRIVATE_OWNER},get:(name:string)=>name==='authorization'?token:undefined}
      const res={status:(n:number)=>{status=n;return res},json:()=>res}
      await privateAccess(req as any,res as any,()=>{next=true})
      assert.equal(status,expected,path)
      assert.equal(next,false,path)
    }
  } finally { if(previous===undefined)delete process.env.ZEROSCOUT_PRIVATE_MODE;else process.env.ZEROSCOUT_PRIVATE_MODE=previous }
})
