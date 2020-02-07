"use strict";

import i18next from "i18next";
import lwpKazoo from "./lwpKazoo";
import lwpMediaDevices from "./lwpMediaDevices";
import lwpUserAgent from "./lwpUserAgent";
import lwpDialpad from "./lwpDialpad";

export default class {
  constructor(config = {}, i18n = null) {
    this._kazooPromise = new lwpKazoo(this, config, i18n);
    this._mediaDevicesPromise = new lwpMediaDevices(this, config, i18n);
    this._userAgentPromise = new lwpUserAgent(this, config, i18n);
    this._dialpadPromise = new lwpDialpad(this, config, i18n);
  } //end of constructor

  getKazoo() {
    return this._kazooPromise;
  }

  getMediaDevices() {
    return this._mediaDevicesPromise;
  }

  //Added by Mahfuz
  getUserAgent() {
    return this._userAgentPromise;
  }

  getDialpad() {
    return this._dialpadPromise;
  }

  getCalls() {
    return [];
  }

  switchCall(index) {
    call = this._switchCall(index);
    this.emit("switchCall", call);
    return call;
  }

  addCall(call) {
    call.on("end", this.removeCall(call));
    this._calls.push(call);
  }

  removeCall(call) {
    this._removeCall(call);
  }

  _removeCall(call) {}

  _switchCall(index) {}
} //End of default clas
