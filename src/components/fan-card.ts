import { BaseCard } from "./base-card"
import { getEntity, subscribeEntity } from "../store/entity-store"
import { callService } from "../services/ha-service"
import type { HAEntity } from "../types/homeassistant"

const FAN_ICON = `<iconify-icon class="card-icon" icon="lucide:fan" style="width:20px;height:20px"></iconify-icon>`

class FanCard extends BaseCard {

    private entityId = ""
    private entity?: HAEntity
    private isToggling = false
    private toggleTimeout: any
    private visuallyOn = false

    connectedCallback() {
        this.entityId = (this.getAttribute("entity") || "").trim()
        this.entity = getEntity(this.entityId)
        this.visuallyOn = this.entity?.state === "on"

        this.update()

        subscribeEntity(this.entityId, (entity: HAEntity) => {
            this.entity = entity

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

    private toggle() {
        this.visuallyOn = !this.visuallyOn
        this.applyVisuals()

        this.isToggling = true
        clearTimeout(this.toggleTimeout)

        this.toggleTimeout = setTimeout(() => {
            this.isToggling = false
            this.update()
        }, 2000)

        const domain = this.entityId.split(".")[0] || "input_boolean"
        callService(domain as any, "toggle", { entity_id: this.entityId })
    }

    update() {
        if (this.isToggling) return

        if (!this.entity) {
            this.render("Laddar...", "")
            return
        }

        this.visuallyOn = this.entity.state === "on"

        const name = this.getAttribute("name") || this.entity.attributes.friendly_name || this.entityId
        const subtitle = this.visuallyOn ? "På" : "Av"

        this.render(name, subtitle)
        this.applyVisuals()
    }

    private applyVisuals() {
        const root = this.shadowRoot
        if (!root) return

        const card = root.querySelector(".card") as HTMLElement | null
        const header = root.querySelector(".header") as HTMLElement | null
        if (!card || !header) return

        const isOn = this.visuallyOn

        const subtitleEl = root.querySelector(".subtitle") as HTMLElement | null
        if (subtitleEl) subtitleEl.textContent = isOn ? "På" : "Av"

        if (isOn) {
            card.style.setProperty("--card-bg", "var(--active-device-bg, linear-gradient(145deg, #767cda 0%, #a0a5eb 100%))")
            card.style.setProperty("--card-text-primary", "var(--active-device-text, #ffffff)")
            card.style.setProperty("--card-text-secondary", "var(--active-device-text-dim, rgba(255,255,255,0.85))")
            card.style.setProperty("--card-icon-fill", "var(--active-device-text, #ffffff)")
        } else {
            card.style.removeProperty("--card-bg")
            card.style.removeProperty("--card-text-primary")
            card.style.removeProperty("--card-text-secondary")
            card.style.removeProperty("--card-icon-fill")
        }

        const accent = isOn ? "rgba(255, 255, 255, 0.25)" : ""
        const accentStyle = accent ? ` style="--toggle-accent:${accent}"` : ""

        const existingTs = header.querySelector("toggle-switch") as HTMLElement | null

        if (existingTs) {
            existingTs.setAttribute("checked", String(isOn))
            if (accent) existingTs.setAttribute("accent", accent)
            else existingTs.removeAttribute("accent")
            const iconWrapper = header.querySelector("div") as HTMLElement | null
            if (iconWrapper) iconWrapper.innerHTML = FAN_ICON
        } else {
            header.innerHTML = `
                <div style="display:flex;align-items:center">${FAN_ICON}</div>
                <toggle-switch checked="${isOn}" accent="${accent}"${accentStyle}></toggle-switch>
            `
            header.querySelector("toggle-switch")?.addEventListener("toggle", (e) => {
                e.stopPropagation()
                this.toggle()
            })
        }

        card.onclick = () => this.toggle()
    }
}

customElements.define("fan-card", FanCard)