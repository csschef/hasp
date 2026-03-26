import { BaseCard } from "./base-card"
import { AC_UI_STATE_CHANGED_EVENT, getAcUiState, sendAcPower, sendAcSettings, setAcUiState } from "../services/ac-remote"

const AC_ICON = (cls: string) => `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 17.5a2.5 2.5 0 1 1-4 2.03V12m-8 0H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 8h12M6.6 15.572A2 2 0 1 0 10 17v-5"/>
</svg>`

const AC_MODE_BACKGROUNDS: Record<"cool" | "heat" | "dry", string> = {
    // Match PC card blue when AC is cooling.
    cool: "var(--active-device-bg, linear-gradient(145deg, #767cda 0%, #a0a5eb 100%))",
    heat: "linear-gradient(145deg, #ff7a18 0%, #ffb347 100%)",
    dry: "linear-gradient(145deg, color-mix(in srgb, var(--color-success) 88%, white) 0%, var(--color-success) 100%)"
}

class ClimateCard extends BaseCard {

    private entityId = "climate.panasonic_ac"
    private isToggling = false
    private toggleTimeout: any
    private timerInterval: number | null = null
    private visuallyOn = false
    private selectedMode: "cool" | "heat" | "dry" = "cool"
    private selectedTemp = 20
    private readonly onAcStateChanged = (event: Event) => {
        if (this.isToggling) return
        const custom = event as CustomEvent<{ powerOn: boolean, mode: "cool" | "heat" | "dry", temperature: number }>
        const next = custom.detail
        if (!next) return
        this.visuallyOn = Boolean(next.powerOn)
        this.selectedMode = next.mode
        this.selectedTemp = next.temperature
        this.update()
    }

    connectedCallback() {
        this.entityId = (this.getAttribute("entity") || "climate.panasonic_ac").trim()
        const localState = getAcUiState()
        this.visuallyOn = localState.powerOn
        this.selectedMode = localState.mode
        this.selectedTemp = localState.temperature
        window.addEventListener(AC_UI_STATE_CHANGED_EVENT, this.onAcStateChanged)
        this.timerInterval = window.setInterval(() => this.update(), 1000)
        this.update()
    }

    disconnectedCallback() {
        window.removeEventListener(AC_UI_STATE_CHANGED_EVENT, this.onAcStateChanged)
        clearTimeout(this.toggleTimeout)
        if (this.timerInterval != null) {
            window.clearInterval(this.timerInterval)
            this.timerInterval = null
        }
    }

    private async toggle() {
        if (this.isToggling) return
        this.visuallyOn = !this.visuallyOn
        if (this.visuallyOn) {
            this.selectedMode = "cool"
            this.selectedTemp = 20
        }
        this.applyVisuals()
        this.isToggling = true
        clearTimeout(this.toggleTimeout)
        this.toggleTimeout = setTimeout(() => {
            this.isToggling = false
            this.update()
        }, 3000)

        try {
            await sendAcPower(this.visuallyOn, this.entityId)
            if (this.visuallyOn) {
                await sendAcSettings({
                    mode: "cool",
                    fan: "auto",
                    temperature: 20
                }, this.entityId)
            }
            setAcUiState({
                powerOn: this.visuallyOn,
                mode: this.selectedMode,
                fan: "auto",
                temperature: this.selectedTemp
            })
        } catch {
            this.visuallyOn = !this.visuallyOn
            this.isToggling = false
            this.update()
        }
    }

    openPopup() {
        const popup = document.getElementById("climatePopup") as any
        popup?.open(this.entityId)
    }

    update() {
        if (this.isToggling) return
        const subtitle = this.buildSubtitle()
        this.render("Luftvärmepump", subtitle)
        this.applyVisuals()
    }

    private buildSubtitle(): string {
        if (!this.visuallyOn) return "Av"
        const mode = this.selectedMode
        const temp = this.selectedTemp
        const modeLabel: Record<string, string> = {
            cool: "Kyla",
            heat: "Värme",
            dry: "Avfukt",
            fan_only: "Fläkt",
            auto: "Auto"
        }
        const label = modeLabel[mode] ?? mode
        const base = temp != null ? `${label} ${temp}°` : label
        const timerText = this.getTimerText()
        return timerText ? `${base} · ${timerText}` : base
    }

    private getTimerText(): string | null {
        const key = `climate-timer:${this.entityId}`
        try {
            const raw = localStorage.getItem(key)
            if (!raw) return null
            const parsed = JSON.parse(raw) as { endsAt?: number }
            if (!parsed.endsAt) return null

            const remainingMs = parsed.endsAt - Date.now()
            if (remainingMs <= 0) return null

            const totalSeconds = Math.floor(remainingMs / 1000)
            const hours = Math.floor(totalSeconds / 3600)
            const minutes = Math.floor((totalSeconds % 3600) / 60)
            const seconds = totalSeconds % 60

            if (hours > 0) {
                return `Timer ${hours}h ${String(minutes).padStart(2, "0")}m`
            }
            return `Timer ${minutes}:${String(seconds).padStart(2, "0")}`
        } catch {
            return null
        }
    }

    private applyVisuals() {
        const root = this.shadowRoot
        if (!root) return
        const card = root.querySelector(".card") as HTMLElement | null
        const header = root.querySelector(".header") as HTMLElement | null
        if (!card || !header) return

        const isOn = this.visuallyOn
        const accent = isOn ? "rgba(255, 255, 255, 0.25)" : ""
        const accentStyle = accent ? ` style="--toggle-accent:${accent}"` : ""
        const subtitleEl = root.querySelector(".subtitle") as HTMLElement | null
        if (subtitleEl) subtitleEl.textContent = this.buildSubtitle()

        if (isOn) {
            const modeBg = AC_MODE_BACKGROUNDS[this.selectedMode] ?? AC_MODE_BACKGROUNDS.cool
            card.style.setProperty("--card-bg", modeBg)
            card.style.setProperty("--card-text-primary", "var(--active-device-text, #ffffff)")
            card.style.setProperty("--card-text-secondary", "var(--active-device-text-dim, rgba(255,255,255,0.85))")
            card.style.setProperty("--card-icon-fill", "var(--active-device-text, #ffffff)")
        } else {
            card.style.removeProperty("--card-bg")
            card.style.removeProperty("--card-text-primary")
            card.style.removeProperty("--card-text-secondary")
            card.style.removeProperty("--card-icon-fill")
        }

        const existingTs = header.querySelector("toggle-switch") as HTMLElement | null
        if (existingTs) {
            existingTs.setAttribute("checked", String(isOn))
            if (accent) existingTs.setAttribute("accent", accent)
            else existingTs.removeAttribute("accent")
            const iconWrapper = header.querySelector("div") as HTMLElement | null
            if (iconWrapper) iconWrapper.innerHTML = AC_ICON("card-icon")
        } else {
            header.innerHTML = `
                <div style="display:flex;align-items:center">${AC_ICON("card-icon")}</div>
                <toggle-switch checked="${isOn}" accent="${accent}"${accentStyle}></toggle-switch>
            `
            header.querySelector("toggle-switch")?.addEventListener("toggle", (e) => {
                e.stopPropagation()
                this.toggle()
            })
        }

        card.onclick = () => this.openPopup()
    }
}

customElements.define("climate-card", ClimateCard)
