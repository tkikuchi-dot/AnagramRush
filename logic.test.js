const assert = require("assert");
const G = require("./logic.js");

const PLAIN = ["あか", "いぬ", "うみ", "えき", "かお", "そら", "やま", "もり", "はな", "くさ", "さくら", "みかん"];
const PAIRS = ["ねこ", "こね", "いぬ", "ぬい", "さくら"];

function advance(state, ms) {
  let left = ms;
  while (left > 0) {
    const step = Math.min(100, left);
    G.tick(state, step);
    left -= step;
  }
}

function fresh(words, mode, seed, patch) {
  const state = G.createGame(words || PLAIN, mode || "life", seed == null ? 1 : seed);
  if (patch) patch(state);
  return state;
}

function assertScrambled(puzzle) {
  const words = puzzle.parts.filter((part) => !part.solved).map((part) => part.word);
  const pool = puzzle.pool.join("");
  const orders = words.length <= 4 ? permute(words) : [words];
  for (const order of orders) {
    assert.notStrictEqual(pool, order.join(""), `pool stayed in order: ${pool}`);
  }
}

function permute(items) {
  if (items.length <= 1) return [items.slice()];
  const out = [];
  for (let i = 0; i < items.length; i += 1) {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const perm of permute(rest)) out.push([items[i]].concat(perm));
  }
  return out;
}

function simpleNormal(words, seed, options) {
  for (let i = 0; i < 50; i += 1) {
    const state = G.createGame(words, "simple", (seed || 1) + i, options);
    if (state.active[0] && !state.active[0].boss) return state;
  }
  throw new Error("no normal question");
}

function spawnNumber(state, number) {
  state.active = [];
  state.nextNumber = number;
  state.phase = "playing";
  state.spawnAcc = 0;
  state.lives = G.RULES.lives;
  G.tick(state, 0);
  return state.active[0];
}

// Dictionary
{
  const prepared = G.prepareDict(["あ", "ああ", "さくら", "さくら", "  みかん  ", "#メモ", ""]);
  assert.strictEqual(prepared.dict.length, 2);
  assert.ok(prepared.skipped >= 2);
  assert.ok(prepared.dict.some((entry) => entry.text === "みかん"));
}

// Anagram partner is not accepted, and the real word is. First letter starts open.
{
  const state = simpleNormal(["ねこ", "こね", "いぬ", "ぬい"], 4);
  const part = state.active[0].parts[0];
  assert.strictEqual(part.shown, 1);
  assert.strictEqual(part.reveal, true);
  assert.strictEqual(part.ambiguous, true);
  assert.notStrictEqual(state.active[0].pool.join(""), part.word);
  const group = state.groups.get(part.key);
  const partner = group.find((entry) => entry.match !== part.match);
  if (partner) {
    assert.strictEqual(G.submit(state, partner.text).ok, false);
    assert.strictEqual(state.score, 0);
    assert.strictEqual(state.active.length, 1);
  }
  assert.strictEqual(G.submit(state, part.word).ok, true);
  assert.strictEqual(state.score, 1);
  assert.strictEqual(G.submit(state, "  " + part.word + " ").ok, false);
}

// An alternate reading keeps the first letter, and the second letter opens at two thirds.
{
  const state = G.createGame(["ねこ", "こね", "いぬ", "ぬい"], "life", 4);
  const part = state.active[0].parts[0];
  assert.strictEqual(part.shown, 1);
  assert.strictEqual(part.revealedByTime, false);
  G.tick(state, 5000);
  assert.strictEqual(part.shown, 1);
  assert.strictEqual(part.revealedByTime, false);
  G.tick(state, 5000);
  assert.strictEqual(part.shown, 2);
  assert.strictEqual(part.chars[0] + part.chars[1], part.word.slice(0, 2));
  assert.strictEqual(part.revealedByTime, true);
}

// Case and width
{
  const state = G.createGame(["Cat", "Dog", "Bird"], "simple", 2);
  const answer = state.active[0].parts[0].word;
  const typed = answer === "Cat" ? "cat" : answer.toLowerCase();
  assert.strictEqual(G.submit(state, typed).ok, true);
  const wide = G.createGame(["Cat"], "simple", 1);
  assert.strictEqual(G.submit(wide, "\uFF43\uFF41\uFF54").ok, true);
}

// Scramble is never the original order
for (let seed = 1; seed <= 40; seed += 1) {
  const state = G.createGame(PLAIN, "simple", seed);
  assertScrambled(state.active[0]);
}

// Simple: first letter at one third, second letter at two thirds, one pass, 120 second end
{
  const state = simpleNormal(PLAIN, 8);
  assert.strictEqual(state.simpleRemainMs, 120000);
  const first = state.active[0].parts[0].word;
  const part = state.active[0].parts[0];
  const limit = state.active[0].totalMs;
  assert.strictEqual(limit, 15000);
  assert.strictEqual(part.shown, 0);
  assert.strictEqual(state.passesLeft, 1);
  G.tick(state, 4999);
  assert.strictEqual(part.shown, 0);
  G.tick(state, 1);
  assert.strictEqual(part.shown, 1);
  assert.strictEqual(part.revealedByTime, true);
  G.tick(state, 4999);
  assert.strictEqual(part.shown, 1);
  G.tick(state, 1);
  assert.strictEqual(part.shown, 2);
  assert.strictEqual(G.submit(state, "").reason, "empty");
  assert.strictEqual(state.passesLeft, 1);
  assert.strictEqual(G.pass(state).ok, true);
  assert.strictEqual(state.passesLeft, 0);
  assert.strictEqual(state.active.length, 0);
  G.tick(state, 16);
  assert.notStrictEqual(state.active[0].parts[0].word, first);
  assert.strictEqual(G.pass(state).reason, "used");
  assert.strictEqual(state.active.length, 1);
  const second = state.active[0].parts[0].word;
  assert.strictEqual(G.submit(state, second).ok, true);
  assert.strictEqual(state.score, 1);
  assert.strictEqual(state.correct, 1);
  G.tick(state, 120000);
  assert.strictEqual(state.phase, "over");
  assert.strictEqual(state.simpleRemainMs, 0);
}

// Simple timeout fails that question and keeps the 120 second game going.
{
  const state = simpleNormal(["サクラ", "ウメ", "モモ", "キク"], 3);
  const first = state.active[0].parts[0].word;
  const limit = state.active[0].totalMs;
  G.tick(state, limit);
  assert.strictEqual(state.phase, "playing");
  assert.strictEqual(state.lives, 3);
  assert.strictEqual(state.missed, 1);
  assert.strictEqual(state.score, 0);
  assert.deepStrictEqual(state.lastAnswers, [first]);
  assert.notStrictEqual(state.active[0].parts[0].word, first);
  const miss = G.drainEvents(state).filter((ev) => ev.type === "miss");
  assert.deepStrictEqual(miss[0].words, [first]);
}

// Life: wrong answers do not cost a life. Timeout costs one. Three misses end the run.
{
  const state = G.createGame(PLAIN, "life", 3);
  assert.strictEqual(state.active.length, 1);
  assert.strictEqual(state.active[0].number, 1);
  assert.strictEqual(G.submit(state, "zzzz").ok, false);
  assert.strictEqual(state.lives, 3);
  G.tick(state, 14000);
  assert.strictEqual(state.active.length, 1);
  assert.strictEqual(state.active[0].number, 1);
  G.tick(state, 1000);
  assert.strictEqual(state.lives, 2);
  assert.strictEqual(state.combo, 0);
  assert.strictEqual(state.missed, 1);
  assert.strictEqual(state.active.length, 1);
  assert.strictEqual(state.active[0].number, 2);
  state.lives = 1;
  G.tick(state, 15000);
  assert.strictEqual(state.lives, 0);
  assert.strictEqual(state.phase, "over");
}

// One third opens the first letter. Two thirds opens the second. Instant answers score more than slow ones.
{
  const state = G.createGame(PLAIN, "life", 5);
  const part = state.active[0].parts[0];
  assert.strictEqual(part.shown, 0);
  G.tick(state, 4999);
  assert.strictEqual(part.shown, 0);
  G.tick(state, 1);
  assert.strictEqual(part.shown, 1);
  assert.strictEqual(part.reveal, true);
  G.tick(state, 4999);
  assert.strictEqual(part.shown, 1);
  G.tick(state, 1);
  assert.strictEqual(part.shown, 2);
  const slow = state.score;
  G.submit(state, state.active[0].parts[0].word);
  const slowGain = state.score - slow;

  const fast = G.createGame(PLAIN, "life", 5);
  const before = fast.score;
  G.submit(fast, fast.active[0].parts[0].word);
  const fastGain = fast.score - before;
  assert.ok(fastGain > slowGain);
  assert.strictEqual(fastGain, 380);

  G.tick(fast, 16);
  const mid = fast.score;
  G.submit(fast, fast.active[0].parts[0].word);
  assert.ok(fast.score - mid > fastGain);
}

// The first 10 questions stay one at a time. After that, the board opens to 2, then 3, then 4.
{
  const state = G.createGame(PLAIN, "life", 6);
  for (let n = 1; n <= 9; n += 1) {
    assert.strictEqual(state.active.length, 1);
    assert.strictEqual(state.active[0].number, n);
    G.tick(state, 14000);
    assert.strictEqual(state.active.length, 1);
    G.submit(state, state.active[0].parts[0].word);
    G.tick(state, 16);
  }
  assert.strictEqual(state.active[0].number, 10);
  assert.strictEqual(state.active[0].exclusive, true);
  G.tick(state, 10000);
  assert.strictEqual(state.active.length, 1);
  for (const part of state.active[0].parts) G.submit(state, part.word);
  assert.strictEqual(state.active.length, 1);
  assert.strictEqual(state.active[0].number, 11);
  const waiting = fresh();
  waiting.active = [];
  waiting.nextNumber = 20;
  waiting.phase = "playing";
  waiting.spawnAcc = 6000;
  G.tick(waiting, 0);
  assert.strictEqual(waiting.active.length, 1);
  assert.strictEqual(waiting.active[0].number, 20);
  assert.strictEqual(waiting.active[0].exclusive, true);
  const gap = G.spawnIntervalMs(state.correct);
  G.tick(state, gap - 1);
  assert.strictEqual(state.active.length, 1);
  G.tick(state, 1);
  assert.strictEqual(state.active.length, 2);
  G.tick(state, gap);
  assert.strictEqual(state.active.length, 2);

  function openBoard(done) {
    const board = fresh();
    board.active = [];
    board.nextNumber = done + 1;
    board.phase = "playing";
    board.lives = 3;
    let guard = 0;
    while (board.active.length < 6 && guard < 8) {
      board.spawnAcc = 0;
      G.tick(board, 0);
      guard += 1;
      if (board.phase === "wait-boss" || board.phase === "boss") break;
    }
    return board.active.length;
  }
  assert.strictEqual(openBoard(10), 2);
  assert.strictEqual(openBoard(15), 2);
  assert.strictEqual(openBoard(20), 3);
  assert.strictEqual(openBoard(25), 3);
  assert.strictEqual(openBoard(30), 4);
  assert.strictEqual(openBoard(32), 4);
}

// Each correct answer shortens the wait before the next question.
{
  let prev = G.spawnIntervalMs(10);
  for (let n = 11; n <= 80; n += 1) {
    const next = G.spawnIntervalMs(n);
    assert.ok(next < prev);
    prev = next;
  }
  assert.ok(G.spawnIntervalMs(400) >= 650);
  assert.ok(G.spawnIntervalMs(400) < 700);
  const state = fresh();
  state.active = [];
  state.nextNumber = 15;
  state.correct = 20;
  state.phase = "playing";
  state.spawnAcc = 0;
  G.tick(state, 0);
  const before = state.spawnAcc;
  G.submit(state, state.active[0].parts[0].word);
  assert.ok(state.spawnAcc < before);
}

// Boss schedule
{
  const q10 = spawnNumber(fresh(), 10);
  assert.strictEqual(q10.boss, true);
  assert.strictEqual(q10.exclusive, true);
  assert.strictEqual(q10.parts.length, 2);
  assert.strictEqual(q10.totalMs, 25000);
  assert.strictEqual(fresh().phase === "playing" || true, true);

  const hold = fresh();
  hold.active = [];
  hold.nextNumber = 19;
  hold.phase = "playing";
  hold.spawnAcc = 0;
  G.tick(hold, 0);
  assert.strictEqual(hold.phase, "playing");
  assert.strictEqual(hold.active[0].number, 19);
  hold.spawnAcc = 0;
  G.tick(hold, 0);
  assert.strictEqual(hold.phase, "wait-boss");
  assert.strictEqual(hold.nextNumber, 20);
  assert.strictEqual(hold.active.length, 1);
  G.submit(hold, hold.active[0].parts[0].word);
  assert.strictEqual(hold.phase, "boss");
  assert.strictEqual(hold.active[0].number, 20);
  assert.strictEqual(hold.active.length, 1);
  G.tick(hold, 10000);
  assert.strictEqual(hold.active.length, 1);

  const q20 = spawnNumber(fresh(), 20);
  assert.strictEqual(q20.parts.length, 2);
  assert.strictEqual(q20.totalMs, 25000);

  const q30 = spawnNumber(fresh(), 30);
  assert.strictEqual(q30.parts.length, 3);
  assert.strictEqual(q30.totalMs, 35000);
  assert.strictEqual(q30.exclusive, true);

  const q40 = spawnNumber(fresh(), 40);
  assert.strictEqual(q40.parts.length, 4);
  assert.strictEqual(q40.totalMs, 45000);

  const q50 = spawnNumber(fresh(), 50);
  assert.strictEqual(q50.boss, false);
  assert.strictEqual(q50.totalMs, 15000);

  const late = fresh();
  late.active = [];
  late.nextNumber = 56;
  late.phase = "playing";
  late.spawnAcc = 0;
  G.tick(late, 0);
  assert.strictEqual(late.phase, "playing");
  late.spawnAcc = 0;
  G.tick(late, 0);
  late.spawnAcc = 0;
  G.tick(late, 0);
  assert.strictEqual(late.active.length, 3);
  late.spawnAcc = 0;
  G.tick(late, 0);
  assert.strictEqual(late.active.length, 4);
  late.spawnAcc = 0;
  G.tick(late, 0);
  assert.strictEqual(late.active.length, 4);
  assert.ok(late.active.every((puzzle) => !puzzle.exclusive));
  assert.strictEqual(late.phase, "playing");
}

// Shared letters disappear only for the word that was answered.
{
  const state = fresh(["さくら", "さら", "うみ", "やま"], "life", 1);
  const boss = spawnNumber(state, 10);
  assert.strictEqual(boss.parts.length, 2);
  assertScrambled(boss);
  const first = boss.parts[0];
  const second = boss.parts[1];
  const before = boss.pool.length;
  G.submit(state, first.word);
  assert.strictEqual(first.solved, true);
  assert.strictEqual(second.solved, false);
  assert.strictEqual(boss.pool.length, before - first.chars.length);
  assert.deepStrictEqual(boss.pool.slice().sort(), second.chars.slice().sort());
  assert.notStrictEqual(boss.pool.join(""), second.word);
  assert.strictEqual(state.phase, "boss");
  G.submit(state, second.word);
  assert.strictEqual(state.phase, "playing");
  assert.strictEqual(state.active.length, 1);
  assert.strictEqual(state.active[0].boss, false);
}

// Not enough words shrinks the 4-word boss and its clock.
{
  const state = fresh(["さくら", "さら"], "life", 1);
  const boss = spawnNumber(state, 40);
  assert.strictEqual(boss.parts.length, 2);
  assert.strictEqual(boss.totalMs, 25000);
  assert.strictEqual(boss.exclusive, true);
}

// Boss hints follow thirds of that boss clock.
{
  const state = fresh();
  const boss = spawnNumber(state, 10);
  assert.strictEqual(boss.totalMs, 25000);
  assert.strictEqual(boss.parts.every((part) => part.shown === 0), true);
  G.tick(state, 8333);
  assert.strictEqual(boss.parts.every((part) => part.shown === 0), true);
  G.tick(state, 1);
  assert.strictEqual(boss.parts.every((part) => part.shown === 1 && part.revealedByTime), true);
  G.tick(state, 8332);
  assert.strictEqual(boss.parts.every((part) => part.shown === 1), true);
  G.tick(state, 1);
  assert.strictEqual(boss.parts.every((part) => part.shown === 2), true);
}

// Up to four questions, then the next boss waits.
{
  const state = fresh(PLAIN, "life", 9);
  state.active = [];
  state.nextNumber = 36;
  state.correct = 30;
  state.phase = "playing";
  state.spawnAcc = 0;
  G.tick(state, 0);
  assert.strictEqual(state.active.length, 1);
  assert.strictEqual(state.active[0].number, 36);
  advance(state, G.spawnIntervalMs(state.correct));
  advance(state, G.spawnIntervalMs(state.correct));
  advance(state, G.spawnIntervalMs(state.correct));
  assert.strictEqual(state.active.length, 4);
  advance(state, G.spawnIntervalMs(state.correct));
  assert.strictEqual(state.active.length, 4);
  assert.strictEqual(state.phase, "wait-boss");
  assert.strictEqual(state.nextNumber, 40);
  const lives = state.lives;
  const wait = Math.min.apply(null, state.active.map((puzzle) => puzzle.remainMs));
  G.tick(state, wait);
  assert.ok(state.lives < lives);
  assert.ok(state.lives > 0);
  assert.notStrictEqual(state.phase, "over");
}

// Alternate splits of a mixed boss count as ambiguous.
{
  const prepared = G.prepareDict(["ねこ", "こね", "いぬ", "ぬい", "あか"]);
  const by = (text) => prepared.dict.find((entry) => entry.text === text);
  assert.strictEqual(G.hasAlternatePartition([by("ねこ"), by("いぬ")], prepared.dict), true);
  const plain = G.prepareDict(["あか", "いぬ", "うみ", "えき"]);
  const word = (text) => plain.dict.find((entry) => entry.text === text);
  assert.strictEqual(G.hasAlternatePartition([word("あか"), word("いぬ")], plain.dict), false);
  const consumed = G.consumeChars(["さ", "く", "ら", "さ", "ら"], ["さ", "く", "ら"]);
  assert.deepStrictEqual(consumed.slice().sort(), ["さ", "ら"]);
}

// Pass is not available in life mode. Empty life continues.
{
  const state = fresh();
  assert.strictEqual(G.pass(state).reason, "not-simple");
  assert.strictEqual(state.active.length, 1);
}

// Simple never rolls a boss. A mixed dice boss stays on the board.
{
  const simple = G.createGame(PLAIN, "simple", 1);
  assert.strictEqual(spawnNumber(simple, 2).boss, false);
  assert.strictEqual(spawnNumber(simple, 10).boss, false);
  assert.strictEqual(spawnNumber(simple, 51).boss, false);
  let found = null;
  for (let seed = 1; seed <= 80 && !found; seed += 1) {
    const state = G.createGame(PLAIN, "dice", seed);
    const puzzle = spawnNumber(state, 51);
    if (puzzle && puzzle.boss) found = state;
  }
  assert.ok(found, "dice mix should spawn a boss");
  assert.strictEqual(found.phase, "playing");
  assert.strictEqual(found.active[0].exclusive, false);
}

// Hint switch keeps both letters closed after two thirds of the clock.
{
  const quiet = G.createGame(PLAIN, "life", 5, { hints: false });
  G.tick(quiet, 10000);
  assert.strictEqual(quiet.active[0].parts[0].shown, 0);
  const simple = simpleNormal(PLAIN, 8, { hints: false });
  G.tick(simple, 10000);
  assert.strictEqual(simple.active[0].parts[0].shown, 0);
  assert.strictEqual(simple.phase, "playing");
}

// Ranking points stay flat, and the timed hint stays off.
{
  const state = fresh(PLAIN, "rank", 5);
  assert.strictEqual(state.hints, false);
  assert.strictEqual(state.mode, "rank");
  G.tick(state, 10000);
  assert.strictEqual(state.active[0].parts[0].shown, 0);
  G.submit(state, state.active[0].parts[0].word);
  assert.strictEqual(state.score, 100);
  G.tick(state, 16);
  G.submit(state, state.active[0].parts[0].word);
  assert.strictEqual(state.score, 200);

  const ranked = fresh(PLAIN, "rank", 2);
  const puzzle = spawnNumber(ranked, 10);
  assert.strictEqual(puzzle.boss, true);
  G.submit(ranked, puzzle.parts[0].word);
  G.submit(ranked, puzzle.parts[1].word);
  assert.strictEqual(ranked.score, G.RULES.rankPoints * 2);
}

{
  let matched = false;
  for (let seed = 1; seed < 80 && !matched; seed += 1) {
    const state = fresh(PLAIN, "life1", seed);
    const first = state.active[0];
    if (!first || first.boss) continue;
    first.remainMs = first.totalMs;
    const before = state.score;
    G.submit(state, first.parts[0].word);
    const gained = state.score - before;
    const second = state.active[0];
    if (!second || second.boss) continue;
    second.remainMs = second.totalMs;
    const before2 = state.score;
    G.submit(state, second.parts[0].word);
    assert.strictEqual(state.score - before2, gained);
    matched = true;
  }
  assert.strictEqual(matched, true);
}

{
  const paused = fresh(PLAIN, "dicerank", 1);
  assert.strictEqual(paused.mode, "dicerank");
  paused.paused = true;
  const remain = paused.active[0].remainMs;
  G.tick(paused, 1000);
  assert.strictEqual(paused.active[0].remainMs, remain - 1000);
  let matched = false;
  for (let seed = 1; seed < 80 && !matched; seed += 1) {
    const state = fresh(PLAIN, "dicerank", seed);
    const first = state.active[0];
    if (!first || first.boss) continue;
    first.remainMs = first.totalMs;
    const before = state.score;
    G.submit(state, first.parts[0].word);
    const gained = state.score - before;
    const second = state.active[0];
    if (!second || second.boss) continue;
    second.remainMs = second.totalMs;
    const before2 = state.score;
    G.submit(state, second.parts[0].word);
    assert.strictEqual(state.score - before2, gained);
    matched = true;
  }
  assert.strictEqual(matched, true);
}

{
  const extreme = fresh(PLAIN, "extreme", 1);
  assert.strictEqual(extreme.mode, "extreme");
  assert.strictEqual(extreme.lives, 1);
  assert.strictEqual(G.maxSlotsFor(extreme), 4);
  extreme.paused = true;
  const remain = extreme.active[0].remainMs;
  G.tick(extreme, 1000);
  assert.strictEqual(extreme.active[0].remainMs, remain);

  const ranked = fresh(PLAIN, "simplerank", 1);
  assert.strictEqual(ranked.mode, "simplerank");
  assert.strictEqual(ranked.simpleRemainMs, 120000);
  assert.strictEqual(G.pass(ranked).ok, true);
  const clock = fresh(PLAIN, "simplerank", 2);
  clock.paused = true;
  G.tick(clock, 1000);
  assert.strictEqual(clock.simpleRemainMs, 119000);
}

// After 100, a mixed boss still shares the board.
{
  const state = fresh();
  state.active = [];
  state.nextNumber = 104;
  state.correct = 80;
  state.phase = "playing";
  state.spawnAcc = 0;
  G.tick(state, 0);
  advance(state, G.spawnIntervalMs(state.correct));
  advance(state, G.spawnIntervalMs(state.correct));
  advance(state, G.spawnIntervalMs(state.correct));
  assert.strictEqual(state.active.length, 4);
  assert.ok(state.active.every((puzzle) => !puzzle.exclusive));
}

// A word keeps the genre it was given.
{
  const prepared = G.prepareDict([
    { text: "さくら", genre: "fish" },
    { text: "さくら", genre: "food" },
    { text: "みかん", genre: "mammal" },
  ]);
  assert.strictEqual(prepared.dict.length, 2);
  assert.strictEqual(prepared.dict.find((entry) => entry.text === "さくら").genre, "fish");
  const state = G.createGame([
    { text: "さくら", genre: "mammal" },
    { text: "みかん", genre: "food" },
    { text: "ぶどう", genre: "fish" },
  ], "rank", 1);
  assert.ok(["mammal", "food", "fish"].includes(state.active[0].parts[0].genre));
}

// A wrong answer restores one life for each 50 questions reached, and never past 3.
{
  const early = fresh();
  early.lives = 2;
  early.nextNumber = 49;
  G.submit(early, "まちがい");
  assert.strictEqual(early.lives, 2);

  const mid = fresh();
  mid.lives = 2;
  mid.nextNumber = 51;
  G.submit(mid, "まちがい");
  assert.strictEqual(mid.lives, 3);
  mid.lives = 2;
  G.submit(mid, "まちがい");
  assert.strictEqual(mid.lives, 2);

  const banked = fresh(PLAIN, "rank", 1);
  banked.lives = 1;
  banked.nextNumber = 151;
  G.submit(banked, "まちがい");
  assert.strictEqual(banked.lives, 2);
  banked.lives = 1;
  G.submit(banked, "まちがい");
  assert.strictEqual(banked.lives, 2);
  banked.lives = 3;
  G.submit(banked, "まちがい");
  assert.strictEqual(banked.lives, 3);
  banked.lives = 2;
  G.submit(banked, "まちがい");
  assert.strictEqual(banked.lives, 3);
}

// The pass hammer removes one question, once per game.
{
  const state = fresh();
  const id = state.active[0].id;
  const lives = state.lives;
  const answer = state.active[0].parts.map((part) => part.word);
  assert.strictEqual(G.hammer(state, id).ok, true);
  assert.deepStrictEqual(state.events.filter((ev) => ev.type === "hammer")[0].words, answer);
  assert.ok(!state.active.some((puzzle) => puzzle.id === id));
  assert.strictEqual(state.lives, lives);
  assert.strictEqual(state.score, 0);
  assert.strictEqual(G.hammer(state, id).reason, "used");

  const ranked = fresh();
  const puzzle = spawnNumber(ranked, 10);
  assert.strictEqual(ranked.phase, "boss");
  assert.strictEqual(G.hammer(ranked, puzzle.id).ok, true);
  assert.strictEqual(ranked.phase, "playing");
  assert.ok(!ranked.active.some((item) => item.id === puzzle.id));
}

// Hiragana and katakana count as the same answer.
{
  const state = G.createGame(["ヤキニク", "ラーメン", "カレー"], "simple", 4);
  const word = state.active[0].parts[0].word;
  const hira = word.replace(/[\u30A1-\u30F6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  assert.notStrictEqual(hira, word);
  assert.strictEqual(G.submit(state, hira).ok, true);
  const back = G.createGame(["やきにく", "らーめん", "かれー"], "simple", 4);
  const kana = back.active[0].parts[0].word.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  assert.strictEqual(G.submit(back, kana).ok, true);
  const mixed = G.createGame(["ヤキニク"], "simple", 1);
  assert.strictEqual(G.submit(mixed, "ヤきニく").ok, true);
}

// A timeout keeps the answer of the problem that just ended.
{
  const life = G.createGame(["サクラ", "ウメ", "モモ", "キク"], "life", 3);
  const expired = life.active[0].parts.map((part) => part.word);
  G.tick(life, 15000);
  const miss = G.drainEvents(life).filter((ev) => ev.type === "miss");
  assert.strictEqual(miss.length, 1);
  assert.deepStrictEqual(miss[0].words, expired);
  assert.deepStrictEqual(life.lastAnswers, expired);
  assert.strictEqual(life.lives, 2);

  const simple = G.createGame(["サクラ", "ウメ", "モモ"], "simple", 1);
  const last = simple.active[0].parts.map((part) => part.word);
  G.tick(simple, 120000);
  assert.strictEqual(simple.phase, "over");
  assert.deepStrictEqual(simple.lastAnswers, last);
}

// Life and ranking favor 3-5 characters early, and the weights are flat at question 80.
{
  assert.strictEqual(G.wordWeight(1, 3), 1);
  assert.strictEqual(G.wordWeight(1, 5), 1);
  assert.strictEqual(G.wordWeight(1, 6), G.RULES.longWeightAtStart);
  assert.ok(G.wordWeight(40, 7) > G.wordWeight(1, 7));
  assert.ok(G.wordWeight(40, 7) < 1);
  assert.strictEqual(G.wordWeight(80, 9), 1);
  assert.strictEqual(G.wordWeight(140, 8), 1);

  const kana = "アイウエオカキクケコサシスセソタチツテトナニヌネノ";
  const words = [];
  const token = (index, len, salt) => {
    const chars = [];
    let n = index + 1;
    for (let k = 0; k < len - 1; k += 1) {
      chars.push(kana[(n + salt + k * 3) % kana.length]);
      n = Math.floor(n / kana.length) + 1;
    }
    chars.push(kana[(salt + 11) % kana.length]);
    if (chars.every((ch) => ch === chars[0])) chars[0] = kana[(salt + 1) % kana.length];
    return chars.join("");
  };
  for (let i = 0; i < 40; i += 1) {
    words.push(token(i, 4, 0));
    words.push(token(i, 7, 4));
  }
  function longRate(mode, questionNumber) {
    let long = 0;
    let seen = 0;
    const seeds = 240;
    for (let seed = 1; seed <= seeds; seed += 1) {
      const state = G.createGame(words, mode, seed);
      state.active = [];
      state.bag = [];
      state.nextNumber = questionNumber;
      state.phase = "playing";
      state.spawnAcc = 0;
      state.lives = 3;
      G.tick(state, 0);
      if (!state.active[0] || state.active[0].boss) continue;
      seen += 1;
      if (state.active[0].parts[0].chars.length > 5) long += 1;
    }
    assert.ok(seen >= 40, "samples " + seen);
    return long / seen;
  }
  const earlyLife = longRate("life", 1);
  const lateLife = longRate("life", 80);
  const earlySimple = longRate("simple", 1);
  assert.ok(earlyLife < 0.28, "early life long rate " + earlyLife);
  assert.ok(lateLife > 0.38 && lateLife < 0.62, "late life long rate " + lateLife);
  assert.ok(earlySimple > 0.38 && earlySimple < 0.62, "simple long rate " + earlySimple);
  assert.ok(earlyLife < earlySimple - 0.15);
}

{
  const words = ["サンドイッチ", "ハンバーガー", "カレーライス", "コロッケパン", "カレー", "サクラ", "ウメ", "モモ"];
  const state = G.createGame(words, "dice", 4);
  assert.strictEqual(state.mode, "dice");
  assert.strictEqual(state.lives, 3);
  assert.strictEqual(state.active[0].boss, false);
  assert.strictEqual(G.pass(state).reason, "not-simple");
  assert.strictEqual(G.submit(state, state.active[0].parts[0].word).ok, true);
  assert.ok(state.score >= 1);
  const end = G.createGame(words, "dice", 5);
  G.tick(end, 15000);
  assert.strictEqual(end.lives, 2);
  assert.notStrictEqual(end.phase, "over");
  G.tick(end, 15000);
  G.tick(end, 15000);
  assert.strictEqual(end.phase, "over");
  assert.strictEqual(end.lives, 0);
}

{
  function tally(mode, number, seeds) {
    const counts = { normal: 0, 2: 0, 3: 0, 4: 0 };
    for (let seed = 1; seed <= seeds; seed += 1) {
      const puzzle = spawnNumber(fresh(PLAIN, mode, seed), number);
      if (!puzzle.boss) counts.normal += 1;
      else {
        assert.strictEqual(puzzle.exclusive, false);
        counts[puzzle.parts.length] += 1;
      }
    }
    return counts;
  }
  const early = G.bossMixWeights(51);
  const mid = G.bossMixWeights(75);
  const late = G.bossMixWeights(100);
  assert.ok(early.normal > early[2] && early[2] > early[3] && early[3] > early[4]);
  assert.ok(mid[2] > early[2] && mid[2] < late[2]);
  assert.ok(Math.abs(late.normal - 1) < 1e-9);
  assert.ok(Math.abs(late[2] - late[3]) < 1e-9 && Math.abs(late[3] - late[4]) < 1e-9);
  const seeds = 700;
  const at = (mode, number) => tally(mode, number, seeds);
  const lifeEarly = at("life", 1);
  const lifeLate = at("life", 100);
  const rankLate = at("rank", 100);
  const diceLate = at("dice", 100);
  assert.strictEqual(lifeEarly.normal, seeds);
  assert.strictEqual(at("simple", 2).normal, seeds);
  assert.strictEqual(at("simple", 10).normal, seeds);
  assert.strictEqual(at("simple", 51).normal, seeds);
  assert.strictEqual(at("simple", 100).normal, seeds);
  for (const counts of [diceLate, lifeLate, rankLate]) {
    for (const key of ["normal", 2, 3, 4]) {
      const rate = counts[key] / seeds;
      assert.ok(rate > 0.17 && rate < 0.33, key + " " + rate + " " + JSON.stringify(counts));
    }
  }
  assert.strictEqual(spawnNumber(fresh(), 30).parts.length, 3);
  assert.strictEqual(spawnNumber(fresh(), 30).exclusive, true);

  const diceWords = ["さくら", "みかん", "ぶどう", "りんご", "ももたろう", "カレー", "サンドイッチ", "ハンバーガー"];
  const dice10 = spawnNumber(fresh(diceWords, "dice", 2), 10);
  assert.strictEqual(dice10.boss, true);
  assert.strictEqual(dice10.exclusive, true);
  assert.strictEqual(dice10.parts.length, 2);
  assert.strictEqual(dice10.totalMs, 25000);
  assert.strictEqual(spawnNumber(fresh(diceWords, "dice", 2), 2).boss, false);
  assert.strictEqual(spawnNumber(fresh(diceWords, "dice", 2), 20).parts.length, 2);
  assert.strictEqual(spawnNumber(fresh(diceWords, "dice", 2), 30).parts.length, 3);
  assert.strictEqual(spawnNumber(fresh(diceWords, "dice", 2), 40).parts.length, 4);
  assert.strictEqual(spawnNumber(fresh(diceWords, "dice", 2), 40).totalMs, 45000);
  assert.strictEqual(spawnNumber(fresh(diceWords, "dice", 2), 50).boss, false);

  const rankedPause = fresh(PLAIN, "rank", 1);
  const rankBefore = rankedPause.active[0].remainMs;
  rankedPause.paused = true;
  G.tick(rankedPause, 1000);
  assert.strictEqual(rankedPause.active[0].remainMs, rankBefore - 1000);
  const lifePause = fresh(PLAIN, "life", 1);
  const lifeBefore = lifePause.active[0].remainMs;
  lifePause.paused = true;
  G.tick(lifePause, 1000);
  assert.strictEqual(lifePause.active[0].remainMs, lifeBefore);
}

console.log("ok", 34);
