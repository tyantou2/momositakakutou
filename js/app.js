(function(D) {
  "use strict";
  const $ = id => document.getElementById(id);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const icons = {
    cpu:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4m-4-10h.01m8 0h.01M10 13h4"/>',
    local:'<circle cx="8" cy="7" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M2 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m2-6a5 5 0 0 1 6 5v1"/>',
    practice:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    fight:'<path d="M4 12a2 2 0 0 1 2-2h2V6a2 2 0 0 1 4 0V5a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v7a5 5 0 0 1-2 4l-1 1v3H8v-3l-4-4a2 2 0 0 1 0-2Z"/><path d="M8 18h9m-9-8h4v3H8"/>',
    sound:'<path d="M11 5 6 9H3v6h3l5 4V5Zm4 4a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/>',
    mute:'<path d="M11 5 6 9H3v6h3l5 4V5Zm5 5 5 5m0-5-5 5"/>',
    settings:'<path d="M3 7h18M3 17h18"/><circle cx="9" cy="7" r="2.5" fill="#231a2c"/><circle cx="15" cy="17" r="2.5" fill="#231a2c"/>'
  };
  const icon = key => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+icons[key]+"</svg>";
  const modes = { cpu:"CPU対戦",local:"ローカル対戦",practice:"練習",online:"オンライン対戦" };
  const actionNames = { left:"左",right:"右",jump:"ジャンプ",guard:"ガード",light:"弱",heavy:"強",back:"後ろ回避",spot:"その場回避",special:"必殺",skillA:"専用技1",skillB:"専用技2" };
  const looks = { hair:"髪型",eyes:"表情",outfit:"服", skin:"肌の色", hairColor:"髪の色", cloth:"服の色",glove:"グローブの色" };
  const colorNames = {skin:["ピーチ","サンド","ブロンズ","ブラウン","ローズ"],hairColor:["墨色","紫檀","栗色","金色","青緑","銀色"],cloth:["紅","藍","緑","紫","琥珀","炭色"],glove:["桃","水色","橙","若草","藤","生成り"]};
  const storageKey = "toukasonjuku.boxing.v1";
  const optionKey = "toukasonjuku.boxing.options.v1";
  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }
  const stored = read(storageKey,[]);
  let saved = Array.isArray(stored) ? stored.filter(x=>x && typeof x.id==="string" && x.id.startsWith("custom-")).slice(0,12).map(D.normalize) : [];
  const initialOptions=read(optionKey,{});
  const settings = {
    sound:initialOptions.sound!==false,
    motion:initialOptions.motion ?? !matchMedia("(prefers-reduced-motion: reduce)").matches,
    bgmVolume:Number.isFinite(initialOptions.bgmVolume)?D.clamp(initialOptions.bgmVolume,0,1):.65,
    sfxVolume:Number.isFinite(initialOptions.sfxVolume)?D.clamp(initialOptions.sfxVolume,0,1):.8,
    voiceVolume:Number.isFinite(initialOptions.voiceVolume)?D.clamp(initialOptions.voiceVolume,0,1):1,
    touchMode:["auto","on","off"].includes(initialOptions.touchMode)?initialOptions.touchMode:"auto",
    touchSize:Number.isFinite(initialOptions.touchSize)?D.clamp(initialOptions.touchSize,90,120):100,
    touchOpacity:Number.isFinite(initialOptions.touchOpacity)?D.clamp(initialOptions.touchOpacity,55,100):90
  };
  let mode="cpu", difficulty="normal", dummy="idle", screen="lobby", slot=0, editorTab="appearance";
  let selected=D.cast.slice(0,2).map(f=>f.id);
  let draft=fresh(), match=null, paused=false, fx=[], shake=0, accumulator=0, last=0;
  let returnFlash=0,returnTint="#fff0f7";
  let onlineSide=0, onlineEnded=false;
  let toastTimer, editorVersion=0;
  const keys = new Set(), queue=[null,null];
  const gameCodes = new Set(D.controls.flatMap(map=>Object.values(map)));
  const context = $("ring").getContext("2d");
  const preview = [$("preview0"),$("preview1")];
  const roster = () => [...D.cast,...saved];
  const network=new D.Online({status:()=>{if(screen==="lobby" && mode==="online")paintLobby();},start:options=>start(options),error:onlineError});
  const getFighter = i => mode==="online" && i===1 && network.remoteFighter?network.remoteFighter:roster().find(f=>f.id===selected[i]) || D.cast[i];
  const sideLabel = i => mode==="online"?(i===(screen==="battle"?onlineSide:0)?"YOU":"相手"):i===0 ? "1P" : mode==="local" ? "2P" : mode==="cpu" ? "CPU" : "DUMMY";
  const inBattle = () => screen==="battle" && match && !paused && match.phase!=="over";
  D.Touch.setup({canUse:()=>inBattle()&&!$("dialog").open,locked:()=>!!match?.inputLocked(match.fighters[mode==="online"?onlineSide:0]),gesture:()=>D.Audio.init()});
  function fresh() {
    return { ...D.normalize(D.presets.balanced), name:"" };
  }
  function node(tag, cls, content) {
    const el=document.createElement(tag);
    if (cls) el.className=cls;
    if (content!==undefined) el.textContent=content;
    return el;
  }
  function button(label, fn, cls="button secondary") {
    const el=node("button",cls,label);
    el.type="button";
    el.addEventListener("click",fn);
    return el;
  }
  function choose(options,value,onChange) {
    const el=node("select");
    for (const [v,label] of options) el.add(new Option(label,v));
    el.value=value;
    el.addEventListener("change",()=>onChange(el.value));
    return el;
  }
  function notify(message) {
    const el=$("toast");
    clearTimeout(toastTimer);el.textContent=message;el.hidden=false;
    toastTimer=setTimeout(()=>{el.hidden=true;},2600);
  }
  function drawSound() {
    $("sound").innerHTML=icon(settings.sound?"sound":"mute");
    $("sound").setAttribute("aria-pressed",String(!settings.sound));
    $("sound").setAttribute("aria-label",settings.sound?"サウンドをオフ":"サウンドをオン");
  }
  function updateOptions() {
    try { localStorage.setItem(optionKey,JSON.stringify(settings)); } catch {}
    D.Audio.mute(!settings.sound);
    D.Audio.configure(settings);D.Touch.configure(settings);D.Touch.show(screen==="battle",mode);
    drawSound();
  }
  function show(page) {
    if (page!=="battle" && screen==="battle") {
      if(mode==="online"){network.close();onlineEnded=true;}
      D.VideoCutIn.stop();
      D.Music.stop(0);D.Audio.setPaused(true);
      D.Audio.stopVoices();match=null;paused=false;clearKeys();
    }
    if (page!==screen) D.Audio.stopVoices();
    screen=page;
    D.Touch.show(page==="battle",mode);
    for (const id of ["lobby","editor","battle"]) $(id).hidden=id!==page;
    $("tab-match").classList.toggle("active",page!=="editor");
    $("tab-editor").classList.toggle("active",page==="editor");
    for (const id of ["tab-match","tab-editor"]) {
      if ($(id).classList.contains("active")) $(id).setAttribute("aria-current","page");
      else $(id).removeAttribute("aria-current");
    }
    if (page==="lobby") paintLobby();
    if (page==="editor") paintEditor();
    window.scrollTo(0,0);
  }
  function paintLobby() {
    D.VideoCutIn.prepare([getFighter(0),getFighter(1)]);
    for (let i=0;i<2;i++) {
      const f=getFighter(i);
      $("name"+i).textContent=f.name;
      $("type"+i).textContent=(f.short || "自作")+" / "+D.moves[f.special].label;
      $("side"+i).setAttribute("aria-label",sideLabel(i)+"のファイターを選ぶ "+f.name);
      D.Art.portrait(preview[i],f);
    }
    $("opponent-chip").textContent=sideLabel(1);
    const slotButtons=$$("#slot-toggle button");
    slotButtons[1].textContent=sideLabel(1);
    slotButtons.forEach((b,i)=>b.setAttribute("aria-pressed",String(i===slot)));
    $$("#modes button").forEach(b=>{
      const active=b.dataset.mode===mode;
      b.classList.toggle("selected",active);b.setAttribute("aria-pressed",String(active));
    });
    const option=$("mode-option");
    option.replaceChildren();
    if (mode==="cpu" || mode==="practice") {
      const cpu=mode==="cpu";
      const label=node("label","option",cpu?"CPU難易度":"練習相手");
      const entries=cpu?[["easy","はじめて"],["normal","通常"]]:[["idle","静止"],["guard","ガード"],["active","攻撃する"]];
      label.append(choose(entries,cpu?difficulty:dummy,v=>{if(cpu)difficulty=v;else dummy=v;}));
      option.append(label);
    }
    $("online-panel").hidden=mode!=="online";
    $("slot-toggle").hidden=mode==="online";
    $("start-label").textContent=mode==="online"?(network.localReady?"相手の準備待ち":"準備完了"):mode==="practice"?"練習開始":"試合開始";
    $("start").disabled=mode==="online" && (network.status!=="connected" || !network.remoteFighter || network.localReady) || mode==="local" && D.Touch.enabled() && innerWidth<1100;
    $("mobile-local-note").hidden=mode!=="local"||!D.Touch.enabled();
    if(mode==="online"){slot=0;paintOnline();}
    const list=$("roster");
    list.replaceChildren();
    for (const f of roster()) {
      const clicked = f.id===selected[slot];
      const card=button("",()=>{
        selected[slot]=f.id;
        if(mode==="online")network.setFighter(f);
        paintLobby();
        [...list.children].find(el=>el.dataset.fighter===f.id)?.focus({preventScroll:true});
      },"fighter-card"+(clicked?" current":""));
      card.dataset.fighter=f.id;
      card.setAttribute("aria-pressed",String(clicked));
      const canvas=node("canvas");canvas.width=224;canvas.height=232;canvas.setAttribute("aria-hidden","true");
      const desc=node("span");desc.append(node("strong","",f.name),node("small","",f.short || "自作ファイター"));
      const tags=selected.flatMap((id,i)=>id===f.id?[sideLabel(i)]:[]);
      if (tags.length) desc.append(node("small","badge",tags.join(" / ")+" 選択中"));
      card.append(canvas,desc);list.append(card);D.Art.portrait(canvas,f,true);
    }
    const add=button("",openNew,"fighter-card add-card");
    const desc=node("span");desc.append(node("strong","","ファイターを作る"),node("small","","パーツ・能力・必殺技"));
    add.append(node("span","plus","＋"),desc);list.append(add);
  }
  function selectSlot(i,scroll) {
    if(mode==="online")return;
    slot=i;paintLobby();
    if(scroll) $("roster-title").scrollIntoView({block:"nearest"});
  }
  function openNew() {
    editorVersion++;draft=fresh();editorTab="appearance";show("editor");
  }
  function redraw() {
    D.Art.portrait($("editor-preview"),D.normalize(draft));
  }
  function paintSaved() {
    const menu=$("saved");
    menu.replaceChildren(new Option("ファイターを選択",""));
    for (const f of saved) menu.add(new Option(f.name,f.id));
    menu.value=draft.id || "";
    $("load").disabled=!menu.value;
  }
  function paintEditor() {
    $("fighter-name").value=draft.name;
    $("save-message").textContent="";
    paintSaved();paintTab();redraw();
  }
  function paintTab() {
    $$(".editor-tabs button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.editor===editorTab)));
    const body=$("editor-body");
    body.replaceChildren();
    if(editorTab==="appearance") appearance(body);
    if(editorTab==="ability") ability(body);
    if(editorTab==="special") specials(body);
    if(editorTab==="voice") voiceEditor(body);
  }
  function field(label,group) {
    const block=node("div","field");
    block.append(node("div","field-heading",label),group);
    group.setAttribute("role","group");group.setAttribute("aria-label",label);
    return block;
  }
  function picked(group,index) {
    [...group.children].forEach((b,i)=>b.setAttribute("aria-pressed",String(i===index)));
  }
  function appearance(body) {
    body.append(node("h2","","外見パーツ"));
    const grid=node("div","field-grid");
    for (const [key,label] of Object.entries(looks)) {
      const palette=D.colors[key];
      const values=palette || D.looks[key];
      const group=node("div",palette?"swatches":"segments");
      values.forEach((v,i)=>{
        const choice=button(palette?"":v,()=>{draft.look[key]=i;picked(group,i);redraw();},"");
        if(palette){choice.style.setProperty("--swatch",v);choice.title=colorNames[key][i];choice.setAttribute("aria-label",colorNames[key][i]);}
        group.append(choice);
      });
      picked(group,draft.look[key]);
      grid.append(field(label,group));
    }
    const sizes=node("div","segments");
    for(let i=1;i<=10;i++) sizes.append(button(String(i),()=>{draft.height=i;picked(sizes,i-1);redraw();},""));
    picked(sizes,draft.height-1);
    grid.append(field("身長（1 小柄 ↔ 10 長身）",sizes));
    body.append(grid,node("p","note","もものすけは最小の1、桃陰は8。長身ほどパンチが少し遠くまで届き、相手の攻撃も受けやすくなります。"));
  }
  function ability(body) {
    const points=node("span","points");
    body.append(points,node("h2","","能力配分"));
    const presets=node("div","presets");
    const changeRows=[];
    const update=()=>{
      const p=D.profile(draft);
      const spent=Object.values(draft.bonus).reduce((a,b)=>a+b,0);
      points.textContent="残り "+(10-spent)+" / 10 pt";
      changeRows.forEach(fn=>fn(p,spent));
    };
    for (const preset of Object.values(D.presets)) {
      presets.append(button(preset.name,()=>{
        draft.speed=preset.speed;draft.power=preset.power;draft.bonus={...preset.bonus};update();
      },""));
    }
    body.append(presets,node("p","note","移動 ↔ 耐久、威力 ↔ 発生。各ペアは合計11。持久・回避・防御は基本値5に合計10ポイントまで追加できます。"));
    for (const [key,label,detail] of D.stats) {
      const row=node("div","skill-row"), title=node("label","",label), desc=node("div"), val=node("output");
      if (key==="speed" || key==="power") {
        const control=node("input");control.type="range";control.min=1;control.max=10;control.id="range-"+key;title.htmlFor=control.id;
        control.setAttribute("aria-label",label);
        control.addEventListener("input",()=>{draft[key]=Number(control.value);update();});
        desc.append(control,node("small","",detail));
        row.append(title,desc,val);
        changeRows.push(p=>{control.value=p[key];val.textContent=p[key]+" / 10";});
      } else {
        const track=node("span","stat-track"),fill=node("span");
        track.append(fill);desc.append(node("small","",detail),track);
        row.append(title,desc);
        if (key in draft.bonus) {
          const adjust=delta=>{
            const spent=Object.values(draft.bonus).reduce((a,b)=>a+b,0);
            if(draft.bonus[key]+delta>=0 && draft.bonus[key]+delta<=5 && spent+delta<=10) draft.bonus[key]+=delta;
            update();
          };
          const minus=button("−",()=>adjust(-1),"point-btn"),plus=button("＋",()=>adjust(1),"point-btn"),stepper=node("div","stepper");
          minus.setAttribute("aria-label",label+"を1減らす");plus.setAttribute("aria-label",label+"を1増やす");
          stepper.append(minus,val,plus);row.append(stepper);
          changeRows.push((p,spent)=>{
            fill.style.width=p[key]*10+"%";val.textContent=p[key]+"/10";
            minus.disabled=draft.bonus[key]===0;plus.disabled=draft.bonus[key]===5 || spent>=10;
          });
        } else {
          row.append(val);
          changeRows.push(p=>{fill.style.width=p[key]*10+"%";val.textContent=p[key]+" / 10";});
        }
      }
      body.append(row);
    }
    update();
  }
  function specials(body) {
    body.append(node("h2","","装備する必殺技"),node("p","note","1種類を装備。攻防と経過時間でゲージが溜まり、100%で発動。カットインの後に技が出ます。1試合で最大2回。"));
    const grid=node("div","special-grid");
    for (const key of D.specials) {
      const move=D.moves[key], b=button("",()=>{
        draft.special=key;picked(grid,D.specials.indexOf(key));
      },"special-card");
      b.style.setProperty("--spell",move.color);
      b.append(node("span","spell",move.icon),node("small","",move.type),node("strong","",move.label),node("p","",move.detail));grid.append(b);
    }
    picked(grid,D.specials.indexOf(draft.special));body.append(grid);
  }
  function voiceEditor(body) {
    body.append(node("h2","","ボイスを設定"),node("p","note","WAV・MP3・OGG・M4A。1ファイル256 KB・6秒まで。音声はこのブラウザに保存し、外部サービスへ送信しません。"));
    for(const [tag,label] of Object.entries(D.voiceSlots)) {
      const row=node("div","voice-row"), file=node("input");file.type="file";file.accept=".wav,.mp3,.ogg,.m4a";file.hidden=true;
      file.addEventListener("change",()=>importVoice(file.files[0],tag));
      const controls=node("div");
      controls.append(button("選ぶ",()=>file.click()));
      if (draft.voice[tag]) {
        controls.append(button("▶",async()=>{
          if (!await D.Audio.voice(draft.voice[tag]?.data)) notify("音声を再生できません。サウンド設定をご確認ください。");
        }),button("削除",()=>{delete draft.voice[tag];D.Audio.stopVoices();paintTab();}));
        controls.children[1].setAttribute("aria-label",label+"の音声を試聴");
        controls.children[2].setAttribute("aria-label",label+"の音声を削除");
      }
      controls.children[0].setAttribute("aria-label",label+"の音声を選ぶ");
      row.append(node("strong","",label),node("span","",draft.voice[tag]?.name || "未設定"),controls,file);
      body.append(row);
    }
  }
  async function importVoice(file,tag) {
    if(!file) return;
    const mime={wav:"audio/wav",mp3:"audio/mpeg",ogg:"audio/ogg",m4a:"audio/mp4"}[file.name.split(".").at(-1).toLowerCase()];
    if(!mime || file.size>262144 || !file.size) {notify("対応する形式の256 KB以下の音声を選んでください。");return;}
    const version=editorVersion;
    let decoder;
    try {
      decoder=new AudioContext();
      const decoded=await decoder.decodeAudioData(await file.arrayBuffer());
      if(decoded.duration>6) {notify("6秒以内の音声を選んでください。");return;}
      const data=await new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;
        reader.readAsDataURL(new Blob([file],{type:mime}));
      });
      if(editorVersion!==version || screen!=="editor") return;
      draft.voice[tag]={name:file.name,data};
      if(editorTab==="voice") paintTab();
      notify("ボイスを設定しました。保存すると対戦で使えます。");
    } catch {
      notify("音声を読み込めませんでした。別のファイルをお試しください。");
    } finally {
      if(decoder) decoder.close().catch(()=>{});
    }
  }
  function save() {
    const record=D.normalize(draft);
    record.id ||= "custom-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
    const index=saved.findIndex(f=>f.id===record.id);
    if (index<0 && saved.length>=12) {$("save-message").textContent="保存上限は12人です。保存済みのファイターを読み込むと編集できます。";return;}
    const next=[...saved];
    if(index<0) next.push(record);else next[index]=record;
    try {localStorage.setItem(storageKey,JSON.stringify(next));}
    catch {$("save-message").textContent="このブラウザの保存領域を使用できません。容量と保存設定を確認してください。";return;}
    saved=next;draft=D.normalize(record);selected[0]=record.id;slot=0;
    paintEditor();$("save-message").textContent="保存しました。対戦準備で1Pに選ばれています。";
    notify(record.name+"を保存しました");
  }
  function makeKeys(index) {
    const group=node("div","keyline");
    group.append(node("strong","",index===0?"1P":"2P"));
    for (const [action,code] of Object.entries(D.controls[index])) {
        if(action.startsWith('skill')&&getFighter(index).id!=='headman')continue;
      const pair=node("span");
      pair.append(node("kbd","",D.keyLabels[code]),node("small","",actionNames[action]));group.append(pair);
    }
    return group;
  }
  function dialog(title, attach) {
    clearKeys();if(inBattle()&&mode!=="online")togglePause();
    $("dialog-title").textContent=title;
    const content=$("dialog-content");content.replaceChildren();attach(content);
    $("dialog").showModal();
  }
  function help() {
    dialog("遊び方",content=>{
      content.append(node("p","note","弱パンチは出が速く、強パンチは遠くまで届きます。相手の溜めを見てガードか回避を選び、空振りの隙に反撃しましょう。"),makeKeys(0),makeKeys(1),
        node("p","note","後ろ回避は間合いを離し、その場回避は近距離を保ちます。ジャンプの着地には約0.2秒の隙があります。ガードを構えるとスタミナが少しずつ減り、不足時は約1.5秒間スタンします。連続必殺技は初撃が命中すると最後までつながります。"),
        node("p","note","通常技が当たる直前の約0.05秒以内に回避を入力するとジャスト回避。相手の攻撃が中断され、約0.67秒の反撃の隙が生まれます。成功後2秒間は通常の回避になります。"),
        node("p","note","必殺技の技名・動画演出中は双方が停止します。防御は必殺技発動時点の状態で判定し、演出を見てからのガード・回避は間に合いません。発動前からのガードと無敵時間内の回避が有効で、発動直前の約0.05秒以内の回避ならジャスト回避を狙えます。"),
        node("p","note","必殺技はゲージ満タンで発動し、1試合で最大2回。2分で決着がつかなければ、残り体力の割合で判定します。練習に時間・必殺回数の制限はありません。オンライン以外ではEscで一時停止できます。"));
      const credits=node("p","note","ゲーム内ボイス　桃陰＝VOICEVOX:†聖騎士 紅桜† ／ もものすけ＝VOICEVOX:猫使ビィ");
      credits.id="voice-credit";content.append(credits);
    });
  }
  function options() {
    dialog("設定",content=>{
      if(mode==="online"&&screen==="battle")content.append(node("p","note","オンライン対戦は、設定を開いている間も進みます。"));
      for(const [key,label] of [["sound","サウンド"],["motion","画面揺れ・カットインの動き"]]) {
        const row=node("label","setting-row",label), checkbox=node("input");
        checkbox.type="checkbox";checkbox.checked=settings[key];
        checkbox.addEventListener("change",()=>{settings[key]=checkbox.checked;updateOptions();});
        row.append(checkbox);content.append(row);
      }
      for(const [key,label,min,max]of [["bgmVolume","BGM音量",0,100],["sfxVolume","効果音音量",0,100],["voiceVolume","ボイス音量",0,100],["touchSize","タッチボタンの大きさ",90,120],["touchOpacity","タッチボタンの濃さ",55,100]]) {
        const row=node("label","setting-range",label),value=node("output"),input=node("input");input.type="range";input.min=min;input.max=max;input.dataset.setting=key;input.setAttribute("aria-label",label);
        const audio=key.endsWith("Volume");input.value=audio?Math.round(settings[key]*100):settings[key];value.textContent=input.value+"%";
        input.addEventListener("input",()=>{settings[key]=Number(input.value)/(audio?100:1);value.textContent=input.value+"%";updateOptions();});row.append(value,input);content.append(row);
      }
      const touch=node("label","setting-row","タッチ操作");touch.append(choose([["auto","端末に合わせる"],["on","表示する"],["off","表示しない"]],settings.touchMode,v=>{settings.touchMode=v;updateOptions();if(screen==="lobby")paintLobby();}));content.append(touch);
      const credits=node("div","music-credits");credits.append(node("strong","","音楽クレジット"));
      for(const track of Object.values(D.Music.tracks)){const p=node("p","",track.title+" — "+track.artist+" / ");const a=node("a","","配布元");a.href=track.source;a.target="_blank";a.rel="noopener";p.append(a);credits.append(p);}
      const license=node("a","","CC BY 4.0（抜粋・ループ編集・音量調整）");license.href="https://creativecommons.org/licenses/by/4.0/";license.target="_blank";license.rel="noopener";credits.append(license);content.append(credits);
      const movieCredits=node('p','','蒼閃・一文字v13は提供された完成A案の音楽・効果音を使用。決め音はKenney（CC0）。Five Armiesは旧版の同梱曲です。');const movieLicense=node('a','','動画音声の素材・利用条件');movieLicense.href='assets/yan-azure-audio-v13-LICENSE.md';movieLicense.target='_blank';movieLicense.rel='noopener';movieCredits.append(movieLicense);credits.append(movieCredits);
    });
  }
  function clearKeys() {
    keys.clear();queue.fill(null);
    D.Touch.clear();
  }
  function paintOnline() {
    $("online-message").textContent=network.message || "部屋を作って招待するか、相手から届いたコードで参加してください。";
    $("online-code-row").hidden=!network.code;
    $("online-code").value=network.code?network.code.slice(0,4)+"-"+network.code.slice(4):"";
    $("online-leave").hidden=["idle","error"].includes(network.status);
    $("online-host").disabled=$("online-join").disabled=!["idle","error"].includes(network.status);
    $("online-members").textContent=network.remoteFighter?"相手："+network.remoteFighter.name+"　"+(network.remoteReady?"準備完了":"準備中"):"";
  }
  function onlineError(message,wasBattle) {
    if(wasBattle && screen==="battle" && match && !onlineEnded) {
      onlineEnded=true;paused=true;clearKeys();D.VideoCutIn.stop();match.cinematics=[];
      D.Music.stop(0);D.Audio.setPaused(true);
      overlay("CONNECTION","対戦を終了しました",message,[["対戦準備へ",()=>show("lobby"),true]]);
    }else if(wasBattle && onlineEnded)notify(message);
  }
  function start(options) {
    D.Audio.setPaused(false);D.Audio.init();
    D.VideoCutIn.prepare(options?.fighters||[getFighter(0),getFighter(1)],true);
    if(mode==="online" && !options?.fighters){network.setFighter(getFighter(0));network.ready();return;}
    D.VideoCutIn.stop();returnFlash=0;
    D.Audio.stopVoices();D.Audio.init();
    D.Audio.resetSupers();
    onlineSide=options?.side||0;onlineEnded=false;
    match=new D.Match({fighters:options?.fighters || [getFighter(0),getFighter(1)],mode:mode==="online"?"local":mode,difficulty,dummy,online:mode==="online",seed:options?.seed??crypto.getRandomValues(new Uint32Array(1))[0]});
    document.body.classList.toggle('has-headman',match.fighters.some(f=>f.shift));
    if(mode==="online")network.attachMatch(match,{delay:options.delay,onEvents:consumeEvents});
    paused=false;fx=[];shake=0;accumulator=0;clearKeys();
    $("battle-title").textContent=modes[mode];
    $("battle-overlay").hidden=true;$("pause").disabled=false;
    $("pause").innerHTML=mode==="online"?"退出":"Ⅱ 一時停止 <kbd>Esc</kbd>";
    $("net-status").hidden=mode!=="online";
    $("practice-tools").hidden=mode!=="practice";$("dummy-live").value=dummy;$("timer-tag").textContent=mode==="practice"?"PRACTICE":"ROUND";
    $("battle-keys").replaceChildren(makeKeys(0));
    if(mode==="local") $("battle-keys").append(makeKeys(1));
    for(let i=0;i<2;i++) {
      const group=$("hud"+i);group.replaceChildren();
      const tag=mode==="online"?(i===onlineSide?"YOU":"相手"):sideLabel(i);
      const name=node("strong"), badge=node("b","",tag), f=match.fighters[i].data;
      if(i===0) name.append(badge,f.name);else name.append(f.name,badge);
      group.append(name);
      for(const [key,label] of [["hp","体力"],["sta","スタミナ"],["super","必殺ゲージ"]]) {
        const bar=node("div","bar "+key);
        bar.setAttribute("role","meter");bar.setAttribute("aria-label",sideLabel(i)+" "+label);bar.setAttribute("aria-valuemin","0");bar.setAttribute("aria-valuemax","100");
        bar.append(node("i"));group.append(bar);
      }
      group.append(node("small","spell-label"),node("div","fighter-state"));
    }
    $("form-hud").replaceChildren();$("form-hud").hidden=!match.fighters.some(f=>f.shift);
    for(const f of match.fighters)if(f.shift){const panel=node('div','form-panel');panel.id='form'+f.index;panel.append(node('strong','form-title'),node('small','form-skills'));const bar=node('div','form-duration');bar.append(node('i'));panel.append(bar);$("form-hud").append(panel);}
    show("battle");hud();D.Audio.intro(match.fighters);
    D.Music.battle();
    $("pause").focus({preventScroll:true});
  }
  function command(i) {
    const map=D.controls[i], action=queue[i];
    queue[i]=null;
    const touch=i===0?D.Touch.sample(!action):{axis:0,guard:false,action:null};
    return {axis:D.clamp(Number(keys.has(map.right))-Number(keys.has(map.left))+touch.axis,-1,1),guard:keys.has(map.guard)||touch.guard,action:action||touch.action};
  }
  function status(f) {
    if(f.exhaustion) return ["exhausted","スタミナ切れ  "+(Math.ceil(f.exhaustion/6)/10).toFixed(1)+"秒"];
    if(f.opening) return ["opening","隙あり"];
    if(f.landing) return ["recover","着地の隙"];
    if(f.stun) return ["hurt","被弾硬直"];
    if(f.perfectFlash && !f.attack) return ["perfect","ジャスト回避"];
    if(f.dodge) return ["evade",f.dodgeType==="back"?"後ろ回避":"その場回避"];
    if(f.guard) return ["guard","ガード"];
    if(f.attack) {
      const {key,move,age,wind,spent}=f.attack;
      if(key==="counter" && !spent && age<=20)return ["guard","カウンター待機"];
      if(age<wind)return ["charge",move.label+" · 溜め"];
      if(age<=wind+(move.beats.at(-1) || 0)+4 || spent && age<32)return ["attack",move.label];
      return ["recover","技の後隙"];
    }
    if(f.lift) return ["evade","空中"];
    return ["",""];
  }
  function hud() {
    const self=match.fighters[mode==="online"?onlineSide:0];D.Touch.update(!self.shift?.form&&self.meter===100&&(mode==="practice"||self.used<D.RULES.superLimit),self);
    $("audio-resume").hidden=!settings.sound||paused||D.Audio.status().state==="running";
    if(mode==="online")$("net-status").textContent=network.core?(network.core.canAdvance()?"YOU = "+(onlineSide+1)+"P　"+(network.rtt?"接続 "+network.rtt+"ms":"接続を計測中"):"通信待ち…　回線を同期しています"):"接続終了";
    const seconds=Math.ceil(match.seconds);
    $("time").textContent=mode==="practice"?"∞":Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");
    $("fight-arena").classList.toggle("cinematic",!!match.cinematic);
    match.fighters.forEach((f,i)=>{
      const group=$("hud"+i);
      for(const [key,level] of [["hp",f.hp/f.p.hp*100],["sta",f.stamina/f.p.staminaMax*100],["super",f.meter]]) {
        const bar=group.querySelector("."+key);
        const pct=Math.max(0,Math.round(level*10)/10);
        bar.firstChild.style.width=pct+"%";bar.setAttribute("aria-valuenow",String(Math.round(pct)));
        if(key==="super") bar.classList.toggle("ready",f.meter===100);
        if(key==="sta") bar.classList.toggle("low",pct<24 || !!f.exhaustion);
      }
      const suffix=f.shift?.form?'変身中・再変身不可':mode!=="practice" && f.used>=D.RULES.superLimit ? "使用上限" : f.meter===100?"発動可能":Math.floor(f.meter)+"%";
      group.querySelector(".spell-label").textContent=D.moves[f.data.special].label+" ・ "+suffix;
      const [state,text]=match.phase==="fight"?status(f):["",""];
      const label=group.querySelector(".fighter-state");
      label.dataset.state=state;
      label.textContent=text;
      if(f.shift){
        const s=f.shift,panel=$('form'+i),spec=D.Headman.forms[s.form],time=(Math.ceil(s.remaining/6)/10).toFixed(1);
        panel.dataset.form=s.form||'normal';panel.querySelector('.form-title').textContent=(i===0?'1P ':'2P ')+(spec?spec.name+' · '+(s.ending?'攻撃後に解除':time+'秒')+(s.form==='nozaki'?' · 残弾'+s.ammo:''):s.pending?'二面変身・抽選中':'村長 · 通常形態');
        const keys=D.controls[mode==='online'?0:i],keyA=D.keyLabels[keys.skillA],keyB=D.keyLabels[keys.skillB];
        const cd=n=>n?Math.ceil(n/6)/10+'秒':'使用可';panel.querySelector('.form-skills').textContent=spec?(s.form==='thermae'?keyA+' 浴場壁 '+cd(s.cooldownA)+'　'+keyB+' 間欠泉 '+cd(s.cooldownB):keyA+' 射撃 '+(s.ammo?cd(s.cooldownA):'弾切れ')+'　'+keyB+' 回り込み '+cd(s.cooldownB)):'ゲージ100%で変身。'+keyA+'・'+keyB+'は変身中に使用';panel.querySelector('.form-duration i').style.width=s.remaining/720*100+'%';
      }
    });
    if(mode==="practice") {
      const t=match.fighters[0].tally;
      $("practice-report").textContent="命中 "+t.hit+"　ガード "+t.block+"　回避 "+t.evade+"　ジャスト "+t.perfect+"　総ダメージ "+Math.round(t.dealt);
    }
    $("banner").textContent=match.cinematic?"":match.phase==="ready"?"READY":match.frame<46 && match.phase==="fight" && match.fighters.every(f=>f.used===0)?"FIGHT":"";
    const caption=$("cut-in-caption");
    const text=match.cinematic?match.cinematic.a.data.name+"の"+D.moves[match.cinematic.key].label:"";
    if(caption.textContent!==text)caption.textContent=text;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed=Math.min(80,now-last);
    last=now;
    if(screen!=="battle" || !match) return;
    const desired=Math.round(Math.min(1280,Math.max(320,$("ring").getBoundingClientRect().width*Math.min(devicePixelRatio||1,2))));
    if($("ring").width!==desired){$("ring").width=desired;$("ring").height=Math.round(desired*650/1280);}
    context.setTransform($("ring").width/1280,0,0,$("ring").height/650,0,0);
    if(mode==="online") {
      if(!onlineEnded && network.core) {
        network.health();
        const core=network.core;
        if(core?.canAdvance())accumulator+=elapsed;else accumulator=0;
        let steps=0;
        while(core && !onlineEnded && accumulator>=1000/60 && core.canAdvance() && steps++<5) {
          core.advance(command(0));
          if(!match.cinematic)fx=fx.filter(e=>++e.age<36);
          shake*=.79;returnFlash=Math.max(0,returnFlash-1);accumulator-=1000/60;
        }
      }
      D.VideoCutIn.online(match.cinematic,settings.motion,!onlineEnded && !!network.core?.canAdvance());
      $("fight-arena").classList.toggle("video-cinematic",D.VideoCutIn.isVideo(match.cinematic));
      hud();
    } else {
      const videoState=D.VideoCutIn.update(match.cinematic,paused,now);
      $("fight-arena").classList.toggle("video-cinematic",D.VideoCutIn.isVideo(match.cinematic));
      if(videoState==="done" && !paused) {
        const skipReturnFlash=D.movieFor(match.cinematic)?.skipReturnFlash;
        returnTint=match.cinematic.key==="azure"?"#dfffff":"#fff0f7";
        D.VideoCutIn.stop();
        match.endCinematic(match.cinematic,true);
        consumeEvents(match.drain());
        returnFlash=skipReturnFlash?0:8;
        queue.fill(null);
      }
      if(!paused && match.phase!=="over") {
        if(D.VideoCutIn.holds(match.cinematic)) {
          accumulator=0;
          queue.fill(null);
        } else accumulator+=elapsed;
        while(accumulator>=1000/60 && match.phase!=="over" && !D.VideoCutIn.holds(match.cinematic)) {
          match.tick(command(0),command(1));
          consumeEvents(match.drain());
          if(!match.cinematic) fx=fx.filter(e=>++e.age<36);
          shake*=.79;
          returnFlash=Math.max(0,returnFlash-1);
          accumulator-=1000/60;
        }
        if(D.VideoCutIn.holds(match.cinematic)) accumulator=0;
        hud();
      }
    }
    D.Music.update(match.cinematic);
    context.clearRect(0,0,1280,650);
    context.save();
    if(settings.motion && !paused && shake>.3 && !match.cinematic) context.translate(Math.sin(now)*shake,Math.cos(now)*shake*.44);
    D.Art.stage(context,542);
    D.HeadmanArt.world(context,match,542);
    for(const f of match.fighters){D.Art.fighter(context,f,match.frame,542);D.HeadmanArt.pose(context,f,542);}
    D.Art.effects(context,fx,542);
    D.HeadmanArt.effects(context,fx,542);
    if(settings.motion && !match.cinematic) D.Art.impactFrame(context,fx,542);
    if(match.cinematic && !D.VideoCutIn.draw(context,match.cinematic)) D.Art.cinematic(context,match.cinematic,settings.motion);
    context.restore();
    if(returnFlash) {
      context.save();
      context.globalAlpha=returnFlash/8*.65;
      context.fillStyle=returnTint;context.fillRect(0,0,1280,650);
      context.restore();
    }
  }
  function consumeEvents(events) {
    for(const event of events) {
      if(["crushRelease","rushRelease","azureRelease","morphRelease"].includes(event.type))D.Music.release(event);
      if(event.type==="special" && mode!=="online")D.VideoCutIn.start(match.cinematic,settings.motion);
      const film=mode==="online"?!!D.movieFor(event) && settings.motion:D.VideoCutIn.holds(match.cinematic);
      D.Audio.event(event,film);
      if(["crushRelease","rushRelease","azureRelease"].includes(event.type) && mode==="online"){returnFlash=8;returnTint=event.key==="azure"?"#dfffff":"#fff0f7";}
      if(event.type==="over"){D.Music.stop(.65);onlineEnded=true;result();continue;}
      if(!["fight","swing","step","jump","special","crushRelease","rushRelease","azureRelease","morphRelease","specialVoice","cutinDialogue"].includes(event.type))fx.push({...event,age:0});
      if(event.heavy)shake=event.type==="block"?3:7;
      if(event.rushFinish)shake=4;
    }
  }
  function overlay(label,title,detail,actions,statistics) {
    const card=node("div","result");
    card.setAttribute("role","region");card.setAttribute("aria-label",title);
    card.append(node("div","eyebrow",label),node("h2","",title),node("p","",detail));
    if (statistics) card.append(statistics);
    const row=node("div","actions");
    for(const [name,fn,primary] of actions) row.append(button(name,fn,primary?"button primary":undefined));
    card.append(row);
    $("battle-overlay").replaceChildren(card);$("battle-overlay").hidden=false;
    row.firstChild?.focus({preventScroll:true});
  }
  function result() {
    clearKeys();$("pause").disabled=true;
    const {winner,reason}=match.result;
    const [a,b]=match.fighters;
    const title=winner===null?"引き分け":mode==="cpu"?(winner===0?"勝利":"敗北"):sideLabel(winner)+" の勝利";
    const stats=node("div","result-stats");
    for(const [tag,label] of [["hit","命中"],["block","ガード"],["evade","回避"]]) {
      const item=node("span","",label);item.append(node("b","",a.tally[tag]+" / "+b.tally[tag]));stats.append(item);
    }
    const hp=match.fighters.map(f=>Math.round(f.hp/f.p.hp*100)+"%").join(" − ");
    const actions=mode==="online"?[["対戦準備へ",()=>show("lobby"),true]]:[["再戦",start,true],["対戦準備へ",()=>show("lobby")],["キャラを調整",openSelectedEditor]];
    overlay(reason,title,(winner===null?"":match.fighters[winner].data.name+" ｜ ")+"残り体力 "+hp,actions,stats);
  }
  function togglePause() {
    if(mode==="online"){show("lobby");return;}
    if(!match || match.phase==="over") return;
    paused=!paused;clearKeys();accumulator=0;
    D.Audio.setPaused(paused);
    if(!paused) {
      $("battle-overlay").hidden=true;$("pause").focus({preventScroll:true});return;
    }
    overlay("PAUSE","一時停止","Escでも再開できます。",[["続ける",togglePause,true],["最初から",start],["対戦準備へ",()=>show("lobby")]]);
  }
  function openSelectedEditor() {
    const found=saved.find(f=>f.id===selected[0]);
    if(found) {editorVersion++;draft=D.normalize(found);editorTab="appearance";}
    show("editor");
  }
  document.addEventListener("keydown",e=>{
    if (screen!=="battle" || $("dialog").open) return;
    if(e.code==="Escape" && !e.repeat){e.preventDefault();if(mode==="online")notify("オンライン対戦は一時停止できません。退出ボタンで対戦を終了できます。");else togglePause();return;}
    if(!inBattle() || !gameCodes.has(e.code) || /INPUT|SELECT/.test(e.target.tagName)) return;
    const index=D.controls.findIndex(map=>Object.values(map).includes(e.code));
    if(index===1 && mode!=="local") return;
    e.preventDefault();
    if(match.inputLocked(match.fighters[mode==="online"?onlineSide:index])) return;
    keys.add(e.code);
    if(e.repeat) return;
    const map=D.controls[index];
    const press=["light","heavy","jump","back","spot","special","skillA","skillB"].find(key=>map[key]===e.code);
    if(press) queue[index]=press;
  });
  document.addEventListener("keyup",e=>keys.delete(e.code));
  window.addEventListener("blur",()=>{clearKeys();if(inBattle() && mode!=="online")togglePause();});
  document.addEventListener("visibilitychange",()=>{D.Audio.visibility(!document.hidden);D.VideoCutIn.suspend(document.hidden);if(document.hidden){clearKeys();if(inBattle() && mode!=="online")togglePause();}});
  window.addEventListener("pagehide",()=>{clearKeys();D.Audio.visibility(false);D.VideoCutIn.suspend(true);});
  window.addEventListener("pageshow",()=>{D.VideoCutIn.suspend(document.hidden);D.Audio.visibility(!document.hidden);});
  $$("[data-icon]").forEach(el=>{el.innerHTML=icon(el.dataset.icon);});
  $("settings").innerHTML=icon("settings");
  $("settings").onclick=options;$("help").onclick=help;
  $("battle-settings").onclick=options;$("audio-resume").onclick=()=>D.Audio.init();
  $("fullscreen").onclick=async()=>{D.Audio.init();clearKeys();try{if(document.fullscreenElement)await document.exitFullscreen();else{await $("battle").requestFullscreen();await window.screen.orientation?.lock?.("landscape").catch(()=>{});}}catch{notify("このまま横向きにすると広く遊べます。");}};
  $("sound").onclick=()=>{settings.sound=!settings.sound;updateOptions();};
  $("close-dialog").onclick=()=>$("dialog").close();
  $("brand").onclick=$("tab-match").onclick=$("back-editor").onclick=()=>show("lobby");
  $("tab-editor").onclick=()=>show("editor");
  $$(".new-fighter").forEach(b=>b.onclick=openNew);
  $$("#modes button").forEach(b=>b.onclick=()=>{if(mode==="online" && b.dataset.mode!=="online")network.close();mode=b.dataset.mode;paintLobby();});
  $("online-host").onclick=()=>{network.selfFighter=D.onlineFighter(getFighter(0));network.open();};
  $("online-join").onclick=()=>{const code=$("online-join-code").value.toUpperCase().replace(/[^A-Z0-9]/g,"");if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code)){notify("8文字の招待コードを入力してください。");return;}network.selfFighter=D.onlineFighter(getFighter(0));network.open(code);};
  $("online-copy").onclick=async()=>{try{await navigator.clipboard.writeText($("online-code").value);notify("招待コードをコピーしました。");}catch{$("online-code").select();notify("表示された招待コードをコピーしてください。");}};
  $("online-leave").onclick=()=>{network.close();network.message="部屋を退出しました。";paintLobby();};
  $$("#slot-toggle button").forEach(b=>b.onclick=()=>selectSlot(Number(b.dataset.side),false));
  $("side0").onclick=()=>selectSlot(0,true);$("side1").onclick=()=>selectSlot(1,true);
  $$(".editor-tabs button").forEach(b=>b.onclick=()=>{editorTab=b.dataset.editor;paintTab();});
  $("fighter-name").addEventListener("input",e=>{draft.name=e.target.value;});
  $("saved").onchange=()=>{$("load").disabled=!$("saved").value;};
  $("load").onclick=()=>{
    const f=saved.find(f=>f.id===$("saved").value);
    if(f) {editorVersion++;draft=D.normalize(f);paintEditor();notify(f.name+"を読み込みました");}
  };
  $("save").onclick=save;$("start").onclick=start;$("pause").onclick=togglePause;
  $("dummy-live").onchange=e=>{dummy=e.target.value;if(match)match.dummy=dummy;clearKeys();e.target.blur();};
  $("reset-practice").onclick=()=>{D.VideoCutIn.stop();D.Audio.stopVoices();D.Audio.resetSupers();D.Music.battle();match?.resetPractice();returnFlash=0;fx=[];clearKeys();};
  drawSound();
  D.Audio.configure(settings);D.Touch.configure(settings);
  if(!settings.sound)D.Audio.mute(true);
  paintLobby();
  requestAnimationFrame(frame);
})(Dojo);


