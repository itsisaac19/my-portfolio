import { defineConfig, type Plugin } from "vite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = import.meta.dirname;
const partialsDir = resolve(root, "src/partials");

/** `<!-- @include name -->` → contents of src/partials/name.html. Zero-dependency HTML partials. */
function partials(): Plugin {
  return {
    name: "html-partials",
    transformIndexHtml: {
      order: "pre",
      handler: (html) =>
        html.replace(/<!--\s*@include\s+([\w-]+)\s*-->/g, (_, name: string) =>
          readFileSync(resolve(partialsDir, `${name}.html`), "utf8"),
        ),
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(partialsDir)) server.ws.send({ type: "full-reload" });
    },
  };
}

// Every top-level .html file is a page.
const pages = Object.fromEntries(
  readdirSync(root)
    .filter((f) => f.endsWith(".html"))
    .map((f) => [f.replace(/\.html$/, ""), resolve(root, f)]),
);

export default defineConfig({
  base: "./",
  plugins: [partials()],
  build: { rollupOptions: { input: pages }, target: "es2022" },
});
