import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BrowserProvider, sha256, toUtf8Bytes } from 'ethers'
import { KeyRound, RefreshCw, Copy, ShieldCheck } from 'lucide-react'
import { privateServices, type PrivateService } from '../../../shared/private-services'

export const owner = '0xa2ae0a3b3ed7b30ab049685a934de587a0f51d66'
type Key = { id:string; name:string; platform:string; service:PrivateService; expires_at:string; revoked:boolean; daily_limit:number; minute_limit:number; concurrent_limit:number }
export default function PrivateKeysPage({walletControls,connectionReady=true,getWalletProvider}: {walletControls?:ReactNode;connectionReady?:boolean;getWalletProvider?:()=>Promise<ConstructorParameters<typeof BrowserProvider>[0]>}={}) {
  const mounted=useRef(true)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  const [keys,setKeys]=useState<Key[]>([])
  const [secret,setSecret]=useState('')
  const [name,setName]=useState('polydesk-production')
  const [platform,setPlatform]=useState('PolyDesk')
  const [service,setService]=useState<PrivateService>('lp-intelligence')
  const [status,setStatus]=useState('')
  const [busy,setBusy]=useState(false)
  const [loaded,setLoaded]=useState(false)
  const [daily,setDaily]=useState(100)
  const [minute,setMinute]=useState(5)
  const [concurrent,setConcurrent]=useState(2)
  const [days,setDays]=useState(30)

  async function request(method:string,path:string,body:unknown={}) {
    if (method==='POST' && path==='/api/private/keys') body={...(body as object),platform,service}
    const ethereum=getWalletProvider ? await getWalletProvider() : (window as unknown as {ethereum?: ConstructorParameters<typeof BrowserProvider>[0]}).ethereum
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
    if(!mounted.current)throw new Error('Wallet session changed; request cancelled.')
    if((await provider.send('eth_accounts',[]))[0]?.toLowerCase()!==owner)throw new Error('Wallet changed; request cancelled.')
    const response=await fetch(path,{method,cache:'no-store',headers:{'content-type':'application/json','x-zs-nonce':nonce,'x-zs-expires':String(expires),'x-zs-signature':signature},...(method==='GET'?{}:{body:JSON.stringify(body)})})
    const result=await response.json()
    if(!response.ok)throw new Error(result.error||'Private key request failed')
    return result
  }
  async function perform(action:()=>Promise<void>) {
    if(!connectionReady){setStatus('Connect the designated owner wallet through Privy first.');return}
    setBusy(true);setSecret('');setStatus('Approve the key-management message in your owner wallet. This is not a transaction.')
    try{await action()}catch(error){setStatus(error instanceof Error?error.message:'Request failed. Do not retry key creation blindly; list keys first.')}finally{setBusy(false)}
  }
  return <main className="page dashboard-page private-keys-page">
    <header className="page-heading compact-heading">
      <span className="eyebrow">API Dashboard</span>
      <h1>Your ZeroScout API keys</h1>
      <p>Manage your integrations, services, and usage limits.</p>
    </header>
    <section className="dashboard-hero surface">
      <div>
        <span className="status-tag"><ShieldCheck size={12}/> Private access</span>
        <h2>{connectionReady && walletControls ? 'Owner wallet connected' : 'Connect owner wallet'}</h2>
        <p>Your owner wallet authorizes key management.</p>
        <details className="private-owner-details"><summary>Designated owner</summary><code className="private-owner">{owner}</code><p>Each action requires a signed message. No transaction or token approval.</p></details>
      </div>
      {walletControls}
    </section>

    <section className="surface key-table" aria-labelledby="private-keys-title">
      <div className="panel-head">
        <h2 id="private-keys-title">Your API keys</h2>
        <button className="btn btn-ghost btn-sm" disabled={busy||!connectionReady} onClick={()=>perform(async()=>{const data=await request('GET','/api/private/keys');setKeys(data.keys);setLoaded(true);setStatus('Keys loaded.')})}><RefreshCw size={13}/>{busy?'Awaiting authorization...':loaded?'Refresh keys':'Load keys'}</button>
      </div>
      {!loaded && !keys.length ? <p className="muted-copy">{connectionReady ? 'Load keys and approve the owner signature to view your private key inventory.' : 'Connect the designated owner wallet to view your keys. Signing in alone does not grant access.'}</p> : !keys.length ? <p className="muted-copy">No private keys found. Create a key below.</p> : keys.map(key=>{
        const expired=new Date(key.expires_at).getTime()<=Date.now()
        return <div className="key-row" key={key.id}>
          <div><strong>{key.name}</strong><span>{key.platform} ? {privateServices.find(option=>option.id===key.service)?.label || 'Unknown service (access denied)'}</span><code>{key.id}</code></div>
          <div><b>{key.daily_limit}/day</b><span>{key.minute_limit}/min ? {key.concurrent_limit} concurrent</span></div>
          <div><b>{new Date(key.expires_at).toLocaleDateString()}</b><span>Expires</span></div>
          <span className={key.revoked||expired?'pill danger':'pill'}>{key.revoked?'Revoked':expired?'Expired':'Active'}</span>
          <div className="key-actions"><button className="btn btn-ghost btn-sm danger-action" disabled={busy||!connectionReady||key.revoked} onClick={()=>{if(window.confirm('Revoke this key? Any integration using it will lose access.'))void perform(async()=>{await request('POST',`/api/private/keys/${key.id}/revoke`);setKeys(previous=>previous.map(item=>item.id===key.id?{...item,revoked:true}:item));setStatus('Key revoked.');})}}>Revoke key</button></div>
        </div>
      })}
      <p className="table-note">Private keys only. Legacy keys are not listed. Full key values are shown once when created.</p>
    </section>

    <form className="dashboard-grid" onSubmit={event=>{event.preventDefault();void perform(async()=>{
      const result=await request('POST','/api/private/keys',{name,limits:{daily,minute,concurrent,days}})
      setSecret(result.key)
      setKeys(previous=>[...previous,{id:result.id,name,platform:result.platform,service:result.service,expires_at:result.expiresAt,revoked:false,daily_limit:result.limits.daily,minute_limit:result.limits.minute,concurrent_limit:result.limits.concurrent}])
      setStatus('Key created. Copy it into your backend secret configuration. It cannot be retrieved later.')
    })}}>
      <div className="surface dashboard-panel">
        <div className="panel-head"><span className="eyebrow">Create key</span><KeyRound size={16}/></div>
        <fieldset disabled={busy} className="private-key-fields">
          <label>Key name<input value={name} maxLength={80} onChange={e=>setName(e.target.value)} required/></label>
          <label>Platform<input value={platform} maxLength={80} onChange={e=>setPlatform(e.target.value)} required/></label>
        </fieldset>
        <fieldset disabled={busy} className="private-service-picker">
          <legend>Service configuration</legend>
          <div className="preset-picker">
            {privateServices.map(option=><button key={option.id} type="button" className={service===option.id?'preset-option on':'preset-option'} aria-pressed={service===option.id} onClick={()=>setService(option.id)}><strong>{option.label}</strong><span>{option.description}</span></button>)}
          </div>
        </fieldset>
        <button className="btn btn-primary" disabled={busy||!connectionReady||!name.trim()} type="submit">{busy?'Awaiting authorization...':'Create private API key'}</button>
        {secret&&<div className="secret-box"><span>Shown once</span><textarea aria-label="New private API key" readOnly value={secret} rows={3}/><div className="key-actions"><button className="btn btn-ghost btn-sm" type="button" onClick={()=>{void navigator.clipboard.writeText(secret).then(()=>setStatus('Key copied.'),()=>setStatus('Copy failed. Select and copy the key manually.'))}}><Copy size={13}/>Copy key</button><button className="btn btn-ghost btn-sm" type="button" onClick={()=>{setSecret('');setStatus('Key hidden.')}}>Hide key</button></div><p>Save this key in your backend secret configuration.</p></div>}
      </div>
      <div className="surface dashboard-panel">
        <div className="panel-head"><span className="eyebrow">Usage limits</span><ShieldCheck size={16}/></div>
        <p className="muted-copy">Set a quota and expiry for this integration. Private keys do not use purchased credits.</p>
        <fieldset disabled={busy} className="private-key-fields">
          {([['Requests/day',daily,setDaily,100],['Requests/minute',minute,setMinute,5],['Concurrent requests',concurrent,setConcurrent,2],['Expiry days',days,setDays,30]] as const).map(([label,value,setValue,max])=><label key={label}>{label}<input type="number" min={1} max={max} value={value} onChange={e=>setValue(Number(e.target.value))} required/></label>)}
        </fieldset>
        <details className="recovery-box"><summary>Service and usage policy</summary><p className="muted-copy">All private keys share 500 requests/day and 4 concurrent requests, with at most 10 active keys. Limits use UTC; failed downstream requests count. Quotas are not spending caps.</p><p className="muted-copy">Helper Sponsorship and Video Scoring are unavailable for private keys. Service selection is enforced per endpoint. Creating a key does not revoke existing keys.</p></details>
      </div>
    </form>
    <p className="private-key-status" role="status" aria-live="polite">{status}</p>
  </main>
}
