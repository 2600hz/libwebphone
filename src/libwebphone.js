"use strict";

import i18next from "i18next";
import EventEmitter from "events";
import lwpMediaDevices from "./lwpMediaDevices";
import lwpUserAgent from "./lwpUserAgent";
import lwpDialpad from "./lwpDialpad";
import lwpCallControl from "./lwpCallControl";
import lwpCallList from "./lwpCallList";

export default class extends EventEmitter {
  constructor(config = {}) {
    super();

    this._initInternationalization(config.i18n);

    this._callList = new lwpCallList(this, config.callList);
    this._callControl = new lwpCallControl(this, config.callControl);
    this._dialpad = new lwpDialpad(this, config.dialpad);
    this._userAgent = new lwpUserAgent(this, config.userAgent);
    this._mediaDevices = new lwpMediaDevices(this, config.mediaDevices);
  } //end of constructor

  getCallControl() {
    return this._callControl;
  }

  getCallList() {
    return this._callList;
  }

  getDialpad() {
    return this._dialpad;
  }

  getUserAgent() {
    return this._userAgent;
  }

  getMediaDevices() {
    return this._mediaDevices;
  }

  geti18n() {
    return i18next;
  }

  i18nAddResourceBundles(module, resources) {
    for (let lang in resources) {
      this.i18nAddResourceBundle(module, lang, resources[lang]);
    }
  }

  i18nAddResourceBundle(module, lang, resource) {
    let bundle = {};
    bundle[module] = resource;
    i18next.addResourceBundle(lang, "libwebphone", bundle, true);
  }

  i18nTranslator() {
    return this._translator;
  }

  _callEvent(type, call, ...data) {
    this.emit("call." + type, this, call);
    this.emit("call.updated", this, call);
  }

  _dialpadEvent(type, dialpad, ...data) {
    this.emit("dialpad." + type, this, dialpad);
    this.emit("dialpad.updated", this, dialpad);
  }

  _initInternationalization(config = { fallbackLng: "en" }) {
    this._i18nPromise = i18next.init(config).then(translator => {
      this._translator = translator;
      this.emit("language.changed", this, translator);
    });
  }
} //End of default class
