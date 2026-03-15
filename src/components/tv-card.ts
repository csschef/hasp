import { BaseCard } from "./base-card"
import { getEntity, subscribeEntity } from "../store/entity-store"
import { callService } from "../services/ha-service"
import type { HAEntity } from "../types/homeassistant"

class TvCard extends BaseCard {
    private entityId = ""
    private mediaEntityId = ""
    private remoteId = ""
    private powerScript = ""
    private soundbarId = ""

    private tvEntity?: HAEntity
    private mediaEntity?: HAEntity

    private visuallyOn = false
    private isToggling = false
    private toggleTimeout: any

    connectedCallback() {
        this.entityId = this.getAttribute("entity") || ""
        this.mediaEntityId = this.getAttribute("media-entity") || ""
        this.remoteId = this.getAttribute("remote") || ""
        this.powerScript = this.getAttribute("power-script") || ""
        this.soundbarId = this.getAttribute("soundbar") || ""

        if (this.entityId) {
            subscribeEntity(this.entityId, (e: HAEntity) => {
                this.tvEntity = e
                if (!this.isToggling) this.update()
            })
        }

        if (this.mediaEntityId) {
            subscribeEntity(this.mediaEntityId, (e: HAEntity) => {
                this.mediaEntity = e
                if (!this.isToggling) this.update()
            })
        }

        this.addEventListener('click', () => {
            const popup = document.getElementById("tvPopup") as any
            if (popup && this.entityId) {
                popup.open({
                    entityId: this.entityId,
                    mediaEntityId: this.mediaEntityId,
                    remoteId: this.remoteId,
                    powerScript: this.powerScript,
                    soundbarId: this.soundbarId
                })
            }
        })

        this.update()
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

        if (this.powerScript) {
            const [domain, service] = this.powerScript.split('.')
            callService(domain as any, service, {})
        } else {
            callService("media_player", "toggle", { entity_id: this.entityId })
        }
    }

    update() {
        if (!this.tvEntity || this.isToggling) {
            if (!this.tvEntity) this.render("TV", "Laddar...")
            return
        }

        const isOn = this.tvEntity.state !== "off" && this.tvEntity.state !== "unavailable"
        this.visuallyOn = isOn

        const isPlaying = this.tvEntity.state === "playing" || (this.mediaEntity?.state === "playing")
        const title = this.getAttribute("name") || this.tvEntity.attributes.friendly_name || "TV"

        let status = "Av"
        if (isOn) {
            status = isPlaying ? "Spelar" : "På"
        }

        this.render(title, status)
        this.applyVisuals()
    }

    private applyVisuals() {
        const root = this.shadowRoot
        if (!root) return

        const card = root.querySelector(".card") as HTMLElement
        if (!card) return

        const isOn = this.visuallyOn

        if (isOn) {
            // 'Violet Horizon' (The ultimate middle ground for saturation)
            card.style.setProperty("--card-bg", "linear-gradient(145deg, #767cda 0%, #a0a5eb 100%)")
            card.style.setProperty("--card-text-primary", "#ffffff")
            card.style.setProperty("--card-text-secondary", "rgba(255,255,255,0.85)")
            card.style.setProperty("--card-icon-fill", "#ffffff")
        } else {
            card.style.removeProperty("--card-bg")
            card.style.removeProperty("--card-text-primary")
            card.style.removeProperty("--card-text-secondary")
            card.style.removeProperty("--card-icon-fill")
        }

        const TV_ICON = `<svg class="card-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" style="fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>`

        const header = root.querySelector(".header") as HTMLElement
        if (header) {
            const iconHtml = TV_ICON

            const accent = isOn ? "#525698" : "" // Perfectly balanced violet-indigo accent for toggle
            const accentStyle = accent ? ` style="--toggle-accent:${accent}"` : ""

            const existingTs = header.querySelector("toggle-switch") as any
            if (existingTs) {
                existingTs.setAttribute("checked", String(isOn))
                if (accent) existingTs.setAttribute("accent", accent)
                else existingTs.removeAttribute("accent")
                const wrap = header.querySelector(".tv-icon-wrap")
                if (wrap) wrap.innerHTML = iconHtml
            } else {
                header.innerHTML = `
                    <div class="tv-icon-wrap" style="display:flex;align-items:center">
                        ${iconHtml}
                    </div>
                    <toggle-switch checked="${isOn}" accent="${accent}"${accentStyle}></toggle-switch>
                `
                header.querySelector("toggle-switch")?.addEventListener('toggle', (e) => {
                    e.stopPropagation()
                    this.toggle()
                })
            }
        }
    }
}

customElements.define("tv-card", TvCard)
