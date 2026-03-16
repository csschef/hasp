import { getEntity, subscribeEntity } from "../store/entity-store"

class EnergyView extends HTMLElement {
    private energyEntity = "sensor.nordpool_kwh_se4_sek_2_10_0"
    private pricesToday: number[] = []
    private pricesTomorrow: number[] = []
    private hasInitialScrolled = false
    private observer?: IntersectionObserver
    private updateInterval?: any

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
            this.scrollToNow()
        })

        // Refresh time indicator every minute
        this.updateInterval = setInterval(() => {
            this.render()
        }, 60000)

        // Scroll to "Now" every time the view becomes visible
        this.observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                // Small delay to ensure display: block layout is ready
                requestAnimationFrame(() => this.scrollToNow(true))
            }
        }, { threshold: 0.1 })
        this.observer.observe(this)
    }

    disconnectedCallback() {
        this.observer?.disconnect()
        if (this.updateInterval) clearInterval(this.updateInterval)
    }

    private scrollToNow(force = false) {
        if (this.hasInitialScrolled && !force) return
        const container = this.shadowRoot?.querySelector('.scroll-container')
        const nowTag = this.shadowRoot?.querySelector('.now-tag') as HTMLElement
        if (container && nowTag && nowTag.offsetLeft > 0) {
            const scrollPos = nowTag.offsetLeft - (container as HTMLElement).offsetWidth / 3
            container.scrollLeft = Math.max(0, scrollPos)
            if (!force) this.hasInitialScrolled = true
        }
    }

    private parseNordpoolData(data: any): number[] {
        if (!data || !Array.isArray(data)) return []
        return data.map(item => typeof item === 'object' ? item.value : item)
    }

    private getPriceStatus(current: number, allPrices: number[]): { color: string; bg: string; label: string } {
        if (!allPrices.length) return { color: "var(--text-secondary)", bg: "var(--color-card-alt)", label: "Laddar..." }
        const min = Math.min(...allPrices)
        const max = Math.max(...allPrices)
        const range = max - min

        if (current <= min + range * 0.25) {
            return { color: "var(--color-success)", bg: "color-mix(in srgb, var(--color-success) 20%, transparent)", label: "Billigt" }
        } else if (current >= max - range * 0.25) {
            return { color: "var(--color-danger)", bg: "color-mix(in srgb, var(--color-danger) 20%, transparent)", label: "Dyrt" }
        }
        return { color: "var(--yellow-accent)", bg: "color-mix(in srgb, var(--yellow-accent) 20%, transparent)", label: "Normalt" }
    }

    render() {
        const entity = getEntity(this.energyEntity)
        if (!entity || this.pricesToday.length === 0) {
            this.shadowRoot!.innerHTML = `<div style="padding: 80px 20px; text-align: center; color: var(--text-secondary);">Ansluter till Nordpool...</div>`
            return
        }

        const pointsPerHour = this.pricesToday.length > 48 ? 4 : 1
        const currentPrice = parseFloat(entity.state) || 0
        const minToday = Math.min(...this.pricesToday)
        const maxToday = Math.max(...this.pricesToday)
        const avgToday = this.pricesToday.reduce((a, b) => a + b, 0) / this.pricesToday.length

        const now = new Date()
        const currentHour = now.getHours()
        const currentMinute = now.getMinutes()
        const currentIndex = currentHour * pointsPerHour + Math.floor(currentMinute / (60 / pointsPerHour))

        // Combine data
        const combined = [...this.pricesToday, ...this.pricesTomorrow]

        // Window starts 4 hours back, aligned to full hour
        const displayStartIdx = Math.max(0, (currentHour - 4) * pointsPerHour)
        const displayPrices = combined.slice(displayStartIdx)
        const numBars = displayPrices.length

        // Max price for scaling
        const peakInWindow = Math.max(...displayPrices)
        const maxDisplay = Math.max(250, Math.ceil(peakInWindow / 50) * 50)

        const yAxisSteps: number[] = []
        for (let i = 0; i <= maxDisplay; i += 50) {
            yAxisSteps.push(i)
        }

        const barWidth = 24
        const barGap = pointsPerHour === 4 ? 2 : 8
        const pxPerHour = (barWidth + barGap) * pointsPerHour
        const chartHeight = 160
        const totalWidth = (numBars / pointsPerHour) * pxPerHour

        const currentStatus = this.getPriceStatus(currentPrice, this.pricesToday)

        this.shadowRoot!.innerHTML = `
        <style>
            :host { display: block; padding: 0 var(--space-md) 24px; font-family: var(--font-main); color: var(--text-primary); }
            
            h2 { 
                font-size: 0.6875rem; 
                font-weight: 500; 
                color: var(--text-secondary); 
                text-transform: uppercase; 
                margin: 28px 0 12px; 
                letter-spacing: 0.01em; 
            }
            
            .hero-card {
                background: var(--color-card); border-radius: var(--radius-xl); padding: 32px 24px; border: 1px solid var(--border-color);
                display: flex; flex-direction: column; align-items: center; gap: 8px; position: relative; overflow: hidden;
            }
            .hero-card::before {
                content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
                background: radial-gradient(circle at center, var(--status-color, var(--accent)) 0%, transparent 70%); pointer-events: none; opacity: var(--energy-glow-opacity, 0.15);
            }
            .price-val { font-size: 4rem; font-weight: 200; letter-spacing: -3px; line-height: 1; z-index: 1; }
            .price-unit { font-size: 0.875rem; color: var(--text-secondary); opacity: 0.6; font-weight: 400; z-index: 1; }
            .status-pill { padding: 6px 16px; border-radius: 100px; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; z-index: 1; }

            .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px; }
            .stat-item { background: var(--color-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 14px 10px; text-align: center; }
            .stat-label { font-size: 0.6875rem; text-transform: uppercase; color: var(--text-secondary); opacity: 0.6; font-weight: 500; margin-bottom: 4px; letter-spacing: 0.05em; }
            .stat-value { font-size: 0.9rem; font-weight: 600; }

            .chart-view { background: var(--color-card); border-radius: var(--radius-xl); padding: 24px 0 20px; border: 1px solid var(--border-color); margin-top: 12px; overflow: hidden; }
            .chart-header { font-size: 0.6875rem; font-weight: 500; text-transform: uppercase; color: var(--text-secondary); opacity: 0.6; margin: 0 20px 8px; letter-spacing: 0.05em; }
            
            .chart-layout { display: flex; position: relative; }
            
            .y-axis { width: 35px; flex-shrink: 0; position: relative; z-index: 10; background: var(--color-card); border-right: 1px solid var(--border-color); }
            .y-axis-labels { height: ${chartHeight}px; position: relative; margin-top: 32px; }
            .y-label { position: absolute; right: 8px; font-size: 9px; color: var(--text-secondary); opacity: 0.6; font-weight: 700; transform: translateY(-50%); }

            .scroll-container { flex-grow: 1; overflow-x: auto; padding: 32px 0 0; position: relative; cursor: grab; scroll-behavior: smooth; }
            .scroll-container::-webkit-scrollbar { display: none; }
            .scroll-container:active { cursor: grabbing; }

            .chart-inner { position: relative; height: 200px; width: ${totalWidth}px; margin: 0 30px; }
            svg { width: 100%; height: 160px; display: block; overflow: visible; }

            .bar { transition: height 0.3s ease, y 0.3s ease; }
            .now-line { stroke: var(--text-secondary); stroke-width: 1.5; stroke-dasharray: 4,3; opacity: 0.6; }
            .now-tag {
                position: absolute; background: var(--color-card-alt); color: var(--text-secondary);
                font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 4px;
                transform: translateX(-50%); top: -22px; z-index: 20;
                text-transform: uppercase; letter-spacing: 0.03em;
            }
            .now-tag::after {
                content: ''; position: absolute; bottom: -4px; left: 50%;
                transform: translateX(-50%); border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 4px solid var(--color-card-alt);
            }
            .chart-text { font-size: 9px; fill: var(--text-secondary); opacity: 0.5; font-weight: 700; }
            .chart-labels { position: absolute; bottom: 0; left: 0; width: 100%; height: 25px; font-size: 0.65rem; color: var(--text-secondary); opacity: 0.8; }
            .time-label { position: absolute; transform: translateX(-50%); font-weight: 800; white-space: nowrap; }

            .advice-card {
                background: linear-gradient(135deg, color-mix(in srgb, var(--color-success) 15%, transparent) 0%, color-mix(in srgb, var(--color-success) 5%, transparent) 100%);
                border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent); border-radius: var(--radius-xl);
                padding: 18px 20px; margin-top: 24px; display: flex; align-items: center; gap: 16px;
            }
            .advice-icon { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; color: var(--color-success); flex-shrink: 0; }
            .advice-content { flex-grow: 1; }
            .advice-title { font-size: 0.6875rem; text-transform: uppercase; font-weight: 800; color: var(--color-success); letter-spacing: 0.05em; margin-bottom: 4px; }
            .advice-text { font-size: 0.875rem; font-weight: 400; color: var(--text-primary); line-height: 1.4; }
        </style>

        <h2>Elpris · Just nu</h2>
        <div class="hero-card" style="--status-color: ${currentStatus.color}">
            <div class="price-val">${currentPrice.toFixed(1)}</div>
            <div class="price-unit">öre per kWh</div>
            <div class="status-pill" style="background: ${currentStatus.bg}; color: ${currentStatus.color}">
                ${currentStatus.label}
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-item"><div class="stat-label">Lägsta</div><div class="stat-value" style="color: var(--color-success);">${minToday.toFixed(1)}</div></div>
            <div class="stat-item"><div class="stat-label">Snitt</div><div class="stat-value" style="color: var(--accent);">${avgToday.toFixed(1)}</div></div>
            <div class="stat-item"><div class="stat-label">Högsta</div><div class="stat-value" style="color: var(--color-danger);">${maxToday.toFixed(1)}</div></div>
        </div>

        <div class="chart-view">
            <div class="chart-header">Spotpris (öre/kWh)</div>
            
            <div class="chart-layout">
                <div class="y-axis">
                    <div class="y-axis-labels">
                        ${yAxisSteps.map(val => {
            const y = chartHeight - (val / maxDisplay) * chartHeight;
            return `<div class="y-label" style="top: ${y}px">${val}</div>`;
        }).join('')}
                    </div>
                </div>
                
                <div class="scroll-container">
                    <div class="chart-inner">
                        <div class="now-tag" style="left: ${(Math.min(numBars, currentIndex - displayStartIdx + 0.5) / numBars) * 100}%;">Nu</div>
                        <svg viewBox="0 0 ${totalWidth} ${chartHeight}">
                            <!-- Grid Lines -->
                            ${yAxisSteps.map(val => {
            const y = chartHeight - (val / maxDisplay) * chartHeight;
            return `<line x1="0" y1="${y}" x2="${totalWidth}" y2="${y}" stroke="var(--border-color)" stroke-opacity="0.1" stroke-dasharray="4,4" />`;
        }).join('')}

                            <!-- Bars -->
                            ${displayPrices.map((p, i) => {
            const h = (p / maxDisplay) * chartHeight;
            const x = i * (barWidth + barGap);
            const { color } = this.getPriceStatus(p, this.pricesToday);
            const isCurrent = (displayStartIdx + i) === currentIndex;
            return `<rect class="bar" x="${x}" y="${chartHeight - h}" width="${barWidth}" height="${h}" fill="${color}" rx="3" fill-opacity="1" />`;
        }).join('')}

                            <!-- Now Indicator line -->
                            <line class="now-line" x1="${(currentIndex - displayStartIdx + 0.5) * (barWidth + barGap)}" y1="0" x2="${(currentIndex - displayStartIdx + 0.5) * (barWidth + barGap)}" y2="${chartHeight}" />
                        </svg>
                        
                        <div class="chart-labels">
                            ${(() => {
                const startHour = Math.floor(displayStartIdx / pointsPerHour);
                const totalHours = numBars / pointsPerHour;
                let hourLabels = [];
                for (let i = 0; i < totalHours; i++) {
                    const h = (startHour + i) % 24;
                    const leftPx = i * pointsPerHour * (barWidth + barGap);
                    hourLabels.push(`<span class="time-label" style="left: ${leftPx}px">${h < 10 ? '0' + h : h}:00</span>`);
                }
                return hourLabels.join('');
            })()}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        ${this.renderAdvice(currentHour, pointsPerHour)}
        `;

        // Ensure initial scroll after render
        requestAnimationFrame(() => this.scrollToNow());
    }

    private renderAdvice(currentHour: number, pointsPerHour: number) {
        if (!this.pricesToday.length) return '';
        const windowSize = 3 * pointsPerHour;
        let bestStartIdx = -1;
        let minAvg = Infinity;
        const remainingToday = this.pricesToday.slice(currentHour * pointsPerHour);
        const allAvailable = [...remainingToday, ...this.pricesTomorrow];
        if (allAvailable.length < windowSize) return '';
        for (let i = 0; i <= allAvailable.length - windowSize; i++) {
            const window = allAvailable.slice(i, i + windowSize);
            const avg = window.reduce((a, b) => a + b, 0) / windowSize;
            if (avg < minAvg) {
                minAvg = avg;
                bestStartIdx = i;
            }
        }
        const absoluteIdx = (currentHour * pointsPerHour) + bestStartIdx;
        const startH = Math.floor(absoluteIdx / pointsPerHour) % 24;
        const endH = (Math.floor((absoluteIdx + windowSize) / pointsPerHour)) % 24;
        const isTomorrow = absoluteIdx >= (24 * pointsPerHour);
        const timeLabel = `${startH < 10 ? '0' + startH : startH}:00 - ${endH < 10 ? '0' + endH : endH}:00`;
        const dayLabel = isTomorrow ? 'imorgon' : 'idag';
        return `
            <div class="advice-card">
                <div class="advice-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                </div>
                <div class="advice-content">
                    <div class="advice-title">Energispartips</div>
                    <div class="advice-text">Kör maskiner mellan <strong>${timeLabel}</strong> ${dayLabel} för lägst pris.</div>
                </div>
            </div>
        `;
    }
}
customElements.define("energy-view", EnergyView)
