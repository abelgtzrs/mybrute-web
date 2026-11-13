import type { RankInfo } from "../api";

/** The rank's icon (copied from the original game into /public/ranks). */
export function RankIcon({ rank }: { rank: RankInfo }) {
  return <img className="rank-icon" src={`/ranks/${rank.rank}.png`} alt={rank.name} title={rank.name} width={20} height={20} />;
}

/** Marks brutes made by an admin: they ignore level caps. */
export function AdminBruteLabel() {
  return <span className="badge gold">Admin brute</span>;
}
