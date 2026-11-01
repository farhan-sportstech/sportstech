// Invented sample data shaped like order lines grouped by Berlin weekday × hour over 28 complete days.
import { rng } from "./mock";
import { KPI_CATS } from "./kpi";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HEAT_WINDOW = { from: "3 Oct", to: "30 Oct 2026", days: 28 };
/** [sales €, units, order lines] */
export type HeatCell = [number, number, number];

// orders per hour across a day: a quiet night, a morning climb, a lunch bump and the evening peak
const HOUR = [0.18, 0.1, 0.06, 0.04, 0.04, 0.07, 0.17, 0.36, 0.55, 0.68, 0.74, 0.8, 0.86, 0.78, 0.74, 0.76, 0.82, 0.92, 1.0, 1.12, 1.2, 1.1, 0.82, 0.45];
const DAY = [1.02, 0.97, 0.95, 0.94, 0.86, 0.92, 1.24];
const SHARE: Record<string, number> = { Treadmills: 0.5, "Exercise bikes": 0.13, "Vibration plates": 0.09, "Cross trainers": 0.06, "Rowing machines": 0.05, "Strength stations": 0.04, "Benches & weights": 0.05, "Small equipment": 0.05, "Hoverboards & scooters": 0.02, Trampolines: 0.01 };
const PRICE: Record<string, number> = { Treadmills: 420, "Exercise bikes": 330, "Vibration plates": 190, "Cross trainers": 380, "Rowing machines": 360, "Strength stations": 690, "Benches & weights": 140, "Small equipment": 32, "Hoverboards & scooters": 230, Trampolines: 120 };

export const HEAT: Record<string, HeatCell[][]> = (() => {
  const rnd = rng(1207);
  const totalLines = 6400; // order lines over the 28 days, whole account
  const out: Record<string, HeatCell[][]> = {};
  const all: HeatCell[][] = WEEKDAYS.map(() => HOUR.map(() => [0, 0, 0] as HeatCell));
  const norm = DAY.reduce((a, d) => a + d, 0) * HOUR.reduce((a, h) => a + h, 0);
  for (const cat of KPI_CATS) {
    // evening-heavy for home fitness, a touch earlier for small equipment
    const shift = cat === "Small equipment" ? -2 : cat === "Treadmills" ? 0 : rnd() < 0.5 ? 1 : 0;
    out[cat] = WEEKDAYS.map((_, d) =>
      HOUR.map((_, h) => {
        const hw = HOUR[(h - shift + 24) % 24];
        const lines = Math.round(((totalLines * SHARE[cat] * DAY[d] * hw) / norm) * (0.6 + rnd() * 0.8));
        const units = Math.round(lines * (1 + rnd() * 0.12));
        const sales = Math.round(units * PRICE[cat] * (0.85 + rnd() * 0.3));
        const a = all[d][h];
        a[0] += sales;
        a[1] += units;
        a[2] += lines;
        return [sales, units, lines] as HeatCell;
      }),
    );
  }
  return { All: all, ...out };
})();
