import { getEntity, subscribeEntity, getActivePerson } from "../store/entity-store"
import { fetchCalendarEvents } from "../services/ha-service"

class CalendarView extends HTMLElement {
    private calendars = [
        { id: "calendar.saras_kalender", label: "Sara", color: "#bf8686" },
        { id: "calendar.sebbes_kalender", label: "Sebbe", color: "#7b96b2" },
        { id: "calendar.sebastian_privat_kalender", label: "Privat", color: "#9497ad", private: true }
    ]
    private events: any[] = []
    private isLoading = true

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    async connectedCallback() {
        this.render()
        await this.loadAllEvents()
        
        // Listen for person changes to refetch private calendar
        window.addEventListener("person-changed", () => this.loadAllEvents())
        
        // Listen for creation of events
        window.addEventListener("calendar-updated", () => this.loadAllEvents())
        
        // Refresh every 10 minutes
        setInterval(() => this.loadAllEvents(), 10 * 60 * 1000)
    }

    private async loadAllEvents() {
        this.isLoading = true
        this.render()

        // Safety net: if the whole load takes more than 15 s, stop showing the spinner
        const safetyTimer = setTimeout(() => {
            if (this.isLoading) {
                this.isLoading = false
                this.render()
            }
        }, 15_000)

        try {
            const now = new Date()
            const start = now.toISOString().split('.')[0] + "Z"
            const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('.')[0] + "Z"

            const activePerson = getActivePerson()
            const allFetched: any[] = []

            for (const cal of this.calendars) {
                // Skip private if not Sebbe
                if (cal.private && activePerson !== 'person.sebastian') continue

                try {
                    const res = await fetchCalendarEvents(cal.id, start, end)
                    if (Array.isArray(res)) {
                        allFetched.push(...res.map(e => ({ ...e, calendarId: cal.id, calendarColor: cal.color, calendarLabel: cal.label })))
                    }
                } catch (e) {
                    console.error("Failed to fetch calendar", cal.id, e)
                }
            }

            // Sort by start time
            this.events = allFetched.sort((a, b) => {
                const dateA = new Date(typeof a.start === 'string' ? a.start : (a.start?.dateTime || a.start?.date || 0)).getTime()
                const dateB = new Date(typeof b.start === 'string' ? b.start : (b.start?.dateTime || b.start?.date || 0)).getTime()
                return dateA - dateB
            })
        } finally {
            clearTimeout(safetyTimer)
            this.isLoading = false
            this.render()
        }
    }

    // Extract the date string regardless of HA format (plain string or {dateTime/date} object)
    private getStartStr(start: any): string {
        if (typeof start === 'string') return start
        return start?.dateTime || start?.date || ''
    }

    private isAllDay(start: any): boolean {
        const s = this.getStartStr(start)
        return s.length === 10 // "YYYY-MM-DD" only, no time component
    }

    private formatDay(dateStr: string) {
        const d = new Date(dateStr)
        const today = new Date()
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

        if (d.toDateString() === today.toDateString()) return "Idag"
        if (d.toDateString() === tomorrow.toDateString()) return "Imorgon"

        return d.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })
    }

    private formatTime(start: any, end: any) {
        if (this.isAllDay(start)) return "Hela dagen"
        const s = new Date(this.getStartStr(start)).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
        return s
    }

    render() {
        if (this.isLoading && this.events.length === 0) {
            this.shadowRoot!.innerHTML = `
                <style>
                    :host { display: block; padding: 20px; text-align: center; color: var(--text-secondary); font-family: var(--font-main); }
                    .loader { margin-top: 100px; opacity: 0.5; font-size: 0.875rem; }
                </style>
                <div class="loader">Hämtar händelser...</div>
            `
            return
        }

        // Group by day — HA start is a plain ISO string like "2026-03-21T10:00:00+01:00"
        const grouped: Record<string, any[]> = {}
        this.events.forEach(e => {
            const dateStr = this.getStartStr(e.start)
            if (!dateStr) return
            const dayKey = dateStr.split("T")[0]
            if (!grouped[dayKey]) grouped[dayKey] = []
            grouped[dayKey].push(e)
        })

        const days = Object.keys(grouped).sort()

        this.shadowRoot!.innerHTML = `
        <style>
            :host { 
                display: block; 
                padding: 0 var(--space-md) 100px; 
                color: var(--text-primary); 
                font-family: var(--font-main);
                animation: fadeIn 0.4s ease-out;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .today-date {
                font-size: 1.1rem;
                font-weight: 600;
                color: var(--text-primary);
                letter-spacing: 0.01em;
                margin: 28px 0 2px;
                opacity: 0.85;
            }
            .today-date-sub {
                font-size: 0.6875rem;
                font-weight: 400;
                color: var(--text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.07em;
                opacity: 0.55;
                margin-bottom: 20px;
            }

            .header { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin: 0 0 16px; 
            }
            
            h2 { 
                font-size: 0.6875rem; 
                font-weight: 500; 
                color: var(--text-secondary); 
                text-transform: uppercase; 
                letter-spacing: 0.06em; 
                margin: 0;
                opacity: 0.8;
            }
            
            .header-actions { display: flex; gap: 10px; }
            .add-btn {
                background: var(--color-success); 
                border: 1px solid var(--color-success); 
                color: #fff;
                width: 36px; height: 36px; 
                border-radius: 50%; 
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; 
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: var(--shadow-sm);
            }
            .add-btn:active { transform: scale(0.9); opacity: 0.8; }
            .add-btn iconify-icon { font-size: 1.2rem; }

            .day-group { margin-bottom: 24px; }
            
            .day-title { 
                font-size: 0.625rem; 
                font-weight: 600; 
                color: var(--text-secondary); 
                text-transform: uppercase; 
                letter-spacing: 0.05em; 
                margin-bottom: 8px; 
                padding-left: 2px;
                opacity: 0.6;
            }
            
            .event-card {
                background: var(--color-card); 
                border-radius: var(--radius-md, 12px); 
                padding: 12px 16px; 
                margin-bottom: 8px;
                border: 1px solid var(--border-color); 
                display: flex; gap: 16px; align-items: center;
                position: relative; 
                overflow: hidden;
                transition: transform 0.1s ease;
            }
            .event-card:active { transform: scale(0.98); }
            
            .event-card::before {
                content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--cal-color);
            }
            
            .event-time { 
                display: flex; 
                flex-direction: column; 
                width: 75px; 
                flex-shrink: 0;
            }
            .event-time-val {
                font-size: 0.8125rem; 
                font-weight: 600; 
                color: var(--text-primary);
            }
            .event-cal-name { 
                font-size: 0.625rem; 
                text-transform: uppercase; 
                letter-spacing: 0.04em; 
                color: var(--text-secondary);
                margin-top: 4px;
                opacity: 0.7;
            }
            
            .event-details { flex: 1; min-width: 0; }
            .event-summary { 
                font-size: 0.8125rem; 
                font-weight: 500; 
                line-height: 1.3;
                color: var(--text-primary); 
                overflow: hidden; 
                text-overflow: ellipsis; 
                white-space: nowrap; 
            }
            .event-desc {
                font-size: 0.75rem;
                color: var(--text-secondary);
                opacity: 0.6;
                margin-top: 1px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .event-location { 
                font-size: 0.75rem; 
                color: var(--text-secondary); 
                margin-top: 3px; 
                display: flex;
                align-items: center;
                gap: 4px;
                opacity: 0.8;
            }
            .event-location iconify-icon { color: var(--cal-color); font-size: 0.8rem; }

            .empty-state { 
                padding: 120px 20px; 
                text-align: center; 
                color: var(--text-secondary); 
            }
            .empty-state iconify-icon {
                font-size: 3rem;
                opacity: 0.15;
                margin-bottom: 16px;
            }
            .empty-text { font-size: 0.9375rem; opacity: 0.6; }
        </style>

        <div class="today-date">${new Date().toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })}</div>
        <div class="today-date-sub">${new Date().toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric' })}</div>

        <div class="header">
            <h2>KALENDER</h2>
            <div class="header-actions">
                <button class="add-btn" id="addEventBtn">
                    <iconify-icon icon="ph:plus-bold"></iconify-icon>
                </button>
            </div>
        </div>

        <div class="agenda">
            ${days.length === 0 ? `
                <div class="empty-state">
                    <iconify-icon icon="ph:calendar-blank"></iconify-icon>
                    <div class="empty-text">Inga händelser planerade de närmsta veckorna.</div>
                </div>
            ` : ''}
            ${days.map(day => `
                <div class="day-group">
                    <div class="day-title">${this.formatDay(day)}</div>
                    ${grouped[day].map(e => `
                        <div class="event-card" style="--cal-color: ${e.calendarColor}" 
                             data-summary="${e.summary}" data-start="${this.getStartStr(e.start)}">
                            <div class="event-time">
                                <span class="event-time-val">${this.formatTime(e.start, e.end)}</span>
                                <span class="event-cal-name">${e.calendarLabel}</span>
                            </div>
                            <div class="event-details">
                                <div class="event-summary">${e.summary}</div>
                                ${e.description ? `<div class="event-desc">${e.description}</div>` : ''}
                                ${e.location ? `
                                    <div class="event-location">
                                        <iconify-icon icon="ph:map-pin-bold"></iconify-icon>
                                        <span>${e.location}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
        `

        this.shadowRoot!.getElementById("addEventBtn")?.addEventListener("click", () => {
            const popup = document.getElementById("calendarPopup") as any
            if (popup) popup.open()
        })

        // Click events for existing cards
        this.shadowRoot!.querySelectorAll(".event-card").forEach((card) => {
            card.addEventListener("click", () => {
                const summary = (card as HTMLElement).dataset.summary
                const start = (card as HTMLElement).dataset.start
                const event = this.events.find(e => e.summary === summary && this.getStartStr(e.start) === start)
                const popup = document.getElementById("calendarPopup") as any
                if (popup) popup.open(event)
            })
        })
    }
}

customElements.define("calendar-view", CalendarView)
