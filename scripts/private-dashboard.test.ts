import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import DashboardRoute from '../client/src/pages/DashboardRoute.js'
import PrivateKeysPage from '../client/src/pages/PrivateKeysPage.js'

test('dashboard renders the same owner-signed private key page as the direct route', () => {
  assert.equal(renderToStaticMarkup(createElement(DashboardRoute)), renderToStaticMarkup(createElement(PrivateKeysPage)))
})

test('private dashboard replaces legacy purchases with bounded key creation', () => {
  const html = renderToStaticMarkup(createElement(DashboardRoute))
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
