"use strict";

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
} //End of default clas
