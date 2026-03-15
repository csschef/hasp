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

        await callService("todo", "update_item", {
            entity_id: this.entityId,
            item: this.item.uid || this.item.summary,
            rename: summary,
            description: description
        })

        setTimeout(() => {
            const entity = getEntity(this.entityId)
            if (entity) setEntity({ ...entity })
        }, 300)

        this.close()
    }

    private delete() {
        callService("todo", "remove_item", {
            entity_id: this.entityId,
            item: [this.item.uid || this.item.summary]
        })
        
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
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
            }

            .header-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .close {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: var(--color-card-alt);
                border: 1px solid var(--border-color);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                color: var(--text-secondary);
                transition: background 0.15s ease, transform 0.1s ease;
            }
            .close:active { 
                background: var(--border-color); 
                transform: scale(0.9);
            }

            .title {
                font-size: 1rem;
                font-weight: 600;
                color: var(--text-primary);
                letter-spacing: -0.01em;
            }
            .subtitle {
                font-size: 0.6875rem;
                color: var(--text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                font-weight: 600;
                opacity: 0.7;
            }

            .input-group {
                background: var(--color-bg);
                border-radius: var(--radius-md);
                padding: 10px 14px;
                margin-bottom: 12px;
                border: 1px solid var(--border-color);
            }
            :host-context([data-theme="dark"]) .input-group,
            @media (prefers-color-scheme: dark) {
                .input-group {
                    background: var(--color-card-alt);
                }
            }
            .input-label {
                font-size: 0.625rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--text-secondary);
                margin-bottom: 4px;
                display: block;
                opacity: 0.5;
            }
            input, textarea {
                width: 100%;
                background: none;
                border: none;
                color: var(--text-primary);
                font-size: 0.875rem;
                font-family: inherit;
                outline: none;
                padding: 0;
                resize: none;
            }
            textarea {
                min-height: 80px;
                margin-top: 2px;
            }

            .actions {
                display: flex;
                margin-top: 24px;
                gap: 12px;
            }

            .btn {
                flex: 1;
                padding: 12px;
                border-radius: 16px;
                font-size: 0.8125rem;
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
                background: var(--color-danger);
                color: white;
                border: none;
            }
            .btn-delete:active { opacity: 0.8; transform: scale(0.98); }
            .btn-delete:hover { opacity: 0.9; }
 
            .btn-save {
                background: var(--color-success);
                color: white;
            }
            .btn-save:active { transform: scale(0.98); opacity: 0.9; }
        </style>

        <div class="sheet">
            <div class="header">
                <div class="header-info">
                    <div class="subtitle">Hantera vara</div>
                    <div class="title">Matlista</div>
                </div>
                <div class="close" id="closeBtn">
                    <iconify-icon icon="lucide:x" style="font-size: 0.875rem;"></iconify-icon>
                </div>
            </div>

            <div class="input-group">
                <span class="input-label">Namn på vara</span>
                <input type="text" id="nameInput" placeholder="Ange namn...">
            </div>

            <div class="input-group">
                <span class="input-label">Beskrivning / Antal</span>
                <textarea id="descInput"></textarea>
            </div>

            <div class="actions">
                <button class="btn btn-delete" id="deleteBtn">
                    Radera
                </button>
                <button class="btn btn-save" id="saveBtn">
                    Spara
                </button>
            </div>
        </div>
        `

        const nameInput = this.shadow.querySelector("#nameInput") as HTMLInputElement
        const descInput = this.shadow.querySelector("#descInput") as HTMLTextAreaElement

        const scrollToInput = (el: HTMLElement) => {
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 300)
        }

        nameInput?.addEventListener("focus", () => scrollToInput(nameInput))
        descInput?.addEventListener("focus", () => scrollToInput(descInput))

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
