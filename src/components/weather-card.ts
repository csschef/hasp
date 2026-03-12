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
    
    // NEW: Person tracking
    private personEntity = "person.sebastian"
    private lastCoords: string = ""
    private localWeather: any = null
    private localLocation: string = "Lindsdal"
    private isExpanded: boolean = false

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
        "pouring": "Osregn.png",
        "lätt regn": "Regn3.png",
        "regnskurar": "Regn3.png",
        "lätt snö": "Sno.png",
        "snöbyar": "Sno.png",
        "snöfall": "Sno.png",
        "snöblandat regn": "Snoregn.png",
        "halfcloudy": "Delvismolnigtdag2.png"
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        // 1. Subscribe to HA sensors for fallback/home data
        [this.weatherEntity, this.currentSensor, this.stateSensor, this.toggleEntity, this.hourlySensor, this.dailySensor, this.personEntity].forEach(id => {
            subscribeEntity(id, () => this.handleUpdate())
        })

        // 2. Request Browser Location (The "Native App" feel)
        this.requestBrowserLocation()
        
        // 3. Refresh location when app comes back into focus (unlocking phone)
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                this.requestBrowserLocation()
            }
        })

        // 4. Click to toggle expansion
        this.addEventListener("click", () => {
            this.isExpanded = !this.isExpanded;
            this.render();
        });

        this.handleUpdate()
    }

    private requestBrowserLocation() {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    this.fetchLocalWeather(pos.coords.latitude, pos.coords.longitude)
                },
                (err) => {
                    console.log("Browser location denied or unavailable, using HA Person fallback.")
                },
                { enableHighAccuracy: true, timeout: 5000 }
            )
        }
    }

    private handleUpdate() {
        // If we already have a browser-based local weather, we don't need the person fallback
        // unless the person moves significantly (but GPS is usually better anyway)
        const person = getEntity(this.personEntity)
        
        if (!this.localWeather && person?.attributes.latitude && person?.attributes.longitude) {
            const coords = `${person.attributes.latitude},${person.attributes.longitude}`
            if (coords !== this.lastCoords) {
                this.lastCoords = coords
                this.fetchLocalWeather(person.attributes.latitude, person.attributes.longitude)
            }
        }
        if (person || this.localWeather) {
            this.setAttribute("loaded", "")
        }
        this.render()
    }
    private async fetchLocalWeather(lat: number, lon: number) {
        try {
            // 1. Get City Name (Reverse Geocode) - Using BigDataCloud
            const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=sv`)
            const geoData = await geoRes.json()
            
            // Prioritize specific locality/suburb names
            const location = geoData.locality || geoData.village || geoData.suburb || geoData.city || "Okänd plats"
            this.localLocation = location.replace(/ kommun$/i, "")

            // 2. Get Weather - Yr.no (MET Norway)
            const weatherRes = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`, {
                headers: { 'User-Agent': 'HomeAssistantDashboard/1.0' }
            })
            const data = await weatherRes.json()
            
            this.localWeather = data
            this.setAttribute("loaded", "")
            this.render()
        } catch (e) {
            console.error("Failed to fetch local weather from MET Norway", e)
        }
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

        const isDaily = toggle?.state === "off"
        const isNight = sun?.state === "below_horizon"

        // Localized vs Fixed Logic
        let temp: number
        let condition: string
        let locationName: string

        if (this.localWeather) {
            const current = this.localWeather.properties.timeseries[0].data.instant.details
            const symbol = this.localWeather.properties.timeseries[0].data.next_1_hours.summary.symbol_code
            temp = Math.round(current.air_temperature)
            condition = this.getMetState(symbol)
            locationName = this.localLocation
        } else {
            temp = Math.round(Number(weather.attributes.temperature || 0))
            condition = current.state
            locationName = "Lindsdal"
        }

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
                    align-items: flex-start;
                    gap: 16px;
                }
                .temp-group {
                    display: flex;
                    align-items: flex-start;
                    gap: 2px;
                }
                .temp {
                    font-size: 56px;
                    font-weight: 600;
                    letter-spacing: -3px;
                    line-height: 0.9;
                }
                .unit {
                    font-size: 32px;
                    font-weight: 500;
                    margin-top: 4px;
                    opacity: 0.5;
                }
                .meta {
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-start;
                    flex: 1;
                    padding-top: 4px;
                }
                .condition {
                    font-size: 18px;
                    font-weight: 600;
                    text-transform: capitalize;
                    line-height: 1.2;
                }
                .location {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    margin-top: 4px;
                    font-size: 14px;
                    color: var(--text-secondary);
                    opacity: 0.8;
                }
                .weather-icon-large {
                    color: var(--accent);
                    margin-top: -10px; /* Perfectly align with the caps of the temperature digits */
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

                .sun-info {
                    display: flex;
                    justify-content: center;
                    gap: 32px;
                    margin-bottom: 24px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    font-size: 13px;
                    color: var(--text-secondary);
                    font-weight: 500;
                }
                .sun-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                /* Ensure the expanded state looks balanced */
                :host([expanded]) .hero,
                .hero.expanded {
                    margin-bottom: 0px;
                }
            </style>
            
            <div class="hero">
                <div class="temp-group">
                    <span class="temp">${temp}</span>
                    <span class="unit">°</span>
                </div>
                
                <div class="meta">
                    <div class="condition">${condition}</div>
                    <div class="location">
                        ${this.localWeather ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:1px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>` : ''}
                        ${locationName}
                    </div>
                </div>

                <div class="weather-icon-large">
                    ${this.getWeatherIcon(condition, 74, isNight)}
                </div>
            </div>

            <div class="expander ${this.isExpanded ? 'expanded' : ''}">
                <div class="expander-content">
                    <div class="content-inner">
                        <div class="sun-info">
                            <div class="sun-item">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible"><path d="M12 11V3.5"/><path d="m9 6.5 3-3 3 3"/><path d="M18 20a6 6 0 0 0-12 0"/><path d="M2 22h20"/></svg>
                                Soluppgång ${formatTime(sun?.attributes.next_rising)}
                            </div>
                            <div class="sun-item">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible"><path d="M12 3.5v7.5"/><path d="m15 8-3 3-3-3"/><path d="M18 20a6 6 0 0 0-12 0"/><path d="M2 22h20"/></svg>
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
        if (this.localWeather) {
            const timeseries = this.localWeather.properties.timeseries
            const now = new Date()
            
            // Filter only future points and take next 24
            const futurePoints = timeseries.filter((ts: any) => new Date(ts.time) > now)

            return futurePoints.slice(0, 24).map((ts: any) => {
                const date = new Date(ts.time)
                const temp = Math.round(ts.data.instant.details.air_temperature)
                const symbol = ts.data.next_1_hours?.summary?.symbol_code || ts.data.next_6_hours?.summary?.symbol_code
                const cond = this.getMetState(symbol)
                const precip = ts.data.next_1_hours?.details?.precipitation_amount || 0
                
                return `
                    <div class="item">
                        <span class="label">${date.getHours()}:00</span>
                        ${this.getWeatherIcon(cond, 24, date.getHours() > 20 || date.getHours() < 6)}
                        <span class="f-temp">${temp}°</span>
                        <span class="precip">${precip > 0 ? precip.toFixed(1) + ' mm' : '&nbsp;'}</span>
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
        if (this.localWeather) {
            const timeseries = this.localWeather.properties.timeseries
            const days = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"]
            
            // 1. Group all points by local date
            const dailyGroups: Record<string, any[]> = {}
            timeseries.forEach((ts: any) => {
                const dateKey = new Date(ts.time).toLocaleDateString()
                if (!dailyGroups[dateKey]) dailyGroups[dateKey] = []
                dailyGroups[dateKey].push(ts)
            })

            const dailyData: any[] = []
            Object.keys(dailyGroups).forEach(dateKey => {
                const group = dailyGroups[dateKey]
                
                // Get all temperatures for this day
                const temps = group.map(ts => ts.data.instant.details.air_temperature)
                
                // Find a midday point (around 12:00 local) for the day's icon
                let midDayPoint = group.find(ts => new Date(ts.time).getHours() === 12) || group[Math.floor(group.length / 2)]
                
                // Sum precipitation for the whole day
                // MET Norway provides non-overlapping windows. We prefer 1h windows, fall back to 6h.
                let totalPrecip = 0
                let lastPrecipTime = 0
                
                group.forEach(ts => {
                    const time = new Date(ts.time).getTime()
                    const p1 = ts.data.next_1_hours?.details?.precipitation_amount
                    const p6 = ts.data.next_6_hours?.details?.precipitation_amount
                    
                    if (p1 !== undefined) {
                        totalPrecip += p1
                    } else if (p6 !== undefined && time >= lastPrecipTime + 6 * 3600000) {
                        // Only add 6h data if we haven't covered these hours with 1h points
                        totalPrecip += p6
                        lastPrecipTime = time
                    }
                })

                dailyData.push({
                    time: group[0].time,
                    tempMax: Math.max(...temps),
                    tempMin: Math.min(...temps),
                    symbol: midDayPoint.data.next_6_hours?.summary?.symbol_code || midDayPoint.data.next_12_hours?.summary?.symbol_code || midDayPoint.data.next_1_hours?.summary?.symbol_code,
                    precip: totalPrecip
                })
            })

            // Skip "today" if it's late in the evening and user wants "tomorrow" as first forecast
            // or just show the next 8 days available
            return dailyData.slice(0, 8).map((d: any, i: number) => {
                const date = new Date(d.time)
                const dayName = i === 0 ? "Idag" : i === 1 ? "Imorgon" : days[date.getDay()]
                let cond = this.getMetState(d.symbol)
                
                return `
                    <div class="item">
                        <span class="label">${dayName}</span>
                        ${this.getWeatherIcon(cond, 26, false)}
                        <div class="f-temps">
                            <span class="f-temp">${Math.round(d.tempMax)}°</span>
                            <span class="f-temp low">${Math.round(d.tempMin)}°</span>
                        </div>
                        <span class="precip">${d.precip > 0.1 ? d.precip.toFixed(1) + ' mm' : '&nbsp;'}</span>
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

    private getMetState(symbol: string): string {
        const s = symbol?.split("_")[0] || ""
        switch (s) {
            case "clearsky": return "Soligt"
            case "fair": 
            case "partlycloudy": return "Delvis molnigt"
            case "cloudy": return "Molnigt"
            case "fog": return "Dimma"
            case "rain": 
            case "heavyrain": return "Regn"
            case "lightrain": 
            case "lightrainshowers": return "Lätt regn"
            case "rainshowers": 
            case "heavyrainshowers": return "Regnskurar"
            case "snow": 
            case "heavysnow": return "Snöfall"
            case "lightsnow": 
            case "lightsnowshowers":
            case "snowshowers": return "Snöbyar"
            case "sleet": 
            case "sleetshowers": return "Snöblandat regn"
            case "thunderstorm": return "Åska"
            default: return "Molnigt"
        }
    }

    private getWeatherIcon(condition: string, size: number, isNight: boolean = false) {
        const condRaw = condition?.toLowerCase().trim() || ""
        
        // Map common HA states to our internal keys
        let stateKey = condRaw
        if (condRaw === "clear-night" || condRaw === "stjärnklart" || condRaw === "klart") stateKey = "soligt"
        if (condRaw === "clouds") stateKey = "molnigt"
        
        // Check for night variation
        const nightKey = `${stateKey}_night`
        const finalKey = (isNight && this.imageMap[nightKey]) ? nightKey : stateKey
        
        const fileName = this.imageMap[finalKey]

        if (fileName) {
            return `
                <div class="icon-wrapper" style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
                    <img src="/weather/${fileName}" 
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
