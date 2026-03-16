import { getEntity, subscribeEntity } from "../store/entity-store"
import { callService } from "../services/ha-service"
import type { HAEntity } from "../types/homeassistant"

class LightPopup extends HTMLElement {

    private shadow: ShadowRoot
    private entityId = ""
    private entity?: HAEntity

    private brightnessTimer: number | null = null
    private tempTimer: number | null = null
    private colorTimer: number | null = null
    private isDragging = false
    private tempInitRaf = 0  // rAF ID for initial thumb placement

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
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.classList.add("active")
            })
        })
        window.history.pushState({ type: "popup", id: "lightPopup" }, "")

        subscribeEntity(entityId, (e: HAEntity) => {
            this.entity = e
            this.update()
        })

        this.update()
    }

    close(fromHistory = false) {
        this.classList.remove("active")
        if (!fromHistory && window.history.state?.type === "popup" && window.history.state?.id === "lightPopup") {
            window.history.back()
        }
        setTimeout(() => {
            this.style.display = "none"
        }, 300)
    }

    /* ---------- services ---------- */

    private setBrightness(v: number) {

        if (this.brightnessTimer) clearTimeout(this.brightnessTimer)

        this.brightnessTimer = window.setTimeout(() => {

            callService("light", "turn_on", {
                entity_id: this.entityId,
                brightness: v
            })

        }, 60)
    }

    private setTempKelvin(v: number) {

        if (this.tempTimer) clearTimeout(this.tempTimer)

        this.tempTimer = window.setTimeout(() => {

            callService("light", "turn_on", {
                entity_id: this.entityId,
                color_temp_kelvin: v
            })

        }, 60)
    }

    private setHsColor(h: number, s: number) {

        if (this.colorTimer) clearTimeout(this.colorTimer)

        this.colorTimer = window.setTimeout(() => {

            callService("light", "turn_on", {
                entity_id: this.entityId,
                hs_color: [Math.round(h), Math.round(s)]
            })

        }, 80)

    }

    private clamp(v: number, min: number, max: number) {
        return Math.max(min, Math.min(max, v))
    }

    /* ---------- update ---------- */

    update() {

        if (!this.entity) return
        if (this.isDragging) return

        const attr = this.entity.attributes

        const title = this.shadow.querySelector(".title") as HTMLElement
        const controls = this.shadow.querySelector(".controls") as HTMLElement

        const name = attr.friendly_name ?? this.entityId
        const brightness = attr.brightness ?? 255

        const kelvin = attr.color_temp_kelvin ?? 3000
        const minK = attr.min_color_temp_kelvin ?? 2000
        const maxK = attr.max_color_temp_kelvin ?? 6500

        const hs: [number, number] = Array.isArray(attr.hs_color)
            ? [Number(attr.hs_color[0]), Number(attr.hs_color[1])]
            : [0, 100]

        title.textContent = name

        const supported = attr.supported_color_modes

        const hasBrightness = supported
            ? supported.some((m: string) => ["brightness", "color_temp", "hs", "xy", "rgb", "rgbw", "rgbww"].includes(m))
            : attr.brightness !== undefined

        const hasTemp = supported
            ? supported.includes("color_temp")
            : (attr.color_temp_kelvin !== undefined || attr.color_temp !== undefined)

        const hasColor = supported
            ? supported.some((m: string) => ["hs", "xy", "rgb", "rgbw", "rgbww"].includes(m))
            : (attr.hs_color !== undefined || attr.rgb_color !== undefined)

        let html = ""

        if (hasBrightness) {
            html += `
<div class="control">
<div class="label-row">
<label>Ljusstyrka</label>
<span class="value">${Math.round((brightness / 255) * 100)}%</span>
</div>
<div class="bright-slider"><div class="bright-thumb"></div></div>
</div>
`
        }

        if (hasTemp) {
            html += `
<div class="control">
<div class="label-row">
<label>Temperatur</label>
<span class="value">${kelvin}K</span>
</div>

<div class="temp-slider"><div class="temp-thumb"></div></div>
</div>
`
        }

        if (hasColor) {
            html += `
<div class="control">

<label>Färg</label>

<div class="wheel-wrap">
<div class="color-wheel">
<div class="wheel-white"></div>
<div class="picker"></div>
</div>
</div>

</div>
`
        }

        controls.innerHTML = html

        /* ---------- brightness (custom div slider) ---------- */

        const brightSlider = controls.querySelector(".bright-slider") as HTMLElement | null
        const brightThumb = controls.querySelector(".bright-thumb") as HTMLElement | null

        if (brightSlider && brightThumb) {
            const thumbR = 12 // half of 24px thumb
            requestAnimationFrame(() => {
                const w = brightSlider.offsetWidth
                const frac = (brightness - 1) / (255 - 1)
                brightThumb.style.left = Math.max(thumbR, Math.min(w - thumbR, frac * w)) + "px"
            })

            const doBrightMove = (offsetX: number) => {
                const w = brightSlider.offsetWidth
                const frac = Math.max(0, Math.min(1, offsetX / w))
                brightThumb.style.left = Math.max(thumbR, Math.min(w - thumbR, frac * w)) + "px"
                const v = Math.round(1 + frac * 254)
                brightSlider.closest(".control")!.querySelector(".value")!.textContent = Math.round((v / 255) * 100) + "%"
                this.setBrightness(v)
            }

            brightSlider.onpointerdown = (e) => {
                this.isDragging = true
                e.preventDefault()
                brightSlider.setPointerCapture(e.pointerId)
                doBrightMove(e.offsetX)
                brightSlider.onpointermove = (ev) => doBrightMove(ev.offsetX)
                brightSlider.onpointerup = () => {
                    brightSlider.onpointermove = null
                    brightSlider.onpointerup = null
                    window.setTimeout(() => { this.isDragging = false }, 350)
                }
            }
        }

        /* ---------- temperature (custom div slider) ---------- */

        const tempSlider = controls.querySelector(".temp-slider") as HTMLElement | null
        const tempThumb = controls.querySelector(".temp-thumb") as HTMLElement | null

        if (tempSlider && tempThumb) {
            const thumbR = 12
            cancelAnimationFrame(this.tempInitRaf)
            this.tempInitRaf = requestAnimationFrame(() => {
                this.tempInitRaf = 0
                const w = tempSlider.offsetWidth
                const frac = (maxK - kelvin) / (maxK - minK)
                tempThumb.style.left = Math.max(thumbR, Math.min(w - thumbR, frac * w)) + "px"
            })

            const doTempMove = (offsetX: number) => {
                const w = tempSlider.offsetWidth
                const frac = Math.max(0, Math.min(1, offsetX / w))
                tempThumb.style.left = Math.max(thumbR, Math.min(w - thumbR, frac * w)) + "px"
                const k = Math.round(maxK - frac * (maxK - minK))
                tempSlider.closest(".control")!.querySelector(".value")!.textContent = k + "K"
                this.setTempKelvin(k)
            }

            tempSlider.onpointerdown = (e) => {
                cancelAnimationFrame(this.tempInitRaf)
                this.tempInitRaf = 0
                this.isDragging = true
                e.preventDefault()
                tempSlider.setPointerCapture(e.pointerId)
                doTempMove(e.offsetX)
                tempSlider.onpointermove = (ev) => doTempMove(ev.offsetX)
                tempSlider.onpointerup = () => {
                    tempSlider.onpointermove = null
                    tempSlider.onpointerup = null
                    window.setTimeout(() => { this.isDragging = false }, 350)
                }
            }
        }

        /* ---------- color wheel ---------- */

        const wheel = controls.querySelector(".color-wheel") as HTMLElement | null
        const picker = controls.querySelector(".picker") as HTMLElement | null

        if (wheel && picker) {
            requestAnimationFrame(() => {
                const size = wheel.offsetWidth
                const radius = size / 2
                const dist = (hs[1] / 100) * radius
                const rad = (hs[0] - 90) * Math.PI / 180
                picker.style.left = (radius + Math.cos(rad) * dist) + "px"
                picker.style.top = (radius + Math.sin(rad) * dist) + "px"
            })

            const handleWheelPointer = (ox: number, oy: number) => {
                const size = wheel.offsetWidth
                const radius = size / 2
                let dx = ox - radius
                let dy = oy - radius
                const d = Math.sqrt(dx * dx + dy * dy)
                if (d > radius) {
                    const s = radius / d
                    dx *= s
                    dy *= s
                }
                const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 450) % 360
                const sat = this.clamp((Math.sqrt(dx * dx + dy * dy) / radius) * 100, 0, 100)
                picker.style.left = (radius + dx) + "px"
                picker.style.top = (radius + dy) + "px"
                this.setHsColor(hue, sat)
            }

            wheel.onpointerdown = e => {
                this.isDragging = true
                e.preventDefault()
                wheel.setPointerCapture(e.pointerId)
                handleWheelPointer(e.offsetX, e.offsetY)

                wheel.onpointermove = (ev) => handleWheelPointer(ev.offsetX, ev.offsetY)
                wheel.onpointerup = () => {
                    wheel.onpointermove = null
                    wheel.onpointerup = null
                    window.setTimeout(() => { this.isDragging = false }, 350)
                }
            }
        }

    }

    render() {

        this.shadow.innerHTML = `

<style>

:host{
position:fixed;
inset:0;
display:none;
background: rgba(0,0,0,0.3);
backdrop-filter:blur(20px);
-webkit-backdrop-filter:blur(20px);
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
background:var(--color-card);
border-radius:var(--radius-xl);
padding:24px;
border: 1px solid var(--border-color);
box-shadow: 0 24px 64px rgba(0,0,0,0.2);
max-height:calc(100dvh - 80px);
overflow-y:auto;
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
margin-bottom: 4px;
}

.title{
font-size: 1rem;
font-weight: 500;
letter-spacing: -0.01em;
color:var(--text-primary);
}

.close{
width: 28px;
height: 28px;
border-radius: 50%;
background: var(--color-card-alt);
border: 1px solid var(--border-color);
display: flex;
align-items: center;
justify-content: center;
cursor:pointer;
color: var(--text-secondary);
font-size: 1rem;
line-height: 1;
transition: background 0.15s ease;
}
.close:active { background: var(--border-color); }

.controls{
margin-top:24px;
display:flex;
flex-direction:column;
gap:24px;
}

.control{
display:flex;
flex-direction:column;
gap:10px;
}

.label-row{
display:flex;
justify-content:space-between;
align-items:center;
}

label{
font-weight:400;
color:var(--text-secondary);
letter-spacing: 0.01em;
text-transform: uppercase;
font-size: 0.6875rem;
opacity: 0.7;
}

.value{
font-size: 0.8125rem;
font-weight: 500;
color:var(--text-primary);
}

/* ── Sliders ──────────────────────────────── */

.bright-slider,
.temp-slider{
position:relative;
height:30px;
border-radius:999px;
cursor:pointer;
touch-action:none;
user-select:none;
-webkit-user-select:none;
}

.bright-slider{
background:linear-gradient(to right,#e8920a,#ffeaa0);
}

.temp-slider{
background:linear-gradient(to right,#5ea8ff,#e0e0e0,#ff9c3a);
}

.bright-thumb,
.temp-thumb{
position:absolute;
top:50%;
width:24px;
height:24px;
border-radius:50%;
background:white;
border:1.5px solid rgba(0,0,0,0.2);
box-shadow:0 2px 8px rgba(0,0,0,0.25);
transform:translate(-50%,-50%);
pointer-events:none;
will-change:left;
}

.wheel-wrap{
display:flex;
justify-content:center;
}

.color-wheel{
position:relative;
width:220px;
height:220px;
border-radius:50%;
background:conic-gradient(
red,
yellow,
lime,
cyan,
blue,
magenta,
red
);
cursor:crosshair;
}

.wheel-white{
position:absolute;
inset:0;
border-radius:50%;
background:radial-gradient(
circle at center,
white 0%,
rgba(255,255,255,0.75) 20%,
rgba(255,255,255,0) 68%
);
pointer-events:none;
}

.picker{
position:absolute;
width:16px;
height:16px;
border-radius:50%;
background:white;
border:1.5px solid rgba(0,0,0,0.3);
box-shadow:0 2px 8px rgba(0,0,0,0.3);
transform:translate(-50%,-50%);
pointer-events:none;
}

</style>

<div class="sheet">

<div class="header">
<div class="title"></div>
<div class="close"><iconify-icon icon="lucide:x" style="font-size:0.875rem;"></iconify-icon></div>
</div>

<div class="controls"></div>

</div>
`


        const host = this.shadow.host as HTMLElement
        const sheet = this.shadow.querySelector(".sheet") as HTMLElement
        const close = this.shadow.querySelector(".close") as HTMLElement

        sheet.onclick = (e: MouseEvent) => e.stopPropagation()

        host.onclick = (e: MouseEvent) => {
            if (e.target === host) this.close()
        }

        close.onclick = () => this.close()
    }
}

customElements.define("light-popup", LightPopup)