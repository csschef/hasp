import { getEntity, subscribeEntity } from "../store/entity-store"

class EnergyView extends HTMLElement {
    private energyEntity = "sensor.nordpool_kwh_se3_sek_3_10_025" // Fallback name
    private prices: any[] = []

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.render()
        subscribeEntity(this.energyEntity, (state: any) => {
            if (state?.attributes?.today) {
                this.prices = state.attributes.today
            }
            this.render()
        })
    }

    private getPriceStatus(price: number): { color: string; label: string } {
        if (!this.prices.length) return { color: "var(--text-secondary)", label: "Hämtar..." }
        const min = Math.min(...this.prices)
        const max = Math.max(...this.prices)
        const range = max - min
        
        if (price <= min + range * 0.3) return { color: "var(--color-success)", label: "Billigt" }
        if (price >= max - range * 0.3) return { color: "var(--color-danger)", label: "Dyrast" }
        return { color: "var(--yellow-accent)", label: "Normalt" }
    }

    render() {
        const entity = getEntity(this.energyEntity)
        
        if (!entity || !this.prices.length) {
            this.shadowRoot!.innerHTML = `
                <div style="padding: 60px var(--space-md); text-align: center; color: var(--text-secondary); font-size: 0.8125rem; opacity: 0.5;">
                    <iconify-icon icon="lucide:zap" style="font-size: 2rem; display: block; margin-bottom: 12px; opacity: 0.4;"></iconify-icon>
                    Hämtar prisdata…
                </div>
            `
            return
        }

        const currentPrice = parseFloat(entity.state) || 0
        const { color, label } = this.getPriceStatus(currentPrice)
        
        const minPrice = Math.min(...this.prices)
        const maxPrice = Math.max(...this.prices)

        this.shadowRoot!.innerHTML = `
        <style>
            :host { display: block; padding: 0 var(--space-md) 120px; color: var(--text-primary); font-family: var(--font-main); }

            h2 {
                font-size: 0.8125rem;
                font-weight: 500;
                letter-spacing: 0.07em;
                text-transform: uppercase;
                color: var(--text-secondary);
                margin: 28px 0 16px;
                opacity: 0.7;
            }

            .hero-card {
                background: var(--color-card);
                border-radius: var(--radius-lg);
                padding: 28px 20px;
                border: 1px solid var(--border-color);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
                margin-bottom: 20px;
            }

            .price-main {
                display: flex;
                align-items: flex-end;
                gap: 4px;
            }
            .price-val {
                font-size: 3.25rem;
                font-weight: 300;
                letter-spacing: -3px;
                line-height: 1;
                color: ${color};
            }
            .price-unit { font-size: 0.875rem; color: var(--text-secondary); font-weight: 400; margin-bottom: 6px; }

            .status-badge {
                background: var(--color-card-alt);
                color: var(--text-secondary);
                padding: 5px 14px;
                border-radius: var(--radius-sm);
                font-weight: 500;
                font-size: 0.75rem;
                border: 1px solid var(--border-color);
            }

            .price-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 20px;
            }
            .grid-item {
                background: var(--color-card);
                border-radius: var(--radius-md);
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 4px;
                border: 1px solid var(--border-color);
            }
            .grid-label {
                font-size: 0.6875rem;
                font-weight: 500;
                color: var(--text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.06em;
                opacity: 0.7;
            }
            .grid-val { font-size: 1.125rem; font-weight: 400; letter-spacing: -0.02em; }

            /* ── SVG Chart ── */
            .chart-box {
                background: var(--color-card);
                border-radius: var(--radius-md);
                padding: 20px 16px 16px;
                border: 1px solid var(--border-color);
            }
            svg { width: 100%; height: 100px; overflow: visible; }
            .bar { transition: all 0.3s ease; }
            .now-line { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 3; opacity: 0.6; }
        </style>

        <h2>Elpris just nu</h2>

        <div class="hero-card">
            <div class="price-main">
                <div class="price-val">${(currentPrice).toFixed(1)}</div>
                <div class="price-unit">öre / kWh</div>
            </div>
            <div class="status-badge">${label}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); opacity: 0.6;">SE3 · nuvarande timme</div>
        </div>

        <div class="price-grid">
            <div class="grid-item">
                <div class="grid-label">Dagens lägsta</div>
                <div class="grid-val" style="color: var(--accent);">${(minPrice).toFixed(1)} öre</div>
            </div>
            <div class="grid-item">
                <div class="grid-label">Dagens högsta</div>
                <div class="grid-val" style="color: var(--text-secondary);">${(maxPrice).toFixed(1)} öre</div>
            </div>
        </div>

        <div class="chart-box">
            <div class="grid-label" style="margin-bottom: 14px;">Priskurva idag</div>
            <svg viewBox="0 0 240 100" preserveAspectRatio="none">
                <defs>
                   <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.7" />
                        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.05" />
                   </linearGradient>
                </defs>
                ${this.prices.map((p, i) => {
                    const h = (p / maxPrice) * 80
                    const x = i * 10
                    const isNow = i === new Date().getHours()
                    return `
                        <rect class="bar"
                              x="${x + 1.5}"
                              y="${100 - h}"
                              width="7"
                              height="${h}"
                              rx="2"
                              fill="${isNow ? 'var(--accent)' : 'var(--border-color)'}"
                              style="opacity: ${isNow ? 1 : 0.9}" />
                        ${isNow ? `<line class="now-line" x1="${x + 5}" y1="0" x2="${x + 5}" y2="100" />` : ''}
                    `
                }).join('')}
            </svg>
            <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.625rem; color: var(--text-secondary); opacity: 0.5; font-weight: 500;">
                <span>00:00</span>
                <span>Nu</span>
                <span>23:00</span>
            </div>
        </div>
        `
    }
}

customElements.define("energy-view", EnergyView)
