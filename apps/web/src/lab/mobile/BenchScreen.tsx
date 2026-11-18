// Mobile Lab: the bench as a full screen (the desktop Lab shows the same list in a drawer).
import { BenchList } from "../Bench";
import type { Lab } from "../useLab";

export function BenchScreen({ lab }: { lab: Lab }) {
  const { draft, spec } = lab;
  return (
    <div className="panel mbench">
      <BenchList
        items={lab.bench}
        takenIds={spec.brutes.map((b) => b.id)}
        onUse={lab.applyBenchBrute}
        onEdit={lab.editBench}
        editing={draft?.kind === "bench" ? draft.item.key : null}
        where={lab.store.where}
        onNotify={lab.notify}
        onImport={lab.importToBench}
        onDelete={lab.deleteFromBench}
      />
    </div>
  );
}
