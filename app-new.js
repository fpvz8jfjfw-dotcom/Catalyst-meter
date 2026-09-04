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

const HOURS = [
  5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17 ];

// Každý hráč má vlastní barvu
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

const dateInput = document.getElementById("date"); const table = document.getElementById("ratings");
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
// DNES
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
}

// =====================================================
// POMOCNÉ FUNKCE
// =====================================================

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
    .replaceAll("'", "&#039;");
}

// =====================================================
// NAČTENÍ DAT
// =====================================================

async function loadRatings() {
  if (!status) {
    return;
  }

  status.textContent = "Načítám data…";

  const { data, error } = await supabase
    .from("ratings")
    .select("*")
    .order("date", {
      ascending: true
    })
    .order("hour", {
      ascending: true
    });

  if (error) {
    console.error(
      "SUPABASE LOAD ERROR:",
      error
    );

    status.textContent =
      "❌ Nepodařilo se načíst data ze Supabase.";

    alert(
      "Chyba Supabase při načítání:\n\n" +
      error.message +
      "\n\n" +
      (error.details || "") +
      "\n\n" +
      (error.hint || "")
    );

    return;
  }

  ratings = data || [];

  status.textContent =
    `🟢 Data načtena • ${ratings.length} měření`;

  render();
}

// =====================================================
// HLAVNÍ RENDER
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
  if (!table || !dateInput) {
    return;
  }

  const date = dateInput.value;

  let html = `
    <table>
      <thead>
        <tr>
          <th>Zaměstnanec</th>
          ${HOURS
            .map(hour => `<th>${hour}:00</th>`)
            .join("")}
        </tr>
      </thead>

      <tbody>
  `;

  for (const employee of EMPLOYEES) {
    html += `
      <tr>
        <td class="employee">
          ${employee}
        </td>
    `;

    for (const hour of HOURS) {
      const rating = getRating(
        employee,
        date,
        hour
      );

      const value = rating
        ? Number(rating.score)
        : "";

      html += `
        <td>
          <button
            class="rating rating-${value || "empty"}"
            data-person="${escapeHtml(employee)}"
            data-hour="${hour}"
            title="Klikni pro zadání nebo úpravu"
          >
            ${value || "—"}
          </button>
        </td>
      `;
    }

    html += `
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;

  table.innerHTML = html;

  document
    .querySelectorAll(".rating")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const person =
            button.dataset.person;

          const hour =
            Number(button.dataset.hour);

          enterRating(
            person,
            hour
          );
        }
      );
    });
}

// =====================================================
// ZADÁNÍ / PŘEPIS / SMAZÁNÍ
// =====================================================

async function enterRating(
  person,
  hour
) {
  if (!dateInput) {
    return;
  }

  const date = dateInput.value;

  const existing = getRating(
    person,
    date,
    hour
  );

  const current =
    existing
      ? existing.score
      : "";

  const input = prompt(
    `${person}\n` +
    `${hour}:00\n\n` +
    `Míra vyhoření 1–10\n\n` +
    `1 = Dobře jedu\n` +
    `2 = Jde to jako po másle\n` +
    `3 = Nebudu tady dělat všechno, do piče\n` +
    `4 = Dělej zacukruj\n` +
    `5 = Dneska to necejtím\n` +
    `6 = Nebudu to dělat, kurva uuuž\n` +
    `7 = Děleeej, tak už to pískni\n` +
    `8 = Dneska netahám\n` +
    `9 = Kávec a domů\n` +
    `10 = TOTAL BURNOUT\n\n` +
    (
      existing
        ? `Aktuálně: ${current}\n\n` +
          `Pro smazání napiš: smazat`
        : ""
    ),
    current
  );

  if (input === null) {
    return;
  }

  // ===================================================
  // SMAZÁNÍ
  // ===================================================

  if (
    existing &&
    input
      .trim()
      .toLowerCase() === "smazat"
  ) {
    status.textContent =
      "🗑️ Mažu…";

    const result =
      await supabase
        .from("ratings")
        .delete()
        .eq(
          "id",
          existing.id
        );

    if (result.error) {
      console.error(
        "SUPABASE DELETE ERROR:",
        result.error
      );

      alert(
        "❌ Chyba při mazání:\n\n" +
        result.error.message +
        "\n\n" +
        (result.error.details || "") +
        "\n\n" +
        (result.error.hint || "")
      );

      status.textContent =
        "❌ Chyba při mazání";

      return;
    }

    ratings =
      ratings.filter(
        r => r.id !== existing.id
      );

    status.textContent =
      "🟢 Hodnocení smazáno";

    render();
    return;
  }

  // ===================================================
  // KONTROLA
  // ===================================================

  const score =
    Number(input);

  if (
    !Number.isInteger(score) ||
    score < 1 ||
    score > 10
  ) {
    alert(
      "⚠️ Zadej celé číslo od 1 do 10."
    );

    return;
  }

  // ===================================================
  // UKLÁDÁNÍ / PŘEPIS
  // ===================================================

  status.textContent =
    existing
      ? "✏️ Přepisuji hodnocení…"
      : "💾 Ukládám…";

  const payload = {
    year:
      Number(
        date.substring(0, 4)
      ),

    person:
      person,

    score:
      score,

    date:
      date,

    hour:
      hour
  };

  let result;

  if (existing) {
    result =
      await supabase
        .from("ratings")
        .update(payload)
        .eq(
          "id",
          existing.id
        );
  } else {
    result =
      await supabase
        .from("ratings")
        .insert(payload);
  }

  if (result.error) {
    console.error(
      "SUPABASE SAVE ERROR:",
      result.error
    );

    alert(
      "❌ Chyba při ukládání:\n\n" +
      result.error.message +
      "\n\n" +
      (result.error.details || "") +
      "\n\n" +
      (result.error.hint || "")
    );

    status.textContent =
      "❌ Chyba při ukládání";

    return;
  }

  status.textContent =
    existing
      ? "🟢 Hodnocení přepsáno"
      : "🟢 Hodnocení uloženo";

  await loadRatings();
}

// =====================================================
// LEADERBOARD
// =====================================================

function renderLeaderboard() {
  if (!leaderboard) {
    return;
  }

  const results =
    EMPLOYEES
      .map(person =>
        getPersonStats(person)
      )
      .sort(
        (a, b) => {
          if (
            a.average === null
          ) {
            return 1;
          }

          if (
            b.average === null
          ) {
            return -1;
          }

          return (
            b.average -
            a.average
          );
        }
      );

  leaderboard.innerHTML =
    results
      .map(
        (result, index) => {
          const medal =
            index === 0
              ? "🥇"
              : index === 1
              ? "🥈"
              : index === 2
              ? "🥉"
              : "🏅";

          const color =
            PLAYER_COLORS[result.person];

          return `
            <div class="leader">

              <span class="medal">
                ${medal}
              </span>

              <strong
                style="color:${color}"
              >
                ${escapeHtml(result.person)}
              </strong>

              <span>
                ${
                  result.average === null
                    ? "zatím bez dat"
                    : result.average.toFixed(2) +
                      " / 10"
                }
              </span>

              <small>
                ${result.count} měření
              </small>

            </div>
          `;
        }
      )
      .join("");
}

// =====================================================
// ROČNÍ STATISTIKY
// =====================================================

function renderYearStats() {
  if (!yearStats) {
    return;
  }

  const yearRatings =
    getYearRatings();

  const values =
    yearRatings
      .map(r =>
        Number(r.score)
      )
      .filter(v =>
        Number.isFinite(v)
      );

  if (!values.length) {
    yearStats.innerHTML = `
      <div class="stat">
        <span>Celkem měření</span>
        <strong>0</strong>
      </div>

      <div class="stat">
        <span>Roční průměr</span>
        <strong>—</strong>
      </div>

      <div class="stat">
        <span>Maximum</span>
        <strong>—</strong>
      </div>

      <div class="stat">
        <span>Minimum</span>
        <strong>—</strong>
      </div>
    `;

    return;
  }

  const average =
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    values.length;

  yearStats.innerHTML = `
    <div class="stat">
      <span>Celkem měření</span>
      <strong>
        ${values.length}
      </strong>
    </div>

    <div class="stat">
      <span>Roční průměr</span>
      <strong>
        ${average.toFixed(2)}
      </strong>
    </div>

    <div class="stat">
      <span>Největší utrpení</span>
      <strong>
        ${Math.max(...values)} / 10
      </strong>
    </div>

    <div class="stat">
      <span>Nejnižší hodnocení</span>
      <strong>
        ${Math.min(...values)} / 10
      </strong>
    </div>
  `;
}

// =====================================================
// VÍTĚZ
// =====================================================

function renderWinner() {
  if (!currentWinner) {
    return;
  }

  const results =
    EMPLOYEES
      .map(person =>
        getPersonStats(person)
      )
      .filter(
        result =>
          result.count > 0
      )
      .sort(
        (a, b) =>
          b.average -
          a.average
      );

  if (!results.length) {
    currentWinner.innerHTML =
      "🏆 Zatím nikdo";

    return;
  }

  const winner =
    results[0];

  const color =
    PLAYER_COLORS[winner.person];

  currentWinner.innerHTML = `
    🏆
    <span style="color:${color}">
      ${escapeHtml(winner.person)}
    </span>

    <small>
      ${winner.average.toFixed(2)} / 10
    </small>
  `;
}

// =====================================================
// POROVNÁNÍ HRÁČŮ
// =====================================================

function renderComparison() {
  if (!comparison) {
    return;
  }

  const results =
    EMPLOYEES
      .map(person =>
        getPersonStats(person)
      )
      .filter(
        result =>
          result.count > 0
      )
      .sort(
        (a, b) =>
          b.average -
          a.average
      );

  if (!results.length) {
    comparison.innerHTML = `
      <div class="empty-state">
        Zatím nejsou data pro porovnání.
      </div>
    `;

    return;
  }

  comparison.innerHTML =
    results
      .map(
        (result, index) => {
          const width =
            Math.max(
              5,
              Math.min(
                100,
                result.average * 10
              )
            );

          const color =
            PLAYER_COLORS[result.person];

          return `
            <div class="compare-row">

              <div class="compare-head">
                <strong>
                  <span
                    class="player-dot"
                    style="
                      background:${color};
                    "
                  ></span>

                  ${index + 1}.
                  ${escapeHtml(result.person)}
                </strong>

                <span>
                  ${result.average.toFixed(2)}
                </span>
              </div>

              <div class="bar">
                <div
                  class="bar-fill"
                  style="
                    width:${width}%;
                    background:${color};
                  "
                ></div>
              </div>

              <small>
                ${result.count} měření
                • minimum ${result.lowest}
                • maximum ${result.highest}
              </small>

            </div>
          `;
        }
      )
      .join("");
}

// =====================================================
// DNEŠNÍ HLÁŠKA
// =====================================================

function renderMessage() {
  if (!messageBox || !dateInput) {
    return;
  }

  const date =
    dateInput.value;

  const values =
    ratings
      .filter(
        r =>
          r.date === date
      )
      .map(r =>
        Number(r.score)
      )
      .filter(v =>
        Number.isFinite(v)
      );

  if (!values.length) {
    messageBox.innerHTML = `
      <strong>
        🔥 Dnešní hláška
      </strong>

      <span>
        Zatím žádné hodnocení.
      </span>
    `;

    return;
  }

  const average =
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    values.length;

  const rounded =
    Math.max(
      1,
      Math.min(
        10,
        Math.round(average)
      )
    );

  messageBox.innerHTML = `
    <strong>
      ${MESSAGES[rounded]}
    </strong>

    <span>
      Dnešní průměr:
      <b>
        ${average.toFixed(2)} / 10
      </b>
    </span>
  `;
}

// =====================================================
// GRAF – VÝVOJ VYHOŘENÍ
// =====================================================

function renderChart() {
  if (!chartCanvas) {
    return;
  }

  const ctx =
    chartCanvas.getContext("2d");

  if (!ctx) {
    return;
  }

  const year =
    getSelectedYear();

  ctx.clearRect(
    0,
    0,
    chartCanvas.width,
    chartCanvas.height
  );

  // ===================================================
  // PŘÍPRAVA DAT PRO KAŽDÉHO HRÁČE
  // ===================================================

  const playerData = {};

  EMPLOYEES.forEach(person => {
    playerData[person] = {};
  });

  ratings
    .filter(
      r =>
        Number(r.year) === year &&
        EMPLOYEES.includes(r.person)
    )
    .forEach(r => {
      const score =
        Number(r.score);

      if (!Number.isFinite(score)) {
        return;
      }

      if (!playerData[r.person][r.date]) {
        playerData[r.person][r.date] = [];
      }

      playerData[r.person][r.date].push(
        score
      );
    });

  // Všechny dny
  const labels = [
    ...new Set(
      ratings
        .filter(
          r =>
            Number(r.year) === year &&
            EMPLOYEES.includes(r.person)
        )
        .map(r => r.date)
    )
  ].sort();

  if (!labels.length) {
    ctx.font =
      "16px system-ui";

    ctx.fillStyle =
      "#777777";

    ctx.fillText(
      "Zatím nejsou data pro graf.",
      20,
      40
    );

    renderChartLegend();

    return;
  }

  const width =
    chartCanvas.width;

  const height =
    chartCanvas.height;

  const paddingLeft = 45;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth =
    width -
    paddingLeft -
    paddingRight;

  const chartHeight =
    height -
    paddingTop -
    paddingBottom;

  // ===================================================
  // OSY
  // ===================================================

  ctx.strokeStyle =
    "#cccccc";

  ctx.lineWidth = 1;

  ctx.beginPath();

  ctx.moveTo(
    paddingLeft,
    paddingTop
  );

  ctx.lineTo(
    paddingLeft,
    height - paddingBottom
  );

  ctx.lineTo(
    width - paddingRight,
    height - paddingBottom
  );

  ctx.stroke();

  // ===================================================
  // MŘÍŽKA 1–10
  // ===================================================

  for (
    let i = 1;
    i <= 10;
    i++
  ) {
    const y =
      height -
      paddingBottom -
      (
        (i - 1) /
        9
      ) *
      chartHeight;

    ctx.strokeStyle =
      "#eeeeee";

    ctx.beginPath();

    ctx.moveTo(
      paddingLeft,
      y
    );

    ctx.lineTo(
      width - paddingRight,
      y
    );

    ctx.stroke();

    ctx.fillStyle =
      "#777777";

    ctx.font =
      "11px system-ui";

    ctx.fillText(
      String(i),
      15,
      y + 4
    );
  }

  // ===================================================
  // KŘIVKA KAŽDÉHO HRÁČE
  // ===================================================

  EMPLOYEES.forEach(person => {
    const color =
      PLAYER_COLORS[person];

    const values =
      labels.map(date => {
        const list =
          playerData[person][date];

        if (
          !list ||
          !list.length
        ) {
          return null;
        }

        return (
          list.reduce(
            (sum, value) =>
              sum + value,
            0
          ) /
          list.length
        );
      });

    ctx.strokeStyle =
      color;

    ctx.lineWidth = 3;

    ctx.lineJoin =
      "round";

    ctx.lineCap =
      "round";

    let drawing = false;

    values.forEach(
      (value, index) => {
        if (value === null) {
          drawing = false;
          return;
        }

        const x =
          paddingLeft +
          (
            labels.length === 1
              ? chartWidth / 2
              : (
                  index /
                  (labels.length - 1)
                ) *
                chartWidth
          );

        const y =
          height -
          paddingBottom -
          (
            (value - 1) /
            9
          ) *
          chartHeight;

        if (!drawing) {
          ctx.beginPath();

          ctx.moveTo(
            x,
            y
          );

          drawing = true;
        } else {
          ctx.lineTo(
            x,
            y
          );
        }
      }
    );

    if (drawing) {
      ctx.stroke();
    }

    // =================================================
    // BODY
    // =================================================

    values.forEach(
      (value, index) => {
        if (value === null) {
          return;
        }

        const x =
          paddingLeft +
          (
            labels.length === 1
              ? chartWidth / 2
              : (
                  index /
                  (labels.length - 1)
                ) *
                chartWidth
          );

        const y =
          height -
          paddingBottom -
          (
            (value - 1) /
            9
          ) *
          chartHeight;

        ctx.fillStyle =
          color;

        ctx.beginPath();

        ctx.arc(
          x,
          y,
          4,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }
    );
  });

  // ===================================================
  // POPISKY DATUMŮ
  // ===================================================

  ctx.fillStyle =
    "#777777";

  ctx.font =
    "10px system-ui";

  const maxLabels = 8;

  const step =
    Math.max(
      1,
      Math.ceil(
        labels.length /
        maxLabels
      )
    );

  labels.forEach(
    (date, index) => {
      if (
        index % step !== 0 &&
        index !== labels.length - 1
      ) {
        return;
      }

      const x =
        paddingLeft +
        (
          labels.length === 1
            ? chartWidth / 2
            : (
                index /
                (labels.length - 1)
              ) *
              chartWidth
        );

      const shortDate =
        date
          .substring(5)
          .replace("-", ".");

      ctx.fillText(
        shortDate,
        x - 12,
        height - 15
      );
    }
  );

  renderChartLegend();
}

// =====================================================
// LEGENDA KE GRAFU
// =====================================================

function renderChartLegend() {
  if (!chartCanvas) {
    return;
  }

  const chartContainer =
    chartCanvas.parentElement;

  if (!chartContainer) {
    return;
  }

  let legend =
    chartContainer.querySelector(
      ".chart-legend"
    );

  if (!legend) {
    legend =
      document.createElement(
        "div"
      );

    legend.className =
      "chart-legend";

    chartContainer.appendChild(
      legend
    );
  }

  legend.innerHTML =
    EMPLOYEES
      .map(person => {
        const color =
          PLAYER_COLORS[person];

        return `
          <div class="legend-player">

            <span
              class="legend-line"
              style="
                background:${color};
              "
            ></span>

            <span>
              ${escapeHtml(person)}
            </span>

          </div>
        `;
      })
      .join("");
}

// =====================================================
// EXPORT CSV
// =====================================================

function exportCsv() {
  const rows = [
    [
      "Rok",
      "Datum",
      "Hodina",
      "Zaměstnanec",
      "Hodnocení"
    ]
  ];

  ratings
    .slice()
    .sort(
      (a, b) => {
        if (
          a.date !== b.date
        ) {
          return String(a.date)
            .localeCompare(
              String(b.date)
            );
        }

        if (
          Number(a.hour) !==
          Number(b.hour)
        ) {
          return (
            Number(a.hour) -
            Number(b.hour)
          );
        }

        return String(a.person)
          .localeCompare(
            String(b.person)
          );
      }
    )
    .forEach(r => {
      rows.push([
        r.year,
        r.date,
        r.hour,
        r.person,
        r.score
      ]);
    });

  const csv =
    rows
      .map(row =>
        row
          .map(value =>
            `"${String(
              value ?? ""
            ).replaceAll(
              '"',
              '""'
            )}"`
          )
          .join(";")
      )
      .join("\n");

  const blob =
    new Blob(
      [
        "\ufeff" +
        csv
      ],
      {
        type:
          "text/csv;charset=utf-8;"
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href = url;

  link.download =
    `pracovni-liga-${getSelectedYear()}.csv`;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(
    url
  );

  if (status) {
    status.textContent =
      "📥 Data exportována";
  }
}

// =====================================================
// CHAT – STYLY
// =====================================================

function injectChatStyles() {
  if (
    document.getElementById(
      "pracovni-liga-chat-styles"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "pracovni-liga-chat-styles";

  style.textContent = `
    .work-chat {
      margin-top: 30px;
      padding: 20px;
      border-radius: 18px;
      background: #ffffff;
      box-shadow: 0 8px 30px rgba(0,0,0,.08);
      border: 1px solid #e5e7eb;
    }

    .work-chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 15px;
      flex-wrap: wrap;
    }

    .work-chat-title {
      font-size: 22px;
      font-weight: 800;
    }

    .work-chat-status {
      font-size: 12px;
      color: #777;
    }

    .work-chat-messages {
      height: 360px;
      overflow-y: auto;
      padding: 12px;
      background: #f7f7f8;
      border-radius: 14px;
      border: 1px solid #e5e7eb;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .work-chat-empty {
      margin: auto;
      color: #888;
      text-align: center;
      padding: 30px 10px;
    }

    .chat-message {
      max-width: 85%;
      padding: 10px 13px;
      border-radius: 14px;
      background: #fff;
      border: 1px solid #e5e7eb;
      box-shadow: 0 2px 8px rgba(0,0,0,.04);
    }

    .chat-message-name {
      font-size: 13px;
      font-weight: 800;
      margin-bottom: 3px;
    }

    .chat-message-text {
      font-size: 15px;
      line-height: 1.4;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .chat-message-time {
      margin-top: 5px;
      font-size: 10px;
      color: #999;
    }

    .chat-message-form {
      margin-top: 12px;
      display: grid;
      grid-template-columns: 180px 1fr auto;
      gap: 8px;
    }

    .chat-message-form select,
    .chat-message-form input,
    .chat-message-form button {
      min-height: 44px;
      border-radius: 10px;
      border: 1px solid #d1d5db;
      padding: 0 12px;
      font: inherit;
      box-sizing: border-box;
    }

    .chat-message-form input {
      width: 100%;
    }

    .chat-message-form button {
      border: none;
      background: #111827;
      color: white;
      font-weight: 700;
      cursor: pointer;
      padding: 0 18px;
    }

    .chat-message-form button:hover {
      opacity: .9;
    }

    .chat-message-form button:disabled {
      opacity: .5;
      cursor: not-allowed;
    }

    @media (max-width: 700px) {
      .chat-message-form {
        grid-template-columns: 1fr;
      }

      .chat-message {
        max-width: 94%;
      }

      .work-chat-messages {
        height: 320px;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}

// =====================================================
// CHAT – VYTVOŘENÍ UI
// =====================================================

function createChatUI() {
  if (
    document.getElementById(
      "work-chat"
    )
  ) {
    return;
  }

  injectChatStyles();

  const chat =
    document.createElement("section");

  chat.id =
    "work-chat";

  chat.className =
    "work-chat";

  chat.innerHTML = `
    <div class="work-chat-header">

      <div class="work-chat-title">
        💬 Pracovní chat
      </div>

      <div
        id="chatStatus"
        class="work-chat-status"
      >
        Připojuji…
      </div>

    </div>

    <div
      id="chatMessages"
      class="work-chat-messages"
    >
      <div class="work-chat-empty">
        Načítám historii chatu…
      </div>
    </div>

    <form
      id="chatForm"
      class="chat-message-form"
    >

      <select
        id="chatPerson"
        aria-label="Kdo píše"
      >
        ${EMPLOYEES
          .map(person => `
            <option value="${escapeHtml(person)}">
              ${escapeHtml(person)}
            </option>
          `)
          .join("")}
      </select>

      <input
        id="chatInput"
        type="text"
        maxlength="1000"
        autocomplete="off"
        placeholder="Napiš něco ostatním…"
      />

      <button
        type="submit"
      >
        Odeslat
      </button>

    </form>
  `;

  // Vložíme chat na konec hlavního obsahu.
  // Pokud není main, vložíme před konec body.
  const main =
    document.querySelector("main");

  if (main) {
    main.appendChild(chat);
  } else {
    document.body.appendChild(chat);
  }

  const savedPerson =
    localStorage.getItem(
      "pracovniLigaChatPerson"
    );

  if (
    savedPerson &&
    EMPLOYEES.includes(savedPerson)
  ) {
    const select =
      document.getElementById(
        "chatPerson"
      );

    if (select) {
      select.value =
        savedPerson;
    }
  }

  const select =
    document.getElementById(
      "chatPerson"
    );

  if (select) {
    select.addEventListener(
      "change",
      () => {
        localStorage.setItem(
          "pracovniLigaChatPerson",
          select.value
        );
      }
    );
  }

  const form =
    document.getElementById(
      "chatForm"
    );

  if (form) {
    form.addEventListener(
      "submit",
      sendChatMessage
    );
  }
}

// =====================================================
// CHAT – STATUS
// =====================================================

function setChatStatus(
  text,
  isError = false
) {
  const element =
    document.getElementById(
      "chatStatus"
    );

  if (!element) {
    return;
  }

  element.textContent =
    text;

  element.style.color =
    isError
      ? "#dc2626"
      : "#777777";
}

// =====================================================
// CHAT – NAČTENÍ HISTORIE
// =====================================================

async function loadChatMessages() {
  const messagesElement =
    document.getElementById(
      "chatMessages"
    );

  if (!messagesElement) {
    return;
  }

  setChatStatus(
    "Načítám historii…"
  );

  const {
    data,
    error
  } = await supabase
    .from("chat_messages")
    .select("*")
    .order(
      "created_at",
      {
        ascending: true
      }
    )
    .limit(500);

  if (error) {
    console.error(
      "CHAT LOAD ERROR:",
      error
    );

    chatMessages = [];

    messagesElement.innerHTML = `
      <div class="work-chat-empty">
        ❌ Chat se nepodařilo načíst.
        <br>
        <small>
          Zkontroluj tabulku
          <b>chat_messages</b>
          v Supabase.
        </small>
      </div>
    `;

    setChatStatus(
      "❌ Chat není připojen",
      true
    );

    return;
  }

  chatMessages =
    data || [];

  renderChatMessages();

  setChatStatus(
    "🟢 Chat připojen"
  );
}

// =====================================================
// CHAT – RENDER ZPRÁV
// =====================================================

function renderChatMessages(
  scrollToBottom = true
) {
  const container =
    document.getElementById(
      "chatMessages"
    );

  if (!container) {
    return;
  }

  if (!chatMessages.length) {
    container.innerHTML = `
      <div class="work-chat-empty">
        💬 Zatím tu nikdo nic nenapsal.
        <br>
        Buď první.
      </div>
    `;

    return;
  }

  container.innerHTML =
    chatMessages
      .map(message => {
        const person =
          EMPLOYEES.includes(
            message.person
          )
            ? message.person
            : "Neznámý";

        const color =
          PLAYER_COLORS[person] ||
          "#555555";

        const createdAt =
          message.created_at
            ? new Date(
                message.created_at
              )
            : null;

        const formattedTime =
          createdAt &&
          !Number.isNaN(
            createdAt.getTime()
          )
            ? createdAt.toLocaleString(
                "cs-CZ",
                {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                }
              )
            : "";

        return `
          <div class="chat-message">

            <div
              class="chat-message-name"
              style="color:${color}"
            >
              ${escapeHtml(person)}
            </div>

            <div class="chat-message-text">
              ${escapeHtml(message.message)}
            </div>

            <div class="chat-message-time">
              ${formattedTime}
            </div>

          </div>
        `;
      })
      .join("");

  if (scrollToBottom) {
    requestAnimationFrame(() => {
      container.scrollTop =
        container.scrollHeight;
    });
  }
}

// =====================================================
// CHAT – ODESLÁNÍ ZPRÁVY
// =====================================================

async function sendChatMessage(
  event
) {
  event.preventDefault();

  const personElement =
    document.getElementById(
      "chatPerson"
    );

  const input =
    document.getElementById(
      "chatInput"
    );

  const button =
    event.submitter ||
    event.currentTarget.querySelector(
      "button[type='submit']"
    );

  if (!personElement || !input) {
    return;
  }

  const person =
    personElement.value;

  const message =
    input.value.trim();

  if (
    !EMPLOYEES.includes(person)
  ) {
    return;
  }

  if (!message) {
    input.focus();
    return;
  }

  if (message.length > 1000) {
    alert(
      "⚠️ Zpráva může mít maximálně 1000 znaků."
    );

    return;
  }

  if (button) {
    button.disabled = true;
  }

  setChatStatus(
    "Odesílám…"
  );

  const {
    data,
    error
  } = await supabase
    .from("chat_messages")
    .insert({
      person,
      message
    })
    .select()
    .single();

  if (error) {
    console.error(
      "CHAT SEND ERROR:",
      error
    );

    alert(
      "❌ Zprávu se nepodařilo odeslat:\n\n" +
      error.message
    );

    setChatStatus(
      "❌ Chyba při odesílání",
      true
    );

    if (button) {
      button.disabled = false;
    }

    return;
  }

  input.value = "";

  if (
    data &&
    !chatMessages.some(
      item =>
        String(item.id) ===
        String(data.id)
    )
  ) {
    chatMessages.push(
      data
    );

    chatMessages.sort(
      (a, b) =>
        new Date(a.created_at) -
        new Date(b.created_at)
    );

    renderChatMessages();
  }

  setChatStatus(
    "🟢 Chat připojen"
  );

  if (button) {
    button.disabled = false;
  }

  input.focus();
}

// =====================================================
// CHAT – REALTIME
// =====================================================

function setupChatRealtime() {
  if (chatChannel) {
    return;
  }

  chatChannel =
    supabase
      .channel(
        "pracovni-liga-chat"
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages"
        },
        payload => {
          const message =
            payload.new;

          if (!message) {
            return;
          }

          if (
            chatMessages.some(
              item =>
                String(item.id) ===
                String(message.id)
            )
          ) {
            return;
          }

          chatMessages.push(
            message
          );

          chatMessages.sort(
            (a, b) =>
              new Date(a.created_at) -
              new Date(b.created_at)
          );

          if (
            chatMessages.length > 500
          ) {
            chatMessages =
              chatMessages.slice(
                -500
              );
          }

          renderChatMessages();

          setChatStatus(
            "🟢 Chat připojen"
          );
        }
      )
      .subscribe(
        status => {
          if (
            status === "SUBSCRIBED"
          ) {
            setChatStatus(
              "🟢 Chat připojen"
            );
          }

          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT"
          ) {
            setChatStatus(
              "🟡 Realtime nedostupný – kontroluji automaticky",
              true
            );
          }
        }
      );
}

// =====================================================
// CHAT – FALLBACK AUTOMATICKÉ NAČÍTÁNÍ
// =====================================================

async function refreshChatSilently() {
  const {
    data,
    error
  } = await supabase
    .from("chat_messages")
    .select("*")
    .order(
      "created_at",
      {
        ascending: true
      }
    )
    .limit(500);

  if (error) {
    console.warn(
      "CHAT REFRESH ERROR:",
      error
    );

    return;
  }

  const oldLastId =
    chatMessages.length
      ? chatMessages[
          chatMessages.length - 1
        ].id
      : null;

  chatMessages =
    data || [];

  const newLastId =
    chatMessages.length
      ? chatMessages[
          chatMessages.length - 1
        ].id
      : null;

  if (
    oldLastId !== newLastId ||
    chatMessages.length === 0
  ) {
    renderChatMessages();
  }

  setChatStatus(
    "🟢 Chat připojen"
  );
}

// =====================================================
// CHAT – START
// =====================================================

async function initChat() {
  if (chatInitialized) {
    return;
  }

  chatInitialized = true;

  createChatUI();

  await loadChatMessages();

  setupChatRealtime();

  // Záloha, pokud Supabase Realtime
  // na projektu není zapnutý.
  setInterval(
    refreshChatSilently,
    10000
  );
}

// =====================================================
// ZMĚNA DATA
// =====================================================

if (dateInput) {
  dateInput.addEventListener(
    "change",
    render
  );
}

// =====================================================
// EXPORT
// =====================================================

if (exportButton) {
  exportButton.addEventListener(
    "click",
    exportCsv
  );
}

// =====================================================
// START
// =====================================================

if (
  !SUPABASE_URL ||
  !SUPABASE_ANON_KEY
) {
  if (status) {
    status.textContent =
      "❌ Chybí Supabase konfigurace.";
  }

  alert(
    "Chybí VITE_SUPABASE_URL nebo " +
    "VITE_SUPABASE_ANON_KEY."
  );
} else {
  loadRatings();
  initChat();
}
