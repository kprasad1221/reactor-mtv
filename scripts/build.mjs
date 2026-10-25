import { build } from "esbuild";
await build({
  entryPoints: ["scripts/sdk-entry.js"],
  outfile: "dist/vendor/reactor.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "linked",
  sourcemap: false,
});
console.log("Reactor SDK browser bundle ready.");
