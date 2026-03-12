import { BaseCard } from "./base-card"
import { getEntity, subscribeEntity } from "../store/entity-store"
import { callService } from "../services/ha-service"
import { getCardColor } from "../utils/light-color"
import type { HAEntity } from "../types/homeassistant"

class LightCard extends BaseCard {

    private entityId = ""
    private entity?: HAEntity

    connectedCallback() {

        this.entityId = this.getAttribute("entity") || ""

        this.entity = getEntity(this.entityId)

        this.update()

        subscribeEntity(this.entityId, (entity: HAEntity) => {
            this.entity = entity
            this.update()
        })

    }

    supportsPopup(): boolean {

        if (!this.entity) return false

        const attr = this.entity.attributes

        return (
            attr.brightness ||
            attr.rgb_color ||
            attr.color_temp ||
            attr.color_temp_kelvin
        )

    }

    private isToggling = false
    private toggleTimeout: any

    toggle() {
        this.isToggling = true
        clearTimeout(this.toggleTimeout)

        // Lock UI updates for 800ms to prevent HA state bouncing
        this.toggleTimeout = setTimeout(() => {
            this.isToggling = false
            this.update()
        }, 800)

        callService("light", "toggle", {
            entity_id: this.entityId
        })

    }

    openPopup() {

        if (!this.supportsPopup()) return

        const popup = document.getElementById("lightPopup") as any

        popup?.open(this.entityId)

    }

    update() {

        // Ignore incoming backend states if we are waiting for a toggle to settle
        if (this.isToggling) return

        if (!this.entity) {
            this.render("Loading...", "")
            return
        }

        const isOn = this.entity.state === "on"
        const title = this.entity.attributes.friendly_name
        const attr = this.entity.attributes

        let subtitle = "Av"

        if (isOn) {
            // entity_id can be an array or a comma-separated string depending on HA version
            const raw = attr.entity_id
            let childIds: string[] = []
            if (Array.isArray(raw)) {
                childIds = raw
            } else if (typeof raw === "string" && raw.includes(",")) {
                childIds = raw.split(",").map((s: string) => s.trim()).filter(Boolean)
            }

            if (childIds.length > 0) {
                // Light group — count how many children are on
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
                    subtitle = `${onCount} ${label} · ${avgPct}%`
                } else {
                    // Children not resolved yet — fall back to group's own brightness
                    const b = attr.brightness
                    const pct = b != null ? Math.round((b / 255) * 100) : 100
                    subtitle = `På · ${pct}%`
                }

            } else {
                // Single light
                const b = attr.brightness
                const pct = b != null ? Math.round((b / 255) * 100) : 100
                subtitle = `På · ${pct}%`
            }
        }

        this.render(title, subtitle)

        const root = this.shadowRoot!
        const card = root.querySelector(".card") as HTMLElement
        const header = root.querySelector(".header") as HTMLElement

        // ── Compute colours BEFORE building header HTML so that the
        //    accent attribute is present when toggle-switch fires connectedCallback ──
        const cc = getCardColor(this.entity)
        let cardBg = ""
        let accentColor = ""
        let iconFill = isOn ? "var(--text-primary)" : "var(--text-secondary)"
        let textColor = isOn ? "" : "var(--text-secondary)"
        let subtextColor = isOn ? "" : "var(--text-secondary)"

        if (cc && isOn) {
            const { r, g, b } = cc
            // Lighter stop: mix 20% toward white
            const l = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.2))
            // Darker stop for toggle accent
            const dk = (v: number) => Math.round(v * 0.65)

            cardBg = `linear-gradient(135deg, rgb(${r},${g},${b}), rgb(${l(r)},${l(g)},${l(b)}))`
            accentColor = `rgb(${dk(r)},${dk(g)},${dk(b)})`

            // WCAG relative luminance — matches the user's HA code logic
            const lin = (v: number) => {
                v = v / 255
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
            }
            const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
            const isLight = lum > 0.45

            iconFill = isLight ? "#1a1a1a" : "#ffffff"
            textColor = isLight ? "#1a1a1a" : "#ffffff"
            subtextColor = isLight ? "#333333" : "rgba(255,255,255,0.75)"
        }

        // Font Awesome 6 dynamic lightbulb: Solid when on, Outline/Regular when off
        const faSolidPath = 'M272 384c9.6-31.9 29.5-59.1 49.2-86.2c5.2-7.1 10.4-14.2 15.4-21.4c19.8-28.5 31.4-63 31.4-100.3C368 78.8 289.2 0 192 0S16 78.8 16 176c0 37.3 11.6 71.9 31.4 100.3c5 7.2 10.2 14.3 15.4 21.4c19.8 27.1 39.7 54.4 49.2 86.2H272zM192 512c44.2 0 80-35.8 80-80V384H112v48c0 44.2 35.8 80 80 80zM112 176c0 8.8-7.2 16-16 16s-16-7.2-16-16c0-61.9 50.1-112 112-112c8.8 0 16 7.2 16 16s-7.2 16-16 16c-44.2 0-80 35.8-80 80z'
        const faRegPath = 'M297.2 248.9C311.6 228.3 320 203.2 320 176c0-70.7-57.3-128-128-128S64 105.3 64 176c0 27.2 8.4 52.3 22.8 72.9c3.7 5.3 8.1 11.3 12.8 17.7c0 0 0 0 0 0c12.9 17.7 28.3 38.9 39.8 59.8c10.4 19 15.7 38.8 18.3 57.5L109 384c-2.2-12-5.9-23.7-11.8-34.5c-9.9-18-22.2-34.9-34.5-51.8c0 0 0 0 0 0s0 0 0 0c-5.2-7.1-10.4-14.2-15.4-21.4C27.6 247.9 16 213.3 16 176C16 78.8 94.8 0 192 0s176 78.8 176 176c0 37.3-11.6 71.9-31.4 100.3c-5 7.2-10.2 14.3-15.4 21.4c0 0 0 0 0 0s0 0 0 0c-12.3 16.8-24.6 33.7-34.5 51.8c-5.9 10.8-9.6 22.5-11.8 34.5l-48.6 0c2.6-18.7 7.9-38.6 18.3-57.5c11.5-20.9 26.9-42.1 39.8-59.8c0 0 0 0 0 0s0 0 0 0s0 0 0 0c4.7-6.4 9-12.4 12.7-17.7zM192 128c-26.5 0-48 21.5-48 48c0 8.8-7.2 16-16 16s-16-7.2-16-16c0-44.2 35.8-80 80-80c8.8 0 16 7.2 16 16s-7.2 16-16 16zm0 384c-44.2 0-80-35.8-80-80l0-16 160 0 0 16c0 44.2-35.8 80-80 80z'
        const iconPath = isOn ? faSolidPath : faRegPath

        const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 384 512" fill="${iconFill}"><path d="${iconPath}"/></svg>`

        header.innerHTML = `
            <div style="display:flex;align-items:center">${icon}</div>
            <toggle-switch checked="${isOn}" accent="${accentColor}"></toggle-switch>
        `

        header.querySelector("toggle-switch")?.addEventListener("toggle", (e) => {
            e.stopPropagation()
            this.toggle()
        })

        card.onclick = () => {
            const nav = this.getAttribute("navigate")
            if (nav) {
                window.location.hash = nav
            } else {
                this.openPopup()
            }
        }

        // ── Card background ──────────────────────────────────────────
        card.style.background = cardBg || "var(--color-card)"

        // ── Text: adapts between dark / white based on card luminance ──
        const titleEl = root.querySelector(".title") as HTMLElement | null
        const subtitleEl = root.querySelector(".subtitle") as HTMLElement | null
        if (titleEl) titleEl.style.color = textColor
        if (subtitleEl) subtitleEl.style.color = subtextColor

    }

}


customElements.define("light-card", LightCard)