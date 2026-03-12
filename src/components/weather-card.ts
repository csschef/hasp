import { getEntity, subscribeEntity } from "../store/entity-store"
import { callService } from "../services/ha-service"
import type { HAEntity } from "../types/homeassistant"

class WeatherCard extends HTMLElement {
    private weatherEntity = "weather.smhi_home"
    private currentSensor = "sensor.nuvarande_vader" 
    private stateSensor = "sensor.vader_dag_natt"
    private toggleEntity = "input_boolean.toggle_vaderprognos"
    private hourlySensor = "sensor.vader_prognos_timme"
    private dailySensor = "sensor.vader_prognos_daglig"

    // Image mapping to match your folder structure
    private imageMap: Record<string, string> = {
        "stjärnklart": "Stjarnklart2.png",
        "molnigt": "Molnigt2.png",
        "dimma": "Dimmadag.png",
        "dimma_night": "Dimmanatt.png",
        "åska": "Aska.png",
        "åska och regn": "Askaochregn.png",
        "hagel": "Hagel.png",
        "ösregn": "Osregn.png",
        "delvis molnigt": "Delvismolnigtdag2.png",
        "delvis molnigt_night": "Delvismolnigtnatt.png",
        "regn": "Regn3.png",
        "snö": "Sno.png",
        "snöregn": "Snoregn.png",
        "soligt": "Soligt.png",
        "sunny": "Soligt.png",
        "sunny_night": "Mone.png",
        "partlycloudy": "Delvismolnigtdag2.png",
        "partlycloudy_night": "Delvismolnigtnatt.png",
        "cloudy": "Molnigt2.png",
        "rainy": "Regn3.png",
        "fog": "Dimmadag.png",
        "fog_night": "Dimmanatt.png",
        "lightning": "Aska.png",
        "lightning-rainy": "Askaochregn.png",
        "pouring": "Osregn.png"
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        // Subscribe to all relevant sensors
        [this.weatherEntity, this.currentSensor, this.stateSensor, this.toggleEntity, this.hourlySensor, this.dailySensor].forEach(id => {
            subscribeEntity(id, () => this.render())
        })
        this.render()
    }

    private setToggle(state: "on" | "off") {
        callService("input_boolean", state === "on" ? "turn_on" : "turn_off", {
            entity_id: this.toggleEntity
        })
    }

    render() {
        const weather = getEntity(this.weatherEntity)
        const current = getEntity(this.currentSensor)
        const state = getEntity(this.stateSensor)
        const toggle = getEntity(this.toggleEntity)
        const hourly = getEntity(this.hourlySensor)
        const daily = getEntity(this.dailySensor)
        const sun = getEntity("sun.sun")

        if (!weather || !current) return

        const temp = Math.round(Number(weather.attributes.temperature || 0))
        const isDaily = toggle?.state === "off"
        const isNight = sun?.state === "below_horizon"

        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: block;
                    background: var(--color-card);
                    border-radius: var(--radius-md);
                    padding: var(--space-md);
                    color: var(--text-primary);
                }
                .hero {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }
                .temp-group {
                    display: flex;
                    align-items: flex-start;
                    gap: 4px;
                }
                .temp {
                    font-size: 56px;
                    font-weight: 600;
                    letter-spacing: -3px;
                    line-height: 1;
                }
                .unit {
                    font-size: 24px;
                    font-weight: 500;
                    margin-top: 8px;
                    opacity: 0.5;
                }
                .meta {
                    display: flex;
                    flex-direction: column;
                }
                .condition {
                    font-size: 18px;
                    font-weight: 500;
                    text-transform: capitalize;
                }
                .location {
                    font-size: 14px;
                    color: var(--text-secondary);
                }
                .weather-icon-large {
                    color: var(--accent);
                }
                
                .tabs {
                    display: flex;
                    background: var(--color-card-alt);
                    padding: 4px;
                    border-radius: 12px;
                    margin-bottom: 20px;
                }
                .tab {
                    flex: 1;
                    border: none;
                    background: transparent;
                    color: var(--text-secondary);
                    padding: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    user-select: none;
                }
                .tab.active {
                    background: var(--color-card);
                    color: var(--text-primary);
                }

                .scroll {
                    display: flex;
                    gap: 20px;
                    overflow-x: auto;
                    padding-bottom: 10px;
                    scroll-snap-type: x mandatory;
                    scrollbar-width: none;
                }
                .scroll::-webkit-scrollbar { display: none; }

                .item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    min-width: 54px;
                    scroll-snap-align: start;
                }
                .label { font-size: 12px; color: var(--text-secondary); }
                .f-temp { font-size: 15px; font-weight: 500; }
                .f-temps { display: flex; gap: 6px; }
                .f-temp.low { opacity: 0.5; }
                .precip { font-size: 11px; font-weight: 500; color: var(--text-secondary); opacity: 0.9; }
            </style>
            
            <div class="hero">
                <div class="meta">
                    <div class="temp-group">
                        <span class="temp">${temp}</span>
                        <span class="unit">°</span>
                    </div>
                    <span class="condition">${current.state}</span>
                    <span class="location">Lindsdal</span>
                </div>
                <div class="weather-icon-large">
                    ${this.getWeatherIcon(state?.state || weather.state, 80, isNight)}
                </div>
            </div>

            <div class="tabs">
                <button class="tab ${!isDaily ? 'active' : ''}" id="btn-hourly">Timvis</button>
                <button class="tab ${isDaily ? 'active' : ''}" id="btn-daily">Dygn</button>
            </div>

            <div class="scroll">
                ${isDaily ? this.renderDaily(daily) : this.renderHourly(hourly)}
            </div>
        `

        // Re-attach listeners after innerHTML replacement
        this.shadowRoot!.getElementById("btn-hourly")?.addEventListener("click", (e) => {
            e.stopPropagation();
            this.setToggle("on");
        })
        this.shadowRoot!.getElementById("btn-daily")?.addEventListener("click", (e) => {
            e.stopPropagation();
            this.setToggle("off");
        })
    }

    private renderHourly(entity?: HAEntity) {
        const forecast = entity?.attributes.forecast || []
        const now = new Date()
        
        return forecast.slice(0, 15).map((f: any) => {
            const date = new Date(f.datetime)
            const time = date.getHours().toString().padStart(2, '0') + ":00"
            // Night logic for hourly: strictly use the forecast time
            const hour = date.getHours()
            const isNight = hour > 20 || hour < 6
            
            return `
                <div class="item">
                    <span class="label">${time}</span>
                    ${this.getWeatherIcon(f.condition, 26, isNight)}
                    <span class="f-temp">${Math.round(f.temperature)}°</span>
                    <span class="precip">${f.precipitation > 0 ? f.precipitation.toFixed(1) + ' mm' : '&nbsp;'}</span>
                </div>
            `
        }).join("")
    }

    private renderDaily(entity?: HAEntity) {
        const forecast = entity?.attributes.forecast || []
        const days = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"]
        return forecast.slice(0, 8).map((f: any, i: number) => {
            const date = new Date(f.datetime)
            const dayName = i === 0 ? "Idag" : i === 1 ? "Imorgon" : days[date.getDay()]
            return `
                <div class="item">
                    <span class="label">${dayName}</span>
                    ${this.getWeatherIcon(f.condition, 26, false)}
                    <div class="f-temps">
                        <span class="f-temp">${Math.round(f.temperature)}°</span>
                        <span class="f-temp low">${Math.round(f.templow || 0)}°</span>
                    </div>
                    <span class="precip">${f.precipitation > 0 ? f.precipitation.toFixed(1) + ' mm' : '&nbsp;'}</span>
                </div>
            `
        }).join("")
    }

    private getWeatherIcon(condition: string, size: number, isNight: boolean = false) {
        const condRaw = condition?.toLowerCase() || ""
        // Map common HA states to our internal keys
        let stateKey = condRaw
        if (condRaw === "clear-night" || condRaw === "stjärnklart") stateKey = "sunny"
        
        // Check for night variation
        const nightKey = `${stateKey}_night`
        const finalKey = (isNight && this.imageMap[nightKey]) ? nightKey : stateKey
        
        const fileName = this.imageMap[finalKey]

        if (fileName) {
            return `
                <div class="icon-wrapper" style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
                    <img src="/weather/${fileName}" 
                         style="width: 100%; height: 100%; object-fit: contain;" 
                    />
                </div>`
        }

        // --- Lucide Fallbacks ---
        let iconPath = ""
        const isSun = condRaw.includes("sun") || condRaw.includes("klar") || condRaw.includes("sunny") || condRaw.includes("stjärn")
        
        if (isSun) {
            iconPath = isNight 
                ? `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>` // Moon
                : `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>`
        } else if (condRaw.includes("partly") || condRaw.includes("delvis")) {
            iconPath = `<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M2 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>`
        } else if (condRaw.includes("cloudy") || condRaw.includes("moln")) {
            iconPath = `<path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2.4-1.9-4.3-4.3-4.5C17.1 7.2 14.4 5 11.4 5c-3.3 0-6 2.5-6.6 5.8C2.8 11.3 1 13.2 1 15.6c0 2.4 2 4.4 4.4 4.4z"/>`
        } else if (condRaw.includes("rain") || condRaw.includes("regn")) {
            iconPath = `<path d="M4 14.89c-.61-.44-1-1.15-1-1.89a3 3 0 0 1 3-3 3.32 3.32 0 0 1 1.13.2 5.5 5.5 0 1 1 8.37 5.11"/><path d="M12 16v6"/><path d="m8 18-2 2"/><path d="m16 18-2 2"/>`
        } else if (condRaw.includes("lightning") || condRaw.includes("åska")) {
            iconPath = `<path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 11 15 14 15 12 19"/>`
        } else {
            iconPath = `<path d="M17.5 21a4.5 4.5 0 0 1-4.5-4.5c0-2.4 1.9-4.3 4.3-4.5C17.1 9.2 14.4 7 11.4 7c-3.3 0-6 2.5-6.6 5.8C2.8 13.3 1 15.2 1 17.6c0 2.4 2 4.4 4.4 4.4h12.1Z"/>`
        }

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>`
    }
}

customElements.define("weather-card", WeatherCard)
