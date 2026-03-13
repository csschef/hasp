import { getEntity, subscribeEntity } from "../store/entity-store"

class RoomDivider extends HTMLElement {

    private roomTitle = ""
    private tempEntity = ""
    private humidityEntity = ""
    private motionEntity = ""
    private doorEntity = ""

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.roomTitle = this.getAttribute("title") || ""
        this.tempEntity = this.getAttribute("temp") || ""
        this.humidityEntity = this.getAttribute("humidity") || ""
        this.motionEntity = this.getAttribute("motion") || ""
        this.doorEntity = this.getAttribute("door") || ""

        if (this.tempEntity) subscribeEntity(this.tempEntity, () => this.render())
        if (this.humidityEntity) subscribeEntity(this.humidityEntity, () => this.render())
        
        // Support multiple motion/door sensors separated by spaces
        if (this.motionEntity) {
            this.motionEntity.split(/\s+/).forEach(id => {
                if (id) subscribeEntity(id, () => this.render())
            })
        }
        if (this.doorEntity) {
            this.doorEntity.split(/\s+/).forEach(id => {
                if (id) subscribeEntity(id, () => this.render())
            })
        }

        this.render()
    }

    render() {

        const tempState = this.tempEntity ? getEntity(this.tempEntity) : null
        const humidityState = this.humidityEntity ? getEntity(this.humidityEntity) : null
        
        // Check if ANY of the motion sensors are active (on or occupied)
        const motionOn = this.motionEntity ? this.motionEntity.split(/\s+/).some(id => {
            const s = getEntity(id)
            return s && (s.state === "on" || s.state === "occupied")
        }) : false

        // Check if ANY of the door sensors are open (on or open)
        const doorOpen = this.doorEntity ? this.doorEntity.split(/\s+/).some(id => {
            const s = getEntity(id)
            return s && (s.state === "on" || s.state === "open")
        }) : false

        const tempText = tempState && tempState.state !== "unavailable" ? `${Number(tempState.state).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} °C` : ""
        const humidityText = humidityState && humidityState.state !== "unavailable" ? `${Number(humidityState.state).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} %` : ""

        const tempIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`
        const humidityIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/></svg>`
        const motionIcon = `<svg viewBox="0 0 320 512" width="14" height="14" fill="currentColor"><path d="M160 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM126.5 199.3c-1 .4-1.9 .8-2.9 1.2l-8 3.5c-16.4 7.3-29 21.2-34.7 38.2l-2.6 7.8c-5.6 16.8-23.7 25.8-40.5 20.2s-25.8-23.7-20.2-40.5l2.6-7.8c11.4-34.1 36.6-61.9 69.4-76.5l8-3.5c20.8-9.2 43.3-14 66.1-14c44.6 0 84.8 26.8 101.9 67.9L281 232.7l21.4 10.7c15.8 7.9 22.2 27.1 14.3 42.9s-27.1 22.2-42.9 14.3L247 287.3c-10.3-5.2-18.4-13.8-22.8-24.5l-9.6-23-19.3 65.5 49.5 54c5.4 5.9 9.2 13 11.2 20.8l23 92.1c4.3 17.1-6.1 34.5-23.3 38.8s-34.5-6.1-38.8-23.3l-22-88.1-70.7-77.1c-14.8-16.1-20.3-38.6-14.7-59.7l16.9-63.5zM68.7 398l25-62.4c2.1 3 4.5 5.8 7 8.6l40.7 44.4-14.5 36.2c-2.4 6-6 11.5-10.6 16.1L54.6 502.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L68.7 398z"/></svg>`
        const doorIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h20"/><path d="M13 20V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16"/><path d="M10 12v.01"/></svg>`

        let html = `
            <style>
                .divider {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--space-md) var(--space-md) 0 var(--space-md);
                }
                .title {
                    font-size: 1.25rem;
                    font-weight: 500;
                    color: var(--text-primary);
                    letter-spacing: -0.01em;
                }
                .stats {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    color: var(--text-secondary);
                    font-size: 13px;
                    font-weight: 500;
                }
                .stat {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .stat-interactive {
                    cursor: pointer;
                    transition: color 0.15s ease;
                }
                .stat-interactive:hover {
                    color: var(--text-primary);
                }
                .active-sensor {
                    display: flex;
                    align-items: center;
                    animation: fadeIn 0.3s ease;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(2px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
            <div class="divider">
                <div class="title">${this.roomTitle}</div>
                <div class="stats">
        `

        if (doorOpen) {
            html += `<div class="stat active-sensor" title="Dörr öppen">${doorIcon}</div>`
        }

        if (tempText) {
            html += `
                <div class="stat stat-interactive" id="tempBtn">
                    ${motionOn ? `<span class="active-sensor" style="margin-right: 2px;">${motionIcon}</span>` : ''}
                    ${tempIcon} ${tempText}
                </div>
            `
        }

        if (humidityText) {
            html += `
                <div class="stat stat-interactive" id="humidityBtn">
                    ${humidityIcon} ${humidityText}
                </div>
            `
        }

        html += `
                </div>
            </div>
        `

        this.shadowRoot!.innerHTML = html

        // Add pop-up hooks for graphs
        const tempBtn = this.shadowRoot!.getElementById("tempBtn")
        if (tempBtn) {
            tempBtn.onclick = () => {
                this.dispatchEvent(new CustomEvent("show-history", { bubbles: true, composed: true, detail: { entity: this.tempEntity, customTitle: this.roomTitle, customSubtitle: "Temperatur" } }))
            }
        }

        const humidityBtn = this.shadowRoot!.getElementById("humidityBtn")
        if (humidityBtn) {
            humidityBtn.onclick = () => {
                this.dispatchEvent(new CustomEvent("show-history", { bubbles: true, composed: true, detail: { entity: this.humidityEntity, customTitle: this.roomTitle, customSubtitle: "Luftfuktighet" } }))
            }
        }
    }

}

customElements.define("room-divider", RoomDivider)
