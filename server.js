const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(process.env.DB_PATH || path.join(__dirname, "burnout.db"));

db.exec(`
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee TEXT NOT NULL,
  date TEXT NOT NULL,
  hour INTEGER NOT NULL,
  value INTEGER NOT NULL CHECK(value BETWEEN 1 AND 10),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee, date, hour)
);
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/readings", (req,res) => {
  const from = req.query.from || "1900-01-01";
  const to = req.query.to || "2999-12-31";
  const rows = db.prepare(`
    SELECT employee,date,hour,value FROM readings
    WHERE date BETWEEN ? AND ?
    ORDER BY date,hour,employee
  `).all(from,to);
  res.json(rows);
});

app.put("/api/readings", (req,res) => {
  const {employee,date,hour,value} = req.body;
  if (!employee || !date || !Number.isInteger(hour) || !Number.isInteger(value) ||
      hour < 6 || hour > 14 || value < 1 || value > 10) {
    return res.status(400).json({error:"Neplatná data"});
  }
  db.prepare(`
    INSERT INTO readings(employee,date,hour,value)
    VALUES(?,?,?,?)
    ON CONFLICT(employee,date,hour) DO UPDATE SET value=excluded.value
  `).run(employee,date,hour,value);
  res.json({ok:true});
});

app.delete("/api/readings", (req,res) => {
  const {employee,date,hour} = req.body;
  db.prepare(`DELETE FROM readings WHERE employee=? AND date=? AND hour=?`)
    .run(employee,date,hour);
  res.json({ok:true});
});

app.get("*", (req,res) => res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT, () => console.log(`Burnout Meter běží na portu ${PORT}`));
