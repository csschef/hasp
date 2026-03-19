import { getActivePerson } from "../store/entity-store"
import { createCalendarEvent } from "../services/ha-service"

type Sheet = "none" | "date-start" | "date-end" | "time-start" | "time-end"
const IH = 58 // drum item height px

class CalendarPopup extends HTMLElement {
    private isOpen = false
    private calendars = [
        { id: "calendar.saras_kalender",            label: "Sara",   color: "#bf8686" },
        { id: "calendar.sebbes_kalender",           label: "Sebbe",  color: "#7b96b2" },
        { id: "calendar.sebastian_privat_kalender", label: "Privat", color: "#9497ad", private: true }
    ]
    private selectedCalendar = ""
    private editingEvent: any = null

    private startDate = ""
    private endDate   = ""
    private startH = 9;  private startM = 0
    private endH   = 10; private endM   = 0

    private sheet: Sheet = "none"
    private pickerMonth  = new Date()
    private pendingDate  = ""   // staging area for date picker before confirm

    constructor() { super(); this.attachShadow({ mode: "open" }) }
    connectedCallback() { this.render() }

    // ─── Public API ──────────────────────────────────────────────────────────
    public open(event: any = null) {
        this.isOpen = true
        this.editingEvent = event
        this.sheet = "none"
        this.pendingDate = ""

        if (event) {
            this.selectedCalendar = event.calendarId
        } else {
            const p = getActivePerson()
            this.selectedCalendar = p === "person.sara"
                ? "calendar.saras_kalender"
                : "calendar.sebbes_kalender"

            const now = new Date(); now.setMinutes(0, 0, 0)
            const s = new Date(now.getTime() + 3600_000)
            const e = new Date(now.getTime() + 7200_000)
            this.startDate = this.ds(s); this.startH = s.getHours(); this.startM = 0
            this.endDate   = this.ds(e); this.endH   = e.getHours(); this.endM   = 0
            this.pickerMonth = new Date(s.getFullYear(), s.getMonth(), 1)
        }

        this.style.display = "block"
        this.render()
        // Double rAF so the CSS transition actually fires (same pattern as light-popup)
        requestAnimationFrame(() => requestAnimationFrame(() => this.classList.add("active")))
        window.history.pushState({ type: "popup", id: "calendarPopup" }, "")
    }

    public close(fromHistory = false) {
        if (this.sheet !== "none") {
            // Close sub-sheet first, not the whole popup
            this.sheet = "none"
            this.render()
            return
        }
        this.isOpen = false; this.editingEvent = null
        this.classList.remove("active")
        if (!fromHistory && window.history.state?.type === "popup" && window.history.state?.id === "calendarPopup")
            window.history.back()
        this.render()
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────
    private ds(d: Date) { return d.toLocaleDateString("sv-SE") }
    private pad(n: number) { return String(n).padStart(2, "0") }
    private fmtDate(s: string) {
        if (!s) return "Välj datum"
        return new Date(s + "T00:00:00").toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })
    }
    private fmtTime(h: number, m: number) { return `${this.pad(h)}:${this.pad(m)}` }

    // ─── Save ────────────────────────────────────────────────────────────────
    private async handleSave() {
        const root    = this.shadowRoot!
        const summary = (root.getElementById("summary")  as HTMLInputElement)?.value.trim()
        const desc    = (root.getElementById("desc")     as HTMLTextAreaElement)?.value
        const loc     = (root.getElementById("location") as HTMLInputElement)?.value

        if (!summary || !this.startDate || !this.endDate) {
            alert("Fyll i titel och välj datum."); return
        }
        const iso = (date: string, h: number, m: number) =>
            new Date(`${date}T${this.pad(h)}:${this.pad(m)}:00`).toISOString().split(".")[0] + "Z"

        try {
            await createCalendarEvent(this.selectedCalendar, {
                summary, description: desc, location: loc,
                start_date_time: iso(this.startDate, this.startH, this.startM),
                end_date_time:   iso(this.endDate,   this.endH,   this.endM),
            })
            await new Promise(r => setTimeout(r, 800))
            this.close()
            window.dispatchEvent(new CustomEvent("calendar-updated"))
        } catch (e) {
            console.error("Failed to save event", e)
            alert("Kunde inte spara händelsen.")
        }
    }

    // ─── Shared popup shell CSS (matches light-popup pattern) ─────────────────
    private shellCSS(extraCSS = "") {
        return `
        <style>
            :host {
                position: fixed; inset: 0; display: none;
                background: rgba(0,0,0,0.4);
                backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                z-index: 10000; opacity: 0;
                transition: opacity 0.3s ease; pointer-events: none;
            }
            :host(.active) { opacity: 1; pointer-events: auto; }

            .sheet {
                position: absolute;
                top: 60px; left: 50%;
                transform: translate(-50%, 16px);
                opacity: 0;
                width: calc(100% - 32px); max-width: 420px;
                background: color-mix(in srgb, var(--color-card) 85%, transparent);
                backdrop-filter: blur(24px) saturate(150%);
                -webkit-backdrop-filter: blur(24px) saturate(150%);
                border-radius: var(--radius-xl, 24px);
                padding: 20px 22px 26px;
                border: 1px solid var(--border-color);
                box-shadow: 0 24px 64px rgba(0,0,0,0.2);
                max-height: calc(100dvh - 80px); overflow-y: auto;
                box-sizing: border-box;
                transition: transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.4s cubic-bezier(0.16,1,0.3,1);
            }
            :host(.active) .sheet { transform: translate(-50%, 0); opacity: 1; }

            .hdr {
                display: flex; justify-content: space-between; align-items: center;
                margin-bottom: 18px;
            }
            .title {
                font-size: 1rem; font-weight: 500; letter-spacing: -0.01em;
                color: var(--text-primary);
            }
            .close-btn {
                width: 28px; height: 28px; border-radius: 50%;
                background: var(--color-card-alt); border: 1px solid var(--border-color);
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; color: var(--text-secondary); transition: background 0.15s;
            }
            .close-btn:active { background: var(--border-color); }

            label {
                display: block; font-size: 0.6875rem; font-weight: 400;
                color: var(--text-secondary); opacity: 0.7;
                text-transform: uppercase; letter-spacing: 0.01em;
                margin-bottom: 6px;
            }
            .fg { margin-bottom: 14px; }

            input[type=text], textarea {
                width: 100%; background: var(--color-bg);
                border: 1px solid var(--border-color); border-radius: 12px;
                padding: 10px 13px; color: var(--text-primary);
                font-family: var(--font-main, inherit); font-size: 0.875rem;
                box-sizing: border-box; outline: none; transition: border-color 0.2s;
            }
            textarea { resize: none; height: 68px; }
            input:focus, textarea:focus { border-color: var(--accent); }
            input[readonly], textarea[readonly] {
                background: transparent; border-color: transparent; padding-left: 0;
                font-weight: 500; cursor: default;
                border-bottom: 1px solid var(--border-color); border-radius: 0;
            }

            /* ── Calendar chip selector ── */
            .cs { display: flex; gap: 8px; margin-bottom: 18px; }
            .chip {
                padding: 7px 13px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;
                cursor: pointer; border: 2px solid transparent;
                background: var(--color-bg); color: var(--text-secondary); transition: all 0.15s;
            }
            .chip.on { border-color: var(--cc); color: var(--text-primary); background: color-mix(in srgb, var(--cc) 13%, var(--color-bg)); }
            .badge {
                display: inline-flex; align-items: center; padding: 5px 12px;
                border-radius: 12px; font-size: 0.75rem; font-weight: 600;
                background: color-mix(in srgb, var(--cc) 10%, var(--color-bg));
                border: 1px solid var(--cc); color: var(--text-primary); margin-bottom: 18px;
            }

            /* ── Date/time tap fields ── */
            .dt-row { display: flex; gap: 8px; margin-bottom: 10px; }
            .dt-btn {
                flex: 1; background: var(--color-bg); border: 1.5px solid var(--border-color);
                border-radius: 12px; padding: 10px 12px; cursor: pointer; text-align: left; transition: border-color 0.15s;
            }
            .dt-btn.lit { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--color-bg)); }
            .dt-lbl { font-size: 0.6rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.07em; opacity: 0.8; margin-bottom: 3px; }
            .dt-val { font-size: 0.82rem; font-weight: 600; color: var(--text-primary); }

            .divider { height: 1px; background: var(--border-color); opacity: 0.4; margin: 16px 0; }

            /* ── Action buttons (match light-popup close style but filled) ── */
            .actions { display: flex; gap: 10px; margin-top: 20px; }
            .btn {
                flex: 1; padding: 12px; border-radius: 12px; border: none;
                font-size: 0.875rem; font-weight: 500; cursor: pointer;
                font-family: var(--font-main, inherit); transition: opacity 0.15s, transform 0.15s;
            }
            .btn-cancel { background: var(--color-card-alt); color: var(--text-primary); border: 1px solid var(--border-color); }
            .btn-save   { background: var(--accent); color: white; }
            .btn:active { transform: scale(0.97); opacity: 0.85; }

            /* ══ SUB-SHEET (date / time picker) ════════════════════════════ */
            .sub-overlay {
                position: fixed; inset: 0;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
                z-index: 10001;
                display: flex; align-items: center; justify-content: center;
                padding: 16px;
                animation: fi 0.2s ease-out;
            }
            .sub-card {
                background: color-mix(in srgb, var(--color-card) 90%, transparent);
                backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
                width: 100%; max-width: 360px;
                border-radius: var(--radius-xl, 24px);
                padding: 20px 20px 24px;
                border: 1px solid var(--border-color);
                box-shadow: 0 24px 64px rgba(0,0,0,0.3);
                animation: su 0.28s cubic-bezier(0.16,1,0.3,1);
            }
            .sub-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
            .sub-title { font-size: 1rem; font-weight: 500; letter-spacing: -0.01em; color: var(--text-primary); }

            /* ── Month calendar ── */
            .mnav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
            .mlbl { font-size: 0.875rem; font-weight: 600; color: var(--text-primary); text-transform: capitalize; }
            .nbtn {
                width: 28px; height: 28px; border-radius: 50%;
                background: var(--color-card-alt); border: 1px solid var(--border-color);
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; color: var(--text-secondary); font-size: 1rem; line-height: 1;
                transition: background 0.15s;
            }
            .nbtn:active { background: var(--border-color); }
            .wdays { display: grid; grid-template-columns: repeat(7,1fr); text-align: center; margin-bottom: 4px; }
            .wdays span { font-size: 0.6rem; font-weight: 600; color: var(--text-secondary); opacity: 0.55; padding: 2px 0; }
            .cgrid { display: grid; grid-template-columns: repeat(7,1fr); gap: 2px; }
            .gc {
                aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
                border-radius: 50%; font-size: 0.82rem; cursor: pointer;
                color: var(--text-primary); transition: background 0.1s;
            }
            .gc:empty { cursor: default; }
            .gc:not(:empty):hover { background: var(--color-card-alt); }
            .gc.tod { color: var(--accent); font-weight: 700; }
            .gc.sel { background: var(--accent); color: #fff; font-weight: 700; }

            /* ── Drum roll time picker ── */
            .drum-scene {
                position: relative; height: ${IH * 3}px;
                border-radius: 16px; background: var(--color-bg);
                border: 1px solid var(--border-color); overflow: hidden;
            }
            /* z-index ladder: hl=1 (behind drums), drum-cols=2 (in front of hl), fade=3 (on top) */
            .drum-hl {
                position: absolute; left: 16px; right: 16px;
                top: 50%; transform: translateY(-50%); height: ${IH}px;
                background: color-mix(in srgb, var(--accent) 12%, var(--color-bg));
                border: 1.5px solid color-mix(in srgb, var(--accent) 35%, transparent);
                border-radius: 12px; pointer-events: none; z-index: 1;
            }
            .drum-fade {
                position: absolute; left: 0; right: 0; height: ${IH * 1.1}px;
                pointer-events: none; z-index: 3;
            }
            .drum-fade-t { top: 0;    background: linear-gradient(to bottom, var(--color-bg) 15%, transparent); }
            .drum-fade-b { bottom: 0; background: linear-gradient(to top,   var(--color-bg) 15%, transparent); }
            .drum-cols {
                position: absolute; inset: 0; z-index: 2;
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                align-items: center;
                padding: 0 20px;
            }
            .drum {
                height: ${IH * 3}px; overflow-y: scroll;
                scroll-snap-type: y mandatory; -webkit-overflow-scrolling: touch;
                scrollbar-width: none;
            }
            .drum::-webkit-scrollbar { display: none; }
            .dspc { height: ${IH}px; }
            .di {
                height: ${IH}px; display: flex; align-items: center; justify-content: center;
                scroll-snap-align: center; font-size: 2rem; font-weight: 700;
                color: var(--text-primary); user-select: none; font-family: var(--font-main, inherit);
            }
            .drum-sep {
                font-size: 2rem; font-weight: 700; color: var(--text-primary);
                padding: 0 8px; user-select: none;
                font-family: var(--font-main, inherit);
            }


            /* ── Tap-grid time picker ── */
            .tg-current {
                text-align: center; font-size: 2rem; font-weight: 700;
                letter-spacing: 0.04em; color: var(--text-primary);
                margin-bottom: 16px; font-family: var(--font-main, inherit);
            }
            .tg-section-lbl {
                font-size: 0.6rem; font-weight: 600; color: var(--text-secondary);
                text-transform: uppercase; letter-spacing: 0.07em; opacity: 0.7;
                margin-bottom: 6px;
            }
            .tg { display: grid; gap: 4px; }
            .tg-hours { grid-template-columns: repeat(6, 1fr); }
            .tg-mins  { grid-template-columns: repeat(6, 1fr); }
            .tg-cell {
                display: flex; align-items: center; justify-content: center;
                padding: 10px 4px; border-radius: 10px; cursor: pointer;
                font-size: 0.9rem; font-weight: 500; color: var(--text-primary);
                background: var(--color-bg); border: 1px solid var(--border-color);
                transition: background 0.1s, color 0.1s;
                font-family: var(--font-main, inherit);
            }
            .tg-cell:active { transform: scale(0.93); }
            .tg-cell.tg-sel {
                background: var(--accent); color: #fff;
                border-color: var(--accent); font-weight: 700;
            }

            @keyframes fi { from { opacity:0 } to { opacity:1 } }
            @keyframes su { from { transform:scale(0.95);opacity:0 } to { transform:scale(1);opacity:1 } }
        </style>`
    }

    // ─── Date sub-sheet HTML ─────────────────────────────────────────────────
    private buildDateSheet(which: "start" | "end"): string {
        const year  = this.pickerMonth.getFullYear()
        const month = this.pickerMonth.getMonth()
        const first = new Date(year, month, 1)
        let offset = first.getDay() - 1; if (offset < 0) offset = 6
        const days   = new Date(year, month + 1, 0).getDate()
        const today  = this.ds(new Date())
        const active = this.pendingDate || (which === "start" ? this.startDate : this.endDate)
        const title  = which === "start" ? "Startdatum" : "Slutdatum"
        const monthLabel = this.pickerMonth.toLocaleDateString("sv-SE", { month: "long", year: "numeric" })

        let cells = ""
        for (let i = 0; i < offset; i++) cells += `<div class="gc"></div>`
        for (let d = 1; d <= days; d++) {
            const ds = `${year}-${this.pad(month + 1)}-${this.pad(d)}`
            const sel = ds === active; const tod = ds === today && !sel
            cells += `<div class="gc${sel ? " sel" : ""}${tod ? " tod" : ""}" data-date="${ds}">${d}</div>`
        }

        return `
        <div class="sub-overlay" id="subOverlay">
        <div class="sub-card">
            <div class="sub-hdr">
                <div class="sub-title">${title}</div>
                <div class="close-btn" id="subClose"><iconify-icon icon="lucide:x" style="font-size:0.875rem"></iconify-icon></div>
            </div>
            <div class="mnav">
                <div class="nbtn" id="prevM">‹</div>
                <span class="mlbl">${monthLabel}</span>
                <div class="nbtn" id="nextM">›</div>
            </div>
            <div class="wdays"><span>M</span><span>T</span><span>O</span><span>T</span><span>F</span><span>L</span><span>S</span></div>
            <div class="cgrid" id="cgrid">${cells}</div>
            <div class="actions" style="margin-top:14px">
                <button class="btn btn-cancel" id="dateCancelBtn">Avbryt</button>
                <button class="btn btn-save" id="dateConfirmBtn">Välj</button>
            </div>
        </div>
        </div>`
    }

    // ─── Time sub-sheet HTML (barrel / drum) ─────────────────────────────────
    private buildTimeSheet(which: "start" | "end"): string {
        const title = which === "start" ? "Starttid" : "Sluttid"
        const hours = Array.from({ length: 24 }, (_, i) => `<div class="di">${this.pad(i)}</div>`).join("")
        const mins  = Array.from({ length: 12 }, (_, i) => `<div class="di">${this.pad(i * 5)}</div>`).join("")
        return `
        <div class="sub-overlay" id="subOverlay">
        <div class="sub-card">
            <div class="sub-hdr">
                <div class="sub-title">${title}</div>
                <div class="close-btn" id="subClose"><iconify-icon icon="lucide:x" style="font-size:0.875rem"></iconify-icon></div>
            </div>
            <div class="drum-scene">
                <div class="drum-hl"></div>
                <div class="drum-fade drum-fade-t"></div>
                <div class="drum-fade drum-fade-b"></div>
                <div class="drum-cols">
                    <div class="drum" id="hDrum">
                        <div class="dspc"></div>${hours}<div class="dspc"></div>
                    </div>
                    <div class="drum-sep">:</div>
                    <div class="drum" id="mDrum">
                        <div class="dspc"></div>${mins}<div class="dspc"></div>
                    </div>
                </div>
            </div>
            <div class="actions" style="margin-top:16px">
                <button class="btn btn-cancel" id="timeCancelBtn">Avbryt</button>
                <button class="btn btn-save"   id="timeDoneBtn">Välj</button>
            </div>
        </div>
        </div>`
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    render() {
        if (!this.isOpen) {
            this.shadowRoot!.innerHTML = ""
            this.style.display = "none"
            return
        }
        this.style.display = "block"

        const isViewing   = !!this.editingEvent
        const activePerson = getActivePerson()
        const availCals   = this.calendars.filter(c => !c.private || activePerson === "person.sebastian")
        const currentCal  = this.calendars.find(c  => c.id === this.selectedCalendar)

        let summary = "", desc = "", loc = "", sLabel = "", eLabel = ""
        if (this.editingEvent) {
            summary = this.editingEvent.summary     || ""
            desc    = this.editingEvent.description || ""
            loc     = this.editingEvent.location    || ""
            const sv = (v: any) => v?.dateTime || v?.date || v
            sLabel = this.editingEvent.start ? new Date(sv(this.editingEvent.start)).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : ""
            eLabel = this.editingEvent.end   ? new Date(sv(this.editingEvent.end)).toLocaleString("sv-SE",   { dateStyle: "short", timeStyle: "short" }) : ""
        }

        const subSheet =
            this.sheet === "date-start" ? this.buildDateSheet("start") :
            this.sheet === "date-end"   ? this.buildDateSheet("end")   :
            this.sheet === "time-start" ? this.buildTimeSheet("start") :
            this.sheet === "time-end"   ? this.buildTimeSheet("end")   : ""

        this.shadowRoot!.innerHTML = `
        ${this.shellCSS()}

        <div class="sheet" id="mainSheet">
            <div class="hdr">
                <div class="title">${isViewing ? "Händelseinfo" : "Ny händelse"}</div>
                <div class="close-btn" id="mainClose">
                    <iconify-icon icon="lucide:x" style="font-size:0.875rem"></iconify-icon>
                </div>
            </div>

            ${isViewing ? `
                <div class="badge" style="--cc:${currentCal?.color}">${currentCal?.label}</div>
            ` : `
                <div class="cs">
                    ${availCals.map(c => `
                        <div class="chip ${this.selectedCalendar === c.id ? "on" : ""}" data-id="${c.id}" style="--cc:${c.color}">${c.label}</div>
                    `).join("")}
                </div>
            `}

            <div class="fg">
                <label>Vad händer?</label>
                <input type="text" id="summary" placeholder="Titel..." value="${summary}" ${isViewing ? "readonly" : ""}>
            </div>
            <div class="fg">
                <label>Plats</label>
                <input type="text" id="location" placeholder="Plats..." value="${loc}" ${isViewing ? "readonly" : ""}>
            </div>

            ${isViewing ? `
                <div class="divider"></div>
                <div class="fg"><label>Start</label><div style="font-size:.875rem;font-weight:500;padding:3px 0;color:var(--text-primary)">${sLabel}</div></div>
                <div class="fg"><label>Slut</label><div style="font-size:.875rem;font-weight:500;padding:3px 0;color:var(--text-primary)">${eLabel}</div></div>
                ${desc ? `<div class="divider"></div><div class="fg"><label>Beskrivning</label><textarea id="desc" readonly>${desc}</textarea></div>` : ""}
            ` : `
                <div class="divider"></div>
                <div class="dt-row">
                    <div class="dt-btn ${this.sheet === "date-start" ? "lit" : ""}" id="btnDateStart">
                        <div class="dt-lbl">Startdatum</div>
                        <div class="dt-val">${this.fmtDate(this.startDate)}</div>
                    </div>
                    <div class="dt-btn ${this.sheet === "time-start" ? "lit" : ""}" id="btnTimeStart">
                        <div class="dt-lbl">Starttid</div>
                        <div class="dt-val">${this.fmtTime(this.startH, this.startM)}</div>
                    </div>
                </div>
                <div class="dt-row">
                    <div class="dt-btn ${this.sheet === "date-end" ? "lit" : ""}" id="btnDateEnd">
                        <div class="dt-lbl">Slutdatum</div>
                        <div class="dt-val">${this.fmtDate(this.endDate)}</div>
                    </div>
                    <div class="dt-btn ${this.sheet === "time-end" ? "lit" : ""}" id="btnTimeEnd">
                        <div class="dt-lbl">Sluttid</div>
                        <div class="dt-val">${this.fmtTime(this.endH, this.endM)}</div>
                    </div>
                </div>
                <div class="fg" style="margin-top:4px">
                    <label>Beskrivning</label>
                    <textarea id="desc" placeholder="Valfri beskrivning..."></textarea>
                </div>
            `}

            <div class="actions">
                <button class="btn btn-cancel" id="cancelBtn">Stäng</button>
                ${!isViewing ? `<button class="btn btn-save" id="saveBtn">Spara</button>` : ""}
            </div>
        </div>

        ${subSheet}
        `

        const root = this.shadowRoot!

        // ── Click outside main sheet → close popup ──
        const host = this as HTMLElement
        host.onclick = (e: MouseEvent) => { if (e.target === host) this.close() }

        // Stop clicks on sheet from bubbling to host
        root.getElementById("mainSheet")?.addEventListener("click", e => e.stopPropagation())

        root.getElementById("mainClose")?.addEventListener("click", () => {
            this.isOpen = false; this.editingEvent = null
            this.classList.remove("active")
            if (window.history.state?.type === "popup" && window.history.state?.id === "calendarPopup")
                window.history.back()
            this.render()
        })
        root.getElementById("cancelBtn")?.addEventListener("click", () => {
            this.isOpen = false; this.editingEvent = null
            this.classList.remove("active")
            if (window.history.state?.type === "popup" && window.history.state?.id === "calendarPopup")
                window.history.back()
            this.render()
        })
        root.getElementById("saveBtn")?.addEventListener("click", () => this.handleSave())

        root.querySelectorAll(".chip").forEach(chip =>
            chip.addEventListener("click", () => {
                this.selectedCalendar = chip.getAttribute("data-id")!
                this.render()
            })
        )

        if (!isViewing) {
            root.getElementById("btnDateStart")?.addEventListener("click", () => {
                const d = this.startDate ? new Date(this.startDate + "T00:00:00") : new Date()
                this.pickerMonth = new Date(d.getFullYear(), d.getMonth(), 1)
                this.pendingDate = this.startDate
                this.sheet = "date-start"; this.render()
            })
            root.getElementById("btnDateEnd")?.addEventListener("click", () => {
                const d = this.endDate ? new Date(this.endDate + "T00:00:00") : new Date()
                this.pickerMonth = new Date(d.getFullYear(), d.getMonth(), 1)
                this.pendingDate = this.endDate
                this.sheet = "date-end"; this.render()
            })
            root.getElementById("btnTimeStart")?.addEventListener("click", () => { this.sheet = "time-start"; this.render() })
            root.getElementById("btnTimeEnd")?.addEventListener("click",   () => { this.sheet = "time-end";   this.render() })
        }

        // ── Sub-sheet: stop ALL clicks from bubbling past shadow boundary ──
        // (otherwise host.onclick fires with e.target===host and calls close())
        root.getElementById("subOverlay")?.addEventListener("click", e => {
            e.stopPropagation()
            if (e.target === e.currentTarget) { this.sheet = "none"; this.render() }
        })
        root.getElementById("subClose")?.addEventListener("click", e => {
            e.stopPropagation()
            this.sheet = "none"; this.render()
        })

        // ── Date sheet events ──
        if (this.sheet === "date-start" || this.sheet === "date-end") {
            const which = this.sheet === "date-start" ? "start" : "end"
            root.getElementById("prevM")?.addEventListener("click", () => {
                this.pickerMonth = new Date(this.pickerMonth.getFullYear(), this.pickerMonth.getMonth() - 1, 1)
                this.render()
            })
            root.getElementById("nextM")?.addEventListener("click", () => {
                this.pickerMonth = new Date(this.pickerMonth.getFullYear(), this.pickerMonth.getMonth() + 1, 1)
                this.render()
            })
            // Tap day → highlight only (pending), don’t auto-close
            root.querySelectorAll(".gc[data-date]").forEach(cell =>
                cell.addEventListener("click", e => {
                    e.stopPropagation()
                    this.pendingDate = cell.getAttribute("data-date")!
                    this.render()
                })
            )
            // Confirm: apply pending → close
            root.getElementById("dateConfirmBtn")?.addEventListener("click", e => {
                e.stopPropagation()
                if (this.pendingDate) {
                    if (which === "start") this.startDate = this.pendingDate
                    else                   this.endDate   = this.pendingDate
                }
                this.pendingDate = ""
                this.sheet = "none"; this.render()
            })
            // Cancel: discard pending → close
            root.getElementById("dateCancelBtn")?.addEventListener("click", e => {
                e.stopPropagation()
                this.pendingDate = ""
                this.sheet = "none"; this.render()
            })
        }

        // ── Time sheet events ──
        if (this.sheet === "time-start" || this.sheet === "time-end") {
            const which = this.sheet === "time-start" ? "start" : "end"
            const curH  = which === "start" ? this.startH : this.endH
            const curM  = which === "start" ? this.startM : this.endM

            root.getElementById("timeCancelBtn")?.addEventListener("click", e => {
                e.stopPropagation()
                this.sheet = "none"; this.render()
            })
            root.getElementById("timeDoneBtn")?.addEventListener("click", e => {
                e.stopPropagation()
                const hDrum = root.getElementById("hDrum") as HTMLElement
                const mDrum = root.getElementById("mDrum") as HTMLElement
                const h = Math.min(23, Math.max(0, Math.round(hDrum.scrollTop / IH)))
                const m = (Math.min(11, Math.max(0, Math.round(mDrum.scrollTop / IH)))) * 5
                if (which === "start") { this.startH = h; this.startM = m }
                else                  { this.endH = h;   this.endM = m }
                this.sheet = "none"; this.render()
            })

            // Scroll drums to current value AFTER paint
            requestAnimationFrame(() => {
                const hDrum = root.getElementById("hDrum") as HTMLElement
                const mDrum = root.getElementById("mDrum") as HTMLElement
                if (hDrum) { hDrum.style.scrollBehavior = "auto"; hDrum.scrollTop = curH * IH }
                if (mDrum) { mDrum.style.scrollBehavior = "auto"; mDrum.scrollTop = (curM / 5) * IH }
                setTimeout(() => {
                    if (hDrum) hDrum.style.scrollBehavior = ""
                    if (mDrum) mDrum.style.scrollBehavior = ""
                }, 80)
            })
        }
    }
}

customElements.define("calendar-popup", CalendarPopup)
