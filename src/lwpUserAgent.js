"use strict";

import { merge } from "./lwpUtils";
import * as JsSIP from "jssip";
import lwpCall from "./lwpCall";

export default class {
  constructor(libwebphone, config = {}, i18n = null) {
    this._libwebphone = libwebphone;
    this._initProperties(config);
    this._initInternationalization(config.i18n || {});
    this._initEventBindings();
    this._initSockets();
    this._initUserAgent();

    return this;
  }

  register() {
    this._userAgent.register();
  }

  unregister() {
    this._userAgent.unregister({
      all: true
    });
  }

  call(numbertocall, options) {
    this._userAgent.call(numbertocall, options);
  }

  /** Init functions */

  _initInternationalization(config) {
    let defaults = {
      en: {}
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("userAgent", resourceBundles);
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

    this._config = merge(defaults, config);

    this._sockets = [];
    this._userAgent = null;
  }

  _initEventBindings() {}

  _initSockets() {
    this._config.transport.sockets.forEach(socket => {
      // TODO: handle when socket is an object with weights...
      this._sockets.push(new JsSIP.WebSocketInterface(socket));
    });
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

    this._userAgent = new JsSIP.UA(config);
    this._userAgent.start();
    this._userAgent.on("newRTCSession", event => {
      new lwpCall(this._libwebphone, event.session);
    });

    return this._userAgent;
  }
}
