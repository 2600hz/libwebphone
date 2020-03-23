"use strict";

import EventEmitter from "events";
import i18next from "i18next";
import _ from "lodash";

export default class extends EventEmitter {
  constructor(libwebphone, config = {}, i18n = null) {
    super();
    this._libwebphone = libwebphone;
    return this._initInternationalization(config.i18n, i18n)
      .then(() => {
        return this._initProperties(config.phoneUtils);
      })
      .then(() => {
        return this;
      });
  }

  kazooSubscribe(Type) {}

  kazooUnsubscribe(Type) {}

  kazooRequest(type, url, options) {}

  _initInternationalization(config = { fallbackLng: "en" }, i18n = null) {
    if (i18n) {
      this._translator = i18n;
      return Promise.resolve();
    }

    var i18nPromise = i18next.init(config);
    i18next.addResourceBundle("en", "libwebphone", {
      transport: {}
    });

    return i18nPromise.then(translator => (this._translator = translator));
  }

  _initProperties(config) {
    var defaults = {
      sockets: [],
      api: "https://sandbox.2600hz.com:8443/v2",
      authentication: {
        username: "",
        password: "",
        account_name: ""
      }
    };

    this._config = this._merge(defaults, config);

    return Promise.resolve();
  }

  /** Util Functions */
  _merge(...args) {
    return _.merge(...args);
  }
}
