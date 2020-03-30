"use strict";

import * as JsSIP from "jssip";
import { merge } from "./lwpUtils";
import lwpRenderer from "./lwpRenderer";
import lwpCall from "./lwpCall";

export default class extends lwpRenderer {
  constructor(libwebphone, config = {}) {
    super(libwebphone);
    this._libwebphone = libwebphone;
    this._emit = this._libwebphone._userAgentEvent;
    this._initProperties(config);
    this._initInternationalization(config.i18n || {});
    this._initSockets();
    this._initEventBindings();
    this._initRenderTargets();
    this._emit("started", this);
    return this;
  }

  start(username = null, password = null, realm = null) {
    if (username) {
      this._config.authentication.username = username;
    }

    if (password) {
      this._config.authentication.password = password;
    }

    if (realm) {
      this._config.authentication.realm = realm;
    }

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

    JsSIP.debug.enable("JsSIP:*");
    //JsSIP.debug.enable("");

    this._userAgent = new JsSIP.UA(config);
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

    this._userAgent.start();

    /*
    this._userAgent.on("connecting", (...event) => {
      this._emit("connecting", this, ...event);
    });
    */
    this._userAgent.on("connected", (...event) => {
      this.updateRenders();
      this._emit("connected", this, ...event);
    });
    this._userAgent.on("disconnected", (...event) => {
      this.updateRenders();
      this._emit("disconnected", this, ...event);
    });
    this._userAgent.on("registered", (...event) => {
      this.updateRenders();
      this._emit("registration.registered", this, ...event);
    });
    this._userAgent.on("unregistered", (...event) => {
      this.updateRenders();
      this._emit("registration.unregistered", this, ...event);
    });
    this._userAgent.on("registrationFailed", (...event) => {
      this.updateRenders();
      this._emit("registration.dailed", this, ...event);
    });
    this._userAgent.on("registrationExpiring", (...event) => {
      this._emit("registration.expiring", this, ...event);
    });
    this._userAgent.on("newRTCSession", (...event) => {
      let call = new lwpCall(this._libwebphone, event[0].session);
      this._libwebphone.getCallList().addCall(call);
    });
    this._userAgent.on("newMessage", (...event) => {
      this._emit("recieved.message", this, ...event);
    });
    this._userAgent.on("sipEvent", (...event) => {
      this._emit("recieved.notify", this, ...event);
    });
  }

  stop() {
    this._userAgent.stop();
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
    let redialNumber = this.getRedial();
    this._emit("redial.started", this, redialNumber);
    return this.call(redialNumber);
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
      console.log("mediaStream: ", streams);
      console.log("mediaStream.tracks: ", streams.getTracks());
      this._userAgent.call(numbertocall, options);
      this._emit("call.started", this, numbertocall);
    });
  }

  updateRenders() {
    this.render(render => {
      render.data = this._renderData(render.data);
      return render;
    });
  }

  /** Init functions */

  _initInternationalization(config) {
    let defaults = {
      en: {
        start: "Start",
        stop: "Stop",
        username: "Username",
        password: "Password",
        realm: "Realm",
        register: "Register",
        unregister: "Unregister"
      }
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
  }

  _initSockets() {
    this._config.transport.sockets.forEach(socket => {
      // TODO: handle when socket is an object with weights...
      this._sockets.push(new JsSIP.WebSocketInterface(socket));
    });
  }

  _initEventBindings() {}

  _initRenderTargets() {
    this._config.renderTargets.map(renderTarget => {
      return this.renderAddTarget(renderTarget);
    });
  }

  /** Render Helpers */

  _renderDefaultConfig() {
    return {
      template: this._renderDefaultTemplate(),
      i18n: {
        start: "libwebphone:userAgent.start",
        stop: "libwebphone:userAgent.stop",
        register: "libwebphone:userAgent.register",
        unregister: "libwebphone:userAgent.unregister",
        username: "libwebphone:userAgent.username",
        password: "libwebphone:userAgent.password",
        realm: "libwebphone:userAgent.realm"
      },
      data: merge(this._config, this._renderData()),
      by_id: {
        register: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              element.disabled = true;
              this.register();
            }
          }
        },
        unregister: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              element.disabled = true;
              this.unregister();
            }
          }
        },
        username: {
          events: {
            onchange: event => {
              let element = event.srcElement;
              if (this._userAgent) {
                this._userAgent.set("authorization_user", element.value);
              }
            }
          }
        },
        password: {
          events: {
            onchange: event => {
              let element = event.srcElement;
              if (this._userAgent) {
                this._userAgent.set("password", element.value);
              }
            }
          }
        },
        realm: {
          events: {
            onchange: event => {
              let element = event.srcElement;
              if (this._userAgent) {
                this._userAgent.set("realm", element.value);
              }
            }
          }
        },
        start: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              element.disabled = true;
              this.start();
            }
          }
        },
        stop: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              element.disabled = true;
              this.stop();
            }
          }
        }
      }
    };
  }

  _renderDefaultTemplate() {
    return `
    <div>
      {{^data.connected}}
        <div>
          <label for="{{by_id.username.elementId}}">
            {{i18n.username}}
          </label>
          <input type="text" id="{{by_id.username.elementId}}" value="{{data.authentication.username}}" />
        </div>

        <div>
          <label for="{{by_id.password.elementId}}">
            {{i18n.password}}
          </label>
          <input type="text" id="{{by_id.password.elementId}}" value="{{data.authentication.password}}" />
        </div>
        
        <div>
          <label for="{{by_id.realm.elementId}}">
            {{i18n.realm}}
          </label>
          <input type="text" id="{{by_id.realm.elementId}}" value="{{data.authentication.realm}}" />
        </div>

        <button id="{{by_id.start.elementId}}">{{i18n.start}}</button>
      {{/data.connected}}

      {{#data.connected}}
        {{^data.registered}}
          <button id="{{by_id.register.elementId}}">
            {{i18n.register}}
          </button>
        {{/data.registered}}

        {{#data.registered}}
          <button id="{{by_id.unregister.elementId}}">
            {{i18n.unregister}}
          </button>
        {{/data.registered}}
      
        <button id="{{by_id.stop.elementId}}">{{i18n.stop}}</button>
      {{/data.connected}}
    </div>
      `;
  }

  _renderData(data = {}) {
    let userAgent = this._userAgent;

    if (userAgent) {
      data.connected = userAgent.isConnected();
      data.registered = userAgent.isRegistered();
    }

    return data;
  }

  /** Helper functions */
}
