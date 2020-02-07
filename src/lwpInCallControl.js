"use strict";

import EventEmitter from "events";
import i18next from "i18next";
import _ from "lodash";
import Mustache from "mustache";

export default class extends EventEmitter {
  constructor(libwebphone, config = {}, i18n = null) {
    super();
    this._libwebphone = libwebphone;
    this._digits = [];
    return this._initInternationalization(config.i18n, i18n)
      .then(() => {
        return this._initProperties(config.dialpad);
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

  transfer(target, type = 'blind'){
  }

  hold() {
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
        place_audio: "Place Audio Call",
        place_video: "Place Video Call"
      }
    });

    return i18nPromise.then(translator => (this._translator = translator));
  }

  _initProperties(config) {
    var defaults = {
      options: {
        audio: true,
        video: true
      }
    };
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

  /** Util Functions */
  _merge(...args) {
    return _.merge(...args);
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
        place_audio: i18n('libwebphone:callcontrol.place_audio'),
        place_video: i18n('libwebphone:callcontrol.place_video'),
        cancel: i18n('libwebphone:callcontrol.cancel'),
        reject: i18n('libwebphone:callcontrol.reject'),
        hangup: i18n('libwebphone:callcontrol.hangup'),
        answer_audio: i18n('libwebphone:callcontrol.answer_audio')          
        answer_video: i18n('libwebphone:callcontrol.answer_video')          
      },
      buttons: {
        place_audio: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              this.startAudioCall();
            }
          }
        },
        place_video: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              this.startVideoCall();
            }
          }
        },
        cancel: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              this.cancelActive(digit);
            }
          }
        },
        hangup: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              this.hangupActive(digit);
            }
          }
        },
        reject: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              this.reject(digit);
            }
          }
        },
        answer_audio: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              this.answerAudio(digit);
            }
          }
        },
        answer_video: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              this.answerVideo(digit);
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
    {{#state.idle}}
        {{#options.audio}}
            <button id="{{buttons.place_audio.elementId}}">{{i18n.transfer}}</button>
        {{/options.audio}}
        {{#options.video}}
            <button id="{{buttons.place_video.elementId}}">{{i18n.hold}}</button>
        {{/options.video}}        
    {{/state.idle}}

    {{#state.originating}}
        <button id="{{buttons.cancel.elementId}}" data-value="1">Cancel</button>
    {{/state.originating}}

    {{#state.established}}
      <button id="{{buttons.hangup.elementId}}" data-value="1">Hangup</button>
    {{/state.established}}
    
    {{#state.terminating}}
      <button id="{{buttons.reject.elementId}}" data-value="1">Reject</button>
      {{#options.audio}}
        <button id="{{buttons.answer_audio.elementId}}" data-value="1">Answer Audio</button>
      {{/options.audio}}
      {{#options.video}}
        <button id="{{buttons.answer_video.elementId}}" data-value="1">Answer Video</button>
      {{/options.video}}      
    {{/state.terminating}}    

	  </div>
    `;
  }
}
