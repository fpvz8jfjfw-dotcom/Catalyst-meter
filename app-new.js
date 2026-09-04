import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ===============================
// PRACOVNÍ LIGA
// ===============================

const EMPLOYEES = [
  "Adam Juda",
  "Michal Mourek",
  "Martin Strejček",
  "Ladislav Čihák"
];

const HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

let ratings = [];

const dateInput = document.getElementById("date");
const table = document.getElementById("ratings");
const status = document.getElementById("status");
const leaderboard = document.getElementById("leaderboard");

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

dateInput.value = today();

// ===============================
// NAČTENÍ DAT
// ===============================

async function loadRatings() {
  status.textContent = "Načítám data…";

  const { data, error } = await supabase
    .from("ratings")
    .select("*")
    .order("date", { ascending: true })
    .order("hour", { ascending: true });

  if (error) {
    console.error("SUPABASE LOAD ERROR:", error);

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

  status.textContent = "✅ Data načtena";

  render();
}

// ===============================
// VYKRESLENÍ TABULKY
// ===============================

function render() {
  const date = dateInput.value;

  let html = `
    <table>
      <thead>
        <tr>
          <th>Zaměstnanec</th>
          ${HOURS.map(h => `<th>${h}:00</th>`).join("")}
        </tr>
      </thead>

      <tbody>
  `;

  for (const employee of EMPLOYEES) {
    html += `<tr>`;

    html += `
      <td class="employee">
        ${employee}
      </td>
    `;

    for (const hour of HOURS) {
      const rating = ratings.find(
        r =>
          r.person === employee &&
          r.date === date &&
          Number(r.hour) === hour
      );

      const value = rating ? rating.score : "";

      html += `
        <td>
          <button
            class="rating rating-${value || "empty"}"
            data-person="${employee}"
            data-hour="${hour}"
          >
            ${value || "—"}
          </button>
        </td>
      `;
    }

    html += `</tr>`;
  }

  html += `
      </tbody>
    </table>
  `;

  table.innerHTML = html;

  document
    .querySelectorAll(".rating")
    .forEach(button => {
      button.addEventListener("click", () => {
        const person = button.dataset.person;
        const hour = Number(button.dataset.hour);

        enterRating(person, hour);
      });
    });

  renderLeaderboard();
}

// ===============================
// ZADÁNÍ HODNOCENÍ
// ===============================

async function enterRating(person, hour) {
  const date = dateInput.value;

  const existing = ratings.find(
    r =>
      r.person === person &&
      r.date === date &&
      Number(r.hour) === hour
  );

  const current = existing ? existing.score : "";

  const input = prompt(
    `${person}\n${hour}:00\n\n` +
    `Míra vyhoření 1–10\n\n` +
    `1 = Dobře jedu\n` +
    `2 = Jde to jako po másle\n` +
    `3 = Dneska to feeluju\n` +
    `4 = Nebudu tady dělat všechno, do piče\n` +
    `5 = Dneska to necejtím\n` +
    `6 = Děleeej, tak už to pískni\n` +
    `7 = Nebudu to dělat\n` +
    `8 = Dneska už netahám\n` +
    `9 = Kávec a domů\n` +
    `10 = TOTAL BURNOUT\n\n` +
    (existing ? `Pro smazání napiš: smazat` : ""),
    current
  );

  if (input === null) {
    return;
  }

  // ===============================
  // SMAZÁNÍ HODNOCENÍ
  // ===============================

  if (existing && input.trim().toLowerCase() === "smazat") {
    status.textContent = "Mažu…";

    const result = await supabase
      .from("ratings")
      .delete()
      .eq("id", existing.id);

    if (result.error) {
      console.error("SUPABASE DELETE ERROR:", result.error);

      alert(
        "❌ Chyba při mazání:\n\n" +
        result.error.message +
        "\n\n" +
        (result.error.details || "") +
        "\n\n" +
        (result.error.hint || "")
      );

      status.textContent = "❌ Chyba při mazání";
      return;
    }

    ratings = ratings.filter(
      r => r.id !== existing.id
    );

    status.textContent = "✅ Smazáno";

    render();

    return;
  }

  // ===============================
  // KONTROLA HODNOTY
  // ===============================

  const score = Number(input);

  if (!Number.isInteger(score) || score < 1 || score > 10) {
    alert(
      "Zadej celé číslo od 1 do 10,\n" +
      "nebo napiš „smazat“."
    );

    return;
  }

  // ===============================
  // UKLÁDÁNÍ
  // ===============================

  status.textContent = "Ukládám…";

  const payload = {
    year: Number(date.substring(0, 4)),
    person: person,
    score: score,
    date: date,
    hour: hour
  };

  let result;

  if (existing) {
    result = await supabase
      .from("ratings")
      .update(payload)
      .eq("id", existing.id);
  } else {
    result = await supabase
      .from("ratings")
      .insert(payload);
  }

  if (result.error) {
    console.error("SUPABASE SAVE ERROR:", result.error);

    alert(
      "❌ Chyba při ukládání:\n\n" +
      result.error.message +
      "\n\n" +
      (result.error.details || "") +
      "\n\n" +
      (result.error.hint || "")
    );

    status.textContent = "❌ Chyba při ukládání";

    return;
  }

  status.textContent = "✅ Uloženo";

  await loadRatings();
}


// ===============================
// LEADERBOARD
// ===============================

function renderLeaderboard() {
  const selectedYear =
    Number(dateInput.value.substring(0, 4));

  const yearRatings = ratings.filter(
    r =>
      Number(r.year) === selectedYear &&
      EMPLOYEES.includes(r.person)
  );

  const results = EMPLOYEES.map(person => {
    const values = yearRatings
      .filter(r => r.person === person)
      .map(r => Number(r.score))
      .filter(v => Number.isFinite(v));

    if (!values.length) {
      return {
        person,
        average: null,
        count: 0
      };
    }

    const average =
      values.reduce((a, b) => a + b, 0) /
      values.length;

    return {
      person,
      average,
      count: values.length
    };
  });

  results.sort((a, b) => {
    if (a.average === null) return 1;
    if (b.average === null) return -1;

    return b.average - a.average;
  });

  leaderboard.innerHTML = results
    .map((result, index) => {
      const medal =
        index === 0 ? "🥇" :
        index === 1 ? "🥈" :
        index === 2 ? "🥉" :
        "🏅";

      return `
        <div class="leader">
          <span class="medal">${medal}</span>

          <strong>
            ${result.person}
          </strong>

          <span>
            ${
              result.average === null
                ? "zatím bez dat"
                : result.average.toFixed(2) + " / 10"
            }
          </span>

          <small>
            ${result.count} měření
          </small>
        </div>
      `;
    })
    .join("");
}

// ===============================
// ZMĚNA DATA
// ===============================

dateInput.addEventListener(
  "change",
  render
);

// ===============================
// START
// ===============================

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  status.textContent =
    "❌ Chybí Supabase konfigurace.";

  alert(
    "Chybí VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY."
  );
} else {
  loadRatings();
}
