const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const lists = path.join(root, "wordlists");

function readWords(file) {
  return fs.readFileSync(path.join(lists, file), "utf8").split(/\r?\n/);
}

function chars(text) {
  return Array.from(text).length;
}

function clean(lines, keepFlat) {
  const bad = [];
  const out = [];
  const seen = new Set();
  for (const raw of lines) {
    const word = raw.normalize("NFKC").trim();
    if (!word || word.startsWith("#")) continue;
    if (!/^[ァ-ヶー]+$/.test(word)) {
      bad.push(word);
      continue;
    }
    const n = chars(word);
    if (n < 1 || n > 16) {
      bad.push(word + ":" + n);
      continue;
    }
    const letters = Array.from(word);
    if (!keepFlat && n >= 2 && letters.every((ch) => ch === letters[0])) {
      bad.push(word);
      continue;
    }
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }
  out.sort((a, b) => a.localeCompare(b, "ja"));
  return { out, bad };
}

function jsString(list) {
  return JSON.stringify(list.join("\n"));
}

const current = require(path.join(root, "genres.js"));
const mammal = clean(current.mammal.split(/\n/).concat(readWords("rank-mammal.txt")));
const fish = clean(current.fish.split(/\n/).concat(readWords("rank-fish.txt")));
const food = clean(current.food.split(/\n/).concat(readWords("rank-food.txt")));

const taken = new Set();
function claim(list) {
  const kept = [];
  let dropped = 0;
  for (const word of list) {
    if (taken.has(word)) {
      dropped += 1;
      continue;
    }
    taken.add(word);
    kept.push(word);
  }
  return { kept, dropped };
}

const mammalClaim = claim(mammal.out);
const fishClaim = claim(fish.out);
const foodClaim = claim(food.out);

const extraNames = [
  ["bird", "bird.txt"],
  ["insect", "insect.txt"],
  ["flower", "flower.txt"],
  ["fruit", "fruit.txt"],
  ["star", "star.txt"],
  ["instrument", "instrument.txt"],
  ["element", "element.txt"],
  ["character", "character.txt"],
];
const keepFlat = new Set(["star", "flower", "fruit"]);
const extras = {};
for (const [id, file] of extraNames) {
  extras[id] = clean(readWords(file), keepFlat.has(id));
}

const genresJs = `/* よく知られた動物・魚類・料理。カタカナ。ランキングは3〜9文字。 */
(function (root) {
  const genres = {
    mammal: ${jsString(mammalClaim.kept)},
    fish: ${jsString(fishClaim.kept)},
    food: ${jsString(foodClaim.kept)},
  };
  if (typeof module !== "undefined" && module.exports) module.exports = genres;
  else root.ANAGRAM_GENRES = genres;
})(typeof globalThis !== "undefined" ? globalThis : this);
`;
fs.writeFileSync(path.join(root, "genres.js"), genresJs);
fs.writeFileSync(path.join(root, "genre-mammal.txt"), mammalClaim.kept.join("\n") + "\n");
fs.writeFileSync(path.join(root, "genre-fish.txt"), fishClaim.kept.join("\n") + "\n");
fs.writeFileSync(path.join(root, "genre-food.txt"), foodClaim.kept.join("\n") + "\n");

const famous = `/* 出題に残す、よく知られた名前。ランキングの動物・魚類・料理。 */
module.exports = {
  mammal: ${JSON.stringify(mammalClaim.kept, null, 2)},
  fish: ${JSON.stringify(fishClaim.kept, null, 2)},
  food: ${JSON.stringify(foodClaim.kept, null, 2)},
};
`;
fs.writeFileSync(path.join(root, "famous-words.js"), famous);

let more = `/* 追加ジャンル。選んだときだけ出題する。ランキングには入れない。 */
(function (root) {
  const genres = root.ANAGRAM_GENRES || (root.ANAGRAM_GENRES = {});
`;
for (const [id] of extraNames) {
  more += `  genres.${id} = ${jsString(extras[id].out)};\n`;
  fs.writeFileSync(path.join(root, "genre-" + id + ".txt"), extras[id].out.join("\n") + "\n");
}
more += `})(typeof globalThis !== "undefined" ? globalThis : this);
`;
fs.writeFileSync(path.join(root, "more-genres.js"), more);

function rankCount(list) {
  return list.filter((word) => {
    const n = chars(word);
    return n >= 3 && n <= 9;
  }).length;
}

console.log("mammal", mammalClaim.kept.length, "rank", rankCount(mammalClaim.kept), "dup", mammalClaim.dropped, "bad", mammal.bad.length);
console.log("fish", fishClaim.kept.length, "rank", rankCount(fishClaim.kept), "dup", fishClaim.dropped, "bad", fish.bad.slice(0, 8).join(" | "));
console.log("food", foodClaim.kept.length, "rank", rankCount(foodClaim.kept), "dup", foodClaim.dropped, "bad", food.bad.slice(0, 8).join(" | "));
console.log("rank sum", rankCount(mammalClaim.kept) + rankCount(fishClaim.kept) + rankCount(foodClaim.kept));
for (const [id] of extraNames) {
  const playable = extras[id].out.filter((word) => chars(word) >= 2).length;
  console.log(id, extras[id].out.length, "playable", playable, "bad", extras[id].bad.slice(0, 6).join(" | "));
}
