import { getEntity, subscribeEntity } from "../store/entity-store"
import { HA_URL } from "../services/ha-client"
import type { HAEntity } from "../types/homeassistant"

class PersonPopup extends HTMLElement {
    private shadow: ShadowRoot
    private entityId = ""
    private entity?: HAEntity
    private map: any = null
    private marker: any = null
    private labelMapping: Record<string, string> = {}
    private leafletLoaded = false

    constructor() {
        super()
        this.shadow = this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.render()
        this.loadLeaflet()
    }

    private loadLeaflet() {
        if (window.L) {
            this.leafletLoaded = true
            return
        }

        // Add Leaflet CSS
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        this.shadow.appendChild(link)

        // Add Leaflet JS
        const script = document.createElement("script")
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        script.onload = () => {
            this.leafletLoaded = true
            if (this.entityId) this.initMap()
        }
        document.head.appendChild(script)
    }

    open(entityId: string, labelMapping: Record<string, string> = {}) {
        this.entityId = entityId
        this.labelMapping = labelMapping
        this.entity = getEntity(entityId)

        this.style.display = "block"
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.classList.add("active")
            })
        })

        subscribeEntity(entityId, (e: HAEntity) => {
            this.entity = e
            this.update()
        })

        this.update()
        
        // Finalize map after animation
        setTimeout(() => {
            if (this.leafletLoaded) {
                this.initMap()
            }
        }, 400)
    }

    close() {
        this.classList.remove("active")
        setTimeout(() => {
            this.style.display = "none"
            if (this.map) {
                this.map.remove()
                this.map = null
                this.marker = null
            }
        }, 300)
    }

    private initMap() {
        if (!this.leafletLoaded || this.map || !this.entity) return

        const lat = this.entity.attributes.latitude
        const lon = this.entity.attributes.longitude

        if (lat === undefined || lon === undefined) return

        const mapContainer = this.shadow.querySelector("#map") as HTMLElement
        if (!mapContainer) return

        this.map = window.L.map(mapContainer, {
            zoomControl: false,
            attributionControl: false,
            maxZoom: 18
        }).setView([lat, lon], 17) 

        // Premium Satellite tiles (Esri World Imagery)
        window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri'
        }).addTo(this.map)

        this.marker = window.L.marker([lat, lon]).addTo(this.map)
        
        this.updateMarkerIcon()
    }

    private updateMarkerIcon() {
        if (!this.marker || !this.entity) return

        let picture = this.entity.attributes.entity_picture
        if (picture && picture.startsWith("/")) {
            picture = HA_URL + picture
        }

        if (picture) {
            const icon = window.L.divIcon({
                className: 'custom-div-icon',
                html: `
                    <div style="position: relative; width: 48px; height: 48px;">
                        <div style="background-image: url(${picture}); background-size: cover; background-position: center; width: 100%; height: 100%; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.5);"></div>
                        <div style="position: absolute; bottom: -2px; right: -2px; width: 14px; height: 14px; background: #4cd964; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
                    </div>
                `,
                iconSize: [48, 48],
                iconAnchor: [24, 24]
            })
            this.marker.setIcon(icon)
        }
    }

    private formatDuration(lastChanged: string) {
        if (!lastChanged) return ""
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
        if (!this.entity) return

        const lat = this.entity.attributes.latitude
        const lon = this.entity.attributes.longitude
        const name = this.entity.attributes.friendly_name || this.entityId

        const title = this.shadow.querySelector(".title") as HTMLElement
        const subtitle = this.shadow.querySelector(".subtitle") as HTMLElement
        
        title.textContent = name
        
        let rawState = this.entity.state
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
        
        const duration = this.formatDuration(this.entity.last_changed)
        subtitle.textContent = `${state} i ${duration}.`

        if (this.map && lat !== undefined && lon !== undefined && this.marker) {
            const newPos = [lat, lon]
            this.marker.setLatLng(newPos)
            this.map.panTo(newPos)
            this.updateMarkerIcon()
        }
    }

    render() {
        this.shadow.innerHTML = `
<style>
:host {
    position: fixed;
    inset: 0;
    display: none;
    background: rgba(0,0,0,0.3);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
}
:host(.active) {
    opacity: 1;
    pointer-events: auto;
}
.sheet {
    position: absolute;
    top: 60px;
    left: 50%;
    transform: translate(-50%, 16px);
    opacity: 0;
    width: calc(100% - 32px);
    max-width: 480px;
    background: var(--color-card);
    border-radius: var(--radius-xl);
    padding: 20px;
    border: 1px solid var(--border-color);
    box-shadow: 0 24px 64px rgba(0,0,0,0.2);
    box-sizing: border-box;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    gap: 16px;
}
:host(.active) .sheet {
    transform: translate(-50%, 0);
    opacity: 1;
}
.header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}
.header-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.title {
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: var(--text-primary);
}
.subtitle {
    font-size: 0.85rem;
    color: var(--text-secondary);
    opacity: 0.8;
}
.close {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--color-card-alt);
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 14px;
    transition: background 0.15s ease;
    flex-shrink: 0;
}
.close:active { background: var(--border-color); }
#map {
    width: 100%;
    height: 360px;
    border-radius: var(--radius-lg);
    background: var(--color-card-alt);
    z-index: 1;
    border: 1px solid var(--border-color);
    overflow: hidden;
}
</style>
<div class="sheet">
    <div class="header">
        <div class="header-info">
            <div class="title">Person</div>
            <div class="subtitle">Position</div>
        </div>
        <div class="close"><iconify-icon icon="lucide:x" style="font-size:14px;"></iconify-icon></div>
    </div>
    <div id="map"></div>
</div>
`
        const host = this.shadow.host as HTMLElement
        const sheet = this.shadow.querySelector(".sheet") as HTMLElement
        const close = this.shadow.querySelector(".close") as HTMLElement

        sheet.onclick = (e: MouseEvent) => e.stopPropagation()
        host.onclick = (e: MouseEvent) => {
            if (e.target === host) this.close()
        }
        close.onclick = () => this.close()
    }
}

declare global {
    interface Window { L: any }
}

customElements.define("person-popup", PersonPopup)
