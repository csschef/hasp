import type { HAEntity } from "../types/homeassistant"

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

function lerpGradient(t: number): [number, number, number] {
    t = Math.max(0, Math.min(1, t))
    for (let i = 0; i < CARD_GRADIENT.length - 1; i++) {
        const left = CARD_GRADIENT[i]
        const right = CARD_GRADIENT[i + 1]
        if (t >= left.pos && t <= right.pos) {
            const s = (t - left.pos) / (right.pos - left.pos)
            return [
                Math.round(left.rgb[0] + s * (right.rgb[0] - left.rgb[0])),
                Math.round(left.rgb[1] + s * (right.rgb[1] - left.rgb[1])),
                Math.round(left.rgb[2] + s * (right.rgb[2] - left.rgb[2])),
            ]
        }
    }
    return t < 0 ? CARD_GRADIENT[0].rgb : CARD_GRADIENT[CARD_GRADIENT.length - 1].rgb
}

/**
 * Returns an {r,g,b} object for the card background.
 * - color_temp mode → gradient-mapped (blue→orange, never white)
 * - rgb mode → original colour mixed 30 % toward white (muted)
 */
export function getCardColor(entity: HAEntity): { r: number; g: number; b: number } | null {

    if (entity.state !== "on") return null

    const attr = entity.attributes

    // RGB / HS color mode → mute 30 % toward white
    if (attr.color_mode !== "color_temp" && attr.rgb_color) {
        const [r, g, b] = attr.rgb_color
        const m = (v: number) => Math.round(v * 0.7 + 255 * 0.3)
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
        const [r, g, b] = lerpGradient(t)
        return { r, g, b }
    }

    // Fallback: light is "on" but reports no colour attributes at all
    // (simple on/off switch, fairy lights, etc.).
    // Use 2700 K — closest to what incandescent/warm-white LEDs actually emit.
    // 2700 K ≈ 370 mireds → t ≈ 0.626 on the gradient → warm amber-white.
    const FALLBACK_MIRED = 1_000_000 / 2700   // ≈ 370.4
    const minMF = 153
    const maxMF = 500
    const tFallback = (FALLBACK_MIRED - minMF) / (maxMF - minMF)
    const [fr, fg, fb] = lerpGradient(tFallback)
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
