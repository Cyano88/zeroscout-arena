import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import solc from 'solc';
import {pathToFileURL,fileURLToPath} from 'node:url';

// Original synthetic contracts. Expected outcomes are never sent to the model.
const header='// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n';
const treasury=guard=>header+`contract ReviewTarget {
    address public owner;
    address payable public treasury;
    constructor(address payable initialTreasury) { owner = msg.sender; treasury = initialTreasury; }
    receive() external payable {}
    function setTreasury(address payable next) external { ${guard}treasury = next; }
    function distribute() external {
        (bool ok,) = treasury.call{value: address(this).balance}("");
        require(ok, "Transfer failed");
    }
}
`;
const wallet=authority=>header+`contract ReviewTarget {
    address public owner;
    constructor() { owner = msg.sender; }
    receive() external payable {}
    function withdraw(address payable recipient, uint256 amount) external {
        require(${authority} == owner, "Owner only");
        (bool ok,) = recipient.call{value: amount}("");
        require(ok, "Transfer failed");
    }
}
`;
export const cases=[
 {id:'A1',source:treasury(''),expected:'vulnerable',target:'Unprivileged caller sets treasury to an attacker address, then calls distribute to drain funds deposited by others.'},
 {id:'A2',source:treasury('require(msg.sender == owner, "Owner only"); '),expected:'control',target:'Non-owner cannot change treasury. Public distribute pays the owner-selected recipient. Privileged configuration is not an unprivileged theft path.'},
 {id:'B1',source:wallet('tx.origin'),expected:'vulnerable',target:'Owner EOA calls an attacker contract; attacker forwards withdraw with attacker recipient. tx.origin remains owner, permitting theft. Owner interaction is required.'},
 {id:'B2',source:wallet('msg.sender'),expected:'control',target:'A forwarding attacker contract is msg.sender and fails the owner check. An owner-directed withdrawal is intended authority.'},
];

export function compileCase(source){
 const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'ReviewTarget.sol':{content:source}},settings:{evmVersion:'shanghai',optimizer:{enabled:false},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
 const errors=(output.errors||[]).filter(e=>e.severity==='error');
 if(errors.length)throw Error(errors.map(e=>e.formattedMessage).join('\n'));
 if(!output.contracts?.['ReviewTarget.sol']?.ReviewTarget?.evm.bytecode.object)throw Error('No compiled bytecode');
 return {compiler:solc.version(),warnings:(output.errors||[]).map(e=>({code:e.errorCode,message:e.message}))};
}

async function main(){
 const live=process.argv.includes('--live');
 const transport=process.env.AUDIT_BENCHMARK_TRANSPORT;
 const request=transport?(await import(pathToFileURL(path.resolve(transport)).href)).serverFetch:fetch;
 const key=process.env.ZEROSCOUT_AUDIT_API_KEY;
 if(live&&!/^zs_private_[A-Za-z0-9_-]{43}$/.test(key||''))throw Error('Set the dedicated audit key before --live');
 const runId=new Date().toISOString().replace(/[:.]/g,'-');
 const dir=path.resolve('output','audit-benchmark',runId);fs.mkdirSync(dir,{recursive:true});
 const results=[];
 for(const c of cases){
  const compilation=compileCase(c.source);
  const row={id:c.id,expected:c.expected,target:c.target,sha256:crypto.createHash('sha256').update(c.source).digest('hex'),compilation,status:'compiled'};
  fs.writeFileSync(path.join(dir,c.id+'.sol'),c.source);
  if(live){
   const requestId=crypto.randomUUID();const started=Date.now();
   try{
    const response=await request('https://zeroscout-arena-production.up.railway.app/api/integrations/smart-contract-audit',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({schema:'zeroscout.smart-contract-audit.request',schemaVersion:'1.0.0',requestId,sources:[{path:'ReviewTarget.sol',content:c.source}],context:'Review the supplied source and distinguish owner authority from external attacker access.',sourceSharingConsent:true}),signal:AbortSignal.timeout(90000),redirect:'error'});
    row.httpStatus=response.status;row.elapsedMs=Date.now()-started;
    if(!response.ok){row.status='service-failure';}else{
     const report=await response.json();
     if(report.schema!=='zeroscout.smart-contract-audit.result'||report.schemaVersion!=='1.0.0'||!['complete','not-needed','unavailable'].includes(report.adjudication)||!Array.isArray(report.leads)||!Array.isArray(report.falsePositives)||!Array.isArray(report.confirmedFindings)||report.confirmedFindings.length!==0)throw Error('Invalid report shape');
     if(report.requestId!==requestId||report.sources?.length!==1||report.sources[0].sha256!==row.sha256)throw Error('Source binding failed');
     row.status=report.adjudication==='unavailable'?'verification-failure':'completed';
     row.report=report;
    }
   }catch{row.status='transport-or-binding-failure';row.elapsedMs=Date.now()-started;}
  }
  results.push(row);fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({runId,live,results},null,2));
  console.log(JSON.stringify({id:row.id,status:row.status,httpStatus:row.httpStatus,elapsedMs:row.elapsedMs,adjudication:row.report?.adjudication,leads:row.report?.leads?.length,falsePositives:row.report?.falsePositives?.length}));
 }
 console.log('Artifacts: '+dir);
 if(results.some(r=>!['compiled','completed'].includes(r.status)))process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();


