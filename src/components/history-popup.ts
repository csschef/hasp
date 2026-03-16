import { getEntity, subscribeEntity } from "../store/entity-store"
import { fetchHistory } from "../services/ha-service"
import type { HAEntity } from "../types/homeassistant"

class HistoryPopup extends HTMLElement {

    private shadow: ShadowRoot
    private entityId = ""
    private entity?: HAEntity

    constructor() {
        super()
        this.shadow = this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.render()
    }

    private customTitle = ""
    private customSubtitle = ""

    async open(entityId: string, customTitle = "", customSubtitle = "") {
        this.customTitle = customTitle
        this.customSubtitle = customSubtitle
        this.entityId = entityId
        this.entity = getEntity(entityId)

        this.style.display = "block"
        // Force a reflow before snapping to active
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.classList.add("active")
            })
        })
        this.updateHeader()

        const graphContainer = this.shadow.querySelector(".graph-container") as HTMLElement
        graphContainer.innerHTML = `<div class="loading">Hämtar historik...</div>`

        const history = await fetchHistory(entityId, 168)
        this.drawGraph(history)
    }

    close() {
        this.classList.remove("active")
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
        const graphContainer = this.shadow.querySelector(".graph-container") as HTMLElement
        if (!history || history.length === 0) {
            graphContainer.innerHTML = `<div class="loading">Ingen data</div>`
            return
        }

        const validStates = history.map(item => ({
            time: item.last_updated !== undefined ? new Date(item.last_updated).getTime() : item.lu * 1000,
            value: parseFloat(item.state !== undefined ? item.state : item.s)
        })).filter(s => !isNaN(s.value))

        if (validStates.length === 0) {
            graphContainer.innerHTML = `<div class="loading">Otillräcklig data</div>`
            return
        }

        const now = new Date().getTime()
        const start = now - 168 * 60 * 60 * 1000
        
        // Group into hourly buckets
        const buckets: number[][] = Array(168).fill(0).map(() => [])
        validStates.forEach(s => {
            const h = Math.floor((s.time - start) / (3600 * 1000))
            if (h >= 0 && h < 168) buckets[h].push(s.value)
        })

        // Fill gaps with carry-forward (HA only records changes)
        let lastKnownValue = validStates[0]?.value || 0
        const hourlyData = buckets.map((vals, i) => {
            if (vals.length > 0) {
                lastKnownValue = vals.reduce((a, b) => a + b, 0) / vals.length
            }
            return {
                hour: i,
                value: lastKnownValue,
                time: start + i * 3600 * 1000
            }
        })

        const values = hourlyData.map(d => d.value)
        const minVal = Math.min(...values)
        const maxVal = Math.max(...values)
        const pad = (maxVal - minVal) * 0.2 || 1
        const yMin = minVal - pad
        const yMax = maxVal + pad

        const isTemp = this.entity?.attributes.unit_of_measurement === "°C"
        const barWidth = 24
        const barGap = 4
        const totalWidth = 168 * (barWidth + barGap)
        const chartHeight = 160
        
        const getBarColor = (val: number) => {
            if (!isTemp) return "var(--accent)"
            if (val < 19) return "var(--accent)"         // Kallt (Blå)
            if (val < 21) return "var(--color-success)"  // Lagom (Grön)
            if (val < 24) return "var(--yellow-accent)"  // Varmt (Gul)
            return "var(--color-danger)"                 // Hett (Röd)
        }

        const yAxisSteps = [maxVal, (minVal + maxVal) / 2, minVal]

        graphContainer.innerHTML = `
            <div class="chart-layout">
                <div class="y-axis">
                    ${yAxisSteps.map(val => {
                        const y = chartHeight - ((val - yMin) / (yMax - yMin)) * chartHeight
                        return `<div class="y-label" style="top: ${y}px">${val.toFixed(1)}</div>`
                    }).join('')}
                </div>
                <div class="scroll-container">
                    <div class="chart-inner" style="width: ${totalWidth}px;">
                        <svg viewBox="0 0 ${totalWidth} ${chartHeight}">
                            ${hourlyData.map((d, i) => {
                                const h = ((d.value - yMin) / (yMax - yMin)) * chartHeight
                                const x = i * (barWidth + barGap)
                                const color = getBarColor(d.value)
                                return `<rect class="bar" x="${x}" y="${chartHeight - h}" width="${barWidth}" height="${h}" fill="${color}" rx="3" fill-opacity="0.8" />`
                            }).join('')}
                        </svg>
                        <div class="x-labels">
                            ${Array.from({length: 168}).map((_, i) => {
                                const d = new Date(start + i * 3600 * 1000)
                                const hour = d.getHours()
                                const isDayStart = hour === 0
                                const isQuarterDay = hour % 6 === 0
                                
                                if (isDayStart) {
                                    const label = i >= 168 - 24 ? 'Idag' : d.toLocaleDateString("sv-SE", { weekday: "short" })
                                    return `<span class="day-label" style="left: ${i * (barWidth + barGap)}px">${label}</span>`
                                } else if (isQuarterDay) {
                                    return `<span class="hour-label" style="left: ${i * (barWidth + barGap)}px">${hour}:00</span>`
                                }
                                return ''
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `

        // Scroll to the end (latest data)
        const scrollContainer = graphContainer.querySelector(".scroll-container")
        if (scrollContainer) {
            requestAnimationFrame(() => {
                scrollContainer.scrollLeft = totalWidth
            })
        }
    }

    render() {
        this.shadow.innerHTML = `
<style>
:host {
    position: fixed; inset: 0; display: none; background: rgba(0,0,0,0.3);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    z-index: 10000; opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
}
:host(.active) { opacity: 1; pointer-events: auto; }

.sheet {
    position: absolute; top: 52px; left: 50%; transform: translate(-50%, 16px);
    opacity: 0; width: calc(100% - 32px); max-width: 480px;
    background: var(--color-card); border-radius: var(--radius-xl);
    padding: 24px; border: 1px solid var(--border-color);
    box-shadow: 0 24px 64px rgba(0,0,0,0.2); box-sizing: border-box;
    max-height: calc(100dvh - 76px); overflow-y: auto;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
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
