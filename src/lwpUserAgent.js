"use strict";

import * as JsSIP from "jssip";
import lwpUtils from "./lwpUtils";
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
    this._emit("created", this);
    this.initAgent = this._initAgent.bind(this);
    return this;
  }

  start(username = null, password = null, realm = null) {
    if (this.isStarted()) {
      return;
    }

    if (username) {
      this._config.authentication.username = username;
    }

    if (password) {
      this._config.authentication.password = password;
    }

    if (realm) {
      this._config.authentication.realm = realm;
    }

    try {
      const config = {
        sockets: this._sockets,
        uri: "webphone@" + this._config.authentication.realm,
        connection_recovery_max_interval: this._config.transport
          .recovery_max_interval,
        connection_recovery_min_interval: this._config.transport
          .recovery_min_interval,
        contact_uri: this._config.user_agent.contact_uri,
        display_name: this._config.user_agent.display_name,
        instance_id: this._config.user_agent.instance_id,
        no_answer_timeout: this._config.user_agent.no_answer_timeout,
        realm: this._config.authentication.realm,
        register: this._config.user_agent.register,
        register_expires: this._config.user_agent.register_expires,
        user_agent: this._config.user_agent.user_agent,
        session_timers: false,
      };

      if (this._config.authentication.jwt) {
        config.authorization_jwt = this._config.authentication.jwt;
      }

      if (this._config.authentication.username) {
        config.authorization_user = this._config.authentication.username;
        config.uri = this._config.authentication.username + "@" + this._config.authentication.realm;

        if (this._config.authentication.password) {
          config.password = this._config.authentication.password;
        }
      }

      this.initAgent(config);

      this._userAgent.start();

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
        this._emit("registration.failed", this, ...event);
      });
      this._userAgent.on("registrationExpiring", (...event) => {
        this._emit("registration.expiring", this, ...event);
        this._userAgent.register();
      });
      this._userAgent.on("newRTCSession", (...event) => {
        const session = event[0].session;
        new lwpCall(this._libwebphone, session);
      });
      this._userAgent.on("newMessage", (...event) => {
        this._emit("recieved.message", this, ...event);
      });
      this._userAgent.on("sipEvent", (...event) => {
        this._emit("recieved.notify", this, ...event);
      });

      this._emit("started", this);
      return this._userAgent;
    } catch (error) {
      this._emit("configuration.error", this, error);
    }
  }

  stop() {
    if (this.isStarted()) {
      this.hangupAll();
      this.unregister();
      this._userAgent.stop();
      this._userAgent = null;
      this._emit("stopped", this);
    }
  }

  isStarted() {
    return this._userAgent != null;
  }

  isConnected() {
    if (this.isStarted()) {
      return this._userAgent.isConnected();
    }

    return false;
  }

  startDebugJSSIP() {

    JsSIP.debug.enable("JsSIP:*");
  }

  stopDebugJSSIP() {

    JsSIP.debug.enable("");

  }

  startDebug() {
    this._debug = true;

    JsSIP.debug.enable("JsSIP:*");

    this._emit("debug.start", this);
  }

  stopDebug() {
    this._debug = false;

    JsSIP.debug.enable("");

    this._emit("debug.stop", this);
  }

  toggleDebug() {
    if (this.isDebugging()) {
      return this.stopDebug();
    } else {
      return this.startDebug();
    }
  }

  isDebugging() {
    return this._debug;
  }

  register() {
    if (this.isStarted()) {
      this._userAgent.register();
    }
  }

  unregister() {
    if (this.isStarted()) {
      this._userAgent.unregister({
        all: true,
      });
    }
  }

  toggleRegistration() {
    if (this.isRegistered()) {
      this.unregister();
    } else {
      this.register();
    }
  }

  isRegistered() {
    if (this.isStarted()) {
      return this._userAgent.isRegistered();
    }

    return false;
  }

  redial() {
    const redialTarget = this.getRedial();

    this._emit("redial.started", this, redialTarget);

    return this.call(redialTarget);
  }

  getRedial() {
    return this._redialTarget;
  }

  setRedial(target) {
    if (this._redialTarget == target) {
      return;
    }

    this._redialTarget = target;

    this._emit("redial.update", this, this._redialTarget);
  }

  call(target = null, custom_headers = [], anonymous = false) {
    let options = {
      data: { lwpStreamId: lwpUtils.uuid() },
      extraHeaders: [...custom_headers, ...this._config.custom_headers.establish_call],
      anonymous: anonymous
    };
    const mediaDevices = this._libwebphone.getMediaDevices();
    const callList = this._libwebphone.getCallList();

    if (!target) {
      target = this.getRedial();
    } else {
      this.setRedial(target);
    }

    if (!callList) {
      this.hangupAll();
    }

    if (mediaDevices) {
      mediaDevices
        .startStreams(options.data.lwpStreamId)
        .then((streams) => {
          options = lwpUtils.merge(options, {
            mediaStream: streams,
          });
          this._call(target, options);
        })
        .catch((error) => {
          this._emit("call.failed", this, error);
        });
    } else {
      this._call(target, options);
    }
  }

  hangupAll() {
    if (this.isStarted()) {
      this._userAgent.terminateSessions();
    }
  }

  isReady() {
    return this.isStarted() && this.isConnected() && this.isRegistered();
  }

  updateRenders() {
    this.render((render) => {
      render.data = this._renderData(render.data);
      return render;
    });
  }

  /** Init functions */

  _initInternationalization(config) {
    const defaults = {
      en: {
        agentstart: "Start",
        agentstop: "Stop",
        debug: "Debug",
        debugstart: "Start",
        debugstop: "Stop",
        username: "Username",
        password: "Password",
        realm: "Realm",
        registrar: "Registrar",
        register: "Register",
        unregister: "Unregister",
      },
    };
    const resourceBundles = lwpUtils.merge(
      defaults,
      config.resourceBundles || {}
    );
    this._libwebphone.i18nAddResourceBundles("userAgent", resourceBundles);
  }

  _initProperties(config) {
    const defaults = {
      transport: {
        sockets: [],
        recovery_max_interval: 30,
        recovery_min_interval: 2,
      },
      authentication: {
        username: "",
        password: "",
        realm: "",
      },
      user_agent: {
        //contact_uri: "",
        //display_name: "",
        //instance_id: "8f1fa16a-1165-4a96-8341-785b1ef24f12",
        no_answer_timeout: 60,
        register: true,
        register_expires: 300,
        user_agent: "2600Hz libwebphone 2.x",
        redial: "*97"
      },
      custom_headers: {
        establish_call: []
      },
      debug: false,
    };

    this._config = lwpUtils.merge(defaults, config);

    this._sockets = [];
    this._userAgent = null;

    this.setRedial(this._config.user_agent.redial);

    if (this._config.debug) {
      this.startDebug();
    } else {
      this.stopDebug();
    }
  }

  _initSockets() {
    this._config.transport.sockets.forEach((socket) => {
      // TODO: handle when socket is an object with weights...
      this._sockets.push(new JsSIP.WebSocketInterface(socket));
    });
  }

  _initAgent(config) {
    this._userAgent = new JsSIP.UA(config);
    this._userAgent.receiveRequest = (request) => {
      /** TODO: nasty hack because Kazoo appears to be lower-casing the request user... */
      const config_user = this._userAgent._configuration.uri.user;
      const ruri_user = request.ruri.user;
      if (config_user.toLowerCase() == ruri_user.toLowerCase()) {
        request.ruri.user = config_user;
      }
      return this._userAgent.__proto__.receiveRequest.call(
        this._userAgent,
        request
      );
    };

    if (this._config.custom_headers.register) {
      this._userAgent.registrator().setExtraHeaders(this._config.custom_headers.register);
      console.log(this._userAgent);
    }
  }

  _initEventBindings() {
    this._libwebphone.on("userAgent.debug.start", () => {
      this.updateRenders();
    });
    this._libwebphone.on("userAgent.debug.stop", () => {
      this.updateRenders();
    });
    this._libwebphone.on("userAgent.call.failed", () => {
      this.updateRenders();
    });
    this._libwebphone.onAny((event, ...data) => {
      if (this.isDebugging()) {
        console.log(event, data);
      }
    });
  }

  _initRenderTargets() {
    this._config.renderTargets.map((renderTarget) => {
      return this.renderAddTarget(renderTarget);
    });
  }

  /** Render Helpers */

  _renderDefaultConfig() {
    return {
      template: this._renderDefaultTemplate(),
      i18n: {
        agentstart: "libwebphone:userAgent.agentstart",
        agentstop: "libwebphone:userAgent.agentstop",
        debug: "libwebphone:userAgent.debug",
        debugstart: "libwebphone:userAgent.debugstart",
        debugstop: "libwebphone:userAgent.debugstop",
        registrar: "libwebphone:userAgent.registrar",
        register: "libwebphone:userAgent.register",
        unregister: "libwebphone:userAgent.unregister",
        username: "libwebphone:userAgent.username",
        password: "libwebphone:userAgent.password",
        realm: "libwebphone:userAgent.realm",
      },
      data: lwpUtils.merge({}, this._config, this._renderData()),
      by_id: {
        debug: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.toggleDebug();
            },
          },
        },
        registrar: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.toggleRegistration();
            },
          },
        },
        username: {
          events: {
            onchange: (event) => {
              const element = event.srcElement;
              this._config.authentication.username = element.value;
            },
          },
        },
        password: {
          events: {
            onchange: (event) => {
              const element = event.srcElement;
              this._config.authentication.password = element.value;
            },
          },
        },
        realm: {
          events: {
            onchange: (event) => {
              const element = event.srcElement;
              this._config.authentication.realm = element.value;
            },
          },
        },
        agentstart: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.start();
            },
          },
        },
        agentstop: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.stop();
            },
          },
        },
      },
    };
  }

  _renderDefaultTemplate() {
    return `
    <div>
      <div>
        <label for="{{by_id.debug.elementId}}">
          {{i18n.debug}}
        </label>
        <button id="{{by_id.debug.elementId}}">
          {{^data.isDebugging}}
            {{i18n.debugstart}}
          {{/data.isDebugging}}

          {{#data.isDebugging}}
            {{i18n.debugstop}}
          {{/data.isDebugging}}
        </button>
      </div>

      {{^data.isStarted}}
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

        <div>
          <label for="{{by_id.agentstart.elementId}}">
            {{i18n.agent}}
          </label>
          <button id="{{by_id.agentstart.elementId}}">{{i18n.agentstart}}</button>
        </div>
      {{/data.isStarted}}

      {{#data.isStarted}}
        <div>
          <label for="{{by_id.registrar.elementId}}">
            {{i18n.registrar}}
          </label>
          <button id="{{by_id.registrar.elementId}}">
            {{^data.isRegistered}}
              {{i18n.register}}
            {{/data.isRegistered}}

            {{#data.isRegistered}}
              {{i18n.unregister}}
            {{/data.isRegistered}}
          </button>
        </div>

        <label for="{{by_id.agentstop.elementId}}">
          {{i18n.agent}}
        </label>
        <button id="{{by_id.agentstop.elementId}}">{{i18n.agentstop}}</button>
      {{/data.isStarted}}
    </div>
      `;
  }

  _renderData(data = {}) {
    data.isStarted = this.isStarted();
    data.isConnected = this.isConnected();
    data.isRegistered = this.isRegistered();
    data.isReady = this.isReady();
    data.isDebugging = this.isDebugging();

    return data;
  }

  /** Helper functions */

  _call(target, options) {
    try {
      if (!this.isReady()) {
        throw new Error("Webphone client not ready yet!");
      }

      this._userAgent.call(target, options);

      this._emit("call.started", this, target);
    } catch (error) {
      this._emit("call.failed", this, error);
    }
  }
}
