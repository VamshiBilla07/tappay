const solc=require("solc"),fs=require("fs"),path=require("path");
const files={"PaymentSettlement.sol":"../contracts/src/PaymentSettlement.sol","Mocks.sol":"Mocks.sol"};
const sources={};for(const[k,v]of Object.entries(files))sources[k]={content:fs.readFileSync(v,"utf8")};
const out=JSON.parse(solc.compile(JSON.stringify({language:"Solidity",sources,settings:{evmVersion:"cancun",outputSelection:{"*":{"*":["abi","evm.bytecode.object"]}}}}),{import:p=>({contents:fs.readFileSync(path.join("node_modules",p),"utf8")})}));
(out.errors||[]).filter(e=>e.severity=="error").forEach(e=>console.log(e.formattedMessage));
const r={};for(const f in out.contracts)for(const c in out.contracts[f])r[c]={abi:out.contracts[f][c].abi,bytecode:"0x"+out.contracts[f][c].evm.bytecode.object};
fs.writeFileSync("artifacts.json",JSON.stringify(r));console.log(Object.keys(r).join(","));
