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
  return <main className="page" style={{maxWidth:820,margin:'40px auto',padding:24}}>
    <h1>Private compute keys</h1>
    <p>Only wallet <code>{owner}</code> can manage keys. Each action requires a fresh signature. No gas or token transfer.</p>
    <p>Request quotas are not a monetary cap. Underlying compute and proof storage may consume service resources.</p>
    <button disabled={busy} onClick={()=>perform(async()=>{const data=await request('GET','/api/private/keys');setKeys(data.keys);setStatus('Keys loaded.')})}>Connect owner and list keys</button>
    <form onSubmit={event=>{event.preventDefault();void perform(async()=>{const result=await request('POST','/api/private/keys',{name,limits:{daily,minute,concurrent,days}});setSecret(result.key);setStatus('Key created. Copy it into PolyDesk’s secret configuration now. It cannot be retrieved later.');})}}>
      <h2>Create a key</h2>
      <label>Name <input value={name} maxLength={80} onChange={e=>setName(e.target.value)} required/></label>
      {([['Requests/day',daily,setDaily,100],['Requests/minute',minute,setMinute,5],['Concurrent requests',concurrent,setConcurrent,2],['Expiry days',days,setDays,30]] as const).map(([label,value,setValue,max])=><label key={label} style={{display:'block',margin:'12px 0'}}>{label} <input type="number" min={1} max={max} value={value} onChange={e=>setValue(Number(e.target.value))} required/></label>)}
      <button disabled={busy} type="submit">Sign and create key</button>
    </form>
    <p role="status">{status}</p>
    {secret&&<section><p>Shown once. Do not paste this key into chat.</p><textarea aria-label="New private API key" readOnly value={secret} rows={3} style={{width:'100%'}}/><button onClick={()=>{setSecret('');setStatus('Key hidden.')}}>Hide key</button></section>}
    <h2>Existing keys</h2>
    {keys.map(key=><section key={key.id} style={{margin:'16px 0'}}><strong>{key.name}</strong> <code>{key.id}</code><p>{key.revoked?'Revoked':`Expires ${key.expires_at}`} · {key.daily_limit}/day · {key.minute_limit}/minute · {key.concurrent_limit} concurrent</p><button disabled={busy||key.revoked} onClick={()=>{if(window.confirm('Revoke this key? Any integration using it will lose access.'))void perform(async()=>{await request('POST',`/api/private/keys/${key.id}/revoke`);setKeys(previous=>previous.map(item=>item.id===key.id?{...item,revoked:true}:item));setStatus('Key revoked.');})}}>Revoke key</button></section>)}
  </main>
}
