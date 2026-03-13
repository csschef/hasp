import { BaseCard } from "./base-card"
import { getEntity, subscribeEntity } from "../store/entity-store"
import { HA_URL } from "../services/ha-client"
import type { HAEntity } from "../types/homeassistant"

class PersonCard extends BaseCard {
    private personId = ""
    private batteryId = ""
    private person?: HAEntity
    private battery?: HAEntity
    private timer?: number
    private labelMapping: Record<string, string> = {}

    connectedCallback() {
        this.personId = this.getAttribute("person") || ""
        this.batteryId = this.getAttribute("battery") || ""
        
        const mapping = this.getAttribute("label-mapping")
        if (mapping) {
            try {
                this.labelMapping = JSON.parse(mapping)
            } catch (e) {
                console.error("Failed to parse label-mapping", e)
            }
        }

        if (this.personId) {
            subscribeEntity(this.personId, (e: HAEntity) => {
                this.person = e
                this.update()
            })
        }

        if (this.batteryId) {
            subscribeEntity(this.batteryId, (e: HAEntity) => {
                this.battery = e
                this.update()
            })
        }

        // Start timer to update duration every minute
        this.timer = window.setInterval(() => this.update(), 60000)

        this.update()

        this.addEventListener('click', () => {
             const popup = document.getElementById("personPopup") as any
             if (popup && this.personId) {
                 popup.open(this.personId, this.labelMapping)
             }
        })
    }

    disconnectedCallback() {
        if (this.timer) clearInterval(this.timer)
    }

    private formatDuration(lastChanged: string) {
        const now = new Date()
        const changed = new Date(lastChanged)
        const diffMs = now.getTime() - changed.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        
        const hours = Math.floor(diffMins / 60)
        const mins = diffMins % 60
        const days = Math.floor(hours / 24)

        if (days > 0) {
            const dText = days === 1 ? "dag" : "dagar"
            const hText = (hours % 24) === 1 ? "timme" : "timmar"
            return `${days} ${dText} och ${hours % 24} ${hText}`
        }
        if (hours > 0) {
            const hText = hours === 1 ? "timme" : "timmar"
            const mText = mins === 1 ? "minut" : "minuter"
            return `${hours} ${hText} och ${mins} ${mText}`
        }
        const mText = mins === 1 ? "minut" : "minuter"
        return `${mins} ${mText}`
    }

    update() {
        if (!this.person) {
            this.render("Laddar...", "")
            return
        }

        const name = this.person.attributes.friendly_name || this.personId
        let rawState = this.person.state
        let state = rawState

        // Apply custom mapping
        if (this.labelMapping[rawState]) {
            state = this.labelMapping[rawState]
        } else {
            if (state === "home") state = "Hemma"
            else if (state === "not_home") state = "Borta"
            // Capitalize state
            state = state.charAt(0).toUpperCase() + state.slice(1)
        }

        const duration = this.formatDuration(this.person.last_changed)
        let picture = this.person.attributes.entity_picture
        const batteryLevel = this.battery ? this.battery.state : null

        if (picture && picture.startsWith("/")) {
            picture = HA_URL + picture
        }

        const statusText = `${state} i ${duration}.`

        this.render(name, statusText)
        this.applyVisuals(picture, batteryLevel, statusText)
    }

    private getBatteryIcon(level: number) {
        const fillWidth = Math.max(1, Math.round(14 * (level / 100)))
        let color = "#4cd964" // Apple Green
        if (level < 20) color = "#ff3b30" // Apple Red
        else if (level < 50) color = "#ffcc00" // Apple Yellow

        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="6" width="18" height="12" rx="2" ry="2"></rect>
                <line x1="23" y1="13" x2="23" y2="11"></line>
                <rect x="3" y="8" width="${fillWidth}" height="8" rx="1" ry="1" fill="${color}" stroke="none"></rect>
            </svg>
        `
    }

    private applyVisuals(picture: string | null, battery: string | null, statusText: string) {
        const root = this.shadowRoot
        if (!root) return

        const card = root.querySelector(".card") as HTMLElement
        if (!card) return

        const level = battery != null ? parseInt(battery) : null

        // We'll clear the default slots and use our custom layout
        card.innerHTML = `
            <div class="content">
                <div class="avatar-wrap">
                    <div class="main-avatar" style="background-image: url(${picture || ''})"></div>
                    ${level != null ? `
                        <div class="battery-pill">
                            ${this.getBatteryIcon(level)}
                            <span>${level}%</span>
                        </div>
                    ` : ''}
                </div>
                <div class="info">
                    <div class="name">${this.person?.attributes.friendly_name || 'Okänd'}</div>
                    <div class="status">${statusText}</div>
                </div>
            </div>
        `

        // Inject high-end styles
        if (!root.querySelector("#person-styles")) {
            const style = document.createElement("style")
            style.id = "person-styles"
            style.textContent = `
                .card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: var(--space-md);
                    cursor: pointer;
                    background: var(--color-card);
                    border-radius: var(--radius-md);
                    box-shadow: none !important;
                    border: none !important;
                    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                    min-height: 200px; /* Base height for alignment */
                }
                .card:active {
                    transform: scale(0.96);
                }
                .content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                    width: 100%;
                }
                .avatar-wrap {
                    position: relative;
                    width: 100px;
                    height: 100px;
                }
                .main-avatar {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background-size: cover;
                    background-position: center;
                    background-color: var(--color-card-alt);
                    box-shadow: none !important;
                    border: none !important;
                }
                .battery-pill {
                    position: absolute;
                    bottom: -4px;
                    right: -4px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    background: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    padding: 4px 10px;
                    border-radius: 12px;
                    box-shadow: none !important;
                    border: none !important;
                }
                [data-theme="dark"] .battery-pill {
                    background: rgba(45, 45, 45, 0.9);
                }
                .battery-pill svg {
                    width: 14px;
                    height: 14px;
                    color: #1a1a1a;
                    stroke: #1a1a1a;
                }
                [data-theme="dark"] .battery-pill svg {
                    color: #ffffff;
                    stroke: #ffffff;
                }
                .battery-pill span {
                    font-size: 12px;
                    font-weight: 600;
                    color: #1a1a1a;
                }
                [data-theme="dark"] .battery-pill span {
                    color: #ffffff;
                }
                .info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .name {
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--text-primary);
                }
                .status {
                    font-size: 13px;
                    color: var(--text-secondary);
                    line-height: 1.4;
                    max-width: 160px;
                    margin: 0 auto;
                    min-height: 2.8em; /* Exactly 2 lines */
                }
                /* Hide base-card default structure but keep container */
                header, .title, .subtitle-scroll-container { display: none !important; }
            `
            root.prepend(style)
        }
    }
}

customElements.define("person-card", PersonCard)
