import { getActivePerson, setActivePerson, getEntity } from "../store/entity-store";

class SettingsPopup extends HTMLElement {
    private isOpen = false;

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
        this.render();
    }

    public open() {
        this.isOpen = true;
        this.render();
    }

    public close() {
        this.isOpen = false;
        this.render();
    }

    private selectPerson(person: string) {
        setActivePerson(person);
        this.close();
    }

    render() {
        if (!this.isOpen) {
            this.shadowRoot!.innerHTML = "";
            return;
        }

        const activePersonId = getActivePerson();
        const person = getEntity(activePersonId);
        const coords = person?.attributes.latitude ? `${person.attributes.latitude.toFixed(3)}, ${person.attributes.longitude.toFixed(3)}` : "Ingen GPS-data";

        this.shadowRoot!.innerHTML = `
        <style>
            .backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.7);
                backdrop-filter: blur(10px);
                z-index: 9000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                animation: fadeIn 0.3s ease;
            }
            .content {
                background: #1c1c1e;
                width: 100%;
                max-width: 340px;
                border-radius: 28px;
                padding: 24px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                border: 1px solid rgba(255,255,255,0.1);
            }
            h2 { margin: 0 0 8px 0; font-size: 20px; color: #fff; text-align: center; }
            p { margin: 0 0 24px 0; font-size: 14px; color: #8e8e93; text-align: center; }
            
            .options { display: flex; flex-direction: column; gap: 12px; }
            
            .option {
                background: rgba(255,255,255,0.05);
                border-radius: 16px;
                padding: 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                cursor: pointer;
                transition: all 0.2s;
                border: 2px solid transparent;
            }
            .option.active {
                background: rgba(0,122,255,0.1);
                border-color: #007aff;
            }
            .option:active { transform: scale(0.98); }
            
            .name { flex: 1; font-weight: 500; color: #fff; }
            .check { color: #007aff; font-size: 20px; display: none; }
            .option.active .check { display: block; }

            .debug-info {
                margin-top: 24px;
                padding: 12px;
                background: rgba(0,0,0,0.2);
                border-radius: 12px;
                font-family: monospace;
                font-size: 11px;
                color: #8e8e93;
            }
            .debug-title { font-weight: bold; margin-bottom: 4px; color: #aaa; }

            .close-btn {
                margin-top: 24px;
                width: 100%;
                background: #2c2c2e;
                color: #fff;
                border: none;
                border-radius: 14px;
                padding: 14px;
                font-weight: 600;
                cursor: pointer;
            }

            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>
        <div class="backdrop" id="backdrop">
            <div class="content">
                <h2>Enhetsinställningar</h2>
                <p>Anpassa vyn för den här enheten.</p>
                
                <div class="options">
                    <div class="option ${activePersonId === 'person.sebastian' ? 'active' : ''}" data-person="person.sebastian">
                        <span class="name">Sebastian</span>
                        <span class="check">✓</span>
                    </div>
                    <div class="option ${activePersonId === 'person.sara' ? 'active' : ''}" data-person="person.sara">
                        <span class="name">Sara</span>
                        <span class="check">✓</span>
                    </div>
                </div>

                <div class="debug-info">
                    <div class="debug-title">DEBUG INFO</div>
                    <div>Entity: ${activePersonId}</div>
                    <div>GPS: ${coords}</div>
                    <div>HA Connection: ${person ? 'OK' : 'Väntar på data...'}</div>
                </div>

                <button class="close-btn" id="closeBtn">Färdig</button>
            </div>
        </div>
        `;

        this.shadowRoot!.getElementById("backdrop")?.addEventListener("click", (e) => {
            if (e.target === e.currentTarget) this.close();
        });

        this.shadowRoot!.getElementById("closeBtn")?.addEventListener("click", () => this.close());

        this.shadowRoot!.querySelectorAll(".option").forEach(opt => {
            opt.addEventListener("click", () => {
                const person = opt.getAttribute("data-person")!;
                this.selectPerson(person);
            });
        });
    }
}

customElements.define("settings-popup", SettingsPopup);
