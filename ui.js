(function () {
  "use strict";

  const G = window.AnagramGame;
  const WORDS_KEY = "anagram.words.v1";
  const GENRES_KEY = "anagram.genres.v2";
  const GENRE_IDS = ["mammal", "fish", "food", "pokemon", "proverb"];
  const RANK_GENRES = ["mammal", "fish", "food"];
  const LEVEL_KEY = "anagram.level.v1";
  const LEN_MIN_KEY = "anagram.lenmin.v1";
  const LEN_MAX_KEY = "anagram.lenmax.v1";
  const RANK_KEY = "anagram.rank.v1";
  const LIFE1_RANK_KEY = "anagram.rank.life1.v1";
  const DICE_RANK_KEY = "anagram.rank.dice.v1";
  const SIMPLE_RANK_KEY = "anagram.rank.simple.v1";
  const BEST_KEY = "anagram.best.v1";
  const MUTE_KEY = "anagram.mute.v1";
  const BIRD_KEY = "anagram.bird.v1";
  const BGM_KEY = "anagram.bgm.v1";
  const SE_VOL_KEY = "anagram.se.v1";
  const RANK_URL = "https://anagram-2c857-default-rtdb.asia-southeast1.firebasedatabase.app/ranking.json";
  const LIFE1_RANK_URL = "https://anagram-2c857-default-rtdb.asia-southeast1.firebasedatabase.app/rankingLife1.json";
  const DICE_RANK_URL = "https://anagram-2c857-default-rtdb.asia-southeast1.firebasedatabase.app/rankingDice.json";
  const SIMPLE_RANK_URL = "https://anagram-2c857-default-rtdb.asia-southeast1.firebasedatabase.app/rankingSimple.json";
  const DEFAULT_RANK_NAME = "とくめいきぼう君";
  const RANK_NAME_MAX = 12;
  const GENRE_LABEL = { mammal: "哺乳類", fish: "魚類", food: "料理", pokemon: "ポケモン", proverb: "ことわざ" };
  const RANK_RANGE = [3, 9];
  const $ = (id) => document.getElementById(id);
  function likeSimple(name) {
    const current = name == null ? mode : name;
    return current === "simple" || current === "simplerank";
  }
  function clockLocked(name) {
    const current = name == null ? (state ? state.mode : mode) : name;
    return current === "rank" || current === "life1" || current === "dicerank" || current === "simplerank";
  }
  function oneLife(name) {
    const current = name == null ? (state ? state.mode : mode) : name;
    return current === "life1" || current === "extreme";
  }
  function modeTitle(name) {
    if (name === "dice") return "ダイス";
    if (name === "dicerank") return "ダイス（ランキング）";
    if (name === "simple") return "シングル";
    if (name === "simplerank") return "シングル（ランキング）";
    if (name === "extreme") return "激ムズ";
    if (name === "life1") return "激ムズ（ランキング）";
    if (name === "rank") return "ライフ3（ランキング）";
    return "ライフ3";
  }

  let state = null;
  let mode = "simple";
  let raf = 0;
  let lastTs = 0;
  let drawnRev = -1;
  let ending = false;
  let countToken = 0;
  let composing = false;
  let sentAt = 0;
  let muted = false;
  let birdOff = false;
  let rankOffer = null;
  let nameComposing = false;
  let hammerDrag = null;
  let clearedCount = 0;
  let birdMark = "";
  let birdSpot = null;
  const BGM_FILES = {
    simple: "BGM/\u30b7\u30f3\u30b0\u30eb\u30e2\u30fc\u30c9.mp3",
    dice: "BGM/\u30c0\u30a4\u30b9\u30e2\u30fc\u30c9.mp3",
    life: "BGM/\u30e9\u30a4\u30d53-\u30e9\u30f3\u30ad\u30f3\u30b0\u30e2\u30fc\u30c9.mp3",
    rank: "BGM/\u30e9\u30a4\u30d53-\u30e9\u30f3\u30ad\u30f3\u30b0\u30e2\u30fc\u30c9.mp3",
    after50: "BGM/50\u554f\u5230\u9054\u5f8c\u306b\u6d41\u3059BGM.mp3",
  };
  const BGM_GAIN = 0.42;
  const BIRD_EVERY = "PIC/10\u554f\u3054\u3068\u306b\u51fa\u3059\u9ce5.gif";
  const BIRD_AFTER50 = "PIC/50\u554f\u5230\u9054\u6642\u306b\u51fa\u3059\u9ce5.gif";
  const SE_FILES = {
    correct: "SE/\u6b63\u89e3\u97f3.mp3",
    wrong: "SE/\u4e0d\u6b63\u89e3\u97f3.mp3",
    boss: "SE/\u30dc\u30b9\u51fa\u73fe\u6642.mp3",
    heal: "SE/\u30e9\u30a4\u30d5\u56de\u5fa9\u306e\u97f3.mp3",
    damage: "SE/\u30e9\u30a4\u30d5\u304c\u524a\u308c\u308b\u3068\u304d\u306e\u97f3.mp3",
  };
  let bgmVolume = 0.6;
  let seVolume = 0.8;
  let bgm = null;
  let bgmOn = false;
  let bgmFile = "";
  let audioCtx = null;
  const holds = new Set();

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (err) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (err) { /* private mode */ }
  }
  function storageRemove(key) {
    try { localStorage.removeItem(key); } catch (err) { /* private mode */ }
  }

  function defaultWords() {
    return window.ANAGRAM_DEFAULT_WORDS || "";
  }
  function selectedGenres() {
    const raw = storageGet(GENRES_KEY);
    let ids = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) ids = parsed.filter((id) => GENRE_IDS.indexOf(id) >= 0);
      } catch (err) { /* fall through */ }
    }
    if (!ids || !ids.length) ids = RANK_GENRES.slice();
    return GENRE_IDS.filter((id) => ids.indexOf(id) >= 0);
  }
  function listLengths(text) {
    const found = [];
    const seen = new Set();
    const prepared = G.prepareDict(text || "");
    for (const entry of prepared.dict) {
      const length = entry.chars.length;
      if (seen.has(length)) continue;
      seen.add(length);
      found.push(length);
    }
    found.sort((a, b) => a - b);
    return found;
  }
  function availableLengths() {
    const seen = new Set();
    for (const id of selectedGenres()) {
      for (const length of listLengths(genreSource(id))) seen.add(length);
    }
    for (const length of listLengths(storageGet(WORDS_KEY) || "")) seen.add(length);
    const found = Array.from(seen).sort((a, b) => a - b);
    return found.length ? found : [G.RULES.minChars];
  }
  function nearestLength(choices, value, fallback) {
    const n = Number(value);
    if (choices.indexOf(n) >= 0) return n;
    if (!Number.isInteger(n)) return fallback;
    let best = choices[0];
    let dist = Math.abs(choices[0] - n);
    for (const choice of choices) {
      const gap = Math.abs(choice - n);
      if (gap < dist) {
        best = choice;
        dist = gap;
      }
    }
    return best;
  }
  function selectedLength() {
    const choices = availableLengths();
    const low = choices[0];
    const high = choices[choices.length - 1];
    let min = low;
    let max = high;
    if (storageGet(LEN_MIN_KEY) == null && storageGet(LEN_MAX_KEY) == null) {
      const legacy = storageGet(LEVEL_KEY);
      if (legacy === "easy") max = nearestLength(choices, 6, high);
      else if (legacy === "hard") {
        min = nearestLength(choices, 4, low);
        max = nearestLength(choices, 9, high);
      }
    } else {
      min = nearestLength(choices, storageGet(LEN_MIN_KEY), low);
      max = nearestLength(choices, storageGet(LEN_MAX_KEY), high);
    }
    if (min > max) max = min;
    return [min, max];
  }
  function fillLengthSelect(select, choices, value) {
    select.replaceChildren();
    for (const n of choices) {
      const option = document.createElement("option");
      option.value = String(n);
      option.textContent = n + "文字";
      select.appendChild(option);
    }
    select.value = String(value);
  }
  function saveLength(min, max) {
    if (min > max) max = min;
    storageSet(LEN_MIN_KEY, String(min));
    storageSet(LEN_MAX_KEY, String(max));
  }
  function genreSource(id) {
    const genres = window.ANAGRAM_GENRES || {};
    return genres[id] || "";
  }
  function playItems(forRank, mode) {
    const fixed = forRank || mode === "life1" || mode === "dicerank" || mode === "simplerank";
    const ids = fixed ? RANK_GENRES : selectedGenres();
    const range = fixed ? RANK_RANGE : selectedLength();
    const items = [];
    const pushLines = (text, genre) => {
      for (const line of String(text || "").split(/\r?\n/)) {
        const word = line.trim();
        if (!word || word.startsWith("#")) continue;
        const length = Array.from(word).length;
        if (length < range[0] || length > range[1]) continue;
        items.push({ text: word, genre: genre });
      }
    };
    for (const id of ids) pushLines(genreSource(id), id);
    if (!fixed) pushLines(storageGet(WORDS_KEY) || "", "");
    return items;
  }
  function loadBest() {
    try {
      const parsed = JSON.parse(storageGet(BEST_KEY) || "{}");
      return {
        simple: Number(parsed.simple) || 0,
        dice: Number(parsed.dice) || 0,
        life: Number(parsed.life) || 0,
        life1: Number(parsed.life1) || 0,
        extreme: Number(parsed.extreme) || 0,
        rank: Number(parsed.rank) || 0,
        dicerank: Number(parsed.dicerank) || 0,
        simplerank: Number(parsed.simplerank) || 0,
      };
    } catch (err) {
      return { simple: 0, dice: 0, life: 0, life1: 0, extreme: 0, rank: 0, dicerank: 0, simplerank: 0 };
    }
  }
  function saveBest(best) {
    storageSet(BEST_KEY, JSON.stringify(best));
  }

  function show(name) {
    for (const id of ["title", "help", "tips", "words", "play", "result"]) {
      $("screen-" + id).hidden = id !== name;
    }
  }

  let revealTimer = 0;
  let milestoneTimer = 0;

  function toast(text) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    $("toasts").appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  function showMilestone(text) {
    const el = $("milestone");
    el.textContent = text;
    el.hidden = false;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(milestoneTimer);
    milestoneTimer = setTimeout(() => { el.hidden = true; }, 2400);
  }

  function showReveal(words, label) {
    if (!words || !words.length) return;
    const el = $("reveal");
    el.textContent = (label || "時間切れ") + "　" + words.join("　");
    el.hidden = false;
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => { el.hidden = true; }, 3600);
  }

  function syncViewport() {
    const viewport = window.visualViewport;
    const height = viewport ? viewport.height : window.innerHeight;
    const offset = viewport ? viewport.offsetTop : 0;
    document.documentElement.style.setProperty("--app-h", height + "px");
    document.getElementById("app").style.transform = offset ? "translateY(" + offset + "px)" : "";
  }

  function updateSoundLabel() {
    $("mute-play").textContent = muted ? "音オフ" : "音オン";
  }

  function updateBirdLabel() {
    const button = $("toggle-bird");
    button.textContent = birdOff ? "鳥オフ" : "鳥オン";
    button.setAttribute("aria-pressed", birdOff ? "false" : "true");
  }

  function updateBests() {
    const best = loadBest();
    $("best-simple").textContent = best.simple ? "BEST " + best.simple : "BEST —";
    $("best-dice").textContent = best.dice ? "BEST " + best.dice : "BEST —";
    $("best-life").textContent = best.life ? "BEST " + best.life.toLocaleString("ja-JP") : "BEST —";
    $("best-extreme").textContent = best.extreme ? "BEST " + best.extreme.toLocaleString("ja-JP") : "BEST —";
  }

  function cleanRankName(raw) {
    if (typeof raw !== "string") return DEFAULT_RANK_NAME;
    const text = raw.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").trim();
    const name = Array.from(text).slice(0, RANK_NAME_MAX).join("").trim();
    return name || DEFAULT_RANK_NAME;
  }
  function rankEntry(raw) {
    if (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0) return { score: raw, name: DEFAULT_RANK_NAME };
    if (!raw || typeof raw !== "object") return null;
    const score = Number(raw.score);
    if (!Number.isSafeInteger(score) || score < 0) return null;
    return { score, name: cleanRankName(raw.name) };
  }
  function rankEntries(list) {
    if (!Array.isArray(list)) return [];
    return list.map(rankEntry).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 10);
  }
  function placeRank(entries, entry) {
    const higher = entries.filter((item) => item.score > entry.score);
    const rest = entries.filter((item) => item.score <= entry.score);
    return higher.concat([entry], rest).slice(0, 10);
  }
  function entersRank(entries, score) {
    return entries.length < 10 || score >= entries[entries.length - 1].score;
  }
  function rankStore(board) {
    if (board === "life1") {
      return { url: LIFE1_RANK_URL, key: LIFE1_RANK_KEY, label: "激ムズ（ランキング）", list: "title-life1-rank", note: "life1-rank-note", best: "best-life1" };
    }
    if (board === "dicerank") {
      return { url: DICE_RANK_URL, key: DICE_RANK_KEY, label: "ダイス（ランキング）", list: "title-dice-rank", note: "dice-rank-note", best: "best-dicerank" };
    }
    if (board === "simplerank") {
      return { url: SIMPLE_RANK_URL, key: SIMPLE_RANK_KEY, label: "シングル（ランキング）", list: "title-simple-rank", note: "simple-rank-note", best: "best-simplerank" };
    }
    return { url: RANK_URL, key: RANK_KEY, label: "ライフ3（ランキング）", list: "title-rank", note: "rank-note", best: "best-rank" };
  }
  function loadLocalRank(board) {
    try {
      return rankEntries(JSON.parse(storageGet(rankStore(board).key) || "[]"));
    } catch (err) {
      return [];
    }
  }
  function rememberLocalRank(entry, board) {
    const top = placeRank(loadLocalRank(board), entry);
    storageSet(rankStore(board).key, JSON.stringify(top));
    return top;
  }
  function renderRank(listId, noteId, scores, shared) {
    const list = $(listId);
    const entries = rankEntries(scores);
    list.replaceChildren();
    for (let i = 0; i < entries.length; i += 1) {
      const item = document.createElement("li");
      const place = document.createElement("span");
      place.className = "place";
      place.textContent = (i + 1) + "位";
      const who = document.createElement("span");
      who.className = "who";
      who.textContent = entries[i].name;
      const points = document.createElement("span");
      points.className = "points num";
      points.textContent = entries[i].score.toLocaleString("ja-JP");
      item.append(place, who, points);
      list.appendChild(item);
    }
    $(noteId).textContent = entries.length
      ? (shared ? "みんなのスコア" : "この端末だけのスコア")
      : (shared ? "ランキングは、まだ空です" : "まだスコアがありません");
  }
  function boardFromFirebase(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return [];
    return rankEntries(Object.keys(data).map((key) => data[key]));
  }
  function loadSharedRank(board) {
    return fetch(rankStore(board).url).then((res) => {
      if (!res.ok) throw new Error("rank");
      return res.json();
    }).then(boardFromFirebase);
  }
  function refreshRankBoard() {
    ["simplerank", "dicerank", "rank", "life1"].forEach((board) => {
      const store = rankStore(board);
      loadSharedRank(board).then((scores) => {
        renderRank(store.list, store.note, scores, true);
        const best = $(store.best);
        if (best) best.textContent = scores.length ? "TOP " + scores[0].score.toLocaleString("ja-JP") : "TOP —";
      }).catch(() => {
        renderRank(store.list, store.note, loadLocalRank(board), false);
      });
    });
  }
  function publishRank(entry, board) {
    const local = rememberLocalRank(entry, board);
    renderRank("result-rank-list", "result-rank-note", local, false);
    return fetch(rankStore(board).url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ score: entry.score, name: entry.name }),
    }).then((res) => {
      if (!res.ok) throw new Error("rank");
      return loadSharedRank(board);
    }).then((scores) => {
      renderRank("result-rank-list", "result-rank-note", scores, true);
      refreshRankBoard();
    }).catch(() => {
      renderRank("result-rank-list", "result-rank-note", local, false);
    });
  }
  function commitRankName(raw) {
    if (!rankOffer || rankOffer.saved) return;
    rankOffer.saved = true;
    $("rank-name-form").hidden = true;
    publishRank({ score: rankOffer.score, name: cleanRankName(raw) }, rankOffer.board);
  }
  function declineRank() {
    if (!rankOffer || rankOffer.saved) return;
    rankOffer.saved = true;
    $("rank-name-form").hidden = true;
  }
  function offerRankName(score, board) {
    rankOffer = { score, saved: false, board: board || "rank" };
    $("rank-name-form").hidden = true;
    $("rank-name").value = "";
    $("result-rank-label").textContent = rankStore(rankOffer.board).label;
    const decide = (scores, shared) => {
      if (!rankOffer || rankOffer.score !== score || rankOffer.saved) return;
      renderRank("result-rank-list", "result-rank-note", scores, shared);
      if (!entersRank(rankEntries(scores), score)) {
        rankOffer.saved = true;
        return;
      }
      $("rank-name-form").hidden = false;
      $("rank-name").focus();
    };
    loadSharedRank(rankOffer.board).then((scores) => decide(scores, true)).catch(() => decide(loadLocalRank(rankOffer.board), false));
  }

  function refreshTitle() {
    const genres = selectedGenres();
    const lengths = availableLengths();
    const range = selectedLength();
    fillLengthSelect($("len-min"), lengths, range[0]);
    fillLengthSelect($("len-max"), lengths, range[1]);
    for (const button of document.querySelectorAll("[data-genre]")) {
      const on = genres.indexOf(button.dataset.genre) >= 0;
      button.classList.toggle("on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    }
    const prepared = G.prepareDict(playItems(false));
    const custom = storageGet(WORDS_KEY);
    const customCount = custom ? G.prepareDict(playItems(false).filter((item) => !item.genre)).dict.length : 0;
    const genreLabel = genres.map((id) => GENRE_LABEL[id]).join("・");
    const lengthLabel = range[0] === range[1] ? range[0] + "文字" : range[0] + "〜" + range[1] + "文字";
    $("word-line").textContent = lengthLabel + "　" + genreLabel + " " + prepared.dict.length + "語" + (customCount ? "（登録 " + customCount + "）" : "");
    $("life-note").hidden = prepared.dict.length >= 4;
    $("start-simple").disabled = prepared.dict.length < 1;
    $("start-dice").disabled = G.prepareDict(playItems(false, "dice")).dict.length < 1;
    $("start-life").disabled = prepared.dict.length < 1;
    $("start-extreme").disabled = prepared.dict.length < 1;
    const ranked = G.prepareDict(playItems(true));
    $("start-simplerank").disabled = ranked.dict.length < 1;
    $("start-dicerank").disabled = ranked.dict.length < 1;
    $("start-rank").disabled = ranked.dict.length < 1;
    $("start-life1").disabled = ranked.dict.length < 1;
    updateBests();
    updateSoundLabel();
    updateBirdLabel();
    refreshRankBoard();
  }

  function updateWordStat() {
    const prepared = G.prepareDict($("word-text").value);
    const empty = !$("word-text").value.trim();
    $("word-stat").textContent = prepared.dict.length
      ? "使える単語 " + prepared.dict.length + "語" + (prepared.skipped ? "（" + prepared.skipped + "行は使えません）" : "")
      : (empty ? "空のまま登録すると、登録単語を外します" : "2文字以上で、並べ替えできる単語を1行に1語入れてください");
    $("save-words").disabled = !empty && prepared.dict.length < 1;
  }

  function ctx() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function readVolume(key, fallbackPercent) {
    const raw = storageGet(key);
    if (raw == null) return fallbackPercent / 100;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallbackPercent / 100;
    return Math.max(0, Math.min(100, Math.round(n))) / 100;
  }

  function tone(freq, dur, type, when, gain) {
    if (muted || seVolume <= 0) return;
    const ac = ctx();
    if (!ac) return;
    const start = ac.currentTime + (when || 0);
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime((gain || 0.035) * seVolume, start);
    amp.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(amp);
    amp.connect(ac.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  function playSe(kind) {
    if (muted || seVolume <= 0) return;
    const audio = new Audio(encodeURI(SE_FILES[kind]));
    audio.volume = seVolume;
    audio.play().catch(function () {});
  }

  function ensureBgm(file) {
    if (bgm && bgmFile === file) return bgm;
    if (bgm) {
      bgm.pause();
      bgm.removeAttribute("src");
      bgm.load();
    }
    bgmFile = file;
    const audio = new Audio(encodeURI(file));
    audio.loop = true;
    audio.preload = "auto";
    audio.addEventListener("ended", () => {
      if (!bgmOn || bgm !== audio) return;
      audio.loop = true;
      audio.currentTime = 0;
      audio.play().catch(function () {});
    });
    bgm = audio;
    return bgm;
  }

  function trackForState() {
    const reached = state ? Math.max(0, state.nextNumber - 1) : 0;
    const current = state ? state.mode : mode;
    if (current === "dice" || current === "dicerank") return BGM_FILES.dice;
    if (current === "life1" || current === "extreme") return BGM_FILES.after50;
    if (likeSimple(current)) return BGM_FILES.simple;
    if (reached >= 50) return BGM_FILES.after50;
    return BGM_FILES[current] || BGM_FILES.life;
  }

  function applyBgm() {
    if (!bgmOn) {
      if (bgm) bgm.pause();
      return;
    }
    const audio = ensureBgm(trackForState());
    audio.loop = true;
    const level = muted ? 0 : Math.min(BGM_GAIN, bgmVolume * BGM_GAIN);
    audio.volume = level;
    if (level <= 0) {
      audio.pause();
      return;
    }
    if (audio.ended) audio.currentTime = 0;
    if (audio.paused) audio.play().catch(function () {});
  }

  function syncBgm() {
    if (!bgmOn) return;
    const file = trackForState();
    if (bgm && bgmFile === file && !bgm.paused && !bgm.ended) return;
    applyBgm();
  }

  function syncVolumeControls() {
    const bgmPercent = Math.round(bgmVolume * 100);
    const sePercent = Math.round(seVolume * 100);
    $("bgm-volume").value = String(bgmPercent);
    $("se-volume").value = String(sePercent);
    $("bgm-volume-label").textContent = String(bgmPercent);
    $("se-volume-label").textContent = String(sePercent);
  }

  function setBgmVolume(percent) {
    bgmVolume = Math.max(0, Math.min(100, percent)) / 100;
    storageSet(BGM_KEY, String(Math.round(bgmVolume * 100)));
    $("bgm-volume-label").textContent = String(Math.round(bgmVolume * 100));
    applyBgm();
  }

  function setSeVolume(percent) {
    seVolume = Math.max(0, Math.min(100, percent)) / 100;
    storageSet(SE_VOL_KEY, String(Math.round(seVolume * 100)));
    $("se-volume-label").textContent = String(Math.round(seVolume * 100));
  }

  function placeHammerHome() {
    const el = $("hammer");
    el.classList.remove("dragging");
    el.style.left = "";
    el.style.top = "";
  }

  function syncHammer() {
    const el = $("hammer");
    const show = !!(state && state.hammersLeft > 0 && state.phase !== "over");
    if (!show && !hammerDrag) {
      el.hidden = true;
      placeHammerHome();
      return;
    }
    if (show) el.hidden = false;
  }

  function buzz(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  function setHold(name, on) {
    if (on) holds.add(name);
    else holds.delete(name);
    if (state) state.paused = clockLocked(state.mode) ? false : holds.size > 0;
  }

  function shake(el) {
    if (!el) return;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }

  function flash(kind) {
    const el = $("flash");
    el.className = "flash";
    void el.offsetWidth;
    el.classList.add(kind);
  }

  function floatText(text) {
    const el = document.createElement("span");
    el.className = "pop num";
    el.textContent = text;
    $("hud-score").appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  function formatClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return minutes + ":" + String(seconds).padStart(2, "0");
  }

  function cardElement(puzzle, layout) {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = String(puzzle.id);
    if (puzzle.boss) card.classList.add("boss");
    card.dataset.slot = String(puzzle.slot);
    if (layout === "single" && !likeSimple(state.mode)) card.classList.add("span");
    if (puzzle.pool.length >= 12) card.classList.add("tight");
    if (puzzle.pool.length >= 18) card.classList.add("tighter");

    const head = document.createElement("header");
    const q = document.createElement("span");
    q.textContent = "Q" + puzzle.number;
    head.appendChild(q);
    if (puzzle.boss) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "BOSS";
      head.appendChild(badge);
    }
    if (puzzle.parts.some((part) => part.ambiguous && !part.revealedByTime)) {
      const note = document.createElement("span");
      note.className = "badge";
      note.textContent = "別解";
      head.appendChild(note);
    }
    const time = document.createElement("span");
    time.className = "time num";
    head.appendChild(time);
    card.appendChild(head);

    const useDice = state.mode === "dice" || state.mode === "dicerank";
    const tag = genreTag(puzzle);
    if (useDice) appendDice(card, puzzle, tag);
    const tiles = document.createElement("div");
    tiles.className = "tiles";
    if (!useDice) puzzle.pool.forEach((ch, index) => {
      const tile = document.createElement("span");
      tile.className = "tile";
      tile.textContent = ch;
      tile.style.animationDelay = Math.min(index, 8) * 8 + "ms";
      tiles.appendChild(tile);
    });
    if (!useDice && tag) tiles.appendChild(tag);
    if (!useDice) card.appendChild(tiles);

    if (puzzle.boss) {
      const note = document.createElement("p");
      note.className = "boss-note";
      note.textContent = "一単語ずつ解答しよう！";
      card.appendChild(note);
      const list = document.createElement("ul");
      list.className = "lengths";
      for (const part of puzzle.parts) {
        const item = document.createElement("li");
        if (part.solved) {
          item.className = "done";
          item.textContent = part.word;
        } else if (part.shown) {
          appendHintMarks(item, part);
          item.appendChild(document.createTextNode(part.chars.length + "文字"));
        } else {
          item.textContent = part.chars.length + "文字";
        }
        list.appendChild(item);
      }
      card.appendChild(list);
    } else if (puzzle.parts[0].shown) {
      const hint = document.createElement("p");
      hint.className = "first-letter";
      hint.appendChild(document.createTextNode(puzzle.parts[0].ambiguous && !puzzle.parts[0].revealedByTime ? "別解" : "先頭"));
      appendHintMarks(hint, puzzle.parts[0]);
      card.appendChild(hint);
    }

    const bar = document.createElement("div");
    bar.className = "bar";
    bar.appendChild(document.createElement("span"));
    card.appendChild(bar);
    return card;
  }

  function genreTag(puzzle) {
    const names = [];
    for (const part of puzzle.parts) {
      if (part.solved || !part.genre) continue;
      const label = GENRE_LABEL[part.genre];
      if (label && names.indexOf(label) < 0) names.push(label);
    }
    if (!names.length) return null;
    const tag = document.createElement("p");
    tag.className = "genre-tag";
    tag.textContent = names.join("・");
    return tag;
  }

  function splitDice(chars) {
    const list = chars.slice();
    const count = Math.max(1, Math.ceil(list.length / 6));
    const base = Math.floor(list.length / count);
    let extra = list.length % count;
    const groups = [];
    let index = 0;
    for (let die = 0; die < count; die += 1) {
      const take = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
      const faces = [];
      for (let face = 0; face < 6; face += 1) faces.push(face < take ? list[index++] : "");
      groups.push(faces);
    }
    return groups;
  }

  function appendDice(parent, puzzle, tag) {
    const groups = splitDice(puzzle.pool);
    const scene = document.createElement("div");
    scene.className = "dice-scene count-" + groups.length;
    const row = document.createElement("div");
    row.className = "dice-row";
    const spin = ["a", "b", "c", "d", "e"][(puzzle.number - 1) % 5];
    const laps = spin === "d" ? 3 : 2;
    for (const faces of groups) {
      const slot = document.createElement("div");
      slot.className = "die-slot";
      const die = document.createElement("div");
      die.className = "dice spin-" + spin;
      die.style.animationDuration = (puzzle.totalMs / (laps * 1000)) + "s";
      for (const ch of faces) {
        const face = document.createElement("span");
        if (!ch) face.classList.add("blank");
        face.textContent = ch;
        die.appendChild(face);
      }
      slot.appendChild(die);
      row.appendChild(slot);
    }
    scene.appendChild(row);
    if (tag) scene.appendChild(tag);
    parent.appendChild(scene);
  }

  function appendHintMarks(parent, part) {
    const count = Math.min(part.shown || 0, part.chars.length);
    for (let i = 0; i < count; i += 1) {
      const mark = document.createElement("b");
      mark.textContent = part.chars[i];
      parent.appendChild(mark);
    }
  }

  function boardLayout(puzzles) {
    if (likeSimple(state.mode) || puzzles.some((puzzle) => puzzle.exclusive)) return "single";
    const cap = G.maxSlotsFor(state);
    if (cap <= 1) return "single";
    if (cap === 2) return "pair";
    if (cap === 3) return "pyramid";
    return "grid";
  }

  function renderBoard() {
    const board = $("board");
    const spins = new Map();
    for (const die of board.querySelectorAll(".dice")) {
      const card = die.closest(".card");
      const anim = die.getAnimations()[0];
      if (card && anim) spins.set(card.dataset.id, anim.currentTime);
    }
    const puzzles = state.active.slice().sort((a, b) => a.slot - b.slot);
    const layout = boardLayout(puzzles);
    board.className = "board " + layout;
    board.replaceChildren();
    for (const puzzle of puzzles) board.appendChild(cardElement(puzzle, layout));
    for (const die of board.querySelectorAll(".dice")) {
      const card = die.closest(".card");
      const time = card && spins.get(card.dataset.id);
      const anim = die.getAnimations()[0];
      if (anim && time != null) anim.currentTime = time;
    }
  }

  function paintBar(card, ratio) {
    const bar = card.querySelector(".bar > span");
    if (!bar) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    bar.style.transform = "scaleX(" + clamped + ")";
    bar.style.background = clamped > 0.5 ? "#3ef0ff" : clamped > 0.25 ? "#ffc14a" : "#ff2d8a";
    card.classList.toggle("urgent", clamped <= 0.25 && clamped > 0);
  }

  function renderTimers() {
    if (!state) return;
    if (likeSimple(state.mode)) {
      const puzzle = state.active[0];
      const card = puzzle && $("board").querySelector('[data-id="' + puzzle.id + '"]');
      if (puzzle && card) {
        const bar = card.querySelector(".bar");
        if (bar) bar.hidden = false;
        paintBar(card, puzzle.remainMs / puzzle.totalMs);
        card.querySelector(".time").textContent = Math.max(0, puzzle.remainMs / 1000).toFixed(1);
      }
      return;
    }
    for (const puzzle of state.active) {
      const card = $("board").querySelector('[data-id="' + puzzle.id + '"]');
      if (!card) continue;
      const ratio = puzzle.remainMs / puzzle.totalMs;
      paintBar(card, ratio);
      card.querySelector(".time").textContent = Math.max(0, puzzle.remainMs / 1000).toFixed(1);
    }
  }

  function shownBox(el) {
    if (!el || el.hidden || el.closest("[hidden]")) return null;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return null;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    return rect;
  }
  function boxesOverlap(a, b, gap) {
    return a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
  }
  function birdObstacles() {
    const boxes = [];
    const nodes = $("screen-play").querySelectorAll("button, input, #hud-score, #hud-sub, #clock, #hearts, #reveal, #banner, #milestone, #quitbar, .hud-links, .card header, .tile, .dice, .genre-tag, .lengths, .boss-note, .badge, .time, .first-letter, .bar");
    for (const node of nodes) {
      if (node.id === "mascot") continue;
      const box = shownBox(node);
      if (box) boxes.push(box);
    }
    return boxes;
  }
  function birdRect(el, host) {
    if (!el.style.left || !el.style.top) return null;
    const hostRect = host.getBoundingClientRect();
    const left = hostRect.left + parseFloat(el.style.left);
    const top = hostRect.top + parseFloat(el.style.top);
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    if (!width || !height) return null;
    return { left, top, right: left + width, bottom: top + height };
  }
  function placeBird(forceNew) {
    const el = $("mascot");
    const host = $("screen-play");
    const hostRect = host.getBoundingClientRect();
    const obstacles = birdObstacles();
    const gap = 8;
    const current = birdRect(el, host);
    if (!forceNew && current && !obstacles.some((box) => boxesOverlap(current, box, gap))) return;
    const spots = [];
    let chosenScale = 0;
    for (let scale = 1; scale >= 0.5; scale -= 0.1) {
      const width = 104 * scale;
      const height = 78 * scale;
      const found = [];
      for (let y = hostRect.top + 4; y + height <= hostRect.bottom - 4; y += 14) {
        for (let x = hostRect.left + 4; x + width <= hostRect.right - 4; x += 14) {
          const rect = { left: x, top: y, right: x + width, bottom: y + height };
          if (obstacles.some((box) => boxesOverlap(rect, box, gap))) continue;
          found.push({ x: x - hostRect.left, y: y - hostRect.top, scale: scale });
        }
      }
      if (!found.length) continue;
      spots.push.apply(spots, found);
      break;
    }
    if (!spots.length) {
      if (!current || obstacles.some((box) => boxesOverlap(current, box, gap))) el.hidden = true;
      return;
    }
    let pool = spots;
    if (forceNew && birdSpot && spots.length > 1) {
      const away = spots.filter((spot) => Math.abs(spot.x - birdSpot.x) > 48 || Math.abs(spot.y - birdSpot.y) > 48);
      if (away.length) pool = away;
    }
    const spot = pool[Math.floor(Math.random() * pool.length)];
    birdSpot = spot;
    el.style.left = spot.x + "px";
    el.style.top = spot.y + "px";
    el.style.width = (104 * spot.scale) + "px";
    el.style.height = (78 * spot.scale) + "px";
  }
  function syncMascot() {
    const el = $("mascot");
    if (birdOff || !state || state.phase === "over") {
      el.hidden = true;
      return;
    }
    const reached = Math.max(0, state.nextNumber - 1);
    const file = reached >= 50 ? BIRD_AFTER50 : clearedCount >= 10 ? BIRD_EVERY : "";
    if (!file) {
      el.hidden = true;
      birdMark = "";
      birdSpot = null;
      return;
    }
    if (el.dataset.file !== file) {
      el.dataset.file = file;
      el.src = encodeURI(file);
      el.style.objectViewBox = file === BIRD_AFTER50 ? "xywh(6% 33% 83% 67%)" : "xywh(9% 8% 79% 92%)";
    }
    el.hidden = false;
    const mark = file + ":" + (reached >= 50 ? Math.floor(reached / 10) : Math.floor(clearedCount / 10));
    const fresh = mark !== birdMark;
    placeBird(fresh);
    if (!fresh) return;
    birdMark = mark;
    el.classList.remove("hop");
    void el.offsetWidth;
    el.classList.add("hop");
  }

  function renderHud() {
    if (!state) {
      document.documentElement.classList.remove("is-paused");
      return;
    }
    document.documentElement.classList.toggle("is-paused", !!state.paused);
    if (likeSimple(state.mode)) {
      $("hud-score-value").textContent = String(state.score);
      $("clock").textContent = (Math.max(0, state.simpleRemainMs) / 1000).toFixed(1);
      const combo = clockLocked(state.mode) || state.combo < 2 ? "" : "  " + state.combo + "連続";
      $("hud-sub").textContent = (state.passesLeft ? "パス1" : "パス済") + combo;
      $("pass").disabled = state.passesLeft <= 0;
    } else {
      $("hud-score-value").textContent = state.score.toLocaleString("ja-JP");
      const hearts = $("hearts").children;
      const heartCap = oneLife(state.mode) ? 1 : 3;
      for (let i = 0; i < hearts.length; i += 1) {
        hearts[i].hidden = i >= heartCap;
        hearts[i].classList.toggle("on", i < state.lives);
      }
      const combo = clockLocked(state.mode) || state.combo < 2 ? "" : "  " + state.combo + "連続";
      $("hud-sub").textContent = "Q" + Math.max(1, state.nextNumber - 1) + combo;
    }
    $("banner").hidden = state.phase !== "wait-boss";
    syncHammer();
    syncMascot();
    renderTimers();
  }

  function handleEvent(ev) {
    if (ev.type === "correct") {
      if (ev.cleared) clearedCount += 1;
      flash("ok");
      playSe("correct");
      buzz(12);
      if (state && !likeSimple(state.mode)) floatText("+" + ev.points.toLocaleString("ja-JP"));
    } else if (ev.type === "bonus") {
      floatText("+" + ev.points.toLocaleString("ja-JP"));
      tone(988, 0.08, "square", 0, 0.03);
    } else if (ev.type === "wrong") {
      shake($("dock"));
      playSe("wrong");
      buzz(16);
    } else if (ev.type === "heal") {
      toast("ライフが戻った");
      playSe("heal");
    } else if (ev.type === "miss") {
      flash("bad");
      if (state && !likeSimple(state.mode)) playSe("damage");
      else {
        tone(220, 0.08, "square", 0, 0.03);
        tone(130, 0.12, "square", 0.08, 0.03);
      }
      buzz([20, 30, 30]);
    } else if (ev.type === "hint") {
      tone(520, 0.05, "triangle", 0, 0.02);
    } else if (ev.type === "pass") {
      toast("パス");
    } else if (ev.type === "pass-denied") {
      toast("パスは1回だけです");
      shake($("pass"));
    } else if (ev.type === "hammer") {
      showReveal(ev.words, "答え");
    } else if (ev.type === "spawn") {
      if (ev.boss) playSe("boss");
      if (ev.number === 50) showMilestone("50問到達！");
    }
  }

  function pump() {
    if (!state) return;
    const events = G.drainEvents(state);
    const missed = [];
    for (const ev of events) {
      if (ev.type === "miss" && ev.words) missed.push.apply(missed, ev.words);
      handleEvent(ev);
    }
    if (missed.length) showReveal(missed);
    syncBgm();
    if (state.revision !== drawnRev) {
      renderBoard();
      drawnRev = state.revision;
    }
    renderHud();
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!state) return;
    const gap = lastTs ? Math.max(0, ts - lastTs) : 0;
    lastTs = ts;
    if (clockLocked(state.mode)) {
      let left = gap;
      while (left > 0 && state.phase !== "over") {
        const step = Math.min(100, left);
        G.tick(state, step);
        left -= step;
      }
    } else if (!state.paused) {
      G.tick(state, Math.min(250, gap));
    }
    pump();
    if (state.phase === "over" && !ending) {
      ending = true;
      cancelAnimationFrame(raf);
      setTimeout(showResult, 380);
    }
  }

  function showResult() {
    if (!state) return;
    const best = loadBest();
    const value = state.score;
    const previous = best[state.mode] || 0;
    const isNew = value > previous;
    if (isNew) {
      best[state.mode] = value;
      saveBest(best);
      tone(523, 0.06, "square", 0, 0.03);
      tone(659, 0.06, "square", 0.07, 0.03);
      tone(784, 0.06, "square", 0.14, 0.03);
      tone(1046, 0.12, "square", 0.21, 0.03);
    }
    const modeLabel = modeTitle(state.mode) + (likeSimple(state.mode) ? " 120秒" : "");
    $("result-mode").textContent = modeLabel;
    $("result-score").textContent = likeSimple(state.mode) ? String(value) : value.toLocaleString("ja-JP");
    $("result-unit").textContent = likeSimple(state.mode) ? "正解" : "スコア";
    const answer = $("result-answer");
    if (state.lastAnswers && state.lastAnswers.length) {
      answer.hidden = false;
      answer.textContent = "答え　" + state.lastAnswers.join("　");
    } else {
      answer.hidden = true;
      answer.textContent = "";
    }
    const bestLabel = likeSimple(state.mode) ? String(previous) : previous.toLocaleString("ja-JP");
    $("result-record").textContent = isNew ? "最高記録" : (previous ? "最高 " + bestLabel : "最高 —");
    const stats = $("result-stats");
    stats.replaceChildren();
    document.documentElement.classList.remove("is-paused");
    const lines = likeSimple(state.mode)
      ? ["最大連続 " + state.maxCombo, state.passesLeft ? "パスは未使用" : "パスは使用済み"]
      : state.mode === "rank"
        ? [
            "生存 " + formatClock(state.elapsedMs),
            "正解 " + state.correct + "語",
            "ミス " + state.missed,
            "到達 Q" + Math.max(1, state.nextNumber - 1),
          ]
        : [
            "生存 " + formatClock(state.elapsedMs),
            "正解 " + state.correct + "語",
            "ミス " + state.missed,
            "最大連続 " + state.maxCombo,
            "到達 Q" + Math.max(1, state.nextNumber - 1),
          ];
    for (const line of lines) {
      const item = document.createElement("li");
      item.textContent = line;
      stats.appendChild(item);
    }
    $("result-rank").hidden = !clockLocked(state.mode);
    if (clockLocked(state.mode)) offerRankName(value, state.mode);
    else rankOffer = null;
    show("result");
    bgmOn = false;
    applyBgm();
    refreshTitle();
  }

  function resetPlayChrome() {
    ending = false;
    holds.clear();
    $("quitbar").hidden = true;
    $("banner").hidden = true;
    $("milestone").hidden = true;
    clearTimeout(milestoneTimer);
    $("flash").className = "flash";
    $("board").replaceChildren();
    $("answer").value = "";
    $("reveal").hidden = true;
    clearTimeout(revealTimer);
    $("hud-score-value").textContent = "0";
    $("hud-sub").textContent = likeSimple() ? "パス1" : "Q1";
    $("clock").hidden = !likeSimple();
    $("hearts").hidden = likeSimple();
    $("clock").textContent = "120.0";
    hammerDrag = null;
    placeHammerHome();
    $("hammer").hidden = true;
    $("pass").hidden = !likeSimple();
    $("pass").disabled = false;
    $("pass").textContent = "パス";
    const heartCap = oneLife(mode) ? 1 : 3;
    const hearts = $("hearts").children;
    for (let i = 0; i < hearts.length; i += 1) {
      hearts[i].hidden = i >= heartCap;
      hearts[i].classList.toggle("on", i < heartCap);
    }
    $("answer").placeholder = "ひらがな・カタカナ";
    $("count-label").textContent = modeTitle(mode);
    clearedCount = 0;
    birdMark = "";
    birdSpot = null;
    const mascot = $("mascot");
    mascot.hidden = true;
    mascot.classList.remove("hop");
    delete mascot.dataset.file;
  }

  function begin(token) {
    if (token !== countToken) return;
    $("countdown").hidden = true;
    $("answer").value = "";
    state = G.createGame(playItems(mode === "rank", mode), mode, Date.now() % 1000000000);
    if (!state.dict.length) {
      state = null;
      bgmOn = false;
      applyBgm();
      toast("この条件の単語がありません");
      show("title");
      return;
    }
    drawnRev = -1;
    lastTs = 0;
    const helpOpen = holds.has("help");
    holds.clear();
    if (helpOpen) holds.add("help");
    state.paused = clockLocked(state.mode) ? false : holds.size > 0;
    cancelAnimationFrame(raf);
    pump();
    raf = requestAnimationFrame(frame);
    $("answer").focus();
  }

  function startMode(nextMode, immediate) {
    const prepared = G.prepareDict(playItems(nextMode === "rank", nextMode));
    if (!prepared.dict.length) {
      toast("この条件の単語がありません");
      return;
    }
    mode = nextMode;
    bgmOn = true;
    applyBgm();
    const token = ++countToken;
    cancelAnimationFrame(raf);
    state = null;
    resetPlayChrome();
    show("play");
    $("answer").focus();
    ctx();
    if (immediate) {
      begin(token);
      return;
    }
    $("countdown").hidden = false;
    $("count-num").textContent = "3";
    const steps = ["3", "2", "1", "スタート"];
    let index = 0;
    const beat = () => {
      if (token !== countToken) return;
      if (holds.has("help") || holds.has("tips")) {
        setTimeout(beat, 200);
        return;
      }
      $("count-num").textContent = steps[index];
      tone(440 + index * 80, 0.04, "square", 0, 0.02);
      index += 1;
      if (index < steps.length) setTimeout(beat, 420);
      else setTimeout(() => begin(token), 260);
    };
    beat();
  }

  function onAnswer() {
    const now = performance.now();
    if (now - sentAt < 40) return;
    if (!state || state.phase === "over" || state.paused) return;
    sentAt = now;
    const value = $("answer").value;
    $("answer").value = "";
    if (!G.norm(value)) {
      if (likeSimple(state.mode)) G.pass(state);
      else shake($("dock"));
      pump();
      $("answer").focus();
      return;
    }
    G.submit(state, value);
    pump();
    if (state.phase === "over" && !ending) {
      ending = true;
      cancelAnimationFrame(raf);
      setTimeout(showResult, 380);
    }
    $("answer").focus();
  }

  function abandon() {
    countToken += 1;
    cancelAnimationFrame(raf);
    ending = false;
    state = null;
    holds.clear();
    $("quitbar").hidden = true;
    $("countdown").hidden = true;
    bgmOn = false;
    applyBgm();
    show("title");
    refreshTitle();
  }

  function openWords() {
    $("word-text").value = storageGet(WORDS_KEY) || "";
    updateWordStat();
    show("words");
  }

  function saveWords() {
    const text = $("word-text").value;
    if (!text.trim()) {
      storageRemove(WORDS_KEY);
      toast("登録単語を外しました");
    } else if (!G.prepareDict(text).dict.length) {
      toast("2文字以上の単語を入れてください");
      return;
    } else {
      storageSet(WORDS_KEY, text);
      toast("登録しました");
    }
    show("title");
    refreshTitle();
  }

  function toggleBird() {
    birdOff = !birdOff;
    storageSet(BIRD_KEY, birdOff ? "0" : "1");
    updateBirdLabel();
    if (state) syncMascot();
  }

  function toggleSound() {
    muted = !muted;
    storageSet(MUTE_KEY, muted ? "1" : "0");
    updateSoundLabel();
    applyBgm();
    if (!muted) tone(660, 0.05, "square", 0, 0.03);
  }

  function showModeTab(name) {
    const ranking = name === "ranking";
    $("panel-standard").hidden = ranking;
    $("panel-ranking").hidden = !ranking;
    $("tab-standard").classList.toggle("on", !ranking);
    $("tab-ranking").classList.toggle("on", ranking);
    $("tab-standard").setAttribute("aria-selected", ranking ? "false" : "true");
    $("tab-ranking").setAttribute("aria-selected", ranking ? "true" : "false");
  }
  $("tab-standard").addEventListener("click", () => showModeTab("standard"));
  $("tab-ranking").addEventListener("click", () => showModeTab("ranking"));
  $("start-simple").addEventListener("click", () => startMode("simple"));
  $("start-dice").addEventListener("click", () => startMode("dice"));
  $("start-life").addEventListener("click", () => startMode("life"));
  $("start-extreme").addEventListener("click", () => startMode("extreme"));
  $("start-simplerank").addEventListener("click", () => startMode("simplerank"));
  $("start-dicerank").addEventListener("click", () => startMode("dicerank"));
  $("start-rank").addEventListener("click", () => startMode("rank"));
  $("start-life1").addEventListener("click", () => startMode("life1"));
  let helpFrom = "title";
  let tipsFrom = "title";
  function openHelp(from) {
    helpFrom = from;
    if (from === "play" && !clockLocked()) setHold("help", true);
    show("help");
  }
  function openTips(from) {
    tipsFrom = from;
    if (from === "play" && !clockLocked()) setHold("tips", true);
    show("tips");
  }
  function closeHelp() {
    if (helpFrom === "play") {
      setHold("help", false);
      if (!state || !clockLocked(state.mode)) lastTs = 0;
      show("play");
      if (state) $("answer").focus();
      return;
    }
    show("title");
  }
  function closeTips() {
    if (tipsFrom === "play") {
      setHold("tips", false);
      if (!state || !clockLocked(state.mode)) lastTs = 0;
      show("play");
      if (state) $("answer").focus();
      return;
    }
    show("title");
  }
  function retryNow() {
    const playing = !$("screen-play").hidden;
    const finished = !$("screen-result").hidden;
    if (!playing && !finished) return;
    if (finished) commitRankName($("rank-name").value);
    startMode(mode, true);
  }
  let lastSpaceAt = 0;
  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.key !== " ") return;
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.isComposing || composing || nameComposing) return;
    const target = event.target;
    if (target && (target.id === "rank-name" || target.id === "word-text" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
    if ($("screen-play").hidden && $("screen-result").hidden) return;
    event.preventDefault();
    const now = performance.now();
    const again = now - lastSpaceAt <= 500;
    lastSpaceAt = again ? 0 : now;
    if (again) retryNow();
  });
  $("open-help").addEventListener("click", () => openHelp("title"));
  $("open-tips").addEventListener("click", () => openTips("title"));
  $("play-help").addEventListener("click", () => openHelp("play"));
  $("play-tips").addEventListener("click", () => openTips("play"));
  $("help-back").addEventListener("click", closeHelp);
  $("tips-back").addEventListener("click", closeTips);
  $("genre-row").addEventListener("click", (event) => {
    const button = event.target.closest("[data-genre]");
    if (!button) return;
    const id = button.dataset.genre;
    const current = selectedGenres();
    const next = current.indexOf(id) >= 0 ? current.filter((item) => item !== id) : current.concat(id);
    if (!next.length) {
      toast("ジャンルは、ひとつ以上選びます");
      return;
    }
    storageSet(GENRES_KEY, JSON.stringify(GENRE_IDS.filter((item) => next.indexOf(item) >= 0)));
    refreshTitle();
  });
  $("len-min").addEventListener("change", () => {
    const range = selectedLength();
    saveLength(Number($("len-min").value), range[1]);
    refreshTitle();
  });
  $("len-max").addEventListener("change", () => {
    const range = selectedLength();
    const max = Number($("len-max").value);
    const min = Math.min(range[0], max);
    saveLength(min, max);
    refreshTitle();
  });
  $("words-back").addEventListener("click", () => { show("title"); refreshTitle(); });
  $("word-text").addEventListener("input", updateWordStat);
  $("save-words").addEventListener("click", saveWords);
  $("sample-words").addEventListener("click", () => {
    $("word-text").value = defaultWords();
    updateWordStat();
  });
  $("toggle-bird").addEventListener("click", toggleBird);
  $("mute-play").addEventListener("click", toggleSound);
  $("retry").addEventListener("click", () => {
    commitRankName($("rank-name").value);
    startMode(mode);
  });
  $("to-title").addEventListener("click", () => {
    commitRankName($("rank-name").value);
    abandon();
  });
  $("skip-rank").addEventListener("click", declineRank);
  $("rank-name-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (nameComposing) return;
    commitRankName($("rank-name").value);
  });
  $("rank-name").addEventListener("compositionstart", () => { nameComposing = true; });
  $("rank-name").addEventListener("compositionend", () => { nameComposing = false; });
  $("quit").addEventListener("click", () => {
    if (!state) {
      if (!$("countdown").hidden) abandon();
      return;
    }
    if (state.phase === "over") return;
    $("quitbar").hidden = false;
    if (!clockLocked(state.mode)) setHold("quit", true);
  });
  $("quit-no").addEventListener("click", () => {
    $("quitbar").hidden = true;
    setHold("quit", false);
    if (!state || !clockLocked(state.mode)) lastTs = 0;
    $("answer").focus();
  });
  $("quit-yes").addEventListener("click", abandon);
  $("hammer").addEventListener("pointerdown", (event) => {
    if (!state || state.phase === "over" || state.paused || !state.hammersLeft) return;
    event.preventDefault();
    const el = $("hammer");
    const rect = el.getBoundingClientRect();
    hammerDrag = {
      id: event.pointerId,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
    };
    el.classList.add("dragging");
    el.style.left = rect.left + "px";
    el.style.top = rect.top + "px";
    try { el.setPointerCapture(event.pointerId); } catch (err) { /* synthetic drag */ }
  });
  $("hammer").addEventListener("pointermove", (event) => {
    if (!hammerDrag || event.pointerId !== hammerDrag.id) return;
    $("hammer").style.left = (event.clientX - hammerDrag.dx) + "px";
    $("hammer").style.top = (event.clientY - hammerDrag.dy) + "px";
  });
  $("hammer").addEventListener("pointerup", (event) => {
    if (!hammerDrag || event.pointerId !== hammerDrag.id) return;
    const el = $("hammer");
    el.style.visibility = "hidden";
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    el.style.visibility = "";
    hammerDrag = null;
    const card = hit && hit.closest(".card");
    const id = card ? Number(card.dataset.id) : 0;
    if (id && state && G.hammer(state, id).ok) {
      el.hidden = true;
      placeHammerHome();
      pump();
      return;
    }
    placeHammerHome();
    if (card) shake(card);
  });
  $("hammer").addEventListener("pointercancel", () => {
    hammerDrag = null;
    placeHammerHome();
  });
  $("pass").addEventListener("click", () => {
    if (!state || !likeSimple(state.mode) || state.paused) return;
    G.pass(state);
    pump();
    $("answer").focus();
  });
  $("dock").addEventListener("submit", (event) => {
    event.preventDefault();
    if (composing) {
      setTimeout(() => { if (!composing) onAnswer(); }, 0);
      return;
    }
    onAnswer();
  });
  $("answer").addEventListener("compositionstart", () => { composing = true; });
  $("answer").addEventListener("compositionend", () => { composing = false; });
  $("screen-play").addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, input, textarea, a")) return;
    event.preventDefault();
  });

  document.addEventListener("visibilitychange", () => {
    if (!state || state.phase === "over" || clockLocked(state.mode)) return;
    if (document.hidden) setHold("hide", true);
    else {
      lastTs = 0;
      setHold("hide", false);
    }
  });
  $("bgm-volume").addEventListener("input", () => setBgmVolume(Number($("bgm-volume").value)));
  $("se-volume").addEventListener("input", () => setSeVolume(Number($("se-volume").value)));
  $("se-volume").addEventListener("change", () => {
    if (!muted && seVolume > 0) playSe("correct");
  });
  document.addEventListener("pointerdown", () => { ctx(); applyBgm(); }, { once: true });

  window.addEventListener("resize", syncViewport);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncViewport);
    window.visualViewport.addEventListener("scroll", syncViewport);
  }

  muted = storageGet(MUTE_KEY) === "1";
  birdOff = storageGet(BIRD_KEY) === "0";
  bgmVolume = readVolume(BGM_KEY, 60);
  seVolume = readVolume(SE_VOL_KEY, 80);
  syncVolumeControls();
  syncViewport();
  refreshTitle();
})();
