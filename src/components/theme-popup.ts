class ThemePopup extends HTMLElement {
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
        this.classList.add("active");
        document.body.classList.add("popup-open");
        this.render();
        window.history.pushState({ type: "popup", id: "themePopup" }, "")
    }

    public close(fromHistory = false) {
        this.isOpen = false;
        this.classList.remove("active");
        
        // Check if any OTHER popups are still open before unlocking scroll
        const otherPopups = ["lightPopup", "historyPopup", "tvPopup", "personPopup", "settingsPopup", "todoPopup", "calendarPopup", "themePopup"]
            .filter(id => id !== "themePopup")
            .some(id => document.getElementById(id)?.classList.contains("active"));
        
        if (!otherPopups) document.body.classList.remove("popup-open");

        if (!fromHistory && window.history.state?.type === "popup" && window.history.state?.id === "themePopup") {
            window.history.back()
        }
        this.render();
    }

    private selectThemeColor(colorId: string) {
        localStorage.setItem("ha-theme-color", colorId);
        document.documentElement.setAttribute("data-theme-color", colorId);
        window.dispatchEvent(new Event("theme-changed"));
        this.render();
    }

    render() {
        if (!this.isOpen) {
            this.shadowRoot!.innerHTML = "";
            return;
        }

        const currentColor = document.documentElement.getAttribute("data-theme-color") || "standard";

        this.shadowRoot!.innerHTML = `
        <style>
            .backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.4);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 9000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                animation: fadeIn 0.3s ease;
            }
            .content {
                background: var(--color-card);
                width: 100%;
                max-width: 340px;
                border-radius: var(--radius-xl, 28px);
                padding: 24px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                border: 1px solid var(--border-color);
                overflow: hidden;
            }
            h2 { margin: 0 0 8px 0; font-size: 1.25rem; color: var(--text-primary); text-align: center; }
            p { margin: 0 0 24px 0; font-size: 0.875rem; color: var(--text-secondary); text-align: center; }
            
            .options { display: flex; flex-direction: column; gap: 12px; }
            
            .option {
                background: var(--color-card-alt);
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
                background: var(--accent-low, rgba(0,122,255,0.05));
                border-color: var(--accent);
            }
            .option:active { transform: scale(0.98); }
            
            .color-preview {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                flex-shrink: 0;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
            }

            .name { font-weight: 500; color: var(--text-primary); }
            .check { color: var(--accent); font-size: 1.25rem; display: none; margin-left: auto; }
            .option.active .check { display: block; }
            
            .theme-desc { font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px; }

            .close-btn {
                margin-top: 24px;
                width: 100%;
                background: var(--color-card-alt);
                color: var(--text-primary);
                border: none;
                border-radius: 14px;
                padding: 14px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.2s;
            }
            .close-btn:active { background: var(--border-color); }

            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>
        <div class="backdrop" id="backdrop">
            <div class="content">
                <h2>Tema</h2>
                <p>Anpassa utseendet på gränssnittet.</p>
                
                <div class="options">
                    <div class="option ${currentColor === 'standard' ? 'active' : ''}" data-color="standard">
                        <div class="color-preview" style="background: linear-gradient(135deg, #5b7fa6 0%, #2e3440 100%);"></div>
                        <div>
                            <div class="name">Standard</div>
                            <div class="theme-desc">Nordisk isblå och mörk sten</div>
                        </div>
                        <span class="check"><iconify-icon icon="ph:check-bold"></iconify-icon></span>
                    </div>

                    <div class="option ${currentColor === 'ios' ? 'active' : ''}" data-color="ios">
                        <div class="color-preview" style="background: linear-gradient(135deg, #007aff 0%, #4da4ea 100%);"></div>
                        <div>
                            <div class="name">Homey (iOS)</div>
                            <div class="theme-desc">Runt, mjukt & Apple Blå</div>
                        </div>
                        <span class="check"><iconify-icon icon="ph:check-bold"></iconify-icon></span>
                    </div>

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
                const color = opt.getAttribute("data-color")!;
                this.selectThemeColor(color);
            });
        });
    }
}

customElements.define("theme-popup", ThemePopup);
