import test from 'node:test'
import assert from 'node:assert/strict'
import { privateService, privateServiceAllows, privateServices } from '../shared/private-services.js'
test('service selections fail closed, including omitted and inherited names',()=>{
  for(const value of [undefined,null,'','full-platform','video-scoring','toString',[],{}]) {
    assert.throws(()=>privateService(value))
    assert.equal(privateServiceAllows(value,'/api/integrations/intelligence'),false)
  }
})
test('each scope permits only its declared endpoints',()=>{
  const paths=[...new Set(privateServices.flatMap(service=>[...service.paths])),'/api/integrations/video-score','/api/projects']
  for(const service of privateServices) for(const path of paths) {
    assert.equal(privateServiceAllows(service.id,path),(service.paths as readonly string[]).includes(path))
  }
  assert.equal(privateServiceAllows('lp-intelligence','/api/integrations/agreement-intelligence'),false)
  assert.equal(privateServiceAllows('agreement-intelligence','/api/integrations/intelligence'),false)
})
