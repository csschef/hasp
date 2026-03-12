import { BaseCard } from "./base-card"
import { getEntity, subscribeEntity } from "../store/entity-store"
import { callService } from "../services/ha-service"
import { getCardColor } from "../utils/light-color"
import type { HAEntity } from "../types/homeassistant"

// Font Awesome 6 lightbulb paths — defined once at module level
const FA_SOLID = 'M272 384c9.6-31.9 29.5-59.1 49.2-86.2c5.2-7.1 10.4-14.2 15.4-21.4c19.8-28.5 31.4-63 31.4-100.3C368 78.8 289.2 0 192 0S16 78.8 16 176c0 37.3 11.6 71.9 31.4 100.3c5 7.2 10.2 14.3 15.4 21.4c19.8 27.1 39.7 54.4 49.2 86.2H272zM192 512c44.2 0 80-35.8 80-80V384H112v48c0 44.2 35.8 80 80 80zM112 176c0 8.8-7.2 16-16 16s-16-7.2-16-16c0-61.9 50.1-112 112-112c8.8 0 16 7.2 16 16s-7.2 16-16 16c-44.2 0-80 35.8-80 80z'
const FA_REG   = 'M297.2 248.9C311.6 228.3 320 203.2 320 176c0-70.7-57.3-128-128-128S64 105.3 64 176c0 27.2 8.4 52.3 22.8 72.9c3.7 5.3 8.1 11.3 12.8 17.7c0 0 0 0 0 0c12.9 17.7 28.3 38.9 39.8 59.8c10.4 19 15.7 38.8 18.3 57.5L109 384c-2.2-12-5.9-23.7-11.8-34.5c-9.9-18-22.2-34.9-34.5-51.8c0 0 0 0 0 0s0 0 0 0c-5.2-7.1-10.4-14.2-15.4-21.4C27.6 247.9 16 213.3 16 176C16 78.8 94.8 0 192 0s176 78.8 176 176c0 37.3-11.6 71.9-31.4 100.3c-5 7.2-10.2 14.3-15.4 21.4c0 0 0 0 0 0s0 0 0 0s0 0 0 0c-12.3 16.8-24.6 33.7-34.5 51.8c-5.9 10.8-9.6 22.5-11.8 34.5l-48.6 0c2.6-18.7 7.9-38.6 18.3-57.5c11.5-20.9 26.9-42.1 39.8-59.8c0 0 0 0 0 0s0 0 0 0s0 0 0 0c4.7-6.4 9-12.4 12.7-17.7zM192 128c-26.5 0-48 21.5-48 48c0 8.8-7.2 16-16 16s-16-7.2-16-16c0-44.2 35.8-80 80-80c8.8 0 16 7.2 16 16s-7.2 16-16 16zm0 384c-44.2 0-80-35.8-80-80l0-16 160 0 0 16c0 44.2-35.8 80-80 80z'

class LightCard extends BaseCard {

    private entityId = ""
    private entity?: HAEntity

    /** Optimistic visual state — flipped immediately on click, synced from HA otherwise */
    private visuallyOn = false

    connectedCallback() {

        this.entityId = (this.getAttribute("entity") || "").trim()
        this.entity = getEntity(this.entityId)
        this.visuallyOn = this.entity?.state === "on"

        this.update()

        subscribeEntity(this.entityId, (entity: HAEntity) => {
            this.entity = entity

            if (this.isToggling) {
                // HA confirmed our optimistic prediction — accept immediately so
                // we get the real colour attributes for the card background.
                // (This is why card_mod feels instant: HA sends state + full attrs
                // in one event and we call update() as soon as it matches.)
                if ((entity.state === "on") === this.visuallyOn) {
                    clearTimeout(this.toggleTimeout)
                    this.isToggling = false
                    this.update()
                }
                // HA is still reporting the old state (mid-transition bounce) — ignore.
                return
            }

            this.update()
        })

    }

    supportsPopup(): boolean {

        if (!this.entity) return false
        const attr = this.entity.attributes
        return !!(attr.brightness || attr.rgb_color || attr.color_temp || attr.color_temp_kelvin)

    }

    private isToggling = false
    private toggleTimeout: any

    toggle() {

        // Optimistic: flip the visual state immediately; don't wait for HA to confirm
        this.visuallyOn = !this.visuallyOn
        this.applyVisuals()

        this.isToggling = true
        clearTimeout(this.toggleTimeout)

        // After 2 s the lock releases; the next HA push will reconcile the real state
        this.toggleTimeout = setTimeout(() => {
            this.isToggling = false
            this.update()
        }, 2000)

        callService("light", "toggle", { entity_id: this.entityId })

    }

    openPopup() {

        if (!this.supportsPopup()) return
        const popup = document.getElementById("lightPopup") as any
        popup?.open(this.entityId)

    }

    /** Called on every HA state push — ignored while the toggle lock is active. */
    update() {

        if (this.isToggling) return

        if (!this.entity) {
            this.render("Loading...", "")
            return
        }

        const isOn = this.entity.state === "on"
        this.visuallyOn = isOn

        const title = this.getAttribute("name") || this.entity.attributes.friendly_name
        const subtitle = this.buildSubtitle(isOn)

        // Rebuild the base card HTML (title / subtitle text changed)
        this.render(title, subtitle)

        // Then apply colours and toggle state on top
        this.applyVisuals()

    }

    /**
     * Apply the current `visuallyOn` state to the shadow DOM.
     * - Updates CSS custom properties on `.card` (background, text colours, icon fill)
     * - Either patches the existing `<toggle-switch>` in place (fast path, no flash)
     *   or builds it fresh after a full base-card render (render path).
     * Never rebuilds the base card HTML itself — so this is safe to call from toggle().
     */
    private applyVisuals() {

        const root = this.shadowRoot
        if (!root) return

        const card   = root.querySelector(".card")   as HTMLElement | null
        const header = root.querySelector(".header") as HTMLElement | null
        if (!card || !header) return

        const isOn = this.visuallyOn

        // ── Patch subtitle & title text immediately (no render() needed) ──────
        const subtitleEl = root.querySelector(".subtitle") as HTMLElement | null
        if (subtitleEl) subtitleEl.textContent = this.buildSubtitle(isOn)

        // ── Compute colours using the PROJECTED state (not entity.state) ──────
        // Spread the entity with a fake state so getCardColor sees "on" when we
        // want the colour, even before HA has confirmed the toggle.
        const projectedEntity = this.entity
            ? ({ ...this.entity, state: isOn ? "on" : "off" } as HAEntity)
            : null

        const cc = projectedEntity ? getCardColor(projectedEntity) : null

        let accentColor = ""

        if (cc && isOn) {

            // Light is on AND has a colour (color_temp / rgb)
            const { r, g, b } = cc
            const l  = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.2))
            const dk = (v: number) => Math.round(v * 0.65)

            card.style.setProperty("--card-bg",
                `linear-gradient(135deg, rgb(${r},${g},${b}), rgb(${l(r)},${l(g)},${l(b)}))`)

            accentColor = `rgb(${dk(r)},${dk(g)},${dk(b)})`

            const lin = (v: number) => {
                v = v / 255
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
            }
            const lum     = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
            const isLight = lum > 0.35

            card.style.setProperty("--card-text-primary",   isLight ? "#1a1a1a" : "#ffffff")
            card.style.setProperty("--card-text-secondary", isLight ? "#333333" : "rgba(255,255,255,0.75)")
            card.style.setProperty("--card-icon-fill",      isLight ? "#1a1a1a" : "#ffffff")

        } else {

            // Off state, or on without known colour — restore card defaults
            card.style.removeProperty("--card-bg")
            card.style.removeProperty("--card-text-primary")
            card.style.removeProperty("--card-text-secondary")
            card.style.removeProperty("--card-icon-fill")

        }

        // ── Toggle switch + icon ─────────────────────────────────────────────
        // When on but no real accent yet (HA not confirmed), use border-color so
        // the toggle background stays neutral — knob slides, no yellow flash.
        const effectiveAccent = accentColor || (isOn ? "var(--border-color)" : "")

        const existingTs = header.querySelector("toggle-switch") as HTMLElement | null

        if (existingTs) {
            // Fast path: patch in place — zero DOM rebuild, zero flash
            existingTs.setAttribute("checked", String(isOn))
            if (effectiveAccent) {
                existingTs.setAttribute("accent", effectiveAccent)
            } else {
                existingTs.removeAttribute("accent")
            }
            // Update icon SVG path (solid ↔ outline)
            const path = header.querySelector("svg.card-icon path")
            if (path) path.setAttribute("d", isOn ? FA_SOLID : FA_REG)

        } else {
            // Render path: header was just wiped by base-card's render() — rebuild fresh
            this.buildHeader(header, isOn, effectiveAccent)
        }

        card.onclick = () => {
            const nav = this.getAttribute("navigate")
            if (nav) window.location.hash = nav
            else this.openPopup()
        }

    }

    /**
     * Build header HTML from scratch after a base-card render().
     * The `--toggle-accent` value is embedded directly into the toggle-switch's
     * own style attribute so the shadow stylesheet sees the correct colour on
     * the very first paint — no yellow flash possible.
     */
    private buildHeader(header: HTMLElement, isOn: boolean, accentColor: string) {

        const iconPath = isOn ? FA_SOLID : FA_REG
        const icon     = `<svg class="card-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 384 512"><path d="${iconPath}"/></svg>`

        // Inline style pre-sets --toggle-accent BEFORE the shadow DOM is built,
        // which means the shadow stylesheet reads the right value on frame 1.
        const accentStyle = accentColor ? ` style="--toggle-accent:${accentColor}"` : ""

        header.innerHTML = `
            <div style="display:flex;align-items:center">${icon}</div>
            <toggle-switch checked="${isOn}" accent="${accentColor}"${accentStyle}></toggle-switch>
        `

        header.querySelector("toggle-switch")?.addEventListener("toggle", (e) => {
            e.stopPropagation()
            this.toggle()
        })

    }

    private buildSubtitle(isOn: boolean): string {

        if (!this.entity || !isOn) return "Av"

        const attr = this.entity.attributes
        const raw  = attr.entity_id
        let childIds: string[] = []

        if (Array.isArray(raw)) {
            childIds = raw
        } else if (typeof raw === "string" && raw.includes(",")) {
            childIds = raw.split(",").map((s: string) => s.trim()).filter(Boolean)
        }

        if (childIds.length > 0) {
            let onCount    = 0
            let totalBright = 0

            for (const id of childIds) {
                const child = getEntity(id)
                if (child && child.state === "on") {
                    onCount++
                    const b = child.attributes.brightness
                    totalBright += b != null ? Math.round((b / 255) * 100) : 100
                }
            }

            if (onCount > 0) {
                const avgPct = Math.round(totalBright / onCount)
                const label  = onCount === 1 ? "tänd" : "tända"
                return `${onCount} ${label} · ${avgPct}%`
            }
        }

        const b   = attr.brightness
        const pct = b != null ? Math.round((b / 255) * 100) : 100
        return `På · ${pct}%`

    }

}


customElements.define("light-card", LightCard)