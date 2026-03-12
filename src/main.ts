import "./styles/tokens.css"
import "./styles/layout.css"
import "./styles/cards.css"

import "./components/toggle-switch"
import "./components/base-card"
import "./components/room-divider"
import "./components/light-card"
import "./components/light-popup"
import "./components/history-popup"

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

/* ── Hash Router for Subviews ── */

/* ── Hash Router for Subviews ── */

const views = document.querySelectorAll(".view")

function handleRoute() {
    const hash = window.location.hash || "#home"
    const targetId = hash.replace("#", "")

    // Find target view; fallback to home if not found
    let targetView = document.getElementById(targetId)
    if (!targetView) {
        targetView = document.getElementById("home")
    }

    // Toggle active-subview classes, clean up old inline display attributes
    views.forEach(v => {
        v.classList.remove("slide-up", "fade-in", "active")
            ; (v as HTMLElement).style.display = ""

        if (v.id !== "home") {
            if (v === targetView) {
                v.classList.add("active-subview")
            } else {
                v.classList.remove("active-subview")
            }
        }
    })
}

window.addEventListener("hashchange", handleRoute)
// Trigger once on load
handleRoute()

    // Make goBack available globally for inline onclick triggers
    ; (window as any).goBack = function () {
        if (window.history.length > 2) {
            window.history.back()
        } else {
            window.location.hash = "#home"
        }
    }

document.addEventListener("show-history", (e: any) => {
    const pop = document.getElementById("historyPopup") as any
    if (pop && e.detail && e.detail.entity) {
        pop.open(e.detail.entity, e.detail.customTitle, e.detail.customSubtitle)
    }
})
