import type { HAEntity } from "../types/homeassistant"

type EntityMap = Record<string, HAEntity>

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