// Deterministic generator for the day-1 stopgap event fixture (PRD 01 §6).
// Story (PRD §14): of the whole market, only ~69% even consider our listing —
// the rest divert to competitors (who convert a couple of those sales). Among
// those who land, Photos and Price are the two killers; High-spender mostly
// leaks to convenience competitors. Replace with H4's real fixture at M2 — the
// player path is identical.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// gates the agent walks AFTER it lands on our listing
const GATES_AFTER_LAND = ["photos", "reviews", "price", "cart", "checkout"];
const RUN_ID = "run_fixture1";
let t = 1_750_000_000_000; // fixed epoch ms base (no Date.now → deterministic)
const events = [];
const push = (e) => events.push({ ...e, run_id: RUN_ID, ts: (t += e._dt ?? 0) });
const strip = (e) => {
  const { _dt, ...rest } = e;
  return rest;
};

const COMPETITORS = [
  { id: "ribknit", name: "RibKnit Co" },
  { id: "warmthreads", name: "WarmThreads" },
];
const COMP_NAME = Object.fromEntries(COMPETITORS.map((c) => [c.id, c.name]));

// objection pools (Singlish, in character) keyed by gate
const OBJ = {
  photos: [
    "Photos so blur, cannot see the knit also.",
    "Only stock photo? Want lifestyle pic lah.",
    "Eh the colour looks fake in the pic.",
  ],
  reviews: [
    "Seller never reply the bad review, sus.",
    "Only 3 reviews? Cannot trust leh.",
    "Response rate 12%?? Aiyo.",
  ],
  price: [
    "Add shipping also? Over budget liao, next.",
    "S$24.90 for a beanie? Robbery sia.",
    "Can find cheaper at Bugis lah.",
  ],
  checkout: [
    "No authenticity cert, scared kena scam.",
    "Checkout so many steps, forget it.",
  ],
};

// reasons agents leave for a competitor (before they even land on us)
const DIVERT_REASON = {
  ribknit: "RibKnit Co got better photos.",
  warmthreads: "WarmThreads cheaper with free shipping.",
};

// crowd: whole market. fate ∈
//   {kind:"buy"} | {kind:"bail", gate} | {kind:"divert", competitor, converted}
const crowd = [
  ["budget", "Ah Beng", { kind: "bail", gate: "price" }],
  ["budget", "Siti", { kind: "bail", gate: "price" }],
  ["budget", "Kumar", { kind: "divert", competitor: "ribknit", converted: false }],
  ["xmm", "Jiamin", { kind: "bail", gate: "photos" }],
  ["xmm", "Rachel", { kind: "buy" }],
  ["xmm", "Yuki", { kind: "bail", gate: "photos" }],
  ["auntie", "Auntie Lim", { kind: "bail", gate: "reviews" }],
  ["auntie", "Madam Tan", { kind: "divert", competitor: "warmthreads", converted: true }],
  ["nerd", "Wei Jie", { kind: "bail", gate: "reviews" }],
  ["nerd", "Daryl", { kind: "buy" }],
  ["geek", "Marcus", { kind: "divert", competitor: "ribknit", converted: true }],
  ["geek", "Hafiz", { kind: "bail", gate: "photos" }],
  ["insecure", "Nicole", { kind: "bail", gate: "checkout" }],
  ["insecure", "Pris", { kind: "divert", competitor: "warmthreads", converted: false }],
  ["high_spender", "Vanessa", { kind: "buy" }],
  ["high_spender", "Dr Ong", { kind: "divert", competitor: "ribknit", converted: false }],
];

const counts = {};
const agentIds = crowd.map(([arch]) => {
  counts[arch] = (counts[arch] ?? 0) + 1;
  return `${arch}_${counts[arch]}`;
});

const landed = crowd.filter(([, , f]) => f.kind !== "divert").length;
const boughtUs = crowd.filter(([, , f]) => f.kind === "buy").length;

push({
  _dt: 0,
  type: "run_started",
  listing: { title: "CozyKnit Ribbed Merino Beanie — Unisex, 8 Colours", price: 24.9, seller: "MatinKim Official" },
  agents_total: crowd.length,
  competitors: COMPETITORS,
});

// everyone enters the market (discovery)
crowd.forEach(([arch, name], i) => {
  push({ _dt: 80, type: "agent_spawned", agent_id: agentIds[i], name, archetype: arch });
});

// decision beat: each agent either lands on us or diverts to a competitor
let liveBailed = 0;
let liveDiverted = 0;
crowd.forEach(([, , fate], i) => {
  const id = agentIds[i];
  if (fate.kind === "divert") {
    push({
      _dt: 120,
      type: "agent_diverted",
      agent_id: id,
      competitor: fate.competitor,
      competitor_name: COMP_NAME[fate.competitor],
      converted: fate.converted,
      reason: DIVERT_REASON[fate.competitor],
    });
    liveDiverted++;
  } else {
    push({ _dt: 100, type: "stage_enter", agent_id: id, stage: "land" });
  }
});
push({ _dt: 40, type: "run_progress", active: landed, bought: 0, bailed: 0 });

// gate walk for everyone who landed on us
let objRot = 0;
for (let round = 0; round < GATES_AFTER_LAND.length; round++) {
  const gate = GATES_AFTER_LAND[round];
  crowd.forEach(([, , fate], i) => {
    if (fate.kind === "divert") return;
    const id = agentIds[i];
    const bailIdx = fate.kind === "bail" ? GATES_AFTER_LAND.indexOf(fate.gate) : Infinity;
    if (round > bailIdx) return; // already bailed earlier
    if (round === bailIdx) {
      const pool = OBJ[gate] ?? ["Nah, not for me."];
      const text = pool[objRot++ % pool.length];
      push({ _dt: 140, type: "objection", agent_id: id, stage: gate, text });
      push({
        _dt: 60,
        type: "agent_bailed",
        agent_id: id,
        stage: gate,
        objection: text,
        retention_time_s: 12 + round * 6 + (i % 5),
      });
      liveBailed++;
    } else {
      push({ _dt: 110, type: "stage_enter", agent_id: id, stage: gate });
    }
  });
  const active = crowd.filter(([, , f], i) => {
    if (f.kind === "divert") return false;
    const bi = f.kind === "bail" ? GATES_AFTER_LAND.indexOf(f.gate) : Infinity;
    void i;
    return bi > round;
  }).length;
  push({ _dt: 40, type: "run_progress", active, bought: 0, bailed: liveBailed });
}

// survivors buy on us
crowd.forEach(([, , fate], i) => {
  if (fate.kind !== "buy") return;
  push({ _dt: 130, type: "agent_bought", agent_id: agentIds[i], retention_time_s: 54 + i });
});

push({ _dt: 60, type: "run_progress", active: 0, bought: boughtUs, bailed: liveBailed });
push({
  _dt: 80,
  type: "run_complete",
  buy_rate: Math.round((boughtUs / landed) * 100) / 100, // of those who considered us
  report_ready: true,
});

const jsonl = events.map((e) => JSON.stringify(strip(e))).join("\n") + "\n";

for (const out of process.argv.slice(2)) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, jsonl);
  console.log(
    `wrote ${events.length} events -> ${out}  (market ${crowd.length}, considered ${landed}, diverted ${liveDiverted}, bought ${boughtUs}, bailed ${liveBailed})`,
  );
}
