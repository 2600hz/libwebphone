"use strict";

import { merge } from "./lwpUtils";
import lwpRenderer from "./lwpRenderer";

export default class extends lwpRenderer {
  constructor(libwebphone, config = {}) {
    super(libwebphone);
    this._libwebphone = libwebphone;
    this._emit = this._libwebphone._mediaDevicesEvent;
    this._initProperties(config);
    this._initInternationalization(config.i18n || {});
    this._initInputStreams();
    this._initOutputStreams();
    this._initRemoteAudio();
    this._initToneAudio();
    this._initPreviewAudio();
    this._initRingAudio();
    this._initEventBindings();
    this._initRenderTargets();
    this._emit("created", this);
    return this;
  }

  startAudioContext() {
    if (!this._started) {
      this._started = true;
      this._audioContext.resume();
      this._previewAudio.oscillatorNode.start();
      this._ringAudio.carrierNode.start();
      this._ringAudio.modulatorNode.start();

      this._emit("audio.context.started", this);
    }
  }

  connectLocalAudio(audioNode) {
    this._localAudio.volumeGainNode.connect(audioNode);
  }

  startPreviewTone() {
    this._previewAudio.oscillatorGainNode.gain.value = 1;
    this._emit("preview.tone.started", this);
  }

  stopPreviewTone() {
    this._previewAudio.oscillatorGainNode.gain.value = 0;
    this._emit("preview.tone.stop", this);
  }

  isPreviewToneActive() {
    return this._previewAudio.oscillatorGainNode.gain.value > 0;
  }

  startPreviewLoopback() {
    this._previewAudio.loopbackGainNode.gain.value = 1;
    this._emit("preview.loopback.started", this);
  }

  stopPreviewLoopback() {
    this._previewAudio.loopbackGainNode.gain.value = 0;
    this._emit("preview.loopback.stop", this);
  }

  togglePreviewLoopback() {
    if (this.isPreviewLoopbackActive()) {
      this.stopPreviewLoopback();
    } else {
      this.startPreviewLoopback();
    }
  }

  isPreviewLoopbackActive() {
    return this._previewAudio.loopbackGainNode.gain.value > 0;
  }

  changeOutputVolume(type, volume) {
    volume = volume.toFixed(5);
    switch (type) {
      case "master":
        this._outputAudio.volumeGainNode.gain.value = volume;
        break;
      case "ringer":
        this._ringAudio.ringerGainNode.gain.value = volume;
        break;
      case "dtmf":
        this._toneAudio.dtmfGainNode.gain.value = volume;
        break;
      case "remote":
        this._remoteAudio.remoteGainNode.gain.value = volume;
        break;
    }

    this._emit(type + ".output.volume", this, volume);
  }

  changeInputVolume(type, volume) {
    volume = volume.toFixed(5);
    switch (type) {
      case "microphone":
        this._localAudio.volumeGainNode.gain.value = volume;
        break;
    }

    this._emit(type + ".input.volume", this, volume);
  }

  playDTMF(...tones) {
    this.startAudioContext();

    /** TODO: cleanup and reuse what is possible */

    let duration = this._config.dtmf.duration;
    let sampleRate = 8000;
    let buffer = this._audioContext.createBuffer(
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

    let bufferSource = this._audioContext.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(this._toneAudio.dtmfGainNode);
    bufferSource.start();

    setTimeout(() => {
      bufferSource.stop();
      bufferSource.disconnect();
    }, (duration + 0.5) * 1000);
  }

  startRinging(newCall = null) {
    this.startAudioContext();

    if (this._ringAudio.calls.length == 0) {
      this._ringAudio.calls.push(newCall);
      this._ringTimer();
    } else {
      let call = this._ringAudio.calls.find((currentCall) => {
        return newCall.getId() == currentCall.getId();
      });
      if (!call) {
        this._ringAudio.calls.push(newCall);
      }
    }
  }

  stopRinging(answeredCall = null) {
    if (!answeredCall) {
      this._ringAudio.calls = [];
    } else {
      this._ringAudio.calls = this._ringAudio.calls.filter((currentCall) => {
        return answeredCall.getId() != currentCall.getId();
      });
    }

    if (this._ringAudio.calls.length == 0) {
      this._ringerMute();
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
        starttone: "Play Tone",
        stoptone: "Stop Tone",
        startloopback: "Start Loopback",
        stoploopback: "Stop Loopback",
        mastervolume: "Master Volume",
        ringervolume: "Ringer Volume",
        dtmfvolume: "DTMF Volume",
        remotevolume: "Call Volume",
        microphonevolume: "Microphone Volume",
      },
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("mediaDevices", resourceBundles);
  }

  _initProperties(config) {
    var defaults = {
      output: {
        master: {
          type: "output",
          show: true,
          default: 0.5,
        },
        ringer: {
          type: "output",
          show: true,
          default: 0.5,
        },
        dtmf: {
          type: "output",
          show: true,
          default: 0.25,
        },
        remote: {
          type: "output",
          show: true,
          default: 1,
        },
      },
      input: {
        microphone: {
          type: "input",
          show: true,
          default: 0.25,
        },
      },
      preview: {
        loopback: {
          show: true,
          delay: 0.5,
          startOnPreview: false,
        },
        tone: {
          show: true,
          frequency: 440,
          duration: 1.5,
          type: "sine",
          startOnPreview: false,
        },
      },
      dtmf: {
        duration: 0.15,
      },
      ringer: {
        onTime: 1500,
        offTime: 1000,
        carrier: {
          frequency: 440,
        },
        modulator: {
          frequency: 10,
        },
      },
      renderTargets: [],
    };
    this._config = merge(defaults, config);

    this.maxVolume = 10000;
    this.minVolume = 0;

    this._audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
  }

  _initInputStreams() {
    this._localAudio = {};

    this._localAudio.volumeGainNode = this._audioContext.createGain();
    this._localAudio.volumeGainNode.gain.value = this._config.input.microphone.default;

    this._localAudio.sourceStream = null;
  }

  _initOutputStreams() {
    this._outputAudio = {};

    this._outputAudio.volumeGainNode = this._audioContext.createGain();
    this._outputAudio.volumeGainNode.gain.value = this._config.output.master.default;
    this._outputAudio.volumeGainNode.connect(this._audioContext.destination);
  }

  _initPreviewAudio() {
    this._previewAudio = {};

    this._previewAudio.oscillatorGainNode = this._audioContext.createGain();
    this._previewAudio.oscillatorGainNode.gain.value = 0;
    this._previewAudio.oscillatorGainNode.connect(
      this._outputAudio.volumeGainNode
    );

    this._previewAudio.oscillatorNode = this._audioContext.createOscillator();
    this._previewAudio.oscillatorNode.frequency.value = this._config.preview.tone.frequency;
    this._previewAudio.oscillatorNode.type = this._config.preview.tone.type;
    this._previewAudio.oscillatorNode.connect(
      this._previewAudio.oscillatorGainNode
    );

    this._previewAudio.loopbackGainNode = this._audioContext.createGain();
    this._previewAudio.loopbackGainNode.connect(
      this._outputAudio.volumeGainNode
    );

    this._previewAudio.loopbackDelayNode = this._audioContext.createDelay(
      this._config.preview.loopback.delay + 1.5
    );
    this._previewAudio.loopbackDelayNode.delayTime.value = this._config.preview.loopback.delay;
    this._localAudio.volumeGainNode.connect(
      this._previewAudio.loopbackDelayNode
    );
    this._previewAudio.loopbackDelayNode.connect(
      this._previewAudio.loopbackGainNode
    );
  }

  _initRemoteAudio() {
    this._remoteAudio = {};

    this._remoteAudio.remoteGainNode = this._audioContext.createGain();
    this._remoteAudio.remoteGainNode.gain.value = this._config.output.remote.default;
    this._remoteAudio.remoteGainNode.connect(this._outputAudio.volumeGainNode);

    this._remoteAudio.sourceStream = null;
  }

  _initToneAudio() {
    this._toneAudio = {};

    this._toneAudio.dtmfGainNode = this._audioContext.createGain();
    this._toneAudio.dtmfGainNode.gain.value = this._config.output.dtmf.default;
    this._toneAudio.dtmfGainNode.connect(this._outputAudio.volumeGainNode);
  }

  _initRingAudio() {
    this._ringAudio = {};

    this._ringAudio.ringerGainNode = this._audioContext.createGain();
    this._ringAudio.ringerGainNode.gain.value = this._config.output.ringer.default;
    this._ringAudio.ringerGainNode.connect(this._outputAudio.volumeGainNode);

    this._ringAudio.carrierGain = this._audioContext.createGain();
    this._ringAudio.carrierGain.gain.value = 0;
    this._ringAudio.carrierGain.connect(this._ringAudio.ringerGainNode);

    this._ringAudio.modulatorGain = this._audioContext.createGain();
    this._ringAudio.modulatorGain.gain.value = 0;
    this._ringAudio.modulatorGain.connect(this._ringAudio.carrierGain.gain);

    this._ringAudio.carrierNode = this._audioContext.createOscillator();
    this._ringAudio.carrierNode.frequency.value = this._config.ringer.carrier.frequency;
    this._ringAudio.carrierNode.connect(this._ringAudio.carrierGain);

    this._ringAudio.modulatorNode = this._audioContext.createOscillator();
    this._ringAudio.modulatorNode.frequency.value = this._config.ringer.modulator.frequency;
    this._ringAudio.modulatorNode.connect(this._ringAudio.modulatorGain);

    this._ringAudio.calls = [];
  }

  _initEventBindings() {}

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
        starttone: "libwebphone:mediaDevices.starttone",
        stoptone: "libwebphone:mediaDevices.stoptone",
        startloopback: "libwebphone:mediaDevices.startloopback",
        stoploopback: "libwebphone:mediaDevices.stoploopback",
        mastervolume: "libwebphone:mediaDevices.mastervolume",
        ringervolume: "libwebphone:mediaDevices.ringervolume",
        dtmfvolume: "libwebphone:mediaDevices.dtmfvolume",
        remotevolume: "libwebphone:mediaDevices.remotevolume",
        microphonevolume: "libwebphone:mediaDevices.microphonevolume",
      },
      by_id: {
        mastervolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeOutputVolume("master", element.value / this.maxVolume);
            },
          },
        },
        ringervolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeOutputVolume("ringer", element.value / this.maxVolume);
            },
          },
        },
        dtmfvolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeOutputVolume("dtmf", element.value / this.maxVolume);
            },
          },
        },
        remotevolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeOutputVolume("remote", element.value / this.maxVolume);
            },
          },
        },
        microphonevolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeInputVolume(
                "microphone",
                element.value / this.maxVolume
              );
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
          {{#data.output.master.show}}    
            <div>
              <label for="{{by_id.mastervolume.elementId}}">
                {{i18n.mastervolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.output.master.value}}" id="{{by_id.mastervolume.elementId}}">
            </div>
          {{/data.output.master.show}}

          {{#data.output.ringer.show}}
            <div>
              <label for="{{by_id.ringervolume.elementId}}">
                {{i18n.ringervolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.output.ringer.value}}" id="{{by_id.ringervolume.elementId}}">
            </div>
          {{/data.output.ringer.show}}

          {{#data.output.dtmf.show}}
            <div>
              <label for="{{by_id.dtmfvolume.elementId}}">
                {{i18n.dtmfvolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.output.dtmf.value}}" id="{{by_id.dtmfvolume.elementId}}">
            </div>
          {{/data.output.dtmf.show}}

          {{#data.output.remote.show}}
            <div>
              <label for="{{by_id.remotevolume.elementId}}">
                {{i18n.remotevolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.output.remote.value}}" id="{{by_id.remotevolume.elementId}}">
            </div>
          {{/data.output.remote.show}}

          {{#data.input.microphone.show}}
            <div>
              <label for="{{by_id.microphonevolume.elementId}}">
                {{i18n.microphonevolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.input.microphone.value}}" id="{{by_id.microphonevolume.elementId}}">
            </div>
          {{/data.input.microphone.show}}

        </div>
        `;
  }

  _renderData(
    data = {
      output: { master: {}, ringer: {}, dtmf: {}, remote: {} },
      input: { microphone: {} },
      volume: {},
    }
  ) {
    data.output.master.value =
      this._outputAudio.volumeGainNode.gain.value * this.maxVolume;
    data.output.ringer.value =
      this._ringAudio.ringerGainNode.gain.value * this.maxVolume;
    data.output.dtmf.value =
      this._toneAudio.dtmfGainNode.gain.value * this.maxVolume;
    data.output.remote.value =
      this._remoteAudio.remoteGainNode.gain.value * this.maxVolume;
    data.input.microphone.value =
      this._localAudio.volumeGainNode.gain.value * this.maxVolume;

    data.volume.max = this.maxVolume;
    data.volume.min = this.minVolume;

    return data;
  }

  /** Helper functions */

  _updateInputChain(mediaStream) {
    /*
    let this._libwebphone.getAudioMixer();
    if (audioMixer) {
      audioMixer._updateInputChain(mediaStream)
    }
    let audioTrack = mediaStream.getTracks().find((track) => {
      return track.kind == "audio" && track.readyState == "live";
    });
    if (this._localAudio.sourceStream) {
      this._localAudio.sourceStream.disconnect();
      this._localAudio.sourceStream = null;
    }
    if (audioTrack) {
      this._localAudio.sourceStream = this._audioContext.createMediaStreamSource(
        mediaStream
      );
      this._localAudio.sourceStream.connect(this._localAudio.volumeGainNode);
    }
    */
  }

  _ringTimer() {
    if (this._ringAudio.calls.length > 0) {
      if (this._ringAudio.carrierGain.gain.value < 0.5) {
        this._ringerUnmute();
        setTimeout(() => {
          this._ringTimer();
        }, this._config.ringer.onTime);
      } else {
        this._ringerMute();
        setTimeout(() => {
          this._ringTimer();
        }, this._config.ringer.offTime);
      }
    } else {
      this._ringerMute();
    }
  }

  _ringerMute() {
    let timestamp = this._audioContext.currentTime + 1;
    this._ringAudio.modulatorGain.gain.exponentialRampToValueAtTime(
      0.00001,
      timestamp
    );

    this._ringAudio.carrierGain.gain.exponentialRampToValueAtTime(
      0.00001,
      timestamp
    );
  }

  _ringerUnmute() {
    let timestamp = this._audioContext.currentTime;
    this._ringAudio.carrierGain.gain.value = 1;
    this._ringAudio.carrierGain.gain.cancelScheduledValues(0);
    this._ringAudio.carrierGain.gain.setValueAtTime(1, timestamp);

    this._ringAudio.modulatorGain.gain.value = 1;
    this._ringAudio.modulatorGain.gain.cancelScheduledValues(0);
    this._ringAudio.modulatorGain.gain.setValueAtTime(1, timestamp);
  }

  _createMediaStreamDestination() {
    return this._audioContext.createMediaStreamDestination();
  }

  _createMediaStreamSource(mediaStream) {
    return this._audioContext.createMediaStreamSource(mediaStream);
  }

  _createMediaElementSource(mediaElement) {
    return this._audioContext.createMediaElementSource(mediaElement);
  }

  _setRemoteSourceStream(sourceStream = null) {
    let previousSourceStream = this._remoteAudio.sourceStream;

    if (previousSourceStream) {
      previousSourceStream.disconnect();
      this._remoteAudio.sourceStream = null;
      this._emit("remote.audio.disconnected", this, previousSourceStream);
    }

    if (sourceStream) {
      this._remoteAudio.sourceStream = sourceStream;
      this._remoteAudio.sourceStream.connect(this._remoteAudio.remoteGainNode);

      this._emit("remote.audio.connected", this, sourceStream);
    }
  }

  _setLocalSourceStream(sourceStream = null) {
    let previousSourceStream = this._localAudio.sourceStream;

    if (previousSourceStream) {
      previousSourceStream.disconnect();
      this._localAudio.sourceStream = null;
      this._emit("local.audio.disconnected", this, previousSourceStream);
    }

    if (sourceStream) {
      this._localAudio.sourceStream = sourceStream;
      this._localAudio.sourceStream.connect(this._localAudio.inputGainNode);

      this._emit("local.audio.connected", this, sourceStream);
    }
  }
}
