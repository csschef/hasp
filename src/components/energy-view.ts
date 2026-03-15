import { getEntity, subscribeEntity } from "../store/entity-store"

class EnergyView extends HTMLElement {
    private energyEntity = "sensor.nordpool_kwh_se4_sek_2_10_0"
    private pricesToday: number[] = []
    private pricesTomorrow: number[] = []

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.render()
        subscribeEntity(this.energyEntity, (state: any) => {
            if (state?.attributes) {
                this.pricesToday = this.parseNordpoolData(state.attributes.raw_today || state.attributes.today)
                this.pricesTomorrow = this.parseNordpoolData(state.attributes.raw_tomorrow || state.attributes.tomorrow)
            }
            this.render()
        })
    }

    private parseNordpoolData(data: any): number[] {
        if (!data || !Array.isArray(data)) return []
        // Nordpool can return [number, number...] or [{value: number, ...}, ...]
        return data.map(item => typeof item === 'object' ? item.value : item)
    }

    private getPriceStatus(price: number): { color: string; label: string; bg: string } {
        if (!this.pricesToday.length) return { color: "var(--text-secondary)", label: "Laddar...", bg: "var(--color-card-alt)" }

        const min = Math.min(...this.pricesToday)
        const max = Math.max(...this.pricesToday)
        const range = max - min

        if (price <= min + range * 0.25) return { color: "#a3be8c", label: "Billigt", bg: "rgba(163, 190, 140, 0.15)" }
        if (price >= max - range * 0.25) return { color: "#bf616a", label: "Dyrast", bg: "rgba(191, 97, 106, 0.15)" }
        return { color: "#ebcb8b", label: "Normalt", bg: "rgba(235, 203, 139, 0.15)" }
    }

    private generateAreaPath(prices: number[], width: number, height: number, maxPrice: number, xOffset: number): string {
        if (prices.length === 0) return ""
        const points = prices.map((p, i) => {
            const x = xOffset + (i / (prices.length - 1)) * (width - xOffset)
            const y = height - (p / maxPrice) * height
            return `${x},${y}`
        })
        return `M${xOffset},${height} L${points.join(' L')} L${width},${height} Z`
    }

    private generateLinePath(prices: number[], width: number, height: number, maxPrice: number, xOffset: number): string {
        if (prices.length === 0) return ""
        const points = prices.map((p, i) => {
            const x = xOffset + (i / (prices.length - 1)) * (width - xOffset)
            const y = height - (p / maxPrice) * height
            return `${x},${y}`
        })
        return `M${points.join(' L')}`
    }

    render() {
        const entity = getEntity(this.energyEntity)
        const activePrices = this.pricesToday.length > 0 ? this.pricesToday : []

        if (!entity || activePrices.length === 0) {
            this.shadowRoot!.innerHTML = `
                <div style="padding: 80px 20px; text-align: center; color: var(--text-secondary); font-family: var(--font-main);">
                    <iconify-icon icon="line-md:loading-twotone-loop" style="font-size: 2.5rem; margin-bottom: 16px; color: var(--accent);"></iconify-icon>
                    <div style="font-size: 0.9rem; font-weight: 500; opacity: 0.7;">Ansluter till Nordpool...</div>
                </div>
            `
            return
        }

        const currentPrice = parseFloat(entity.state) || 0
        const { color, label, bg } = this.getPriceStatus(currentPrice)

        const minPrice = Math.min(...activePrices)
        const maxPrice = Math.max(...activePrices)
        const avgPrice = activePrices.reduce((a, b) => a + b, 0) / activePrices.length

        const hours = new Date().getHours()
        const xOffset = 32
        const nowX = xOffset + (hours / 23) * (400 - xOffset)

        this.shadowRoot!.innerHTML = `
        <style>
            :host { display: block; padding: 0 var(--space-md) 24px; color: var(--text-primary); font-family: var(--font-main); }
            h2 {
                font-size: 0.6875rem;
                font-weight: 500;
                color: var(--text-secondary);
                letter-spacing: 0.01em;
                text-transform: uppercase;
                margin: 32px 0 16px;
                opacity: 1;
            }

            .hero-card {
                background: var(--color-card);
                border-radius: var(--radius-xl);
                padding: 32px 24px;
                border: 1px solid var(--border-color);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                position: relative;
                overflow: hidden;
            }
            .hero-card::before {
                content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
                background: radial-gradient(circle at center, ${color}15 0%, transparent 70%);
                pointer-events: none;
            }

            .price-display { display: flex; align-items: baseline; gap: 6px; z-index: 1; }
            .price-val { font-size: 4rem; font-weight: 200; letter-spacing: -4px; line-height: 1; color: var(--text-primary); }
            .price-unit { font-size: 1rem; color: var(--text-secondary); opacity: 0.7; font-weight: 400; }

            .status-pill {
                background: ${bg};
                color: ${color};
                padding: 6px 16px;
                border-radius: 100px;
                font-weight: 700;
                font-size: 0.75rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-top: 4px;
                z-index: 1;
            }

            .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 24px; }
            .stat-card {
                background: var(--color-card);
                border-radius: var(--radius-lg);
                padding: 16px 12px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                border: 1px solid var(--border-color);
            }
            .stat-label { font-size: 0.625rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; opacity: 0.6; letter-spacing: 0.05em; }
            .stat-val { font-size: 0.9375rem; font-weight: 500; letter-spacing: -0.01em; }

            /* ── Chart Section ── */
            .chart-view {
                background: var(--color-card);
                border-radius: var(--radius-xl);
                padding: 24px 20px 20px;
                border: 1px solid var(--border-color);
                margin-top: 12px;
            }
            .chart-container { position: relative; height: 160px; width: 100%; margin-top: 24px; }
            svg { width: 100%; height: 100%; overflow: visible; display: block; }
            
            .chart-area { fill: url(#areaGrad); transition: all 0.5s ease; }
            .chart-line { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; transition: all 0.5s ease; }
            
            .marker-line { stroke: var(--text-primary); stroke-width: 1; stroke-dasharray: 4,4; opacity: 0.2; }
            
            .marker-dot-css {
                position: absolute;
                width: 10px;
                height: 10px;
                background: var(--text-primary);
                border: 2px solid var(--color-card);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                z-index: 100;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                pointer-events: none;
            }
            
            .chart-text {
                font-size: 10px;
                fill: var(--text-secondary);
                font-weight: 500;
                opacity: 0.6;
            }
            .now-label {
                font-size: 11px;
                fill: var(--text-primary);
                font-weight: 700;
            }

            .chart-labels { display: flex; justify-content: space-between; margin-top: 16px; font-size: 0.625rem; color: var(--text-secondary); opacity: 0.5; font-weight: 600; margin-left: ${xOffset}px; }
        </style>

        <h2>Energi · SE4</h2>

        <div class="hero-card">
            <div class="price-display">
                <div class="price-val">${(currentPrice).toFixed(1)}</div>
                <div class="price-unit">öre / kWh</div>
            </div>
            <div class="status-pill">${label}</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary); opacity: 0.5; margin-top: 4px;">Uppdateras varje timme</div>
        </div>

        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-label">Lägsta</div>
                <div class="stat-val" style="color: #a3be8c;">${(minPrice).toFixed(1)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Snitt</div>
                <div class="stat-val" style="color: var(--accent);">${(avgPrice).toFixed(1)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Högsta</div>
                <div class="stat-val" style="color: #bf616a;">${(maxPrice).toFixed(1)}</div>
            </div>
        </div>

        <div class="chart-view">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div class="stat-label" style="opacity: 0.8;">Priskurva idag</div>
                <div style="font-size: 0.625rem; color: var(--accent); font-weight: 700;">SEK / kWh</div>
            </div>

            <div class="chart-container">
                <div class="marker-dot-css" 
                     style="left: ${(nowX / 400) * 100}%; 
                            top: ${((160 - (currentPrice / (maxPrice * 1.1)) * 160) / 160) * 100}%;">
                </div>
                <svg viewBox="0 0 400 160" preserveAspectRatio="none" style="overflow: visible;">
                    <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.3" />
                            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
                        </linearGradient>
                    </defs>
                    
                    <!-- Guide lines (Horizontal) -->
                    <line x1="${xOffset}" y1="0" x2="400" y2="0" stroke="var(--border-color)" stroke-width="0.5" stroke-dasharray="2,4" />
                    <text x="0" y="4" class="chart-text">${(maxPrice * 1.1).toFixed(0)}</text>
                    
                    <line x1="${xOffset}" y1="40" x2="400" y2="40" stroke="var(--border-color)" stroke-width="0.5" stroke-dasharray="2,4" />
                    <text x="0" y="44" class="chart-text">${((maxPrice * 1.1) * 0.75).toFixed(0)}</text>

                    <line x1="${xOffset}" y1="80" x2="400" y2="80" stroke="var(--border-color)" stroke-width="0.5" stroke-dasharray="2,4" />
                    <text x="0" y="84" class="chart-text">${((maxPrice * 1.1) * 0.5).toFixed(0)}</text>

                    <line x1="${xOffset}" y1="120" x2="400" y2="120" stroke="var(--border-color)" stroke-width="0.5" stroke-dasharray="2,4" />
                    <text x="0" y="124" class="chart-text">${((maxPrice * 1.1) * 0.25).toFixed(0)}</text>

                    <!-- Area Fill -->
                    <path class="chart-area" d="${this.generateAreaPath(activePrices, 400, 160, maxPrice * 1.1, xOffset)}" />
                    
                    <!-- Main Line -->
                    <path class="chart-line" d="${this.generateLinePath(activePrices, 400, 160, maxPrice * 1.1, xOffset)}" />

                    <!-- Indicator for 'Now' -->
                    <line class="marker-line" x1="${nowX}" y1="0" x2="${nowX}" y2="160" />
                </svg>
            </div>

            <div class="chart-labels">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
            </div>
        </div>

        ${this.pricesTomorrow.length > 0 ? `
            <div style="margin-top: 32px; padding: 20px; background: rgba(91, 127, 166, 0.05); border-radius: var(--radius-lg); border: 1px dashed var(--accent-muted); display: flex; flex-direction: column; align-items: center; gap: 8px;">
                 <div class="stat-label">I morgon</div>
                 <div style="font-size: 0.8125rem; font-weight: 500;">Morgondagens priser är tillgängliga</div>
                 <div style="font-size: 0.75rem; opacity: 0.6; text-align: center;">Snittpris imorgon: ${(this.pricesTomorrow.reduce((a, b) => a + b, 0) / 24).toFixed(1)} öre</div>
            </div>
        ` : ''}
        `
    }
}

customElements.define("energy-view", EnergyView)
