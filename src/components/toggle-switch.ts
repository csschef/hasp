class ToggleSwitch extends HTMLElement {

    private shadow: ShadowRoot
    private checked = false
    private built = false

    constructor() {
        super()
        this.shadow = this.attachShadow({ mode: "open" })
    }

    connectedCallback() {
        this.checked = this.getAttribute("checked") === "true"
        // Read accent BEFORE build so the first stylesheet bakes in the right colour
        const accent = this.getAttribute("accent") || ""
        this.build(accent)
        this.applyState()
    }

    setState(state: boolean) {
        this.checked = state
        this.applyState()
    }

    toggle() {
        this.checked = !this.checked

        this.dispatchEvent(new CustomEvent("toggle", {
            bubbles: true,
            composed: true,
            detail: { state: this.checked }
        }))

        this.applyState()
    }

    /**
     * Build the shadow DOM exactly once.
     * `initialAccent` is embedded directly into the stylesheet so the very first
     * browser paint already shows the correct colour — no yellow flash.
     */
    private build(initialAccent: string) {
        if (this.built) return
        this.built = true

        // Resolve the accent: if one is provided use it, otherwise fall back to the
        // global --accent token. Embedding this in the stylesheet (not set via JS later)
        // means there is zero chance the browser paints with the wrong colour first.
        const accentValue = initialAccent || "var(--accent)"

        this.shadow.innerHTML = `
      <style>
        :host {
          --toggle-accent: ${accentValue};
        }

        .switch {
          width: 32px;
          height: 18px;
          background: var(--border-color);
          border-radius: 18px;
          position: relative;
          cursor: pointer;
          transition: background 0.15s ease;
          box-shadow:
            inset 0 2px 4px rgba(0,0,0,0.22),
            inset 0 1px 2px rgba(0,0,0,0.15);
        }

        .switch.checked {
          background: var(--toggle-accent);
          box-shadow:
            inset 0 2px 4px rgba(0,0,0,0.28),
            inset 0 1px 2px rgba(0,0,0,0.18);
        }

        .knob {
          width: 14px;
          height: 14px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: transform 0.15s ease;
          box-shadow:
            0 1px 4px rgba(0,0,0,0.30),
            0 0 0 0.5px rgba(0,0,0,0.10),
            inset 0 1px 0 rgba(255,255,255,0.85);
        }

        .switch.checked .knob {
          transform: translateX(14px);
        }
      </style>

      <div class="switch">
        <div class="knob"></div>
      </div>
    `

        const switchEl = this.shadow.querySelector(".switch") as HTMLElement
        switchEl.onclick = (e) => {
            e.stopPropagation()
            this.toggle()
        }
    }

    /** Update only the class + CSS var — no DOM rebuild. */
    private applyState() {
        if (!this.built) return

        const switchEl = this.shadow.querySelector(".switch") as HTMLElement | null
        if (!switchEl) return

        // Update the accent var so CSS transition animates it smoothly
        const accent = this.getAttribute("accent") || ""
        const hostEl = this.shadow.host as HTMLElement
        if (accent) {
            hostEl.style.setProperty("--toggle-accent", accent)
        } else {
            hostEl.style.removeProperty("--toggle-accent")
        }

        switchEl.classList.toggle("checked", this.checked)
    }

    static get observedAttributes() { return ["accent", "checked"] }

    attributeChangedCallback(name: string, _old: string, val: string) {
        if (!this.built) return
        if (name === "checked") this.checked = val === "true"
        this.applyState()
    }

}

customElements.define("toggle-switch", ToggleSwitch)