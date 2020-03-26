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
    this._libwebphone = this;

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

  _initInternationalization(config = { fallbackLng: "en" }) {
    this._i18nPromise = i18next.init(config).then(translator => {
      this._translator = translator;
      this._libwebphone._emit(
        "language.changed",
        this._libwebphone,
        translator
      );
    });
  }

  _callListEvent(type, callList, ...data) {
    this._libwebphone._emit("calllist." + type, this._libwebphone, callList);
    this._libwebphone._emit("calllist.updated", this._libwebphone, callList);
  }

  _callControlEvent(type, callControl, ...data) {
    this._libwebphone._emit(
      "callcontrol." + type,
      this._libwebphone,
      callControl
    );
    this._libwebphone._emit(
      "callcontrol.updated",
      this._libwebphone,
      callControl
    );
  }
  _dialpadEvent(type, dialpad, ...data) {
    this._libwebphone._emit("dialpad." + type, this._libwebphone, dialpad);
    this._libwebphone._emit("dialpad.updated", this._libwebphone, dialpad);
  }

  _userAgentEvent(type, userAgent, ...data) {
    this._libwebphone._emit("userAgent." + type, this._libwebphone, userAgent);
    this._libwebphone._emit("userAgent.updated", this._libwebphone, userAgent);
  }

  _mediaDevicesEvent(type, mediaDevices, ...data) {
    this._libwebphone._emit(
      "mediaDevices." + type,
      this._libwebphone,
      mediaDevices
    );
    this._libwebphone._emit(
      "mediaDevices.updated",
      this._libwebphone,
      mediaDevices
    );
  }

  _callEvent(type, call, ...data) {
    this._libwebphone._emit("call." + type, this._libwebphone, call);
    this._libwebphone._emit("call.updated", this._libwebphone, call);
  }

  _emit(...args) {
    console.log(...args);
    this.emit(...args);
  }
} //End of default class
