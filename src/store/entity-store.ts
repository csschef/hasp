import type { HAEntity } from "../types/homeassistant"

type EntityMap = Record<string, HAEntity>

export interface HAUser {
    id: string
    name: string
    is_owner: boolean
    is_admin: boolean
}

let currentUser: HAUser | null = null
const userListeners: Function[] = []
const entities: EntityMap = {}

const entityListeners: Record<string, Function[]> = {}

export function setEntity(entity: HAEntity) {
    entities[entity.entity_id] = entity

    const listeners = entityListeners[entity.entity_id]

    if (listeners) {
        for (const listener of listeners) {
            listener(entity)
        }
    }
}

export function setEntities(entityList: HAEntity[]) {

    for (const entity of entityList) {

        entities[entity.entity_id] = entity

        const listeners = entityListeners[entity.entity_id]

        if (listeners) {
            for (const listener of listeners) {
                listener(entity)
            }
        }

    }

}

export function getEntity(entityId: string) {
    return entities[entityId]
}

export function getEntitiesByDomain(domain: string): HAEntity[] {
    return Object.values(entities).filter(e => e.entity_id.startsWith(`${domain}.`))
}

export function subscribeEntity(entityId: string, callback: Function) {
    if (!entityListeners[entityId]) {
        entityListeners[entityId] = []
    }

    entityListeners[entityId].push(callback)
    
    // Immediate feedback: If we already have the state, send it now
    if (entities[entityId]) {
        callback(entities[entityId])
    }
}

export function setCurrentUser(user: HAUser) {
    currentUser = user
    userListeners.forEach(cb => cb(user))
}

export function getCurrentUser() {
    return currentUser
}

export function subscribeUser(callback: Function) {
    userListeners.push(callback)
    if (currentUser) callback(currentUser)
}

/* ── Active Person Tracking (Sticky Identity) ── */
// 1. Check LocalStorage (manual override)
// 2. Detect via Hardware (User Agent)
// 3. Fallback
function detectHardwarePerson() {
    const ua = navigator.userAgent;
    const storagePrefix = "ha_active_person";
    const saved = localStorage.getItem(storagePrefix);
    if (saved) return saved;

    if (ua.includes("Pixel 9 Pro")) return "person.sara";
    if (ua.includes("CPH2581") || ua.includes("OnePlus")) return "person.sebastian";
    
    return "person.sebastian";
}

let activePerson: string = detectHardwarePerson();
const personListeners: ((personId: string) => void)[] = []

export function getActivePerson() {
    return activePerson
}

export function setActivePerson(personId: string) {
    activePerson = personId
    localStorage.setItem("ha_active_person", personId)
    personListeners.forEach(cb => cb(personId))
    window.dispatchEvent(new CustomEvent("person-changed", { detail: personId }))
}

export function subscribeActivePerson(callback: (personId: string) => void) {
    personListeners.push(callback)
    callback(activePerson)
}