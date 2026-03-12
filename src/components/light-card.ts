import { BaseCard } from "./base-card"
import { getEntity, subscribeEntity } from "../store/entity-store"
import { callService } from "../services/ha-service"
import { getCardColor } from "../utils/light-color"
import type { HAEntity } from "../types/homeassistant"

// Lucide lightbulb — stroke-width 1.5 on both states matches the card title’s font-weight 400.
// The card background change is sufficient visual feedback for on/off.
const BULB_PATHS = `<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>`
const ICON_SVG = (cls: string) => `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" style="fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round">${BULB_PATHS}</svg>`

const ICON_ON = ICON_SVG("card-icon")
const ICON_OFF = ICON_SVG("card-icon")

class LightCard extends BaseCard {

    private entityId = ""
    private entity?: HAEntity
    private subscribedChildren = new Set<string>()

    /** Optimistic visual state — flipped immediately on click, synced from HA otherwise */
    private visuallyOn = false

    connectedCallback() {

        this.entityId = (this.getAttribute("entity") || "").trim()
        this.entity = getEntity(this.entityId)
        this.visuallyOn = this.entity?.state === "on"

        this.update()

        subscribeEntity(this.entityId, (entity: HAEntity) => {
            this.entity = entity

            // Subscribe to child entities (light groups) so their states are available
            this.subscribeToChildren(entity)

            if (this.isToggling) {
                if ((entity.state === "on") === this.visuallyOn) {
                    clearTimeout(this.toggleTimeout)
                    this.isToggling = false
                    this.update()
                }
                return
            }

            this.update()
        })

    }

    /** Subscribe to all child entities of a light group so getEntity() works for them */
    private subscribeToChildren(entity: HAEntity) {
        const raw = entity.attributes.entity_id
        let childIds: string[] = []

        if (Array.isArray(raw)) {
            childIds = raw
        } else if (typeof raw === "string" && raw.includes(",")) {
            childIds = raw.split(",").map((s: string) => s.trim()).filter(Boolean)
        }

        for (const id of childIds) {
            if (!this.subscribedChildren.has(id)) {
                this.subscribedChildren.add(id)
                subscribeEntity(id, () => {
                    if (!this.isToggling) this.update()
                })
            }
        }
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

        const card = root.querySelector(".card") as HTMLElement | null
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
            const l = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.2))
            const dk = (v: number) => Math.round(v * 0.65)

            card.style.setProperty("--card-bg",
                `linear-gradient(135deg, rgb(${r},${g},${b}), rgb(${l(r)},${l(g)},${l(b)}))`)

            accentColor = `rgb(${dk(r)},${dk(g)},${dk(b)})`

            const lin = (v: number) => {
                v = v / 255
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
            }
            const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
            const isLight = lum > 0.35

            card.style.setProperty("--card-text-primary", isLight ? "#1a1a1a" : "#ffffff")
            card.style.setProperty("--card-text-secondary", isLight ? "#333333" : "rgba(255,255,255,0.75)")
            card.style.setProperty("--card-icon-fill", isLight ? "#1a1a1a" : "#ffffff")

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
            // Update icon — replace whole wrapper div since ON (fill) and OFF (stroke) differ
            const iconWrapper = header.querySelector("div") as HTMLElement | null
            if (iconWrapper) iconWrapper.innerHTML = isOn ? ICON_ON : ICON_OFF

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

        const icon = isOn ? ICON_ON : ICON_OFF

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
        const raw = attr.entity_id
        let childIds: string[] = []

        if (Array.isArray(raw)) {
            childIds = raw
        } else if (typeof raw === "string" && raw.includes(",")) {
            childIds = raw.split(",").map((s: string) => s.trim()).filter(Boolean)
        }

        if (childIds.length > 0) {
            let onCount = 0
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
                const label = onCount === 1 ? "tänd" : "tända"
                return `${onCount} ${label} · ${avgPct}%`
            }

            return "Av"
        }

        // Single light (not a group)
        const b = attr.brightness
        const pct = b != null ? Math.round((b / 255) * 100) : 100
        return `På · ${pct}%`

    }

}


customElements.define("light-card", LightCard)