import type {Request,Response} from 'express'
import {fundraisingRequestSchema} from '../../shared/crypto-fundraising.js'
import {privateIdentity} from './private-access.js'
import {fundraisingConfigured,generateFundraising} from './services/crypto-fundraising.js'
export function fundraisingHandler(generate=generateFundraising,identity=privateIdentity,configured=fundraisingConfigured){return async(req:Request,res:Response)=>{
 res.setHeader('Cache-Control','private, no-store')
 if(!identity(req)){res.status(401).json({error:'A dedicated Crypto Fundraising Intelligence key is required.'});return}
 const parsed=fundraisingRequestSchema.safeParse(req.body)
 if(!parsed.success){res.status(400).json({error:'Check the fundraising schema, date range, categories and result limit.'});return}
 if(!configured()){res.status(503).json({error:'Fundraising retrieval is not configured.'});return}
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),125000)
 const disconnect=()=>{if(!res.writableEnded)abort.abort()};res.once('close',disconnect)
 try{const result=await generate(parsed.data,abort.signal);if(!abort.signal.aborted)res.json(result);else if(!res.destroyed)res.status(504).json({error:'Fundraising research timed out; no complete result was produced.'})}
 catch{if(!res.destroyed)res.status(abort.signal.aborted?504:503).json({error:'Fundraising research could not complete. No historical result was produced.'})}
 finally{clearTimeout(timer);res.removeListener('close',disconnect)}
}}
