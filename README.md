# 🔥 Burnout Meter

Webová aplikace pro 4 zaměstnance:
- Adam Juda
- Michal Mourek
- Martin Strejček
- Ladislav Čihák

Pracovní doba: 06:00–14:00.

## Funkce
- zadávání míry vyhoření 1–10 pro každou hodinu
- trvalé ukládání do SQLite databáze
- denní týmový průměr
- graf vývoje během dne
- denní vítěz
- roční žebříček a průměry
- responsivní vzhled pro mobil

## Spuštění
Vyžaduje Node.js 18+.

```bash
npm install
npm start
```

Pak otevři http://localhost:3000

## Nasazení
Projekt je připraven pro hosting, který umí spustit Node.js aplikaci. Pro skutečné dlouhodobé používání je potřeba hostovat i SQLite soubor na persistentním disku, případně později vyměnit SQLite za cloudovou databázi.
