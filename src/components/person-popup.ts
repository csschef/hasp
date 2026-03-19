import { getEntity, subscribeEntity, getEntitiesByDomain } from "../store/entity-store"
import { HA_URL } from "../services/ha-client"
import { fetchHistory } from "../services/ha-service"
import type { HAEntity } from "../types/homeassistant"

class PersonPopup extends HTMLElement {
    private shadow: ShadowRoot
    private entityId = ""
    private entity?: HAEntity
    private map: any = null
    private markers: Map<string, any> = new Map()
    private labelMapping: Record<string, string> = {}
    private leafletLoaded = false
    private expandedClusters: Set<string> = new Set()

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

        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        this.shadow.appendChild(link)

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
        document.body.classList.add("popup-open")
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.classList.add("active")
            })
        })
        window.history.pushState({ type: "popup", id: "personPopup" }, "")

        subscribeEntity(entityId, (e: HAEntity) => {
            this.entity = e
            this.update()
        })

        this.update()
        this.fetchAndRenderHistory()

        setTimeout(() => {
            if (this.leafletLoaded) {
                this.initMap()
            }
        }, 400)
    }

    private getStateDate(state: any): number {
        const val = state.last_changed || state.lc || state.last_updated || state.lu
        if (!val) return 0
        if (typeof val === 'number') return val * 1000
        const d = new Date(val).getTime()
        return isNaN(d) ? 0 : d
    }

    private getStateName(state: any): string {
        return state.state || state.s || "unknown"
    }

    private formatDuration(seconds: number) {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const d = Math.floor(h / 24)

        if (d > 0) {
            const dText = d === 1 ? 'dag' : 'dagar'
            const hText = (h % 24) === 1 ? 'timme' : 'timmar'
            return `${d} ${dText} och ${h % 24} ${hText}`
        }

        if (h > 0) {
            const hText = h === 1 ? 'timme' : 'timmar'
            const mText = m === 1 ? 'min' : 'min'
            return m > 0 ? `${h} ${hText} ${m} ${mText}` : `${h} ${hText}`
        }
        return `${m} ${m === 1 ? 'minut' : 'minuter'}`
    }

    private async fetchAndRenderHistory() {
        const historyContainer = this.shadow.querySelector(".history-content") as HTMLElement
        if (!historyContainer) return

        historyContainer.innerHTML = '<div class="no-history">Hämtar historik...</div>'

        const history = await fetchHistory(this.entityId, 24)
        if (!history || history.length === 0) {
            historyContainer.innerHTML = '<div class="no-history">Ingen historik tillgänglig</div>'
            return
        }

        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        const segments: any[] = []

        for (let i = 0; i < history.length; i++) {
            const state = history[i]
            const nextState = history[i + 1]

            const startTime = this.getStateDate(state)
            const endTime = nextState ? this.getStateDate(nextState) : now.getTime()

            if (endTime < startOfToday) continue

            const actualStart = Math.max(startTime, startOfToday)
            const durationSec = Math.round((endTime - actualStart) / 1000)

            if (durationSec < 10) continue

            segments.push({
                state: this.getStateName(state),
                start: new Date(actualStart),
                end: new Date(endTime),
                duration: durationSec
            })
        }

        if (segments.length === 0) {
            historyContainer.innerHTML = '<div class="no-history">Ingen aktivitet idag</div>'
            return
        }

        segments.reverse()

        historyContainer.innerHTML = segments.map(seg => {
            let label = seg.state
            if (this.labelMapping[seg.state]) {
                label = this.labelMapping[seg.state]
            } else if (label === "home") {
                label = "Hemma"
            } else if (label === "not_home") {
                label = "Borta"
            } else {
                label = label.charAt(0).toUpperCase() + label.slice(1)
            }

            const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            return `
                <div class="history-item">
                    <div class="item-details">
                        <div class="item-header">
                            <span class="item-location">${label}</span>
                            <span class="item-duration">${this.formatDuration(seg.duration)}</span>
                        </div>
                        <div class="item-time">${formatTime(seg.start)} – ${formatTime(seg.end)}</div>
                    </div>
                </div>
            `
        }).join('')
    }

    close(fromHistory = false) {
        this.classList.remove("active")
        
        const otherPopups = ["lightPopup", "historyPopup", "tvPopup", "personPopup", "settingsPopup", "todoPopup", "calendarPopup"]
            .filter(id => id !== "personPopup")
            .some(id => document.getElementById(id)?.classList.contains("active"));
        if (!otherPopups) document.body.classList.remove("popup-open");

        if (!fromHistory && window.history.state?.type === "popup" && window.history.state?.id === "personPopup") {
            window.history.back()
        }
        setTimeout(() => {
            this.style.display = "none"
            this.expandedClusters.clear()
            if (this.map) {
                this.map.remove()
                this.map = null
                this.markers.clear()
            }
        }, 300)
    }

    private getClusterId(lat: number, lon: number): string {
        return `${lat.toFixed(4)}_${lon.toFixed(4)}`
    }

    private refreshMarkers() {
        if (!this.map) return

        // Clear existing markers
        this.markers.forEach(m => this.map.removeLayer(m))
        this.markers.clear()

        const people = getEntitiesByDomain("person")
        const groups = new Map<string, HAEntity[]>()

        people.forEach(p => {
            const lat = p.attributes.latitude
            const lon = p.attributes.longitude
            if (lat !== undefined && lon !== undefined) {
                const id = this.getClusterId(lat, lon)
                if (!groups.has(id)) groups.set(id, [])
                groups.get(id)!.push(p)
            }
        })

        groups.forEach((members, clusterId) => {
            if (members.length > 1 && !this.expandedClusters.has(clusterId)) {
                // Render Cluster
                const lat = members[0].attributes.latitude!
                const lon = members[0].attributes.longitude!
                
                const clusterIcon = window.L.divIcon({
                    className: 'cluster-icon',
                    html: `<div style="width: 38px; height: 38px; background: var(--accent); border: 3px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">${members.length}</div>`,
                    iconSize: [38, 38],
                    iconAnchor: [19, 19]
                })

                const marker = window.L.marker([lat, lon], { icon: clusterIcon }).addTo(this.map)
                marker.on('click', (e: any) => {
                    window.L.DomEvent.stopPropagation(e)
                    this.expandedClusters.add(clusterId)
                    this.refreshMarkers()
                })
                this.markers.set(`cluster_${clusterId}`, marker)
            } else {
                // Render Individuals
                members.forEach((p, idx) => {
                    const lat = p.attributes.latitude!
                    const lon = p.attributes.longitude!
                    let finalLat = lat
                    let finalLon = lon

                    if (members.length > 1) {
                        const offset = 0.00015
                        const angle = (idx * (360 / members.length) + 45) * Math.PI / 180
                        finalLat += Math.cos(angle) * offset
                        finalLon += Math.sin(angle) * offset
                    }

                    const marker = window.L.marker([finalLat, finalLon]).addTo(this.map)
                    this.markers.set(p.entity_id, marker)
                    this.updateMarkerIcon(p.entity_id)

                    if (p.entity_id === this.entityId) {
                        marker.setZIndexOffset(1000)
                    }
                })
            }
        })
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

        // Google Hybrid: Satellite + High Quality White Labels
        window.L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '&copy; Google Maps'
        }).addTo(this.map)

        this.map.on('click', () => {
            if (this.expandedClusters.size > 0) {
                this.expandedClusters.clear()
                this.refreshMarkers()
            }
        })

        // Draw Zones
        const zones = getEntitiesByDomain("zone")
        zones.forEach(zone => {
            const zLat = zone.attributes.latitude
            const zLon = zone.attributes.longitude
            const radius = zone.attributes.radius || 100
            const zoneName = zone.attributes.friendly_name || ""

            if (zLat !== undefined && zLon !== undefined) {
                window.L.circle([zLat, zLon], {
                    radius: radius,
                    color: "rgba(118, 124, 218, 0.7)",
                    weight: 2,
                    fillColor: "rgba(118, 124, 218, 0.25)",
                    fillOpacity: 1,
                    interactive: false
                }).addTo(this.map)

                if (zoneName) {
                    const labelIcon = window.L.divIcon({
                        className: 'zone-label',
                        html: `<div style="color: white; font-size: 10px; font-weight: 500; text-shadow: 0 1px 3px rgba(0,0,0,0.8); white-space: nowrap; text-align: center;">${zoneName}</div>`,
                        iconSize: [100, 20],
                        iconAnchor: [50, -25]
                    })
                    window.L.marker([zLat, zLon], { icon: labelIcon, interactive: false }).addTo(this.map)
                }
            }
        })

        this.refreshMarkers()
    }

    private updateMarkerIcon(entityId: string) {
        const marker = this.markers.get(entityId)
        const person = getEntity(entityId)
        if (!marker || !person) return

        let picture = person.attributes.entity_picture
        if (picture && picture.startsWith("/")) {
            picture = HA_URL + picture
        }

        if (picture) {
            const icon = window.L.divIcon({
                className: 'custom-div-icon',
                html: `
                    <div style="position: relative; width: 48px; height: 48px;">
                        <div style="background-image: url(${picture}); background-size: cover; background-position: center; width: 100%; height: 100%; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.5);"></div>
                    </div>
                `,
                iconSize: [48, 48],
                iconAnchor: [24, 24]
            })
            marker.setIcon(icon)
        }
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

        if (this.labelMapping[rawState]) {
            state = this.labelMapping[rawState]
        } else if (state === "home") {
            state = "Hemma"
        } else if (state === "not_home") {
            state = "Borta"
        } else {
            state = state.charAt(0).toUpperCase() + state.slice(1)
        }

        const lastChanged = this.getStateDate(this.entity)
        const duration = this.formatDuration(Math.round((new Date().getTime() - lastChanged) / 1000))
        subtitle.textContent = `${state} i ${duration}.`

        if (this.map && lat !== undefined && lon !== undefined) {
             this.map.panTo([lat, lon])
             this.refreshMarkers()
        }
    }

    render() {
        this.shadow.innerHTML = `
<style>
:host {
    position: fixed;
    inset: 0;
    display: none;
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
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
    top: 52px; /* Matches layout updates */
    left: 50%;
    transform: translate(-50%, 16px);
    opacity: 0;
    width: calc(100% - 32px);
    max-width: 480px;
    max-height: calc(100dvh - 104px);
    overflow-y: auto;
    background: var(--color-card);
    
    
    border-radius: var(--radius-xl);
    padding: 2.2rem 1.4rem 2.2rem;
    border: 1px solid var(--border-color);
    box-shadow: 0 24px 64px rgba(0,0,0,0.2);
    box-sizing: border-box;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}
.sheet::-webkit-scrollbar { display: none; }
.sheet { scrollbar-width: none; }
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
    font-size: 0.875rem;
    transition: background 0.15s ease;
    flex-shrink: 0;
}
.close:active { background: var(--border-color); }

#map {
    width: 100%;
    height: 300px;
    border-radius: var(--radius-lg);
    background: var(--color-card-alt);
    z-index: 1;
    border: 1px solid var(--border-color);
    overflow: hidden;
    flex-shrink: 0;
}

.history-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.history-title {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
    opacity: 0.5;
    padding-left: 2px;
}
.history-content {
    display: flex;
    flex-direction: column;
    overflow-y: visible;
}
.history-content::-webkit-scrollbar { width: 0; }
.history-item {
    display: flex;
    align-items: center;
    padding: 12px 0;
    background: transparent;
}
.history-item:not(:last-child) {
    border-bottom: 1px solid rgba(var(--text-secondary-rgb, 128, 128, 128), 0.1);
}
.item-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-grow: 1;
}
.item-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
}
.item-location {
    font-size: 0.9375rem;
    font-weight: 400;
    color: var(--text-primary);
}
.item-duration {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: 400;
}
.item-time {
    font-size: 0.75rem;
    color: var(--text-secondary);
    opacity: 0.6;
}
.no-history {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    opacity: 0.5;
    text-align: center;
    padding: 30px;
}
</style>
<div class="sheet">
    <div class="header">
        <div class="header-info">
            <div class="title">Person</div>
            <div class="subtitle">Position</div>
        </div>
        <div class="close"><iconify-icon icon="lucide:x" style="font-size:0.875rem;"></iconify-icon></div>
    </div>
    <div id="map"></div>
    <div class="history-section">
        <div class="history-title">Historik idag</div>
        <div class="history-content">
            <div class="no-history">Hämtar historik...</div>
        </div>
    </div>
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
