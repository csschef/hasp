import type { HAEntity } from "../types/homeassistant"
import { getEntity } from "../store/entity-store"

export function getLightColor(entity: HAEntity): string | null {

    const attr = entity.attributes

    if (attr.rgb_color) {
        const [r, g, b] = attr.rgb_color
        return `rgb(${r},${g},${b})`
    }

    if (attr.color_temp_kelvin) {
        return kelvinToColor(attr.color_temp_kelvin)
    }

    if (attr.color_temp) {
        return miredToColor(attr.color_temp)
    }

    return null
}

/* ── Card-specific colour (muted / gradient-mapped) ────────────── */

// 5-stop gradient: blue → light blue → warm beige → amber → deep orange
// NO white — the middle stop is a warm beige, not white.
const CARD_GRADIENT: { pos: number; rgb: [number, number, number] }[] = [
    { pos: 0.00, rgb: [120, 180, 240] },   // cool blue
    { pos: 0.25, rgb: [150, 200, 255] },   // light blue
    { pos: 0.50, rgb: [240, 215, 160] },   // warm beige (not white!)
    { pos: 0.75, rgb: [255, 180, 60] },    // amber
    { pos: 1.00, rgb: [255, 130, 20] },    // deep orange
]

const IOS_TEMP_GRADIENT: { pos: number; rgb: [number, number, number] }[] = [
    { pos: 0.00, rgb: [60, 140, 255] },    // deep cool blue
    { pos: 0.25, rgb: [100, 180, 255] },   // vibrant light blue
    { pos: 0.50, rgb: [255, 200, 100] },   // warm yellow/orange (instead of beige)
    { pos: 0.75, rgb: [255, 140, 0] },     // intense amber
    { pos: 1.00, rgb: [255, 69, 0] },      // burning orange
]

function lerpGradient(t: number, isIos: boolean = false): [number, number, number] {
    t = Math.max(0, Math.min(1, t))
    const grad = isIos ? IOS_TEMP_GRADIENT : CARD_GRADIENT
    for (let i = 0; i < grad.length - 1; i++) {
        const left = grad[i]
        const right = grad[i + 1]
        if (t >= left.pos && t <= right.pos) {
            const s = (t - left.pos) / (right.pos - left.pos)
            return [
                Math.round(left.rgb[0] + s * (right.rgb[0] - left.rgb[0])),
                Math.round(left.rgb[1] + s * (right.rgb[1] - left.rgb[1])),
                Math.round(left.rgb[2] + s * (right.rgb[2] - left.rgb[2])),
            ]
        }
    }
    return t < 0 ? grad[0].rgb : grad[grad.length - 1].rgb
}

/**
 * Returns an {r,g,b} object for the card background.
 * - color_temp mode → gradient-mapped (blue→orange, never white)
 * - rgb mode → original colour mixed 30 % toward white (muted)
 */
export function getCardColor(entity: HAEntity): { r: number; g: number; b: number } | null {

    if (entity.state !== "on") return null

    const attr = entity.attributes

    // RGB / HS color mode → mute toward white, unless iOS theme
    if (attr.color_mode !== "color_temp" && attr.rgb_color) {
        const [r, g, b] = attr.rgb_color
        const isIos = document.documentElement.getAttribute("data-theme-color") === "ios"
        const m = isIos 
            ? (v: number) => v // 100% Raw color from Home Assistant
            : (v: number) => Math.round(v * 0.7 + 255 * 0.3)   // Classic faded Nordic standard
        return { r: m(r), g: m(g), b: m(b) }
    }

    // Color temp mode → gradient lookup by mired position
    let mired = attr.color_temp as number | undefined
    if (mired === undefined && attr.color_temp_kelvin) {
        mired = 1000000 / attr.color_temp_kelvin
    }
    if (mired !== undefined) {
        // We establish a strictly absolute 6535K to 2000K continuum (153 - 500 mireds) 
        // to mathematically ensure that different bulbs programmed to 4000K don't return 
        // entirely different shades of blue merely because their proprietary min/max bounds differ.
        const minM = 153
        const maxM = 500
        const t = (mired - minM) / (maxM - minM)
        const isIos = document.documentElement.getAttribute("data-theme-color") === "ios"
        const [r, g, b] = lerpGradient(t, isIos)
        return { r, g, b }
    }

    // ── Fallback guard ────────────────────────────────────────────────────────
    // Determine if this light (or group) is truly on/off-only, or if it has
    // colour capability that just hasn't been reported yet.
    const COLOR_MODES = ["color_temp", "xy", "rgb", "rgbw", "rgbww", "hs"]

    // For group entities, check the children to decide if we should wait for color data
    // or fall back to the "orange" ON/OFF color.
    const childIds: string[] | undefined = attr.entity_id
    if (childIds && childIds.length > 0) {
        let anyPotentialChildHasColor = false
        let allChildrenOff = true

        for (const childId of childIds) {
            const child = getEntity(childId)
            const childModes: string[] = child?.attributes?.supported_color_modes || []
            if (childModes.some((m: string) => COLOR_MODES.includes(m))) {
                anyPotentialChildHasColor = true
            }
            if (child && child.state === "on") {
                allChildrenOff = false
            }
        }

        // If it's a mixed/color group and we just turned it ON (optimistic, children still OFF)
        // then stay neutral/white while we wait for the color data to arrive.
        if (anyPotentialChildHasColor && allChildrenOff) return null

        // If it's a mixed/color group and we are settled (some children ON), but 
        // haven't found a mired/rgb yet, continue checking.
        if (anyPotentialChildHasColor) {
            // Check if any of the ACTUALLY ON children support color.
            // If they do, we should wait for their HA attributes.
            const anyActiveChildHasColor = childIds.some(id => {
                const c = getEntity(id)
                if (c?.state !== "on") return false
                return (c.attributes?.supported_color_modes || []).some((m: string) => COLOR_MODES.includes(m))
            })
            if (anyActiveChildHasColor) return null
        }
    } else {
        // Individual light — check its own supported_color_modes
        const supportedModes: string[] = attr.supported_color_modes || []
        if (supportedModes.some((m: string) => COLOR_MODES.includes(m))) {
            return null  // color-capable light — wait for real HA data
        }
    }

    // Truly on/off-only light or simple on/off group.
    // 2700 K ≈ 370 mireds → t ≈ 0.626 → warm amber/orange area on the gradient.
    const FALLBACK_MIRED = 1_000_000 / 2700
    const minMF = 153
    const maxMF = 500
    const tFallback = (FALLBACK_MIRED - minMF) / (maxMF - minMF)
    const isIosFallback = document.documentElement.getAttribute("data-theme-color") === "ios"
    const [fr, fg, fb] = lerpGradient(tFallback, isIosFallback)
    return { r: fr, g: fg, b: fb }
}

/* ── Internals ─────────────────────────────────────────────────── */

function miredToColor(mired: number): string {
    const kelvin = 1000000 / mired
    return kelvinToColor(kelvin)
}

function kelvinToColor(kelvin: number): string {

    const temp = kelvin / 100

    let red, green, blue

    if (temp <= 66) {
        red = 255
        green = 99.4708025861 * Math.log(temp) - 161.1195681661
        blue = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307
    } else {
        red = 329.698727446 * Math.pow(temp - 60, -0.1332047592)
        green = 288.1221695283 * Math.pow(temp - 60, -0.0755148492)
        blue = 255
    }

    return `rgb(${clamp(red)},${clamp(green)},${clamp(blue)})`
}

function clamp(x: number) {
    return Math.max(0, Math.min(255, Math.round(x)))
}
