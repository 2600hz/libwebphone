"use strict";

import lwpUtils from "./lwpUtils";

export default class {
  constructor(libwebphone, session = null) {
    this._libwebphone = libwebphone;
    this._id = session
      ? session.data.lwpStreamId || lwpUtils.uuid()
      : lwpUtils.uuid();
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

  remoteNameInitials() {
    if (this.hasSession()) {
      const username = this._session._remote_identity._display_name;
      let initials = "";
      if (username) {
        const name = username.split(" ");
        if (name.length >= 2) {
          initials = `${name[0].charAt(0)} ${name[1].charAt(0)}`;
        } else if (name.length === 1) {
          initials = `${name[0].charAt(0)}`;
        }
      } else {
        initials = this._session._remote_identity._uri._user;
      }
      return initials;
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

  mute(options = { audio: true, video: true }) {
    if (this.hasSession()) {
      this._getSession().mute(options);
    }
  }

  unmute(options = { audio: true, video: true }) {
    if (this.hasSession()) {
      this._getSession().unmute(options);
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
        mediaDevices.startStreams(this.getId()).then((streams) => {
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
      this._updateStreams();
      this._emit("renegotiated", this);
    }
  }

  sendDTMF(signal) {
    if (this.hasSession()) {
      this._getSession().sendDTMF(signal);
      this._emit("send.dtmf", this, signal);
    }
  }

  changeVolume(volume = null, kind = null) {
    if (volume === null && this._libwebphone.getAudioContext()) {
      volume = this._libwebphone
        .getAudioContext()
        .getVolume("remote", { scale: false, relativeToMaster: true });
    }

    if (!volume && volume !== 0) {
      return;
    }

    if (volume < 0) {
      volume = 0;
    }

    if (volume > 1) {
      volume = 1;
    }

    if (kind) {
      let element = this._streams.remote.elements[kind];
      if (element) {
        element.volume = volume;
      }
    } else {
      Object.keys(this._streams.remote.elements).forEach((kind) => {
        let element = this._streams.remote.elements[kind];
        if (element) {
          element.volume = volume;
        }
      });
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
        this.renegotiate();
      });
    } else {
      peerConnection.addTrack(newTrack);
      this.renegotiate();
    }
  }

  removeSenderTrack(kind) {
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
        return track.kind == kind;
      }
    });

    if (sender) {
      peerConnection.removeTrack(sender);
      this.renegotiate();
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
      remote_name_initials: this.remoteNameInitials()
    };
  }

  /** Init functions */

  _initProperties() {
    this._primary = false;

    this._inTransfer = false;

    this._muteHint = false;

    this._config = this._libwebphone._config.call;

    this._streams = {
      remote: {
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

        lwpUtils.mediaElementEvents().forEach((eventName) => {
          element.addEventListener(eventName, (event) => {
            this._emit(type + "." + kind + "." + eventName, this, event);
          });
        });

        if (this._config.useAudioContext) {
          element.muted = true;
        } else {
          // NOTE: don't mute the remote audio by default
          element.muted = !(type == "remote" && kind == "audio");
        }
        element.preload = "none";

        this._emit(type + "." + kind + ".element", this, element);
      });
    });

    if (this.isRinging()) {
      this._emit("ringing.started", this);
    }
  }

  _initEventBindings() {
    this._libwebphone.on(
      "mediaDevices.audio.input.changed",
      (lwp, mediaDevices, newTrack) => {
        if (this.hasSession()) {
          if (newTrack) {
            this.replaceSenderTrack(newTrack.track);
          } else {
            this.removeSenderTrack("audio");
          }
        }
      }
    );
    this._libwebphone.on(
      "mediaDevices.video.input.changed",
      (lwp, mediaDevices, newTrack) => {
        if (this.hasSession()) {
          if (newTrack) {
            this.replaceSenderTrack(newTrack.track);
          } else {
            this.removeSenderTrack("video");
          }
        }
      }
    );
    this._libwebphone.on(
      "mediaDevices.audio.output.changed",
      (lwp, mediaDevices, preferedDevice) => {
        Object.keys(this._streams.remote.elements).forEach((kind) => {
          let element = this._streams.remote.elements[kind];
          if (element) {
            element.setSinkId(preferedDevice.id);
          }
        });
      }
    );

    this._libwebphone.on("audioContext.channel.master.volume", () => {
      this.changeVolume();
    });
    this._libwebphone.on("audioContext.channel.remote.volume", () => {
      this.changeVolume();
    });

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
        this._emit("ringing.stopped", this);
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

      if (this._config.globalKeyShortcuts) {
        document.addEventListener("keydown", (event) => {
          if (
            event.target != document.body ||
            event.repeat ||
            !this.isPrimary()
          ) {
            return;
          }

          switch (event.key) {
            case " ":
              if (this._config.keys["spacebar"].enabled) {
                this._config.keys["spacebar"].action(event, this);
              }
              break;
          }
        });
        document.addEventListener("keyup", (event) => {
          if (
            event.target != document.body ||
            event.repeat ||
            !this.isPrimary()
          ) {
            return;
          }

          switch (event.key) {
            case " ":
              if (this._config.keys["spacebar"].enabled) {
                this._config.keys["spacebar"].action(event, this);
              }
              break;
          }
        });
      }
    }
  }

  /** Helper functions */
  _destroyCall() {
    this._emit("terminated", this);

    if (this.isPrimary()) {
      this._clearPrimary(false);
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

    if (resume && this.isEstablished() && this.isOnHold()) {
      this.unhold();
    }

    this._emit("promoted", this);

    this._primary = true;

    this._connectStreams();
  }

  _clearPrimary(pause = true) {
    if (!this.isPrimary()) {
      return;
    }

    if (this.isInTransfer()) {
      this._inTransfer = false;

      this._emit("transfer.failed", this);
    }

    this._primary = false;

    if (pause && this.isEstablished() && !this.isOnHold()) {
      this.hold();
    }

    this._disconnectStreams();

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
        this._syncTracks(mediaStream, peerTracks, type);
      }

      Object.keys(this._streams[type].elements).forEach((kind) => {
        let element = this._streams[type].elements[kind];
        if (element) {
          let track = mediaStream.getTracks().find((track) => {
            return track.kind == kind;
          });

          if (track) {
            this._streams[type].kinds[kind] = true;
            if (!element.srcObject || element.srcObject.id != mediaStream.id) {
              element.srcObject = mediaStream;
            }
          } else {
            this._streams[type].kinds[kind] = false;
            element.srcObject = null;
          }
        }
      });
    });
  }

  _syncTracks(mediaStream, peerTracks, type) {
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
        this._emit(
          type + "." + track.kind + ".removed",
          this,
          lwpUtils.trackParameters(mediaStream, track)
        );
      }
    });
    peerTracks.forEach((track) => {
      if (addIds.includes(track.id)) {
        mediaStream.addTrack(track);
        this._emit(
          type + "." + track.kind + ".added",
          this,
          lwpUtils.trackParameters(mediaStream, track)
        );
      }
    });
  }

  _connectStreams() {
    Object.keys(this._streams).forEach((type) => {
      let mediaStream = this._streams[type].mediaStream;
      this._emit(type + ".mediaStream.connect", this, mediaStream);
    });

    if (!this.hasSession()) {
      return;
    }

    let peerConnection = this.getPeerConnection();
    if (peerConnection) {
      peerConnection.getSenders().forEach((peer) => {
        if (peer.track) {
          peer.track.enabled = true;
        }
      });
    }

    Object.keys(this._streams).forEach((type) => {
      Object.keys(this._streams[type].elements).forEach((kind) => {
        let element = this._streams[type].elements[kind];
        if (element && element.paused) {
          element.play().catch(() => {
            /*
             * We are catching any play interuptions
             * because we get a "placeholder" remote video
             * track in the mediaStream for ALL calls but
             * it never gets data so the play never starts
             * and if we then pause there is a nasty looking
             * but ignorable error...
             *
             * https://developers.google.com/web/updates/2017/06/play-request-was-interrupted
             *
             */
          });
        }
      });
    });
  }

  _disconnectStreams() {
    Object.keys(this._streams).forEach((type) => {
      let mediaStream = this._streams[type].mediaStream;
      this._emit(type + ".mediaStream.disconnect", this, mediaStream);
    });

    if (!this.hasSession()) {
      return;
    }

    let peerConnection = this.getPeerConnection();
    if (peerConnection) {
      peerConnection.getSenders().forEach((peer) => {
        if (peer.track) {
          peer.track.enabled = false;
        }
      });
    }

    Object.keys(this._streams).forEach((type) => {
      Object.keys(this._streams[type].elements).forEach((kind) => {
        let element = this._streams[type].elements[kind];
        if (element && !element.paused) {
          element.pause();
        }
      });
    });
  }

  _destroyStreams() {
    this._emit("ringing.stopped", this);

    let peerConnection = this.getPeerConnection();
    if (peerConnection) {
      peerConnection.getSenders().forEach((peer) => {
        if (peer.track) {
          peer.track.stop();
        }
      });
    }
  }
}
