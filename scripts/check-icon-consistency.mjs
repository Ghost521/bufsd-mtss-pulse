import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

const sidebar = read("src/components/Sidebar.tsx");
const app = read("src/components/App.tsx");

const failures = [];

const assertMatch = (condition, message) => {
  if (!condition) failures.push(message);
};

assertMatch(sidebar.includes("getRouteIcon"), "Sidebar must resolve navigation icons via getRouteIcon.");
assertMatch(!/MessageCircle/.test(sidebar), "Sidebar must not use MessageCircle for messages navigation.");
assertMatch(!/\bid:\s*"[^"]+",\s*icon:\s*[A-Za-z0-9_]+/m.test(sidebar), "Sidebar menu definitions must not hardcode per-item icon mappings.");

assertMatch(app.includes("getRouteIcon('messages')"), "Header messages action should use canonical route icon mapping.");
assertMatch(app.includes("getRouteIcon('reports')"), "Header reports action should use canonical route icon mapping.");
assertMatch(app.includes("getRouteIcon('map')"), "Header map action should use canonical route icon mapping.");
assertMatch(!/id:\s*'district-map'[\s\S]*?icon:\s*Users/m.test(app), "District map action must not use Users icon.");

if (failures.length > 0) {
  console.error("Icon consistency check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Icon consistency check passed.");

