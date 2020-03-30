"use strict";

import { merge } from "./lwpUtils";
import lwpRenderer from "./lwpRenderer";

export default class extends lwpRenderer {
  constructor(libwebphone, config = {}) {
    super(libwebphone);
    this._libwebphone = libwebphone;
    this._emit = this._libwebphone._callControlEvent;
    this._initProperties(config);
    this._initInternationalization(config.i18n || {});
    this._initEventBindings();
    this._initRenderTargets();
    this._emit("started", this);
    return this;
  }

  redial() {
    this._libwebphone.getUserAgent().redial();
  }

  cancel() {
    let currentCall = this._currentCall();
    if (currentCall) {
      currentCall.cancel();
    }
  }

  hangup() {
    let currentCall = this._currentCall();
    if (currentCall) {
      currentCall.hangup();
    }
  }

  hold() {
    let currentCall = this._currentCall();
    if (currentCall) {
      currentCall.hold();
    }
  }

  unhold() {
    let currentCall = this._currentCall();
    if (currentCall) {
      currentCall.unhold();
    }
  }

  mute() {
    let currentCall = this._currentCall();
    if (currentCall) {
      currentCall.mute();
    }
  }

  unmute() {
    let currentCall = this._currentCall();
    if (currentCall) {
      currentCall.unmute();
    }
  }

  transfer() {
    let currentCall = this._currentCall();
    if (currentCall) {
      currentCall.transfer();
    }
  }

  answer() {
    let currentCall = this._currentCall();
    if (currentCall) {
      currentCall.answer();
    }
  }

  updateRenders() {
    this.render(render => {
      render.data = this._renderData(render.data);
      return render;
    });
  }

  /** Init functions */

  _initInternationalization(config) {
    let defaults = {
      en: {
        answer: "Anwser",
        redial: "Redial",
        cancel: "Cancel",
        hangup: "Hang Up",
        hold: "Hold",
        unhold: "Resume",
        mute: "Mute",
        unmute: "Unmute",
        transferblind: "Blind Transfer",
        transferattended: "Attended Transfer",
        transfercomplete: "Transfer (complete)"
      }
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("callControl", resourceBundles);
  }

  _initProperties(config) {
    let defaults = {
      renderTargets: []
    };
    this._config = merge(defaults, config);
  }

  _initEventBindings() {
    this._libwebphone.on("call.primary.promoted", () => {
      this.updateRenders();
    });

    this._libwebphone.on("call.primary.progress", () => {
      this.updateRenders();
    });
    this._libwebphone.on("call.primary.established", () => {
      this.updateRenders();
    });

    this._libwebphone.on("call.primary.hold", () => {
      this.updateRenders();
    });
    this._libwebphone.on("call.primary.unhold", () => {
      this.updateRenders();
    });
    this._libwebphone.on("call.primary.muted", () => {
      this.updateRenders();
    });
    this._libwebphone.on("call.primary.unmuted", () => {
      this.updateRenders();
    });

    this._libwebphone.on("call.primary.transfer.collecting", () => {
      this.updateRenders();
    });
    this._libwebphone.on("call.primary.transfer.completed", () => {
      this.updateRenders();
    });
  }

  _initRenderTargets() {
    this._config.renderTargets.map(renderTarget => {
      return this.renderAddTarget(renderTarget);
    });
  }

  /** Render Helpers */

  _renderDefaultConfig() {
    return {
      template: this._renderDefaultTemplate(),
      i18n: {
        answer: "libwebphone:callControl.answer",
        redial: "libwebphone:callControl.redial",
        cancel: "libwebphone:callControl.cancel",
        hangup: "libwebphone:callControl.hangup",
        hold: "libwebphone:callControl.hold",
        unhold: "libwebphone:callControl.unhold",
        mute: "libwebphone:callControl.mute",
        unmute: "libwebphone:callControl.unmute",
        transfercomplete: "libwebphone:callControl.transfercomplete",
        transferblind: "libwebphone:callControl.transferblind",
        transferattended: "libwebphone:callControl.transferattended"
      },
      data: merge(this._config, this._renderData()),
      by_id: {
        redial: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              element.disabled = true;
              this.redial();
            }
          }
        },
        cancel: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              element.disabled = true;
              this.cancel();
            }
          }
        },
        hangup: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              element.disabled = true;
              this.hangup();
            }
          }
        },
        hold: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              element.disabled = true;
              this.hold();
            }
          }
        },
        unhold: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              element.disabled = true;
              this.unhold();
            }
          }
        },
        mute: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              element.disabled = true;
              this.mute();
            }
          }
        },
        unmute: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              element.disabled = true;
              this.unmute();
            }
          }
        },
        transfer: {
          events: {
            onclick: event => {
              this.transfer();
            }
          }
        },
        answer: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              element.disabled = true;
              this.answer();
            }
          }
        }
      }
    };
  }

  _renderDefaultTemplate() {
    return `
    <div>
      {{^data.call}}
      {{#data.redial}}
      <button id="{{by_id.redial.elementId}}">
        {{i18n.redial}} ({{data.redial}})
      </button>
      {{/data.redial}}
      {{/data.call}}

      {{#data.call}}
      {{#data.call.progress}}
      <button id="{{by_id.cancel.elementId}}">
        {{i18n.cancel}}
      </button>
      {{/data.call.progress}}   

      {{#data.call.established}}
      <button id="{{by_id.hangup.elementId}}">
        {{i18n.hangup}}
      </button>

      {{^data.call.hold}}
      <button id="{{by_id.hold.elementId}}">
        {{i18n.hold}}
      </button>
      {{/data.call.hold}}

      {{#data.call.hold}}
      <button id="{{by_id.unhold.elementId}}">
        {{i18n.unhold}}
      </button>
      {{/data.call.hold}}

      {{^data.call.muted}}
      <button id="{{by_id.mute.elementId}}">
        {{i18n.mute}}
      </button>
      {{/data.call.muted}}

      {{#data.call.muted}}
      <button id="{{by_id.unmute.elementId}}">
        {{i18n.unmute}}
      </button>
      {{/data.call.muted}}

      <button id="{{by_id.transfer.elementId}}">
        {{^data.call.inTransfer}}
        {{i18n.transferblind}}
        {{/data.call.inTransfer}}

        {{#data.call.inTransfer}}
        {{i18n.transfercomplete}}
        {{/data.call.inTransfer}}
      </button>
      {{/data.call.established}}

      {{#data.call.terminating}}
      {{#data.call.progress}}
      <button id="{{by_id.answer.elementId}}">
        {{i18n.answer}}
      </button>
      {{/data.call.progress}}
      {{/data.call.terminating}}
      {{/data.call}}
    </div>
    `;
  }

  _renderData(data = {}) {
    let currentCall = this._currentCall();
    let userAgent = this._libwebphone.getUserAgent();

    if (currentCall) {
      data.call = currentCall.summary();
    } else {
      data.call = null;
    }

    if (userAgent) {
      data.redial = userAgent.getRedial();
    }

    return data;
  }

  /** Helper functions */

  _currentCall() {
    return this._libwebphone.getCallList().getCall();
  }
}
