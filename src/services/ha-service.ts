let socket: WebSocket | null = null

export function registerSocket(ws: WebSocket) {
    socket = ws
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