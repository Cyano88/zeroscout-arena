import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import PrivateKeysPage from '../client/src/pages/PrivateKeysPage.js'

test('both routes use the Privy-aware dashboard wrapper', () => {
  const route=readFileSync(new URL('../client/src/pages/DashboardRoute.tsx',import.meta.url),'utf8')
  assert.match(route, /ZeroScoutPrivyProvider><PrivateWalletConnection/)
  const app=readFileSync(new URL('../client/src/main.tsx',import.meta.url),'utf8')
  assert.match(app, /const PrivateKeysPage = DashboardRoute/)
})

test('disconnected Privy sessions cannot list or create keys',()=>{
  const html=renderToStaticMarkup(createElement(PrivateKeysPage,{connectionReady:false,walletControls:createElement('button',null,'Continue with Privy')}))
  assert.match(html,/Continue with Privy/)
  assert.match(html,/<button[^>]*disabled=""[^>]*>Connect owner and list keys<\/button>/)
  assert.match(html,/<button[^>]*disabled=""[^>]*type="submit">Create private API key<\/button>/)
})

test('private dashboard replaces legacy purchases with bounded key creation', () => {
  const html = renderToStaticMarkup(createElement(PrivateKeysPage))
  assert.match(html, /Create private API key/)
  assert.match(html, /Connect owner and list keys/)
  assert.match(html, /0xa2ae0a3b3ed7b30ab049685a934de587a0f51d66/)
  assert.match(html, /Manage private API keys/)
  for(const label of ['Helper Sponsorship','Video Scoring','LP Intelligence','Agreement Intelligence','All Private Services','Service configuration','Platform']) assert(html.includes(label))
  assert.match(html, /Unavailable for private keys/)
  assert.doesNotMatch(html, /Fund credits|Live credits|Credit gateway|Create a ZeroScout API key|Treasury/)
  assert.equal((html.match(/type="number"/g) || []).length, 4)
  assert.doesNotMatch(html, /zs_private_/)
})
