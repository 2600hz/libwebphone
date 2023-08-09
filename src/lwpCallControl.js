"use strict";

import lwpUtils from "./lwpUtils";
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
    this._emit("created", this);
    return this;
  }

  redial() {
    const userAgent = this._libwebphone.getUserAgent();
    if (userAgent) {
      userAgent.redial();
    }
  }

  cancel() {
    const currentCall = this._getCall();
    if (currentCall) {
      currentCall.cancel();
    }
  }

  hangup() {
    const currentCall = this._getCall();
    if (currentCall) {
      currentCall.hangup();
    }
  }

  hold() {
    const currentCall = this._getCall();
    if (currentCall) {
      currentCall.hold();
    }
  }

  unhold() {
    const currentCall = this._getCall();
    if (currentCall) {
      currentCall.unhold();
    }
  }

  mute() {
    const currentCall = this._getCall();
    if (currentCall) {
      currentCall.mute({ audio: true });
    }
  }

  unmute() {
    const currentCall = this._getCall();
    if (currentCall) {
      currentCall.unmute({ audio: true });
    }
  }

  muteVideo() {
    const currentCall = this._getCall();
    if (currentCall) {
      currentCall.mute({ video: true });
    }
  }

  unmuteVideo() {
    const currentCall = this._getCall();
    if (currentCall) {
      currentCall.unmute({ video: true });
    }
  }

  transfer() {
    const currentCall = this._getCall();
    if (currentCall) {
      currentCall.transfer();
    }
  }

  answer() {
    const currentCall = this._getCall();
    if (currentCall) {
      currentCall.answer();
    }
  }

  updateRenders(call = null) {
    let callSummary = null;
    const callList = this._libwebphone.getCallList();

    if (!call && callList) {
      this._call = callList.getCall();
    } else {
      this._call = call;
    }

    if (this._call) {
      callSummary = this._call.summary();
    }

    this.render((render) => {
      render.data = this._renderData(render.data, callSummary);
      return render;
    });
  }

  /** Init functions */

  _initInternationalization(config) {
    const defaults = {
      en: {
        answer: "Anwser",
        redial: "Redial",
        cancel: "Cancel",
        hangup: "Hang Up",
        hold: "Hold",
        unhold: "Resume",
        mute: "Mute Audio",
        unmute: "Unmute Audio",
        muteVideo: "Mute Video",
        unmuteVideo: "Unmute Video",
        transferblind: "Blind Transfer",
        transferattended: "Attended Transfer",
        transfercomplete: "Transfer (complete)",
      },
    };
    const resourceBundles = lwpUtils.merge(
      defaults,
      config.resourceBundles || {}
    );
    this._libwebphone.i18nAddResourceBundles("callControl", resourceBundles);
  }

  _initProperties(config) {
    const defaults = {
      renderTargets: [],
    };
    this._config = lwpUtils.merge(defaults, config);
  }

  _initEventBindings() {
    this._libwebphone.on("call.promoted", (lwp, call) => {
      this.updateRenders(call);
    });

    this._libwebphone.on("call.primary.progress", (lwp, call) => {
      this.updateRenders(call);
    });
    this._libwebphone.on("call.primary.established", (lwp, call) => {
      this.updateRenders(call);
    });

    this._libwebphone.on("call.primary.hold", (lwp, call) => {
      this.updateRenders(call);
    });
    this._libwebphone.on("call.primary.unhold", (lwp, call) => {
      this.updateRenders(call);
    });
    this._libwebphone.on("call.primary.muted", (lwp, call) => {
      this.updateRenders(call);
    });
    this._libwebphone.on("call.primary.unmuted", (lwp, call) => {
      this.updateRenders(call);
    });

    this._libwebphone.on("call.primary.transfer.collecting", (lwp, call) => {
      this.updateRenders(call);
    });
    this._libwebphone.on("call.primary.transfer.completed", (lwp, call) => {
      this.updateRenders(call);
    });

    this._libwebphone.on("call.primary.terminated", () => {
      this.updateRenders();
    });

    this._libwebphone.on("userAgent.call.failed", () => {
      this.updateRenders();
    });
  }

  _initRenderTargets() {
    this._config.renderTargets.map((renderTarget) => {
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
        muteVideo: "libwebphone:callControl.muteVideo",
        unmuteVideo: "libwebphone:callControl.unmuteVideo",
        transfercomplete: "libwebphone:callControl.transfercomplete",
        transferblind: "libwebphone:callControl.transferblind",
        transferattended: "libwebphone:callControl.transferattended",
      },
      data: lwpUtils.merge({}, this._config, this._renderData()),
      by_id: {
        redial: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.redial();
            },
          },
        },
        cancel: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.cancel();
            },
          },
        },
        hangup: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.hangup();
            },
          },
        },
        hold: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.hold();
            },
          },
        },
        unhold: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.unhold();
            },
          },
        },
        mute: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.mute();
            },
          },
        },
        unmute: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.unmute();
            },
          },
        },
        muteVideo: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.muteVideo();
            },
          },
        },
        unmuteVideo: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.unmuteVideo();
            },
          },
        },
        transfer: {
          events: {
            onclick: () => {
              this.transfer();
            },
          },
        },
        answer: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.answer();
            },
          },
        },
      },
    };
  }

  _renderDefaultTemplate() {
    return `
    <div>
      {{^data.call.hasSession}}
      {{#data.redial}}
        <button id="{{by_id.redial.elementId}}">
          {{i18n.redial}} ({{data.redial}})
        </button>
      {{/data.redial}}
      {{/data.call.hasSession}}

      {{#data.call.hasSession}}
        {{#data.call.progress}}
          <button id="{{by_id.cancel.elementId}}">
            {{i18n.cancel}}
          </button>
        {{/data.call.progress}}   

        {{#data.call.established}}
          <button id="{{by_id.hangup.elementId}}">
            {{i18n.hangup}}
          </button>

          {{^data.call.held}}
            <button id="{{by_id.hold.elementId}}">
              {{i18n.hold}}
            </button>
          {{/data.call.held}}

          {{#data.call.held}}
            <button id="{{by_id.unhold.elementId}}">
              {{i18n.unhold}}
            </button>
          {{/data.call.held}}

          {{^data.call.isAudioMuted}}
            <button id="{{by_id.mute.elementId}}">
              {{i18n.mute}}
            </button>
          {{/data.call.isAudioMuted}}

          {{#data.call.isAudioMuted}}
            <button id="{{by_id.unmute.elementId}}">
              {{i18n.unmute}}
            </button>
          {{/data.call.isAudioMuted}}

          {{^data.call.isVideoMuted}}
            <button id="{{by_id.muteVideo.elementId}}">
              {{i18n.muteVideo}}
            </button>
          {{/data.call.isVideoMuted}}
          
          {{#data.call.isVideoMuted}}
             <button id="{{by_id.unmuteVideo.elementId}}">
               {{i18n.unmuteVideo}}
            </button>
          {{/data.call.isVideoMuted}}

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
      {{/data.call.hasSession}}
    </div>
    `;
  }

  _renderData(data = {}, callSummary = null) {
    const userAgent = this._libwebphone.getUserAgent();

    if (userAgent) {
      data.redial = userAgent.getRedial();
    } else {
      data.redial = null;
    }

    data.call = callSummary;

    return data;
  }

  /** Helper functions */

  _getCall() {
    return this._call;
  }
}
