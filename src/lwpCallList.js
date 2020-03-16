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
    return this._initInternationalization(config.i18n, i18n)
      .then(() => {
        return this._initProperties(config.callList);
      })
      .then(() => {
        return Promise.all(
          this._config.renderTargets.map(renderConfig => {
            return this.render(renderConfig);
          })
        );
      })
      .then(() => {
        this._libwebphone.on("call.added", () => this.updateCalls());
        this._libwebphone.on("call.updated", () => this.updateCalls());
        this._libwebphone.on("call.removed", () => this.updateCalls());
      })
      .then(() => {
        return this;
      });
  }

  switchCall(callid) {
    return this._libwebphone.switchCall(callid);
  }

  updateCalls() {
    let calls = this._getCalls();
    this._renders.forEach(render => {
      render.config.calls = calls;
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
      calllist: {}
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

  /** Render Helpers */

  _renderUpdate(render) {
    render.html = Mustache.render(render.template, render.config);
    render.config.root.element.innerHTML = render.html;
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
      i18n: {},
      calls: this._getCalls(),
      buttons: {
        call: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              let element = event.srcElement;
              let callid = element.value;
              this.switchCall(callid);
            }
          }
        }
      }
    };

    return this._merge(defaults, config);
  }

  _defaultTemplate() {
    return `
      {{#calls}}

      {{#primary}}
      <input type="radio" name="lwpcalllist" value="{{callId}}" selected>
      {{/primary}}


      {{^primary}}
      <input type="radio" name="lwpcalllist" value="{{callId}}">
      {{/primary}}

      <label for="{{callId}}">progress: {{progress}} established: {{established}} hold: {{hold}} muted: {{muted}} ended: {{ended}}  direction: {{direction}}</label><br>
      {{/calls}}
    `;
  }

  _merge(...args) {
    return _.merge(...args);
  }

  _getCalls() {
    return this._libwebphone.getCalls().map(call => {
      return call.summary();
    });
  }
} //end of lwpPhoneUtils class
