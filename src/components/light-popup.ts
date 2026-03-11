import { getEntity, subscribeEntity } from "../store/entity-store"
import { callService } from "../services/ha-service"
import type { HAEntity } from "../types/homeassistant"

class LightPopup extends HTMLElement {
    private shadow: ShadowRoot
    private entityId = ""
    private entity?: HAEntity

    private brightnessTimer: number | null = null
    private tempTimer: number | null = null
    private unsubscribeBoundEntity = ""

    constructor() {
        super()
        this.shadow = this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.render()
    }

    open(entityId: string) {
        this.entityId = entityId
        this.entity = getEntity(entityId)

        this.style.display = "block"

        if (this.unsubscribeBoundEntity !== entityId) {
            this.unsubscribeBoundEntity = entityId

            subscribeEntity(entityId, (entity: HAEntity) => {
                this.entity = entity
                this.update()
            })
        }

        this.update()
    }

    close() {
        this.style.display = "none"
    }

    private debounceBrightness(value: number) {
        if (this.brightnessTimer) {
            window.clearTimeout(this.brightnessTimer)
        }

        this.brightnessTimer = window.setTimeout(() => {
            callService("light", "turn_on", {
                entity_id: this.entityId,
                brightness: value
            })
        }, 80)
    }

    private debounceTempKelvin(value: number) {
        if (this.tempTimer) {
            window.clearTimeout(this.tempTimer)
        }

        this.tempTimer = window.setTimeout(() => {
            callService("light", "turn_on", {
                entity_id: this.entityId,
                color_temp_kelvin: value
            })
        }, 80)
    }

    private setXYColor(x: number, y: number) {
        callService("light", "turn_on", {
            entity_id: this.entityId,
            xy_color: [x, y]
        })
    }

    private supportsBrightness(attr: Record<string, any>) {
        return attr.brightness !== undefined
    }

    private supportsTemperature(attr: Record<string, any>) {
        const modes: string[] = attr.supported_color_modes || []
        return modes.includes("color_temp")
    }

    private supportsColor(attr: Record<string, any>) {
        const modes: string[] = attr.supported_color_modes || []
        return modes.includes("xy")
    }

    update() {
        if (!this.entity) return

        const attr = this.entity.attributes
        const name = attr.friendly_name ?? this.entityId

        const supportsBrightness = this.supportsBrightness(attr)
        const supportsTemp = this.supportsTemperature(attr)
        const supportsColor = this.supportsColor(attr)

        const brightness = attr.brightness ?? 255
        const kelvin =
            attr.color_temp_kelvin ??
            (attr.color_temp ? Math.round(1000000 / attr.color_temp) : null)

        const minKelvin = attr.min_color_temp_kelvin ?? 2000
        const maxKelvin = attr.max_color_temp_kelvin ?? 6500

        const xy: [number, number] | null = Array.isArray(attr.xy_color)
            ? [attr.xy_color[0], attr.xy_color[1]]
            : null

        const title = this.shadow.querySelector(".title") as HTMLElement
        const controls = this.shadow.querySelector(".controls") as HTMLElement

        title.textContent = name
        controls.innerHTML = ""

        if (supportsBrightness) {
            controls.innerHTML += `
        <section class="control-section">
          <div class="label-row">
            <label>Ljusstyrka</label>
            <span class="value">${Math.round((brightness / 255) * 100)}%</span>
          </div>
          <input
            type="range"
            min="1"
            max="255"
            value="${brightness}"
            class="slider brightness"
          />
        </section>
      `
        }

        if (supportsTemp && kelvin) {
            controls.innerHTML += `
        <section class="control-section">
          <div class="label-row">
            <label>Temperatur</label>
            <span class="value">${kelvin}K</span>
          </div>
          <input
            type="range"
            min="${minKelvin}"
            max="${maxKelvin}"
            value="${kelvin}"
            class="slider temperature"
          />
        </section>
      `
        }

        if (supportsColor) {
            controls.innerHTML += `
        <section class="control-section">
          <div class="label-row">
            <label>Färg</label>
          </div>
          <div class="wheel-wrap">
            <div class="color-wheel">
              <div class="wheel-inner"></div>
              <div class="picker"></div>
            </div>
          </div>
        </section>
      `
        }

        const bright = controls.querySelector(".brightness") as HTMLInputElement | null
        const temp = controls.querySelector(".temperature") as HTMLInputElement | null
        const wheel = controls.querySelector(".color-wheel") as HTMLElement | null
        const picker = controls.querySelector(".picker") as HTMLElement | null

        if (bright) {
            const valueLabel = bright
                .closest(".control-section")
                ?.querySelector(".value") as HTMLElement | null

            const updateBrightnessFill = () => {
                const percent = ((Number(bright.value) - 1) / (255 - 1)) * 100
                bright.style.setProperty("--fill", `${percent}%`)
                if (valueLabel) {
                    valueLabel.textContent = `${Math.round((Number(bright.value) / 255) * 100)}%`
                }
            }

            updateBrightnessFill()

            bright.addEventListener("input", () => {
                updateBrightnessFill()
                this.debounceBrightness(Number(bright.value))
            })
        }

        if (temp) {
            const valueLabel = temp
                .closest(".control-section")
                ?.querySelector(".value") as HTMLElement | null

            const updateTempFill = () => {
                const min = Number(temp.min)
                const max = Number(temp.max)
                const val = Number(temp.value)
                const percent = ((val - min) / (max - min)) * 100
                temp.style.setProperty("--fill", `${percent}%`)
                if (valueLabel) {
                    valueLabel.textContent = `${val}K`
                }
            }

            updateTempFill()

            temp.addEventListener("input", () => {
                updateTempFill()
                this.debounceTempKelvin(Number(temp.value))
            })
        }

        if (wheel && picker) {
            const placePickerFromXY = (x: number, y: number) => {
                const rect = wheel.getBoundingClientRect()
                const size = rect.width
                const cx = size / 2
                const cy = size / 2
                const radius = size / 2

                const dx = (x - 0.5) * 2 * radius
                const dy = (0.5 - y) * 2 * radius

                const px = cx + dx
                const py = cy - dy

                picker.style.left = `${px}px`
                picker.style.top = `${py}px`
            }

            if (xy) {
                placePickerFromXY(xy[0], xy[1])
            } else {
                picker.style.left = "50%"
                picker.style.top = "50%"
            }

            const handleWheelPoint = (clientX: number, clientY: number) => {
                const rect = wheel.getBoundingClientRect()
                const size = rect.width
                const cx = size / 2
                const cy = size / 2
                const radius = size / 2

                let dx = clientX - rect.left - cx
                let dy = clientY - rect.top - cy

                const distance = Math.sqrt(dx * dx + dy * dy)

                if (distance > radius) {
                    const scale = radius / distance
                    dx *= scale
                    dy *= scale
                }

                const px = cx + dx
                const py = cy + dy

                picker.style.left = `${px}px`
                picker.style.top = `${py}px`

                const x = Math.max(0, Math.min(1, 0.5 + dx / (2 * radius)))
                const y = Math.max(0, Math.min(1, 0.5 - dy / (2 * radius)))

                this.setXYColor(Number(x.toFixed(4)), Number(y.toFixed(4)))
            }

            wheel.onpointerdown = (e: PointerEvent) => {
                e.preventDefault()
                handleWheelPoint(e.clientX, e.clientY)

                const move = (ev: PointerEvent) => {
                    handleWheelPoint(ev.clientX, ev.clientY)
                }

                const up = () => {
                    window.removeEventListener("pointermove", move)
                    window.removeEventListener("pointerup", up)
                }

                window.addEventListener("pointermove", move)
                window.addEventListener("pointerup", up)
            }
        }
    }

    render() {
        this.shadow.innerHTML = `
      <style>
        :host {
          position: fixed;
          inset: 0;
          display: none;
          background: rgba(0, 0, 0, 0.56);
          backdrop-filter: blur(10px);
          z-index: 1000;
        }

        .sheet {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--color-card);
          border-radius: 28px 28px 0 0;
          padding: 20px 20px 28px;
          box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.35);
        }

        .grabber {
          width: 42px;
          height: 5px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.15);
          margin: 0 auto 16px;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .title {
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .close {
          appearance: none;
          border: 0;
          background: transparent;
          color: var(--text-primary);
          font-size: 1.8rem;
          line-height: 1;
          cursor: pointer;
          padding: 0;
        }

        .controls {
          margin-top: 22px;
          display: flex;
          flex-direction: column;
          gap: 26px;
        }

        .control-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        label {
          color: var(--text-primary);
          font-size: 1rem;
          font-weight: 600;
        }

        .value {
          color: var(--text-secondary);
          font-size: 0.95rem;
        }

        .slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 18px;
          border-radius: 999px;
          outline: none;
          background:
            linear-gradient(to right,
              var(--track-fill-start),
              var(--track-fill-end)
            ) 0 / var(--fill, 50%) 100% no-repeat,
            rgba(255,255,255,0.14);
        }

        .brightness {
          --track-fill-start: #f5d000;
          --track-fill-end: #ffd84d;
        }

        .temperature {
          --track-fill-start: #6cb2ff;
          --track-fill-end: #ff9a1f;
        }

        .slider::-webkit-slider-runnable-track {
          height: 18px;
          background: transparent;
          border-radius: 999px;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid rgba(0,0,0,0.28);
          background: #fff;
          box-shadow: 0 2px 10px rgba(0,0,0,0.25);
          margin-top: -2px;
          cursor: pointer;
        }

        .slider::-moz-range-track {
          height: 18px;
          background: transparent;
          border-radius: 999px;
        }

        .slider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid rgba(0,0,0,0.28);
          background: #fff;
          box-shadow: 0 2px 10px rgba(0,0,0,0.25);
          cursor: pointer;
        }

        .wheel-wrap {
          display: flex;
          justify-content: center;
          padding-top: 4px;
        }

        .color-wheel {
          position: relative;
          width: 230px;
          height: 230px;
          border-radius: 50%;
          background: conic-gradient(
            red,
            yellow,
            lime,
            cyan,
            blue,
            magenta,
            red
          );
          overflow: hidden;
          cursor: crosshair;
        }

        .wheel-inner {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background:
            radial-gradient(circle at center,
              rgba(255,255,255,0.95) 0%,
              rgba(255,255,255,0) 58%
            );
          mix-blend-mode: screen;
          pointer-events: none;
        }

        .picker {
          position: absolute;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid rgba(0,0,0,0.55);
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
      </style>

      <div class="sheet">
        <div class="grabber"></div>

        <div class="header">
          <div class="title"></div>
          <button class="close" aria-label="Stäng">×</button>
        </div>

        <div class="controls"></div>
      </div>
    `

        const host = this.shadow.host
        const sheet = this.shadow.querySelector(".sheet") as HTMLElement
        const closeBtn = this.shadow.querySelector(".close") as HTMLElement

        sheet.addEventListener("click", (e) => {
            e.stopPropagation()
        })

        host.addEventListener("click", (e) => {
            if (e.target === host) {
                this.close()
            }
        })

        closeBtn.addEventListener("click", () => {
            this.close()
        })
    }
}

customElements.define("light-popup", LightPopup)