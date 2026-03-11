export interface HAEntity {
    entity_id: string
    state: string
    attributes: Record<string, any>
    last_changed: string
    last_updated: string
}

export interface HAStateChangedEvent {
    event_type: "state_changed"
    data: {
        entity_id: string
        old_state: HAEntity | null
        new_state: HAEntity
    }
}