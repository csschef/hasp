import "./styles/tokens.css"
import "./styles/layout.css"
import "./styles/cards.css"

import "./components/toggle-switch"
import "./components/base-card"
import "./components/light-card"
import "./components/light-popup"

import { connectHA } from "./services/ha-client"

console.log("Dashboard starting")

connectHA()

/* ── Theme toggle ── */

const html = document.documentElement
const btn = document.getElementById("themeBtn") as HTMLButtonElement | null

function getSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme: "light" | "dark") {
    html.setAttribute("data-theme", theme)
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙"
    localStorage.setItem("ha-theme", theme)
}

// Initialise from localStorage or system preference
const saved = localStorage.getItem("ha-theme") as "light" | "dark" | null
applyTheme(saved ?? getSystemTheme())

btn?.addEventListener("click", () => {
    const current = html.getAttribute("data-theme") as "light" | "dark"
    applyTheme(current === "dark" ? "light" : "dark")
})
