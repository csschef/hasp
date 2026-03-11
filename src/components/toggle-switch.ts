class ToggleSwitch extends HTMLElement {

    private shadow: ShadowRoot
    private checked = false

    constructor() {
        super()
        this.shadow = this.attachShadow({ mode: "open" })
    }

    connectedCallback() {

        this.checked = this.getAttribute("checked") === "true"

        this.render()

    }

    setState(state: boolean) {
        this.checked = state
        this.render()
    }

    toggle() {

        this.checked = !this.checked

        this.dispatchEvent(new CustomEvent("toggle", {
            bubbles: true,
            composed: true,
            detail: { state: this.checked }
        }))

        this.render()

    }

    render() {

        const checkedClass = this.checked ? "checked" : ""
        const accent = this.getAttribute("accent") || "var(--accent)"

        this.shadow.innerHTML = `

      <style>

        .switch {
          width: 32px;
          height: 18px;
          background: var(--border-color);
          border-radius: 18px;
          position: relative;
          cursor: pointer;
          transition: background 0.2s ease;
          box-shadow:
            inset 0 2px 4px rgba(0,0,0,0.22),
            inset 0 1px 2px rgba(0,0,0,0.15);
        }

        .switch.checked {
          background: ${accent};
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
          transition: transform 0.2s ease;
          box-shadow:
            0 1px 4px rgba(0,0,0,0.30),
            0 0 0 0.5px rgba(0,0,0,0.10),
            inset 0 1px 0 rgba(255,255,255,0.85);
        }

        .switch.checked .knob {
          transform: translateX(14px);
        }

      </style>

      <div class="switch ${checkedClass}">
        <div class="knob"></div>
      </div>
    `

        const switchEl = this.shadow.querySelector(".switch") as HTMLElement

        switchEl.onclick = (e) => {
            e.stopPropagation()
            this.toggle()
        }

    }

}

customElements.define("toggle-switch", ToggleSwitch)