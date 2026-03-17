import { getEntity, subscribeEntity, subscribeUser, getActivePerson, setActivePerson, subscribeActivePerson } from "../store/entity-store"
import { callService } from "../services/ha-service"
import type { HAEntity } from "../types/homeassistant"
import type { HAUser } from "../store/entity-store"

class WeatherCard extends HTMLElement {
    private weatherEntity = "weather.smhi_home"
    private toggleEntity = "input_boolean.toggle_vaderprognos"
    private hourlySensor = "sensor.vader_prognos_timme"
    private dailySensor = "sensor.vader_prognos_daglig"

    // Person tracking
    private personEntity = "person.sebastian"
    private lastCoords: string = ""
    private localWeather: any = null
    private localLocation: string = "Hem"
    private isExpanded: boolean = false
    private showDebug: boolean = false
    private fetchError: string = ""
    private viewMode: 'hourly' | 'daily' = (localStorage.getItem("weather_view_mode") as 'hourly' | 'daily') || 'daily'

    private imageMap: Record<string, string> = {
        // ── Dina SVG-ikoner ──────────────────────────────────
        "sunny":             "sun.svg",
        "clear-night":       "clearnight.svg",
        "cloudy":            "cloudy.svg",
        "fog":               "foggyday.svg",
        "fog_night":         "foggynight.svg",
        "hail":              "hail.svg",
        "lightning":         "thunder.svg",
        "lightning-rainy":   "thunderandrain.svg",
        "partlycloudy":      "partlycloudyday.svg",
        "partlycloudy_night": "partlycloudynight.svg",
        "rainy":             "rainy.svg",
        "snowy":             "snowy.svg",
        "snowy-rainy":       "snowyrainy.svg",
        // ── Fallbacks (ingen unik ikon) ──────────────────────
        "pouring":           "rainy.svg",
        "windy":             "cloudy.svg",
        "windy-variant":     "cloudy.svg",
        "exceptional":       "thunder.svg"
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        // 1. Subscribe to basic weather sensors
        const coreSensors = [this.weatherEntity, this.hourlySensor, this.dailySensor]
        coreSensors.forEach(id => {
            subscribeEntity(id, () => this.handleUpdate())
        })

        // 2. Subscribe to BOTH persons for coordinates
        // 3. Update whenever person/location changes
        subscribeActivePerson((personId) => {
            if (this.personEntity !== personId) {
                this.personEntity = personId;
                this.lastCoords = ""; // Force re-fetch
                this.handleUpdate();
            }
        })

        // 4. Normal updates/focus
        subscribeEntity("person.sebastian", () => this.handleUpdate())
        subscribeEntity("person.sara", () => this.handleUpdate())

        // 4. Update when coming back into focus
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                this.lastCoords = ""
                this.handleUpdate()
            }
        })

        // 5. Expand toggle
        this.addEventListener("click", () => {
            this.isExpanded = !this.isExpanded;
            this.render();
        });
    }

    private async handleUpdate() {
        const person = getEntity(this.personEntity)
        if (!person?.attributes.latitude || !person?.attributes.longitude) return;

        const lat = person.attributes.latitude;
        const lon = person.attributes.longitude;
        const coords = `${lat.toFixed(3)},${lon.toFixed(3)}`;

        // Only fetch if location actually changed
        if (coords === this.lastCoords) return;
        this.lastCoords = coords;

        try {
            // 1. Get City Name (Works perfectly on mobile)
            const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=sv`)
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                let location = geoData.locality || geoData.city || "Okänd";
                
                // Premium cleanup
                location = location.replace(/ stadsdelsområde$/i, "").replace(/ kommun$/i, "");
                this.localLocation = location;
                
                // Hard override for home
                const distToHome = Math.sqrt(Math.pow(lat - 56.726, 2) + Math.pow(lon - 16.326, 2));
                if (distToHome < 0.01) this.localLocation = "Lindsdal";
            }

            // 2. Get Weather via Open-Meteo (Zero restrictions / Zero blocks)
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code&hourly=temperature_2m,weather_code,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&wind_speed_unit=ms&timezone=auto`)
            
            if (!weatherRes.ok) throw new Error(`Weather error ${weatherRes.status}`);
            
            this.localWeather = await weatherRes.json();
            this.setAttribute("loaded", "");
            this.fetchError = "";
        } catch (e: any) {
            console.error("Weather fetch failed:", e);
            this.fetchError = "Anslutningsfel"; 
        }
        
        this.render()
    }

    private toggleView(mode: 'hourly' | 'daily') {
        this.viewMode = mode
        localStorage.setItem("weather_view_mode", mode)
        this.render()
    }

    render() {
        const weather = getEntity(this.weatherEntity)
        const toggle = getEntity(this.toggleEntity)
        const hourly = getEntity(this.hourlySensor)
        const daily = getEntity(this.dailySensor)
        const sun = getEntity("sun.sun")

        if (!weather) return

        const isDaily = this.viewMode === 'daily'
        const isNight = sun?.state === "below_horizon"

        // Localized vs Fixed Logic
        let temp: number
        let feelsLike: number | null = null
        let condition: string
        let locationName: string

        if (this.localWeather && this.localWeather.current) {
            const current = this.localWeather.current;
            temp = Math.round(current.temperature_2m);
            feelsLike = Math.round(current.apparent_temperature);
            condition = this.getWmoState(current.weather_code);
            locationName = this.localLocation;
        } else {
            temp = Math.round(Number(weather.attributes.temperature || 0))
            const app = weather.attributes.apparent_temperature
            feelsLike = app != null ? Math.round(app) : temp
            condition = weather.state
            locationName = "Lindsdal"
        }

        const conditionLabel = this.translateCondition(condition)

        const formatTime = (iso: string) => {
            if (!iso) return "--:--"
            return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }

        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: block;
                    background: var(--color-card);
                    border-radius: var(--radius-md);
                    padding: var(--space-md);
                    border: 1px solid var(--border-color);
                    color: var(--text-primary);
                    opacity: 0;
                    transition: opacity 0.4s ease-out, background 0.3s ease;
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                }

                /* ── Sky Theme for Light Mode ── */
                @media (prefers-color-scheme: light) {
                    :host:not([data-theme="dark"]) {
                        background: linear-gradient(180deg, rgba(51,140,210,1) 40%, rgba(89,179,224,1) 100%);
                        color: #ffffff;
                        border-color: rgba(255, 255, 255, 0.3);
                    }
                    :host:not([data-theme="dark"]) .label,
                    :host:not([data-theme="dark"]) .location,
                    :host:not([data-theme="dark"]) .unit,
                    :host:not([data-theme="dark"]) .f-temp.low,
                    :host:not([data-theme="dark"]) .precip,
                    :host:not([data-theme="dark"]) .sun-info {
                        color: rgba(255, 255, 255, 0.8) !important;
                    }
                    :host:not([data-theme="dark"]) .tabs {
                        background: rgba(255, 255, 255, 0.2);
                        backdrop-filter: blur(4px);
                    }
                    :host:not([data-theme="dark"]) .tab {
                        color: rgba(255, 255, 255, 0.7);
                    }
                    :host:not([data-theme="dark"]) .tab.active {
                        background: #ffffff;
                        color: #0088cc;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    }
                }

                /* Manual Light override */
                :host-context([data-theme="light"]) {
                    background: linear-gradient(180deg, rgba(51,140,210,1) 40%, rgba(89,179,224,1) 100%);
                    color: #ffffff;
                    border-color: rgba(255, 255, 255, 0.3);
                }
                :host-context([data-theme="light"]) .label,
                :host-context([data-theme="light"]) .location,
                :host-context([data-theme="light"]) .unit,
                :host-context([data-theme="light"]) .f-temp.low,
                :host-context([data-theme="light"]) .precip,
                :host-context([data-theme="light"]) .sun-info {
                    color: rgba(255, 255, 255, 0.8) !important;
                }
                :host-context([data-theme="light"]) .tabs {
                    background: rgba(255, 255, 255, 0.2);
                    backdrop-filter: blur(4px);
                }
                :host-context([data-theme="light"]) .tab {
                    color: rgba(255, 255, 255, 0.7);
                }
                :host-context([data-theme="light"]) .tab.active {
                    background: #ffffff;
                    color: #0088cc;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }

                :host([loaded]) {
                    opacity: 1;
                }
                .hero {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .temp-group {
                    display: flex;
                    align-items: flex-start;
                    gap: 2px;
                }
                .temp {
                    font-size: 3.25rem;
                    font-weight: 300;
                    letter-spacing: -3px;
                    line-height: 0.9;
                }
                .unit {
                    font-size: 1.75rem;
                    font-weight: 300;
                    margin-top: -10px;
                }
                .meta {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    flex: 1;
                }
                .condition {
                    font-size: 1rem;
                    font-weight: 400;
                    text-transform: capitalize;
                    line-height: 1.2;
                }
                .location {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    margin-top: 2px;
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    opacity: 0.8;
                }
                .weather-icon-large {
                    color: var(--accent);
                }
                
                :host-context([data-theme="light"]) .weather-icon-large,
                @media (prefers-color-scheme: light) {
                    :host:not([data-theme="dark"]) .weather-icon-large {
                        color: #ffffff;
                    }
                }

                /* ── Expandable Section ── */
                .expander {
                    display: grid;
                    grid-template-rows: 0fr;
                    transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                }
                :host([expanded]) .expander,
                .expander.expanded {
                    grid-template-rows: 1fr;
                }
                .expander-content {
                    overflow: hidden;
                }

                .content-inner {
                    padding-top: 24px;
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
                    font-size: 0.8125rem;
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
                .label { font-size: 0.75rem; color: var(--text-secondary); }
                .f-temp { font-size: 0.9375rem; font-weight: 500; }
                .f-temps { display: flex; gap: 6px; }
                .f-temp.low { opacity: 0.5; }
                .precip { font-size: 0.6875rem; font-weight: 500; color: var(--text-secondary); opacity: 0.9; }

                .sun-info {
                    display: flex;
                    justify-content: center;
                    gap: 32px;
                    margin-bottom: 24px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    font-weight: 500;
                }
                .sun-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
            </style>
            
            <div class="hero" id="weatherHero">
                <div class="temp-group">
                    <span class="temp">${temp}</span>
                    <span class="unit">°</span>
                </div>
                
                <div class="meta" id="locationArea">
                    <div class="condition">${conditionLabel}</div>
                    <div class="location">
                        ${this.localWeather ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:1px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>` : ''}
                        ${locationName}
                    </div>
                    ${feelsLike !== null ? `<div class="location" style="font-size:0.75rem;opacity:0.6">Känns som ${feelsLike}°</div>` : ''}

                    ${this.showDebug ? `
                        <div style="font-size: 0.625rem; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 4px; margin-top: 8px; font-family: monospace; pointer-events: auto;">
                            ID: ${this.personEntity.split('.')[1]}<br>
                            GPS: ${this.lastCoords || 'NONE'}<br>
                            COND: ${condition}<br>
                            FETCH: ${this.localWeather ? 'OK' : (this.fetchError || 'WAITING')}<br>
                            <button id="btn-refresh" style="font-size:0.5625rem; border:1px solid #fff; background:none; color:#fff; border-radius:4px; padding:2px 4px; margin-top:4px;">Force Reload</button>
                        </div>
                    ` : ''}
                </div>

                <div class="weather-icon-large">
                    ${this.getWeatherIcon(condition, 64, isNight)}
                </div>
            </div>

            <div class="expander ${this.isExpanded ? 'expanded' : ''}">
                <div class="expander-content">
                    <div class="content-inner">
                        <div class="sun-info">
                            <div class="sun-item">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible"><path d="M12 11V3.5"/><path d="m9 6.5 3-3 3 3"/><path d="M18 20a6 6 0 0 0 -12 0"/><path d="M2 22h20"/></svg>
                                Soluppgång ${formatTime(sun?.attributes.next_rising)}
                            </div>
                            <div class="sun-item">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible"><path d="M12 3.5v7.5"/><path d="m15 8-3 3-3-3"/><path d="M18 20a6 6 0 0 0 -12 0"/><path d="M2 22h20"/></svg>
                                Solnedgång ${formatTime(sun?.attributes.next_setting)}
                            </div>
                        </div>

                        <div class="tabs">
                            <button class="tab ${!isDaily ? 'active' : ''}" id="btn-hourly">Timvis</button>
                            <button class="tab ${isDaily ? 'active' : ''}" id="btn-daily">Dygn</button>
                        </div>

                        <div class="scroll">
                            ${isDaily ? this.renderDaily(daily) : this.renderHourly(hourly)}
                        </div>
                    </div>
                </div>
            </div>
        `

        // Re-attach listeners
        this.shadowRoot!.getElementById("locationArea")?.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            this.showDebug = !this.showDebug;
            this.render();
        });

        this.shadowRoot!.getElementById("btn-refresh")?.addEventListener("click", (e) => {
            e.stopPropagation();
            this.lastCoords = "";
            this.handleUpdate();
        });

        this.shadowRoot!.getElementById("btn-hourly")?.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggleView("hourly");
        })
        this.shadowRoot!.getElementById("btn-daily")?.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggleView("daily");
        })
    }

    private renderHourly(entity?: HAEntity) {
        if (this.localWeather && this.localWeather.hourly) {
            const h = this.localWeather.hourly;
            const now = new Date().getTime();

            return h.time.map((timeStr: string, i: number) => {
                const d = new Date(timeStr);
                return { d, i };
            }).filter((item: any) => item.d.getTime() > now)
              .slice(0, 24)
              .map((item: any) => {
                const i = item.i;
                const d = item.d;
                const cond = this.getWmoState(h.weather_code[i]);
                const isNight = d.getHours() > 20 || d.getHours() < 6;
                
                return `
                    <div class="item">
                        <span class="label">${d.getHours()}:00</span>
                        ${this.getWeatherIcon(cond, 24, isNight)}
                        <span class="f-temp">${Math.round(h.temperature_2m[i])}°</span>
                        <span class="precip">${h.precipitation[i] > 0 ? h.precipitation[i].toFixed(1) + ' mm' : '&nbsp;'}</span>
                    </div>
                `
            }).join("")
        }

        const forecast = entity?.attributes.forecast || []
        return forecast.slice(0, 15).map((f: any) => {
            const date = new Date(f.datetime)
            const time = date.getHours().toString().padStart(2, '0') + ":00"
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
        if (this.localWeather && this.localWeather.daily) {
            const d = this.localWeather.daily;
            const days = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
            
            return d.time.map((timeStr: string, i: number) => {
                const date = new Date(timeStr);
                const dayName = i === 0 ? "Idag" : i === 1 ? "Imorgon" : days[date.getDay()];
                const cond = this.getWmoState(d.weather_code[i]);
                
                return `
                    <div class="item">
                        <span class="label">${dayName}</span>
                        ${this.getWeatherIcon(cond, 26, false)}
                        <div class="f-temps">
                            <span class="f-temp">${Math.round(d.temperature_2m_max[i])}°</span>
                            <span class="f-temp low">${Math.round(d.temperature_2m_min[i])}°</span>
                        </div>
                        <span class="precip">${d.precipitation_sum[i] > 0.1 ? d.precipitation_sum[i].toFixed(1) + ' mm' : '&nbsp;'}</span>
                    </div>
                `
            }).join("")
        }

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

    private getWmoState(code: number): string {
        switch (code) {
            case 0: return "sunny"
            case 1:
            case 2: return "partlycloudy"
            case 3: return "cloudy"
            case 45:
            case 48: return "fog"
            case 51:
            case 53:
            case 55:
            case 61:
            case 63:
            case 65:
            case 80:
            case 81:
            case 82: return "rainy"
            case 71:
            case 73:
            case 75:
            case 77:
            case 85:
            case 86: return "snowy"
            case 95:
            case 96:
            case 99: return "lightning"
            default: return "cloudy"
        }
    }

    private translateCondition(condition: string): string {
        const dict: Record<string, string> = {
            "sunny": "Soligt",
            "clear-night": "Klart",
            "cloudy": "Molnigt",
            "fog": "Dimma",
            "hail": "Hagel",
            "lightning": "Åska",
            "lightning-rainy": "Åska och regn",
            "partlycloudy": "Delvis molnigt",
            "pouring": "Ösregn",
            "rainy": "Regn",
            "snowy": "Snö",
            "snowy-rainy": "Snöblandat regn",
            "windy": "Blåsigt",
            "windy-variant": "Blåsigt",
            "exceptional": "Varning"
        }
        return dict[condition.toLowerCase()] || condition
    }

    private getWeatherIcon(condition: string, size: number, isNight: boolean = false) {
        let stateKey = (condition || "").toLowerCase().trim()

        // Handle night swap for sunny
        if (isNight && stateKey === "sunny") stateKey = "clear-night"

        // Check for night variation in our map (fog_night, etc)
        const nightKey = `${stateKey}_night`
        const finalKey = (isNight && this.imageMap[nightKey]) ? nightKey : stateKey

        const fileName = this.imageMap[finalKey] || this.imageMap[stateKey]

        if (fileName) {
            const iconUrl = `svg/${fileName}`

            return `
                <div class="icon-wrapper" style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
                    <img src="${iconUrl}"
                         style="width: 100%; height: 100%; object-fit: contain;"
                         loading="lazy"
                    />
                </div>`
        }

        // Only use Lucide for absolute unknowns
        return `<div style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); opacity: 0.3;">
            <svg xmlns="http://www.w3.org/2000/svg" width="${size * 0.7}" height="${size * 0.7}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2.4-1.9-4.3-4.3-4.5C17.1 7.2 14.4 5 11.4 5c-3.3 0-6 2.5-6.6 5.8C2.8 11.3 1 13.2 1 15.6c0 2.4 2 4.4 4.4 4.4z"/></svg>
        </div>`
    }
}

customElements.define("weather-card", WeatherCard)
