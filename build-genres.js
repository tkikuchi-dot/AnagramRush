const fs = require("fs");
const path = require("path");

function parse(file) {
  const html = fs.readFileSync(file, "utf8");
  const re = /<td class="word"><p class="word_fuku_disp trim">([^<]*)<p\/><span>([^<]*)<\/span>/g;
  const items = [];
  let match;
  while ((match = re.exec(html))) {
    items.push({ word: match[1].trim(), reading: match[2].trim() });
  }
  return items;
}

function chars(text) {
  return Array.from(text).length;
}

function isPureKata(word) {
  return /^[ァ-ヴー]+$/.test(word);
}

function canScramble(word) {
  const list = Array.from(word);
  return list.some((ch) => ch !== list[0]);
}

function isTaxon(word) {
  return /[科属目綱門]$/.test(word);
}

function foldLongKana(text) {
  const row = {
    ア: "アカサタナハマヤラワ",
    イ: "イキシチニヒミリ",
    ウ: "ウクスツヌフムユル",
    エ: "エケセテネヘメレ",
    オ: "オコソトノホモヨロヲ",
  };
  const chars = Array.from(text);
  let out = "";
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    const next = chars[i + 1];
    if ((ch === "ャ" || ch === "ュ" || ch === "ョ") && next === "ウ") {
      out += ch + "ー";
      i += 1;
      continue;
    }
    const mark = Object.keys(row).find((vowel) => next === vowel && row[vowel].includes(ch));
    if (mark) {
      out += ch + "ー";
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

function toKata(text) {
  return foldLongKana(text
    .normalize("NFKC")
    .replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
    .replace(/[〜～]/g, "ー")
    .replace(/[・･.\s　\-]/g, ""));
}

function isNonFish(word) {
  if (/クジラ|イルカ/.test(word) && !/ウオ/.test(word)) return true;
  if (/^(エビジャコ|カニクイ|イノシシ|オオカミ|キラーホエール|サカマタ|シャチ|スナメリ|パキケトゥス)$/.test(word)) return true;
  if (/(イカ|エビ|カニ|タコ|貝|海老|蟹|烏賊|蛸|海鞘|海鼠|海星|水母)$/.test(word)) return true;
  return /ウニ|ナマコ|クラゲ|ヒトデ|ホヤ|アサリ|シジミ|ハマグリ|ホタテ|サザエ|アワビ|シャコ|ザリガニ|ロブスター|イセエビ|ガザミ|オキアミ|イソギンチャク|ウミウシ|カタツムリ/.test(word);
}

function pick(items, { fish } = {}) {
  const groups = new Map();
  for (const item of items) {
    const word = item.word.normalize("NFKC").trim();
    const reading = item.reading.normalize("NFKC").trim();
    if (!word || !reading) continue;
    if (/[A-Za-z0-9]/.test(word) || /[A-Za-z0-9]/.test(reading)) continue;
    if (word.includes("…") || word.includes("...")) continue;
    if (!groups.has(reading)) groups.set(reading, []);
    groups.get(reading).push(word);
  }
  const seen = new Set();
  const out = [];
  for (const [reading, words] of groups) {
    if (words.every((word) => isTaxon(word))) continue;
    if (fish && words.every((word) => isNonFish(word))) continue;
    const usable = words.filter((word) => {
      const n = chars(word);
      return isPureKata(word) && n >= 3 && n <= 9 && canScramble(word) && !isTaxon(word);
    });
    usable.sort((a, b) => chars(a) - chars(b) || a.localeCompare(b, "ja"));
    let chosen = usable[0];
    if (!chosen) chosen = toKata(reading);
    if (!isPureKata(chosen)) continue;
    const n = chars(chosen);
    if (n < 3 || n > 9 || !canScramble(chosen) || isTaxon(chosen)) continue;
    if (fish && isNonFish(chosen)) continue;
    if (seen.has(chosen)) continue;
    seen.add(chosen);
    out.push(chosen);
  }
  out.sort((a, b) => a.localeCompare(b, "ja"));
  return out;
}

const famous = require("./famous-words");

function keepFamous(name, list) {
  const allow = new Set(famous[name]);
  const have = new Set(list);
  const missing = famous[name].filter((word) => !have.has(word));
  const kept = list.filter((word) => allow.has(word));
  for (const word of missing) kept.push(word);
  kept.sort((a, b) => a.localeCompare(b, "ja"));
  if (missing.length) console.log(name, "kept outside source:", missing.length);
  return kept;
}

const temp = process.env.TEMP.replace(/\\/g, "/");
const mammal = keepFamous("mammal", pick(parse(temp + "/koto-mammal.html")));
const fish = keepFamous("fish", pick(parse(temp + "/koto-fish.html"), { fish: true }));
const food = keepFamous("food", pick(parse(temp + "/koto-food.html")));

function summarize(name, list) {
  const lens = {};
  for (const word of list) {
    const n = chars(word);
    lens[n] = (lens[n] || 0) + 1;
  }
  console.log(name, list.length, JSON.stringify(lens));
  console.log(list.slice(0, 25).join(" "));
  console.log("---");
}

summarize("mammal", mammal);
summarize("fish", fish);
summarize("food", food);

const outDir = __dirname;
fs.writeFileSync(path.join(outDir, "genre-mammal.txt"), mammal.join("\n") + "\n");
fs.writeFileSync(path.join(outDir, "genre-fish.txt"), fish.join("\n") + "\n");
fs.writeFileSync(path.join(outDir, "genre-food.txt"), food.join("\n") + "\n");

const genresJs = `/* コトダマンのテーマ辞書から、よく知られた名前だけを抽出。3〜9文字。表記はすべてカタカナ。 */
(function (root) {
  const genres = {
    mammal: ${JSON.stringify(mammal.join("\n"))},
    fish: ${JSON.stringify(fish.join("\n"))},
    food: ${JSON.stringify(food.join("\n"))},
  };
  if (typeof module !== "undefined" && module.exports) module.exports = genres;
  else root.ANAGRAM_GENRES = genres;
})(typeof globalThis !== "undefined" ? globalThis : this);
`;
fs.writeFileSync(path.join(outDir, "genres.js"), genresJs);
