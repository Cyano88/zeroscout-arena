import { usePrivy, useWallets } from '@privy-io/react-auth'
import PrivateKeysPage, { owner } from './PrivateKeysPage'

export default function PrivateWalletConnection() {
  const { ready, authenticated, login, logout, connectWallet } = usePrivy()
  const { wallets, ready: walletsReady } = useWallets()
  const wallet = wallets.find(item => item.address.toLowerCase() === owner)
  const connected = ready && authenticated && walletsReady && Boolean(wallet)
  const connectionKey = `${authenticated}:${walletsReady}:${wallet?.address || ''}`
  return <PrivateKeysPage key={connectionKey}
    walletControls={<div className="wallet-actions">
      {!authenticated
        ? <button className="btn btn-primary" disabled={!ready} onClick={()=>login()}>{ready?'Continue with Privy':'Loading wallet connection...'}</button>
        : <><button className="btn btn-ghost" onClick={()=>connectWallet()}>Connect owner wallet</button><button className="btn btn-ghost" onClick={()=>logout()}>Sign out</button></>}
      <p role="status">{connected ? 'Owner wallet connected. List or create keys to approve a signed request.' : authenticated ? (walletsReady ? 'This login has no connected designated-owner wallet. Connect that wallet or sign in to the correct Privy account.' : 'Loading your connected wallets...') : 'Sign in with the same Privy account or wallet you used previously.'}</p>
    </div>}
    connectionReady={connected}
    getWalletProvider={async()=>{
      if(!connected || !wallet) throw new Error('Connect the designated owner wallet through Privy first.')
      return wallet.getEthereumProvider()
    }} />
}
