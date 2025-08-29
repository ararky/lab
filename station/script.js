let stations = [];
let rankedStations = Array(100).fill(null);

async function loadStations() {
  try {
    const url = 'station.json?v=5'; // いま確認用の固定バージョン
    console.log('fetch:', url, location.href);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('JSON root is not an array');
      stations = data;
      console.log('データ読み込み成功:', stations.length);
    } catch (e) {
      console.error('JSON parse 失敗:', e, '先頭200文字=', text.slice(0, 200));
      stations = [];
    }
  } catch (error) {
    console.error('JSONの読み込みに失敗しました:', error);
    stations = [];
  } finally {
    // ロード完了後に入力を有効化
    const inputEl = document.getElementById('stationInput');
    if (inputEl) inputEl.disabled = false;
  }
}

function normalizeText(text) {
  return text.trim().replace(/\s+/g, "").toLowerCase();
}

function displayGrid() {
  const grid = document.getElementById("stationGrid");
  grid.innerHTML = "";
  for (let i = 0; i < 100; i++) {
    const station = rankedStations[i];
    const item = document.createElement("div");
    item.className = "grid-item";
    if (station) {
      item.textContent = station.駅名;
      const rankNumber = document.createElement("span");
      rankNumber.className = "rank-number";
      rankNumber.textContent = station.順位;
      item.appendChild(rankNumber);
      item.onclick = () => showPopup(station);
      item.classList.add("correct-item");
    } else {
      item.textContent = `${i + 1}位`;
      item.className += " empty-item";
    }
    grid.appendChild(item);
  }
}

function showPopup(station) {
  const popup = document.getElementById("popup");
  const content = document.getElementById("popupContent");
  content.textContent = `順位: ${station.順位}, 駅名: ${station.駅名}, 乗降客数: ${station.乗降客数}`;
  popup.style.display = "block";
  popup.onclick = () => popup.style.display = "none";
}

async function checkRank() {
  const raw = document.getElementById("stationInput").value;
  const input = normalizeText(raw);
  const result = document.getElementById("result");

  if (!input) {
    result.textContent = "駅名を入力してください";
    result.className = "out";
    result.style.opacity = 1;
    return;
  }

  // ★ データ未ロード/失敗のガード
  if (!Array.isArray(stations) || stations.length === 0) {
    result.textContent = "データ未取得です。station.json のパス/JSON構文/キャッシュをご確認ください。";
    result.className = "out";
    result.style.opacity = 1;
    return;
  }

  const found = pickStationByName(raw);

  if (found) {
    const rank = parseInt(found.順位);
    if (rank <= 100) {
      rankedStations[rank - 1] = found;
      displayGrid();
      result.textContent = `✅ ${found.駅名} は ${rank} 位でランクイン！`;
      result.className = "rank-in";
      result.style.color = "";
    } else {
      result.textContent = `✅ ${found.駅名} は ${rank} 位です！`;
      result.className = "out";
      result.style.color = "red";
    }
  } else {
    result.textContent = `残念！ ${raw} はランク外です...`;
    result.className = "out";
    result.style.color = "red";
    result.style.fontFamily = "monospace";
    result.style.fontSize = "2.5rem";
    result.style.fontWeight = "bold";
  }
  result.style.opacity = 1;
}

function showSuggestions() {
  const inputRaw = document.getElementById("stationInput").value;
  const input = normalizeText(inputRaw);

  const suggestions = document.getElementById("suggestions");
  suggestions.innerHTML = "";

  if (!input) { suggestions.style.display = "none"; return; }

  // ★ データ未ロード/失敗のガード
  if (!Array.isArray(stations) || stations.length === 0) {
    suggestions.style.display = "none";
    return;
  }

  const exacts = stations.filter(s => normalizeText(s.駅名) === input);
  const partials = stations.filter(s => {
    const n = normalizeText(s.駅名);
    return n.includes(input) && n !== input;
  });

  let similar = [];
  if (window.stringSimilarity?.compareTwoStrings) {
    similar = stations
      .map(s => ({ s, sim: stringSimilarity.compareTwoStrings(normalizeText(s.駅名), input) }))
      .filter(x => x.sim > 0.5 && normalizeText(x.s.駅名) !== input)
      .sort((a,b) => b.sim - a.sim)
      .map(x => x.s);
  }

  const combinedStations = [...new Set([...exacts, ...partials, ...similar])];

  if (combinedStations.length > 0) {
    combinedStations.slice(0, 10).forEach(station => {
      const li = document.createElement("li");
      li.textContent = station.駅名;
      li.onclick = () => {
        document.getElementById("stationInput").value = station.駅名;
        suggestions.style.display = "none";
        checkRank();
      };
      suggestions.appendChild(li);
    });
    suggestions.style.display = "block";
  } else {
    suggestions.style.display = "none";
  }
}

function pickStationByName(rawInput) {
  const q = normalizeText(rawInput);

  const exact = stations.find(s => normalizeText(s.駅名) === q);
  if (exact) return exact;

  const cands = stations.filter(s => normalizeText(s.駅名).includes(q));
  if (cands.length === 0) return null;
  if (cands.length === 1) return cands[0];

  const scored = cands.map(s => {
    const name = normalizeText(s.駅名);
    const sim = (window.stringSimilarity?.compareTwoStrings)
      ? stringSimilarity.compareTwoStrings(name, q)
      : (q.length / name.length);
    return { s, score: sim, len: name.length, rank: parseInt(s.順位) };
  });
  scored.sort((a,b) => b.score - a.score || a.len - b.len || a.rank - b.rank);
  return scored[0].s;
}

// 起動：ロード中は入力ロック
const inputEl = document.getElementById('stationInput');
if (inputEl) inputEl.disabled = true;
loadStations();
