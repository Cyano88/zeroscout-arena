import { useState } from 'react'
import { BrowserProvider, sha256, toUtf8Bytes } from 'ethers'

const owner = '0xa2ae0a3b3ed7b30ab049685a934de587a0f51d66'
type Key = { id:string; name:string; expires_at:string; revoked:boolean; daily_limit:number; minute_limit:number; concurrent_limit:number }
export default function PrivateKeysPage() {
  const [keys,setKeys]=useState<Key[]>([])
  const [secret,setSecret]=useState('')
  const [name,setName]=useState('polydesk-production')
  const [status,setStatus]=useState('Connect the designated owner wallet to manage private keys.')
  const [busy,setBusy]=useState(false)
  const [loaded,setLoaded]=useState(false)
  const [daily,setDaily]=useState(100)
  const [minute,setMinute]=useState(5)
  const [concurrent,setConcurrent]=useState(2)
  const [days,setDays]=useState(30)

  async function request(method:string,path:string,body:unknown={}) {
    const ethereum=(window as unknown as {ethereum?: ConstructorParameters<typeof BrowserProvider>[0]}).ethereum
    if(!ethereum)throw new Error('Open this page in the browser with your owner wallet extension enabled.')
    const provider=new BrowserProvider(ethereum)
    await provider.send('eth_requestAccounts',[])
    const signer=await provider.getSigner()
    if((await signer.getAddress()).toLowerCase()!==owner)throw new Error('Select the designated PolyDesk owner wallet. No signature was requested.')
    const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('')
    const expires=Date.now()+240000
    const bodyHash=sha256(toUtf8Bytes(JSON.stringify(body))).slice(2)
    const message=['ZeroScout private key administration','Owner: '+owner,'Method: '+method,'Path: '+path,'Body SHA256: '+bodyHash,'Nonce: '+nonce,'Expires: '+expires].join('\n')
    const signature=await signer.signMessage(message)
    if((await provider.send('eth_accounts',[]))[0]?.toLowerCase()!==owner)throw new Error('Wallet changed; request cancelled.')
    const response=await fetch(path,{method,cache:'no-store',headers:{'content-type':'application/json','x-zs-nonce':nonce,'x-zs-expires':String(expires),'x-zs-signature':signature},...(method==='GET'?{}:{body:JSON.stringify(body)})})
    const result=await response.json()
    if(!response.ok)throw new Error(result.error||'Private key request failed')
    return result
  }
  async function perform(action:()=>Promise<void>) {
    setBusy(true);setSecret('');setStatus('Approve the key-management message in your owner wallet. This is not a transaction.')
    try{await action()}catch(error){setStatus(error instanceof Error?error.message:'Request failed. Do not retry key creation blindly; list keys first.')}finally{setBusy(false)}
  }
  return <main className="page dashboard-page private-keys-page">
    <header className="page-heading compact-heading">
      <span className="eyebrow">Private API Dashboard</span>
      <h1>Create private API key</h1>
      <p>Manage PolyDesk's private access to ZeroScout compute. Issue owner-signed keys with individual usage limits and expiry.</p>
    </header>
    <section className="dashboard-hero surface">
      <div><span className="status-tag">Owner-controlled access</span>
        <h2>PolyDesk private compute</h2>
        <p>Only the designated wallet can create, list, or revoke keys.</p>
        <code className="private-owner">{owner}</code>
        <p>Use this wallet in your browser extension. Each action requires a fresh message signature, not a transaction or token approval.</p>
      </div>
      <button className="btn btn-primary" disabled={busy} onClick={()=>perform(async()=>{const data=await request('GET','/api/private/keys');setKeys(data.keys);setLoaded(true);setStatus('Keys loaded.')})}>{busy?'Awaiting authorization...':'Connect owner and list keys'}</button>
    </section>
    <section className="surface surface-pad private-key-policy">
      <h2>Usage limits, not purchased credits</h2>
      <p>Private keys bypass ZeroScout credit deductions. Set up to 100 requests/day, 5/minute, 2 concurrent requests, and 30 days of validity per key. You can choose lower limits.</p>
      <p>All private keys share 500 requests/day and 4 concurrent requests, with at most 10 active keys. Daily and minute windows use UTC. Failed downstream requests also count.</p>
      <p>These are request quotas, not spending caps. Underlying compute and proof storage may still consume service resources.</p>
    </section>
    <form onSubmit={event=>{event.preventDefault();void perform(async()=>{const result=await request('POST','/api/private/keys',{name,limits:{daily,minute,concurrent,days}});setSecret(result.key);setStatus('Key created. Copy it into PolyDesk’s secret configuration now. It cannot be retrieved later.');})}}>
      <h2>Create private API key</h2>
      <p>Give each integration its own key so you can limit or revoke it independently.</p>
      <fieldset disabled={busy} className="private-key-fields">
      <label>Key name <input value={name} maxLength={80} onChange={e=>setName(e.target.value)} required/></label>
      {([['Requests/day',daily,setDaily,100],['Requests/minute',minute,setMinute,5],['Concurrent requests',concurrent,setConcurrent,2],['Expiry days',days,setDays,30]] as const).map(([label,value,setValue,max])=><label key={label} style={{display:'block',margin:'12px 0'}}>{label} <input type="number" min={1} max={max} value={value} onChange={e=>setValue(Number(e.target.value))} required/></label>)}
      </fieldset>
      <button className="btn btn-primary" disabled={busy||!name.trim()} type="submit">{busy?'Awaiting authorization...':'Create private API key'}</button>
    </form>
    <p className="surface surface-pad-sm" role="status" aria-live="polite">{status}</p>
    {secret&&<section><p>Shown once. Do not paste this key into chat.</p><textarea aria-label="New private API key" readOnly value={secret} rows={3} style={{width:'100%'}}/><button onClick={()=>{setSecret('');setStatus('Key hidden.')}}>Hide key</button></section>}
    <h2>Manage private API keys</h2>
    <p>{loaded ? (keys.length ? 'List keys again after creation to refresh this inventory.' : 'No private keys were returned. Create a key above, then refresh the list.') : 'Connect the owner and sign the list request to load your keys. Existing legacy keys are not shown here.'}</p>
    {keys.map(key=><section key={key.id} style={{margin:'16px 0'}}><strong>{key.name}</strong> <code>{key.id}</code><p>{key.revoked?'Revoked':`Expires ${key.expires_at}`} · {key.daily_limit}/day · {key.minute_limit}/minute · {key.concurrent_limit} concurrent</p><button disabled={busy||key.revoked} onClick={()=>{if(window.confirm('Revoke this key? Any integration using it will lose access.'))void perform(async()=>{await request('POST',`/api/private/keys/${key.id}/revoke`);setKeys(previous=>previous.map(item=>item.id===key.id?{...item,revoked:true}:item));setStatus('Key revoked.');})}}>Revoke key</button></section>)}
  </main>
}
