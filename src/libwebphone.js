"use strict";

import EventEmitter from "events";
import i18next from "i18next";
import lwpKazoo from "./lwpKazoo";
import lwpMediaDevices from "./lwpMediaDevices";
import lwpUserAgent from "./lwpUserAgent";
import lwpDialpad from "./lwpDialpad";
import Mustache from "mustache";
import lwpCallControl from "./lwpCallControl";
import lwpCallList from "./lwpCallList";

export default class extends EventEmitter {
  constructor(config = {}, i18n = null) {
    super();
    this._calls = [];
    this._kazooPromise = new lwpKazoo(this, config, i18n);
    this._mediaDevicesPromise = new lwpMediaDevices(this, config, i18n);
    this._userAgentPromise = new lwpUserAgent(this, config, i18n);
    this._dialpadPromise = new lwpDialpad(this, config, i18n);
    this._callcontrolPromise = new lwpCallControl(this, config, i18n);
    this._callListPromise = new lwpCallList(this, config, i18n);
  } //end of constructor

  getKazoo() {
    return this._kazooPromise;
  }

  getMediaDevices() {
    return this._mediaDevicesPromise;
  }

  getUserAgent() {
    return this._userAgentPromise;
  }

  getDialpad() {
    return this._dialpadPromise;
  }

  getCallList() {
    return this._callListPromise;
  }

  getCalls() {
    return this._calls;
  }

  getCall(callId = null) {
    return this._calls.find(call => {
      if (callId) {
        return call.getId() == callId;
      } else {
        return call.isPrimary;
      }
    });
  }

  addCall(newCall) {
    this._calls.map(call => {
      if (call.isPrimary) {
        call.clearPrimary();
      }
    });
    this._calls.push(newCall);
    this.emit("call.added", this, newCall);
  }

  switchCall(callid) {
    let primaryCall;

    this.emit("call.primary", this, primaryCall);
  }

  removeCall(terminatedCall) {
    let terminatedId = terminatedCall.getId();
    this._calls = this._calls.filter(call => {
      return call.getId() != terminatedId;
    });
    this.emit("call.removed", this, terminatedCall);
  }

  _callEvent(type, call, ...data) {
    switch (type) {
      case "ended":
      case "failed":
        this.removeCall(call);
        break;
    }

    console.log("call event " + type, call, ...data);
    this.emit("call." + type, this, call);
    this.emit("call.updated", this, call);
  }
} //End of default class
