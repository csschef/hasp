import { getEntity } from "../store/entity-store"
import { fetchHistory } from "../services/ha-service"
import type { HAEntity } from "../types/homeassistant"

class HistoryPopup extends HTMLElement {
    private shadow: ShadowRoot
    private entityId = ""
    private entity?: HAEntity
    private customTitle = ""
    private customSubtitle = ""

    constructor() {
        super()
        this.shadow = this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.render()
    }

    async open(entityId: string, customTitle = "", customSubtitle = "") {
        this.customTitle = customTitle
        this.customSubtitle = customSubtitle
        this.entityId = entityId
        this.entity = getEntity(entityId)

        this.style.display = "block"
        document.body.classList.add("popup-open")
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.classList.add("active")
            })
        })
        window.history.pushState({ type: "popup", id: "historyPopup" }, "")
        this.updateHeader()

        const graphContainer = this.shadow.querySelector(".graph-container") as HTMLElement
        graphContainer.innerHTML = `<div class="loading">Hämtar historik...</div>`

        const history = await fetchHistory(entityId, 168)
        this.drawGraph(history)
    }

    close(fromHistory = false) {
        this.classList.remove("active")
        
        const otherPopups = ["lightPopup", "historyPopup", "tvPopup", "personPopup", "settingsPopup", "todoPopup", "calendarPopup"]
            .filter(id => id !== "historyPopup")
            .some(id => document.getElementById(id)?.classList.contains("active"));
        if (!otherPopups) document.body.classList.remove("popup-open");

        if (!fromHistory && window.history.state?.type === "popup" && window.history.state?.id === "historyPopup") {
            window.history.back()
        }
        setTimeout(() => {
            this.style.display = "none"
        }, 300)
    }

    updateHeader() {
        if (!this.entity) return
        const title = this.shadow.querySelector(".title") as HTMLElement
        const subtitle = this.shadow.querySelector(".subtitle") as HTMLElement
        const current = this.shadow.querySelector(".current-value") as HTMLElement
        const attr = this.entity.attributes

        title.textContent = this.customTitle || attr.friendly_name || this.entityId
        if (this.customSubtitle) {
            subtitle.textContent = this.customSubtitle
            subtitle.style.display = "block"
        } else {
            subtitle.style.display = "none"
        }

        const uom = attr.unit_of_measurement || ""
        const val = Number(this.entity.state)
        current.textContent = !isNaN(val) ? `${val.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} ${uom}` : this.entity.state
    }

    drawGraph(history: any[]) {
        const container = this.shadow.querySelector(".graph-container") as HTMLElement
        if (!history || history.length === 0) {
            container.innerHTML = `<div class="loading">Ingen data</div>`
            return
        }

        const processed = history.map(item => ({
            time: item.last_updated ? new Date(item.last_updated).getTime() : (item.lu * 1000),
            value: parseFloat(item.state !== undefined ? item.state : item.s)
        })).filter(item => !isNaN(item.value))

        if (processed.length === 0) {
            container.innerHTML = `<div class="loading">Otillräcklig data</div>`
            return
        }

        const now = new Date().getTime()
        const startTime = now - 168 * 60 * 60 * 1000
        const buckets = Array(168).fill(0).map(() => [] as number[])
        
        processed.forEach(p => {
            const idx = Math.floor((p.time - startTime) / 3600000)
            if (idx >= 0 && idx < 168) buckets[idx].push(p.value)
        })

        let lastVal = processed[0]?.value || 0
        const chartData = buckets.map((vals, i) => {
            if (vals.length > 0) {
                lastVal = vals.reduce((a, b) => a + b, 0) / vals.length
            }
            return { hour: i, value: lastVal, time: startTime + i * 3600000 }
        })

        const values = chartData.map(d => d.value)
        const min = Math.min(...values)
        const max = Math.max(...values)
        const range = (max - min) * 0.2 || 1
        const yMin = min - range
        const yMax = max + range

        const isTemp = this.entity?.attributes.unit_of_measurement === "°C"
        const barW = 24
        const gap = 4
        const totalW = 168 * (barW + gap)
        const height = 160

        const getColor = (v: number) => {
            if (!isTemp) return "var(--accent)"
            if (v < 20) return "var(--accent)"
            if (v < 22) return "var(--color-success)"
            if (v < 25) return "var(--yellow-accent)"
            return "var(--color-danger)"
        }

        const yLabels = [max, (min + max) / 2, min]

        container.innerHTML = `
            <div class="chart-layout">
                <div class="y-axis">
                    ${yLabels.map(v => `<div class="y-label" style="top: ${height - (v - yMin) / (yMax - yMin) * height}px">${v.toFixed(1)}</div>`).join("")}
                </div>
                <div class="scroll-container">
                    <div class="chart-inner" style="width: ${totalW}px;">
                        <svg viewBox="0 0 ${totalW} ${height}">
                            ${chartData.map((d, i) => {
                                const h = (d.value - yMin) / (yMax - yMin) * height
                                const x = i * (barW + gap)
                                const color = getColor(d.value)
                                return `<rect class="bar" x="${x}" y="${height - h}" width="${barW}" height="${h}" fill="${color}" rx="3" fill-opacity="0.8" />`
                            }).join("")}
                        </svg>
                        <div class="x-labels">
                            ${Array.from({ length: 168 }).map((_, i) => {
                                const d = new Date(startTime + i * 3600000)
                                const hr = d.getHours()
                                if (hr === 0) {
                                    const label = i >= 144 ? "Idag" : d.toLocaleDateString("sv-SE", { weekday: "short" })
                                    return `<span class="day-label" style="left: ${i * (barW + gap)}px">${label}</span>`
                                } else if (hr % 6 === 0) {
                                    return `<span class="hour-label" style="left: ${i * (barW + gap)}px">${hr}:00</span>`
                                }
                                return ""
                            }).join("")}
                        </div>
                    </div>
                </div>
            </div>
        `

        const scroller = container.querySelector(".scroll-container") as HTMLElement
        if (scroller) {
            requestAnimationFrame(() => {
                scroller.scrollLeft = totalW
            })
        }
    }

    render() {
        this.shadow.innerHTML = `
<style>
:host {
    position: fixed; inset: 0; display: none; background: rgba(0,0,0,0.4);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 10000; opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
}
:host(.active) { opacity: 1; pointer-events: auto; }

.sheet {
    position: absolute; top: 52px; left: 50%; transform: translate(-50%, 16px);
    opacity: 0; width: calc(100% - 32px); max-width: 480px;
    background: var(--color-card);
    
    
    border-radius: var(--radius-xl);
    padding: 24px; border: 1px solid var(--border-color);
    box-shadow: 0 24px 64px rgba(0,0,0,0.2); box-sizing: border-box;
    max-height: calc(100dvh - 104px); overflow-y: auto;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.sheet::-webkit-scrollbar { display: none; }
.sheet { scrollbar-width: none; }
:host(.active) .sheet { transform: translate(-50%, 0); opacity: 1; }

.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.title-wrap { display: flex; flex-direction: column; gap: 4px; }
.title { font-size: 1.125rem; font-weight: 600; color: var(--text-primary); }
.subtitle { font-size: 0.6875rem; color: var(--text-secondary); opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }

.close {
    width: 32px; height: 32px; border-radius: 50%; background: var(--color-card-alt);
    border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text-secondary); transition: all 0.2s ease;
}
.close:active { transform: scale(0.9); background: var(--border-color); }

.current-value { font-size: 2.25rem; font-weight: 200; color: var(--text-primary); margin-bottom: 24px; letter-spacing: -0.02em; }

.graph-container { border-top: 1px solid var(--border-color); padding-top: 24px; }
.chart-layout { display: flex; position: relative; }
.y-axis { width: 40px; position: relative; height: 160px; flex-shrink: 0; }
.y-label { position: absolute; right: 8px; font-size: 9px; color: var(--text-secondary); opacity: 0.6; font-weight: 700; transform: translateY(-50%); }

.scroll-container { flex-grow: 1; overflow-x: auto; padding-bottom: 12px; cursor: grab; }
.scroll-container::-webkit-scrollbar { display: none; }
.chart-inner { position: relative; height: 190px; }
svg { height: 160px; display: block; overflow: visible; }
.x-labels { position: absolute; bottom: 0; left: 0; width: 100%; height: 26px; }
.x-labels span { position: absolute; transform: translateX(-50%); white-space: nowrap; font-size: 9px; font-weight: 700; color: var(--text-secondary); opacity: 0.5; }
.day-label { bottom: 0; text-transform: uppercase; color: var(--text-primary) !important; opacity: 0.8 !important; }
.hour-label { bottom: 0; font-weight: 400 !important; font-size: 8px !important; transform: translateX(-50%) translateY(-14px) !important; }

.loading { display: flex; justify-content: center; align-items: center; height: 160px; color: var(--text-secondary); opacity: 0.5; }
</style>

<div class="sheet">
    <div class="header">
        <div class="title-wrap">
            <div class="title">Historik</div>
            <div class="subtitle"></div>
        </div>
        <div class="close"><iconify-icon icon="lucide:x"></iconify-icon></div>
    </div>
    <div class="current-value">--</div>
    <div class="graph-container"></div>
</div>
`
        const host = this.shadow.host as HTMLElement
        const sheet = this.shadow.querySelector(".sheet") as HTMLElement
        const close = this.shadow.querySelector(".close") as HTMLElement
        sheet.onclick = (e) => e.stopPropagation()
        host.onclick = (e) => { if (e.target === host) this.close() }
        close.onclick = () => this.close()
    }
}

customElements.define("history-popup", HistoryPopup)
