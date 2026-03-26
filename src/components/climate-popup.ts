import { getAcModeState, getAcUiState, normalizeTemp, sendAcPower, sendAcSettings, setAcModeState, setAcUiState } from "../services/ac-remote"
import { getEntity, subscribeEntity } from "../store/entity-store"

const IH = 58

const MODE_ICONS: Record<string, string> = {
    cool: "lucide:snowflake",
    heat: "lucide:flame",
    dry: "lucide:droplets"
}

const MODE_LABELS: Record<string, string> = {
    cool: "Kyla",
    heat: "Värme",
    dry: "Avfukt"
}

const FAN_LABELS: Record<string, string> = {
    auto: "Auto",
    low: "Låg",
    mid: "Medel",
    high: "Hög"
}

const MODES: Array<"cool" | "heat" | "dry"> = ["cool", "heat", "dry"]
const FANS: Array<"auto" | "low" | "mid" | "high"> = ["auto", "low", "mid", "high"]
const LIVING_ROOM_TEMP_ENTITY = "sensor.vardagsrum_temperatursensor_temperature"

class ClimatePopup extends HTMLElement {

    private shadow: ShadowRoot
    private entityId = ""
    private timerHandle?: number
    private timerTickHandle?: number
    private timerEndsAt: number | null = null
    private timerPresetMinutes: number | null = null
    private timerSheetOpen = false
    private pendingTimerH = 1
    private pendingTimerM = 0
    private timerActionState: "set" | "change" = "set"
    private selectedMode: "cool" | "heat" | "dry" = "cool"
    private selectedFan: "auto" | "low" | "mid" | "high" = "auto"
    private selectedTemp = 20
    private powerOn = false
    private roomTempText = "--"
    private roomTempSubscribed = false

    constructor() {
        super()
        this.shadow = this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.ensureRoomTempSubscription()
        this.render()
    }

    open(entityId: string) {
        this.clearTimerHandles()
        this.entityId = entityId
        const localState = getAcUiState()
        this.powerOn = localState.powerOn
        this.selectedMode = localState.mode
        this.selectedFan = localState.fan
        this.selectedTemp = localState.temperature
        this.restoreTimerFromStorage()
        this.refreshRoomTempText()

        this.style.display = "block"
        document.body.classList.add("popup-open")
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.classList.add("active")
            })
        })
        window.history.pushState({ type: "popup", id: "climatePopup" }, "")

        this.update()
    }

    private ensureRoomTempSubscription() {
        if (this.roomTempSubscribed) return
        this.roomTempSubscribed = true
        subscribeEntity(LIVING_ROOM_TEMP_ENTITY, () => {
            this.refreshRoomTempText()
            const currentEl = this.shadow.querySelector(".temp-current") as HTMLElement | null
            if (currentEl) currentEl.textContent = `Rum ${this.roomTempText}°`
        })
        this.refreshRoomTempText()
    }

    private refreshRoomTempText() {
        const state = getEntity(LIVING_ROOM_TEMP_ENTITY)
        if (!state || state.state === "unavailable" || state.state === "unknown") {
            this.roomTempText = "--"
            return
        }

        const value = Number(state.state)
        if (!Number.isFinite(value)) {
            this.roomTempText = "--"
            return
        }

        this.roomTempText = value.toLocaleString("sv-SE", { maximumFractionDigits: 1 })
    }

    close(fromHistory = false) {
        this.classList.remove("active")

        const otherPopups = ["lightPopup", "historyPopup", "tvPopup", "personPopup", "settingsPopup", "todoPopup", "calendarPopup", "climatePopup"]
            .filter(id => id !== "climatePopup")
            .some(id => document.getElementById(id)?.classList.contains("active"))

        if (!otherPopups) document.body.classList.remove("popup-open")

        if (!fromHistory && window.history.state?.type === "popup" && window.history.state?.id === "climatePopup") {
            window.history.back()
        }
        setTimeout(() => {
            this.style.display = "none"
        }, 300)
    }

    /* ---------- HA Services ---------- */

    private async toggle() {
        const nextState = !this.powerOn
        this.powerOn = nextState
        if (nextState) {
            this.selectedMode = "cool"
            this.selectedFan = "auto"
            this.selectedTemp = 20
        }
        this.update()
        setAcUiState({
            powerOn: this.powerOn,
            mode: this.selectedMode,
            fan: this.selectedFan,
            temperature: this.selectedTemp
        })

        try {
            await sendAcPower(nextState, this.entityId)
            if (nextState) {
                await sendAcSettings({
                    mode: "cool",
                    fan: "auto",
                    temperature: 20
                }, this.entityId)
            }
        } catch {
            this.powerOn = !nextState
            this.update()
        }
    }

    private async sendSelectedSettings() {
        if (!this.powerOn) return
        await sendAcSettings({
            mode: this.selectedMode,
            fan: this.selectedFan,
            temperature: this.selectedTemp
        }, this.entityId)
    }

    private async setTemp(targetTemp: number) {
        if (!this.powerOn) return
        const newVal = normalizeTemp(targetTemp)
        this.selectedTemp = newVal
        setAcUiState({ temperature: newVal, powerOn: true })
        setAcModeState(this.selectedMode, { temperature: newVal })

        // Optimistic update
        const tempEl = this.shadow.querySelector(".temp-value")
        if (tempEl) tempEl.textContent = `${newVal}°`
        const sliderEl = this.shadow.querySelector("#temp-slider") as HTMLInputElement | null
        if (sliderEl) sliderEl.value = String(newVal)

        await this.sendSelectedSettings()
    }

    private async setMode(mode: "cool" | "heat" | "dry") {
        if (!this.powerOn) return
        setAcModeState(this.selectedMode, {
            fan: this.selectedFan,
            temperature: this.selectedTemp
        })

        const targetModeState = getAcModeState(mode)
        this.selectedMode = mode
        this.selectedFan = targetModeState.fan
        this.selectedTemp = targetModeState.temperature
        setAcUiState({
            mode,
            fan: this.selectedFan,
            temperature: this.selectedTemp,
            powerOn: true
        })
        this.update()
        await this.sendSelectedSettings()
    }

    private async setFan(mode: "auto" | "low" | "mid" | "high") {
        if (!this.powerOn) return
        this.selectedFan = mode
        setAcUiState({ fan: mode, powerOn: true })
        setAcModeState(this.selectedMode, { fan: mode })
        this.update()
        await this.sendSelectedSettings()
    }

    private pad(n: number) {
        return String(n).padStart(2, "0")
    }

    private closeTimerSheet() {
        this.timerSheetOpen = false
        const overlay = this.shadow.querySelector("#timerOverlay") as HTMLElement | null
        if (overlay) overlay.classList.remove("active")
    }

    private openTimerSheet() {
        if (!this.powerOn) return
        const remainingMin = this.timerEndsAt ? Math.max(0, Math.ceil((this.timerEndsAt - Date.now()) / 60000)) : 60
        const roundedMin = Math.round((remainingMin % 60) / 5) * 5
        const carry = roundedMin === 60 ? 1 : 0

        this.pendingTimerH = Math.min(23, Math.floor(remainingMin / 60) + carry)
        this.pendingTimerM = roundedMin === 60 ? 0 : roundedMin

        this.timerSheetOpen = true
        const overlay = this.shadow.querySelector("#timerOverlay") as HTMLElement | null
        if (overlay) overlay.classList.add("active")

        requestAnimationFrame(() => {
            const hDrum = this.shadow.querySelector("#timerHDrum") as HTMLElement | null
            const mDrum = this.shadow.querySelector("#timerMDrum") as HTMLElement | null
            if (hDrum) {
                hDrum.style.scrollBehavior = "auto"
                hDrum.scrollTop = this.pendingTimerH * IH
            }
            if (mDrum) {
                mDrum.style.scrollBehavior = "auto"
                mDrum.scrollTop = (this.pendingTimerM / 5) * IH
            }
            setTimeout(() => {
                if (hDrum) hDrum.style.scrollBehavior = ""
                if (mDrum) mDrum.style.scrollBehavior = ""
            }, 80)
        })
    }

    private timerStorageKey() {
        return `climate-timer:${this.entityId}`
    }

    private clearTimerHandles() {
        if (this.timerHandle) {
            window.clearTimeout(this.timerHandle)
            this.timerHandle = undefined
        }
        if (this.timerTickHandle) {
            window.clearInterval(this.timerTickHandle)
            this.timerTickHandle = undefined
        }
    }

    private clearTimer(keepStorage = false) {
        this.clearTimerHandles()
        this.timerEndsAt = null
        this.timerPresetMinutes = null
        if (!keepStorage) localStorage.removeItem(this.timerStorageKey())
        this.updateTimerStatus()
    }

    private setTimer(minutes: number) {
        if (!this.entityId) return
        this.clearTimerHandles()

        this.timerPresetMinutes = minutes
        this.timerEndsAt = Date.now() + (minutes * 60 * 1000)
        localStorage.setItem(this.timerStorageKey(), JSON.stringify({
            endsAt: this.timerEndsAt,
            presetMinutes: this.timerPresetMinutes
        }))

        this.timerHandle = window.setTimeout(() => {
            this.powerOn = false
            setAcUiState({ powerOn: false })
            void sendAcPower(false, this.entityId)
            this.clearTimer()
            this.update()
        }, minutes * 60 * 1000)

        this.timerTickHandle = window.setInterval(() => this.updateTimerStatus(), 1000)
        this.updateTimerStatus()
    }

    private restoreTimerFromStorage() {
        if (!this.entityId) return
        const raw = localStorage.getItem(this.timerStorageKey())
        if (!raw) {
            this.clearTimer(true)
            return
        }

        try {
            const parsed = JSON.parse(raw) as { endsAt?: number, presetMinutes?: number }
            if (!parsed.endsAt || parsed.endsAt <= Date.now()) {
                this.clearTimer()
                return
            }

            const remainingMs = parsed.endsAt - Date.now()
            this.timerEndsAt = parsed.endsAt
            this.timerPresetMinutes = parsed.presetMinutes ?? null

            this.timerHandle = window.setTimeout(() => {
                this.powerOn = false
                setAcUiState({ powerOn: false })
                void sendAcPower(false, this.entityId)
                this.clearTimer()
                this.update()
            }, remainingMs)
            this.timerTickHandle = window.setInterval(() => this.updateTimerStatus(), 1000)
        } catch {
            this.clearTimer()
        }
    }

    private formatRemaining(ms: number) {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000))
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60

        if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`
        return `${minutes}:${String(seconds).padStart(2, "0")}`
    }

    private updateTimerStatus() {
        const statusEl = this.shadow.querySelector("#timer-status") as HTMLElement | null
        const openBtn = this.shadow.querySelector("#timer-open-btn") as HTMLButtonElement | null
        if (!statusEl) return

        if (!this.timerEndsAt) {
            statusEl.textContent = "Ingen timer aktiv"
            if (openBtn && this.timerActionState !== "set") {
                openBtn.innerHTML = `<iconify-icon icon="lucide:timer-reset"></iconify-icon><span>Ställ in</span>`
                this.timerActionState = "set"
            }
            return
        }

        const remaining = this.timerEndsAt - Date.now()
        if (remaining <= 0) {
            this.clearTimer()
            return
        }
        statusEl.textContent = `Stängs av om ${this.formatRemaining(remaining)}`
        if (openBtn && this.timerActionState !== "change") {
            openBtn.innerHTML = `<iconify-icon icon="lucide:timer"></iconify-icon><span>Ändra</span>`
            this.timerActionState = "change"
        }
    }

    /* ---------- State Update ---------- */

    update() {
        const isOn = this.powerOn

        const ts = this.shadow.querySelector("toggle-switch")
        if (ts) {
            ts.setAttribute("checked", String(isOn))
            if (isOn) ts.setAttribute("accent", "var(--accent)")
            else ts.removeAttribute("accent")
        }

        const tempContainer = this.shadow.querySelector(".temp-control") as HTMLElement
        if (tempContainer) {
            if (isOn) tempContainer.classList.remove("disabled")
            else tempContainer.classList.add("disabled")

            const temp = isOn ? this.selectedTemp : "--"
            const valEl = tempContainer.querySelector(".temp-value")
            if (valEl) valEl.textContent = `${temp}°`

            const currentEl = tempContainer.querySelector(".temp-current")
            if (currentEl) {
                currentEl.textContent = `Rum ${this.roomTempText}°`
            }

            const slider = tempContainer.querySelector("#temp-slider") as HTMLInputElement | null
            if (slider) {
                const min = 16
                const max = 30
                const setTemp = this.selectedTemp
                slider.min = String(min)
                slider.max = String(max)
                slider.value = String(setTemp)
                slider.disabled = !isOn

                const minEl = tempContainer.querySelector(".temp-min")
                const maxEl = tempContainer.querySelector(".temp-max")
                if (minEl) minEl.textContent = `${min}°`
                if (maxEl) maxEl.textContent = `${max}°`
            }
        }

        const modeGrid = this.shadow.querySelector(".mode-grid") as HTMLElement
        if (modeGrid) {
            modeGrid.innerHTML = ""
            for (const m of MODES) {
                const btn = document.createElement("button")
                btn.className = `pill-btn ${m === this.selectedMode ? "active" : ""}`
                btn.innerHTML = `<iconify-icon icon="${MODE_ICONS[m] || "lucide:circle"}"></iconify-icon><span>${MODE_LABELS[m] || m}</span>`
                btn.disabled = !isOn
                btn.onclick = () => void this.setMode(m)
                modeGrid.appendChild(btn)
            }
        }

        const fanGrid = this.shadow.querySelector(".fan-grid") as HTMLElement
        if (fanGrid) {
            fanGrid.innerHTML = ""
            for (const f of FANS) {
                const btn = document.createElement("button")
                btn.className = `pill-btn ${f === this.selectedFan ? "active" : ""}`
                btn.innerHTML = `${FAN_LABELS[f] || f}`
                btn.disabled = !isOn
                btn.onclick = () => void this.setFan(f)
                fanGrid.appendChild(btn)
            }
        }

        const timerOpen = this.shadow.querySelector("#timer-open-btn") as HTMLButtonElement | null
        const timerCancel = this.shadow.querySelector("#timer-cancel") as HTMLButtonElement | null
        if (timerOpen) timerOpen.disabled = !isOn
        if (timerCancel) timerCancel.disabled = !isOn

        this.updateTimerStatus()
    }

    /* ---------- Render ---------- */

    render() {
        this.shadow.innerHTML = `
<style>
:host{
    position:fixed;
    inset:0;
    display:none;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index:10000;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
}
:host(.active) {
    opacity: 1;
    pointer-events: auto;
}

.sheet{
    position:absolute;
    top: 60px;
    left:50%;
    transform:translate(-50%, 16px);
    opacity: 0;
    width:calc(100% - 32px);
    max-width:420px;
    background: var(--color-card);
    border-radius:var(--radius-xl);
    padding:24px;
    border: 1px solid var(--border-color);
    box-shadow: 0 24px 64px rgba(0,0,0,0.2);
    box-sizing:border-box;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
:host(.active) .sheet {
    transform: translate(-50%, 0);
    opacity: 1;
}

.header{
    display:flex;
    justify-content:space-between;
    align-items:center;
    margin-bottom: 24px;
}

.title-area {
    display: flex;
    flex-direction: column;
}

.title{
    font-size: 1.125rem;
    font-weight: 500;
    color:var(--text-primary);
}

.subtitle {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-top: 2px;
}

.close{
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--close-bg, color-mix(in srgb, var(--color-danger) 20%, transparent));
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor:pointer;
    color: var(--close-text, var(--color-danger));
    font-size: 0.875rem;
    line-height: 1;
    transition: background 0.15s ease;
}
.close:active { background: var(--border-color); }

.power-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: color-mix(in srgb, var(--border-color) 40%, transparent);
    border-radius: var(--radius-lg);
    margin-bottom: 24px;
}

.power-label {
    font-weight: 500;
    color: var(--text-primary);
}

.temp-control {
    display: grid;
    grid-template-columns: 1fr;
    margin-bottom: 32px;
    padding: 16px;
    background: color-mix(in srgb, var(--border-color) 34%, transparent);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
    transition: opacity 0.3s ease;
}

.temp-control.disabled {
    opacity: 0.4;
    pointer-events: none;
}

.temp-value-wrapper {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 12px;
    gap: 12px;
}

.temp-current {
    color: var(--text-secondary);
    font-size: 0.8125rem;
}

.temp-slider {
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text-secondary) 20%, transparent);
    outline: none;
    margin: 6px 0 4px;
}

.temp-slider::-webkit-slider-thumb {
    appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid var(--color-card);
    background: var(--accent);
    box-shadow: 0 6px 12px rgba(0,0,0,0.2);
}

.temp-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid var(--color-card);
    background: var(--accent);
    box-shadow: 0 6px 12px rgba(0,0,0,0.2);
}

.temp-scale {
    display: flex;
    justify-content: space-between;
    color: var(--text-secondary);
    font-size: 0.75rem;
}

.pill-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    gap: 8px;
    margin-bottom: 24px;
}

.pill-btn {
    padding: 12px 0;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 0.2s ease;
    white-space: nowrap;
}

.pill-btn iconify-icon {
    font-size: 0.95rem;
}

.temp-value {
    font-size: 2.4rem;
    font-weight: 400;
    line-height: 1;
    color: var(--text-primary);
    letter-spacing: -0.02em;
}

.section-label {
    font-weight: 500;
    color: var(--text-secondary);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 12px;
}

.pill-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
}

.pill-btn:active:not(.active) {
    background: var(--border-color);
}

.pill-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.timer-grid {
    margin-bottom: 10px;
}

.timer-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 10px;
}

.timer-status {
    color: var(--text-secondary);
    font-size: 0.8125rem;
    margin-bottom: 2px;
}

.timer-cancel {
    background: var(--color-danger);
    border-color: var(--color-danger);
    color: white;
}

.timer-open iconify-icon {
    font-size: 0.95rem;
}

.timer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 10001;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 16px;
}

.timer-overlay.active {
    display: flex;
    animation: fi 0.2s ease-out;
}

.timer-card {
    background: var(--color-card);
    width: 100%;
    max-width: 360px;
    border-radius: var(--radius-xl, 28px);
    padding: 20px 20px 24px;
    border: 1px solid var(--border-color);
    box-shadow: 0 24px 64px rgba(0,0,0,0.3);
    overflow: hidden;
}

.timer-overlay.active .timer-card {
    animation: su 0.28s cubic-bezier(0.16,1,0.3,1);
}

.timer-hdr {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.timer-title {
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-primary);
}

.drum-scene {
    position: relative;
    height: ${IH * 3}px;
    border-radius: 16px;
    background: var(--color-bg);
    border: 1px solid var(--border-color);
    overflow: hidden;
}

.drum-hl {
    position: absolute;
    left: 16px;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    height: ${IH}px;
    background: var(--color-card);
    border: 1.5px solid color-mix(in srgb, var(--accent) 35%, transparent);
    border-radius: 12px;
    pointer-events: none;
    z-index: 1;
}

.drum-fade {
    position: absolute;
    left: 0;
    right: 0;
    height: ${IH * 1.1}px;
    pointer-events: none;
    z-index: 3;
}

.drum-fade-t {
    top: 0;
    background: linear-gradient(to bottom, var(--color-bg) 15%, transparent);
}

.drum-fade-b {
    bottom: 0;
    background: linear-gradient(to top, var(--color-bg) 15%, transparent);
}

.drum-cols {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0 20px;
}

.drum {
    height: ${IH * 3}px;
    overflow-y: scroll;
    scroll-snap-type: y mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
}

.drum::-webkit-scrollbar {
    display: none;
}

.dspc {
    height: ${IH}px;
}

.di {
    height: ${IH}px;
    display: flex;
    align-items: center;
    justify-content: center;
    scroll-snap-align: center;
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    user-select: none;
}

.drum-sep {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    padding: 0 8px;
    user-select: none;
}

.actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
}

.btn {
    flex: 1;
    padding: 12px;
    border-radius: 12px;
    border: none;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--font-main, inherit);
    transition: opacity 0.15s, transform 0.15s;
}

.btn:active {
    transform: scale(0.97);
    opacity: 0.85;
}

.btn-cancel {
    background: var(--color-danger);
    color: white;
}

.btn-save {
    background: var(--color-success);
    color: white;
}

@keyframes fi {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes su {
    from {
        transform: scale(0.95);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}
</style>

<div class="sheet">
    <div class="header">
        <div class="title-area">
            <div class="title">Luftvärmepump</div>
            <div class="subtitle">Panasonic CS_NZ35YKE</div>
        </div>
        <div class="close"><iconify-icon icon="lucide:x"></iconify-icon></div>
    </div>

    <div class="power-row" id="power-toggle">
        <div class="power-label">Ström</div>
        <toggle-switch></toggle-switch>
    </div>

    <div class="temp-control disabled">
        <div class="temp-value-wrapper">
            <div class="temp-value">--°</div>
            <div class="temp-current">Rum --°</div>
        </div>
        <input id="temp-slider" class="temp-slider" type="range" min="16" max="30" step="0.5" value="20">
        <div class="temp-scale"><span class="temp-min">16°</span><span class="temp-max">30°</span></div>
    </div>

    <div class="section-label">Läge</div>
    <div class="pill-grid mode-grid"></div>

    <div class="section-label">Fläkt</div>
    <div class="pill-grid fan-grid"></div>

    <div class="section-label">Timer</div>
    <div class="timer-actions timer-grid">
        <button class="pill-btn timer-open" id="timer-open-btn"><iconify-icon icon="lucide:timer-reset"></iconify-icon><span>Ställ in</span></button>
        <button class="pill-btn timer-cancel" id="timer-cancel">Avbryt</button>
    </div>
    <div class="timer-status" id="timer-status">Ingen timer aktiv</div>

</div>

<div class="timer-overlay" id="timerOverlay">
    <div class="timer-card">
        <div class="timer-hdr">
            <div class="timer-title">Timer</div>
            <div class="close" id="timer-sheet-close"><iconify-icon icon="lucide:x"></iconify-icon></div>
        </div>

        <div class="drum-scene">
            <div class="drum-hl"></div>
            <div class="drum-fade drum-fade-t"></div>
            <div class="drum-fade drum-fade-b"></div>
            <div class="drum-cols">
                <div class="drum" id="timerHDrum">
                    <div class="dspc"></div>
                    ${Array.from({ length: 24 }, (_, i) => `<div class="di">${this.pad(i)}</div>`).join("")}
                    <div class="dspc"></div>
                </div>
                <div class="drum-sep">:</div>
                <div class="drum" id="timerMDrum">
                    <div class="dspc"></div>
                    ${Array.from({ length: 12 }, (_, i) => `<div class="di">${this.pad(i * 5)}</div>`).join("")}
                    <div class="dspc"></div>
                </div>
            </div>
        </div>

        <div class="actions">
            <button class="btn btn-cancel" id="timer-sheet-cancel">Avbryt</button>
            <button class="btn btn-save" id="timer-sheet-save">Starta</button>
        </div>
    </div>
</div>
        `

        const host = this.shadow.host as HTMLElement
        const sheet = this.shadow.querySelector(".sheet") as HTMLElement
        const close = this.shadow.querySelector(".close") as HTMLElement

        const toggleRow = this.shadow.querySelector("#power-toggle") as HTMLElement
        const ts = this.shadow.querySelector("toggle-switch") as HTMLElement
        const slider = this.shadow.querySelector("#temp-slider") as HTMLInputElement
        const timerOpenBtn = this.shadow.querySelector("#timer-open-btn") as HTMLButtonElement
        const timerCancel = this.shadow.querySelector("#timer-cancel") as HTMLButtonElement
        const timerOverlay = this.shadow.querySelector("#timerOverlay") as HTMLElement
        const timerSheetClose = this.shadow.querySelector("#timer-sheet-close") as HTMLElement
        const timerSheetCancel = this.shadow.querySelector("#timer-sheet-cancel") as HTMLButtonElement
        const timerSheetSave = this.shadow.querySelector("#timer-sheet-save") as HTMLButtonElement
        const timerHDrum = this.shadow.querySelector("#timerHDrum") as HTMLElement
        const timerMDrum = this.shadow.querySelector("#timerMDrum") as HTMLElement
        const timerCard = this.shadow.querySelector(".timer-card") as HTMLElement

        sheet.onclick = e => e.stopPropagation()
        host.onclick = e => { if (e.target === host) this.close() }
        close.onclick = () => this.close()

        toggleRow.onclick = (e) => {
            const path = e.composedPath()
            if (path.includes(ts)) return
            void this.toggle()
        }
        ts.addEventListener("toggle", (e) => {
            e.stopPropagation()
            void this.toggle()
        })

        slider.oninput = () => {
            const tempEl = this.shadow.querySelector(".temp-value")
            if (tempEl) tempEl.textContent = `${Number(slider.value).toFixed(1).replace(".0", "")}°`
        }
        slider.onchange = () => this.setTemp(Number(slider.value))

        timerOpenBtn.onclick = () => this.openTimerSheet()
        timerCancel.onclick = () => {
            if (!this.powerOn) return
            this.clearTimer()
        }

        timerOverlay.onclick = (e) => {
            e.stopPropagation()
            if (e.target === timerOverlay) this.closeTimerSheet()
        }
        timerCard.onclick = (e) => e.stopPropagation()

        timerSheetClose.onclick = (e) => {
            e.stopPropagation()
            this.closeTimerSheet()
        }
        timerSheetCancel.onclick = (e) => {
            e.stopPropagation()
            this.closeTimerSheet()
        }
        timerSheetSave.onclick = (e) => {
            e.stopPropagation()
            const h = Math.min(23, Math.max(0, Math.round(timerHDrum.scrollTop / IH)))
            const m = Math.min(11, Math.max(0, Math.round(timerMDrum.scrollTop / IH))) * 5
            const total = (h * 60) + m

            if (total <= 0) this.clearTimer()
            else this.setTimer(total)
            this.closeTimerSheet()
        }

        this.updateTimerStatus()
    }
}

customElements.define("climate-popup", ClimatePopup)
