import { setEntity, setEntities, setCurrentUser } from "../store/entity-store"
import { registerSocket } from "./ha-service"

// Detect HA_URL dynamically. If running inside HA (as /local/ or via UI), 
// we use the current browser's origin. This fixed the Companion App issue 
// where the app might be using a public/internal URL different from the dev env.
const rawUrl = import.meta.env.VITE_HA_URL
const port = parseInt(window.location.port)
export const HA_URL = (port >= 5173 && port <= 5179)
    ? rawUrl 
    : window.location.origin

export const HA_TOKEN = import.meta.env.VITE_HA_TOKEN

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
            getStatesViaREST().catch(() => getStatesViaWS())
            
            // Requesting current user (works for everyone)
            socket?.send(JSON.stringify({
                id: nextId(),
                type: "auth/current_user"
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
            getStatesViaREST().catch(() => getStatesViaWS())
            return
        }

        if (msg.type === "event" && msg.event?.event_type === "shopping_list_updated") {
            console.log("Shopping list updated from HA")
            window.dispatchEvent(new CustomEvent("ha-shopping-list-updated"))
            return
        }

        if (msg.type === "result" && msg.id === getStatesReqId) {
            console.log("[ha-client] get_states WS response received. Success:", msg.success)
            if (msg.success && Array.isArray(msg.result)) {
                console.log("Received all states via WS:", msg.result.length);
                setEntities(msg.result);
            } else if (!msg.success) {
                console.error("[ha-client] get_states via WS failed:", msg.error)
            }
            return
        }

        // Catch-all debug for calendar troubleshooting
        if (msg.type === "result") {
            // console.log("[ha-client] result msg id:", msg.id, "success:", msg.success, "result keys:", msg.result ? Object.keys(msg.result) : "null/undefined")
        }
    }

    socket.onerror = (err) => {
        console.error("WebSocket error", err)
    }

    socket.onclose = () => {
        // Shorter delay if it was already open (likely a sleep/wake or quick drop)
        const delay = 500 
        console.log(`WebSocket closed. Reconnecting in ${delay}ms...`)
        setTimeout(() => connectHA(), delay)
    }
}

// Reconnect immediately when the app becomes visible (e.g. phone wake)
window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.log("[ha-client] Visibility changed to visible — reconnecting immediately")
            connectHA()
        }
    }
})

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

    // Listen to shopping list specific updates
    socket?.send(
        JSON.stringify({
            id: nextId(),
            type: "subscribe_events",
            event_type: "shopping_list_updated"
        })
    )

    console.log("Subscribed to HA events")
}

// REST fallback for massive state payloads on Nabu Casa
async function getStatesViaREST() {
    console.log("Requesting ali entity states via REST /api/states")
    
    let url = "/api/states"
    if (HA_URL && !HA_URL.startsWith(window.location.origin)) {
        url = `${HA_URL}/api/states`
    }

    const headers: Record<string, string> = {}
    if (HA_TOKEN) headers["Authorization"] = `Bearer ${HA_TOKEN}`

    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error("REST states fetch failed")
    
    const states = await res.json()
    if (Array.isArray(states) && states.length > 0) {
        console.log("Received all states via REST:", states.length)
        setEntities(states)
    }
}

let getStatesReqId: number | null = null

function getStatesViaWS() {
    getStatesReqId = nextId()
    socket?.send(
        JSON.stringify({
            id: getStatesReqId,
            type: "get_states"
        })
    )
    console.log("Requesting all entity states via WS with ID:", getStatesReqId)
}