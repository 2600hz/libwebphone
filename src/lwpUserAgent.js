"use strict";

import { merge } from "./lwpUtils";
import * as JsSIP from "jssip";
import lwpCall from "./lwpCall";

export default class {
  constructor(libwebphone, config = {}, i18n = null) {
    this._libwebphone = libwebphone;
    this._emit = this._libwebphone._userAgentEvent;
    this._initProperties(config);
    this._initInternationalization(config.i18n || {});
    this._initSockets();
    this._initUserAgent();
    this._initEventBindings();
    this._emit("started", this);
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

  redial() {
    return this.call(this._redialNumber);
  }

  getRedial() {
    return this._redialNumber;
  }

  setRedial(number) {
    this._redialNumber = number;
    this._emit("redial.update", this, this._redialNumber);
  }

  call(numbertocall = null) {
    if (!numbertocall) {
      return;
    }

    this.setRedial(numbertocall);

    let mediaDevices = this._libwebphone.getMediaDevices();
    mediaDevices.startStreams().then(streams => {
      let options = {
        mediaStream: streams
      };

      this._userAgent.call(numbertocall, options);
    });
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
        user_agent: "libwebphone 2.x - dev",
        redial: "*97"
      }
    };

    this._config = merge(defaults, config);

    this._sockets = [];
    this._userAgent = null;
    this.setRedial(this._config.user_agent.redial);

    this._emit("lastcall.update", this, this._redialNumber);
  }

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

    //JsSIP.debug.enable("JsSIP:*");

    this._userAgent = new JsSIP.UA(config);
    this._userAgent.start();
    this._userAgent.on("newRTCSession", event => {
      new lwpCall(this._libwebphone, event.session);
    });

    this._userAgent.receiveRequest = request => {
      /** TODO: nasty hack because Kazoo appears to be lower-casing the request user... */
      let config_user = this._userAgent._configuration.uri.user;
      let ruri_user = request.ruri.user;
      if (config_user.toLowerCase() == ruri_user.toLowerCase()) {
        request.ruri.user = config_user;
      }
      return this._userAgent.__proto__.receiveRequest.call(
        this._userAgent,
        request
      );
    };

    return this._userAgent;
  }

  _initEventBindings() {}
}
