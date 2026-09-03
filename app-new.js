import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const employees = [
  "Adam Juda",
  "Michal Mourek",
  "Martin Strejček",
  "Ladislav Čihák"
];

const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14];

let readings = [];

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const burnoutText = v => {
  if (v == null) return "Zatím se měříme...";
  if (v < 3) return "Jsem čerstvý, dneska to půjde.";
  if (v < 5) return "Začínám chápat, proč tu máme kafe.";
  if (v < 7) return "Potřebuju pauzu. A možná změnit kariéru.";
  if (v < 9) return "Jsem fyzicky přítomen, mentálně na dovolené.";
  if (v < 10) return "Systém zaměstnanec.exe přestává odpovídat.";
  return "☠️ Systém zaměstnanec.exe přestal odpovídat.";
};

function val(emp, date, hour) {
  return readings.find(
    x => x.employee === emp &&
         x.date === date &&
         x.hour === hour
  )?.value;
}

async function load() {
  const { data, error } = await supabase
    .from("ratings")
    .select("*")
    .order("date", { ascending: true })
    .order("hour", { ascending: true });

  if (error) {
    console.error(error);
    alert("Nepodařilo se načíst data ze Supabase.");
    return;
  }

  readings = data.map(x => ({
    id: x.id,
    employee: x.person,
    date: x.date,
    hour: x.hour,
    value: x.score
  }));

  render($("date").value);
}

async function setVal(emp, date, hour, value) {
  const existing = readings.find(
    x => x.employee === emp &&
         x.date === date &&
         x.hour === hour
  );

  let error;

  if (existing) {
    const result = await supabase
      .from("ratings")
      .update({
        score: value,
        year: Number(date.slice(0, 4))
      })
      .eq("id", existing.id);

    error = result.error;
  } else {
    const result = await supabase
      .from("ratings")
      .insert({
        year: Number(date.slice(0, 4)),
        person: emp,
        score: value,
        date,
        hour
      });

    error = result.error;
  }

  ifif (error) {
  console.error(error);
  alert(
    "CHYBA SUPABASE:\n\n" +
    "message: " + error.message + "\n\n" +
    "details: " + error.details + "\n\n" +
    "hint: " + error.hint
  );
  return;
}

  await load();
}

function render(date) {
  let html =
    "<thead><tr><th>Zaměstnanec</th>" +
    hours.map(h => `<th>${pad(h)}:00</th>`).join("") +
    "</tr></thead><tbody>";

  employees.forEach(emp => {
    html += `<tr><td class="name">${emp}</td>`;

    hours.forEach(hour => {
      const value = val(emp, date, hour);

      const current =
        new Date().getHours() === hour && date === today()
          ? " current"
          : "";

      html += `
        <td>
          <button
            class="cell${current}${value == null ? " empty" : ""}"
            onclick="choose('${emp.replace(/'/g, "\\'")}','${date}',${hour})"
          >
            ${value ?? "—"}
          </button>
        </td>
      `;
    });

    html += "</tr>";
  });

  $("meter").innerHTML = html;

  const vals = employees
    .flatMap(e => hours.map(h => val(e, date, h)))
    .filter(v => v != null);

  const avg = vals.length
    ? vals.reduce((a, b) => a + b, 0) / vals.length
    : null;

  $("teamScore").textContent =
    avg != null ? avg.toFixed(1) + "/10" : "—";

  $("teamText").textContent = burnoutText(avg);

  const currentHour = new Date().getHours();

  $("currentHour").textContent =
    hours.includes(currentHour)
      ? pad(currentHour) + ":00"
      : "Mimo pracovní dobu";

  const currentValues = hours.includes(currentHour)
    ? employees
        .map(e => val(e, date, currentHour))
        .filter(v => v != null)
    : [];

  $("hourText").textContent = currentValues.length
    ? burnoutText(
        currentValues.reduce((a, b) => a + b, 0) /
        currentValues.length
      )
    : "Zadejte hodnoty.";

  const avgs = employees
    .map(e => {
      const values = hours
        .map(h => val(e, date, h))
        .filter(v => v != null);

      return {
        e,
        avg: values.length
          ? values.reduce((a, b) => a + b, 0) / values.length
          : null
      };
    })
    .filter(x => x.avg != null)
    .sort((a, b) => b.avg - a.avg);

  $("winner").textContent = avgs[0]?.e || "—";

  drawChart(date);
  renderYear();
}

async function choose(emp, date, hour) {
  const old = val(emp, date, hour);

  const input = prompt(
    `${emp} • ${pad(hour)}:00\n` +
    `Míra vyhoření 1–10${old ? ` (aktuálně ${old})` : ""}\n\n` +
    `1 = úplná pohoda\n` +
    `10 = zaměstnanec.exe přestal odpovídat`,
    old ?? ""
  );

  if (input === null) return;

  const value = Math.round(Number(input));

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 10
  ) {
    alert("Zadej číslo od 1 do 10.");
    return;
  }

  await setVal(emp, date, hour, value);
}

window.choose = choose;

function drawChart(date) {
  const canvas = $("chart");

  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = 330;

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const averages = hours.map(hour => {
    const values = employees
      .map(e => val(e, date, hour))
      .filter(v => v != null);

    return values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  });

  const padL = 45;
  const padR = 20;
  const padT = 20;
  const padB = 40;

  const plotWidth = width - padL - padR;
  const plotHeight = height - padT - padB;

  ctx.strokeStyle = "#ddd";
  ctx.fillStyle = "#777";
  ctx.font = "12px system-ui";

  for (let y = 1; y <= 10; y++) {
    const yy =
      padT +
      plotHeight -
      ((y - 1) / 9) * plotHeight;

    ctx.beginPath();
    ctx.moveTo(padL, yy);
    ctx.lineTo(width - padR, yy);
    ctx.stroke();

    ctx.fillText(y, padL - 25, yy + 4);
  }

  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.beginPath();

  let started = false;

  averages.forEach((value, i) => {
    if (value == null) {
      started = false;
      return;
    }

    const x =
      padL +
      i * (plotWidth / (hours.length - 1));

    const y =
      padT +
      plotHeight -
      ((value - 1) / 9) * plotHeight;

    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  ctx.fillStyle = "#111";

  hours.forEach((hour, i) => {
    const x =
      padL +
      i * (plotWidth / (hours.length - 1));

    ctx.fillText(
      pad(hour) + ":00",
      x - 15,
      height - 12
    );
  });
}

function renderYear() {
  const year = Number($("year").value);

  const rows = readings.filter(
    x => x.date?.startsWith(year + "-")
  );

  const stats = employees
    .map(employee => {
      const values = rows
        .filter(x => x.employee === employee)
        .map(x => x.value);

      return {
        e: employee,
        n: values.length,
        avg: values.length
          ? values.reduce((a, b) => a + b, 0) / values.length
          : null
      };
    })
    .filter(x => x.avg != null)
    .sort((a, b) => b.avg - a.avg);

  $("leaderboard").innerHTML = stats.length
    ? stats
        .map(
          (x, i) => `
            <div class="rank ${i === 0 ? "first" : ""}">
              <strong>
                ${["🥇", "🥈", "🥉", "4️⃣"][i] || ""}
              </strong>

              <span>
                ${x.e}
                <small style="display:block;color:#888">
                  ${x.n} měření
                </small>
              </span>

              <span class="avg">
                ${x.avg.toFixed(2)} / 10
              </span>
            </div>
          `
        )
        .join("")
    : `<div class="muted">
        Pro rok ${year} zatím nejsou data.
       </div>`;
}

$("date").value = today();

$("date").addEventListener("change", load);

$("todayBtn").onclick = () => {
  $("date").value = today();
  load();
};

for (
  let year = new Date().getFullYear();
  year >= 2026;
  year--
) {
  $("year").innerHTML += `<option>${year}</option>`;
}

$("year").addEventListener("change", renderYear);

load();
