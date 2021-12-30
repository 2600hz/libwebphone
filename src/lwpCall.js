"use strict";

import lwpUtils from "./lwpUtils";
import prettyMilliseconds from "pretty-ms";

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

    const callList = this._libwebphone.getCallList();
    if (!callList) {
      this._setPrimary();
    }

    this._emit("created", this);

    if (session) {
      this._timeUpdate();
    }
  }

  getId() {
    return this._id;
  }

  hasSession() {
    return this._session != null;
  }

  hasPeerConnection() {
    const session = this._getSession();

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
    return this._streams.remote.elements.audio;
  }

  getRemoteVideo() {
    return this._streams.remote.elements.video;
  }

  getLocalAudio() {
    return this._streams.local.elements.audio;
  }

  getLocalVideo() {
    return this._streams.local.elements.video;
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

  localIdentity(details = false) {
    const session = this._getSession();
    if (session) {
      if (details) {
        return session.local_identity;
      }
      const display_name = session.local_identity.display_name;
      const uri_user = session.local_identity.uri.user;

      if (display_name && display_name != uri_user) {
        return display_name + " (" + uri_user + ")";
      } else {
        return uri_user;
      }
    }
  }

  remoteIdentity(details = false) {
    const session = this._getSession();
    if (session) {
      if (details) {
        return session.remote_identity;
      }
      const display_name = session.remote_identity.display_name;
      const uri_user = session.remote_identity.uri.user;

      if (display_name && display_name != uri_user) {
        return display_name + " (" + uri_user + ")";
      } else {
        return uri_user;
      }
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

  /**
   * @param {{audio: boolean, video: boolean}} options - The channels you want to mute
   */
  mute(options = { audio: true, video: true }) {
    if (this.hasSession()) {
      this._getSession().mute(options);
    }
  }

  /**
   * @param {{audio: boolean, video: boolean}} options - The channels you want to unmute
   */
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
        const dialpad = this._libwebphone.getDialpad();

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

        this._emit("transfer.collecting", this);
      }
    }
  }

  answer() {
    if (this.hasSession()) {
      const mediaDevices = this._libwebphone.getMediaDevices();

      if (mediaDevices) {
        mediaDevices.startStreams(this.getId()).then((streams) => {
          const options = {
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

  sendDTMF(signal, options) {
    if (this.hasSession()) {
      this._getSession().sendDTMF(signal, options);
      this._emit("send.dtmf", this, signal, options);
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
      const element = this._streams.remote.elements[kind];
      if (element) {
        element.volume = volume;
      }
    } else {
      Object.keys(this._streams.remote.elements).forEach((kind) => {
        const element = this._streams.remote.elements[kind];
        if (element) {
          element.volume = volume;
        }
      });
    }
  }

  replaceSenderTrack(newTrack) {
    const peerConnection = this.getPeerConnection();
    if (!peerConnection) {
      return;
    }

    if (
      peerConnection.signalingState == "closed" ||
      peerConnection.connectionState == "closed"
    ) {
      return;
    }

    const senders = peerConnection.getSenders();
    const sender = senders.find((sender) => {
      const track = sender.track;
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
    const peerConnection = this.getPeerConnection();
    if (!peerConnection) {
      return;
    }

    if (
      peerConnection.signalingState == "closed" ||
      peerConnection.connectionState == "closed"
    ) {
      return;
    }

    const senders = peerConnection.getSenders();
    const sender = senders.find((sender) => {
      const track = sender.track;
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
    const { audio: isAudioMuted, video: isVideoMuted } = this.isMuted(true);

    return {
      callId: this.getId(),
      hasSession: this.hasSession(),
      progress: this.isInProgress(),
      established: this.isEstablished(),
      ended: this.isEnded(),
      held: this.isOnHold(),
      isAudioMuted,
      isVideoMuted,
      primary: this.isPrimary(),
      inTransfer: this.isInTransfer(),
      direction: direction,
      terminating: direction == "terminating",
      originating: direction == "originating",
      localIdentity: this.localIdentity(),
      remoteIdentity: this.remoteIdentity(),
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
        const element = this._streams[type].elements[kind];

        lwpUtils.mediaElementEvents().forEach((eventName) => {
          element.addEventListener(eventName, (event) => {
            this._emit(
              type + "." + kind + "." + eventName,
              this,
              element,
              event
            );
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
        if (this.hasSession() && newTrack) {
          this.replaceSenderTrack(newTrack.track);
        }
      }
    );
    this._libwebphone.on(
      "mediaDevices.audio.output.changed",
      (lwp, mediaDevices, preferedDevice) => {
        Object.keys(this._streams.remote.elements).forEach((kind) => {
          const element = this._streams.remote.elements[kind];
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
      const peerConnection = this.getPeerConnection();
      this._emit("peerconnection", this, peerConnection);
      peerConnection.addEventListener("track", (...event) => {
        this._emit("peerconnection.add.track", this, ...event);
        this._updateStreams();
      });
      peerConnection.addEventListener("removestream", (...event) => {
        this._emit("peerconnection.remove.track", this, ...event);
        this._updateStreams();
      });
    }
    if (this.hasSession()) {
      this._getSession().on("progress", (...event) => {
        this._emit("progress", this, ...event);
      });
      this._getSession().on("connecting", () => {
        // Mute video and audio after the local media stream is added into RTCSession
        this._getSession().mute({
          audio: this._config.startWithAudioMuted,
          video: this._config.startWithVideoMuted,
        });
      });
      this._getSession().on("confirmed", (...event) => {
        this._answerTime = new Date();
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
        const peerConnection = data[0].peerconnection;
        this._emit("peerconnection", this, peerConnection);
        peerConnection.addEventListener("track", (...event) => {
          this._emit("peerconnection.add.track", this, ...event);
          this._updateStreams();
        });
        peerConnection.addEventListener("remotestream", (...event) => {
          this._emit("peerconnection.remove.track", this, ...event);
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
  _timeUpdate() {
    if (this._answerTime) {
      const duration = new Date() - this._answerTime;
      const options = {
        secondsDecimalDigits: 0,
      };

      this._emit(
        "timeupdate",
        this,
        this._answerTime,
        duration,
        prettyMilliseconds(Math.ceil(duration / 1000) * 1000, options)
      );
    }

    if (this.hasSession()) {
      setTimeout(() => {
        this._timeUpdate();
      }, 100);
    }
  }

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
      const peerConnection = this.getPeerConnection();
      const mediaStream = this._streams[type].mediaStream;
      if (peerConnection) {
        const peerTracks = [];
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
        const element = this._streams[type].elements[kind];
        if (element) {
          const track = mediaStream.getTracks().find((track) => {
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
    const peerIds = peerTracks.map((track) => {
      return track.id;
    });
    const currentIds = mediaStream.getTracks().map((track) => {
      return track.id;
    });
    const addIds = peerIds.filter((peerId) => {
      return !currentIds.includes(peerId);
    });
    const removeIds = currentIds.filter((currentId) => {
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
      const mediaStream = this._streams[type].mediaStream;
      this._emit(type + ".mediaStream.connect", this, mediaStream);
    });

    if (!this.hasSession()) {
      return;
    }

    const peerConnection = this.getPeerConnection();
    if (peerConnection) {
      peerConnection.getSenders().forEach((peer) => {
        if (peer.track) {
          peer.track.enabled = true;
        }
      });
    }

    Object.keys(this._streams).forEach((type) => {
      Object.keys(this._streams[type].elements).forEach((kind) => {
        const element = this._streams[type].elements[kind];
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
        this._emit(type + "." + kind + ".connect", this, element);
      });
    });
  }

  _disconnectStreams() {
    Object.keys(this._streams).forEach((type) => {
      const mediaStream = this._streams[type].mediaStream;
      this._emit(type + ".mediaStream.disconnect", this, mediaStream);
    });

    if (!this.hasSession()) {
      return;
    }

    const peerConnection = this.getPeerConnection();
    if (peerConnection) {
      peerConnection.getSenders().forEach((peer) => {
        if (peer.track) {
          peer.track.enabled = false;
        }
      });
    }

    Object.keys(this._streams).forEach((type) => {
      Object.keys(this._streams[type].elements).forEach((kind) => {
        const element = this._streams[type].elements[kind];
        if (element && !element.paused) {
          element.pause();
        }
        this._emit(type + "." + kind + ".disconnect", this, element);
      });
    });
  }

  _destroyStreams() {
    this._emit("ringing.stopped", this);

    const peerConnection = this.getPeerConnection();
    if (peerConnection) {
      peerConnection.getSenders().forEach((peer) => {
        if (peer.track) {
          peer.track.stop();
        }
      });
    }
  }
}
