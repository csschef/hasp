import { getEntity, subscribeEntity } from "../store/entity-store"
import { callService } from "../services/ha-service"

class KitchenView extends HTMLElement {
    private days = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"]
    private sharedStorageId = "input_text.meny_shopping"
    private draggedIndex: number | null = null

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.render()
        
        this.days.forEach(day => {
            const entityId = `input_text.meny_${day.toLowerCase()}`
            subscribeEntity(entityId, () => this.render())
        })

        subscribeEntity(this.sharedStorageId, () => this.render())
        setTimeout(() => this.render(), 1000)
    }

    private updateMeal(day: string, value: string) {
        callService("input_text", "set_value", {
            entity_id: `input_text.meny_${day.toLowerCase()}`,
            value: value
        })
    }

    private updateShoppingList(items: string[]) {
        callService("input_text", "set_value", {
            entity_id: this.sharedStorageId,
            value: items.join('\n')
        })
    }

    private addItem() {
        const currentItems = (getEntity(this.sharedStorageId)?.state || "").split('\n').filter(i => i.trim() !== '')
        currentItems.push("Ny vara")
        this.updateShoppingList(currentItems)
    }

    private deleteItem(index: number) {
        const currentItems = (getEntity(this.sharedStorageId)?.state || "").split('\n').filter(i => i.trim() !== '')
        currentItems.splice(index, 1)
        this.updateShoppingList(currentItems)
    }

    private editItem(index: number, value: string) {
        const currentItems = (getEntity(this.sharedStorageId)?.state || "").split('\n').filter(i => i.trim() !== '')
        currentItems[index] = value
        this.updateShoppingList(currentItems)
    }

    render() {
        const shoppingState = getEntity(this.sharedStorageId)?.state || ""
        const items = shoppingState.split('\n').filter(i => i.trim() !== '')

        this.shadowRoot!.innerHTML = `
        <style>
            :host { display: block; padding: 0 var(--space-md) 140px; color: var(--text-primary); font-family: var(--font-main); }

            h2 {
                font-size: 13px;
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
                font-size: 12px;
                font-weight: 500;
                color: var(--text-secondary);
                letter-spacing: 0.02em;
                opacity: 0.7;
            }
            .meal-input {
                background: none;
                border: none;
                color: var(--text-primary);
                font-size: 15px;
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
            }

            .shopping-list {
                display: flex;
                flex-direction: column;
            }

            .shopping-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 13px 16px;
                border-bottom: 1px solid var(--border-color);
                transition: background 0.15s ease;
                user-select: none;
            }
            .shopping-item:last-child { border-bottom: none; }

            .shopping-item.dragging { opacity: 0.3; background: var(--color-card-alt); }
            .shopping-item.over { border-top: 1.5px solid var(--accent); }

            .drag-handle {
                color: var(--text-secondary);
                opacity: 0.2;
                cursor: grab;
                font-size: 18px;
                flex-shrink: 0;
            }

            .item-input {
                flex: 1;
                background: none;
                border: none;
                color: var(--text-primary);
                font-size: 15px;
                font-weight: 400;
                outline: none;
                font-family: var(--font-main);
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

            .add-box {
                padding: 14px 16px;
                display: flex;
                align-items: center;
                gap: 8px;
                color: var(--text-secondary);
                font-size: 14px;
                font-weight: 400;
                cursor: pointer;
                transition: background 0.15s ease;
                border-top: 1px solid var(--border-color);
                opacity: 0.6;
            }
            .add-box:active { background: var(--color-card-alt); }
        </style>

        <h2>Veckans Meny</h2>
        <div class="meal-list">
            ${this.days.map(day => {
                const entity = getEntity(`input_text.meny_${day.toLowerCase()}`)
                return `
                <div class="meal-card">
                    <div class="day-label">${day}</div>
                    <input class="meal-input"
                           placeholder="Ej planerat..."
                           data-day="${day}"
                           value="${entity?.state || ''}">
                </div>
                `
            }).join('')}
        </div>

        <h2>Inköpslista</h2>
        <div class="shopping-container">
            <div class="shopping-list" id="dragList">
                ${items.map((item, idx) => `
                    <div class="shopping-item" draggable="true" data-index="${idx}">
                        <div class="drag-handle">
                            <iconify-icon icon="lucide:grip-vertical"></iconify-icon>
                        </div>
                        <input class="item-input"
                               value="${item}"
                               data-index="${idx}">
                        <button class="delete-btn" data-index="${idx}">
                            <iconify-icon icon="lucide:x"></iconify-icon>
                        </button>
                    </div>
                `).join('')}
            </div>

            <div class="add-box" id="addBtn">
                <iconify-icon icon="lucide:plus"></iconify-icon>
                Lägg till vara
            </div>
        </div>
        `

        this.setupEventListeners()
    }

    private setupEventListeners() {
        const root = this.shadowRoot!

        // Meal Updates
        root.querySelectorAll(".meal-input").forEach(input => {
            input.addEventListener("change", (e: any) => {
                this.updateMeal(e.target.dataset.day, e.target.value)
            })
        })

        // Shopping Edit
        root.querySelectorAll(".item-input").forEach(input => {
            input.addEventListener("change", (e: any) => {
                this.editItem(parseInt(e.target.dataset.index), e.target.value)
            })
        })

        // Delete
        root.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", (e: any) => {
                const target = e.target.closest('button')
                if (target) this.deleteItem(parseInt(target.dataset.index))
            })
        })

        // Add
        root.getElementById("addBtn")?.addEventListener("click", () => this.addItem())

        // Drag & Drop Logic
        const list = root.getElementById("dragList")
        const items = root.querySelectorAll(".shopping-item")

        items.forEach(item => {
            item.addEventListener("dragstart", (e: any) => {
                this.draggedIndex = parseInt(item.getAttribute("data-index")!)
                e.target.classList.add("dragging")
            })

            item.addEventListener("dragend", (e: any) => {
                e.target.classList.remove("dragging")
                root.querySelectorAll(".shopping-item").forEach(i => i.classList.remove("over"))
            })

            item.addEventListener("dragover", (e: any) => {
                e.preventDefault()
                item.classList.add("over")
            })

            item.addEventListener("dragleave", () => {
                item.classList.remove("over")
            })

            item.addEventListener("drop", (e: any) => {
                e.preventDefault()
                const targetIndex = parseInt(item.getAttribute("data-index")!)
                this.handleDrop(targetIndex)
            })
        })
    }

    private handleDrop(targetIndex: number) {
        if (this.draggedIndex === null || this.draggedIndex === targetIndex) return
        
        const currentItems = (getEntity(this.sharedStorageId)?.state || "").split('\n').filter(i => i.trim() !== '')
        const itemToMove = currentItems.splice(this.draggedIndex, 1)[0]
        currentItems.splice(targetIndex, 0, itemToMove)
        
        this.updateShoppingList(currentItems)
        this.draggedIndex = null
    }
}

customElements.define("kitchen-view", KitchenView)
