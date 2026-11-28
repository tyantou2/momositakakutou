const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const D=require('../js/data.js');
const onlineSource=fs.readFileSync(require.resolve('../js/online.js'),'utf8');
const configSource=fs.readFileSync(require.resolve('../js/connection-config.js'),'utf8');
const relay={config:{iceServers:[{urls:'turns:relay.example.com:443?transport=tcp',username:'game',credential:'scoped-password'}]},relay:true};
function clock(){let id=0;const timers=new Map();return {timers,setTimeout(fn,delay){const n=++id;timers.set(n,{fn,delay});return n;},clearTimeout(n){timers.delete(n);},run(delay){const entry=[...timers].find(([,v])=>v.delay===delay);assert.ok(entry,'timer '+delay);timers.delete(entry[0]);entry[1].fn();}};}
function harness(load=async()=>structuredClone(relay)){
 const c=clock(),peers=[],errors=[],states=[];
 class Conn extends EventEmitter{constructor(){super();this.open=false;this.metadata={v:'dojo-3.9'};this.sent=[];}send(m){this.sent.push(m);}close(){this.closed=true;this.open=false;this.emit('close');}start(){this.open=true;this.emit('open');}}
 class Peer extends EventEmitter{constructor(id,options){super();this.id=id;this.options=options;this.connections=[];peers.push(this);}connect(id,options){const conn=new Conn();conn.target=id;conn.options=options;this.connections.push(conn);return conn;}reconnect(){this.reconnects=(this.reconnects||0)+1;}destroy(){this.destroyed=true;}start(){this.open=true;this.disconnected=false;this.emit('open');}}
 const dojo={...D,ConnectionConfig:{load}};
 vm.runInNewContext(onlineSource,{Dojo:dojo,VdoPeer:Peer,VDONinjaSDK:class{},RTCPeerConnection:class{},crypto:require('node:crypto').webcrypto,performance:{now:()=>100},setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,setInterval:c.setTimeout,clearInterval:c.clearTimeout});
 const net=new dojo.Online({status:n=>states.push(n.status),error:m=>errors.push(m)});
 return {net,peers,Conn,c,errors,states};
}
test('both room owners and guests prepare connection settings before constructing Peer',async()=>{
 for(const code of [undefined,'ABCD2345']){
  const h=harness();await h.net.open(code);const p=h.peers[0];assert.equal(h.net.relayConfigured,true);p.start();
  if(code){assert.equal(p.connections[0].target,'momoshita-v39-'+code);assert.equal(p.connections[0].options.metadata.v,'dojo-3.9');}
  else assert.equal(h.net.status,'waiting');h.net.close();assert.equal(h.c.timers.size,0);
 }
});
test('relay preparation failure gives an actionable error and never starts an unconfigured peer',async()=>{
 const h=harness(async()=>{throw Error('中継サービスの準備ができませんでした。');});await h.net.open();assert.equal(h.peers.length,0);assert.equal(h.net.status,'error');assert.match(h.errors[0],/中継/);
});
test('closing or opening another room during async configuration cannot resurrect a stale room',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>resolve=r));const opening=h.net.open();h.net.close();resolve(relay);await opening;assert.equal(h.peers.length,0);
 let old;h.net.close();const first=h.net.open();old=resolve;const second=h.net.open('ABCD2345');resolve(relay);await second;old(relay);await first;assert.equal(h.peers.length,1);assert.equal(h.net.code,'ABCD2345');h.net.close();
});
test('failed incoming negotiation releases its slot and preserves the room and invite code',async()=>{
 const h=harness();await h.net.open();const p=h.peers[0];p.start();const code=h.net.code,c1=new h.Conn();p.emit('connection',c1);assert.equal(h.net.status,'connecting');c1.emit('error',Error('ICE failed'));assert.equal(h.net.status,'waiting');assert.equal(h.net.code,code);assert.equal(h.net.conn,null);assert.equal(p.destroyed,undefined);
 const c2=new h.Conn();p.emit('connection',c2);c2.start();assert.equal(h.net.status,'connected');assert.equal(h.net.conn,c2);assert.ok(c2.sent.some(m=>m.type==='hello'));h.net.close();
});
test('negotiation timeout also frees a host room, while a guest gets a retry error',async()=>{
 for(const guest of [false,true]){const h=harness();await h.net.open(guest?'ABCD2345':undefined);const p=h.peers[0];p.start();if(!guest)p.emit('connection',new h.Conn());h.c.run(30000);assert.equal(h.net.status,guest?'error':'waiting');assert.equal(h.net.conn,null);h.net.close();}
});
test('waiting hosts reconnect signaling without replacing their invite code',async()=>{
 const h=harness();await h.net.open();const p=h.peers[0];p.start();const code=h.net.code;p.open=false;p.disconnected=true;p.emit('disconnected');assert.equal(h.net.status,'waiting');assert.equal(h.errors.length,0);h.c.run(1000);assert.equal(p.reconnects,1);p.start();assert.equal(h.net.code,code);assert.equal(h.net.status,'waiting');assert.equal(h.c.timers.size,0);h.net.close();
});
test('signaling recovery is bounded and does not recreate a pending outgoing data channel',async()=>{
 const h=harness();await h.net.open('ABCD2345');const p=h.peers[0];p.start();p.open=false;p.disconnected=true;p.emit('disconnected');h.c.run(1000);p.start();assert.equal(p.connections.length,1);h.net.close();
 const k=harness();await k.net.open();const q=k.peers[0];q.start();q.open=false;q.disconnected=true;q.emit('disconnected');for(let i=0;i<3;i++){k.c.run(1000);k.c.run(5000);}assert.equal(q.reconnects,3);assert.equal(k.net.status,'error');assert.equal(k.c.timers.size,0);
});
test('a signaling outage does not destroy established P2P, but a real data disconnect still ends it once',async()=>{
 const h=harness();await h.net.open();const p=h.peers[0];p.start();const c=new h.Conn();p.emit('connection',c);c.start();h.net.status='battle';p.disconnected=true;p.emit('disconnected');p.emit('error',{type:'network'});assert.equal(h.net.status,'battle');assert.equal(h.errors.length,0);c.close();assert.equal(h.net.status,'error');assert.equal(h.errors.length,1);c.emit('close');assert.equal(h.errors.length,1);assert.equal(h.c.timers.size,0);
});
function configHarness(fetch){
 const dojo={},c=clock();vm.runInNewContext(configSource.replace('const credentialEndpoint="";','const credentialEndpoint="https://game.metered.live/api/v1/turn/credentials?apiKey=public-scoped-key";'),{Dojo:dojo,fetch,structuredClone,AbortController,Date,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});return {...dojo.ConnectionConfig,c};
}
const valid=[{urls:['turn:relay.example.com:80','turn:relay.example.com:443?transport=tcp','turns:relay.example.com:443?transport=tcp'],username:'u',credential:'p'}];
test('relay config validates authenticated TURN across UDP, TCP, TLS and rejects malformed responses',()=>{
 const h=configHarness();assert.equal(h.validate(valid).length,3);
 for(const bad of [null,[],[{urls:'https://wrong.example.com'}],[{urls:'turn:a',username:'u'}],[{urls:'stun:a'}]])assert.throws(()=>h.validate(bad));
});
test('relay credential requests are deduplicated, cached briefly, and handed out as independent configs',async()=>{
 let requests=0,options;const h=configHarness(async(url,init)=>{requests++;options=init;return {ok:true,json:async()=>valid};});const [a,b]=await Promise.all([h.load(),h.load()]);assert.equal(requests,1);a.config.iceServers.length=0;assert.equal(b.config.iceServers.length,3);assert.equal((await h.load()).config.iceServers.length,3);assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');assert.equal(h.c.timers.size,0);
});
test('failed credential requests are not cached and may be retried',async()=>{
 let requests=0;const h=configHarness(async()=>({ok:++requests>1,json:async()=>valid}));await assert.rejects(h.load(),/中継サービス/);assert.equal((await h.load()).relay,true);assert.equal(requests,2);assert.equal(h.c.timers.size,0);
});
test('a stuck credential request is aborted and cannot freeze room creation forever',async()=>{
 const h=configHarness((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')))));const request=h.load();h.c.run(8000);await assert.rejects(request,/中継サービス/);assert.equal(h.c.timers.size,0);
});

