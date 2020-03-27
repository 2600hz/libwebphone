"use strict";

import { uuid } from "./lwpUtils";

export default class {
  constructor(libwebphone, session = null) {
    this._libwebphone = libwebphone;
    this._emit = this._libwebphone._callEvent;
    this._session = session;
    this._primary = false;
    this._id = uuid();
    this._initEventBindings();
    this._remoteStream = null;
    this._remoteAudio = null;
    this._emit("created", this);
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
    if (this._remoteAudio) {
      this._libwebphone.getMediaDevices().setRemoteAudio(this._remoteAudio);
    }
    this._emit("setPrimary", this);
  }

  clearPrimary() {
    this._primary = false;
    if (this.isEstablished()) {
      this.hold();
    }
    /*
    if (this._remoteStream.srcObject) {
      this._remoteStream.pause();
    }
    */
    this._emit("clearPrimary", this);
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
    }
  }

  answer() {
    if (this.hasSession()) {
      let mediaDevices = this._libwebphone.getMediaDevices();
      mediaDevices.startStreams().then(streams => {
        let options = {
          mediaStream: streams
        };
        this._session.answer(options);
      });
    }
  }

  reject() {
    if (this.hasSession()) {
      this._session.terminate();
    }
  }

  renegotiate() {
    if (this.hasSession()) {
      this._session.renegotiate();
    }
  }

  sendDTMF(tone) {
    if (this.hasSession()) {
      console.log("send dtmf: ", tone);
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

  _connectMediaDevices() {
    if (this._session.connection) {
      this._session.connection.addEventListener("addstream", event => {
        let element = document.createElement("audio");
        element.srcObject = event.stream;
        element.muted = true;
        element.play();

        this._remoteStream = event.stream;

        this._remoteAudio = this._libwebphone
          .getMediaDevices()
          .createRemoteAudio(this._remoteStream);

        if (this.isPrimary()) {
          this._libwebphone.getMediaDevices().setRemoteAudio(this._remoteAudio);
        }
      });
    }
  }

  _initEventBindings() {
    if (!this.hasSession()) {
      return;
    }

    this._connectMediaDevices();
    this._session.on("peerconnection", (...event) => {
      this._connectMediaDevices();
      this._emit("peerconnection", this, ...event);
    });
    this._session.on("connecting", (...event) => {
      this._emit("connecting", this, ...event);
    });
    this._session.on("sending", (...event) => {
      this._emit("sending", this, ...event);
    });
    this._session.on("progress", (...event) => {
      this._emit("progress", this, ...event);
    });
    this._session.on("accepted", (...event) => {
      this._emit("accepted", this, ...event);
    });
    this._session.on("confirmed", (...event) => {
      this._emit("confirmed", this, ...event);
      /*
      if (!this.isPrimary()) {
        this.hold();
      }
      */
    });
    this._session.on("newDTMF", (...event) => {
      this._emit("dtmf", this, ...event);
    });
    this._session.on("newInfo", (...event) => {
      this._emit("info", this, ...event);
    });
    this._session.on("hold", (...event) => {
      this._emit("hold", this, ...event);
    });
    this._session.on("unhold", (...event) => {
      this._emit("unhold", this, ...event);
    });
    this._session.on("muted", (...event) => {
      this._emit("muted", this, ...event);
    });
    this._session.on("unmuted", (...event) => {
      this._emit("unmuted", this, ...event);
    });
    this._session.on("reinvite", (...event) => {
      this._emit("reinvite", this, ...event);
    });
    this._session.on("ended", (...event) => {
      this._emit("ended", this, ...event);
    });
    this._session.on("failed", (...event) => {
      this._emit("failed", this, ...event);
    });
  }
}
