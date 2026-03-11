import { setEntity, setEntities } from "../store/entity-store"
import { registerSocket } from "./ha-service"

const HA_URL = import.meta.env.VITE_HA_URL
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

            return
        }

        if (msg.type === "event" && msg.event?.event_type === "state_changed") {
            const entity = msg.event.data.new_state
            setEntity(entity)
            return
        }

        if (msg.type === "result" && Array.isArray(msg.result)) {
            console.log("Received all states:", msg.result.length)

            setEntities(msg.result)

            return
        }
    }

    socket.onerror = (err) => {
        console.error("WebSocket error", err)
    }

    socket.onclose = () => {
        console.log("WebSocket closed")
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

    console.log("Subscribed to state_changed events")
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