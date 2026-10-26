import { writeFileSync } from "fs";
import { join } from "path";
import { KL_MICRO_GRAPH } from "../src/lib/routing/graph-data";
import { buildContractionHierarchy } from "../src/lib/routing/ch";

const graph = structuredClone(KL_MICRO_GRAPH);
const ch = buildContractionHierarchy(graph);

const out = {
  graph,
  ch: {
    rank: ch.rank,
    upAdj: ch.upAdj,
    downAdj: ch.downAdj,
  },
};

writeFileSync(join(process.cwd(), "public", "routing", "kl-ch.json"), JSON.stringify(out));
console.log(`Wrote CH index with ${graph.edges.length} edges (incl. shortcuts).`);
