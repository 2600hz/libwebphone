"use strict";

import EventEmitter from "events";
import i18next from "i18next";
import _ from "lodash";
import Mustache from "mustache";
import * as JsSIP from "jssip";

export default class extends EventEmitter {
  constructor(libwebphone, config = {}, i18n = null) {
    super();
    this._libwebphone = libwebphone;
    this._lastCall = "";
    return this._initInternationalization(config.i18n, i18n)
      .then(() => {
        return this._initProperties(config.callControl);
      })
      .then(() => {
        this._libwebphone.on("call.added", () => this.updateControls());
        this._libwebphone.on("call.updated", () => this.updateControls());
        this._libwebphone.on("call.removed", () => this.updateControls());
      })
      .then(() => {
        return Promise.all(
          this._config.renderTargets.map(renderConfig => {
            return this.render(renderConfig);
          })
        );
      })
      .then(() => {
        return this;
      });
  }

  async call(numbertocall = null) {
    if (!numbertocall) {
      numbertocall = await this._libwebphone.getDialpad().then(dialpad => {
        let digits = dialpad.digits();
        dialpad.clear();
        return digits.join("");
      });
      if (!numbertocall) {
        numbertocall = this._lastCall;
      } else {
        this._lastCall = numbertocall;
      }
    }

    return this._libwebphone.getUserAgent().then(userAgent => {
      let ua = userAgent.getUserAgent();
      console.log("call to: ", numbertocall);
      console.log("user-agent: ", ua);
      this._libwebphone.getMediaDevices().then(mediaDevices => {
        var stream = mediaDevices.startStreams();
        var options = {
          mediaStream: stream
        };
        var session = ua.call(numbertocall, options);
        console.log("outbound call, add to session list : ", session);
      });
    });
  }

  hangup() {
    let currentCall = this._currentCall();
    currentCall.hangup();
  }

  cancel() {
    let currentCall = this._currentCall();
    currentCall.cancel();
  }

  hold() {
    let currentCall = this._currentCall();
    currentCall.hold();
  }

  unhold() {
    let currentCall = this._currentCall();
    currentCall.unhold();
  }

  answer() {
    let currentCall = this._currentCall();
    currentCall.hangup();
  }

  updateControls() {
    this._renders.forEach(render => {
      render.config.call = this._callRenderConfig();
      this._renderUpdate(render);
    });
  }

  render(config = {}) {
    return new Promise(resolve => {
      let template = config.template || this._defaultTemplate();
      let renderConfig = this._renderConfig(config);
      let render = {
        html: Mustache.render(template, renderConfig),
        template: template,
        config: renderConfig
      };
      resolve(render);
    }).then(render => {
      let buttons = render.config.buttons;

      if (!render.config.root.element && render.config.root.elementId) {
        render.config.root.element = document.getElementById(
          render.config.root.elementId
        );
      }

      render.config.root.element.innerHTML = render.html;

      Object.keys(buttons).forEach(button => {
        let elementId = buttons[button].elementId;
        let element = document.getElementById(elementId);
        buttons[button].element = element;

        if (element) {
          Object.keys(buttons[button].events || {}).forEach(event => {
            let callback = buttons[button].events[event];
            element[event] = callback;
          });
        }
      });

      this._renders.push(render);
    });
  }

  /** Init functions */

  _initInternationalization(config = { fallbackLng: "en" }, i18n = null) {
    if (i18n) {
      this._translator = i18n;
      return Promise.resolve();
    }

    var i18nPromise = i18next.init(config);
    i18next.addResourceBundle("en", "libwebphone", {
      callcontrol: {
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
    });

    return i18nPromise.then(translator => (this._translator = translator));
  }

  _initProperties(config) {
    var defaults = {};
    this._config = this._merge(defaults, config);

    this._config.renderTargets.forEach((target, index) => {
      if (typeof target == "string") {
        this._config.renderTargets[index] = {
          root: {
            elementId: target,
            element: document.getElementById(target)
          }
        };
      }
    });

    this._renders = [];

    return Promise.resolve();
  }

  _currentCall() {
    return this._libwebphone.getCall();
  }

  _callRenderConfig() {
    let currentCall = this._currentCall();
    if (currentCall) {
      return currentCall.summary();
    }
  }

  /** Render Helpers */

  _renderUpdate(render) {
    render.html = Mustache.render(render.template, render.config);
    render.config.root.element.innerHTML = render.html;
    let buttons = render.config.buttons;
    Object.keys(buttons).forEach(button => {
      let elementId = buttons[button].elementId;
      let element = document.getElementById(elementId);
      buttons[button].element = element;

      if (element) {
        Object.keys(buttons[button].events || {}).forEach(event => {
          let callback = buttons[button].events[event];
          element[event] = callback;
        });
      }
    });
  }

  _renderConfig(config = {}) {
    let i18n = this._translator;
    var randomElementId = () => {
      return (
        "lwp" +
        Math.random()
          .toString(36)
          .substr(2, 9)
      );
    };
    var defaults = {
      i18n: {
        call: i18n("libwebphone:callcontrol.call"),
        cancel: i18n("libwebphone:callcontrol.cancel"),
        hangup: i18n("libwebphone:callcontrol.hangup"),
        hold: i18n("libwebphone:callcontrol.hold"),
        unhold: i18n("libwebphone:callcontrol.unhold"),
        mute: i18n("libwebphone:callcontrol.mute"),
        unmute: i18n("libwebphone:callcontrol.unmute"),
        transfer: i18n("libwebphone:callcontrol.transfer"),
        answer: i18n("libwebphone:callcontrol.answer")
      },
      call: this._callRenderConfig(),
      buttons: {
        call: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              this.call();
            }
          }
        },
        cancel: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              this.cancel();
            }
          }
        },
        hangup: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              this.hangup();
            }
          }
        },
        hold: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              this.hold();
            }
          }
        },
        unhold: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              this.unhold();
            }
          }
        },
        answer: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              this.answer();
            }
          }
        }
      }
    };

    return this._merge(defaults, config);
  }

  _defaultTemplate() {
    return `
    <div>
      <button id="{{buttons.call.elementId}}">
        {{i18n.call}}
      </button>

      {{#call.progress}}
      <button id="{{buttons.cancel.elementId}}">
        {{i18n.cancel}}
      </button>
      {{/call.progress}}   

      {{#call.established}}
      <button id="{{buttons.hangup.elementId}}">
        {{i18n.hangup}}
      </button>

      {{^call.hold}}
      <button id="{{buttons.hold.elementId}}">
        {{i18n.hold}}
      </button>
      {{/call.hold}}

      {{#call.hold}}
      <button id="{{buttons.unhold.elementId}}">
        {{i18n.unhold}}
      </button>
      {{/call.hold}}

      {{^call.mute}}
      <button id="{{buttons.mute.elementId}}">
        {{i18n.mute}}
      </button>
      {{/call.mute}}

      {{#call.mute}}
      <button id="{{buttons.unmute.elementId}}">
        {{i18n.unmute}}
      </button>
      {{/call.mute}}

      <button id="{{buttons.transfer.elementId}}">
        {{i18n.transfer}}
      </button>
      {{/call.established}}

      {{#call.terminating}}
      {{#call.progress}}
      <button id="{{buttons.answer.elementId}}">
        {{i18n.answer}}
      </button>
      {{/call.progress}}
      {{/call.terminating}}
    </div>
    `;
  }

  _merge(...args) {
    return _.merge(...args);
  }
} //end of lwpPhoneUtils class
