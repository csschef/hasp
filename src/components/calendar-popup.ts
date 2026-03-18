import { getActivePerson } from "../store/entity-store"
import { createCalendarEvent, deleteCalendarEvent } from "../services/ha-service"

class CalendarPopup extends HTMLElement {
    private isOpen = false
    private isReadOnly = true
    private calendars = [
        { id: "calendar.saras_kalender", label: "Sara", color: "#bf8686" },
        { id: "calendar.sebbes_kalender", label: "Sebastian", color: "#7b96b2" },
        { id: "calendar.sebastian_privat_kalender", label: "Privat", color: "#9497ad", private: true }
    ]
    private selectedCalendar = ""
    private editingEvent: any = null

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.render()
    }

    public open(event: any = null) {
        if (event) {
            console.log("[Calendar Popup] Event keys:", Object.keys(event))
            console.log("[Calendar Popup] Event UID:", event.uid)
        }
        this.isOpen = true
        this.editingEvent = event
        this.isReadOnly = !!event
        this.classList.add("active")
        
        if (event) {
            this.selectedCalendar = event.calendarId
        } else {
            const activePerson = getActivePerson()
            this.selectedCalendar = activePerson === 'person.sara' ? "calendar.saras_kalender" : "calendar.sebbes_kalender"
        }
        
        this.render()
        window.history.pushState({ type: "popup", id: "calendarPopup" }, "")
    }

    public close(fromHistory = false) {
        this.isOpen = false
        this.editingEvent = null
        this.isReadOnly = true
        this.classList.remove("active")
        if (!fromHistory && window.history.state?.type === "popup" && window.history.state?.id === "calendarPopup") {
            window.history.back()
        }
        this.render()
    }

    private async handleDelete() {
        if (!this.editingEvent || !this.editingEvent.uid) return
        
        if (confirm("Är du säker på att du vill ta bort den här händelsen?")) {
            try {
                // Determine fingerprint for deletion if UID is missing
                const s = this.editingEvent.start?.dateTime || this.editingEvent.start?.date || this.editingEvent.start
                const e = this.editingEvent.end?.dateTime || this.editingEvent.end?.date || this.editingEvent.end
                const fingerprint = {
                    summary: this.editingEvent.summary,
                    start: s ? new Date(s).toISOString().split('.')[0] : null,
                    end: e ? new Date(e).toISOString().split('.')[0] : null
                }

                await deleteCalendarEvent(this.selectedCalendar, this.editingEvent.uid, fingerprint)
                // Wait slightly for HA to commit
                await new Promise(r => setTimeout(r, 800))
                this.close()
                window.dispatchEvent(new CustomEvent("calendar-updated"))
            } catch (e) {
                console.error("Failed to delete event", e)
                alert("Kunde inte ta bort händelsen.")
            }
        }
    }

    private async handleSave() {
        const root = this.shadowRoot!
        const summary = (root.getElementById("summary") as HTMLInputElement).value
        const description = (root.getElementById("description") as HTMLTextAreaElement).value
        const location = (root.getElementById("location") as HTMLInputElement).value
        const start = (root.getElementById("start") as HTMLInputElement).value
        const end = (root.getElementById("end") as HTMLInputElement).value

        if (!summary || !start || !end) {
            alert("Vänligen fyll i titel och tider.")
            return
        }

        const data: any = {
            summary,
            description,
            location,
            start_date_time: new Date(start).toISOString().split('.')[0] + "Z",
            end_date_time: new Date(end).toISOString().split('.')[0] + "Z"
        }

        try {
            // Om vi redigerar en befintlig: Ta bort den gamla först
            if (this.editingEvent) {
                console.log("[Calendar] Updating: Deleting old event first using fingerprint/UID...")
                
                const s = this.editingEvent.start?.dateTime || this.editingEvent.start?.date || this.editingEvent.start
                const e = this.editingEvent.end?.dateTime || this.editingEvent.end?.date || this.editingEvent.end
                const fingerprint = {
                    summary: this.editingEvent.summary,
                    start: s ? new Date(s).toISOString().split('.')[0] : null,
                    end: e ? new Date(e).toISOString().split('.')[0] : null
                }

                await deleteCalendarEvent(this.selectedCalendar, this.editingEvent.uid, fingerprint)
                // Small buffer to let HA process deletion
                await new Promise(r => setTimeout(r, 600))
            }
            
            console.log("[Calendar] Creating/Saving event...")
            await createCalendarEvent(this.selectedCalendar, data)
            
            // Wait slightly for HA to commit before refreshing UI
            await new Promise(r => setTimeout(r, 800))
            
            this.close()
            window.dispatchEvent(new CustomEvent("calendar-updated"))
        } catch (e) {
            console.error("Failed to save event", e)
            alert("Kunde inte spara händelsen.")
        }
    }

    render() {
        if (!this.isOpen) {
            this.shadowRoot!.innerHTML = ""
            return
        }

        const activePerson = getActivePerson()
        const availableCals = this.calendars.filter(c => !c.private || activePerson === 'person.sebastian')
        const currentCal = this.calendars.find(c => c.id === this.selectedCalendar)
        
        let summary = ""
        let description = ""
        let location = ""
        let startVal = ""
        let endVal = ""

        if (this.editingEvent) {
            summary = this.editingEvent.summary || ""
            description = this.editingEvent.description || ""
            location = this.editingEvent.location || ""
            const s = this.editingEvent.start?.dateTime || this.editingEvent.start?.date || this.editingEvent.start
            const e = this.editingEvent.end?.dateTime || this.editingEvent.end?.date || this.editingEvent.end
            startVal = s ? new Date(s).toISOString().slice(0, 16) : ""
            endVal = e ? new Date(e).toISOString().slice(0, 16) : ""
        } else {
            const now = new Date()
            now.setMinutes(0, 0, 0)
            startVal = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16)
            endVal = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16)
        }

        this.shadowRoot!.innerHTML = `
        <style>
            .backdrop {
                position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(12px);
                z-index: 10000; display: flex; align-items: center; justify-content: center;
                padding: 20px; animation: fadeIn 0.3s ease-out;
            }
            .content {
                background: color-mix(in srgb, var(--color-card) 85%, transparent);
                backdrop-filter: blur(24px) saturate(150%);
                -webkit-backdrop-filter: blur(24px) saturate(150%);
                width: 100%; max-width: 360px;
                border-radius: 28px; padding: 24px; box-shadow: var(--shadow-md);
                border: 1px solid var(--border-color); animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            h2 { margin: 0 0 20px; font-size: 1.1rem; font-weight: 700; color: var(--text-primary); text-align: center; }
            
            .form-group { margin-bottom: 16px; }
            label { display: block; font-size: 0.625rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
            
            input, textarea {
                width: 100%; background: var(--color-bg); border: 1px solid var(--border-color);
                border-radius: 12px; padding: 12px; color: var(--text-primary); font-family: inherit; font-size: 0.875rem;
                box-sizing: border-box; outline: none; transition: all 0.2s;
            }
            textarea { resize: none; height: 80px; }
            input:focus, textarea:focus { border-color: var(--accent); background: var(--color-card); }
            
            input[readonly], textarea[readonly] { 
                background: transparent; 
                border-color: transparent; 
                padding-left: 0; 
                font-weight: 500;
                cursor: default;
                border-bottom: 1px solid var(--border-color);
                border-radius: 0;
                opacity: 0.9;
            }

            .cal-selector-wrap { margin-bottom: 20px; }
            .cal-selector { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
            .cal-chip {
                padding: 8px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;
                cursor: pointer; border: 2px solid transparent; white-space: nowrap; transition: all 0.2s;
                background: var(--color-bg); color: var(--text-secondary);
            }
            .cal-chip.active { border-color: var(--cal-color); color: var(--text-primary); background: color-mix(in srgb, var(--cal-color) 12%, var(--color-bg)); }

            .cal-badge {
                display: inline-flex; align-items: center; gap: 6px;
                padding: 6px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;
                background: color-mix(in srgb, var(--cal-color) 10%, var(--color-bg));
                color: var(--text-primary); border: 1px solid var(--cal-color);
            }

            .actions { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
            .action-row { display: flex; gap: 10px; width: 100%; }
            .btn {
                flex: 1; padding: 14px; border-radius: 14px; border: none; font-weight: 700; font-size: 0.875rem; cursor: pointer; transition: all 0.2s;
                display: flex; align-items: center; justify-content: center; gap: 8px;
            }
            .btn-cancel { background: var(--color-bg); color: var(--text-primary); }
            .btn-save { background: var(--accent); color: white; }
            .btn-edit { background: var(--color-card-alt); color: var(--text-primary); border: 1px solid var(--border-color); }
            .btn-delete { 
                background: color-mix(in srgb, var(--color-danger) 10%, var(--color-bg)); 
                color: var(--color-danger); 
                margin-top: 8px;
            }
            .btn:active { transform: scale(0.96); opacity: 0.9; }

            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        </style>
        <div class="backdrop" id="backdrop">
            <div class="content">
                <h2>${this.editingEvent ? (this.isReadOnly ? 'Information' : 'Redigera händelse') : 'Ny händelse'}</h2>
                
                <div class="cal-selector-wrap">
                    <label>Kalender</label>
                    ${(this.editingEvent && this.isReadOnly) ? `
                        <div class="cal-badge" style="--cal-color: ${currentCal?.color}">
                            <span>${currentCal?.label}</span>
                        </div>
                    ` : `
                        <div class="cal-selector">
                            ${availableCals.map(c => `
                                <div class="cal-chip ${this.selectedCalendar === c.id ? 'active' : ''}" 
                                     data-id="${c.id}" style="--cal-color: ${c.color}">
                                    ${c.label}
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>

                <div class="form-group">
                    <label>Vad händer?</label>
                    <input type="text" id="summary" placeholder="Titel..." value="${summary}" ${this.isReadOnly ? 'readonly' : ''}>
                </div>

                <div class="form-group">
                    <label>Beskrivning</label>
                    <textarea id="description" placeholder="Beskrivning..." ${this.isReadOnly ? 'readonly' : ''}>${description}</textarea>
                </div>

                <div class="form-group">
                    <label>Var</label>
                    <input type="text" id="location" placeholder="Plats..." value="${location}" ${this.isReadOnly ? 'readonly' : ''}>
                </div>

                <div style="display: flex; gap: 10px;">
                    <div class="form-group" style="flex: 1;">
                        <label>Start</label>
                        <input type="datetime-local" id="start" value="${startVal}" ${this.isReadOnly ? 'readonly' : ''}>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>Slut</label>
                        <input type="datetime-local" id="end" value="${endVal}" ${this.isReadOnly ? 'readonly' : ''}>
                    </div>
                </div>

                <div class="actions">
                    ${this.editingEvent && this.isReadOnly ? `
                        <div class="action-row">
                            <button class="btn btn-edit" id="editBtn"><iconify-icon icon="ph:pencil-simple"></iconify-icon> Ändra</button>
                            <button class="btn btn-cancel" id="cancelBtn">Stäng</button>
                        </div>
                        ${this.editingEvent.uid ? `
                            <button class="btn btn-delete" id="deleteBtn"><iconify-icon icon="ph:trash"></iconify-icon> Radera händelse</button>
                        ` : ''}
                    ` : `
                        <div class="action-row">
                            <button class="btn btn-cancel" id="cancelBtn">${this.editingEvent ? 'Avbryt' : 'Avbryt'}</button>
                            <button class="btn btn-save" id="saveBtn">${this.editingEvent ? 'Spara ändringar' : 'Spara händelse'}</button>
                        </div>
                    `}
                </div>
            </div>
        </div>
        `

        const root = this.shadowRoot!
        root.getElementById("backdrop")?.addEventListener("click", (e) => {
            if (e.target === e.currentTarget) this.close()
        })
        root.getElementById("cancelBtn")?.addEventListener("click", () => {
            if (this.editingEvent && !this.isReadOnly) {
                this.isReadOnly = true
                this.render()
            } else {
                this.close()
            }
        })
        root.getElementById("saveBtn")?.addEventListener("click", () => this.handleSave())
        root.getElementById("deleteBtn")?.addEventListener("click", () => this.handleDelete())
        root.getElementById("editBtn")?.addEventListener("click", () => {
            this.isReadOnly = false
            this.render()
        })

        root.querySelectorAll(".cal-chip").forEach(chip => {
            chip.addEventListener("click", () => {
                this.selectedCalendar = chip.getAttribute("data-id")!
                this.render()
            })
        })
    }
}

customElements.define("calendar-popup", CalendarPopup)
