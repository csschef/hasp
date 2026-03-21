import { getEntity, subscribeEntity } from "../store/entity-store"
import { callService, fetchTodoItems, moveTodoItem } from "../services/ha-service"

class MealsView extends HTMLElement {
    private days = [
        { label: "Måndag", id: "mandag" },
        { label: "Tisdag", id: "tisdag" },
        { label: "Onsdag", id: "onsdag" },
        { label: "Torsdag", id: "torsdag" },
        { label: "Fredag", id: "fredag" },
        { label: "Lördag", id: "lordag" },
        { label: "Söndag", id: "sondag" }
    ]
    private todoEntityId = "todo.matlista"
    private todoItems: any[] = []
    private isConfirmingClear = false
    private guestModeId = "input_boolean.gast"
    private updateTimer: any = null

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    async connectedCallback() {
        this.render()
        
        // Subscribe to meal inputs
        this.days.forEach(day => {
            const entityId = `input_text.meny_${day.id}`
            subscribeEntity(entityId, () => this.render())
        })

        // Subscribe to guest mode for color sync
        subscribeEntity(this.guestModeId, () => this.render())

        // Subscribe to todo list entity changes
        subscribeEntity(this.todoEntityId, () => this.updateTodoItems())
        
        // Subscribe to global shopping list changes (e.g., from other integrations)
        window.addEventListener("ha-shopping-list-updated", () => this.updateTodoItems())
        
        // Initial fetch
        await this.updateTodoItems(true)
    }

    private async updateTodoItems(immediate = false) {
        if (this.updateTimer) clearTimeout(this.updateTimer)
        
        const fetchAndUpdate = async () => {
            this.todoItems = await fetchTodoItems(this.todoEntityId)
            this.render()
        }

        if (immediate) {
            await fetchAndUpdate()
        } else {
            // Debounce to avoid rapid re-renders on bulk updates
            this.updateTimer = setTimeout(fetchAndUpdate, 250)
        }
    }

    private updateMeal(dayId: string, value: string) {
        callService("input_text", "set_value", {
            entity_id: `input_text.meny_${dayId}`,
            value: value
        })
    }

    private addItem(summary: string) {
        if (!summary.trim()) return
        
        // Optimistic update
        const tempUid = `temp_${Date.now()}`
        this.todoItems.unshift({
            uid: tempUid,
            summary: summary,
            status: "needs_action"
        })
        this.render()

        callService("todo", "add_item", {
            entity_id: this.todoEntityId,
            item: summary
        })
    }

    private toggleItem(item: any) {
        const newStatus = item.status === "completed" ? "needs_action" : "completed"
        
        // Optimistic update
        item.status = newStatus
        this.render()

        callService("todo", "update_item", {
            entity_id: this.todoEntityId,
            item: item.uid,
            status: newStatus
        })
    }

    private deleteItem(item: any) {
        // Optimistic update
        this.todoItems = this.todoItems.filter(i => i.uid !== item.uid)
        this.render()

        callService("todo", "remove_item", {
            entity_id: this.todoEntityId,
            item: [item.uid]
        })
    }

    private moveItem(uid: string, previousUid: string | null) {
        moveTodoItem(this.todoEntityId, uid, previousUid)
        
        // Optimistically update local order for smoothness
        const itemIdx = this.todoItems.findIndex(i => i.uid === uid)
        if (itemIdx === -1) return
        
        const [movedItem] = this.todoItems.splice(itemIdx, 1)
        if (!previousUid) {
            this.todoItems.unshift(movedItem)
        } else {
            const prevIdx = this.todoItems.findIndex(i => i.uid === previousUid)
            this.todoItems.splice(prevIdx + 1, 0, movedItem)
        }
        this.render()
    }

    private async clearCompleted() {
        const completedUids = this.todoItems
            .filter(i => i.status === 'completed')
            .map(i => i.uid || i.summary)
        
        if (completedUids.length > 0) {
            // Optimistic update
            this.todoItems = this.todoItems.filter(i => i.status !== 'completed')
            this.isConfirmingClear = false
            this.render()

            await callService("todo", "remove_item", {
                entity_id: this.todoEntityId,
                item: completedUids
            })
            // Don't need explicit update here as WebSocket event will trigger it
        } else {
            this.isConfirmingClear = false
            this.render()
        }
    }

    private openEditPopup(item: any) {
        const popup = document.getElementById("todoPopup") as any
        if (popup) {
            popup.open(this.todoEntityId, item)
        }
    }

    render() {
        const activeItems = this.todoItems.filter(i => i.status !== 'completed')
        const completedItems = this.todoItems.filter(i => i.status === 'completed')
        
        // Nordic Success color for branding
        const brandGreen = "var(--color-success)"

        this.shadowRoot!.innerHTML = `
        <style>
            :host { display: block; padding: var(--space-md) var(--space-md) 24px; color: var(--text-primary); font-family: var(--font-main); }

            h2 {
                font-size: 0.6875rem;
                font-weight: 500;
                color: var(--text-secondary);
                letter-spacing: 0.01em;
                text-transform: uppercase;
                margin: 28px 0 12px;
                opacity: 1;
            }

            /* ── Meals ── */
            .meal-list {
                display: flex;
                flex-direction: column;
                gap: 0;
                background: none;
                border-radius: var(--radius-md);
                overflow: hidden;
                border: 1px solid var(--border-color);
                margin-bottom: var(--space-md);
            }
            .meal-card {
                background: var(--color-card);
                padding: 12px 16px;
                display: grid;
                grid-template-columns: 80px 1fr;
                align-items: center;
                gap: 12px;
                border-left: 3px solid transparent;
            }
            .meal-card.today {
                border-left-color: var(--accent);
            }
            .meal-card.today .day-label, .meal-card.today .meal-input {
                color: var(--accent);
                opacity: 1;
            }
            .day-label {
                font-size: 0.6875rem;
                font-weight: 500;
                color: var(--text-secondary);
                letter-spacing: 0.05em;
                text-transform: uppercase;
                opacity: 0.6;
            }
            .meal-input {
                background: none;
                border: none;
                color: var(--text-primary);
                font-size: 0.875rem;
                font-weight: 400;
                width: 100%;
                outline: none;
                padding: 0;
                font-family: var(--font-main);
                letter-spacing: -0.01em;
                line-height: 1.4;
                text-overflow: ellipsis;
                white-space: nowrap;
                overflow: hidden;
            }
            .meal-input::placeholder { color: var(--text-secondary); opacity: 0.3; }

            /* ── Shopping List ── */
            .shopping-container {
                background: var(--color-card);
                border-radius: var(--radius-md);
                border: 1px solid var(--border-color);
                overflow: hidden;
            }

            .add-item-bar {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: var(--color-card);
                border-radius: var(--radius-md);
                border: 1px solid var(--border-color);
                margin-bottom: var(--space-md);
            }

            .add-input {
                flex: 1;
                background: none;
                border: none;
                color: var(--text-primary);
                font-size: 0.875rem;
                font-weight: 400;
                outline: none;
                font-family: var(--font-main);
                line-height: 1.4;
            }
            .add-input::placeholder { color: var(--text-secondary); opacity: 0.5; }

            .add-btn {
                width: 26px;
                height: 26px;
                border-radius: 50%;
                background: ${brandGreen};
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                border: none;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .add-btn:active { transform: scale(0.9); }
            .add-btn iconify-icon { font-size: 16px; }

            .shopping-list {
                display: flex;
                flex-direction: column;
            }

            .shopping-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 16px;
                transition: background 0.15s ease;
                cursor: pointer;
            }
            .shopping-item:last-child { border-bottom: none; }
            .shopping-item:active { background: var(--color-card-alt); }
            
            .shopping-item.dragging {
                opacity: 0.1;
                filter: grayscale(1);
            }

            .shopping-item {
                position: relative;
            }

            .shopping-item.drag-over::before {
                content: '';
                position: absolute;
                top: -1px;
                left: 0;
                right: 0;
                height: 3px;
                background: var(--accent);
                z-index: 10;
                box-shadow: 0 0 10px var(--accent);
                border-radius: 2px;
            }

            /* Prevent flickering by disabling pointer events on children during drag */
            .shopping-list.dragging-active .shopping-item * {
                pointer-events: none;
            }

            .drag-handle {
                color: var(--text-secondary);
                opacity: 0.3;
                cursor: grab;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                margin-right: -8px;
                flex-shrink: 0;
            }
            .drag-handle:active { cursor: grabbing; }
            .drag-handle iconify-icon { font-size: 20px; }

            .checkbox {
                width: 20px;
                height: 20px;
                border-radius: 6px;
                border: 1.5px solid var(--border-color);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                flex-shrink: 0;
            }
            .checkbox:hover { border-color: ${brandGreen}; }
            .checkbox.checked {
                background: ${brandGreen};
                border-color: ${brandGreen};
                color: white;
            }
            .checkbox iconify-icon {
                font-size: 12px;
                display: none;
                pointer-events: none;
            }
            .checkbox.checked iconify-icon {
                display: block;
            }

            .item-content {
                flex: 1;
                min-width: 0;
                pointer-events: none;
                display: flex;
                flex-direction: column;
            }

            .item-summary {
                color: var(--text-primary);
                font-size: 0.875rem;
                font-weight: 400;
                line-height: 1.4;
            }
            .shopping-item.completed .item-summary {
                color: var(--text-secondary);
                text-decoration: line-through;
                opacity: 0.5;
            }

            .item-description {
                font-size: 0.6875rem;
                color: var(--text-secondary);
                opacity: 0.5;
                margin-top: 0;
                line-height: 1.2;
            }

            .delete-btn {
                color: var(--text-secondary);
                opacity: 0;
                transition: opacity 0.15s ease;
                cursor: pointer;
                background: none;
                border: none;
                padding: 4px;
                display: flex;
                align-items: center;
                flex-shrink: 0;
            }
            .shopping-item:hover .delete-btn { opacity: 0.4; }
            .shopping-item.completed .delete-btn { display: none; }

            .section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: var(--space-md) 0 12px;
                background: none;
                border: none;
                padding: 0;
            }
            .section-title {
                font-size: 0.6875rem;
                font-weight: 600;
                color: var(--text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.06em;
                opacity: 0.7;
            }

            .clear-btn {
                font-size: 0.625rem;
                font-weight: 700;
                color: white;
                background: var(--color-danger);
                border-radius: 20px;
                border: none;
                padding: 5px 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                text-transform: uppercase;
                letter-spacing: 0.03em;
            }
            .clear-btn:active { transform: scale(0.95); opacity: 0.9; }
            .clear-btn.confirm {
                background: var(--color-danger);
            }
        </style>

        <h2>Veckans Meny</h2>
        <div class="meal-list">
            ${this.days.map((day, index) => {
                const entity = getEntity(`input_text.meny_${day.id}`)
                // JS getDay() is 0=Sun, 1=Mon... our array is 0=Mon, 1=Tue...
                const todayJs = new Date().getDay() 
                const todayIdx = todayJs === 0 ? 6 : todayJs - 1
                const isToday = index === todayIdx

                return `
                <div class="meal-card ${isToday ? 'today' : ''}">
                    <div class="day-label">${day.label}</div>
                    <input class="meal-input"
                           placeholder="Ej planerat..."
                           data-day-id="${day.id}"
                           value="${entity?.state || ''}">
                </div>
                `
            }).join('')}
        </div>

        <h2>Inköpslista</h2>
        <div class="add-item-bar">
            <input type="text" 
                    class="add-input" 
                    id="addInput" 
                    placeholder="Lägg till vara...">
            <button class="add-btn" id="addBtn">
                <iconify-icon icon="lucide:plus"></iconify-icon>
            </button>
        </div>

        <div class="shopping-container">
            <div class="shopping-list">
                ${activeItems.map((item) => this.renderItem(item)).join('')}
            </div>
        </div>

        ${completedItems.length > 0 ? `
            <div class="section-header">
                <span class="section-title">Avklarade</span>
                <button class="clear-btn ${this.isConfirmingClear ? 'confirm' : ''}" id="clearBtn">
                    ${this.isConfirmingClear ? 'Är du säker?' : 'Töm lista'}
                </button>
            </div>
            <div class="shopping-container">
                <div class="shopping-list">
                    ${completedItems.map((item) => this.renderItem(item)).join('')}
                </div>
            </div>
        ` : ''}
        `

        this.setupEventListeners()
    }

    private renderItem(item: any) {
        const isCompleted = item.status === 'completed'
        return `
            <div class="shopping-item ${isCompleted ? 'completed' : ''}" 
                 data-uid="${item.uid}" 
                 draggable="${!isCompleted}">
                
                <div class="checkbox ${isCompleted ? 'checked' : ''}" data-uid="${item.uid}">
                    <iconify-icon icon="lucide:check"></iconify-icon>
                </div>
                <div class="item-content">
                    <span class="item-summary">${item.summary}</span>
                    ${item.description ? `<span class="item-description">${item.description}</span>` : ''}
                </div>

                ${!isCompleted ? `
                <div class="drag-handle">
                    <iconify-icon icon="lucide:grip-vertical"></iconify-icon>
                </div>
                ` : ''}
            </div>
        `
    }

    private setupEventListeners() {
        const root = this.shadowRoot!

        root.querySelectorAll(".meal-input").forEach(input => {
            input.addEventListener("change", (e: any) => {
                this.updateMeal(e.target.dataset.dayId, e.target.value)
            })
        })

        root.querySelectorAll(".shopping-item").forEach(row => {
            row.addEventListener("click", (e) => {
                // Prevent click if we are clicking a drag-handle or its children
                if ((e.target as HTMLElement).closest('.drag-handle')) {
                    return;
                }
                const uid = row.getAttribute("data-uid")
                const item = this.todoItems.find(i => i.uid === uid)
                if (item) this.openEditPopup(item)
            })
        })

        root.querySelectorAll(".checkbox").forEach(cb => {
            cb.addEventListener("click", (e) => {
                e.stopPropagation()
                const uid = cb.getAttribute("data-uid")
                const item = this.todoItems.find(i => i.uid === uid)
                if (item) this.toggleItem(item)
            })
        })

        root.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation()
                const uid = btn.getAttribute("data-uid")
                const item = this.todoItems.find(i => i.uid === uid)
                if (item) this.deleteItem(item)
            })
        })

        root.getElementById("clearBtn")?.addEventListener("click", (e) => {
            e.stopPropagation()
            if (this.isConfirmingClear) {
                this.clearCompleted()
            } else {
                this.isConfirmingClear = true
                this.render()
                setTimeout(() => {
                    if (this.isConfirmingClear) {
                        this.isConfirmingClear = false
                        this.render()
                    }
                }, 3000)
            }
        })

        const addInput = root.getElementById("addInput") as HTMLInputElement
        const addBtn = root.getElementById("addBtn")

        const handleAdd = () => {
            const val = addInput.value.trim()
            if (val) {
                this.addItem(val)
                addInput.value = ""
            }
        }

        addBtn?.addEventListener("click", (e) => {
            e.stopPropagation()
            handleAdd()
        })
        addInput?.addEventListener("focus", () => {
            // Delay slightly to allow keyboard to start appearing
            setTimeout(() => {
                addInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 300)
        })

        addInput?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") handleAdd()
        })

        // Drag & Drop
        let draggedUid: string | null = null
        const shoppingList = root.querySelector(".shopping-list")

        root.querySelectorAll(".shopping-item[draggable='true']").forEach(item => {
            item.addEventListener("dragstart", (e: any) => {
                draggedUid = item.getAttribute("data-uid")
                item.classList.add("dragging")
                shoppingList?.classList.add("dragging-active")
                e.dataTransfer.effectAllowed = "move"
            })

            item.addEventListener("dragover", (e: any) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                const targetUid = item.getAttribute("data-uid")
                if (targetUid !== draggedUid) {
                    item.classList.add("drag-over")
                }
            })

            item.addEventListener("dragleave", () => {
                item.classList.remove("drag-over")
            })

            item.addEventListener("dragend", () => {
                item.classList.remove("dragging")
                shoppingList?.classList.remove("dragging-active")
                root.querySelectorAll(".shopping-item").forEach(i => i.classList.remove("drag-over"))
            })

            item.addEventListener("drop", (e: any) => {
                e.preventDefault()
                item.classList.remove("drag-over")
                shoppingList?.classList.remove("dragging-active")
                const targetUid = item.getAttribute("data-uid")
                
                if (draggedUid && targetUid && draggedUid !== targetUid) {
                    // Find actual active items to figure out previous item
                    const activeItems = this.todoItems.filter(i => i.status !== 'completed')
                    const targetIdx = activeItems.findIndex(i => i.uid === targetUid)
                    const draggedIdx = activeItems.findIndex(i => i.uid === draggedUid)
                    
                    let previousUid: string | null = null
                    
                    if (targetIdx === 0) {
                        // Move to top
                        previousUid = null
                    } else if (draggedIdx < targetIdx) {
                        // Moving down: we want to be AFTER the target
                        previousUid = targetUid
                    } else {
                        // Moving up: we want to be AFTER the item BEFORE the target
                        previousUid = activeItems[targetIdx - 1].uid
                    }
                    
                    this.moveItem(draggedUid, previousUid)
                }
            })
        })
    }
}

customElements.define("meals-view", MealsView)
