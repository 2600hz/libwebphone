"use strict";

import EventEmitter from "events";
import i18next from "i18next";
import _ from "lodash";
import Mustache from "mustache";
import * as JsSIP from "jssip";

export default class extends EventEmitter {
  constructor(libwebphone, session) {
    super();
    this._id = this._uuid();
    this._libwebphone = libwebphone;
    this._session = session;
    this._primary = true;

    this._session.on("peerconnection", (...event) => {
      this._libwebphone._callEvent("peerconnection", this, ...event);
    });
    this._session.on("connecting", (...event) => {
      this._libwebphone._callEvent("connecting", this, ...event);
    });
    this._session.on("sending", (...event) => {
      this._libwebphone._callEvent("sending", this, ...event);
    });
    this._session.on("progress", (...event) => {
      this._libwebphone._callEvent("progress", this, ...event);
    });
    this._session.on("accepted", (...event) => {
      this._libwebphone._callEvent("accepted", this, ...event);
    });
    this._session.on("confirmed", (...event) => {
      this._libwebphone._callEvent("confirmed", this, ...event);
    });
    this._session.on("newDTMF", (...event) => {
      this._libwebphone._callEvent("dtmf", this, ...event);
    });
    this._session.on("newInfo", (...event) => {
      this._libwebphone._callEvent("info", this, ...event);
    });
    this._session.on("hold", (...event) => {
      this._libwebphone._callEvent("hold", this, ...event);
    });
    this._session.on("unhold", (...event) => {
      this._libwebphone._callEvent("unhold", this, ...event);
    });
    this._session.on("muted", (...event) => {
      this._libwebphone._callEvent("muted", this, ...event);
    });
    this._session.on("unmuted", (...event) => {
      this._libwebphone._callEvent("unmuted", this, ...event);
    });
    this._session.on("reinvite", (...event) => {
      this._libwebphone._callEvent("reinvite", this, ...event);
    });
    this._session.on("ended", (...event) => {
      this._libwebphone._callEvent("ended", this, ...event);
    });
    this._session.on("failed", (...event) => {
      this._libwebphone._callEvent("failed", this, ...event);
    });
    this._libwebphone.addCall(this);
  }

  getId() {
    return this._id;
  }

  getSession() {
    return this._session;
  }

  isPrimary() {
    return this._primary;
  }

  setPrimary() {
    this._primary = true;
  }

  clearPrimary() {
    this._primary = false;
    if (this._session.isEstablished()) {
      this.hold();
    }
  }

  isInProgress() {
    return this._session.isInProgress();
  }

  isEstablished() {
    return this._session.isEstablished();
  }

  isEnded() {
    return this._session.isEnded();
  }

  isOnHold() {
    return this._session.isOnHold();
  }

  isMuted() {
    return this._session.isMuted();
  }

  getDirection() {
    if (this._session.direction == "incoming") {
      return "terminating";
    } else {
      return "originating";
    }
  }

  hold() {
    this._session.hold();
  }

  unhold() {
    this._session.unhold();
  }

  answer() {
    this._libwebphone.getMediaDevices().then(mediaDevices => {
      var stream = mediaDevices.startStreams();
      var options = {
        mediaStream: stream
      };
      this._session.answer(options);
      console.log("inbound session answered: ", this._session);
    });
  }

  hangup() {
    this._session.terminate();
    console.log("hangup session: ", this._session);
  } //end hangup

  cancel() {
    this._session.terminate();
    console.log("cancel session: ", this._session);
  }

  reject() {
    this._session.terminate();
    console.log("reject session: ", this._session);
  }

  /** Util Functions */

  mute() {
    this._session.mute();
    console.log("call on mute");
  }

  unmute() {
    this._session.unmute();
    console.log("call on un-muted");
  }

  renegotiate() {
    this._session.renegotiate();
    console.log("call on renegotiate");
  }

  sendDTMF() {
    let tonevalue = libwebphone._dialpadPromise.then(dialpad => {
      let digits = dialpad.digits();
      //dialpad.clear();
      //return digits.join("");
      return digits;
    });
    this._session.sendDTMF(tonevalue);
    console.log("DTMF sent to session: " + tonevalue);
  }

  transfer() {
    let numbertotransfer = libwebphone._dialpadPromise.then(dialpad => {
      let digits = dialpad.digits();
      dialpad.clear();
      return digits.join("");
    });
    this._session.refer(numbertotransfer);
    console.log("Call transfer attempt to : " + numbertotransfer);
  }

  summary() {
    let direction = this.getDirection();
    let hold = this.isOnHold();
    let muted = this.isMuted();
    return {
      callId: this.getId(),
      progress: this.isInProgress(),
      established: this.isEstablished(),
      ended: this.isEnded(),
      hold: hold.local || hold.remote,
      muted: muted.audio || muted.video,
      primary: this.isPrimary,
      terminating: direction == "terminating",
      originating: direction == "originating"
    };
  }

  _uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  _merge(...args) {
    return _.merge(...args);
  }
} //end of lwpPhoneUtils class
