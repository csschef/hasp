import { setEntity, setEntities, setCurrentUser } from "../store/entity-store"
import { registerSocket } from "./ha-service"

// Detect HA_URL dynamically. If running inside HA (as /local/ or via UI), 
// we use the current browser's origin. This fixed the Companion App issue 
// where the app might be using a public/internal URL different from the dev env.
const rawUrl = import.meta.env.VITE_HA_URL
export const HA_URL = (window.location.port === "5173" || window.location.port === "5174")
    ? rawUrl 
    : window.location.origin

const HA_TOKEN = import.meta.env.VITE_HA_TOKEN

let socket: WebSocket | null = null
let messageId = 1

function nextId() {
    return messageId++
}

export function connectHA() {
    const wsUrl = HA_URL
        .replace("https://", "wss://")
        .replace("http://", "ws://") + "/api/websocket"

    console.log("Connecting to HA:", wsUrl)

    socket = new WebSocket(wsUrl)

    registerSocket(socket)

    socket.onopen = () => {
        console.log("WebSocket opened")
    }

    socket.onmessage = (event) => {
        const msg = JSON.parse(event.data)

        if (msg.type === "auth_required") {
            socket?.send(
                JSON.stringify({
                    type: "auth",
                    access_token: HA_TOKEN
                })
            )
            return
        }

        if (msg.type === "auth_ok") {
            console.log("Authenticated with Home Assistant")

            subscribeStateChanges()
            getStates()
            
            // Fetch current user
            socket?.send(JSON.stringify({
                id: nextId(),
                type: "config/get_user"
            }))

            return
        }

        if (msg.type === "result" && msg.id && msg.success && msg.result?.name) {
            // Check if this looks like a user result
            if (msg.result.id && typeof msg.result.is_admin === "boolean") {
                setCurrentUser(msg.result)
                console.log("Logged in as:", msg.result.name)
            }
        }

        if (msg.type === "event" && msg.event?.event_type === "state_changed") {
            const entity = msg.event.data.new_state
            if (entity) {
                setEntity(entity)
            }
            return
        }

        if (msg.type === "event" && msg.event?.event_type === "entity_registry_updated") {
            console.log("HA Registry Updated - Fetching fresh states!")
            getStates()
            return
        }

        if (msg.type === "result" && Array.isArray(msg.result)) {
            console.log("Received all states:", msg.result.length)

            // Helpful Debugger: Search for what HA is actually naming the lights
            const lights = msg.result.filter((r: any) => r.entity_id.startsWith("light.hobbyrum"))
            console.log("Available Hobbyrum Lights in HA:", lights.map((l: any) => l.entity_id))

            setEntities(msg.result)

            return
        }
    }

    socket.onerror = (err) => {
        console.error("WebSocket error", err)
    }

    socket.onclose = () => {
        console.log("WebSocket closed. Reconnecting in 3 seconds...")
        setTimeout(() => connectHA(), 3000)
    }
}

function subscribeStateChanges() {
    socket?.send(
        JSON.stringify({
            id: nextId(),
            type: "subscribe_events",
            event_type: "state_changed"
        })
    )

    // Listen to entity registry updates as well. If the user adds a brand new device
    // in Home Assistant, this event drops immediately, prompting us to fetch fresh states!
    socket?.send(
        JSON.stringify({
            id: nextId(),
            type: "subscribe_events",
            event_type: "entity_registry_updated"
        })
    )

    console.log("Subscribed to HA events")
}

function getStates() {
    socket?.send(
        JSON.stringify({
            id: nextId(),
            type: "get_states"
        })
    )

    console.log("Requesting all entity states")
}