import { getEntity, subscribeEntity } from "../store/entity-store"
import { callService } from "../services/ha-service"
import type { HAEntity } from "../types/homeassistant"

class TvPopup extends HTMLElement {
    private shadow: ShadowRoot
    private config: any = {}
    private tvEntity?: HAEntity
    private mediaEntity?: HAEntity
    private soundbarEntity?: HAEntity;

    constructor() {
        super()
        this.shadow = this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.render()
    }

    open(config: any) {
        this.config = config
        this.tvEntity = getEntity(config.entityId)
        this.mediaEntity = config.mediaEntityId ? getEntity(config.mediaEntityId) : undefined
        this.soundbarEntity = config.soundbarId ? getEntity(config.soundbarId) : undefined

        this.style.display = "block"
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.classList.add("active")
            })
        })
        window.history.pushState({ type: "popup", id: "tvPopup" }, "")

        subscribeEntity(config.entityId, (e: HAEntity) => {
            this.tvEntity = e
            this.update()
        })

        if (config.mediaEntityId) {
            subscribeEntity(config.mediaEntityId, (e: HAEntity) => {
                this.mediaEntity = e
                this.update()
            })
        }

        if (config.soundbarId) {
            subscribeEntity(config.soundbarId, (e: HAEntity) => {
                this.soundbarEntity = e
                this.update()
            })
        }

        this.update()
    }

    close(fromHistory = false) {
        this.classList.remove("active")
        if (!fromHistory && window.history.state?.type === "popup" && window.history.state?.id === "tvPopup") {
            window.history.back()
        }
        setTimeout(() => {
            this.style.display = "none"
        }, 300)
    }

    private sendCommand(command: string) {
        if (!this.config.remoteId) return
        callService("remote", "send_command", {
            entity_id: this.config.remoteId,
            command: command,
            num_repeats: 1,
            delay_secs: 0.4
        })
    }

    private sendAdbCommand(command: string) {
        if (!this.config.mediaEntityId) return
        callService("androidtv" as any, "adb_command", {
            entity_id: this.config.mediaEntityId,
            command: command
        })
    }

    update() {
        // No visual updates needed for buttons currently
    }

    render() {
        this.shadow.innerHTML = `
<style>
/* Font Awesome Import inside Shadow DOM */
@import url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css");

:host {
    position: fixed;
    inset: 0;
    display: none;
    background: var(--color-overlay);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
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
    width: 260px;
    max-height: 92vh;
    overflow-y: auto;
    background: #e5e5e7;
    border-radius: 46px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.sheet::-webkit-scrollbar { display: none; }
:host(.active) .sheet {
    transform: translate(-50%, -50%);
    opacity: 1;
}

.top-bar {
    width: 100%;
    display: flex;
    justify-content: flex-end;
    margin-bottom: 15px;
}
.remote-power-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #333333;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #ffffff;
    padding: 0;
}
.remote-power-btn:active { background: #444444; }
.remote-power-btn i { font-size: 1.125rem; }

/* ── D-PAD ───────────────────────────────────────────── */
.dpad {
    position: relative;
    width: 200px;
    height: 200px;
    background: #333333;
    border-radius: 50%;
    margin-bottom: 30px;
}
.dpad-btn {
    position: absolute;
    background: transparent;
    border: none;
    color: #ffffff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    width: 40px;
    height: 40px;
}
.dpad-btn:active { opacity: 0.6; }
.dpad-btn .dot {
    width: 4px;
    height: 4px;
    background: #ffffff;
    border-radius: 50%;
}

.btn-up { top: -2px; left: 50%; transform: translateX(-50%); }
.btn-down { bottom: -2px; left: 50%; transform: translateX(-50%); }
.btn-left { left: -2px; top: 50%; transform: translateY(-50%); }
.btn-right { right: -2px; top: 50%; transform: translateY(-50%); }

.btn-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 104px; /* Increased from 80px */
    height: 104px;
    background: #3d3d3d;
    border-radius: 50%;
    cursor: pointer;
}
.btn-center:active { background: #4a4a4a; }

/* ── ROUND BUTTONS ──────────────────────────────────── */
.button-grid {
    display: grid;
    grid-template-columns: repeat(2, 72px); 
    gap: 20px 25px;
    margin-bottom: 35px;
}
.round-btn {
    width: 72px;
    height: 72px;
    background: #333333;
    border: none;
    border-radius: 50%;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
}
.round-btn:active { background: #444444; }
.round-btn i { font-size: 1.25rem; }
.round-btn svg { fill: currentColor; }
.round-btn iconify-icon { font-size: 2rem; }
.round-btn iconify-icon svg { stroke-width: 1.2; }
.round-btn ha-icon { --mdc-icon-size: 32px; width: 32px; height: 32px; }

/* ── VOLUME OVAL ────────────────────────────────────── */
.vol-oval {
    grid-row: span 2;
    width: 72px;
    height: 164px; /* 72*2 + 20 gap */
    background: #333333;
    border-radius: 36px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.vol-btn {
    flex: 1;
    border: none;
    background: transparent;
    color: #ffffff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}
.vol-btn:active { background: #444444; }
.vol-btn svg { width: 24px; height: 24px; }
.vol-divider {
    height: 1px;
    background: rgba(255,255,255,0.1);
    width: 40px;
    margin: 0 auto;
}
</style>

<div class="sheet">
    <div class="top-bar">
        <button class="remote-power-btn">
             <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0"/>
             </svg>
        </button>
    </div>
    
    <div class="dpad">
        <button class="dpad-btn btn-up" data-cmd="DPAD_UP">
            <div class="dot"></div>
        </button>
        <button class="dpad-btn btn-down" data-cmd="DPAD_DOWN">
            <div class="dot"></div>
        </button>
        <button class="dpad-btn btn-left" data-cmd="DPAD_LEFT">
            <div class="dot"></div>
        </button>
        <button class="dpad-btn btn-right" data-cmd="DPAD_RIGHT">
            <div class="dot"></div>
        </button>
        <div class="btn-center" data-cmd="DPAD_CENTER"></div>
    </div>

    <div class="button-grid">
        <button class="round-btn" data-cmd="BACK">
            <svg width="32" height="32" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button class="round-btn" data-cmd="HOME">
            <iconify-icon icon="ph:house" style="font-size:2rem;"></iconify-icon>
        </button>
        
        <button class="round-btn" data-cmd="MEDIA_PLAY_PAUSE">
            <svg width="36" height="36" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M10 12L5 7v10l5-5zM14 7v10M19 7v10"/></svg>
        </button>

        <div class="vol-oval">
            <button class="vol-btn" data-cmd="VOLUME_UP">
                <svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M12 5v14M5 12h14"/></svg>
            </button>
            <div class="vol-divider"></div>
            <button class="vol-btn" data-cmd="VOLUME_DOWN">
                <svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M5 12h14"/></svg>
            </button>
        </div>

        <button class="round-btn" data-cmd="VOLUME_MUTE">
            <svg width="32" height="32" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M11 5L6 9H2v6h4l5 4V5zm4 4l6 6m0-6l-6 6"/></svg>
        </button>

        <!-- Moved down -->
        <button class="round-btn" data-adb="adb shell am start -a android.intent.action.VIEW -d content://android.media.tv/passthrough/com.tcl.tvinput%2F.passthroughinput.TvPassThroughService%2FHW1413744384">
             <svg width="32" height="32" viewBox="0 0 48 48"><circle cx="13.5" cy="16.2" r="3.4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/><circle cx="34.5" cy="26.2" r="3.4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M21.5 5.5h-7.3c-4.8 0-8.7 3.9-8.7 8.6V34c0 4.7 3.9 8.6 8.7 8.6h7.3zm12.3 0h-7.3v37.1h7.3c4.8 0 8.7-3.9 8.7-8.6V14.1c0-4.7-3.9-8.6-8.7-8.6" stroke-width="2.4"/></svg>
        </button>
        <button class="round-btn" data-adb="adb shell am start -a android.intent.action.VIEW -d content://android.media.tv/passthrough/com.tcl.tvinput%2F.passthroughinput.TvPassThroughService%2FHW1413744128">
            <svg width="28" height="28" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linejoin="round" d="M2.5 18.5v-13l19-4v21zM10 4v16m-7.5-8h19" stroke-width="1.2"/></svg>
        </button>
    </div>
</div>
        `

        const host = this.shadow.host as HTMLElement
        const sheet = this.shadow.querySelector(".sheet") as HTMLElement
        const power = this.shadow.querySelector(".remote-power-btn") as HTMLElement

        sheet.onclick = e => e.stopPropagation()
        host.onclick = e => { if (e.target === host) this.close() }

        power.onclick = () => {
            if (this.config.powerScript) {
                const [domain, service] = this.config.powerScript.split('.')
                callService(domain as any, service, {})
            } else {
                callService("media_player", "toggle", { entity_id: this.config.entityId })
            }
        }

        // Commands
        this.shadow.querySelectorAll("[data-cmd]").forEach(btn => {
            btn.addEventListener("click", () => {
                const cmd = btn.getAttribute("data-cmd")!
                this.sendCommand(cmd)
            })
        })

        // ADB Commands
        this.shadow.querySelectorAll("[data-adb]").forEach(btn => {
            btn.addEventListener("click", () => {
                const cmd = btn.getAttribute("data-adb")!
                this.sendAdbCommand(cmd)
            })
        })
    }
}

customElements.define("tv-popup", TvPopup)
