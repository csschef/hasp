import { HA_URL, HA_TOKEN } from "./ha-client"

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
): Promise<any> {
    return new Promise((resolve, reject) => {
        if (!socket || socket.readyState === WebSocket.CONNECTING) {
            setTimeout(() => callService(domain, service, serviceData).then(resolve).catch(reject), 1000)
            return
        }

        if (socket.readyState !== WebSocket.OPEN) {
            console.warn("HA socket not ready. State:", socket.readyState)
            return reject("Socket not open")
        }

        const id = messageId++
        const msg = {
            id,
            type: "call_service",
            domain,
            service,
            service_data: serviceData
        }

        const handler = (event: MessageEvent) => {
            const response = JSON.parse(event.data)
            if (response.id === id) {
                socket!.removeEventListener("message", handler)
                if (response.success) resolve(response.result)
                else reject(response.error)
            }
        }
        socket.addEventListener("message", handler)
        socket.send(JSON.stringify(msg))
    })
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

export function fetchTodoItems(entityId: string): Promise<any[]> {
    return new Promise((resolve) => {
        if (!socket) return resolve([])
        const reqId = nextId()
        const handler = (event: MessageEvent) => {
            const msg = JSON.parse(event.data)
            if (msg.id === reqId) {
                socket!.removeEventListener("message", handler)
                resolve(msg.result?.items || [])
            }
        }
        socket.addEventListener("message", handler)
        socket.send(JSON.stringify({ 
            id: reqId, 
            type: "todo/item/list",
            entity_id: entityId
        }))
    })
}

export function callTodoService(service: string, entityId: string, data: any = {}) {
    callService("todo", service, {
        entity_id: entityId,
        ...data
    })
}

export async function fetchCalendarEvents(entityId: string, start: string, end: string): Promise<any[]> {
    try {
        // We use the proxy we set up in vite.config.ts to avoid CORS issues
        const url = `/api/calendars/${entityId}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
        
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${HA_TOKEN}`,
                "Content-Type": "application/json"
            }
        })

        const text = await response.text()
        
        if (!response.ok) {
            console.error(`[Calendar REST] HTTP Error ${response.status}:`, text.slice(0, 200))
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        let rawEvents
        try {
            rawEvents = JSON.parse(text)
        } catch (err) {
            console.error("[Calendar REST] Failed to parse JSON. Raw response (first 200 chars):", text.slice(0, 200))
            throw err
        }
        
        console.log(`[Calendar REST] Fetched ${rawEvents.length} events for ${entityId}`)
        
        if (rawEvents.length > 0) {
            console.log(`[Calendar REST] First event keys:`, Object.keys(rawEvents[0]))
            // Look for anything that looks like an ID
            const first = rawEvents[0]
            const idKey = ['uid', 'id', 'event_id', 'iCalUID'].find(k => first[k])
            if (idKey) console.log(`[Calendar REST] Found ID in field: "${idKey}"`)
        }

        return rawEvents.map((e: any) => ({
            ...e,
            // Map any found ID to 'uid' for our delete logic
            uid: e.uid || e.id || e.event_id || e.iCalUID
        }))
    } catch (e) {
        console.error(`[Calendar REST] Failed to fetch ${entityId}:`, e)
        return []
    }
}

export function createCalendarEvent(entityId: string, eventData: any) {
    return callService("calendar", "create_event", {
        entity_id: entityId,
        ...eventData
    })
}

export function deleteCalendarEvent(entityId: string, uid?: string, fingerprint?: any) {
    const serviceData: any = { entity_id: entityId }
    
    if (uid) {
        serviceData.uid = uid
    } else {
        // Without a UID, deletion is likely to fail in newer HA versions
        console.warn("[Calendar Service] Attempting deletion without UID for", entityId)
        if (fingerprint) {
            serviceData.summary = fingerprint.summary
            serviceData.start_date_time = fingerprint.start
            serviceData.end_date_time = fingerprint.end
        }
    }

    return callService("calendar", "delete_event", serviceData)
}