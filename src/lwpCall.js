"use strict";

import { uuid } from "./lwpUtils";

export default class {
  constructor(libwebphone, session = null) {
    this._libwebphone = libwebphone;
    this._emit = this._libwebphone._callEvent;
    this._session = session;
    this._initProperties();
    this._initEventBindings();
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

  getRemoteAudio() {
    return this._remoteAudio;
  }

  getRemoteStream() {
    return this._remoteStream;
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

  isInTransfer() {
    return this._inTransfer;
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

  terminate() {
    if (this.hasSession()) {
      if (this.isEstablished()) {
        this.hangup();
      } else {
        this.cancel();
      }
    }
  }

  cancel() {
    if (this.hasSession()) {
      this._session.terminate();
      this._libwebphone.getCallList().removeCall(this);
    }
  }

  hangup() {
    if (this.hasSession()) {
      this._session.terminate();
      this._libwebphone.getCallList().removeCall(this);
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

  transfer(numbertotransfer = null) {
    if (this.hasSession()) {
      let dialpad = this._libwebphone.getDialpad();
      if (this.isInTransfer() || numbertotransfer) {
        this._inTransfer = false;

        if (!numbertotransfer) {
          numbertotransfer = dialpad.getDigits().join("");
          dialpad.clear();
        }

        if (numbertotransfer) {
          this._session.refer(numbertotransfer);
          this._emit("transfer.started", this, numbertotransfer);
        } else {
          this._emit("transfer.failed", this, numbertotransfer);
        }
        this._emit("transfer.complete", this, numbertotransfer);
      } else {
        this._inTransfer = true;
        dialpad.clear();
        this._emit("transfer.collecting", this, numbertotransfer);
      }
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
        this._emit("answered", this);
      });
    }
  }

  reject() {
    if (this.hasSession()) {
      this._session.terminate();
      this._libwebphone.getCallList().removeCall(this);
      this._emit("rejected", this);
    }
  }

  renegotiate() {
    if (this.hasSession()) {
      this._session.renegotiate();
      this._emit("renegotiated", this);
    }
  }

  sendDTMF(signal) {
    if (this.hasSession()) {
      this._session.sendDTMF(signal);
      this._emit("send.dtmf", this, signal);
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
      inTransfer: this.isInTransfer(),
      direction: direction,
      terminating: direction == "terminating",
      originating: direction == "originating",
      local_identity: this.localIdentity(),
      remote_identity: this.remoteIdentity()
    };
  }

  /** Init functions */

  _initProperties() {
    this._id = uuid();
    this._primary = false;
    this._remoteStream = null;
    this._remoteAudio = null;
    this._inTransfer = false;
  }

  _initEventBindings() {
    if (!this.hasSession()) {
      return;
    }

    this._listenForNewStreams();
    this._session.on("peerconnection", (...event) => {
      this._listenForNewStreams();
    });

    /*
    this._session.on("connecting", (...event) => {
      this._emit("connecting", this, ...event);
    });
    this._session.on("sending", (...event) => {
      this._emit("sending", this, ...event);
    });
    */

    this._session.on("progress", (...event) => {
      this._emit("progress", this, ...event);
    });

    /*
    this._session.on("accepted", (...event) => {
      this._emit("accepted", this, ...event);
    });
    */

    this._session.on("confirmed", (...event) => {
      this._emit("established", this, ...event);
      /*
      if (!this.isPrimary()) {
        this.hold();
      }
      */
    });
    this._session.on("newDTMF", (...event) => {
      this._emit("receive.dtmf", this, ...event);
    });
    this._session.on("newInfo", (...event) => {
      this._emit("receive.info", this, ...event);
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
    /*
    this._session.on("reinvite", (...event) => {
      this._emit("reinvite", this, ...event);
    });
    */
    this._session.on("ended", (...event) => {
      this._libwebphone.getCallList().removeCall(this);
      this._emit("ended", this, ...event);
    });
    this._session.on("failed", (...event) => {
      this._libwebphone.getCallList().removeCall(this);
      this._emit("failed", this, ...event);
    });
  }

  /** Helper functions */

  _listenForNewStreams() {
    if (this._session.connection) {
      this._session.connection.addEventListener("addstream", event => {
        this._setRemoteStream(event.stream);
      });
    }
  }

  _setPrimary(resume = true) {
    let remoteAudio = this.getRemoteAudio();

    if (this.isPrimary()) {
      return;
    }

    this.unmute();

    if (resume && this.isEstablished() && this.isOnHold()) {
      this.unhold();
    }

    if (remoteAudio) {
      this._libwebphone
        .getMediaDevices()
        ._setRemoteAudioSourceStream(remoteAudio);
    }

    this._primary = true;
    this._emit("promoted", this);
  }

  _clearPrimary(pause = true) {
    if (!this.isPrimary()) {
      return;
    }

    if (this._inTransfer) {
      this._libwebphone.getDialpad().clear();
      this._inTransfer = false;
      this._emit("transfer.failed", this, numbertotransfer);
    }

    this.mute();

    if (pause && this.isEstablished()) {
      this.hold();
    }

    this._primary = false;
    this._emit("demoted", this);
  }

  _setRemoteAudio(remoteAudio) {
    this._remoteAudio = remoteAudio;

    if (this.isPrimary()) {
      this._libwebphone
        .getMediaDevices()
        ._setRemoteAudioSourceStream(remoteAudio);
    }

    this._emit("remote.audio.added", this, remoteAudio);
  }

  _setRemoteStream(remoteStream) {
    let element = document.createElement("audio");
    element.srcObject = remoteStream;
    element.muted = true;
    element.play();

    let video = document.getElementById("remote_video");
    if (video) {
      console.log("video: ", video, remoteStream);
      console.log("video: ", remoteStream.getTracks());
      video.srcObject = remoteStream;
    }

    this._remoteStream = remoteStream;
    this._setRemoteAudio(
      this._libwebphone.getMediaDevices()._createMediaStreamSource(remoteStream)
    );

    this._emit("remote.stream.added", this, remoteStream);
  }
}
