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

        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: block;
                    background: var(--color-card);
                    border-radius: var(--radius-md);
                    padding: var(--space-md);
                    color: var(--text-primary);
                    opacity: 0;
                    transition: opacity 0.4s ease-out;
                }
                :host([loaded]) {
                    opacity: 1;
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
                    display: flex;
                    align-items: center;
                    gap: 4px;
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
                    <span class="condition">${condition}</span>
                    <span class="location">
                        ${this.localWeather ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:1px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>` : ''}
                        ${locationName}</span>
                </div>
                <div class="weather-icon-large">
                    ${this.getWeatherIcon(condition, 80, isNight)}
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
        if (this.localWeather) {
            const timeseries = this.localWeather.properties.timeseries
            const now = new Date()
            
            let html = ""
            timeseries.slice(0, 24).forEach((t: any) => {
                const date = new Date(t.time)
                if (date < now && (now.getTime() - date.getTime()) > 3600000) return

                const timeStr = date.getHours().toString().padStart(2, '0') + ":00"
                const hour = date.getHours()
                const isNight = hour > 20 || hour < 6
                const symbol = t.data.next_1_hours?.summary?.symbol_code || t.data.next_6_hours?.summary?.symbol_code
                const cond = this.getMetState(symbol)
                const temp = Math.round(t.data.instant.details.air_temperature)
                const precip = t.data.next_1_hours?.data?.details?.precipitation_amount || 0

                html += `
                    <div class="item">
                        <span class="label">${timeStr}</span>
                        ${this.getWeatherIcon(cond, 26, isNight)}
                        <span class="f-temp">${temp}°</span>
                        <span class="precip">${precip > 0 ? precip.toFixed(1) + ' mm' : '&nbsp;'}</span>
                    </div>
                `
            })
            return html
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
            const dailyData: any[] = []
            
            // Yr.no returns everything as points, grouped by day manually
            const processedDays = new Set()
            timeseries.forEach((ts: any) => {
                const date = new Date(ts.time).toLocaleDateString()
                if (!processedDays.has(date) && dailyData.length < 8) {
                    processedDays.add(date)
                    const data = ts.data.next_6_hours || ts.data.next_12_hours
                    if (data) {
                        dailyData.push({
                            time: ts.time,
                            tempMax: ts.data.instant.details.air_temperature,
                            tempMin: ts.data.instant.details.air_temperature, // Simplified for compact view
                            symbol: data.summary.symbol_code,
                            precip: data.details?.precipitation_amount || 0
                        })
                    }
                }
            })

            return dailyData.map((d: any, i: number) => {
                const date = new Date(d.time)
                const dayName = i === 0 ? "Idag" : i === 1 ? "Imorgon" : days[date.getDay()]
                let cond = this.getMetState(d.symbol)
                
                return `
                    <div class="item">
                        <span class="label">${dayName}</span>
                        ${this.getWeatherIcon(cond, 26, false)}
                        <div class="f-temps">
                            <span class="f-temp">${Math.round(d.tempMax)}°</span>
                            <span class="f-temp low">${Math.round(d.tempMin - 2)}°</span>
                        </div>
                        <span class="precip">${d.precip > 0 ? d.precip.toFixed(1) + ' mm' : '&nbsp;'}</span>
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
