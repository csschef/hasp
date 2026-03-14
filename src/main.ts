import "./styles/tokens.css"
import "./styles/layout.css"
import "./styles/cards.css"

import { connectHA } from "./services/ha-client"
import { subscribeEntity, getEntity } from "./store/entity-store"
import { callService } from "./services/ha-service"

connectHA()

import "./components/toggle-switch"
import "./components/base-card"
import "./components/room-divider"
import "./components/light-card"
import "./components/light-popup"
import "./components/history-popup"
import "./components/weather-card"
import "./components/person-card"
import "./components/person-popup"
import "./components/tv-card"
import "./components/tv-popup"
import "./components/settings-popup"
import "./components/user-header"
import "./components/kitchen-view"
import "./components/energy-view"

/* ── TRAY & NOTIFICATIONS ── */

const trayTiles = {
    guest: { id: "input_boolean.gast", el: document.getElementById("toggleGuestMode") },
    sleep: { id: "input_boolean.sovlage", el: document.getElementById("toggleSleepMode") }
}

// Subscribe to Booleans for Tray Tiles
Object.values(trayTiles).forEach(tile => {
    if (!tile.id) return
    subscribeEntity(tile.id, (state: any) => {
        if (state?.state === "on") {
            tile.el?.classList.add("active")
        } else {
            tile.el?.classList.remove("active")
        }
    })
})

// Tray Toggles
trayTiles.guest.el?.addEventListener("click", (e) => {
    e.stopPropagation()
    const currentState = getEntity(trayTiles.guest.id)?.state === "on"
    callService("input_boolean", currentState ? "turn_off" : "turn_on", { entity_id: trayTiles.guest.id })
})

trayTiles.sleep.el?.addEventListener("click", (e) => {
    e.stopPropagation()
    const currentState = getEntity(trayTiles.sleep.id)?.state === "on"
    callService("input_boolean", currentState ? "turn_off" : "turn_on", { entity_id: trayTiles.sleep.id })
})

// Dark mode / Theme logic
const html = document.documentElement
const themeTile = document.getElementById("toggleThemeTray")
const themeIcon = document.getElementById("themeBtnIcon")

themeTile?.addEventListener("click", (e) => {
    e.stopPropagation()
    const currentTheme = html.getAttribute("data-theme") === "dark" ? "light" : "dark"
    applyTheme(currentTheme as any)
})

function applyTheme(theme: "light" | "dark") {
    html.setAttribute("data-theme", theme)
    const isDark = theme === "dark"
    const iconEl = themeIcon as (HTMLElement & { icon?: string }) | null
    if (iconEl) {
        if ('icon' in iconEl) {
            iconEl.icon = isDark ? "ph:moon-fill" : "ph:sun"
        }
    }
    localStorage.setItem("ha-theme", theme)
    themeTile?.classList.toggle("active", isDark)
}

// ── Notification System ──

const notifications = [
    { 
        id: "counter.kattlada", 
        msg: "Dags att tömma kattlådan", 
        icon: "lucide:cat", 
        type: "counter",
        check: (state: any) => parseInt(state?.state) > 3 
    },
    { 
        id: "counter.kattlada_2", 
        msg: "Töm kattlådan i källaren", 
        icon: "lucide:cat", 
        type: "counter",
        check: (state: any) => parseInt(state?.state) > 3 
    },
    { 
        id: "input_boolean.posten_har_kommit", 
        msg: "Det finns post i brevlådan", 
        icon: "lucide:mail", 
        type: "boolean",
        check: (state: any) => state?.state === "on" 
    }
]

// Global action handler for notification buttons
;(window as any).notifAction = (action: string, entityId: string) => {
    const domain = entityId.split('.')[0];
    if (domain === 'counter') {
        if (action === 'plus') callService("counter", "increment", { entity_id: entityId });
        if (action === 'minus') callService("counter", "decrement", { entity_id: entityId });
        if (action === 'reset') callService("counter", "reset", { entity_id: entityId });
    } else if (domain === 'input_boolean') {
        if (action === 'off') callService("input_boolean", "turn_off", { entity_id: entityId });
    }
};

function updateNotifications() {
    const list = document.getElementById("notificationList")
    const badge = document.getElementById("notifBadge")
    const bellBox = document.querySelector(".notification-bell-box")
    const bellIcon = bellBox?.querySelector("iconify-icon") as any

    if (!list) return
    
    const active = notifications.filter(n => {
        const entity = getEntity(n.id)
        return n.check(entity)
    })

    if (badge) {
        badge.innerText = active.length.toString()
        badge.style.display = active.length > 0 ? "flex" : "none"
    }

    if (bellBox) {
        if (active.length > 0) {
            bellBox.classList.add("has-notifs")
            if (bellIcon) bellIcon.icon = "ph:bell-simple-fill"
        } else {
            bellBox.classList.remove("has-notifs")
            if (bellIcon) bellIcon.icon = "ph:bell-simple"
        }
    }

    if (active.length === 0) {
        list.innerHTML = `<div style="padding: 28px 16px; text-align: center; color: var(--text-secondary); font-size: 13px; font-weight: 500;">Inga nya notiser</div>`
    } else {
        list.innerHTML = active.map(n => {
            const entity = getEntity(n.id);
            const val = entity?.state || "0";
            
            return `
            <div style="background: var(--color-card); padding: 14px; border-radius: var(--radius-md); margin-bottom: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; gap: 12px; align-items: center;">
                    <div style="width: 38px; height: 38px; border-radius: var(--radius-sm); background: var(--accent-muted); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <iconify-icon icon="${n.icon}" style="color: var(--accent); font-size: 18px;"></iconify-icon>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${n.msg}</div>
                        ${n.type === 'counter' ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 1px;">${val} st</div>` : ''}
                    </div>
                </div>
                <div class="notif-actions" onclick="event.stopPropagation()">
                    ${n.type === 'counter' ? `
                        <button class="action-btn" onclick="notifAction('minus', '${n.id}')"><iconify-icon icon="lucide:minus" style="font-size:14px;"></iconify-icon></button>
                        <button class="action-btn" onclick="notifAction('plus', '${n.id}')"><iconify-icon icon="lucide:plus" style="font-size:14px;"></iconify-icon></button>
                        <button class="action-btn primary" onclick="notifAction('reset', '${n.id}')">Klar</button>
                    ` : `
                        <button class="action-btn primary" onclick="notifAction('off', '${n.id}')">Tömd</button>
                    `}
                </div>
            </div>
        `}).join('')
    }
}

notifications.forEach(n => subscribeEntity(n.id, updateNotifications))

// ── Global Navigation ──
const MAIN_TABS = ["home", "kitchen", "energy"]

;(window as any).goBack = function() {
    window.location.hash = "#home"
}

function handleRoute() {
    const hash = window.location.hash || "#home"
    const targetId = hash.replace("#", "") || "home"
    const views = document.querySelectorAll(".view")
    const isMainTab = MAIN_TABS.includes(targetId)
    const isSubview = !isMainTab && targetId.length > 0

    // 1. Toggle body class so bottom dock and background hide/show correctly
    document.body.classList.toggle("subview-active", isSubview)

    // 2. Manage subview visibility
    views.forEach(v => {
        if (v.classList.contains("subview")) {
            v.classList.toggle("active-subview", v.id === targetId)
        }
    })

    // 3. Manage main tab visibility + bottom nav active state
    if (isMainTab) {
        views.forEach(v => {
            if (MAIN_TABS.includes(v.id)) {
                v.classList.toggle("active-tab", v.id === targetId)
            }
        })
        document.querySelectorAll(".nav-item").forEach(nav => {
            const isActive = (nav as HTMLElement).dataset.tab === targetId
            nav.classList.toggle("active", isActive)
            // Swap icon between filled (active) and outline (inactive)
            const icon = nav.querySelector("iconify-icon") as HTMLElement | null
            if (icon) {
                const el = nav as HTMLElement
                icon.setAttribute("icon", isActive
                    ? (el.dataset.iconFill || el.dataset.iconOutline || "")
                    : (el.dataset.iconOutline || ""))
            }
        })
    }
}

// ── Navigation Setup ──
function initNavigation() {
    const navItems = document.querySelectorAll(".nav-item")
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const tab = (item as HTMLElement).dataset.tab
            if (tab) window.location.hash = `#${tab}`
        })
    })

    window.addEventListener("hashchange", handleRoute)
    window.addEventListener("load", handleRoute)
    handleRoute()
}

// Start Everything
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNavigation)
} else {
    initNavigation()
}

// ── Initial Listeners & UI ──
const topbarEl = document.getElementById("topTrayContainer")
topbarEl?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".topbar-tray")) return
    const isExpanded = topbarEl.classList.toggle("expanded")
    document.body.style.overflow = isExpanded ? "hidden" : ""
    document.body.classList.toggle("tray-open", isExpanded)
})

// Close tray when clicking anywhere outside the topbar
document.addEventListener("click", (e) => {
    if (!topbarEl) return
    if (!topbarEl.classList.contains("expanded")) return
    if (!topbarEl.contains(e.target as Node)) {
        topbarEl.classList.remove("expanded")
        document.body.style.overflow = ""
        document.body.classList.remove("tray-open")
    }
})

const savedTheme = localStorage.getItem("ha-theme") as "light" | "dark" | null
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
applyTheme(savedTheme ?? systemTheme)

// ── Guest Mode & Sleep Mode (HA-backed) ─────────────────────────────────
function initHAModeButton(
    id: string,
    entityId: string,
    activeClass: string,
    iconOutline: string,
    iconFill: string
) {
    const btn = document.getElementById(id)
    if (!btn) return
    const icon = btn.querySelector("iconify-icon") as HTMLElement & { icon: string }

    // Keep icon in sync with HA entity state
    subscribeEntity(entityId, (entity: any) => {
        const on = entity?.state === "on"
        btn.classList.toggle(activeClass, on)
        if (icon) icon.icon = on ? iconFill : iconOutline
    })
}

initHAModeButton("guestModeBtn", "input_boolean.gast",    "guest-active", "ph:users", "ph:users")
initHAModeButton("sleepModeBtn", "input_boolean.sovlage", "sleep-active", "ph:moon",  "ph:moon")

document.addEventListener("show-history", (e: any) => {
    const pop = document.getElementById("historyPopup") as any
    if (pop && e.detail && e.detail.entity) {
        pop.open(e.detail.entity, e.detail.customTitle, e.detail.customSubtitle)
    }
})
