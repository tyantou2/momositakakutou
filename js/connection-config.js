(function(D) {
  "use strict";
  // Only a credential-scoped, browser-publishable URL belongs here. Never use
  // a provider account's secret API key. See the v3.8 implementation report.
  const credentialEndpoint="";
  const stun=[
    {urls:"stun:stun.cloudflare.com:3478"},
    {urls:"stun:stun.l.google.com:19302"}
  ];
  let cached=null,expires=0,pending=null;
  function validate(servers) {
    if(!Array.isArray(servers)||!servers.length||servers.length>20)throw Error("中継サーバーの設定を読み込めませんでした。");
    let relay=false;
    const clean=servers.map(server=>{
      const urls=Array.isArray(server?.urls)?server.urls:[server?.urls];
      if(!urls.length||urls.length>8||urls.some(url=>typeof url!=="string"||url.length>512||!/^stuns?:[^\s]+$|^turns?:[^\s]+$/.test(url)))throw Error("中継サーバーの設定が正しくありません。");
      const next={urls:urls.slice()};
      if(urls.some(url=>/^turns?:/.test(url))){
        if(typeof server.username!=="string"||!server.username||typeof server.credential!=="string"||!server.credential)throw Error("中継サーバーの認証情報がありません。");
        next.username=server.username;next.credential=server.credential;relay=true;
      }
      return next;
    });
    if(!relay)throw Error("中継サーバーが設定されていません。");
    return [...stun,...clean];
  }
  async function load() {
    if(!credentialEndpoint)return {config:{iceServers:structuredClone(stun)},relay:false};
    if(cached&&Date.now()<expires)return structuredClone(cached);
    if(!pending)pending=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
      try{
        const response=await fetch(credentialEndpoint,{signal:controller.signal,cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer"});
        if(!response.ok)throw Error("relay-http");
        const iceServers=validate(await response.json());
        cached={config:{iceServers},relay:true};expires=Date.now()+60000;
        return cached;
      }catch{
        throw Error("中継サービスの準備ができませんでした。少し待ってから接続し直してください。");
      }finally{clearTimeout(timer);pending=null;}
    })();
    return structuredClone(await pending);
  }
  D.ConnectionConfig={load,validate};
})(Dojo);

