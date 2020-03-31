"use strict";

import i18next from "i18next";
import EventEmitter from "eventemitter2";

import lwpUserAgent from "./lwpUserAgent";
import lwpCallList from "./lwpCallList";
import lwpCallControl from "./lwpCallControl";
import lwpDialpad from "./lwpDialpad";
import lwpMediaDevices from "./lwpMediaDevices";
import lwpVideoCanvas from "./lwpVideoCanvas";

export default class extends EventEmitter {
  constructor(config = {}) {
    super();
    this._libwebphone = this;

    this._initInternationalization(config.i18n);

    this._userAgent = new lwpUserAgent(this, config.userAgent);
    this._callList = new lwpCallList(this, config.callList);
    this._callControl = new lwpCallControl(this, config.callControl);
    this._dialpad = new lwpDialpad(this, config.dialpad);
    this._mediaDevices = new lwpMediaDevices(this, config.mediaDevices);
    this._videoCanvas = new lwpVideoCanvas(this, config.videoCanvas);
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

  getVideoCanvas() {
    return this._videoCanvas;
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
    data.unshift(callList);
    data.unshift(this._libwebphone);
    data.unshift("callList." + type);
    this._libwebphone._emit.apply(this._libwebphone, data);
  }

  _callControlEvent(type, callControl, ...data) {
    data.unshift(callControl);
    data.unshift(this._libwebphone);
    data.unshift("callControl." + type);
    this._libwebphone._emit.apply(this._libwebphone, data);
  }
  _dialpadEvent(type, dialpad, ...data) {
    data.unshift(dialpad);
    data.unshift(this._libwebphone);
    data.unshift("dialpad." + type);
    this._libwebphone._emit.apply(this._libwebphone, data);
  }

  _userAgentEvent(type, userAgent, ...data) {
    data.unshift(userAgent);
    data.unshift(this._libwebphone);
    data.unshift("userAgent." + type);
    this._libwebphone._emit.apply(this._libwebphone, data);
  }

  _mediaDevicesEvent(type, mediaDevices, ...data) {
    data.unshift(mediaDevices);
    data.unshift(this._libwebphone);
    data.unshift("mediaDevices." + type);
    this._libwebphone._emit.apply(this._libwebphone, data);
  }

  _callEvent(type, call, ...data) {
    data.unshift(call);
    data.unshift(this._libwebphone);
    data.unshift("call." + type);

    this._libwebphone._emit.apply(this._libwebphone, data);

    if (call.isPrimary()) {
      data.shift();
      data.unshift("call.primary." + type);
      this._libwebphone._emit.apply(this._libwebphone, data);

      data.shift();
      data.unshift("call.primary.update");
      data.push(type);
      this._libwebphone._emit.apply(this._libwebphone, data);
    }
  }

  _videoCanvasEvent(type, video, ...data) {
    data.unshift(video);
    data.unshift(this._libwebphone);
    data.unshift("videoCanvas." + type);
    this._libwebphone._emit.apply(this._libwebphone, data);
  }

  _emit(...args) {
    this.emit(...args);
  }
} //End of default class
