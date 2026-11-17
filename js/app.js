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
  const modes = { cpu:"CPU対戦",local:"ローカル対戦",practice:"練習" };
  const actionNames = { left:"左",right:"右",light:"弱",heavy:"強",guard:"ガード",dodge:"回避",special:"必殺" };
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
    motion:initialOptions.motion ?? !matchMedia("(prefers-reduced-motion: reduce)").matches
  };
  let mode="cpu", difficulty="normal", dummy="idle", screen="lobby", slot=0, editorTab="appearance";
  let selected=D.cast.slice(0,2).map(f=>f.id);
  let draft=fresh(), match=null, paused=false, fx=[], shake=0, accumulator=0, last=0;
  let toastTimer, editorVersion=0;
  const keys = new Set(), queue=[null,null];
  const gameCodes = new Set(D.controls.flatMap(map=>Object.values(map)));
  const context = $("ring").getContext("2d");
  const preview = [$("preview0"),$("preview1")];
  const roster = () => [...D.cast,...saved];
  const getFighter = i => roster().find(f=>f.id===selected[i]) || D.cast[i];
  const sideLabel = i => i===0 ? "1P" : mode==="local" ? "2P" : mode==="cpu" ? "CPU" : "DUMMY";
  const inBattle = () => screen==="battle" && match && !paused && match.phase!=="over";
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
    drawSound();
  }
  function show(page) {
    if (page!=="battle" && screen==="battle") {
      D.Audio.stopVoices();match=null;paused=false;clearKeys();
    }
    if (page!==screen) D.Audio.stopVoices();
    screen=page;
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
    if (mode!=="local") {
      const cpu=mode==="cpu";
      const label=node("label","option",cpu?"CPU難易度":"練習相手");
      const entries=cpu?[["easy","はじめて"],["normal","通常"]]:[["idle","静止"],["guard","ガード"],["active","攻撃する"]];
      label.append(choose(entries,cpu?difficulty:dummy,v=>{if(cpu)difficulty=v;else dummy=v;}));
      option.append(label);
    }
    $("start-label").textContent=mode==="practice"?"練習開始":"試合開始";
    const list=$("roster");
    list.replaceChildren();
    for (const f of roster()) {
      const clicked = f.id===selected[slot];
      const card=button("",()=>{
        selected[slot]=f.id;paintLobby();
        [...list.children].find(el=>el.dataset.fighter===f.id)?.focus({preventScroll:true});
      },"fighter-card"+(clicked?" current":""));
      card.dataset.fighter=f.id;
      card.setAttribute("aria-pressed",String(clicked));
      const canvas=node("canvas");canvas.width=224;canvas.height=232;canvas.setAttribute("aria-hidden","true");
      const desc=node("span");desc.append(node("strong","",f.name),node("small","",f.short || "自作ファイター"));
      const tags=selected.flatMap((id,i)=>id===f.id?[sideLabel(i)]:[]);
      if (tags.length) desc.append(node("small","badge",tags.join(" / ")+" 選択中"));
      card.append(canvas,desc);list.append(card);D.Art.portrait(canvas,f);
    }
    const add=button("",openNew,"fighter-card add-card");
    const desc=node("span");desc.append(node("strong","","ファイターを作る"),node("small","","パーツ・能力・必殺技"));
    add.append(node("span","plus","＋"),desc);list.append(add);
  }
  function selectSlot(i,scroll) {
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
    for(let i=1;i<=5;i++) sizes.append(button(String(i),()=>{draft.height=i;picked(sizes,i-1);redraw();},""));
    picked(sizes,draft.height-1);
    grid.append(field("身長（1 小柄 ↔ 5 長身）",sizes));
    body.append(grid,node("p","note","身長が1段高いと、攻撃が届く距離は4、相手の攻撃が当たる範囲は2.5広がります。"));
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
    body.append(node("h2","","装備する必殺技"),node("p","note","1種類を装備。試合中に攻撃を当てる・受ける・回避することでゲージが溜まり、100%で発動。"));
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
      const pair=node("span");
      pair.append(node("kbd","",D.keyLabels[code]),node("small","",actionNames[action]));group.append(pair);
    }
    return group;
  }
  function dialog(title, attach) {
    if(inBattle()) togglePause();
    $("dialog-title").textContent=title;
    const content=$("dialog-content");content.replaceChildren();attach(content);
    $("dialog").showModal();
  }
  function help() {
    dialog("遊び方",content=>{
      content.append(node("p","note","弱パンチは出が速く、強パンチは遠くまで届きます。相手の溜めを見てガードか回避を選び、空振りの隙に反撃しましょう。"),makeKeys(0),makeKeys(1),
        node("p","note","回避は方向を押しながらで前後にステップ。方向入力がなければ後ろに避けます。ガードは押し続けて構えます。守り続けるとスタミナが切れて崩されます。"),
        node("p","note","必殺技はゲージ満タンで使用できます。60秒で決着がつかなければ、残り体力の割合で判定します。練習は時間制限なし。Escで一時停止できます。"));
    });
  }
  function options() {
    dialog("設定",content=>{
      for(const [key,label] of [["sound","サウンド"],["motion","画面揺れを表示"]]) {
        const row=node("label","setting-row",label), checkbox=node("input");
        checkbox.type="checkbox";checkbox.checked=settings[key];
        checkbox.addEventListener("change",()=>{settings[key]=checkbox.checked;updateOptions();});
        row.append(checkbox);content.append(row);
      }
    });
  }
  function clearKeys() {
    keys.clear();queue.fill(null);
  }
  function start() {
    D.Audio.stopVoices();D.Audio.init();
    match=new D.Match({fighters:[getFighter(0),getFighter(1)],mode,difficulty,dummy});
    paused=false;fx=[];shake=0;accumulator=0;clearKeys();
    $("battle-title").textContent=modes[mode];
    $("battle-overlay").hidden=true;$("pause").disabled=false;
    $("practice-tools").hidden=mode!=="practice";$("dummy-live").value=dummy;$("timer-tag").textContent=mode==="practice"?"PRACTICE":"ROUND";
    $("battle-keys").replaceChildren(makeKeys(0));
    if(mode==="local") $("battle-keys").append(makeKeys(1));
    for(let i=0;i<2;i++) {
      const group=$("hud"+i);group.replaceChildren();
      const name=node("strong"), badge=node("b","",sideLabel(i)), f=match.fighters[i].data;
      if(i===0) name.append(badge,f.name);else name.append(f.name,badge);
      group.append(name);
      for(const [key,label] of [["hp","体力"],["sta","スタミナ"],["super","必殺ゲージ"]]) {
        const bar=node("div","bar "+key);
        bar.setAttribute("role","meter");bar.setAttribute("aria-label",sideLabel(i)+" "+label);bar.setAttribute("aria-valuemin","0");bar.setAttribute("aria-valuemax","100");
        bar.append(node("i"));group.append(bar);
      }
      group.append(node("small","spell-label"));
    }
    show("battle");hud();
    $("pause").focus({preventScroll:true});
  }
  function command(i) {
    const map=D.controls[i], action=queue[i];
    queue[i]=null;
    return {axis:Number(keys.has(map.right))-Number(keys.has(map.left)),guard:keys.has(map.guard),action};
  }
  function hud() {
    $("time").textContent=mode==="practice"?"∞":Math.ceil(match.seconds);
    match.fighters.forEach((f,i)=>{
      const group=$("hud"+i);
      for(const [key,level] of [["hp",f.hp/f.p.hp*100],["sta",f.stamina/f.p.staminaMax*100],["super",f.meter]]) {
        const bar=group.querySelector("."+key);
        const pct=Math.max(0,Math.round(level*10)/10);
        bar.firstChild.style.width=pct+"%";bar.setAttribute("aria-valuenow",String(Math.round(pct)));
        if(key==="super") bar.classList.toggle("ready",pct===100);
      }
      const suffix=f.meter===100?" READY":(" "+Math.floor(f.meter)+"%");
      group.querySelector(".spell-label").textContent=D.moves[f.data.special].label+" ·"+suffix;
    });
    if(mode==="practice") {
      const t=match.fighters[0].tally;
      $("practice-report").textContent="命中 "+t.hit+"　ガード "+t.block+"　回避 "+t.evade+"　総ダメージ "+Math.round(t.dealt);
    }
    $("banner").textContent=match.phase==="ready"?"READY": match.frame<48 && match.phase==="fight"?"FIGHT":"";
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed=Math.min(80,now-last);
    last=now;
    if (screen!=="battle" || !match) return;
    if (!paused && match.phase!=="over") {
      accumulator+=elapsed;
      while(accumulator>=1000/60 && match.phase!=="over") {
        match.tick(command(0),command(1));
        for (const event of match.drain()) {
          D.Audio.event(event);
          if(event.type==="over"){result();continue;}
          if(!["fight","swing","step"].includes(event.type)) fx.push({...event,age:0});
          if(event.heavy) shake=event.type==="block"?3:7;
        }
        fx=fx.filter(e=>++e.age<36);
        shake*=.79;
        accumulator-=1000/60;
      }
      hud();
    }
    context.clearRect(0,0,1280,650);context.save();
    if(settings.motion && !paused && shake>.3) context.translate(Math.sin(now)*shake,Math.cos(now)*shake*.44);
    for(const f of match.fighters) D.Art.fighter(context,f,match.frame,542);
    D.Art.effects(context,fx,542);
    context.restore();
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
    overlay(reason,title,(winner===null?"":match.fighters[winner].data.name+" ｜ ")+"残り体力 "+hp,[["再戦",start,true],["対戦準備へ",()=>show("lobby")],["キャラを調整",openSelectedEditor]],stats);
  }
  function togglePause() {
    if(!match || match.phase==="over") return;
    paused=!paused;clearKeys();accumulator=0;
    if(!paused) {
      $("battle-overlay").hidden=true;$("pause").focus({preventScroll:true});return;
    }
    D.Audio.stopVoices();
    overlay("PAUSE","一時停止","Escでも再開できます。",[["続ける",togglePause,true],["最初から",start],["対戦準備へ",()=>show("lobby")]]);
  }
  function openSelectedEditor() {
    const found=saved.find(f=>f.id===selected[0]);
    if(found) {editorVersion++;draft=D.normalize(found);editorTab="appearance";}
    show("editor");
  }
  document.addEventListener("keydown",e=>{
    if (screen!=="battle" || $("dialog").open) return;
    if(e.code==="Escape" && !e.repeat){e.preventDefault();togglePause();return;}
    if(!inBattle() || !gameCodes.has(e.code) || /INPUT|SELECT/.test(e.target.tagName)) return;
    const index=D.controls.findIndex(map=>Object.values(map).includes(e.code));
    if(index===1 && mode!=="local") return;
    e.preventDefault();
    keys.add(e.code);
    if(e.repeat) return;
    const map=D.controls[index];
    const press=["light","heavy","dodge","special"].find(key=>map[key]===e.code);
    if(press) queue[index]=press;
  });
  document.addEventListener("keyup",e=>keys.delete(e.code));
  window.addEventListener("blur",()=>{clearKeys();if(inBattle())togglePause();});
  document.addEventListener("visibilitychange",()=>{if(document.hidden && inBattle())togglePause();});
  $$("[data-icon]").forEach(el=>{el.innerHTML=icon(el.dataset.icon);});
  $("settings").innerHTML=icon("settings");
  $("settings").onclick=options;$("help").onclick=help;
  $("sound").onclick=()=>{settings.sound=!settings.sound;updateOptions();};
  $("close-dialog").onclick=()=>$("dialog").close();
  $("brand").onclick=$("tab-match").onclick=$("back-editor").onclick=()=>show("lobby");
  $("tab-editor").onclick=()=>show("editor");
  $$(".new-fighter").forEach(b=>b.onclick=openNew);
  $$("#modes button").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;paintLobby();});
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
  $("reset-practice").onclick=()=>{match?.resetPractice();fx=[];clearKeys();};
  drawSound();
  if(!settings.sound)D.Audio.mute(true);
  paintLobby();
  requestAnimationFrame(frame);
})(Dojo);