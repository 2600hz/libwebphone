//Added by Mahfuz

"use strict";

import EventEmitter from "events";
import i18next from "i18next";
import _ from "lodash";
import Mustache from "mustache";
import * as JsSIP from "jssip";
import lwpCall from "./lwpCall";

export default class extends EventEmitter {
  constructor(libwebphone, config = {}, i18n = null) {
    super();
    this._libwebphone = libwebphone;
    this._sockets = [];
    this._userAgent = null;
    return this._initInternationalization(config.i18n, i18n)
      .then(() => {
        return this._initProperties(config.userAgent);
      })
      .then(() => {
        return this._initSockets();
      })
      .then(() => {
        return this._initUserAgent();
      })
      .then(() => {
        console.log(this);
        return this;
      });
  }

  register() {
    return this._userAgent.then(ua => {
      ua.register();
    });
  }

  unregister() {
    return this._userAgent.then(ua => {
      ua.unregister({
        all: true
      });
    });
  }

  getUserAgent() {
    return this._userAgent;
  }

  /** TODO: add inbound call event handers */

  /** Init functions */

  _initInternationalization(config = { fallbackLng: "en" }, i18n = null) {
    if (i18n) {
      this._translator = i18n;
      return Promise.resolve();
    }

    var i18nPromise = i18next.init(config);
    i18next.addResourceBundle("en", "libwebphone", {
      phoneUtils: {}
    });

    return i18nPromise.then(translator => (this._translator = translator));
  }

  _initProperties(config) {
    var defaults = {
      transport: {
        sockets: [],
        recovery_max_interval: 30,
        recovery_min_interval: 2
      },
      authentication: {
        username: "",
        password: "",
        realm: ""
      },
      user_agent: {
        //contact_uri: "",
        //display_name: "",
        //instance_id: "8f1fa16a-1165-4a96-8341-785b1ef24f12",
        no_answer_timeout: 60,
        register: true,
        register_expires: 300,
        user_agent: "libwebphone 2.x - dev"
      }
    };

    this._config = this._merge(defaults, config);

    return Promise.resolve();
  }

  _initSockets() {
    this._config.transport.sockets.forEach(socket => {
      // TODO: handle when socket is an object with weights...
      this._sockets.push(new JsSIP.WebSocketInterface(socket));
    });

    return Promise.resolve();
  }

  _initUserAgent() {
    let config = {
      sockets: this._sockets,
      uri:
        this._config.authentication.username +
        "@" +
        this._config.authentication.realm,
      authorization_user: this._config.authentication.username,
      connection_recovery_max_interval: this._config.transport
        .recovery_max_interval,
      connection_recovery_min_interval: this._config.transport
        .recovery_min_interval,
      contact_uri: this._config.user_agent.contact_uri,
      display_name: this._config.user_agent.display_name,
      instance_id: this._config.user_agent.instance_id,
      no_answer_timeout: this._config.user_agent.no_answer_timeout,
      password: this._config.authentication.password,
      realm: this._config.authentication.realm,
      register: this._config.user_agent.register,
      register_expires: this._config.user_agent.register_expires,
      user_agent: this._config.user_agent.user_agent,
      session_timers: false
    };
    this._userAgent = Promise.resolve(new JsSIP.UA(config));
    this._userAgent.then(ua => {
      this._userAgent = ua;
      this._userAgent.start();
      this._userAgent.on("newRTCSession", event => {
        new lwpCall(this._libwebphone, event.session);
      });
    });

    return this._userAgent;
  }

  /** Util Functions */

  _merge(...args) {
    return _.merge(...args);
  }
} //end of lwpPhoneUtils class
