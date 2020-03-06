"use strict";

import i18next from "i18next";
import lwpKazoo from "./lwpKazoo";
import lwpMediaDevices from "./lwpMediaDevices";
import lwpUserAgent from "./lwpUserAgent";
import lwpDialpad from "./lwpDialpad";
import Mustache from "mustache";
import lwpCallControl from "./lwpCallControl";

export default class {
  constructor(config = {}, i18n = null) {
    this._calls = [];
    this._kazooPromise = new lwpKazoo(this, config, i18n);
    this._mediaDevicesPromise = new lwpMediaDevices(this, config, i18n);
    this._userAgentPromise = new lwpUserAgent(this, config, i18n);
    this._dialpadPromise = new lwpDialpad(this, config, i18n);
    this._callcontrolPromise = new lwpCallControl(this, config, i18n);
  } //end of constructor

  getKazoo() {
    return this._kazooPromise;
  }

  getMediaDevices() {
    return this._mediaDevicesPromise;
  }

  getUserAgent() {
    return this._userAgentPromise;
  }

  getDialpad() {
    return this._dialpadPromise;
  }

  async call(numbertocall = null) {
    if (!numbertocall) {
      numbertocall = await this._dialpadPromise.then(dialpad => {
        let digits = dialpad.digits();
        dialpad.clear();
        return digits.join("");
      });
    }

    return this._userAgentPromise.then(userAgent => {
      let ua = userAgent.getUserAgent();
      console.log("call to: ", numbertocall);
      console.log("user-agent: ", ua);
      this.getMediaDevices().then(mediaDevices => {
        var stream = mediaDevices.startStreams();
        var options = {
          mediaStream: stream
        };
        var session = ua.call(numbertocall, options);
        console.log("outbound call, add to session list : ", session);
      });
    });
  }

  getCalls() {
    return this._calls;    
  }

  getCall(callId) {
    return this._calls.find(call => {
      return call.getId() == callId;
    });
  }

  addCall(newCall) {
    this._calls.push(newCall);
    this._renderCalls();
    console.log("calls: ", this._calls);
  }

  removeCall(terminatedCall) {
    let terminatedId = terminatedCall.getId();
    this._calls = this._calls.filter(call => {
      return call.getId() != terminatedId;
    });
    this._renderCalls();
    console.log("calls: ", this._calls);
  }

  _renderCalls() {
    let renderConfig = this._calls.map(call => {
      return {
        callId: call.getId(),
        inbound: call.getSession().direction == "incoming"
      };
    });
      let html = Mustache.render(this._callcontrolPromise._callControlTemplate(), {

      calls: renderConfig
    });
    let element = document.getElementById("call_list");
    element.innerHTML = html;
  }

 
  
} //End of default class
