// ---- Configuration ----
// API key is injected at deploy time by GitHub Actions.
// Store your real key in GitHub Secrets as TWELVE_DATA_API_KEY — never paste it here.
const API_KEY = "YOUR_TWELVE_DATA_API_KEY";
const MA_WINDOW = 50;
const HISTORY_SIZE = 60; // fetch a few extra days beyond the MA window

const form = document.getElementById("lookup-form");
const input = document.getElementById("ticker-input");
const statusLine = document.getElementById("status-line");
const readout = document.getElementById("readout");

const outSymbol = document.getElementById("out-symbol");
const outClose = document.getElementById("out-close");
const outMa = document.getElementById("out-ma");
const outDate = document.getElementById("out-date");
const signalWord = document.getElementById("signal-word");
const signalNote = document.getElementById("signal-note");

let chart = null;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const symbol = input.value.trim().toUpperCase();
  if (!symbol) {
    setStatus("Enter a ticker symbol first.", true);
    return;
  }
  await lookup(symbol);
});

async function lookup(symbol) {
  setStatus(`Fetching ${symbol}…`, false);
  readout.classList.add("hidden");

  try {
    const closes = await fetchHistoricalCloses(symbol);

    if (closes.length < MA_WINDOW) {
      setStatus(`Not enough history for ${symbol} to compute a ${MA_WINDOW}-day average.`, true);
      return;
    }

    const latest = closes[closes.length - 1];
    const window = closes.slice(closes.length - MA_WINDOW);
    const ma = average(window.map((p) => p.close));
    const isBuy = latest.close > ma;

    renderReadout(symbol, latest, ma, isBuy);
    renderChart(closes, ma);

    setStatus(`Loaded ${closes.length} sessions for ${symbol}.`, false);
    readout.classList.remove("hidden");
  } catch (err) {
    setStatus(err.message || "Couldn't load that ticker. Check the symbol and try again.", true);
  }
}

async function fetchHistoricalCloses(symbol) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${HISTORY_SIZE}&apikey=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status === "error" || !data.values) {
    throw new Error(data.message || `No data found for "${symbol}".`);
  }

  // API returns newest-first — reverse to oldest-first for a left-to-right chart
  return data.values
    .map((row) => ({ date: row.datetime, close: parseFloat(row.close) }))
    .reverse();
}

function average(nums) {
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function renderReadout(symbol, latest, ma, isBuy) {
  outSymbol.textContent = symbol;
  outClose.textContent = `$${latest.close.toFixed(2)}`;
  outMa.textContent = `$${ma.toFixed(2)}`;
  outDate.textContent = latest.date;

  signalWord.textContent = isBuy ? "BUY" : "SELL";
  signalWord.className = `signal-word ${isBuy ? "buy" : "sell"}`;
  signalNote.textContent = isBuy
    ? "close is above the 50-day average"
    : "close is below the 50-day average";
}

function renderChart(closes, ma) {
  const ctx = document.getElementById("price-chart").getContext("2d");
  const labels = closes.map((p) => p.date);
  const prices = closes.map((p) => p.close);
  const maLine = closes.map(() => ma);

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Close",
          data: prices,
          borderColor: "#ffd5eb",
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.15,
        },
        {
          label: `${MA_WINDOW}-day MA`,
          data: maLine,
          borderColor: "#f27fb7",
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#ffbadc", font: { family: "IBM Plex Mono", size: 11 } },
        },
      },
      scales: {
        x: {
          ticks: { color: "#a85c81", maxTicksLimit: 6, font: { family: "IBM Plex Mono", size: 10 } },
          grid: { color: "#3a1526" },
        },
        y: {
          ticks: { color: "#a85c81", font: { family: "IBM Plex Mono", size: 10 } },
          grid: { color: "#3a1526" },
        },
      },
    },
  });
}

function setStatus(message, isError) {
  statusLine.textContent = message;
  statusLine.classList.toggle("error", Boolean(isError));
}