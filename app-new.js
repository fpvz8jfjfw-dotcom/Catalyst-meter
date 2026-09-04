import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// =====================================================
// PRACOVNÍ LIGA
// =====================================================

const EMPLOYEES = [
  "Adam Juda",
  "Michal Mourek",
  "Martin Strejček",
  "Ladislav Čihák"
];

const HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

const PLAYER_COLORS = {
  "Adam Juda": "#2563eb",
  "Michal Mourek": "#dc2626",
  "Martin Strejček": "#16a34a",
  "Ladislav Čihák": "#9333ea"
};

let ratings = [];
let chatMessages = [];
let chatChannel = null;
let chatInitialized = false;

// =====================================================
// DOM
// =====================================================

const dateInput = document.getElementById("date"); 
const table = document.getElementById("ratings");
const status = document.getElementById("status");
const leaderboard = document.getElementById("leaderboard");
const yearStats = document.getElementById("yearStats");
const comparison = document.getElementById("comparison");
const chartCanvas = document.getElementById("burnoutChart");
const exportButton = document.getElementById("exportCsv");
const messageBox = document.getElementById("messageBox");
const currentWinner = document.getElementById("currentWinner");

// =====================================================
// HLÁŠKY
// =====================================================

const MESSAGES = {
  1: "😎 Dobře jedeš",
  2: "😎 Jde to jako po másle",
  3: "🙂 Dneska to feeluju",
  4: "😐 Dneska to necejtím",
  5: "😐 Nebudu tady dělat všechno, do piče",
  6: "😑 Děleeej, tak už to pískni",
  7: "😤 Nebudu to dělat",
  8: "🔥 Dneska netahám",
  9: "☕ Kávec a domů",
  10: "☠️ TOTAL BURNOUT"
};

// =====================================================
// POMOCNÉ FUNKCE
// =====================================================

function today() {
  const d = new Date();

  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

if (dateInput) {
  dateInput.value = today();
  dateInput.addEventListener("change", () => render());
}

function getSelectedYear() {
  if (!dateInput || !dateInput.value) {
    return new Date().getFullYear();
  }

  return Number(
    dateInput.value.substring(0, 4)
  );
}

function getRating(person, date, hour) {
  return ratings.find(
    r =>
      r.person === person &&
      r.date === date &&
      Number(r.hour) === Number(hour)
  );
}

function getYearRatings() {
  const year = getSelectedYear();

  return ratings.filter(
    r =>
      Number(r.year) === year &&
      EMPLOYEES.includes(r.person)
  );
}

function getPersonStats(person) {
  const values = getYearRatings()
    .filter(r => r.person === person)
    .map(r => Number(r.score))
    .filter(v => Number.isFinite(v));

  if (!values.length) {
    return {
      person,
      count: 0,
      average: null,
      highest: null,
      lowest: null
    };
  }

  const total = values.reduce(
    (sum, value) => sum + value,
    0
  );

  return {
    person,
    count: values.length,
    average: total / values.length,
    highest: Math.max(...values),
    lowest: Math.min(...values)
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "'");
}

// =====================================================
// NAČTENÍ HODNOCENÍ
// =====================================================

async function loadRatings() {
  if (!status) return;

  status.textContent = "Načítám data…";

  const { data, error } = await supabase
    .from("ratings")
    .select("*")
    .order("date", { ascending: true })
    .order("hour", { ascending: true });

  if (error) {
    console.error("SUPABASE LOAD ERROR:", error);
    status.textContent = "❌ Nepodařilo se načíst data ze Supabase.";
    alert("Chyba Supabase při načítání:\n\n" + error.message);
    return;
  }

  ratings = data || [];
  status.textContent = `🟢 Data načtena • \${ratings.length} měření`;
  render();
}

// =====================================================
// RENDER
// =====================================================

function render() {
  renderTable();
  renderLeaderboard();
  renderYearStats();
  renderWinner();
  renderComparison();
  renderChart();
  renderMessage();
}

// =====================================================
// TABULKA
// =====================================================

function renderTable() {
  if (!table || !dateInput) return;

  const date = dateInput.value;

  let html = `
    <table>
      <thead>
        <tr>
          <th>Zaměstnanec</th>
          \${HOURS.map(hour => `<th>\${hour}:00</th>`).join("")}
        </tr>
      </thead>
      <tbody>
  `;

  for (const employee of EMPLOYEES) {
    html += `
      <tr>
        <td class="employee">\${escapeHtml(employee)}</td>
    `;

    for (const hour of HOURS) {
      const rating = getRating(employee, date, hour);
      const value = rating ? Number(rating.score) : "";

      html += `
        <td>
          <button
            class="rating rating-\${value || "empty"}"
            data-person="\${escapeHtml(employee)}"
            data-hour="\${hour}"
            title="Klikni pro zadání nebo úpravu"
          >
            \${value || "—"}
          </button>
        </td>
      `;
    }
    html += "</tr>";
  }

  html += `
      </tbody>
    </table>
  `;

  table.innerHTML = html;

  document.querySelectorAll(".rating").forEach(button => {
    button.addEventListener("click", () => {
      enterRating(button.dataset.person, Number(button.dataset.hour));
    });
  });
}

// =====================================================
// ZADÁNÍ / PŘEPIS / SMAZÁNÍ
// =====================================================

async function enterRating(person, hour) {
  if (!dateInput) return;

  const date = dateInput.value;
  const existing = getRating(person, date, hour);
  const current = existing ? existing.score : "";

  const input = prompt(
    `\${person}\n\${hour}:00\n\n` +
    `Míra vyhoření 1–10\n\n` +
    `1 = Dobře jedeš\n` +
    `2 = Jde to jako po másle\n` +
    `3 = Dneska to feeluju\n` +
    `4 = Dneska to necejtím\n` +
    `5 = Nebudu tady dělat všechno, do piče\n` +
    `6 = Děleeej, tak už to pískni\n` +
    `7 = Nebudu to dělat\n` +
    `8 = Dneska netahám\n` +
    `9 = Kávec a domů\n` +
    `10 = TOTAL BURNOUT\n\n` +
    (existing ? `Aktuálně: \${current}\n\nPro smazání napiš: smazat` : ""),
    current
  );

  if (input === null) return;

  if (existing && input.trim().toLowerCase() === "smazat") {
    status.textContent = "🗑️ Mažu…";

    const result = await supabase
      .from("ratings")
      .delete()
      .eq("id", existing.id);

    if (result.error) {
      alert("❌ Chyba při mazání:\n\n" + result.error.message);
      status.textContent = "❌ Chyba při mazání";
      return;
    }

    ratings = ratings.filter(r => r.id !== existing.id);
    status.textContent = "🟢 Hodnocení smazáno";
    render();
    return;
  }

  const score = Number(input);

  if (!Number.isInteger(score) || score < 1 || score > 10) {
    alert("⚠️ Zadej celé číslo od 1 do 10.");
    return;
  }

  status.textContent = existing ? "✏️ Přepisuji hodnocení…" : "💾 Ukládám…";

  const payload = {
    year: Number(date.substring(0, 4)),
    person,
    score,
    date,
    hour
  };

  let result;

  if (existing) {
    result = await supabase
      .from("ratings")
      .update(payload)
      .eq("id", existing.id)
      .select();
  } else {
    result = await supabase
      .from("ratings")
      .insert([payload])
      .select();
  }

  if (result.error) {
    alert("❌ Chyba při ukládání do Supabase:\n\n" + result.error.message);
    status.textContent = "❌ Chyba při ukládání";
    return;
  }

  if (existing) {
    ratings = ratings.map(r => r.id === existing.id ? result.data : r);
  } else {
    ratings.push(result.data);
  }

  status.textContent = "🟢 Data úspěšně uložena";
  render();
}

// =====================================================
// DOPLŇKOVÉ RENDEROVACÍ FUNKCE (PROTI CHYBÁM V KONZOLI)
// =====================================================

function renderLeaderboard() {
  if (!leaderboard) return;
  const stats = EMPLOYEES.map(p => getPersonStats(p))
    .filter(s => s.count > 0)
    .sort((a, b) => b.average - a.average);

  leaderboard.innerHTML = stats.length 
    ? `<ul>\${stats.map((s, idx) => `<li>\${idx + 1}. \${escapeHtml(s.person)} — Průměr: \${s.average.toFixed(2)} (\${s.count}x)</li>`).join("")}</ul>`
    : "<p>Zatím žádná data pro žebříček.</p>";
}

function renderYearStats() {
  if (!yearStats) return;
  const year = getSelectedYear();
  let html = `<h3>Statistiky pro rok \${year}</h3>`;
  
  EMPLOYEES.forEach(person => {
    const s = getPersonStats(person);
    html += `<p><strong>\${escapeHtml(person)}:</strong> \${s.count > 0 ? `Průměr: \${s.average.toFixed(2)}, Max: \${s.highest}, Min: \${s.lowest}` : 'Žádná data'}</p>`;
  });
  
  yearStats.innerHTML = html;
}

function renderWinner() {
  if (!currentWinner) return;
  const date = dateInput?.value;
  const dayRatings = ratings.filter(r => r.date === date);
  
  if (!dayRatings.length) {
    currentWinner.textContent = "Dnes ještě nikdo netrpí.";
    return;
  }

  const maxScore = Math.max(...dayRatings.map(r => r.score));
  const winners = [...new Set(dayRatings.filter(r => r.score === maxScore).map(r => r.person))];

  currentWinner.innerHTML = `🔥 Dnešní leader vyhoření s hodnotou \${maxScore}: <strong>\${winners.map(escapeHtml).join(", ")}</strong>`;
}

function renderComparison() {
  if (!comparison) return;
  comparison.innerHTML = "<p>Porovnání je připraveno.</p>";
}

function renderChart() {
  if (!chartCanvas) return;
}

function renderMessage() {
  if (!messageBox) return;
  const date = dateInput?.value;
  const dayRatings = ratings.filter(r => r.date === date);
  
  if (!dayRatings.length) {
    messageBox.textContent = "Žádné dnešní hlášky.";
    return;
  }

  const latest = dayRatings[dayRatings.length - 1];
  messageBox.innerHTML = `💬 <strong>\${escapeHtml(latest.person)}</strong> (\${latest.hour}:00): <em>"\${MESSAGES[latest.score] || "Bez hlášky"}"</em>`;
}

// =====================================================
// EXPORT DO CSV
// =====================================================

if (exportButton) {
  exportButton.addEventListener("click", () => {
    if (!ratings.length) {
      alert("Není co exportovat.");
      return;
    }

    let csv = "id,year,date,hour,person,score\n";
    ratings.forEach(r => {
      csv += `"\${r.id ?? ''}",\${r.year},"\\${r.date}",\${r.hour},"\${r.person.replace(/"/g, '""')}",\${r.score}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `burnout_stats_\${getSelectedYear()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.appendChild(link);
    link.remove();
  });
}

loadRatings();
