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

        this.shadow.innerHTML = `

      <style>

        .switch {

          width: 42px;
          height: 24px;

          background: var(--border-color);

          border-radius: 20px;

          position: relative;

          cursor: pointer;

          transition: background 0.2s ease;

        }

        .switch.checked {

          background: var(--accent);

        }

        .knob {

          width: 18px;
          height: 18px;

          background: white;

          border-radius: 50%;

          position: absolute;

          top: 3px;
          left: 3px;

          transition: transform 0.2s ease;

        }

        .switch.checked .knob {

          transform: translateX(18px);

        }

      </style>

      <div class="switch ${checkedClass}">
        <div class="knob"></div>
      </div>
    `

        const switchEl = this.shadow.querySelector(".switch") as HTMLElement

        switchEl.onclick = () => this.toggle()

    }

}

customElements.define("toggle-switch", ToggleSwitch)