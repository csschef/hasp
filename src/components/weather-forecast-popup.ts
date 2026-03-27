import "./svg-icon"

type ForecastHourItem = {
    timeLabel: string
    condition: string
    temperature: number
    precipitation: number
    isNight?: boolean
}

type ForecastPopupPayload = {
    dayLabel: string
    dateKey: string
    items: ForecastHourItem[]
}

class WeatherForecastPopup extends HTMLElement {
    private shadow: ShadowRoot
    private dayLabel = ""
    private dateKey = ""
    private items: ForecastHourItem[] = []

    private imageMap: Record<string, string> = {
        sunny: "sun.svg",
        "clear-night": "clearnight.svg",
        cloudy: "cloudy.svg",
        fog: "foggyday.svg",
        fog_night: "foggynight.svg",
        hail: "hail.svg",
        lightning: "thunder.svg",
        "lightning-rainy": "thunderandrain.svg",
        partlycloudy: "partlycloudyday.svg",
        partlycloudy_night: "partlycloudynight.svg",
        rainy: "rainy.svg",
        snowy: "snowy.svg",
        "snowy-rainy": "snowyrainy.svg",
        pouring: "rainy.svg",
        windy: "cloudy.svg",
        "windy-variant": "cloudy.svg",
        exceptional: "thunder.svg"
    }

    constructor() {
        super()
        this.shadow = this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.render()
    }

    open(payload: ForecastPopupPayload) {
        this.dayLabel = payload.dayLabel
        this.dateKey = payload.dateKey
        this.items = payload.items

        this.style.display = "block"
        document.body.classList.add("popup-open")

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.classList.add("active")
            })
        })

        window.history.pushState({ type: "popup", id: "weatherForecastPopup" }, "")
        this.render()
    }

    close(fromHistory = false) {
        this.classList.remove("active")

        const otherPopups = ["lightPopup", "historyPopup", "tvPopup", "personPopup", "settingsPopup", "todoPopup", "calendarPopup", "themePopup", "climatePopup", "weatherForecastPopup"]
            .filter(id => id !== "weatherForecastPopup")
            .some(id => document.getElementById(id)?.classList.contains("active"))

        if (!otherPopups) document.body.classList.remove("popup-open")

        if (!fromHistory && window.history.state?.type === "popup" && window.history.state?.id === "weatherForecastPopup") {
            window.history.back()
        }

        setTimeout(() => {
            this.style.display = "none"
        }, 300)
    }

    private formatDate(s: string) {
        if (!s) return ""
        const d = new Date(`${s}T00:00:00`)
        return d.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })
    }

    private getWeatherIcon(condition: string, size: number, isNight = false) {
        let stateKey = this.normalizeCondition(condition, isNight)

        const nightKey = `${stateKey}_night`
        const finalKey = (isNight && this.imageMap[nightKey]) ? nightKey : stateKey
        const fileName = this.imageMap[finalKey] || this.imageMap[stateKey]

        if (fileName) {
            return `
                <div class="icon-wrap" style="width:${size}px;height:${size}px;">
                    <svg-icon src="svg/${fileName}" condition="${finalKey}" style="width:100%;height:100%;"></svg-icon>
                </div>
            `
        }

        return `
            <div class="icon-wrap" style="width:${size}px;height:${size}px;">
                <svg-icon src="svg/cloudy.svg" condition="cloudy" style="width:100%;height:100%;"></svg-icon>
            </div>
        `
    }

    private normalizeCondition(condition: string, isNight: boolean) {
        const raw = (condition || "").toLowerCase().trim()
        const compact = raw.replace(/\s+/g, "").replace(/_/g, "-")

        const aliases: Record<string, string> = {
            clear: "sunny",
            clearnight: "clear-night",
            "clear-night": "clear-night",
            partlycloudy: "partlycloudy",
            "partly-cloudy": "partlycloudy",
            partlycloudyday: "partlycloudy",
            partlycloudynight: "partlycloudy_night",
            rain: "rainy",
            snow: "snowy",
            thunderstorm: "lightning",
            thunder: "lightning"
        }

        let normalized = aliases[compact] || compact
        if (isNight && normalized === "sunny") normalized = "clear-night"
        return normalized
    }

    private renderRows() {
        if (!this.items.length) {
            return `<div class="empty">Ingen timprognos tillgänglig för vald dag.</div>`
        }

        return this.items.map(i => `
            <div class="item">
                <div class="time">${i.timeLabel}</div>
                ${this.getWeatherIcon(i.condition, 22, !!i.isNight)}
                <span class="temp">${Math.round(i.temperature)}°</span>
                <span class="precip">${i.precipitation > 0 ? `${i.precipitation.toFixed(1)} mm` : "&nbsp;"}</span>
            </div>
        `).join("")
    }

    private bindEvents() {
        this.shadow.querySelector("#closeBtn")?.addEventListener("click", () => this.close())
        this.shadow.querySelector("#backdrop")?.addEventListener("click", () => this.close())
    }

    render() {
        this.shadow.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    inset: 0;
                    display: none;
                    background: rgba(0, 0, 0, 0.4);
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
                    top: 60px;
                    left: 50%;
                    transform: translate(-50%, 16px);
                    opacity: 0;
                    width: calc(100% - 32px);
                    max-width: 420px;
                    max-height: calc(100dvh - 80px);
                    overflow-y: auto;
                    background: var(--weather-bg-solid, rgba(51, 140, 210, 1));
                    color: var(--weather-text, #ffffff);
                    border-radius: var(--radius-xl, 28px);
                    border: var(--weather-border, 1px solid rgba(255, 255, 255, 0.3));
                    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
                    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    box-sizing: border-box;
                    padding: 20px;
                }
                :host(.active) .sheet {
                    transform: translate(-50%, 0);
                    opacity: 1;
                }
                .hdr {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 12px;
                    margin-bottom: 14px;
                }
                .title-wrap {
                    min-width: 0;
                }
                .title {
                    color: var(--weather-text, #ffffff);
                    font-size: 1rem;
                    font-weight: 600;
                    line-height: 1.2;
                }
                .sub {
                    color: var(--weather-text-dim, rgba(255, 255, 255, 0.8));
                    font-size: 0.75rem;
                    text-transform: capitalize;
                    margin-top: 2px;
                }
                .close-btn {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.22);
                    border: 1px solid rgba(255, 255, 255, 0.35);
                    color: var(--weather-text, #ffffff);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    flex: 0 0 auto;
                }
                .close-btn:active {
                    background: rgba(255, 255, 255, 0.32);
                }
                .list {
                    display: flex;
                    gap: 20px;
                    overflow-x: auto;
                    padding-bottom: 10px;
                    scroll-snap-type: x mandatory;
                    scrollbar-width: none;
                }
                .list::-webkit-scrollbar {
                    display: none;
                }
                .item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    min-width: 54px;
                    scroll-snap-align: start;
                }
                .time {
                    font-size: 0.75rem;
                    color: var(--weather-text-dim, rgba(255, 255, 255, 0.8));
                    font-weight: 500;
                }
                .icon-wrap {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .temp {
                    font-size: 0.9375rem;
                    color: var(--weather-text, #ffffff);
                    font-weight: 500;
                }
                .precip {
                    font-size: 0.6875rem;
                    font-weight: 500;
                    color: var(--weather-text-dim, rgba(255, 255, 255, 0.8));
                    text-align: center;
                }
                .empty {
                    width: 100%;
                    padding: 18px 12px;
                    border: 1px dashed rgba(255, 255, 255, 0.35);
                    border-radius: 12px;
                    color: var(--weather-text-dim, rgba(255, 255, 255, 0.8));
                    text-align: center;
                    font-size: 0.8125rem;
                }
            </style>
            <div id="backdrop" style="position:absolute;inset:0"></div>
            <div class="sheet">
                <div class="hdr">
                    <div class="title-wrap">
                        <div class="title">Timprognos ${this.dayLabel ? `- ${this.dayLabel}` : ""}</div>
                        <div class="sub">${this.formatDate(this.dateKey)}</div>
                    </div>
                    <button id="closeBtn" class="close-btn" aria-label="Stang">✕</button>
                </div>
                <div class="list">${this.renderRows()}</div>
            </div>
        `

        this.bindEvents()
    }
}

customElements.define("weather-forecast-popup", WeatherForecastPopup)
