import { BaseCard } from "./base-card"
import { getEntity, subscribeEntity } from "../store/entity-store"
import { callService } from "../services/ha-service"
import { getLightColor } from "../utils/light-color"
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

    toggle() {

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

        if (!this.entity) {
            this.render("Loading...", "")
            return
        }

        const title = this.entity.attributes.friendly_name
        const subtitle = this.entity.state === "on" ? "På" : "Av"

        this.render(title, subtitle)

        const root = this.shadowRoot!

        const card = root.querySelector(".card") as HTMLElement
        const header = root.querySelector(".header") as HTMLElement

        // ikon + toggle
        header.innerHTML = `
      <div>💡</div>
      <toggle-switch checked="${this.entity.state === "on"}"></toggle-switch>
    `

        // toggle event
        const toggle = header.querySelector("toggle-switch")

        toggle?.addEventListener("toggle", (e) => {

            e.stopPropagation()

            this.toggle()

        })

        // kort klick → popup
        card.onclick = () => {

            this.openPopup()

        }

        // färga kortet efter lampans färg
        const color = getLightColor(this.entity)

        if (color && this.entity.state === "on") {

            const rgba = color.replace("rgb", "rgba").replace(")", ",0.25)")

            card.style.background =
                `linear-gradient(
            135deg,
            var(--color-card),
            ${rgba}
            )`

        } else {

            card.style.background = "var(--color-card)"

        }

    }

}


customElements.define("light-card", LightCard)