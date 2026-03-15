import { callService } from "../services/ha-service"
import { getEntity, setEntity } from "../store/entity-store"

class TodoPopup extends HTMLElement {
    private shadow: ShadowRoot
    private entityId = ""
    private item: any = null

    constructor() {
        super()
        this.shadow = this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.render()
    }

    open(entityId: string, item: any) {
        this.entityId = entityId
        this.item = item
        this.style.display = "block"
        
        // Populate inputs
        const nameInput = this.shadow.querySelector("#nameInput") as HTMLInputElement
        const descInput = this.shadow.querySelector("#descInput") as HTMLTextAreaElement
        if (nameInput) nameInput.value = item.summary || ""
        if (descInput) descInput.value = item.description || ""

        requestAnimationFrame(() => {
            this.classList.add("active")
        })
    }

    close() {
        this.classList.remove("active")
        setTimeout(() => {
            this.style.display = "none"
        }, 300)
    }

    private async save() {
        const nameInput = this.shadow.querySelector("#nameInput") as HTMLInputElement
        const descInput = this.shadow.querySelector("#descInput") as HTMLTextAreaElement
        
        const summary = nameInput.value.trim()
        const description = descInput.value.trim()

        if (!summary) return

        console.log("Saving Todo Item:", {
            uid: this.item.uid,
            summary: summary,
            description: description
        })

        // Call Home Assistant Service
        await callService("todo", "update_item", {
            entity_id: this.entityId,
            item: this.item.uid || this.item.summary,
            rename: summary,
            description: description
        })

        // Force a refresh of the UI by re-triggering the entity store
        // (Wait a bit for HA to process the update)
        setTimeout(() => {
            const entity = getEntity(this.entityId)
            if (entity) {
                setEntity({ ...entity }) // Trigger subscribers
            }
        }, 300)

        this.close()
    }

    private delete() {
        callService("todo", "remove_item", {
            entity_id: this.entityId,
            item: [this.item.uid || this.item.summary]
        })
        
        // Refresh UI
        setTimeout(() => {
            const entity = getEntity(this.entityId)
            if (entity) setEntity({ ...entity })
        }, 300)
        
        this.close()
    }

    render() {
        this.shadow.innerHTML = `
        <style>
            :host {
                position: fixed;
                inset: 0;
                display: none;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                z-index: 11000;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
            }
            :host(.active) {
                opacity: 1;
                pointer-events: auto;
            }

            .sheet {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, calc(-50% + 20px));
                opacity: 0;
                width: calc(100% - 32px);
                max-width: 400px;
                background: var(--color-card);
                border-radius: var(--radius-xl);
                padding: 24px;
                border: 1px solid var(--border-color);
                box-shadow: 0 24px 64px rgba(0,0,0,0.4);
                box-sizing: border-box;
                transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }
            :host(.active) .sheet {
                transform: translate(-50%, -50%);
                opacity: 1;
            }

            .header {
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-bottom: 24px;
            }

            .close-btn {
                position: absolute;
                top: 20px;
                right: 20px;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-secondary);
                cursor: pointer;
                opacity: 0.6;
            }

            .title {
                font-size: 1.125rem;
                font-weight: 600;
                color: var(--text-primary);
            }
            .subtitle {
                font-size: 0.8125rem;
                color: var(--text-secondary);
                opacity: 0.6;
            }

            .input-group {
                background: var(--color-card-alt);
                border-radius: var(--radius-md);
                padding: 12px 16px;
                margin-bottom: 16px;
                border: 1px solid var(--border-color);
            }
            .input-label {
                font-size: 0.6875rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--accent);
                margin-bottom: 4px;
                display: block;
            }
            input, textarea {
                width: 100%;
                background: none;
                border: none;
                color: var(--text-primary);
                font-size: 0.9375rem;
                font-family: inherit;
                outline: none;
                padding: 0;
                resize: none;
            }
            textarea {
                min-height: 80px;
                margin-top: 4px;
            }

            .actions {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 32px;
                gap: 16px;
            }

            .btn {
                padding: 12px 24px;
                border-radius: 999px;
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                border: none;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .btn-delete {
                color: #ff4d4d;
                background: none;
            }
            .btn-delete:active { opacity: 0.6; }

            .btn-save {
                background: var(--accent);
                color: white;
                flex: 1;
                max-width: 160px;
            }
            .btn-save:active { transform: scale(0.96); }
        </style>

        <div class="sheet">
            <div class="close-btn" id="closeBtn">
                <iconify-icon icon="lucide:x" style="font-size: 20px;"></iconify-icon>
            </div>
            <div class="header">
                <div class="title">Redigera objekt</div>
                <div class="subtitle">Matlista</div>
            </div>

            <div class="input-group">
                <span class="input-label">Namn på uppgift</span>
                <input type="text" id="nameInput" placeholder="Ange namn...">
            </div>

            <div class="input-group">
                <span class="input-label">Beskrivning</span>
                <textarea id="descInput" placeholder="Lägg till en beskrivning..."></textarea>
            </div>

            <div class="actions">
                <button class="btn btn-delete" id="deleteBtn">
                    Radera objekt
                </button>
                <button class="btn btn-save" id="saveBtn">
                    Spara objekt
                </button>
            </div>
        </div>
        `

        this.shadow.querySelector("#closeBtn")?.addEventListener("click", () => this.close())
        this.shadow.querySelector("#saveBtn")?.addEventListener("click", () => this.save())
        this.shadow.querySelector("#deleteBtn")?.addEventListener("click", () => this.delete())
        
        const host = this.shadow.host as HTMLElement
        const sheet = this.shadow.querySelector(".sheet") as HTMLElement
        
        sheet.onclick = (e: MouseEvent) => e.stopPropagation()
        
        host.onclick = (e: MouseEvent) => {
            if (e.target === host) this.close()
        }
    }
}

customElements.define("todo-popup", TodoPopup)
