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

        // Support BOTH WebSocket format (s, lu) and REST format (state, last_updated) seamlessly
        const validStates = history
            .filter(item => {
                const sv = item.state !== undefined ? item.state : item.s
                return sv !== undefined && sv !== null && !isNaN(parseFloat(sv))
            })
            .map(item => {
                const sv = item.state !== undefined ? item.state : item.s
                // lu in WS is often a unix timestamp in seconds, last_updated is ISO string
                const rawTime = item.last_updated !== undefined ? item.last_updated : item.lu
                // If the time is a number, HA typically sends it as *seconds* so multiply by 1000
                const timeStr = typeof rawTime === "number" ? rawTime * 1000 : new Date(rawTime as string).getTime()

                return {
                    time: timeStr,
                    value: parseFloat(sv)
                }
            })

        if (validStates.length < 2) {
            graphContainer.innerHTML = `<div class="loading">Otillräcklig data</div>`
            return
        }

        const now = new Date().getTime()
        const start = now - 168 * 60 * 60 * 1000

        // Downsample points to make the line perfectly smooth and remove the jagged 'mushy' effect.
        // We will group the 7 days into 100 visual buckets.
        const bucketCount = 100
        const bucketSize = (now - start) / bucketCount
        const buckets = new Map<number, number[]>()

        validStates.forEach(s => {
            if (s.time < start) return
            const b = Math.floor((s.time - start) / bucketSize)
            if (!buckets.has(b)) buckets.set(b, [])
            buckets.get(b)!.push(s.value)
        })

        const smoothedStates = Array.from(buckets.keys()).sort((a, b) => a - b).map(b => {
            const vals = buckets.get(b)!
            const avg = vals.reduce((sum, v) => sum + v, 0) / vals.length
            return { time: start + b * bucketSize + bucketSize / 2, value: avg }
        })

        // Also push the absolute latest value exactly at the end to snap it natively to "Nu"
        if (validStates.length > 0) {
            smoothedStates.push({ time: now, value: validStates[validStates.length - 1].value })
        }

        const minVal = Math.min(...smoothedStates.map(s => s.value))
        const maxVal = Math.max(...smoothedStates.map(s => s.value))

        // Give breathing room so perfectly flat peaks don't kiss the top of the modal bounding box
        const padY = (maxVal - minVal) * 0.15 || 1
        const yMin = minVal - padY
        const yMax = maxVal + padY

        const width = graphContainer.clientWidth || 300
        const height = 180

        // Create a dedicated gutter on the left for the Y-axis labels so the graph curve never traces behind them
        const textMargin = 32
        const graphWidth = width - textMargin

        const pts = smoothedStates.map(s => {
            const x = textMargin + Math.max(0, ((s.time - start) / (now - start)) * graphWidth)
            const y = height - ((s.value - yMin) / (yMax - yMin)) * height
            return { x, y }
        })

        // Build a sleek Cubic Bezier Curve logic
        let lineData = `M${pts[0].x},${pts[0].y}`
        for (let i = 1; i < pts.length; i++) {
            const cur = pts[i]
            const prev = pts[i - 1]
            // We use standard horizontal-bias control points for a smooth time-series ripple
            const cp1x = prev.x + (cur.x - prev.x) / 2
            const cp1y = prev.y
            const cp2x = cur.x - (cur.x - prev.x) / 2
            const cp2y = cur.y
            lineData += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${cur.x},${cur.y}`
        }
        const pathData = lineData + ` L${width},${height} L${textMargin},${height} Z`

        const isTemp = this.entity?.attributes.unit_of_measurement === "°C"
        const strokeColor = isTemp ? "#ff9c3a" : "#5ea8ff"

        const midY = (yMin + yMax) / 2

        // Let's generate nice 7-day abbreviations for the X axis
        const days = []
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now - i * 24 * 60 * 60 * 1000)
            const dayName = d.toLocaleDateString("sv-SE", { weekday: "short" })
            days.push(`<span>${dayName}</span>`)
        }

        const svg = `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <defs>
                <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.3" />
                    <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0" />
                </linearGradient>
            </defs>
            <!-- Background Guides -->
            <!-- Adjusted stroke opacity to make it lighter, and padded start bounds -->
            <line x1="${textMargin}" y1="${height / 2}" x2="${width}" y2="${height / 2}" stroke="var(--text-secondary)" stroke-opacity="0.1" stroke-dasharray="2, 6" />
            <line x1="${textMargin}" y1="${height - 1}" x2="${width}" y2="${height - 1}" stroke="var(--text-secondary)" stroke-opacity="0.1" stroke-dasharray="2, 6" />

            <path d="${pathData}" fill="url(#fillGrad)" />
            <path d="${lineData}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            
            <!-- Shifting text bounds to explicitly anchor inside the reserved gutter -->
            <text x="0" y="12" fill="var(--text-secondary)" font-size="10" font-weight="600">${yMax.toFixed(1)}</text>
            <text x="0" y="${height / 2 - 4}" fill="var(--text-secondary)" font-size="10" font-weight="500" opacity="0.6">${midY.toFixed(1)}</text>
            <text x="0" y="${height - 6}" fill="var(--text-secondary)" font-size="10" font-weight="600">${yMin.toFixed(1)}</text>
        </svg>
        <div class="x-axis" style="padding-left: ${textMargin}px;">
            ${days.join("")}
        </div>
        `

        graphContainer.innerHTML = svg
    }

    render() {
        this.shadow.innerHTML = `

<style>
:host {
    position: fixed;
    inset: 0;
    display: none;
    background: var(--color-overlay);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: none;
}
:host(.active) {
    opacity: 1;
    pointer-events: auto;
}

.sheet {
    position: absolute;
    top: 32px;
    left: 50%;
    transform: translate(-50%, 20px);
    opacity: 0;
    width: calc(100% - 32px);
    max-width: 460px;
    background: var(--color-card);
    border-radius: 28px;
    padding: 24px;
    padding-bottom: 20px;
    box-shadow: 0 12px 48px rgba(0,0,0,0.22);
    box-sizing: border-box;
    max-height: calc(100dvh - 64px);
    overflow-y: auto;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
:host(.active) .sheet {
    transform: translate(-50%, 0);
    opacity: 1;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.title-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.title {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-primary);
}

.subtitle {
    font-size: 0.9rem;
    color: var(--text-secondary);
    font-weight: 500;
}

.current-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    margin-top: -12px;
    margin-bottom: 24px;
}

.close {
    font-size: 28px;
    cursor: pointer;
    color: var(--text-primary);
}

.graph-container {
    position: relative;
    width: 100%;
    height: auto;
    border-radius: 12px;
}

.graph-container svg {
    width: 100%;
    height: 180px;
    display: block;
    overflow: visible;
}

.loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 180px;
    color: var(--text-secondary);
    font-size: 0.9rem;
}

.x-axis {
    display: flex;
    justify-content: space-between;
    margin-top: 12px;
    margin-bottom: 8px; /* Buffer against the card edge */
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 500;
}
</style>

<div class="sheet">
    <div class="header">
        <div class="title-wrap">
            <div class="title">Laddar...</div>
            <div class="subtitle" style="display:none;"></div>
        </div>
        <div class="close">×</div>
    </div>
    <div class="current-value">--</div>
    <div class="graph-container"></div>
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

customElements.define("history-popup", HistoryPopup)
