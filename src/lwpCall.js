"use strict";

import { uuid } from "./lwpUtils";

export default class {
  constructor(libwebphone, session = null) {
    this._libwebphone = libwebphone;
    this._session = session;
    this._primary = false;
    this._id = uuid();
    this._initEventBindings();
    this._remoteAudio = document.createElement("audio");
    this._libwebphone._callEvent("created", this);
  }

  getId() {
    return this._id;
  }

  getSession() {
    return this._session;
  }

  hasSession() {
    return this._session != null;
  }

  isPrimary() {
    return this._primary;
  }

  setPrimary() {
    this._primary = true;
    if (this.isEstablished() && this.isOnHold()) {
      this.unhold();
    }
    if (this._remoteAudio.srcObject) {
      this._remoteAudio.play();
    }
    this._libwebphone._callEvent("setPrimary", this);
  }

  clearPrimary() {
    this._primary = false;
    if (this.isEstablished()) {
      this.hold();
    }
    if (this._remoteAudio.srcObject) {
      this._remoteAudio.pause();
    }
    this._libwebphone._callEvent("clearPrimary", this);
  }

  isInProgress() {
    if (this.hasSession()) {
      return this._session.isInProgress();
    }
    return false;
  }

  isEstablished() {
    if (this.hasSession()) {
      return this._session.isEstablished();
    }
    return false;
  }

  isEnded() {
    if (this.hasSession()) {
      return this._session.isEnded();
    }
    return false;
  }

  isOnHold() {
    if (this.hasSession()) {
      return this._session.isOnHold();
    }
    return { local: false, remote: false };
  }

  isMuted() {
    if (this.hasSession()) {
      return this._session.isMuted();
    }
    return { audio: false, video: false };
  }

  getDirection() {
    if (this.hasSession()) {
      if (this._session.direction == "incoming") {
        return "terminating";
      } else {
        return "originating";
      }
    }
    return "originating";
  }

  localIdentity() {
    if (this.hasSession()) {
      return this._session.local_identity;
    }
  }

  remoteIdentity() {
    if (this.hasSession()) {
      return this._session.remote_identity;
    }
  }

  cancel() {
    if (this.hasSession()) {
      this._session.terminate();
    }
  }

  hangup() {
    if (this.hasSession()) {
      this._session.terminate();
    }
  }

  hold() {
    if (this.hasSession()) {
      this._session.hold();
    }
  }

  unhold() {
    if (this.hasSession()) {
      this._session.unhold();
    }
  }

  mute() {
    if (this.hasSession()) {
      this._session.mute();
    }
  }

  unmute() {
    if (this.hasSession()) {
      this._session.unmute();
    }
  }

  transfer() {
    if (this.hasSession()) {
      let numbertotransfer = libwebphone._dialpadPromise.then(dialpad => {
        let digits = dialpad.digits();
        dialpad.clear();
        return digits.join("");
      });
      this._session.refer(numbertotransfer);
      console.log("Call transfer attempt to : " + numbertotransfer);
    }
  }

  answer() {
    if (this.hasSession()) {
      this._libwebphone.getMediaDevices().then(mediaDevices => {
        const stream = mediaDevices.startStreams();
        const options = {
          mediaStream: stream
        };
        this._session.answer(options);
        console.log("inbound session answered: ", this._session);
      });
    }
  }

  reject() {
    if (this.hasSession()) {
      this._session.terminate();
      console.log("reject session: ", this._session);
    }
  }

  renegotiate() {
    if (this.hasSession()) {
      this._session.renegotiate();
      console.log("call on renegotiate");
    }
  }

  sendDTMF(tone) {
    if (this.hasSession()) {
      this._session.sendDTMF(tone);
    }
  }

  summary() {
    const direction = this.getDirection();
    const hold = this.isOnHold();
    const muted = this.isMuted();
    return {
      callId: this.getId(),
      hasSession: this.hasSession(),
      progress: this.isInProgress(),
      established: this.isEstablished(),
      ended: this.isEnded(),
      hold: hold.local || hold.remote,
      muted: muted.audio || muted.video,
      primary: this.isPrimary(),
      terminating: direction == "terminating",
      originating: direction == "originating",
      local_identity: this.localIdentity(),
      remote_identity: this.remoteIdentity()
    };
  }

  _initEventBindings() {
    if (!this.hasSession()) {
      return;
    }

    if (this._session.connection) {
      this._session.connection.addEventListener("addstream", event => {
        // set remote audio stream
        this._remoteAudio.srcObject = event.stream;
        if (this.isPrimary()) {
          this._remoteAudio.play();
        } else {
          this._remoteAudio.pause();
        }
      });
    }

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
      console.log(this._session.connection);
      /*
      if (!this.isPrimary()) {
        this.hold();
      }
      */
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
  }
}
