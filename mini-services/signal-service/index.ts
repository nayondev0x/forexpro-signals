import { Server } from "socket.io";

const io = new Server({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const FOREX_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
  "AUD/USD", "NZD/USD", "USD/CAD", "EUR/GBP",
  "EUR/JPY", "GBP/JPY", "XAU/USD", "XAG/USD",
];

interface Signal {
  id: string;
  pair: string;
  type: "BUY" | "SELL";
  entry: number;
  tp: number;
  sl: number;
  timestamp: string;
  status: "ACTIVE" | "TP_HIT" | "SL_HIT" | "CLOSED";
  pips?: number;
}

interface PriceUpdate {
  pair: string;
  bid: number;
  ask: number;
  spread: number;
  change: number;
  changePercent: number;
}

const basePrices: Record<string, number> = {
  "EUR/USD": 1.0872,
  "GBP/USD": 1.2715,
  "USD/JPY": 157.85,
  "USD/CHF": 0.8935,
  "AUD/USD": 0.6648,
  "NZD/USD": 0.6115,
  "USD/CAD": 1.3675,
  "EUR/GBP": 0.8552,
  "EUR/JPY": 171.65,
  "GBP/JPY": 200.72,
  "XAU/USD": 2345.50,
  "XAG/USD": 29.45,
};

let activeSignals: Signal[] = [];
let signalIdCounter = 1;

function generateSignal(): Signal {
  const pair = FOREX_PAIRS[Math.floor(Math.random() * FOREX_PAIRS.length)];
  const type: "BUY" | "SELL" = Math.random() > 0.5 ? "BUY" : "SELL";
  const basePrice = basePrices[pair];
  const isJPY = pair.includes("JPY");
  const isGold = pair.includes("XAU");
  const isSilver = pair.includes("XAG");

  let pipMultiplier: number;
  let tpDistance: number;
  let slDistance: number;

  if (isGold) {
    pipMultiplier = 0.01;
    tpDistance = (Math.random() * 30 + 15) * pipMultiplier;
    slDistance = (Math.random() * 15 + 8) * pipMultiplier;
  } else if (isSilver) {
    pipMultiplier = 0.01;
    tpDistance = (Math.random() * 0.8 + 0.3) * pipMultiplier;
    slDistance = (Math.random() * 0.4 + 0.15) * pipMultiplier;
  } else if (isJPY) {
    pipMultiplier = 0.01;
    tpDistance = (Math.random() * 40 + 20) * pipMultiplier;
    slDistance = (Math.random() * 20 + 10) * pipMultiplier;
  } else {
    pipMultiplier = 0.0001;
    tpDistance = (Math.random() * 40 + 15) * pipMultiplier;
    slDistance = (Math.random() * 20 + 8) * pipMultiplier;
  }

  const entry = basePrice + (Math.random() - 0.5) * pipMultiplier * 10;
  const tp = type === "BUY" ? entry + tpDistance : entry - tpDistance;
  const sl = type === "BUY" ? entry - slDistance : entry + slDistance;

  return {
    id: `SIG-${String(signalIdCounter++).padStart(4, "0")}`,
    pair,
    type,
    entry: parseFloat(entry.toFixed(isJPY || isGold || isSilver ? 2 : 4)),
    tp: parseFloat(tp.toFixed(isJPY || isGold || isSilver ? 2 : 4)),
    sl: parseFloat(sl.toFixed(isJPY || isGold || isSilver ? 2 : 4)),
    timestamp: new Date().toISOString(),
    status: "ACTIVE",
  };
}

function generatePriceUpdate(): PriceUpdate {
  const pair = FOREX_PAIRS[Math.floor(Math.random() * FOREX_PAIRS.length)];
  const basePrice = basePrices[pair];
  const isJPY = pair.includes("JPY");
  const isGold = pair.includes("XAU");
  const isSilver = pair.includes("XAG");
  const decimals = isJPY || isGold || isSilver ? 2 : 5;

  const fluctuation = basePrice * (Math.random() - 0.5) * 0.002;
  const mid = basePrice + fluctuation;
  const spreadPoints = isGold ? 0.30 : isSilver ? 0.03 : isJPY ? 0.03 : 0.00015;
  const bid = mid - spreadPoints / 2;
  const ask = mid + spreadPoints / 2;
  const change = fluctuation;
  const changePercent = (change / basePrice) * 100;

  return {
    pair,
    bid: parseFloat(bid.toFixed(decimals)),
    ask: parseFloat(ask.toFixed(decimals)),
    spread: parseFloat(spreadPoints.toFixed(decimals)),
    change: parseFloat(change.toFixed(decimals)),
    changePercent: parseFloat(changePercent.toFixed(3)),
  };
}

// Generate initial signals
for (let i = 0; i < 6; i++) {
  activeSignals.push(generateSignal());
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send initial data
  socket.emit("signals", activeSignals);

  // Send all current prices
  const initialPrices = FOREX_PAIRS.map((pair) => {
    const basePrice = basePrices[pair];
    const isJPY = pair.includes("JPY");
    const isGold = pair.includes("XAU");
    const isSilver = pair.includes("XAG");
    const decimals = isJPY || isGold || isSilver ? 2 : 5;
    const spreadPoints = isGold ? 0.30 : isSilver ? 0.03 : isJPY ? 0.03 : 0.00015;
    return {
      pair,
      bid: parseFloat((basePrice - spreadPoints / 2).toFixed(decimals)),
      ask: parseFloat((basePrice + spreadPoints / 2).toFixed(decimals)),
      spread: parseFloat(spreadPoints.toFixed(decimals)),
      change: 0,
      changePercent: 0,
    };
  });
  socket.emit("prices", initialPrices);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Broadcast new signals every 15-30 seconds
function broadcastNewSignal() {
  const newSignal = generateSignal();
  activeSignals.unshift(newSignal);

  // Keep only last 20 signals
  if (activeSignals.length > 20) {
    activeSignals = activeSignals.slice(0, 20);
  }

  io.emit("new_signal", newSignal);
  io.emit("signals", activeSignals);
  console.log("New signal:", newSignal.id, newSignal.pair, newSignal.type);

  // Schedule next signal
  const nextDelay = 15000 + Math.random() * 15000;
  setTimeout(broadcastNewSignal, nextDelay);
}

// Broadcast price updates every 2 seconds
function broadcastPriceUpdates() {
  const updates: PriceUpdate[] = [];
  const numUpdates = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < numUpdates; i++) {
    updates.push(generatePriceUpdate());
  }
  io.emit("price_updates", updates);

  setTimeout(broadcastPriceUpdates, 1500 + Math.random() * 1500);
}

// Simulate signal status changes
function updateSignalStatuses() {
  activeSignals.forEach((signal) => {
    if (signal.status !== "ACTIVE") return;
    if (Math.random() < 0.1) {
      const isWin = Math.random() > 0.35;
      signal.status = isWin ? "TP_HIT" : "SL_HIT";
      const isJPY = signal.pair.includes("JPY");
      const isGold = signal.pair.includes("XAU");
      const isSilver = signal.pair.includes("XAG");

      if (isGold) {
        signal.pips = signal.status === "TP_HIT"
          ? parseFloat((Math.abs(signal.tp - signal.entry)).toFixed(2))
          : parseFloat((Math.abs(signal.sl - signal.entry)).toFixed(2));
      } else if (isSilver) {
        signal.pips = signal.status === "TP_HIT"
          ? parseFloat((Math.abs(signal.tp - signal.entry) * 100).toFixed(1))
          : parseFloat((Math.abs(signal.sl - signal.entry) * 100).toFixed(1));
      } else if (isJPY) {
        signal.pips = signal.status === "TP_HIT"
          ? parseFloat((Math.abs(signal.tp - signal.entry) * 100).toFixed(1))
          : -parseFloat((Math.abs(signal.sl - signal.entry) * 100).toFixed(1));
      } else {
        signal.pips = signal.status === "TP_HIT"
          ? parseFloat((Math.abs(signal.tp - signal.entry) * 10000).toFixed(1))
          : -parseFloat((Math.abs(signal.sl - signal.entry) * 10000).toFixed(1));
      }

      io.emit("signal_update", signal);
    }
  });

  // Update base prices slightly
  FOREX_PAIRS.forEach((pair) => {
    basePrices[pair] += basePrices[pair] * (Math.random() - 0.5) * 0.0003;
  });

  setTimeout(updateSignalStatuses, 8000 + Math.random() * 7000);
}

// Start broadcasting
setTimeout(broadcastNewSignal, 5000);
setTimeout(broadcastPriceUpdates, 1000);
setTimeout(updateSignalStatuses, 10000);

const PORT = 3003;
io.listen(PORT);
console.log(`Signal service running on port ${PORT}`);