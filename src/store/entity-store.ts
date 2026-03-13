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

export function subscribeEntity(entityId: string, callback: Function) {
    if (!entityListeners[entityId]) {
        entityListeners[entityId] = []
    }

    entityListeners[entityId].push(callback)
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