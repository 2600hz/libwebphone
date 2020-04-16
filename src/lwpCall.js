"use strict";

import { uuid } from "./lwpUtils";

export default class {
  constructor(libwebphone, session = null) {
    this._libwebphone = libwebphone;
    this._emit = this._libwebphone._callEvent;
    this._session = session;
    this._initProperties();
    this._initEventBindings();

    let callList = this._libwebphone.getCallList();
    if (!callList) {
      this._setPrimary();
    }

    this._emit("created", this);
  }

  getId() {
    return this._id;
  }

  hasSession() {
    return this._session != null;
  }

  hasPeerConnection() {
    let session = this._getSession();

    return session && session.connection;
  }

  getPeerConnection() {
    if (this.hasPeerConnection()) {
      return this._getSession().connection;
    }
  }

  isPrimary() {
    return this._primary;
  }

  getRemoteAudio() {
    return this._remoteAudio;
  }

  getRemoteVideo() {
    return this._remoteVideo;
  }

  getLocalAudio() {
    return this._localAudio;
  }

  getLocalVideo() {
    return this._localVideo;
  }

  isInProgress() {
    if (this.hasSession()) {
      return this._getSession().isInProgress();
    }

    return false;
  }

  isEstablished() {
    if (this.hasSession()) {
      return this._getSession().isEstablished();
    }

    return false;
  }

  isEnded() {
    if (this.hasSession()) {
      return this._getSession().isEnded();
    }

    return false;
  }

  isRinging() {
    return this.getDirection() == "terminating" && !this.isEstablished();
  }

  isInTransfer() {
    return this._inTransfer;
  }

  getDirection() {
    if (this.hasSession()) {
      if (this._getSession().direction == "incoming") {
        return "terminating";
      } else {
        return "originating";
      }
    }

    return "originating";
  }

  localIdentity() {
    if (this.hasSession()) {
      return this._getSession().local_identity;
    }
  }

  remoteIdentity() {
    if (this.hasSession()) {
      return this._getSession().remote_identity;
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
      this._getSession().terminate();
    }
  }

  hangup() {
    if (this.hasSession()) {
      this._getSession().terminate();
    }
  }

  hold() {
    if (this.hasSession()) {
      this._getSession().hold();
    }
  }

  isOnHold(details = false) {
    let status = { local: false, remote: false };

    if (this.hasSession()) {
      status = this._getSession().isOnHold();
    }

    if (details) {
      return status;
    } else {
      return status.local || status.remote;
    }
  }

  unhold() {
    if (this.hasSession()) {
      this._getSession().unhold();
      this._updateStreams();
    }
  }

  mute() {
    if (this.hasSession()) {
      this._getSession().mute();
    }
  }

  unmute() {
    if (this.hasSession()) {
      this._getSession().unmute();
    }
  }

  isMuted(details = false) {
    let status = { audio: false, video: false };
    if (this.hasSession()) {
      status = this._getSession().isMuted();
    }

    if (details) {
      return status;
    } else {
      return status.audio || status.video;
    }
  }

  transfer(target = null, autoHold = true) {
    if (this.hasSession()) {
      if (this.isInTransfer() || target) {
        let dialpad = this._libwebphone.getDialpad();

        this._inTransfer = false;

        if (!target && dialpad) {
          target = dialpad.getTarget(true);
        }

        if (target) {
          this._getSession().refer(target);
          this._emit("transfer.started", this, target);
        } else {
          if (autoHold) {
            this.unhold();
          }

          this._emit("transfer.failed", this, target);
        }
        this._emit("transfer.complete", this, target);
      } else {
        this._inTransfer = true;

        if (autoHold) {
          this.hold();
        }

        this._emit("transfer.collecting", this, target);
      }
    }
  }

  answer() {
    if (this.hasSession()) {
      let mediaDevices = this._libwebphone.getMediaDevices();

      if (mediaDevices) {
        mediaDevices.startStreams().then((streams) => {
          let options = {
            mediaStream: streams,
          };

          this._getSession().answer(options);
          this._emit("answered", this);
        });
      } else {
        this._getSession().answer({});
        this._emit("answered", this);
      }
    }
  }

  reject() {
    if (this.hasSession()) {
      this._getSession().terminate();
      this._emit("rejected", this);
    }
  }

  renegotiate() {
    if (this.hasSession() && !this.isOnHold()) {
      this._getSession().renegotiate();
      this._emit("renegotiated", this);
    }
  }

  sendDTMF(signal) {
    if (this.hasSession()) {
      this._getSession().sendDTMF(signal);
      this._emit("send.dtmf", this, signal);
    }
  }

  replaceSenderTrack(newTrack) {
    let peerConnection = this.getPeerConnection();
    if (!peerConnection) {
      return;
    }

    if (
      peerConnection.signalingState == "closed" ||
      peerConnection.connectionState == "closed"
    ) {
      return;
    }

    let senders = peerConnection.getSenders();
    let sender = senders.find((sender) => {
      let track = sender.track;
      if (track) {
        return track.kind == newTrack.kind;
      }
    });

    if (sender) {
      sender.replaceTrack(newTrack).then(() => {
        if (!this.isOnHold()) {
          this.renegotiate();
          this._updateStreams();
        }
      });
    } else {
      peerConnection.addTrack(newTrack);
      if (!this.isOnHold()) {
        this.renegotiate();
        this._updateStreams();
      }
    }
  }

  summary() {
    const direction = this.getDirection();
    return {
      callId: this.getId(),
      hasSession: this.hasSession(),
      progress: this.isInProgress(),
      established: this.isEstablished(),
      ended: this.isEnded(),
      hold: this.isOnHold(),
      muted: this.isMuted(),
      primary: this.isPrimary(),
      inTransfer: this.isInTransfer(),
      direction: direction,
      terminating: direction == "terminating",
      originating: direction == "originating",
      local_identity: this.localIdentity(),
      remote_identity: this.remoteIdentity(),
    };
  }

  /** Init functions */

  _initProperties() {
    this._id = uuid();
    this._primary = false;
    this._inTransfer = false;
    this._streams = {
      remote: {
        mediaStream: new MediaStream(),
        sourceStream: null,
        kinds: {
          audio: false,
          video: false,
        },
        elements: {
          audio: document.createElement("audio"),
          video: document.createElement("video"),
        },
      },
      local: {
        mediaStream: new MediaStream(),
        kinds: {
          audio: false,
          video: false,
        },
        elements: {
          audio: document.createElement("audio"),
          video: document.createElement("video"),
        },
      },
    };

    Object.keys(this._streams).forEach((type) => {
      Object.keys(this._streams[type].elements).forEach((kind) => {
        let element = this._streams[type].elements[kind];
        element.muted = true;
        element.pause();
      });
    });

    if (this.isRinging()) {
      this._emit("ringing.start", this);
    }
  }

  _initEventBindings() {
    this._libwebphone.on(
      "mediaDevices.video.input.changed",
      (lwp, mediaDevices, newTrack, previousTrack) => {
        this.replaceSenderTrack(newTrack.track);
      }
    );
    this._libwebphone.on(
      "mediaDevices.audio.input.changed",
      (lwp, mediaDevices, newTrack, previousTrack) => {
        this.replaceSenderTrack(newTrack.track);
      }
    );
    this._libwebphone.on(
      "mediaDevices.audio.output.changed",
      (lwp, mediaDevices, preferedDevice) => {
        this._streams.remote.elements.audio.setSinkId(preferedDevice.id);
      }
    );
    if (this.hasPeerConnection()) {
      let peerConnection = this.getPeerConnection();
      this._emit("peerconnection", this, peerConnection);
      peerConnection.addEventListener("addstream", (...event) => {
        this._emit("peerconnection.add.stream", this, ...event);
        this._updateStreams();
      });
      peerConnection.addEventListener("removestream", (...event) => {
        this._emit("peerconnection.remove.stream", this, ...event);
        this._updateStreams();
      });
    }
    if (this.hasSession()) {
      this._getSession().on("progress", (...event) => {
        this._emit("progress", this, ...event);
      });
      this._getSession().on("confirmed", (...event) => {
        this._emit("ringing.stop", this);
        this._emit("established", this, ...event);
      });
      this._getSession().on("newDTMF", (...event) => {
        this._emit("receive.dtmf", this, ...event);
      });
      this._getSession().on("newInfo", (...event) => {
        this._emit("receive.info", this, ...event);
      });
      this._getSession().on("hold", (...event) => {
        this._emit("hold", this, ...event);
      });
      this._getSession().on("unhold", (...event) => {
        this._emit("unhold", this, ...event);
      });
      this._getSession().on("muted", (...event) => {
        this._emit("muted", this, ...event);
      });
      this._getSession().on("unmuted", (...event) => {
        this._emit("unmuted", this, ...event);
      });
      this._getSession().on("ended", (...event) => {
        this._destroyCall();
        this._emit("ended", this, ...event);
      });
      this._getSession().on("failed", (...event) => {
        this._destroyCall();
        this._emit("failed", this, ...event);
      });
      this._getSession().on("peerconnection", (...data) => {
        let peerConnection = data[0].peerconnection;
        this._emit("peerconnection", this, peerConnection);
        peerConnection.addEventListener("addstream", (...event) => {
          this._emit("peerconnection.add.stream", this, ...event);
          this._updateStreams();
        });
        peerConnection.addEventListener("remotestream", (...event) => {
          this._emit("peerconnection.remove.stream", this, ...event);
          this._updateStreams();
        });
      });
    }
  }

  /** Helper functions */
  _destroyCall() {
    this._emit("terminated", this);

    if (this.isPrimary()) {
      this._disconnectStreams();
    }

    this._destroyStreams();

    this._session = null;
  }

  _getSession() {
    return this._session;
  }

  _setPrimary(resume = true) {
    if (this.isPrimary()) {
      return;
    }

    this._updateStreams();
    this._connectStreams();

    if (resume && this.isEstablished() && this.isOnHold()) {
      this.unhold();
    }

    this._primary = true;
    this._emit("promoted", this);
  }

  _clearPrimary(pause = true) {
    if (!this.isPrimary()) {
      return;
    }

    this._disconnectStreams();

    if (this.isInTransfer()) {
      this._inTransfer = false;

      this._emit("transfer.failed", this);
    }

    if (pause && this.isEstablished() && !this.isOnHold()) {
      this.hold();
    }

    this._primary = false;
    this._emit("demoted", this);
  }

  _updateStreams() {
    Object.keys(this._streams).forEach((type) => {
      let peerConnection = this.getPeerConnection();
      let mediaStream = this._streams[type].mediaStream;
      if (peerConnection) {
        let peerTracks = [];
        switch (type) {
          case "remote":
            peerConnection.getReceivers().forEach((peer) => {
              if (peer.track) {
                peerTracks.push(peer.track);
              }
            });
            break;
          case "local":
            peerConnection.getSenders().forEach((peer) => {
              if (peer.track) {
                peerTracks.push(peer.track);
              }
            });
            break;
        }
        this._syncTracks(mediaStream, peerTracks);
      }

      Object.keys(this._streams[type].elements).forEach((kind) => {
        let element = this._streams[type].elements[kind];
        let track = mediaStream.getTracks().find((track) => {
          return track.kind == kind;
        });

        if (track) {
          this._streams[type].kinds[kind] = true;
          if (!element.srcObject || element.srcObject.id != mediaStream.id) {
            if (!element.paused) {
              element.playHint = true;
            }
            element.pause();
            element.srcObject = mediaStream;
            if (element.playHint) {
              element.play().catch((error) => console.log(error));
            }
          }
        } else {
          this._streams[type].kinds[kind] = false;
          element.pause();
          element.srcObject = null;
        }
      });
    });

    if (this.isPrimary()) {
      this._connectStreams();
    }
  }

  _syncTracks(mediaStream, peerTracks) {
    let peerIds = peerTracks.map((track) => {
      return track.id;
    });
    let currentIds = mediaStream.getTracks().map((track) => {
      return track.id;
    });
    let addIds = peerIds.filter((peerId) => {
      return !currentIds.includes(peerId);
    });
    let removeIds = currentIds.filter((currentId) => {
      return !peerIds.includes(currentId);
    });
    mediaStream.getTracks().forEach((track) => {
      if (removeIds.includes(track.id)) {
        mediaStream.removeTrack(track);
      }
    });
    peerTracks.forEach((track) => {
      if (addIds.includes(track.id)) {
        mediaStream.addTrack(track);
      }
    });
  }

  _connectStreams() {
    let audioMixer = this._libwebphone.getAudioMixer();
    let videoCanvas = this._libwebphone.getVideoCanvas();

    Object.keys(this._streams).forEach((type) => {
      Object.keys(this._streams[type].elements).forEach((kind) => {
        let element = this._streams[type].elements[kind];
        element.playHint = true;
        if (element.srcObject) {
          element.play();
        }
      });
    });

    if (audioMixer) {
      /*
      this._streams.remote.sourceStream = audioMixer._createMediaStreamSource(
        this._streams.remote.mediaStream
      );
      audioMixer._setRemoteSourceStream(this._streams.remote.sourceStream);
      */
    } else {
      this._streams.remote.elements.audio.muted = false;
    }
  }

  _disconnectStreams() {
    let audioMixer = this._libwebphone.getAudioMixer();
    let videoCanvas = this._libwebphone.getVideoCanvas();

    Object.keys(this._streams).forEach((type) => {
      Object.keys(this._streams[type].elements).forEach((kind) => {
        let element = this._streams[type].elements[kind];
        element.playHint = false;
        if (!element.paused) {
          element.pause();
        }
      });
    });

    if (!audioMixer) {
      this._streams.remote.elements.audio.muted = true;
    }

    if (audioMixer) {
      audioMixer._setRemoteSourceStream();
    } else {
      this._streams.remote.elements.audio.muted = true;
    }

    if (videoCanvas) {
      videoCanvas._setLocalVideoSourceStream();
      videoCanvas._setRemoteVideoSourceStream();
    }
  }

  _destroyStreams() {
    let audioMixer = this._libwebphone.getAudioMixer();
    let remoteStream = this._streams.remote.mediaStream;

    this._emit("ringing.stop", this);

    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => {
        track.stop();
      });
    }
  }
}
