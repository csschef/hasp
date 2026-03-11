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

function miredToColor(mired: number): string {

    const kelvin = 1000000 / mired

    return kelvinToColor(kelvin)

}

function kelvinToColor(kelvin: number): string {

    const temp = kelvin / 100

    let red
    let green
    let blue

    if (temp <= 66) {

        red = 255

        green =
            99.4708025861 * Math.log(temp) -
            161.1195681661

        if (temp <= 19) {

            blue = 0

        } else {

            blue =
                138.5177312231 *
                Math.log(temp - 10) -
                305.0447927307

        }

    } else {

        red =
            329.698727446 *
            Math.pow(temp - 60, -0.1332047592)

        green =
            288.1221695283 *
            Math.pow(temp - 60, -0.0755148492)

        blue = 255

    }

    red = clamp(red)
    green = clamp(green)
    blue = clamp(blue)

    return `rgb(${red},${green},${blue})`

}

function clamp(x: number) {

    return Math.max(0, Math.min(255, Math.round(x)))

}