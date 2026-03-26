import { callService } from "./ha-service"

export type ACAcMode = "cool" | "heat" | "dry"
export type ACFanMode = "auto" | "low" | "mid" | "high"

export interface ACCommandSettings {
    mode: ACAcMode
    fan: ACFanMode
    temperature: number
}

export interface ACUiState {
    powerOn: boolean
    mode: ACAcMode
    fan: ACFanMode
    temperature: number
}

export interface ACModeState {
    fan: ACFanMode
    temperature: number
}

const DEFAULT_CLIMATE_ENTITY_ID = "climate.panasonic_ac"
const BROADLINK_REMOTE_ENTITY_ID = "remote.broadlink_remote"
const PANASONIC_IR_CODES_URL = "ir_codes/panasonic_cs_nz35yke.json"
const BROADLINK_DELAY_SECONDS = 0.2
const UI_STATE_KEY = "ac-ui-state:v1"
export const AC_UI_STATE_CHANGED_EVENT = "ac-ui-state-changed"

interface PanasonicCommandTree {
    [key: string]: string | PanasonicCommandTree
}

let panasonicCommandTreePromise: Promise<PanasonicCommandTree> | null = null

function clampTemp(temp: number): number {
    const roundedToHalf = Math.round(temp * 2) / 2
    return Math.max(16, Math.min(30, roundedToHalf))
}

function toClimateFanMode(fan: ACFanMode): "auto" | "low" | "medium" | "high" {
    if (fan === "mid") return "medium"
    return fan
}

function toPanasonicFanKey(fan: ACFanMode): "auto" | "low" | "medium" | "high" {
    return toClimateFanMode(fan)
}

function toTemperatureKey(temp: number): string {
    return Number.isInteger(temp) ? String(temp) : temp.toFixed(1)
}

function getDefaultUiState(): ACUiState {
    return {
        powerOn: false,
        mode: "cool",
        fan: "auto",
        temperature: 20
    }
}

function getDefaultModeState(): ACModeState {
    return {
        fan: "auto",
        temperature: 20
    }
}

function modeStateKey(mode: ACAcMode): string {
    return `${UI_STATE_KEY}:${mode}`
}

export function getAcModeState(mode: ACAcMode): ACModeState {
    try {
        const raw = localStorage.getItem(modeStateKey(mode))
        if (!raw) return getDefaultModeState()
        const parsed = JSON.parse(raw) as Partial<ACModeState>
        return {
            fan: normalizeFan(parsed.fan),
            temperature: normalizeTemp(Number(parsed.temperature) || 20)
        }
    } catch {
        return getDefaultModeState()
    }
}

export function setAcModeState(mode: ACAcMode, patch: Partial<ACModeState>): ACModeState {
    const next: ACModeState = {
        ...getAcModeState(mode),
        ...patch
    }
    next.fan = normalizeFan(next.fan)
    next.temperature = normalizeTemp(next.temperature)
    try {
        localStorage.setItem(modeStateKey(mode), JSON.stringify(next))
    } catch {
        // Ignore storage write failures (private mode, quota, etc)
    }
    return next
}

export function getAcUiState(): ACUiState {
    try {
        const raw = localStorage.getItem(UI_STATE_KEY)
        if (!raw) return getDefaultUiState()
        const parsed = JSON.parse(raw) as Partial<ACUiState>
        return {
            powerOn: Boolean(parsed.powerOn),
            mode: normalizeMode(parsed.mode),
            fan: normalizeFan(parsed.fan),
            temperature: normalizeTemp(Number(parsed.temperature) || 20)
        }
    } catch {
        return getDefaultUiState()
    }
}

export function setAcUiState(patch: Partial<ACUiState>): ACUiState {
    const next: ACUiState = {
        ...getAcUiState(),
        ...patch
    }
    next.mode = normalizeMode(next.mode)
    next.fan = normalizeFan(next.fan)
    next.temperature = normalizeTemp(next.temperature)
    next.powerOn = Boolean(next.powerOn)
    try {
        localStorage.setItem(UI_STATE_KEY, JSON.stringify(next))
        setAcModeState(next.mode, {
            fan: next.fan,
            temperature: next.temperature
        })
    } catch {
        // Ignore storage write failures (private mode, quota, etc)
    }

    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent<ACUiState>(AC_UI_STATE_CHANGED_EVENT, {
            detail: next
        }))
    }

    return next
}

export function normalizeTemp(temp: number): number {
    return clampTemp(temp)
}

export function normalizeMode(mode: string | undefined): ACAcMode {
    if (mode === "heat" || mode === "dry") return mode
    return "cool"
}

export function normalizeFan(fan: string | undefined): ACFanMode {
    if (fan === "low" || fan === "mid" || fan === "high") return fan
    if (fan === "medium") return "mid"
    return "auto"
}

async function getPanasonicCommandTree(): Promise<PanasonicCommandTree> {
    if (!panasonicCommandTreePromise) {
        panasonicCommandTreePromise = fetch(PANASONIC_IR_CODES_URL)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load Panasonic IR codes (${response.status})`)
                }
                return response.json() as Promise<{ commands?: PanasonicCommandTree }>
            })
            .then((payload) => {
                if (!payload.commands || typeof payload.commands !== "object") {
                    throw new Error("Panasonic IR code file is missing a valid commands map")
                }
                return payload.commands
            })
    }
    return panasonicCommandTreePromise
}

function ensureStringCommand(command: string | PanasonicCommandTree | undefined, key: string): string {
    if (typeof command !== "string" || command.length === 0) {
        throw new Error(`Missing Panasonic IR command for '${key}'`)
    }
    return command
}

async function sendBroadlinkCommand(command: string): Promise<void> {
    const payload = command.startsWith("b64:") ? command : `b64:${command}`
    await callService("remote", "send_command", {
        entity_id: BROADLINK_REMOTE_ENTITY_ID,
        command: payload,
        num_repeats: 1,
        delay_secs: BROADLINK_DELAY_SECONDS
    })
}

async function getStateCommand(settings: ACCommandSettings): Promise<string> {
    const normalizedTemp = normalizeTemp(settings.temperature)
    const normalizedMode = normalizeMode(settings.mode)
    const normalizedFan = normalizeFan(settings.fan)
    const fanKey = toPanasonicFanKey(normalizedFan)
    const tempKey = toTemperatureKey(normalizedTemp)

    const commands = await getPanasonicCommandTree()
    const modeCommands = commands[normalizedMode] as PanasonicCommandTree | undefined
    const fanCommands = modeCommands?.[fanKey] as PanasonicCommandTree | undefined
    return ensureStringCommand(fanCommands?.[tempKey], `${normalizedMode}.${fanKey}.${tempKey}`)
}

export async function sendAcPower(on: boolean, _entityId: string = DEFAULT_CLIMATE_ENTITY_ID): Promise<void> {
    const commands = await getPanasonicCommandTree()
    const powerCommand = ensureStringCommand(commands[on ? "on" : "off"], on ? "on" : "off")
    await sendBroadlinkCommand(powerCommand)
    setAcUiState({ powerOn: on })
}

export async function sendAcSettings(
    settings: ACCommandSettings,
    _entityId: string = DEFAULT_CLIMATE_ENTITY_ID
): Promise<void> {
    const normalizedTemp = normalizeTemp(settings.temperature)
    const normalizedMode = normalizeMode(settings.mode)
    const normalizedFan = normalizeFan(settings.fan)

    const command = await getStateCommand({
        mode: normalizedMode,
        fan: normalizedFan,
        temperature: normalizedTemp
    })
    await sendBroadlinkCommand(command)

    setAcUiState({
        powerOn: true,
        mode: normalizedMode,
        fan: normalizedFan,
        temperature: normalizedTemp
    })
}
