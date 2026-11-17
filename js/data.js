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
    light: { label: "弱パンチ", wind: 9, beats: [0], end: 15, cost: 9, reach: 66, damage: 7, stun: 13, push: 58, stop: 3, step: 86 },
    heavy: { label: "強パンチ", wind: 20, beats: [0], end: 26, cost: 19, reach: 88, damage: 15, stun: 23, push: 248, stop: 6, step: 102 },
    rush: { label: "百花ラッシュ", type: "ラッシュ", icon: "≋", wind: 13, beats: [0,8,16,24], end: 25, reach: 83, damage: 6, stun: 14, push: 45, stop: 3, step: 98, color: "#ff97b5", detail: "近距離で４連打。距離が離れると途中で途切れる。" },
    crush: { label: "白桃砕き", type: "ヘビー", icon: "✦", wind: 29, beats: [0], end: 34, reach: 103, damage: 30, stun: 31, push: 435, stop: 9, step: 117, guardScale: 1.75, color: "#ffbd7d", detail: "大きく溜める一撃。ガードを大きく削るが、外すと隙が長い。" },
    counter: { label: "返しの一閃", type: "カウンター", icon: "⤺", wind: 1, beats: [], end: 42, reach: 121, damage: 24, stun: 27, push: 352, stop: 8, step: 0, color: "#cbafff", detail: "構えてから約0.32秒間、相手の打撃に自動で反撃。読まれると隙が残る。" },
    comet: { label: "飛桃ストレート", type: "接近攻撃", icon: "➜", wind: 19, beats: [0], end: 30, reach: 86, damage: 23, stun: 26, push: 331, stop: 7, step: 495, color: "#8de9f4", detail: "最大約157の距離を一気に詰める一発。接近中に打たれると中断する。" }
  };
  const specials = ["rush", "crush", "counter", "comet"];
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
    const look = {};
    for (const [key, choices] of Object.entries({ ...looks, ...colors })) {
      look[key] = bounded(record.look?.[key], 0, 0, choices.length - 1);
    }
    return {
      id: typeof record.id === "string" ? record.id.slice(0,70) : "",
      name: String(record.name || "").trim().slice(0,16) || "新しいファイター",
      height: bounded(record.height, 3, 1, 5),
      speed: bounded(record.speed, 5, 1, 10), power: bounded(record.power, 5, 1, 10),
      bonus: bonus(record.bonus), look, special: specials.includes(record.special) ? record.special : "rush", voice
    };
  }
  function rosterEntry(data, style) {
    return { ...normalize(data), ...style };
  }
  const cast = [
    rosterEntry({ id:"momokage",name:"桃陰",height:4,speed:4,power:7,bonus:presets.power.bonus,special:"crush" },
      { image:"assets/momokage.png", epithet:"白桃一族の熱血先生", short:"熱血先生", accent:"#92afff", arm:"#293253", sprite:{ crop:[82,66,826,1297], align:.52, glove:[.87,.61], shoulder:[.78,.69] } }),
    rosterEntry({ id:"momonosuke",name:"もものすけ",height:2,speed:7,power:4,bonus:presets.speed.bonus,special:"rush" },
      { image:"assets/momonosuke.png", epithet:"好奇心いっぱいの桃の妖精", short:"桃の妖精", accent:"#ffa4be", arm:"#f6dce6", sprite:{ crop:[150,40,939,1087], align:.55, glove:[.82,.58], shoulder:[.76,.66] } })
  ];
  function profile(fighter) {
    const { speed, power, height } = fighter;
    const toughness = 11 - speed;
    const tempo = 11 - power;
    const { stamina, dodge, guard } = Object.fromEntries(Object.entries(fighter.bonus).map(([k,v])=>[k,5+v]));
    const size = height - 3;
    return {
      speed, power, toughness, tempo, stamina, dodge, guard,
      walk: 164 + 11 * speed, hp: 90 + 2.6 * toughness, damage: .85 + .027 * power,
      wind: 1.15 - .029 * tempo, staminaMax: 76 + 4 * stamina, regen: 13 + 1.45 * stamina,
      inv: 10 + dodge, dodgeSpeed: 310 + 13 * dodge,
      guardCost: 1.12 - .056 * guard, chip: .19 - .014 * guard,
      visual: 1 + .055 * size, hurt: 41 + 2.5 * size, reach: 4 * size
    };
  }
  const controls = [
    { left:"KeyA", right:"KeyD", light:"KeyF", heavy:"KeyG", guard:"KeyS", dodge:"KeyW", special:"KeyH" },
    { left:"ArrowLeft", right:"ArrowRight", light:"KeyJ", heavy:"KeyK", guard:"ArrowDown", dodge:"ArrowUp", special:"KeyL" }
  ];
  const keyLabels = { KeyA:"A", KeyD:"D", KeyF:"F", KeyG:"G", KeyS:"S", KeyW:"W", KeyH:"H", ArrowLeft:"←", ArrowRight:"→", KeyJ:"J", KeyK:"K", ArrowDown:"↓", ArrowUp:"↑", KeyL:"L" };
  const api = { clamp, stats, presets, moves, specials, voiceSlots, colors, looks, bonus, normalize, cast, profile, controls, keyLabels };
  root.Dojo = api;
  if (typeof module === "object") module.exports = api;
})(globalThis);