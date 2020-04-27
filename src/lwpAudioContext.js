"use strict";

import { merge, mediaElementEvents } from "./lwpUtils";
import lwpRenderer from "./lwpRenderer";

export default class extends lwpRenderer {
  constructor(libwebphone, config = {}) {
    super(libwebphone);
    this._libwebphone = libwebphone;
    this._emit = this._libwebphone._audioContextEvent;
    this._initProperties(config);
    this._initInternationalization(config.i18n || {});
    this._initRemoteAudio();
    this._initPreviewAudio();
    this._initTonesAudio();
    this._initRingAudio();
    this._initEventBindings();
    this._initRenderTargets();
    this._emit("created", this);
    return this;
  }

  startAudioContext() {
    if (!this._started) {
      this._audioContext.resume();
      Object.keys(this._config.channels).forEach((channel) => {
        if (
          this._config.manageMediaElements &&
          this._config.channels[channel].mediaElement.element
        ) {
          this._config.channels[channel].mediaElement.element.play();
        }

        if (
          this._config.individualAudioContexts &&
          this._config.channels[channel].context
        ) {
          this._config.channels[channel].context.resume();
        }
      });

      this._previewAudio.oscillatorNode.start();
      this._ringAudio.carrierNode.start();
      this._ringAudio.modulatorNode.start();

      this._started = true;

      this._emit("started", this);
    }
  }

  startPreviewTone() {
    if (this.isPreviewToneActive()) {
      return;
    }

    this.startAudioContext();

    this._previewAudio.toneActive = true;
    this._previewAudio.oscillatorNode.connect(
      this._previewAudio.destinationStream
    );

    this._emit("preview.tone.started", this);
  }

  stopPreviewTone() {
    if (!this.isPreviewToneActive()) {
      return;
    }

    this._previewAudio.toneActive = false;
    this._previewAudio.oscillatorNode.disconnect();

    this._emit("preview.tone.stopped", this);
  }

  togglePreviewTone() {
    if (this.isPreviewToneActive()) {
      this.stopPreviewTone();
    } else {
      this.startPreviewTone();
    }
  }

  isPreviewToneActive() {
    return this._previewAudio.toneActive;
  }

  startPreviewLoopback() {
    if (this.isPreviewLoopbackActive()) {
      return;
    }

    this.startAudioContext();

    this._previewAudio.loopbackActive = true;
    this._previewAudio.loopbackDelayNode.connect(
      this._previewAudio.destinationStream
    );

    this._emit("preview.loopback.started", this);
  }

  stopPreviewLoopback() {
    if (!this.isPreviewLoopbackActive()) {
      return;
    }

    this._previewAudio.loopbackActive = false;
    this._previewAudio.loopbackDelayNode.disconnect();

    this._emit("preview.loopback.stopped", this);
  }

  togglePreviewLoopback() {
    if (this.isPreviewLoopbackActive()) {
      this.stopPreviewLoopback();
    } else {
      this.startPreviewLoopback();
    }
  }

  isPreviewLoopbackActive() {
    return this._previewAudio.loopbackActive;
  }

  stopPreviews() {
    this.stopPreviewTone();
    this.stopPreviewLoopback();
  }

  changeVolume(channel, volume, options = { scale: true }) {
    this.startAudioContext();

    if (options.scale) {
      volume = volume / this._config.volumeMax;
    }

    if (volume < this._config.volumeMin) {
      volume = this._config.volumeMin;
    }

    if (this._config.channels[channel]) {
      this._config.channels[channel].volume = volume;

      if (
        this._config.manageMediaElements &&
        this._config.channels[channel].mediaElement.element
      ) {
        this._config.channels[channel].mediaElement.element.volume = volume;
      }

      this._emit(channel + ".channel.volume", this, volume);
    }
  }

  playTones(...tones) {
    this.startAudioContext();

    let duration = this._config.channels.tones.duration;
    let sampleRate = 8000;
    let buffer = this._tonesAudio.context.createBuffer(
      tones.length,
      sampleRate,
      sampleRate
    );

    for (let index = 0; index < tones.length; index++) {
      let channel = buffer.getChannelData(index);
      for (let i = 0; i < duration * sampleRate; i++) {
        channel[i] = Math.sin(2 * Math.PI * tones[index] * (i / sampleRate));
      }
    }

    let bufferSource = this._tonesAudio.context.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(this._tonesAudio.destinationStream);
    bufferSource.start();

    setTimeout(() => {
      bufferSource.disconnect();
      bufferSource.stop();
    }, (duration + 0.5) * 1000);
  }

  startRinging(requestId = null) {
    this.startAudioContext();

    if (!requestId) {
      this._ringAudio.calls.push(null);
    } else if (!this._ringAudio.calls.includes(requestId)) {
      this._ringAudio.calls.push(requestId);
    }

    if (!this._ringAudio.ringerConnected) {
      this._ringAudio.ringerConnected = true;
      this._ringAudio.ringerGain.connect(this._ringAudio.destinationStream);
    }

    if (!this._ringingTimer) {
      this._ringTimer();
    }
  }

  stopRinging(requestId = null) {
    if (!requestId) {
      requestId = null;
    }

    let requestIndex = this._ringAudio.calls.indexOf(requestId);

    if (requestIndex != -1) {
      this._ringAudio.calls.splice(requestIndex, 1);
    }

    if (this._ringAudio.calls.length == 0) {
      this.stopAllRinging();
    }
  }

  stopAllRinging() {
    if (this._ringAudio.ringerConnected) {
      this._ringAudio.ringerConnected = false;
      this._ringAudio.ringerGain.disconnect();
    }

    this._ringAudio.calls = [];

    this._ringerMute();
  }

  getMediaElement(channel) {
    if (
      this._config.channels[channel] &&
      this._config.channels[channel].mediaElement.element
    ) {
      return this._config.channels[channel].mediaElement.element;
    }
  }

  updateRenders() {
    this.render((render) => {
      render.data = this._renderData(render.data);
      return render;
    });
  }

  /** Init functions */

  _initInternationalization(config) {
    let defaults = {
      en: {
        ringervolume: "Ringer Volume",
        tonesvolume: "Tones Volume",
        remotevolume: "Call Volume",
        previewvolume: "Preview Volume",
      },
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("audioContext", resourceBundles);
  }

  _initProperties(config) {
    let defaults = {
      channels: {
        ringer: {
          onTime: 1.5,
          offTime: 1.0,
          carrier: {
            frequency: 440,
          },
          modulator: {
            frequency: 10,
            amplitude: 0.75,
          },
          show: true,
          volume: 1.0,
          mediaElement: {
            create: true,
            elementId: null,
            element: null,
            initParameters: {
              muted: false,
            },
          },
        },
        tones: {
          duration: 0.15,
          show: true,
          volume: 0.25,
          mediaElement: {
            create: true,
            elementId: null,
            element: null,
            initParameters: {
              muted: false,
            },
          },
        },
        remote: {
          show: false,
          volume: 1.0,
          mediaElement: {
            create: false,
            elementId: null,
            element: null,
            initParameters: {
              muted: true,
            },
          },
        },
        preview: {
          loopback: {
            delay: 0.5,
          },
          tone: {
            frequency: 440,
            duration: 1.5,
            type: "sine",
          },
          show: true,
          volume: 1.0,
          mediaElement: {
            create: true,
            elementId: null,
            element: null,
            initParameters: {
              muted: false,
            },
          },
        },
      },
      renderTargets: [],
      manageMediaElements: true,
      individualAudioContexts: false,
      volumeMax: 100,
      volumeMin: 0,
    };
    this._config = merge(defaults, config);

    this._audioContext = this._shimAudioContext();

    this._ringingTimer = null;

    Object.keys(this._config.channels).forEach((channel) => {
      if (
        !this._config.channels[channel].mediaElement.element &&
        this._config.channels[channel].mediaElement.elementId
      ) {
        this._config.channels[
          channel
        ].mediaElement.element = document.getElementById(
          this._config.channels[channel].mediaElement.elementId
        );
      }

      if (
        !this._config.channels[channel].mediaElement.element &&
        this._config.channels[channel].mediaElement.create
      ) {
        this._config.channels[
          channel
        ].mediaElement.element = document.createElement("audio");
      }

      if (
        this._config.manageMediaElements &&
        this._config.channels[channel].mediaElement.element
      ) {
        this._config.channels[
          channel
        ].mediaElement.element.volume = this._config.channels[channel].volume;

        Object.keys(
          this._config.channels[channel].mediaElement.initParameters
        ).forEach((parameterName) => {
          this._config.channels[channel].mediaElement.element[
            parameterName
          ] = this._config.channels[channel].mediaElement.initParameters[
            parameterName
          ];
        });
      }

      if (this._config.channels[channel].mediaElement.element) {
        mediaElementEvents().forEach((eventName) => {
          this._config.channels[channel].mediaElement.element.addEventListener(
            eventName,
            (event) => {
              this._emit(channel + "." + eventName, this, event);
            }
          );
        });
      }
    });
  }

  _initRemoteAudio() {
    this._remoteAudio = {};

    if (this._config.individualAudioContexts) {
      this._remoteAudio.context = this._shimAudioContext();
    } else {
      this._remoteAudio.context = this._audioContext;
    }

    this._remoteAudio.sourceStream = null;

    this._remoteAudio.destinationStream = this._createMediaStreamDestination(
      this._remoteAudio.context
    );

    if (this._config.channels.remote.mediaElement.element) {
      this._config.channels.remote.mediaElement.element.srcObject = this._remoteAudio.destinationStream.stream;
    }
  }

  _initPreviewAudio() {
    this._previewAudio = {};

    if (this._config.individualAudioContexts) {
      this._previewAudio.context = this._shimAudioContext();
    } else {
      this._previewAudio.context = this._audioContext;
    }

    this._previewAudio.sourceStream = null;

    this._previewAudio.toneActive = false;

    this._previewAudio.oscillatorNode = this._previewAudio.context.createOscillator();
    this._previewAudio.oscillatorNode.frequency.value = this._config.channels.preview.tone.frequency;
    this._previewAudio.oscillatorNode.type = this._config.channels.preview.tone.type;

    this._previewAudio.loopbackActive = false;

    this._previewAudio.loopbackDelayNode = this._previewAudio.context.createDelay(
      this._config.channels.preview.loopback.delay + 1.5
    );
    this._previewAudio.loopbackDelayNode.delayTime.value = this._config.channels.preview.loopback.delay;

    this._previewAudio.destinationStream = this._createMediaStreamDestination(
      this._previewAudio.context
    );

    if (this._config.channels.preview.mediaElement.element) {
      this._config.channels.preview.mediaElement.element.srcObject = this._previewAudio.destinationStream.stream;
    }
  }

  _initTonesAudio() {
    this._tonesAudio = {};

    if (this._config.individualAudioContexts) {
      this._tonesAudio.context = this._shimAudioContext();
    } else {
      this._tonesAudio.context = this._audioContext;
    }

    this._tonesAudio.destinationStream = this._createMediaStreamDestination(
      this._tonesAudio.context
    );

    if (this._config.channels.tones.mediaElement.element) {
      this._config.channels.tones.mediaElement.element.srcObject = this._tonesAudio.destinationStream.stream;
    }
  }

  _initRingAudio() {
    this._ringAudio = {};

    if (this._config.individualAudioContexts) {
      this._ringAudio.context = this._shimAudioContext();
    } else {
      this._ringAudio.context = this._audioContext;
    }

    this._ringAudio.calls = [];

    this._ringAudio.ringerConnected = false;

    this._ringAudio.carrierGain = this._ringAudio.context.createGain();

    this._ringAudio.carrierNode = this._ringAudio.context.createOscillator();
    this._ringAudio.carrierNode.frequency.value = this._config.channels.ringer.carrier.frequency;
    this._ringAudio.carrierNode.connect(this._ringAudio.carrierGain);

    this._ringAudio.modulatorNode = this._ringAudio.context.createOscillator();
    this._ringAudio.modulatorNode.frequency.value = this._config.channels.ringer.modulator.frequency;
    this._ringAudio.modulatorNode.connect(this._ringAudio.carrierGain.gain);

    this._ringAudio.ringerGain = this._ringAudio.context.createGain();
    this._ringAudio.carrierGain.connect(this._ringAudio.ringerGain);

    this._ringAudio.destinationStream = this._createMediaStreamDestination(
      this._ringAudio.context
    );

    if (this._config.channels.ringer.mediaElement.element) {
      this._config.channels.ringer.mediaElement.element.srcObject = this._ringAudio.destinationStream.stream;
    }

    this._ringerUnmute();
  }

  _initEventBindings() {
    this._libwebphone.on("call.ringing.started", (lwp, call) => {
      this.startRinging(call.getId());
    });
    this._libwebphone.on("call.ringing.stopped", (lwp, call) => {
      this.stopRinging(call.getId());
    });

    this._libwebphone.on(
      "call.primary.remote.audio.added",
      (lwp, call, track) => {
        this._createRemoteSourceStream(track.mediaStream);
      }
    );

    this._libwebphone.on(
      "call.primary.remote.mediaStream.connect",
      (lwp, call, mediaStream) => {
        this._createRemoteSourceStream(mediaStream);
      }
    );

    this._libwebphone.on("dialpad.tones.play", (lwp, dialpad, tones) => {
      this.playTones.apply(this, tones);
    });

    this._libwebphone.on("audioContext.ringer.channel.volume", () => {
      this.updateRenders();
    });
    this._libwebphone.on("audioContext.tones.channel.volume", () => {
      this.updateRenders();
    });
    this._libwebphone.on("audioContext.remote.channel.volume", () => {
      this.updateRenders();
    });
    this._libwebphone.on("audioContext.preview.channel.volume", () => {
      this.updateRenders();
    });
    this._libwebphone.on("audioContext.local.channel.volume", () => {
      this.updateRenders();
    });

    this._libwebphone.on(
      "mediaDevices.streams.started",
      (lwp, mediaDevices, mediaStream) => {
        this._createLocalSourceStream(mediaStream);
      }
    );
    this._libwebphone.on("mediaDevices.streams.stopped", () => {
      this._connectLocalSourceStream();
    });
    this._libwebphone.on(
      "mediaDevices.audio.input.changed",
      (lwp, mediaDevices, track) => {
        this._createLocalSourceStream(track.mediaStream);
      }
    );
    this._libwebphone.on(
      "mediaDevices.audio.output.changed",
      (lwp, mediaDevices, preferedDevice) => {
        Object.keys(this._config.channels).forEach((channel) => {
          if (this._config.channels[channel].mediaElement.element) {
            this._config.channels[channel].mediaElement.element.setSinkId(
              preferedDevice.id
            );
          }
        });
      }
    );
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
        mastervolume: "libwebphone:audioContext.mastervolume",
        ringervolume: "libwebphone:audioContext.ringervolume",
        tonesvolume: "libwebphone:audioContext.tonesvolume",
        remotevolume: "libwebphone:audioContext.remotevolume",
        previewvolume: "libwebphone:audioContext.previewvolume",
        localvolume: "libwebphone:audioContext.localvolume",
      },
      by_id: {
        ringervolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeVolume("ringer", element.value);
            },
          },
        },
        tonesvolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeVolume("tones", element.value);
            },
          },
        },
        remotevolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeVolume("remote", element.value);
            },
          },
        },
        previewvolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeVolume("preview", element.value);
            },
          },
        },
      },
      data: merge(this._renderData(), this._config),
    };
  }

  _renderDefaultTemplate() {
    return `
        <div>
          {{#data.channels.ringer.show}}
            <div>
              <label for="{{by_id.ringervolume.elementId}}">
                {{i18n.ringervolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.volumes.ringer}}" id="{{by_id.ringervolume.elementId}}">
            </div>
          {{/data.channels.ringer.show}}

          {{#data.channels.tones.show}}
            <div>
              <label for="{{by_id.tonesvolume.elementId}}">
                {{i18n.tonesvolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.volumes.tones}}" id="{{by_id.tonesvolume.elementId}}">
            </div>
          {{/data.channels.tones.show}}

          {{#data.channels.remote.show}}
            <div>
              <label for="{{by_id.remotevolume.elementId}}">
                {{i18n.remotevolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.volumes.remote}}" id="{{by_id.remotevolume.elementId}}">
            </div>
          {{/data.channels.remote.show}}

          {{#data.channels.preview.show}}
            <div>
              <label for="{{by_id.previewvolume.elementId}}">
                {{i18n.previewvolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.volumes.preview}}" id="{{by_id.previewvolume.elementId}}">
            </div>
          {{/data.channels.preview.show}}          

        </div>
        `;
  }

  _renderData(data = { volumes: {}, volume: {} }) {
    Object.keys(this._config.channels).forEach((channel) => {
      data.volumes[channel] =
        this._config.channels[channel].volume * this._config.volumeMax;
    });

    data.volume.max = this._config.volumeMax;
    data.volume.min = this._config.volumeMin;

    return data;
  }

  /** Helper functions */

  _ringTimer() {
    if (this._ringAudio.calls.length > 0) {
      if (this._ringAudio.ringerGain.gain.value < 0.5) {
        this._ringerUnmute();
        this._ringingTimer = setTimeout(() => {
          this._ringTimer();
        }, this._config.channels.ringer.onTime * 1000);
      } else {
        this._ringerMute();
        this._ringingTimer = setTimeout(() => {
          this._ringTimer();
        }, this._config.channels.ringer.offTime * 1000);
      }
    } else {
      if (this._ringingTimer) {
        clearTimeout(this._ringingTimer);
        this._ringingTimer = null;
      }

      if (this._ringAudio.ringerConnected) {
        this._ringAudio.ringerConnected = false;
        this._ringAudio.ringerGain.disconnect();
      }
    }
  }

  _ringerMute() {
    let timestamp =
      this._ringAudio.context.currentTime +
      this._config.channels.ringer.onTime * 0.2;

    this._ringAudio.ringerGain.gain.cancelScheduledValues(0);
    this._ringAudio.ringerGain.gain.exponentialRampToValueAtTime(
      0.00001,
      timestamp
    );
  }

  _ringerUnmute() {
    let timestamp =
      this._ringAudio.context.currentTime +
      this._config.channels.ringer.offTime * 0.2;

    this._ringAudio.ringerGain.gain.cancelScheduledValues(0);
    this._ringAudio.ringerGain.gain.exponentialRampToValueAtTime(
      0.5,
      timestamp
    );
  }

  _createMediaStreamDestination(context) {
    return context.createMediaStreamDestination();
  }

  _createLocalMediaStreamSource(mediaStream) {
    return this._previewAudio.context.createMediaStreamSource(mediaStream);
  }

  _createRemoteMediaStreamSource(mediaStream) {
    return this._remoteAudio.context.createMediaStreamSource(mediaStream);
  }

  _getMediaStream(channel) {
    switch (channel) {
      case "ringer":
        return this._ringAudio.destinationStream.stream;
      case "tones":
        return this._tonesAudio.destinationStream.stream;
      case "remote":
        return this._remoteAudio.destinationStream.stream;
      case "preview":
        return this._previewAudio.destinationStream.stream;
    }
  }

  _connectLocalSourceStream(sourceStream = null) {
    let previousSourceStream = this._previewAudio.sourceStream;

    if (previousSourceStream) {
      previousSourceStream.disconnect();
      this._previewAudio.sourceStream = null;
    }

    if (sourceStream) {
      this._previewAudio.sourceStream = sourceStream;
      this._previewAudio.sourceStream.connect(
        this._previewAudio.loopbackDelayNode
      );
    }

    this._emit(
      "local.stream.changed",
      this,
      sourceStream,
      previousSourceStream
    );
  }

  _createLocalSourceStream(mediaStream) {
    let audioTrack = mediaStream.getTracks().find((track) => {
      return track.kind == "audio";
    });

    console.log("mediaStream: ", mediaStream, mediaStream.getTracks());

    if (!audioTrack) {
      return this._connectLocalSourceStream();
    }

    this._connectLocalSourceStream(
      this._createLocalMediaStreamSource(mediaStream)
    );
  }

  _connectRemoteSourceStream(sourceStream = null) {
    let previousSourceStream = this._remoteAudio.sourceStream;

    if (previousSourceStream) {
      previousSourceStream.disconnect();
      this._remoteAudio.sourceStream = null;
    }

    if (sourceStream) {
      this._remoteAudio.sourceStream = sourceStream;
      this._remoteAudio.sourceStream.connect(
        this._remoteAudio.destinationStream
      );
    }

    this._emit(
      "remote.stream.changed",
      this,
      sourceStream,
      previousSourceStream
    );
  }

  _createRemoteSourceStream(mediaStream) {
    let audioTrack = mediaStream.getTracks().find((track) => {
      return track.kind == "audio";
    });

    if (!audioTrack) {
      return this._connectRemoteSourceStream();
    }

    this._connectRemoteSourceStream(
      this._createRemoteMediaStreamSource(mediaStream)
    );
  }

  _shimAudioContext() {
    return new AudioContext({
      latencyHint: "interactive",
    });
  }
}
