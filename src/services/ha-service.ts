let socket: WebSocket | null = null

export function registerSocket(ws: WebSocket) {
    socket = ws
}

export function getSocket() {
    return socket
}

let messageId = 1000

function nextId() {
    return messageId++
}

export function callService(
    domain: string,
    service: string,
    serviceData: any
) {
    if (!socket) {
        console.error("HA socket not ready")
        return
    }

    socket.send(
        JSON.stringify({
            id: nextId(),
            type: "call_service",
            domain,
            service,
            service_data: serviceData
        })
    )
}

export function fetchHistory(entityId: string, hours = 24): Promise<any[]> {
    return new Promise((resolve) => {
        if (!socket) {
            console.error("HA socket not ready for history")
            return resolve([])
        }

        const end = new Date()
        const start = new Date(end.getTime() - hours * 60 * 60 * 1000)
        const reqId = nextId()

        // Temporary listener for this specific request ID
        const handler = (event: MessageEvent) => {
            const msg = JSON.parse(event.data)
            if (msg.id === reqId) {
                socket!.removeEventListener("message", handler)
                if (msg.type === "result" && msg.success) {
                    // WebSocket history payload normally maps entity_id keys to arrays of states
                    // Ensure we gracefully handle both array responses and object maps depending on HA version
                    const res = msg.result
                    const entityData = Array.isArray(res) ? res : (res[entityId] || [])
                    resolve(entityData)
                } else {
                    console.error("fetchHistory WS error:", msg)
                    resolve([])
                }
            }
        }

        socket.addEventListener("message", handler)

        // Native WebSocket history request avoids CORS barriers!
        socket.send(
            JSON.stringify({
                id: reqId,
                type: "history/history_during_period",
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                significant_changes_only: false,
                minimal_response: false,
                entity_ids: [entityId]
            })
        )
    })
}

export function fetchShoppingList(): Promise<any[]> {
    return new Promise((resolve) => {
        if (!socket) return resolve([])
        const reqId = nextId()
        const handler = (event: MessageEvent) => {
            const msg = JSON.parse(event.data)
            if (msg.id === reqId) {
                socket!.removeEventListener("message", handler)
                resolve(msg.result || [])
            }
        }
        socket.addEventListener("message", handler)
        socket.send(JSON.stringify({ id: reqId, type: "shopping_list/items" }))
    })
}

export function callShoppingList(service: string, data: any = {}) {
    if (!socket) return
    socket.send(JSON.stringify({
        id: nextId(),
        type: `shopping_list/${service}`,
        ...data
    }))
}