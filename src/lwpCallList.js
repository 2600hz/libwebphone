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
    this._emit("created", this);
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
        return call.isPrimary() && call.hasSession();
      }
    });
  }

  addCall(newCall) {
    let previousCall = this.getCall();

    this._calls.map(call => {
      if (call.isPrimary) {
        call._clearPrimary();
      }
    });

    /** TODO: save a timestamp to the primary call,
     * during remoteCall attempt to switch to the call
     * wiht a session that has the largest timestamp
     * if the removed call was a primary
     */

    this._calls.push(newCall);
    this._emit("calls.added", this, newCall);

    newCall._setPrimary();
    this._emit("calls.switched", this, newCall, previousCall);
  }

  switchCall(callid) {
    let previousCall = this.getCall();
    let primaryCall = this.getCall(callid);

    this._calls.map(call => {
      if (call.isPrimary) {
        call._clearPrimary();
      }
    });

    /** TODO: save a timestamp to the primary call,
     * during remoteCall attempt to switch to the call
     * wiht a session that has the largest timestamp
     * if the removed call was a primary
     */

    if (primaryCall) {
      primaryCall._setPrimary();
      this._emit("calls.switched", this, primaryCall, previousCall);
    }
  }

  removeCall(terminatedCall) {
    let terminatedId = terminatedCall.getId();

    this._calls = this._calls.filter(call => {
      return call.getId() != terminatedId;
    });
    this._emit("calls.removed", this, terminatedCall);

    if (terminatedCall.isPrimary()) {
      let withSession = this._calls.find(call => {
        return call.hasSession();
      });

      if (withSession) {
        withSession._setPrimary(false);
        this._emit("calls.switched", this, withSession, terminatedCall);
      } else {
        this._libwebphone.getMediaDevices().stopStreams();
        if (this._calls.length > 0) {
          this._calls[0]._setPrimary();
          this._emit("calls.switched", this, null, terminatedCall);
        }
      }

      terminatedCall._clearPrimary();
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
    newCall._setPrimary();
    this._calls = [newCall];
  }

  _initEventBindings() {
    this._libwebphone.on("callList.calls.switched", () => {
      this.updateRenders();
    });

    /** TODO: make all these call.pimary.* when we don't need the debugging info */
    this._libwebphone.on("call.created", (lwp, call) => {
      this.updateRenders();
    });

    this._libwebphone.on("call.promoted", () => {
      this.updateRenders();
    });

    this._libwebphone.on("call.progress", () => {
      this.updateRenders();
    });
    this._libwebphone.on("call.established", () => {
      this.updateRenders();
    });

    this._libwebphone.on("call.hold", () => {
      this.updateRenders();
    });
    this._libwebphone.on("call.unhold", () => {
      this.updateRenders();
    });
    this._libwebphone.on("call.muted", () => {
      this.updateRenders();
    });
    this._libwebphone.on("call.unmuted", () => {
      this.updateRenders();
    });
    this._libwebphone.on("call.transfer.collecting", () => {
      this.updateRenders();
    });
    this._libwebphone.on("call.transfer.completed", () => {
      this.updateRenders();
    });

    this._libwebphone.on("call.ended", () => {
      this.updateRenders();
    });
    this._libwebphone.on("call.failed", () => {
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
        new: "libwebphone:callList.new"
      },
      data: merge(this._renderData(), this._config),
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
          <input type="radio" id="{{by_name.calls.elementName}}{{callId}}" name="{{by_name.calls.elementName}}" value="{{callId}}" checked="checked">
          <label for="{{by_name.calls.elementName}}{{callId}}">{{i18n.new}}</label>
        {{/primary}}

        {{^primary}}
          <input type="radio" id="{{by_name.calls.elementName}}{{callId}}" name="{{by_name.calls.elementName}}" value="{{callId}}">
          <label for="{{by_name.calls.elementName}}{{callId}}">{{i18n.new}}</label>
        {{/primary}}
      {{/hasSession}}

      {{#hasSession}}
        {{#primary}}
        <input type="radio" id="{{by_name.calls.elementName}}{{callId}}"  name="{{by_name.calls.elementName}}" value="{{callId}}" checked="checked">
        {{/primary}}

        {{^primary}}
        <input type="radio" id="{{by_name.calls.elementName}}{{callId}}"  name="{{by_name.calls.elementName}}" value="{{callId}}">
        {{/primary}}

        <label for="{{by_name.calls.elementName}}{{callId}}">{{remote_identity}}
          <ul>
            <li>call id: {{callId}}</li>
            <li>primary: {{primary}}</li>
            <li>progress: {{progress}}</li>
            <li>established: {{established}}</li>
            <li>hold: {{hold}}</li>
            <li>muted: {{muted}}</li>
            <li>inTransfer: {{inTransfer}}</li>
            <li>ended: {{ended}}</li>
            <li>direction: {{direction}}</li>
          </ul>
        </label>
      {{/hasSession}}
      {{/data.calls}}


    `;
  }

  _renderData(data = {}) {
    data.calls = this.getCalls().map(call => {
      return call.summary();
    });

    data.primary = this.getCall();

    return data;
  }

  /** Helper functions */
}
