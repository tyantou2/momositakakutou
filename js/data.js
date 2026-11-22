(function (root) {
  "use strict";
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const bounded = (n, fallback, min, max) => Number.isFinite(n) ? clamp(Math.round(n), min, max) : fallback;
  const stats = [
    ["speed", "移動", "歩いて相手との間合いを変える速さ"],
    ["toughness", "耐久", "最大体力"],
    ["power", "威力", "パンチと必殺技のダメージ"],
    ["tempo", "発生", "弱・強パンチが当たるまでの速さ"],
    ["stamina", "持久", "スタミナの最大値と回復速度"],
    ["dodge", "回避", "ステップ移動と無敵の長さ"],
    ["guard", "防御", "ガード時のスタミナ消費と削りを軽減"]
  ];
  const presets = {
    balanced: { name: "バランス", speed: 5, power: 5, bonus: { stamina: 4, dodge: 3, guard: 3 } },
    speed: { name: "スピード", speed: 8, power: 4, bonus: { stamina: 4, dodge: 5, guard: 1 } },
    power: { name: "パワー", speed: 5, power: 8, bonus: { stamina: 5, dodge: 3, guard: 2 } },
    tank: { name: "タフ", speed: 2, power: 6, bonus: { stamina: 4, dodge: 1, guard: 5 } }
  };
  const moves = {
    morph:{label:"二面変身",type:"村長専用",icon:"◇",wind:1,beats:[],end:66,reach:0,damage:0,stun:0,push:0,stop:0,step:0,color:"#83e4d8",detail:"各50%でテルマエ／野崎へ12秒変身。形態は選べない。再使用1秒の専用技2つが追加される。"},
    bathwall:{label:"ローマ式浴場建築",wind:22,beats:[0],end:28,cost:18,reach:0,damage:0,stun:0,push:0,stop:0,step:0,color:"#b8eedf"},
    geyser:{label:"間欠泉噴出",wind:27,beats:[0],end:30,cost:24,reach:65,damage:16,stun:20,push:95,stop:4,step:0,color:"#9beaff"},
    shot:{label:"公安・制圧射撃",wind:14,beats:[0],end:32,cost:18,reach:420,damage:14,stun:16,push:135,stop:3,step:0,color:"#ffd29a"},
    flank:{label:"公安・回り込み制圧",wind:16,beats:[0],end:34,cost:22,reach:100,damage:13,stun:20,push:235,stop:5,step:900,color:"#bac8ff"},
    azure: { label:"蒼閃・一文字", type:"ゃん専用", icon:"⚡", wind:21, beats:[0,7,14], end:36, reach:134, damage:15, guardDamage:30.7, stun:14, push:35, stop:4, step:225, color:"#6bf2ff", detail:"蒼い残像を残して踏み込む三連撃。初撃命中で連続ヒットし、最後の一撃で吹き飛ばす。外した後は隙が大きい。" },
    light: { label: "弱パンチ", wind: 10, beats: [0], end: 17, cost: 10, guardDamage:4, reach: 96, damage: 7, stun: 12, push: 78, stop: 3, step: 116 },
    heavy: { label: "強パンチ", wind: 24, beats: [0], end: 33, cost: 24, guardDamage:47.5, reach: 133, damage: 16, stun: 26, push: 310, stop: 8, step: 132 },
    rush: { label: "百花ラッシュ", type: "ラッシュ", icon: "≋", wind: 13, beats: [0,8,16,24], end: 25, reach: 125, damage: 10, guardDamage:23.1, stun: 14, push: 45, stop: 3, step: 98, color: "#ff97b5", detail: "近距離で４連打。初撃が命中すると残り３発も必ずつながる。" },
    crush: { label: "白桃砕き", type: "ヘビー", icon: "✦", wind: 29, beats: [0], end: 34, reach: 154, damage: 48, guardDamage:153.475, stun: 31, push: 435, stop: 9, step: 117, guardScale: 1.75, color: "#ffbd7d", detail: "大きく溜める一撃。ガードを大きく削るが、外すと隙が長い。" },
    counter: { label: "返しの一閃", type: "カウンター", icon: "⤺", wind: 1, beats: [], end: 42, reach: 164, damage: 41, guardDamage:76.3, stun: 27, push: 352, stop: 8, step: 0, color: "#cbafff", detail: "構えてから約0.33秒間、相手の打撃に自動で反撃。読まれると隙が残る。" },
    comet: { label: "飛桃ストレート", type: "接近攻撃", icon: "➜", wind: 19, beats: [0], end: 30, reach: 128, damage: 38, guardDamage:70.6, stun: 26, push: 331, stop: 7, step: 495, color: "#8de9f4", detail: "最大約157の距離を一気に詰める一発。接近中に打たれると中断する。" }
  };
  const specials = ["rush", "crush", "counter", "comet"];
  const cutins={
    momokage:{key:"crush",element:"crush-video",start:.30,end:3.75,title:800,frames:255,lunge:10,release:"crushRelease",voiceLead:.60,voice:"assets/momokage-super-v31.mp3",voiceDuration:.811,dialogue:{time:85/60,src:"assets/momokage-dialogue-v32.mp3",duration:.416,text:"いくぞっ！"}},
    momonosuke:{key:"rush",element:"rush-video",start:0,end:241/60,title:800,frames:289,lunge:6,release:"rushRelease",voiceLead:.30,voice:"assets/momonosuke-super-v31.mp3",voiceDuration:.864,dialogue:{time:1.60,src:"assets/momonosuke-dialogue-v32.mp3",duration:.693,text:"いくよっ！"}},
    yan:{key:"azure",element:"azure-video",start:0,end:94/24,title:800,frames:283,lunge:6,release:"azureRelease"}
  };
  const movieFor=shot=>{const clip=cutins[shot?.a?.data?.id];return clip?.key===shot?.key?clip:null;};
  const voiceSlots = { start: "試合開始", attack: "攻撃", special: "必殺技", damage: "被弾", win: "勝利" };
  const colors = {
    skin: ["#ffd2ae","#e9aa7b","#bd774e","#855140","#f2a7a6"],
    hairColor: ["#2b2138","#512c4c","#813e36","#f3c577","#69a9a7","#d3d2ee"],
    cloth: ["#ad3965","#3e539f","#357c70","#714eab","#c37a37","#474354"],
    glove: ["#ed567c","#6baeea","#da9744","#63b891","#b787e8","#f0d8bc"]
  };
  const looks = { hair: ["流し髪","ショート","ツイン","ポニーテール"], outfit: ["道着","ジャケット","ノースリーブ"], eyes: ["凛々しい","穏やか","快活"] };
  function bonus(input) {
    let remaining = 10;
    const result = {};
    for (const key of ["stamina","dodge","guard"]) {
      result[key] = bounded(input?.[key], 0, 0, Math.min(5, remaining));
      remaining -= result[key];
    }
    return result;
  }
  function normalize(record = {}) {
    const voice = {};
    for (const tag of Object.keys(voiceSlots)) {
      const file = record.voice?.[tag];
      if (file && typeof file.name === "string" && typeof file.data === "string"
        && file.data.length <= 351000 && /^data:audio\/[a-z0-9.+-]+;base64,[a-zA-Z0-9+/=]+$/i.test(file.data)) {
        voice[tag] = { name: file.name.slice(0,80), data: file.data };
      }
    }
    const oldHeight = typeof record.id === "string" && record.id.startsWith("custom-") && record.heightScale !== 10;
    const height = oldHeight ? bounded(record.height, 3, 1, 5) + 3 : bounded(record.height, 6, 1, 10);
    const look = {};
    for (const [key, choices] of Object.entries({ ...looks, ...colors })) {
      look[key] = bounded(record.look?.[key], 0, 0, choices.length - 1);
    }
    return {
      id: typeof record.id === "string" ? record.id.slice(0,70) : "",
      name: String(record.name || "").trim().slice(0,16) || "新しいファイター",
      height, heightScale: 10,
      speed: bounded(record.speed, 5, 1, 10), power: bounded(record.power, 5, 1, 10),
      bonus: bonus(record.bonus), look, special: specials.includes(record.special) ? record.special : "rush", voice
    };
  }
  function rosterEntry(data, style) {
    return { ...normalize(data), ...style };
  }
  const cast = [
    rosterEntry({ id:"momokage",name:"桃陰",height:8,speed:4,power:7,bonus:presets.power.bonus,special:"crush" },
      { image:"assets/momokage-v32.webp", epithet:"白桃一族の熱血先生", short:"熱血先生", accent:"#92afff", arm:"#293253", sprite:{ crop:[82,66,826,1297], align:.52, glove:[.87,.61], shoulder:[.78,.69] } }),
    rosterEntry({ id:"momonosuke",name:"もものすけ",height:1,speed:8,power:5,bonus:{stamina:5,dodge:4,guard:1},special:"rush" },
      { image:"assets/momonosuke-v32.webp", epithet:"好奇心いっぱいの桃の妖精", short:"桃の妖精", accent:"#ffa4be", arm:"#f6dce6", sprite:{ crop:[150,40,939,1087], align:.55, glove:[.82,.58], shoulder:[.76,.66] } })
  ];
  cast.push(rosterEntry({id:"yan",name:"ゃん",height:6,speed:6,power:5,bonus:{stamina:4,dodge:3,guard:3}},
    {special:"azure",image:"assets/yan.webp",epithet:"蒼閃を放つ桃下の挑戦者",short:"蒼閃の挑戦者",accent:"#6bf2ff",arm:"#23263e",mitt:"#343b4c",sprite:{crop:[22,55,548,760],align:.50,glove:[.88,.44],shoulder:[.64,.52]}}));
  cast.push(rosterEntry({id:"headman",name:"村長",height:9,speed:4,power:6,bonus:{stamina:4,dodge:2,guard:4}},
    {special:"morph",image:"assets/headman-normal-v34.webp",epithet:"二つの戦術へ変身する長身の指揮者",short:"二面変身",accent:"#9de6d6",arm:"#252132",mitt:"#18171f",sprite:{crop:[73,28,861,1493],align:.50,glove:[.77,.33],shoulder:[.66,.28]}}));
  const headmanForms={
    thermae:{...cast[3],id:"headman-thermae",name:"村長",image:"assets/headman-thermae-v34.webp",arm:"#e3ccaa",sprite:{crop:[176,8,648,1517],align:.50,glove:[.82,.30],shoulder:[.69,.25]}},
    nozaki:{...cast[3],id:"headman-nozaki",name:"村長",image:"assets/headman-nozaki-v34.webp",arm:"#25212c",sprite:{crop:[191,10,671,1518],align:.50,glove:[.82,.30],shoulder:[.67,.26]}}
  };
  function profile(fighter) {
    const { speed, power, height } = fighter;
    const toughness = 11 - speed;
    const tempo = 11 - power;
    const { stamina, dodge, guard } = Object.fromEntries(Object.entries(fighter.bonus).map(([k,v])=>[k,5+v]));
    const size = height - 6;
    const visual = .59 + .08 * (height - 1);
    return {
      speed, power, toughness, tempo, stamina, dodge, guard,
      walk: 174 + 11 * speed, hp: 475 + 6 * toughness, damage: .85 + .027 * power,
      wind: 1.15 - .029 * tempo, staminaMax: 76 + 4 * stamina, regen: 13 + 1.45 * stamina,
      inv: 10 + dodge, dodgeSpeed: 310 + 13 * dodge,
      guardCost: 1.12 - .056 * guard, chip: .19 - .014 * guard,
      visual, bodyHeight: 220 * visual, hurt: 43 + 1.2 * size, reach: 2.5 * size
    };
  }
  const controls = [
    { left:"ArrowLeft", right:"ArrowRight", jump:"ArrowUp", guard:"ArrowDown", light:"KeyS", heavy:"KeyD", back:"KeyQ", spot:"KeyW", special:"KeyE",skillA:"KeyA",skillB:"KeyF" },
    { left:"KeyJ", right:"KeyL", jump:"KeyI", guard:"KeyK", light:"KeyN", heavy:"KeyM", back:"KeyU", spot:"KeyO", special:"KeyP",skillA:"KeyY",skillB:"KeyH" }
  ];
  const keyLabels = { ArrowLeft:"←",ArrowRight:"→",ArrowUp:"↑",ArrowDown:"↓",
    KeyQ:"Q",KeyW:"W",KeyE:"E",KeyS:"S",KeyD:"D",KeyA:"A",KeyF:"F",KeyY:"Y",KeyH:"H",
    KeyJ:"J",KeyL:"L",KeyI:"I",KeyK:"K",KeyN:"N",KeyM:"M",KeyU:"U",KeyO:"O",KeyP:"P" };
  const api = { clamp, stats, presets, moves, specials, cutins, movieFor, voiceSlots, colors, looks, bonus, normalize, cast, headmanForms, profile, controls, keyLabels };
  root.Dojo = api;
  if (typeof module === "object") module.exports = api;
})(globalThis);


