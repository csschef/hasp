import { getEntity, subscribeEntity } from "../store/entity-store"
import { callService, fetchTodoItems } from "../services/ha-service"

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

        // Subscribe to todo list
        subscribeEntity(this.todoEntityId, () => this.updateTodoItems())
        
        // Initial fetch
        await this.updateTodoItems()
    }

    private async updateTodoItems() {
        this.todoItems = await fetchTodoItems(this.todoEntityId)
        console.log("Fetched Todo Items:", this.todoItems)
        this.render()
    }

    private updateMeal(dayId: string, value: string) {
        callService("input_text", "set_value", {
            entity_id: `input_text.meny_${dayId}`,
            value: value
        })
    }

    private addItem(summary: string) {
        if (!summary.trim()) return
        callService("todo", "add_item", {
            entity_id: this.todoEntityId,
            item: summary
        })
    }

    private toggleItem(item: any) {
        const newStatus = item.status === "completed" ? "needs_action" : "completed"
        callService("todo", "update_item", {
            entity_id: this.todoEntityId,
            item: item.uid || item.summary,
            status: newStatus
        })
    }

    private deleteItem(item: any) {
        callService("todo", "remove_item", {
            entity_id: this.todoEntityId,
            item: [item.uid || item.summary]
        })
    }

    private async clearCompleted() {
        const completedUids = this.todoItems
            .filter(i => i.status === 'completed')
            .map(i => i.uid || i.summary)
        
        if (completedUids.length > 0) {
            console.log("Clearing Completed Items:", completedUids)
            await callService("todo", "remove_item", {
                entity_id: this.todoEntityId,
                item: completedUids
            })

            // Refresh the list after a small delay to give HA time to update
            setTimeout(() => this.updateTodoItems(), 400)
        }
        
        this.isConfirmingClear = false
        this.render()
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

        this.shadowRoot!.innerHTML = `
        <style>
            :host { display: block; padding: 0 var(--space-md) 140px; color: var(--text-primary); font-family: var(--font-main); }

            h2 {
                font-size: 0.8125rem;
                font-weight: 500;
                letter-spacing: 0.07em;
                text-transform: uppercase;
                color: var(--text-secondary);
                margin: 28px 0 12px;
                opacity: 0.7;
            }

            /* ── Meals ── */
            .meal-list {
                display: flex;
                flex-direction: column;
                gap: 1px;
                background: var(--border-color);
                border-radius: var(--radius-md);
                overflow: hidden;
                border: 1px solid var(--border-color);
                margin-bottom: 32px;
            }
            .meal-card {
                background: var(--color-card);
                padding: 14px 16px;
                display: grid;
                grid-template-columns: 90px 1fr;
                align-items: center;
                gap: 12px;
            }
            .day-label {
                font-size: 0.75rem;
                font-weight: 500;
                color: var(--text-secondary);
                letter-spacing: 0.02em;
                opacity: 0.7;
            }
            .meal-input {
                background: none;
                border: none;
                color: var(--text-primary);
                font-size: 0.9375rem;
                font-weight: 400;
                width: 100%;
                outline: none;
                padding: 0;
                font-family: var(--font-main);
                letter-spacing: -0.01em;
            }
            .meal-input::placeholder { color: var(--text-secondary); opacity: 0.3; }

            /* ── Shopping List ── */
            .shopping-container {
                background: var(--color-card);
                border-radius: var(--radius-md);
                border: 1px solid var(--border-color);
                overflow: hidden;
                margin-top: 4px;
            }

            .add-item-bar {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 14px 16px;
                border-bottom: 1px solid var(--border-color);
                background: var(--color-card-alt);
            }

            .add-input {
                flex: 1;
                background: none;
                border: none;
                color: var(--text-primary);
                font-size: 0.9375rem;
                font-weight: 400;
                outline: none;
                font-family: var(--font-main);
            }
            .add-input::placeholder { color: var(--text-secondary); opacity: 0.5; }

            .add-btn {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: var(--accent);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                border: none;
                cursor: pointer;
                transition: transform 0.1s;
            }
            .add-btn:active { transform: scale(0.9); }
            .add-btn iconify-icon { font-size: 18px; }

            .shopping-list {
                display: flex;
                flex-direction: column;
            }

            .shopping-item {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 14px 16px;
                border-bottom: 1px solid var(--border-color);
                transition: background 0.15s ease;
                cursor: pointer;
            }
            .shopping-item:last-child { border-bottom: none; }
            .shopping-item:active { background: var(--color-card-alt); }

            .checkbox {
                width: 22px;
                height: 22px;
                border-radius: 6px;
                border: 2px solid var(--border-color);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                flex-shrink: 0;
                margin-top: 1px;
            }
            .checkbox:hover { border-color: var(--accent); }
            .checkbox.checked {
                background: var(--accent);
                border-color: var(--accent);
                color: white;
            }
            .checkbox iconify-icon {
                font-size: 14px;
                display: none;
                pointer-events: none;
            }
            .checkbox.checked iconify-icon {
                display: block;
            }

            .item-content {
                flex: 1;
                min-width: 0;
                pointer-events: none; /* Let the row handle clicks */
                display: flex;
                flex-direction: column;
            }

            .item-summary {
                color: var(--text-primary);
                font-size: 0.9375rem;
                font-weight: 400;
                line-height: 1.4;
            }
            .shopping-item.completed .item-summary {
                color: var(--text-secondary);
                text-decoration: line-through;
                opacity: 0.6;
            }

            .item-description {
                font-size: 0.8125rem;
                color: var(--text-secondary);
                opacity: 0.6;
                margin-top: 2px;
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

            .section-header {
                padding: 12px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(0,0,0,0.02);
                border-top: 1px solid var(--border-color);
                border-bottom: 1px solid var(--border-color);
            }
            .section-title {
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--accent);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                opacity: 0.8;
            }

            .clear-btn {
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--text-secondary);
                background: none;
                border: 1px solid var(--border-color);
                padding: 4px 10px;
                border-radius: var(--radius-sm);
                cursor: pointer;
                opacity: 0.6;
                transition: all 0.2s ease;
            }
            .clear-btn:hover { opacity: 1; background: var(--color-card-alt); }
            .clear-btn.confirm {
                background: var(--error, #ff4d4d);
                color: white;
                border-color: transparent;
                opacity: 1;
            }
        </style>

        <h2>Veckans Meny</h2>
        <div class="meal-list">
            ${this.days.map(day => {
                const entity = getEntity(`input_text.meny_${day.id}`)
                return `
                <div class="meal-card">
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
        <div class="shopping-container">
            <div class="add-item-bar">
                <input type="text" 
                       class="add-input" 
                       id="addInput" 
                       placeholder="Lägg till vara...">
                <button class="add-btn" id="addBtn">
                    <iconify-icon icon="lucide:plus"></iconify-icon>
                </button>
            </div>

            <div class="shopping-list">
                ${activeItems.map((item) => this.renderItem(item)).join('')}
                
                ${completedItems.length > 0 ? `
                    <div class="section-header">
                        <span class="section-title">Avklarade</span>
                        <button class="clear-btn ${this.isConfirmingClear ? 'confirm' : ''}" id="clearBtn">
                            ${this.isConfirmingClear ? 'Är du säker?' : 'Töm lista'}
                        </button>
                    </div>
                    ${completedItems.map((item) => this.renderItem(item)).join('')}
                ` : ''}
            </div>
        </div>
        `

        this.setupEventListeners()
    }

    private renderItem(item: any) {
        const isCompleted = item.status === 'completed'
        return `
            <div class="shopping-item ${isCompleted ? 'completed' : ''}" data-uid="${item.uid}">
                <div class="checkbox ${isCompleted ? 'checked' : ''}" data-uid="${item.uid}">
                    <iconify-icon icon="lucide:check"></iconify-icon>
                </div>
                <div class="item-content">
                    <span class="item-summary">${item.summary}</span>
                    ${item.description ? `<span class="item-description">${item.description}</span>` : ''}
                </div>
                <button class="delete-btn" data-uid="${item.uid}">
                    <iconify-icon icon="lucide:x"></iconify-icon>
                </button>
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

        // Clicking the row opens the edit popup
        root.querySelectorAll(".shopping-item").forEach(row => {
            row.addEventListener("click", () => {
                const uid = row.getAttribute("data-uid")
                const item = this.todoItems.find(i => i.uid === uid)
                if (item) this.openEditPopup(item)
            })
        })

        // Checkbox still works independently
        root.querySelectorAll(".checkbox").forEach(cb => {
            cb.addEventListener("click", (e) => {
                e.stopPropagation()
                const uid = cb.getAttribute("data-uid")
                const item = this.todoItems.find(i => i.uid === uid)
                if (item) this.toggleItem(item)
            })
        })

        // Delete button still works independently
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
        addInput?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") handleAdd()
        })
    }
}

customElements.define("meals-view", MealsView)
