"use strict";

import { merge } from "./lwpUtils";
import lwpRenderer from "./lwpRenderer";

export default class extends lwpRenderer {
  constructor(libwebphone, config = {}) {
    super();
    this._libwebphone = libwebphone;
    this._initProperties(config);
    this._initInternationalization(config.i18n || {});
    this._initEvents();
    this._initRenderTargets();
    return this;
  }

  call(numbertocall = null) {
    if (!numbertocall) {
      let dialpad = this._libwebphone.getDialpad();
      numbertocall = dialpad.digits().join("");
      dialpad.clear();

      if (!numbertocall) {
        numbertocall = this._lastCall;
      } else {
        this._lastCall = numbertocall;
      }
    }

    this._libwebphone.getMediaDevices().then(mediaDevices => {
      let userAgent = this._libwebphone.getUserAgent();
      let stream = mediaDevices.startStreams();
      let options = {
        mediaStream: stream
      };
      userAgent.call(numbertocall, options);
    });
  }

  cancel() {
    this._currentCall().cancel();
  }

  hangup() {
    this._currentCall().hangup();
  }

  hold() {
    this._currentCall().hold();
  }

  unhold() {
    this._currentCall().unhold();
  }

  mute() {
    this._currentCall().mute();
  }

  unmute() {
    this._currentCall().unmute();
  }

  transfer() {
    this._currentCall().transfer();
  }

  answer() {
    this._currentCall().answer();
  }

  updateControls() {
    this.renderUpdates(render => {
      render.data.call = this._callRenderConfig();
    });
    this.render();
  }

  /** Init functions */

  _initInternationalization(config) {
    let defaults = {
      en: {
        call: "Call",
        cancel: "Cancel",
        hangup: "Hang Up",
        hold: "Hold",
        unhold: "Resume",
        mute: "Mute",
        unmute: "Unmute",
        transfer: "Transfer",
        answer: "Anwser"
      }
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("callControl", resourceBundles);
  }

  _initProperties(config) {
    let defaults = {};
    this._config = merge(defaults, config);
    this._lastCall = "*97";
  }

  _initEvents() {
    this._libwebphone.on("call.added", () => this.updateControls());
    this._libwebphone.on("call.updated", () => this.updateControls());
    this._libwebphone.on("call.removed", () => this.updateControls());
    this._libwebphone.on("language.changed", () => this.render());
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
        call: "libwebphone:callControl.call",
        cancel: "libwebphone:callControl.cancel",
        hangup: "libwebphone:callControl.hangup",
        hold: "libwebphone:callControl.hold",
        unhold: "libwebphone:callControl.unhold",
        mute: "libwebphone:callControl.mute",
        unmute: "libwebphone:callControl.unmute",
        transfer: "libwebphone:callControl.transfer",
        answer: "libwebphone:callControl.answer"
      },
      data: {
        call: this._callRenderConfig()
      },
      by_id: {
        call: {
          events: {
            onclick: event => {
              this.call();
            }
          }
        },
        cancel: {
          events: {
            onclick: event => {
              this.cancel();
            }
          }
        },
        hangup: {
          events: {
            onclick: event => {
              this.hangup();
            }
          }
        },
        hold: {
          events: {
            onclick: event => {
              this.hold();
            }
          }
        },
        unhold: {
          events: {
            onclick: event => {
              this.unhold();
            }
          }
        },
        mute: {
          events: {
            onclick: event => {
              this.mute();
            }
          }
        },
        unmute: {
          events: {
            onclick: event => {
              this.unmute();
            }
          }
        },
        answer: {
          events: {
            onclick: event => {
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
      {{^data.call.hasSession}}
      <button id="{{by_id.call.elementId}}">
        {{i18n.call}}
      </button>
      {{/data.call.hasSession}}

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

      {{^data.call.mute}}
      <button id="{{by_id.mute.elementId}}">
        {{i18n.mute}}
      </button>
      {{/data.call.mute}}

      {{#data.call.mute}}
      <button id="{{by_id.unmute.elementId}}">
        {{i18n.unmute}}
      </button>
      {{/data.call.mute}}

      <button id="{{by_id.transfer.elementId}}">
        {{i18n.transfer}}
      </button>
      {{/data.call.established}}

      {{#data.call.terminating}}
      {{#data.call.progress}}
      <button id="{{by_id.answer.elementId}}">
        {{i18n.answer}}
      </button>
      {{/data.call.progress}}
      {{/data.call.terminating}}
    </div>
    `;
  }

  /** Helper functions */

  _currentCall() {
    let call = this._libwebphone.getCallList().getCall();
    return call;
  }

  _callRenderConfig() {
    let currentCall = this._currentCall();
    if (currentCall) {
      return currentCall.summary();
    }
  }
}
