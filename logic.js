/* アナグラムのルール本体。画面には依存しない。
   単語リストは後から差し替えられる。時間の調整は RULES を変える。 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AnagramGame = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RULES = {
    simpleMs: 120000,
    simpleHintMs: 10000,
    lives: 3,
    normalMs: 15000,
    maxSlots: 4,
    exclusiveUntil: 50,
    bossMs: { 2: 25000, 3: 35000, 4: 45000 },
    bossClearBonusPerWord: 150,
    rankPoints: 100,
    minChars: 2,
    maxChars: 16,
    shortChars: 5,
    flatAt: 80,
    longWeightAtStart: 0.32,
    bossFlatAt: 100,
    bossWeightAtStart: { normal: 1, 2: 0.16, 3: 0.05, 4: 0.02 },
  };

  function cleanText(raw) {
    return String(raw || "")
      .normalize("NFKC")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim();
  }

  function foldKana(text) {
    return text.replace(/[\u30A1-\u30F6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  }

  function norm(raw) {
    return foldKana(cleanText(raw).toLowerCase().replace(/\s+/g, ""));
  }

  function unsolvedWords(puzzle) {
    const words = [];
    for (const part of puzzle.parts) {
      if (!part.solved) words.push(part.word);
    }
    return words;
  }

  function countChars(chars) {
    const counts = Object.create(null);
    for (const ch of chars) counts[ch] = (counts[ch] || 0) + 1;
    return counts;
  }

  function canScramble(chars) {
    for (let i = 1; i < chars.length; i += 1) {
      if (chars[i] !== chars[0]) return true;
    }
    return false;
  }

  function shuffle(list, rng) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function permutations(items) {
    if (items.length <= 1) return [items.slice()];
    const out = [];
    for (let i = 0; i < items.length; i += 1) {
      const rest = items.slice(0, i).concat(items.slice(i + 1));
      for (const perm of permutations(rest)) out.push([items[i]].concat(perm));
    }
    return out;
  }

  function forbiddenJoins(parts) {
    const words = [];
    for (const part of parts) {
      if (!part.solved) words.push(part.chars.join(""));
    }
    const set = new Set(words);
    if (words.length > 1 && words.length <= 4) {
      for (const perm of permutations(words)) set.add(perm.join(""));
    }
    return set;
  }

  function shuffleAway(chars, rng, forbidden) {
    if (chars.length <= 1) return chars.slice();
    let last = chars.slice();
    for (let i = 0; i < 48; i += 1) {
      const next = shuffle(chars, rng);
      if (!forbidden.has(next.join(""))) return next;
      last = next;
    }
    const rotated = chars.slice();
    for (let i = 0; i < rotated.length; i += 1) {
      rotated.push(rotated.shift());
      if (!forbidden.has(rotated.join(""))) return rotated.slice();
    }
    const swapped = chars.slice();
    for (let i = 1; i < swapped.length; i += 1) {
      if (swapped[i] === swapped[0]) continue;
      const tmp = swapped[0];
      swapped[0] = swapped[i];
      swapped[i] = tmp;
      if (!forbidden.has(swapped.join(""))) return swapped;
    }
    return last;
  }

  function consumeChars(pool, chars) {
    const need = countChars(chars);
    const next = [];
    for (const ch of pool) {
      if (need[ch] > 0) {
        need[ch] -= 1;
        continue;
      }
      next.push(ch);
    }
    return next;
  }

  function fits(have, need) {
    for (const key in need) {
      if ((have[key] || 0) < need[key]) return false;
    }
    return true;
  }

  function subCounts(have, need) {
    const next = Object.create(null);
    for (const key in have) next[key] = have[key];
    for (const key in need) next[key] = (next[key] || 0) - need[key];
    return next;
  }

  function isZero(counts) {
    for (const key in counts) {
      if (counts[key] > 0) return false;
    }
    return true;
  }

  function readEntry(raw) {
    if (raw && typeof raw === "object") {
      return {
        text: cleanText(raw.text),
        genre: typeof raw.genre === "string" ? raw.genre : "",
      };
    }
    return { text: cleanText(raw), genre: "" };
  }

  function prepareDict(rawList) {
    const map = new Map();
    let skipped = 0;
    const list = Array.isArray(rawList) ? rawList : String(rawList || "").split(/\r?\n/);
    for (const raw of list) {
      const item = readEntry(raw);
      const text = item.text;
      if (!text || text.startsWith("#")) continue;
      const chars = Array.from(text);
      if (chars.length < RULES.minChars || chars.length > RULES.maxChars || !canScramble(chars)) {
        skipped += 1;
        continue;
      }
      const match = norm(text);
      if (!match || map.has(match)) {
        if (map.has(match)) skipped += 1;
        continue;
      }
      map.set(match, {
        text,
        match,
        chars,
        genre: item.genre,
        key: chars.slice().sort().join("\u0001"),
        counts: countChars(chars),
      });
    }
    const dict = Array.from(map.values());
    const groups = new Map();
    for (const entry of dict) {
      if (!groups.has(entry.key)) groups.set(entry.key, []);
      groups.get(entry.key).push(entry);
    }
    return { dict, groups, skipped };
  }

  function likeSimple(mode) {
    return mode === "simple" || mode === "simplerank";
  }

  function lateGame(mode) {
    return mode === "life1" || mode === "extreme";
  }

  function bossMixWeights(questionNumber) {
    const startAt = RULES.exclusiveUntil + 1;
    const span = Math.max(1, RULES.bossFlatAt - startAt);
    const t = Math.min(1, Math.max(0, ((questionNumber || startAt) - startAt) / span));
    const start = RULES.bossWeightAtStart;
    const weight = (key) => {
      const from = start[key];
      return from + (1 - from) * t;
    };
    return { normal: weight("normal"), 2: weight(2), 3: weight(3), 4: weight(4) };
  }

  function pickBossMix(questionNumber, rng) {
    const weights = bossMixWeights(questionNumber);
    const keys = ["normal", 2, 3, 4];
    let total = 0;
    for (const key of keys) total += weights[key];
    let roll = rng() * total;
    let chosen = "normal";
    for (const key of keys) {
      roll -= weights[key];
      if (roll < 0) {
        chosen = key;
        break;
      }
    }
    if (chosen === "normal") return null;
    return { size: chosen, ms: RULES.bossMs[chosen], exclusive: false };
  }

  function paceNumber(state) {
    return lateGame(state.mode) ? Math.max(state.nextNumber, RULES.bossFlatAt) : state.nextNumber;
  }

  function bossSpec(questionNumber, mode, rng) {
    if (lateGame(mode)) questionNumber = Math.max(questionNumber || 1, RULES.bossFlatAt);
    if (likeSimple(mode)) return null;
    if (questionNumber > 0 && questionNumber < RULES.exclusiveUntil && questionNumber % 10 === 0) {
      const size = questionNumber >= 40 ? 4 : questionNumber >= 30 ? 3 : 2;
      return { size, ms: RULES.bossMs[size], exclusive: true };
    }
    if (questionNumber <= RULES.exclusiveUntil) return null;
    if (!rng) return null;
    return pickBossMix(questionNumber, rng);
  }

  function spawnIntervalMs(upcoming) {
    if (upcoming >= 36) return 3700;
    if (upcoming >= 26) return 4300;
    if (upcoming >= 18) return 5200;
    if (upcoming >= 10) return 7000;
    return 9000;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function activeMatches(state) {
    const set = new Set();
    for (const puzzle of state.active) {
      for (const part of puzzle.parts) set.add(part.match);
    }
    return set;
  }

  function wordWeight(questionNumber, length) {
    if ((length | 0) <= RULES.shortChars) return 1;
    const span = Math.max(1, RULES.flatAt - 1);
    const t = Math.min(1, Math.max(0, ((questionNumber || 1) - 1) / span));
    const start = RULES.longWeightAtStart;
    return start + (1 - start) * t;
  }

  function pickWeighted(entries, questionNumber, rng) {
    let total = 0;
    const weights = [];
    for (const entry of entries) {
      const weight = wordWeight(questionNumber, entry.chars.length);
      weights.push(weight);
      total += weight;
    }
    let roll = rng() * total;
    for (let i = 0; i < entries.length; i += 1) {
      roll -= weights[i];
      if (roll < 0) return i;
    }
    return entries.length - 1;
  }

  function ensureBag(state) {
    if (state.bag.length > 0) return;
    state.bag = shuffle(state.dict, state.rng);
  }

  function drawUniform(state) {
    const active = activeMatches(state);
    const skipped = [];
    ensureBag(state);
    while (state.bag.length) {
      const entry = state.bag.pop();
      if (active.has(entry.match)) {
        skipped.push(entry);
        continue;
      }
      state.bag = skipped.concat(state.bag);
      return entry;
    }
    state.bag = skipped;
    ensureBag(state);
    return state.bag.pop() || state.dict[0];
  }

  function drawBiased(state) {
    const active = activeMatches(state);
    for (let guard = 0; guard < 3; guard += 1) {
      ensureBag(state);
      const pool = state.bag.filter((entry) => !active.has(entry.match));
      if (!pool.length) {
        state.bag = [];
        continue;
      }
      const chosen = pool[pickWeighted(pool, paceNumber(state), state.rng)];
      state.bag = state.bag.filter((entry) => entry !== chosen);
      return chosen;
    }
    return state.dict[0];
  }

  function drawFixedLength(state, length) {
    const active = activeMatches(state);
    const skipped = [];
    ensureBag(state);
    while (state.bag.length) {
      const entry = state.bag.pop();
      if (entry.chars.length !== length || active.has(entry.match)) {
        skipped.push(entry);
        continue;
      }
      state.bag = skipped.concat(state.bag);
      return entry;
    }
    state.bag = skipped;
    const again = state.dict.find((entry) => entry.chars.length === length && !active.has(entry.match));
    if (again) {
      state.bag = state.bag.filter((entry) => entry !== again);
      return again;
    }
    return drawUniform(state);
  }

  function drawNormal(state) {
    if (likeSimple(state.mode)) return drawUniform(state);
    return drawBiased(state);
  }

  function drawEntries(state, count, maxLen) {
    const active = activeMatches(state);
    let source = state.dict.filter((entry) => !active.has(entry.match));
    if (source.length < count) source = state.dict.slice();
    if (maxLen) {
      const short = source.filter((entry) => entry.chars.length <= maxLen);
      if (short.length >= count) source = short;
    }
    const picked = [];
    const seen = new Set();
    if (likeSimple(state.mode)) {
      for (const entry of shuffle(source, state.rng)) {
        if (seen.has(entry.match)) continue;
        seen.add(entry.match);
        picked.push(entry);
        if (picked.length === count) break;
      }
    } else {
      const pool = source.slice();
      while (picked.length < count && pool.length) {
        const entry = pool.splice(pickWeighted(pool, paceNumber(state), state.rng), 1)[0];
        if (seen.has(entry.match)) continue;
        seen.add(entry.match);
        picked.push(entry);
      }
    }
    if (picked.length) {
      const chosen = new Set(picked.map((entry) => entry.match));
      state.bag = state.bag.filter((entry) => !chosen.has(entry.match));
    }
    return picked;
  }

  function hasAlternatePartition(partEntries, dict) {
    if (!partEntries || partEntries.length < 2) return false;
    const targetKey = partEntries
      .map((entry) => entry.match)
      .slice()
      .sort()
      .join("\n");
    const pool = Object.create(null);
    for (const entry of partEntries) {
      for (const key in entry.counts) pool[key] = (pool[key] || 0) + entry.counts[key];
    }
    let candidates = dict.filter((entry) => entry.chars.length >= 2 && fits(pool, entry.counts));
    if (candidates.length > 36) {
      const lengths = new Set(partEntries.map((entry) => entry.chars.length));
      const preferred = candidates.filter((entry) => lengths.has(entry.chars.length));
      const rest = candidates.filter((entry) => !lengths.has(entry.chars.length));
      candidates = preferred.concat(rest).slice(0, 36);
      for (const target of partEntries) {
        if (!candidates.some((entry) => entry.match === target.match)) candidates.push(target);
      }
    }
    candidates.sort((a, b) => b.chars.length - a.chars.length || (a.match < b.match ? -1 : 1));
    const found = new Set();
    let calls = 0;
    function walk(remain, start, chosen) {
      if (found.size > 1) return;
      calls += 1;
      if (calls > 8000) {
        found.add("__overflow__");
        return;
      }
      if (isZero(remain)) {
        found.add(chosen.map((entry) => entry.match).slice().sort().join("\n"));
        return;
      }
      for (let i = start; i < candidates.length; i += 1) {
        const entry = candidates[i];
        if (!fits(remain, entry.counts)) continue;
        chosen.push(entry);
        walk(subCounts(remain, entry.counts), i + 1, chosen);
        chosen.pop();
        if (found.size > 1) return;
      }
    }
    walk(pool, 0, []);
    if (found.has("__overflow__")) return true;
    found.delete(targetKey);
    return found.size > 0;
  }

  function takeSlot(state) {
    const used = new Set(state.active.map((puzzle) => puzzle.slot));
    for (let i = 0; i < RULES.maxSlots; i += 1) {
      if (!used.has(i)) return i;
    }
    return 0;
  }

  function finishedCount(state) {
    return state.nextNumber - 1 - state.active.length;
  }

  function maxSlotsFor(state) {
    if (lateGame(state.mode)) return 4;
    const done = finishedCount(state);
    if (done >= 30) return 4;
    if (done >= 20) return 3;
    if (done >= 10) return 2;
    return 1;
  }

  function makePuzzle(state, entries, options) {
    const parts = entries.map((entry) => ({
      word: entry.text,
      match: entry.match,
      chars: entry.chars.slice(),
      key: entry.key,
      counts: entry.counts,
      genre: entry.genre || "",
      solved: false,
      ambiguous: false,
      shown: 0,
      reveal: false,
      revealedByTime: false,
    }));
    const partitionAmbiguous = options.boss && hasAlternatePartition(entries, state.dict);
    for (const part of parts) {
      const group = state.groups.get(part.key) || [];
      part.ambiguous = group.length > 1 || partitionAmbiguous;
      part.shown = part.ambiguous ? 1 : 0;
      part.reveal = part.shown > 0;
    }
    const chars = [];
    for (const part of parts) chars.push.apply(chars, part.chars);
    const puzzle = {
      id: state.nextId,
      number: state.nextNumber,
      slot: takeSlot(state),
      boss: !!options.boss,
      exclusive: !!options.exclusive,
      parts,
      pool: shuffleAway(chars, state.rng, forbiddenJoins(parts)),
      totalMs: options.totalMs,
      remainMs: options.totalMs,
      status: "live",
    };
    state.nextId += 1;
    return puzzle;
  }

  function createPuzzle(state, spec) {
    if (!spec) {
      return makePuzzle(state, [drawNormal(state)], {
        boss: false,
        exclusive: false,
        totalMs: RULES.normalMs,
      });
    }
    let size = spec.size;
    if (state.dict.length < 2) {
      return makePuzzle(state, [drawNormal(state)], {
        boss: false,
        exclusive: false,
        totalMs: RULES.normalMs,
      });
    }
    size = Math.min(size, state.dict.length);
    const maxLen = spec.exclusive ? (size >= 4 ? 5 : 6) : 4;
    let entries = drawEntries(state, size, maxLen);
    if (entries.length < 2) {
      return makePuzzle(state, [entries[0] || drawNormal(state)], {
        boss: false,
        exclusive: false,
        totalMs: RULES.normalMs,
      });
    }
    if (entries.length < size) size = entries.length;
    const totalMs = RULES.bossMs[entries.length] || spec.ms;
    return makePuzzle(state, entries, {
      boss: true,
      exclusive: spec.exclusive && entries.length >= 2,
      totalMs,
    });
  }

  function pushEvent(state, event) {
    state.events.push(event);
    if (state.events.length > 40) state.events.shift();
  }

  function spawnUpcoming(state) {
    if (state.phase === "over") return "dead";
    if (!likeSimple(state.mode) && state.lives <= 0) return "dead";
    const spec = bossSpec(state.nextNumber, state.mode, state.rng);
    if (spec && spec.exclusive) {
      if (state.active.length > 0) {
        state.phase = "wait-boss";
        return "waiting";
      }
    } else if (state.active.length >= maxSlotsFor(state)) {
      return "blocked";
    }
    const puzzle = createPuzzle(state, spec && spec.exclusive && state.dict.length < 2 ? null : spec);
    state.active.push(puzzle);
    state.nextNumber += 1;
    state.revision += 1;
    if (puzzle.exclusive) state.phase = "boss";
    else if (state.phase === "wait-boss") state.phase = "playing";
    pushEvent(state, {
      type: "spawn",
      id: puzzle.id,
      number: puzzle.number,
      boss: puzzle.boss,
      exclusive: puzzle.exclusive,
    });
    return "spawned";
  }

  function spawnSimple(state) {
    if (state.phase === "over" || state.simpleRemainMs <= 0 || state.active.length > 0) return;
    const puzzle = createPuzzle(state, bossSpec(state.nextNumber, state.mode, state.rng));
    state.active.push(puzzle);
    state.nextNumber += 1;
    state.wordElapsedMs = 0;
    state.revision += 1;
    pushEvent(state, { type: "spawn", id: puzzle.id, number: puzzle.number, boss: puzzle.boss, exclusive: puzzle.exclusive });
  }

  function createGame(rawWords, mode, seed, options) {
    const opts = options || {};
    const prepared = prepareDict(rawWords);
    const rank = mode === "rank";
    const state = {
      mode: mode === "rank" || mode === "simple" || mode === "simplerank" || mode === "dice" || mode === "dicerank" || mode === "life1" || mode === "extreme" ? mode : "life",
      hints: rank ? false : opts.hints !== false,
      dict: prepared.dict,
      groups: prepared.groups,
      skipped: prepared.skipped,
      rng: mulberry32(seed == null ? Math.floor(Math.random() * 1000000000) : seed),
      phase: "playing",
      active: [],
      nextNumber: 1,
      nextId: 1,
      spawnAcc: 0,
      lives: lateGame(mode) ? 1 : RULES.lives,
      score: 0,
      correct: 0,
      combo: 0,
      maxCombo: 0,
      missed: 0,
      passesLeft: 1,
      hammersLeft: 1,
      healsUsed: 0,
      simpleRemainMs: RULES.simpleMs,
      wordElapsedMs: 0,
      elapsedMs: 0,
      bag: [],
      revision: 0,
      events: [],
      lastAnswers: [],
      paused: false,
    };
    if (!state.dict.length) {
      state.phase = "over";
      pushEvent(state, { type: "no-words" });
      return state;
    }
    if (likeSimple(state.mode)) spawnSimple(state);
    else spawnUpcoming(state);
    if (lateGame(state.mode)) state.spawnAcc = spawnIntervalMs(paceNumber(state));
    return state;
  }

  function awardPoints(state, puzzle, part) {
    if (state.mode === "rank") return RULES.rankPoints;
    const ratio = Math.max(0, Math.min(1, puzzle.remainMs / puzzle.totalMs));
    const base = puzzle.boss ? 400 : 100;
    const speed = Math.round(ratio * (puzzle.boss ? 400 : 200));
    const early = part.revealedByTime ? 0 : 80;
    const mult = state.mode === "life1" || state.mode === "dicerank" ? 1 : 1 + Math.min(state.combo, 10) * 0.1;
    return Math.max(1, Math.round((base + speed + early) * mult));
  }

  function releaseExclusive(state, puzzle) {
    if (!puzzle.exclusive || state.phase === "over") return;
    state.phase = "playing";
    state.spawnAcc = 0;
  }

  function noteSpawn(state, result) {
    if (result === "spawned" && state.phase === "playing") {
      state.spawnAcc = spawnIntervalMs(paceNumber(state));
    } else if (result === "blocked") {
      state.spawnAcc = 0;
    }
  }

  function fillIfEmpty(state) {
    if (!state || likeSimple(state.mode)) return;
    if (state.phase === "over" || state.phase === "boss" || state.active.length) return;
    noteSpawn(state, spawnUpcoming(state));
  }

  function solvePart(state, puzzle, part) {
    part.solved = true;
    const gained = likeSimple(state.mode) ? 1 : awardPoints(state, puzzle, part);
    state.score += gained;
    state.correct += 1;
    state.combo += 1;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    const remainParts = puzzle.parts.filter((item) => !item.solved);
    puzzle.pool = shuffleAway(consumeChars(puzzle.pool, part.chars), state.rng, forbiddenJoins(puzzle.parts));
    pushEvent(state, {
      type: "correct",
      id: puzzle.id,
      word: part.word,
      points: gained,
      combo: state.combo,
      cleared: remainParts.length === 0,
    });
    if (remainParts.length === 0) {
      if ((state.mode === "life" || state.mode === "dice" || state.mode === "dicerank" || state.mode === "life1" || state.mode === "extreme") && puzzle.boss) {
        const bonus = RULES.bossClearBonusPerWord * puzzle.parts.length;
        state.score += bonus;
        pushEvent(state, { type: "bonus", id: puzzle.id, points: bonus });
      }
      puzzle.status = "cleared";
      state.active = state.active.filter((item) => item.id !== puzzle.id);
      if (likeSimple(state.mode)) state.wordElapsedMs = 0;
      releaseExclusive(state, puzzle);
      fillIfEmpty(state);
    }
    state.revision += 1;
  }

  function submit(state, raw) {
    if (!state || state.phase === "over" || state.phase === "ready") return { ok: false, reason: "idle" };
    const text = norm(raw);
    if (!text) return { ok: false, reason: "empty" };
    let best = null;
    for (const puzzle of state.active) {
      if (puzzle.status !== "live") continue;
      for (const part of puzzle.parts) {
        if (part.solved || part.match !== text) continue;
        if (!best || puzzle.remainMs < best.puzzle.remainMs) best = { puzzle, part };
      }
    }
    if (!best) {
      pushEvent(state, { type: "wrong" });
      recoverOnMiss(state);
      return { ok: false, reason: "wrong" };
    }
    solvePart(state, best.puzzle, best.part);
    return { ok: true, word: best.part.word };
  }

  function recoverOnMiss(state) {
    if (!state || likeSimple(state.mode) || state.phase === "over") return;
    const cap = lateGame(state.mode) ? 1 : RULES.lives;
    const reached = Math.max(0, state.nextNumber - 1);
    const due = Math.floor(reached / 50);
    if (due <= state.healsUsed || state.lives >= cap) return;
    state.lives += 1;
    state.healsUsed += 1;
    pushEvent(state, { type: "heal", lives: state.lives, number: reached });
  }

  function hammer(state, puzzleId) {
    if (!state || state.phase === "over" || state.phase === "ready") return { ok: false, reason: "idle" };
    if (state.hammersLeft <= 0) {
      pushEvent(state, { type: "hammer-denied" });
      return { ok: false, reason: "used" };
    }
    const puzzle = state.active.find((item) => item.id === puzzleId && item.status === "live");
    if (!puzzle) return { ok: false, reason: "empty" };
    state.hammersLeft -= 1;
    state.combo = 0;
    puzzle.status = "cleared";
    state.active = state.active.filter((item) => item.id !== puzzle.id);
    if (likeSimple(state.mode)) state.wordElapsedMs = 0;
    state.revision += 1;
    pushEvent(state, { type: "hammer", id: puzzle.id, words: unsolvedWords(puzzle) });
    releaseExclusive(state, puzzle);
    fillIfEmpty(state);
    return { ok: true };
  }

  function pass(state) {
    if (!state || !likeSimple(state.mode)) return { ok: false, reason: "not-simple" };
    if (state.phase !== "playing") return { ok: false, reason: "idle" };
    if (state.passesLeft <= 0) {
      pushEvent(state, { type: "pass-denied" });
      return { ok: false, reason: "used" };
    }
    if (!state.active.length) return { ok: false, reason: "empty" };
    state.passesLeft -= 1;
    state.combo = 0;
    state.active = [];
    state.wordElapsedMs = 0;
    state.revision += 1;
    pushEvent(state, { type: "pass" });
    return { ok: true };
  }

  function applyTimedReveal(state, puzzle) {
    const total = puzzle.totalMs;
    if (!total) return;
    const remain = puzzle.remainMs;
    let count = 0;
    if (remain * 3 <= total) count = 2;
    else if (remain * 3 <= total * 2) count = 1;
    else return;
    let changed = false;
    for (const part of puzzle.parts) {
      if (part.solved) continue;
      const next = Math.min(part.chars.length, Math.max(part.shown || 0, count));
      if (next === (part.shown || 0)) continue;
      part.shown = next;
      part.reveal = true;
      part.revealedByTime = true;
      changed = true;
    }
    if (!changed) return;
    state.revision += 1;
    pushEvent(state, { type: "hint", id: puzzle.id });
  }

  function expireSimple(state, puzzle) {
    puzzle.status = "expired";
    puzzle.remainMs = 0;
    const words = unsolvedWords(puzzle);
    state.lastAnswers = words;
    state.missed += 1;
    state.combo = 0;
    state.active = state.active.filter((item) => item.id !== puzzle.id);
    state.wordElapsedMs = 0;
    state.revision += 1;
    pushEvent(state, { type: "miss", id: puzzle.id, lives: state.lives, words });
  }

  function expirePuzzle(state, puzzle) {
    puzzle.status = "expired";
    puzzle.remainMs = 0;
    const words = unsolvedWords(puzzle);
    state.lastAnswers = words;
    state.lives -= 1;
    state.missed += 1;
    state.combo = 0;
    state.active = state.active.filter((item) => item.id !== puzzle.id);
    state.revision += 1;
    pushEvent(state, { type: "miss", id: puzzle.id, lives: Math.max(0, state.lives), words });
    if (state.lives <= 0) {
      state.lives = 0;
      endGame(state);
      return;
    }
    releaseExclusive(state, puzzle);
  }

  function endGame(state) {
    if (state.phase === "over") return;
    state.phase = "over";
    pushEvent(state, { type: "over" });
  }

  function updateSpawns(state, dt) {
    if (state.phase === "over" || state.phase === "boss") return;
    if (!state.active.length) {
      fillIfEmpty(state);
      return;
    }
    if (state.phase === "wait-boss" || (!lateGame(state.mode) && finishedCount(state) < 10)) return;
    state.spawnAcc -= dt;
    if (state.spawnAcc > 0) return;
    noteSpawn(state, spawnUpcoming(state));
  }

  function tick(state, dt) {
    if (!state || state.phase === "over" || state.phase === "ready") return;
    if (state.paused && state.mode !== "rank" && state.mode !== "life1" && state.mode !== "dicerank" && state.mode !== "simplerank") return;
    const step = Math.max(0, dt);
    if (likeSimple(state.mode)) {
      state.elapsedMs += step;
      state.simpleRemainMs -= step;
      const current = state.active[0];
      if (current && current.status === "live") {
        current.remainMs -= step;
        if (state.hints) applyTimedReveal(state, current);
      }
      if (state.simpleRemainMs <= 0) {
        state.simpleRemainMs = 0;
        state.lastAnswers = [];
        for (const puzzle of state.active) state.lastAnswers.push.apply(state.lastAnswers, unsolvedWords(puzzle));
        endGame(state);
        return;
      }
      if (current && current.status === "live" && current.remainMs <= 0) expireSimple(state, current);
      if (!state.active.length) spawnSimple(state);
      return;
    }
    state.elapsedMs += step;
    for (const puzzle of state.active) {
      if (puzzle.status === "live") puzzle.remainMs -= step;
    }
    for (const puzzle of state.active.slice()) {
      if (state.phase === "over") break;
      if (puzzle.status === "live" && puzzle.remainMs <= 0) expirePuzzle(state, puzzle);
    }
    if (state.phase === "over") return;
    if (state.hints) {
      for (const puzzle of state.active) {
        applyTimedReveal(state, puzzle);
      }
    }
    updateSpawns(state, step);
  }

  function drainEvents(state) {
    const events = state.events.slice();
    state.events.length = 0;
    return events;
  }

  return {
    RULES,
    prepareDict,
    bossSpec,
    bossMixWeights,
    spawnIntervalMs,
    maxSlotsFor,
    consumeChars,
    shuffleAway,
    hasAlternatePartition,
    forbiddenJoins,
    createGame,
    tick,
    submit,
    pass,
    hammer,
    drainEvents,
    norm,
    wordWeight,
  };
});
