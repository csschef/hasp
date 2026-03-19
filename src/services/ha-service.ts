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

// --- Helpers ---

// Safe REST fetch: uses relative URL so Vite proxy handles dev CORS,
// same-origin HA handles production. Safely parses empty bodies.
function haFetch(path: string, method: string, body?: any): Promise<any> {
    return fetch(path, {
        method,
        headers: {
            "Authorization": `Bearer ${HA_TOKEN}`,
            ...(body ? { "Content-Type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    }).then(async r => {
        // Some endpoints return 204 No Content or empty body — don't try to JSON-parse those
        const text = await r.text()
        const data = text.length > 0 ? JSON.parse(text) : {}
        if (!r.ok) return Promise.reject(data)
        return data
    })
}

// --- Calendar event fetching ---
// Primary: HA REST GET /api/calendars/{entity_id} — this returns `uid` per event.
// Fetch calendar events via WebSocket (REST always fails in this setup due to auth redirect)
export function fetchCalendarEvents(entityId: string, start: string, end: string): Promise<any[]> {
    return fetchCalendarEventsWS(entityId, start, end)
}


// WebSocket fallback for fetching calendar events
// Wait until socket is open, or give up after `maxWaitMs`
function waitForSocket(maxWaitMs = 10_000): Promise<boolean> {
    return new Promise((resolve) => {
        const deadline = Date.now() + maxWaitMs
        function poll() {
            if (socket && socket.readyState === WebSocket.OPEN) return resolve(true)
            if (Date.now() >= deadline) return resolve(false)
            setTimeout(poll, 300)
        }
        poll()
    })
}

function fetchCalendarEventsWS(entityId: string, start: string, end: string): Promise<any[]> {
    return new Promise(async (resolve) => {
        const ready = await waitForSocket(10_000)
        if (!ready || !socket || socket.readyState !== WebSocket.OPEN) {
            console.error("[Calendar] Socket not available, skipping WS fetch for", entityId)
            return resolve([])
        }

        const reqId = nextId()
        let settled = false

        // Timeout: if HA never replies to this message, bail out after 10 s
        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true
                socket!.removeEventListener("message", handler)
                console.warn("[Calendar WS] Timed out waiting for response for", entityId)
                resolve([])
            }
        }, 10_000)

        const handler = (event: MessageEvent) => {
            const response = JSON.parse(event.data)
            if (response.id === reqId) {
                if (settled) return
                settled = true
                clearTimeout(timeout)
                socket!.removeEventListener("message", handler)
                if (response.success) {
                    const res = response.result?.response || response.result || {}
                    const entityData = res[entityId] || {}
                    const rawEvents = entityData.events || []
                    resolve(rawEvents.map((e: any) => ({
                        ...e,
                        uid: e.uid || e.id || e.event_id || e.iCalUID
                    })))
                } else {
                    console.error("[Calendar WS] get_events failed:", response.error)
                    resolve([])
                }
            }
        }

        socket.addEventListener("message", handler)
        socket.send(JSON.stringify({
            id: reqId, type: "call_service",
            domain: "calendar", service: "get_events",
            service_data: { entity_id: entityId, start_date_time: start, end_date_time: end },
            return_response: true
        }))
    })
}

// --- Calendar create/delete ---
// Create via REST POST /api/services/calendar/create_event
export function createCalendarEvent(entityId: string, eventData: any) {
    return haFetch(`/api/services/calendar/create_event`, "POST", {
        entity_id: entityId,
        summary: eventData.summary,
        description: eventData.description || "",
        location: eventData.location || "",
        start_date_time: eventData.start_date_time,
        end_date_time: eventData.end_date_time
    })
}

