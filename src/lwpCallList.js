"use strict";

import { merge } from "./lwpUtils";
import lwpRenderer from "./lwpRenderer";
import lwpCall from "./lwpCall";

export default class extends lwpRenderer {
  constructor(libwebphone, config = {}) {
    super(libwebphone);
    this._libwebphone = libwebphone;
    this._emit = this._libwebphone._callListEvent;
    this._initProperties(config);
    this._initInternationalization(config.i18n || {});
    this._initEventBindings();
    this._initRenderTargets();
    this._emit("started", this);
    return this;
  }

  getCalls() {
    return this._calls;
  }

  getCall(callId = null) {
    return this._calls.find(call => {
      if (callId) {
        return call.getId() == callId;
      } else {
        return call.isPrimary();
      }
    });
  }

  addCall(newCall) {
    this._calls.map(call => {
      if (call.isPrimary) {
        call.clearPrimary();
      }
    });
    newCall.setPrimary();
    /** TODO: save a timestamp to the primary call,
     * during remoteCall attempt to switch to the call
     * wiht a session that has the largest timestamp
     * if the removed call was a primary
     */
    this._calls.push(newCall);
  }

  switchCall(callid) {
    this._calls.map(call => {
      if (call.isPrimary) {
        call.clearPrimary();
      }
    });
    let primaryCall = this.getCall(callid);
    if (primaryCall) {
      primaryCall.setPrimary();
    }
    /** TODO: save a timestamp to the primary call,
     * during remoteCall attempt to switch to the call
     * wiht a session that has the largest timestamp
     * if the removed call was a primary
     */
    this.updateRenders();
  }

  removeCall(terminatedCall) {
    let terminatedId = terminatedCall.getId();

    this._calls = this._calls.filter(call => {
      return call.getId() != terminatedId;
    });

    if (terminatedCall.isPrimary) {
      let withSession = this._calls.find(call => {
        call.hasSession();
      });
      if (withSession) {
        withSession.setPrimary();
      } else if (this._calls.length > 0) {
        this._calls[0].setPrimary();
      }
    }
  }

  updateRenders() {
    let calls = this._getCallSummaries();
    this.render(render => {
      render.data.calls = calls;
      return render;
    });
  }

  /** Init functions */

  _initInternationalization(config) {
    let defaults = {
      en: {
        new: "New Call"
      }
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("callList", resourceBundles);
  }

  _initProperties(config) {
    let defaults = {
      renderTargets: []
    };
    this._config = merge(defaults, config);

    let newCall = new lwpCall(this._libwebphone);
    newCall.setPrimary();
    this._calls = [newCall];
  }

  _initEventBindings() {
    this._libwebphone.on("call.created", (lwp, call) => {
      this.addCall(call);
      this.updateRenders();
    });
    this._libwebphone.on("call.failed", (lwp, call) => {
      this.removeCall(call);
      this.updateRenders();
    });
    this._libwebphone.on("call.ended", (lwp, call) => {
      this.removeCall(call);
      this.updateRenders();
    });
    this._libwebphone.on("call.updated", () => this.updateRenders());
  }

  _initRenderTargets() {
    this._config.renderTargets.map(renderTarget => {
      return this.renderAddTarget(renderTarget);
    });
  }

  /** Render Helpers */

  _renderDefaultConfig() {
    let i18n = this._libwebphone.i18nTranslator();
    return {
      template: this._renderDefaultTemplate(),
      i18n: {
        new: "libwebphone:callList.new"
      },
      data: {
        calls: this._getCallSummaries(),
        primary: this.getCall()
      },
      by_name: {
        calls: {
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
  }

  _renderDefaultTemplate() {
    return `
      {{#data.calls}}

      {{^hasSession}}
        {{#primary}}
        <input type="radio" name="{{by_name.calls.elementName}}" value="{{callId}}" checked="checked">
        <label for="{{callId}}">{{i18n.new}}</label>
        {{/primary}}

        {{^primary}}
        <input type="radio" name="{{by_name.calls.elementName}}" value="{{callId}}">
        <label for="{{callId}}">{{i18n.new}}</label>
        {{/primary}}
      {{/hasSession}}

      {{#hasSession}}

        {{#primary}}
        <input type="radio" name="{{by_name.calls.elementName}}" value="{{callId}}" checked="checked">
        {{/primary}}

        {{^primary}}
        <input type="radio" name="{{by_name.calls.elementName}}" value="{{callId}}">
        {{/primary}}

        <label for="{{callId}}">{{local_identity}} -> {{remote_identity}}
          <ul>
            <li>call id: {{callId}}</li>
            <li>primary: {{primary}}</li>
            <li>progress: {{progress}}</li>
            <li>established: {{established}}</li>
            <li>hold: {{hold}}</li>
            <li>muted: {{muted}}</li>
            <li>ended: {{ended}}</li>
            <li>direction: {{direction}}</li>
          </ul>
        </label>
      {{/hasSession}}
      {{/data.calls}}


    `;
  }

  /** Helper functions */

  _getCallSummaries() {
    return this.getCalls().map(call => {
      return call.summary();
    });
  }
}
