import "./styles/tokens.css"
import "./styles/layout.css"
import "./styles/cards.css"

import { connectHA } from "./services/ha-client"
import { subscribeEntity, getEntity, getEntitiesByDomain } from "./store/entity-store"
import { callService } from "./services/ha-service"

    // ── Font size lockdown ────────────────────────────────────────────────────
    // HA injects its theme CSS into same-origin iframes AFTER our stylesheets
    // load, winning the cascade even against !important. We fight back by:
    // 1. Appending a <style> tag from JS (runs last, always wins stylesheet order)
    // 2. MutationObserver to revert any runtime inline font-size changes on <html>
    ; (function lockFontSize() {
        const ID = "ha-font-lock"
        const mobile = window.matchMedia("(max-width: 480px)")
        const base = () => mobile.matches ? "18px" : "16px"

        const applyLock = () => {
            let el = document.getElementById(ID) as HTMLStyleElement | null
            if (!el) {
                el = document.createElement("style") as HTMLStyleElement
                el.id = ID
                document.head.appendChild(el)
            }
            el.textContent = `
            html { font-size: ${base()} !important; -webkit-text-size-adjust: none !important; text-size-adjust: none !important; }
            body { font-size: 1rem !important; font-family: "Inter", system-ui, sans-serif !important; }
            :root {
                --mdc-typography-body1-font-size: 1rem !important;
                --mdc-typography-body2-font-size: 0.875rem !important;
                --paper-font-body1_-_font-size: 1rem !important;
                --paper-font-body2_-_font-size: 0.875rem !important;
                --ha-room-divider-font-size: 0.6875rem !important;
                --ha-room-divider-stats-font-size: 0.75rem !important;
            }
        `
        }

        applyLock()
        mobile.addEventListener("change", applyLock)

        // Revert inline style overrides on <html>
        new MutationObserver(() => {
            const el = document.documentElement
            if (el.style.fontSize && el.style.fontSize !== base()) {
                el.style.fontSize = base()
            }
        }).observe(document.documentElement, { attributes: true, attributeFilter: ["style"] })
    })()

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
import "./components/meals-view"
import "./components/energy-view"
import "./components/todo-popup"
import "./components/pc-card"

/* ── TRAY & NOTIFICATIONS ── */

const trayTiles = {
    guest: { id: "input_boolean.gast", el: document.getElementById("toggleGuestMode") },
    sleep: { id: "input_boolean.sovlage", el: document.getElementById("toggleSleepMode") },
    movie: { id: "input_boolean.biolage", el: document.getElementById("toggleMovieMode") }
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

trayTiles.movie.el?.addEventListener("click", (e) => {
    e.stopPropagation()
    const currentState = getEntity(trayTiles.movie.id)?.state === "on"
    callService("input_boolean", currentState ? "turn_off" : "turn_on", { entity_id: trayTiles.movie.id })
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
    ; (window as any).notifAction = (action: string, entityId: string) => {
        const domain = entityId.split('.')[0];
        if (domain === 'counter') {
            if (action === 'plus') callService("counter", "increment", { entity_id: entityId });
            if (action === 'minus') callService("counter", "decrement", { entity_id: entityId });
            if (action === 'reset') callService("counter", "reset", { entity_id: entityId });
        } else if (domain === 'input_boolean') {
            if (action === 'off') callService("input_boolean", "turn_off", { entity_id: entityId });
        }
    };

function updateSystemBadge() {
    const badge = document.getElementById("systemBadge");
    if (!badge) return;

    // 1. Check HACS
    const hacs = getEntity("sensor.hacs");
    const hasHacsUpdates = hacs && parseInt(hacs.state) > 0;

    // 2. Check all update.* entities
    const updateEntities = getEntitiesByDomain("update");
    const hasSystemUpdates = updateEntities.some(e => e.state === "on");

    badge.style.display = (hasHacsUpdates || hasSystemUpdates) ? "block" : "none";
}

function updateNotifications() {
    const list = document.getElementById("notificationList")
    const badge = document.getElementById("notifBadge")
    const bellIconBox = document.getElementById("notification-bell-box")

    if (!list) return

    const active = notifications.filter(n => {
        const entity = getEntity(n.id)
        return n.check(entity)
    })

    if (badge) {
        badge.innerText = active.length.toString()
        badge.style.display = active.length > 0 ? "flex" : "none"
    }

    if (bellIconBox) {
        bellIconBox.classList.toggle("active", active.length > 0);
        updateStatusPillVisibility();
    }

    if (active.length === 0) {
        list.innerHTML = `<div style="padding: 28px 16px; text-align: center; color: var(--text-secondary); font-size: 13px; font-weight: 500;">Inga nya notiser</div>`
    } else {
        list.innerHTML = active.map(n => {
            const entity = getEntity(n.id);
            const val = entity?.state || "0";

            return `
            <div class="notif-card" style="background: var(--color-card); padding: 14px; border-radius: var(--radius-md); margin-bottom: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; gap: 12px; align-items: center;">
                    <div style="width: 38px; height: 38px; border-radius: 50%; background: var(--color-card-alt); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <iconify-icon icon="${n.icon}" style="color: var(--text-primary); font-size: 18px;"></iconify-icon>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${n.msg}</div>
                        ${n.type === 'counter' ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 1px;">Antal besök: ${val} st</div>` : ''}
                    </div>
                </div>
                <div class="notif-actions" onclick="event.stopPropagation()" style="margin-top: 12px; display: flex; gap: 8px;">
                    ${n.type === 'counter' ? `
                        <button class="action-btn" onclick="notifAction('minus', '${n.id}')" style="flex: 0 0 40px; height: 32px;"><iconify-icon icon="lucide:minus" style="font-size:14px;"></iconify-icon></button>
                        <button class="action-btn" onclick="notifAction('plus', '${n.id}')" style="flex: 0 0 40px; height: 32px;"><iconify-icon icon="lucide:plus" style="font-size:14px;"></iconify-icon></button>
                        <button class="action-btn primary" onclick="notifAction('reset', '${n.id}')" style="flex: 1; border-radius: 10px; height: 32px; font-size: 12px;">Klar</button>
                    ` : `
                        <button class="action-btn primary" onclick="notifAction('off', '${n.id}')" style="width: 100%; border-radius: 10px; height: 32px; font-size: 12px;">Tömd</button>
                    `}
                </div>
            </div>`
        }).join('')
    }
}

notifications.forEach(n => subscribeEntity(n.id, updateNotifications))

// Monitor HACS and Generic Updates
subscribeEntity("sensor.hacs", updateSystemBadge);
// Since update entities are dynamic, we check periodically or when major states change
setInterval(updateSystemBadge, 30000);
setTimeout(updateSystemBadge, 2000); // Initial check

    // ── Global Navigation ──
    const MAIN_TABS = ["home", "meals", "energy"]
    window.addEventListener("popstate", (event) => {
        // 1. Identify which popup (if any) should be open in the NEW state
        const targetPopupId = (event.state && event.state.type === "popup") ? event.state.id : null
        const isTrayState = (event.state && event.state.type === "tray")

        // 2. Clear ANY active popups that aren't the target (usually all of them on back)
        const popupIds = ["lightPopup", "historyPopup", "tvPopup", "personPopup", "settingsPopup", "todoPopup"]
        popupIds.forEach(id => {
            if (id !== targetPopupId) {
                const p = document.getElementById(id) as any
                if (p && typeof p.close === "function") {
                    // Check if it's currently open (active class or internal flag)
                    const isOpen = p.classList.contains("active") || p.isOpen === true
                    if (isOpen) p.close(true) // Pass true to avoid redundant back() calls
                }
            }
        })

        // 3. Handle Tray: If the new state isn't a tray, ensure it's closed
        if (!isTrayState) {
            toggleTray(false, true)
        }

        // 4. Always update the background view based on current hash
        handleRoute()
    })

    ; (window as any).goBack = function () {
        if (window.history.length > 1 && !MAIN_TABS.includes(window.location.hash.replace("#", ""))) {
            window.history.back()
        } else {
            window.location.hash = "#home"
        }
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
        window.scrollTo({ top: 0, behavior: "instant" })
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
const backdropEl = document.getElementById("trayBackdrop")

function toggleTray(force?: boolean, fromBack = false) {
    const isExpanded = topbarEl?.classList.toggle("expanded", force)
    document.body.style.overflow = isExpanded ? "hidden" : ""
    document.body.classList.toggle("tray-open", isExpanded)

    if (isExpanded && !fromBack) {
        window.history.pushState({ type: "tray" }, "")
    } else if (!isExpanded && !fromBack && window.history.state?.type === "tray") {
        window.history.back()
    }
}

topbarEl?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("#haMenuBtn")) return
    if ((e.target as HTMLElement).closest(".topbar-tray")) return
    toggleTray()
})

backdropEl?.addEventListener("click", () => {
    toggleTray(false)
})

// ── HA Sidebar & Header ──────────────────────────────────────────────────
// Kiosk-mode approach: use window.top to reach the outer HA frame regardless of iframe depth
function getHAMain(): Element | null {
    try {
        const topDoc = (window.top ?? window.parent ?? window).document
        const ha = topDoc.querySelector("home-assistant") as any
        if (!ha) { console.warn("[hasp] home-assistant element not found"); return null }
        const haMain = ha.shadowRoot?.querySelector("home-assistant-main")
        if (!haMain) { console.warn("[hasp] home-assistant-main not found in shadowRoot"); return null }
        return haMain
    } catch (e) {
        console.warn("[hasp] getHAMain error:", e)
        return null
    }
}

function toggleHASidebar() {
    const haMain = getHAMain()
    if (!haMain) return
    haMain.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }))
}

function hideHAHeader() {
    let retries = 0
    const attempt = () => {
        if (retries++ > 25) return
        try {
            const topDoc = (window.top ?? window.parent ?? window).document
            const ha = topDoc.querySelector("home-assistant") as any
            if (!ha?.shadowRoot) { setTimeout(attempt, 600); return }

            const haMain = ha.shadowRoot.querySelector("home-assistant-main") as any
            if (!haMain?.shadowRoot) { setTimeout(attempt, 600); return }

            // Walk into hui-root's shadow root — this is where .header > .toolbar lives
            // Note: partial-panel-resolver has NO shadow root — ha-panel-lovelace is a direct child
            const resolver = haMain.shadowRoot.querySelector("partial-panel-resolver") as any
            const lovelace = resolver?.querySelector("ha-panel-lovelace") as any
            const huiRoot = lovelace?.shadowRoot?.querySelector("hui-root") as any
            const huiShadow = huiRoot?.shadowRoot as ShadowRoot | null

            const inject = (root: ShadowRoot, id: string, css: string) => {
                if (root.getElementById(id)) return
                const s = document.createElement("style")
                s.id = id; s.textContent = css
                root.appendChild(s)
                console.log(`[hasp] header CSS injected into ${root.host?.tagName}`)
            }

            if (huiShadow) {
                inject(huiShadow, "ha-dash-hide-hdr", `
                    .header { display: none !important; height: 0 !important; min-height: 0 !important; overflow: hidden !important; }
                    .toolbar { display: none !important; height: 0 !important; }
                    #view { padding-top: 0 !important; margin-top: 0 !important; }
                    hui-view-container { margin-top: 0 !important; padding-top: 0 !important; }
                `)
                return  // success, stop retrying
            }

            // hui-root not ready yet — keep trying
            setTimeout(attempt, 600)
        } catch (e) {
            console.warn("[hasp] hideHAHeader error:", e)
            setTimeout(attempt, 600)
        }
    }
    attempt()
}


document.getElementById("haMenuBtn")?.addEventListener("click", (e) => {
    e.stopPropagation()
    toggleHASidebar()
})

hideHAHeader()

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

// ── Theme: sun elevation auto-switch ────────────────────────────────────
// Dark below -3° (horizon + civil twilight buffer)
// Light above +5° (sun clearly up past morning glow)
// No change in the buffer zone between −3° and +5°
const DARK_BELOW = -3
const LIGHT_ABOVE = 5
let lastAutoTheme: "light" | "dark" | null = null

function applyAutoTheme(elevation: number) {
    let target: "light" | "dark" | null = null
    if (elevation < DARK_BELOW) target = "dark"
    if (elevation > LIGHT_ABOVE) target = "light"
    if (target === null || target === lastAutoTheme) return  // buffer zone or no change
    lastAutoTheme = target
    applyTheme(target)
}

subscribeEntity("sun.sun", (entity: any) => {
    const elevation = parseFloat(entity?.attributes?.elevation ?? "0")
    applyAutoTheme(elevation)
})

// Seed on load from localStorage or system pref while waiting for HA connection
const savedTheme = localStorage.getItem("ha-theme") as "light" | "dark" | null
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
applyTheme(savedTheme ?? systemTheme)

// ── Guest Mode & Sleep Mode (HA-backed) ─────────────────────────────────
function updateStatusPillVisibility() {
    const pill = document.getElementById("statusPill")
    if (!pill) return
    const activeIcons = pill.querySelectorAll(".status-icon.active")
    pill.classList.toggle("has-active", activeIcons.length > 0)
}

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
        btn.classList.toggle("active", on)
        if (icon) icon.icon = on ? iconFill : iconOutline
        updateStatusPillVisibility()
    })
}

initHAModeButton("guestModeBtn", "input_boolean.gast", "active", "ph:users", "ph:users")
initHAModeButton("sleepModeBtn", "input_boolean.sovlage", "active", "ph:moon", "ph:moon")
initHAModeButton("movieModeBtn", "input_boolean.biolage", "active", "ph:film-strip", "ph:film-strip")

document.addEventListener("show-history", (e: any) => {
    const pop = document.getElementById("historyPopup") as any
    if (pop && e.detail && e.detail.entity) {
        pop.open(e.detail.entity, e.detail.customTitle, e.detail.customSubtitle)
    }
})
