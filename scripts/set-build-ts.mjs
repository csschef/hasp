// Writes the current ISO timestamp to .env.local before the Vite build runs.
// This ensures VITE_BUILD_TS is injected correctly into the bundle via Vite's
// standard import.meta.env mechanism — and changes on every `npm run build`.
import { writeFileSync } from "fs"

const ts = new Date().toISOString()
writeFileSync(".env.local", `VITE_BUILD_TS=${ts}\n`, "utf8")
console.log(`[build] VITE_BUILD_TS=${ts}`)
