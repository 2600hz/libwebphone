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
    this._initAvailableDevices();
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
      this._outputAudio.element.play();

      this._emit("audio.context.started", this);
    }
  }

  connectInputAudio(audioNode) {
    this._inputAudio.volumeGainNode.connect(audioNode);
  }

  startPreviewOutputTone() {
    this._previewAudio.oscillatorGainNode.gain.value = 1;
    this._emit("preview.tone.started", this);
  }

  stopPreviewOutputTone() {
    this._previewAudio.oscillatorGainNode.gain.value = 0;
    this._emit("preview.tone.stop", this);
  }

  isPreviewOutputToneActive() {
    return this._previewAudio.oscillatorGainNode.gain.value > 0;
  }

  startPreviewOutputLoopback() {
    this._previewAudio.loopbackGainNode.gain.value = 1;
    this._emit("preview.loopback.started", this);
  }

  stopPreviewOutputLoopback() {
    this._previewAudio.loopbackGainNode.gain.value = 0;
    this._emit("preview.loopback.stop", this);
  }

  togglePreviewOutputLoopback() {
    if (this.isPreviewOutputLoopbackActive()) {
      this.stopPreviewOutputLoopback();
    } else {
      this.startPreviewOutputLoopback();
    }
  }

  isPreviewOutputLoopbackActive() {
    return this._previewAudio.loopbackGainNode.gain.value > 0;
  }

  stopPreviews() {
    this.stopPreviewOutputLoopback();
    this.stopPreviewOutputTone();

    this._previewActive = false;
    this._emit("preview.stop", this);
  }

  changeOutputVolume(type, volume) {
    volume = volume.toFixed(2);
    switch (type) {
      case "master":
        this._outputAudio.volumeGainNode.gain.value = volume;
        break;
      case "ringer":
        this._outputAudio.ringerGainNode.gain.value = volume;
        break;
      case "dtmf":
        this._outputAudio.dtmfGainNode.gain.value = volume;
        break;
      case "remote":
        this._outputAudio.remoteGainNode.gain.value = volume;
        break;
    }

    this._emit(type + ".output.volume", this, volume);
  }

  changeInputVolume(type, volume) {
    volume = volume.toFixed(2);
    switch (type) {
      case "microphone":
        this._inputAudio.volumeGainNode.gain.value = volume;
        break;
    }

    this._emit(type + ".input.volume", this, volume);
  }

  playTone(...tones) {
    this.startAudioContext();

    let duration = 0.15;
    let sampleRate = 8000; //this._audioContext.sampleRate;
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

    /** TODO: cleanup and reuse what is possible */
    let src = this._audioContext.createBufferSource();
    src.buffer = buffer;
    src.connect(this._notificationAudio.dtmfGainNode);
    src.start();
    src.stop(this._audioContext.currentTime + duration + 0.5);
  }

  startRinging(newCall) {
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

  stopRinging(answeredCall) {
    this._ringAudio.calls = this._ringAudio.calls.filter((currentCall) => {
      return answeredCall.getId() != currentCall.getId();
    });

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
      renderTargets: [],
    };
    this._config = merge(defaults, config);

    this._audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
  }

  _initInputStreams() {
    this._inputAudio = {
      sourceStream: null,
      volumeGainNode: this._audioContext.createGain(),
      destinationStream: this._audioContext.createMediaStreamDestination(),
    };

    this._inputAudio.volumeGainNode.gain.value = this._config.audiomixer.microphone.default;
    this._previewAudioMeter = AudioStreamMeter.audioStreamProcessor(
      this._audioContext,
      () => {}
    );
    this._inputAudio.volumeGainNode.connect(this._previewAudioMeter);
  }

  _initOutputStreams() {
    this._outputAudio = {};

    this._outputAudio.dtmfGainNode = this._audioContext.createGain();
    this._outputAudio.dtmfGainNode.gain.value = this._config.output.dtmf.default;
    this._outputAudio.dtmfGainNode.connect(this._outputAudio.volumeGainNode);

    this._outputAudio.remoteGainNode = this._audioContext.createGain();
    this._outputAudio.remoteGainNode.gain.value = this._config.output.remote.default;
    this._outputAudio.remoteGainNode.connect(this._outputAudio.volumeGainNode);

    this._outputAudio.volumeGainNode = this._audioContext.createGain();
    this._outputAudio.volumeGainNode.gain.value = this._config.output.master.default;
    this._outputAudio.volumeGainNode.connect(
      this._outputAudio.destinationStream
    );
    this._outputAudio.element.srcObject = this._outputAudio.destinationStream.stream;
  }

  _initPreviewAudio() {
    this._previewAudio = {};

    this._previewAudio.oscillatorNode = this._audioContext.createOscillator();
    this._previewAudio.oscillatorNode.frequency.value = this._config.preview.tone.frequency;
    this._previewAudio.oscillatorNode.type = this._config.preview.tone.type;

    this._previewAudio.oscillatorGainNode = this._audioContext.createGain();
    this._previewAudio.oscillatorGainNode.gain.value = 0;
    this._previewAudio.oscillatorGainNode.connect(
      this._outputAudio.volumeGainNode
    );

    this._previewAudio.loopbackDelayNode = this._audioContext.createDelay(
      this._config.preview.loopback.delay + 1.5
    );
    this._previewAudio.loopbackDelayNode.delayTime.value = this._config.preview.loopback.delay;
    this._inputAudio.volumeGainNode.connect(
      this._previewAudio.loopbackDelayNode
    );

    this._previewAudio.loopbackGainNode = this._audioContext.createGain();
    this._previewAudio.oscillatorGainNode.gain.value = 0;
    this._previewAudio.loopbackDelayNode.connect(
      this._outputAudio.volumeGainNode
    );
  }

  _initRingAudio() {
    this._ringAudio = {
      calls: [],
      carrierNode: this._audioContext.createOscillator(),
      modulatorNode: this._audioContext.createOscillator(),
      carrierGain: this._audioContext.createGain(),
      modulatorGain: this._audioContext.createGain(),
      ringerGainNode: this._audioContext.createGain(),
    };
    this._ringAudio.carrierNode.frequency.value = 440;
    this._ringAudio.modulatorNode.frequency.value = 20;
    this._ringAudio.modulatorGain.gain.value = 0;
    this._ringAudio.carrierGain.gain.value = 0;
    this._ringAudio.carrierNode.connect(this._ringAudio.carrierGain);
    this._ringAudio.modulatorNode.connect(this._ringAudio.modulatorGain);
    this._ringAudio.modulatorGain.connect(this._ringAudio.carrierGain.gain);
    this._ringAudio.carrierGain.connect(this._ringAudio.ringerGainNode);
    this._ringAudio.ringerGainNode.gain.value = this._config.audiomixer.ringer.default;
    this._ringAudio.ringerGainNode.connect(this._outputAudio.volumeGainNode);
  }

  _initEventBindings() {
    this._libwebphone.on("mediaDevices.audiomixer.master.change", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.audiomixer.ringer.change", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.audiomixer.dtmf.change", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.audiomixer.remote.change", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.audio.output.changed", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.audio.input.changed", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.video.input.changed", () => {
      this.updateRenders();
    });
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
              this.changeMasterVolume(element.value / 1000);
            },
          },
        },
        ringervolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeRingerVolume(element.value / 1000);
            },
          },
        },
        dtmfvolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeDTMFVolume(element.value / 1000);
            },
          },
        },
        remotevolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeRemoteVolume(element.value / 1000);
            },
          },
        },
        microphonevolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeMicrophoneVolume(element.value / 1000);
            },
          },
        },
      },
      data: merge(this._renderData(), this._config),
    };
  }

  _renderDefaultTemplate() {
    // TODO: render advanced settings from capabilities
    return `
        <div>
          {{#data.audiomixer.master.show}}    
            <div>
              <label for="{{by_id.masteraudiomixer.elementId}}">
                {{i18n.mastervolume}}
              </label>
              <input type="range" min="{{data.audiomixer.min}}" max="{{data.audiomixer.max}}" value="{{data.audiomixer.master.value}}" id="{{by_id.masteraudiomixer.elementId}}">
            </div>
          {{/data.audiomixer.master.show}}

          {{#data.audiomixer.ringer.show}}
            <div>
              <label for="{{by_id.ringeraudiomixer.elementId}}">
                {{i18n.ringervolume}}
              </label>
              <input type="range" min="{{data.audiomixer.min}}" max="{{data.audiomixer.max}}" value="{{data.audiomixer.ringer.value}}" id="{{by_id.ringeraudiomixer.elementId}}">
            </div>
          {{/data.audiomixer.ringer.show}}

          {{#data.audiomixer.dtmf.show}}
            <div>
              <label for="{{by_id.dtmfaudiomixer.elementId}}">
                {{i18n.dtmfvolume}}
              </label>
              <input type="range" min="{{data.audiomixer.min}}" max="{{data.audiomixer.max}}" value="{{data.audiomixer.dtmf.value}}" id="{{by_id.dtmfaudiomixer.elementId}}">
            </div>
          {{/data.audiomixer.dtmf.show}}

          {{#data.audiomixer.remote.show}}
            <div>
              <label for="{{by_id.remoteaudiomixer.elementId}}">
                {{i18n.remotevolume}}
              </label>
              <input type="range" min="{{data.audiomixer.min}}" max="{{data.audiomixer.max}}" value="{{data.audiomixer.remote.value}}" id="{{by_id.remoteaudiomixer.elementId}}">
            </div>
          {{/data.audiomixer.remote.show}}

          {{#data.audiomixer.microphone.show}}
            <div>
              <label for="{{by_id.microphoneaudiomixer.elementId}}">
                {{i18n.microphonevolume}}
              </label>
              <input type="range" min="{{data.audiomixer.min}}" max="{{data.audiomixer.max}}" value="{{data.audiomixer.microphone.value}}" id="{{by_id.microphoneaudiomixer.elementId}}">
            </div>
          {{/data.audiomixer.microphone.show}}

        </div>
        `;
  }

  _renderData(
    data = {
      volume: {
        master: {},
        ringer: {},
        dtmf: {},
        remote: {},
        microphone: {},
      },
    }
  ) {
    data.audiomixer.master.value =
      this._outputAudio.volumeGainNode.gain.value * 1000;
    data.audiomixer.ringer.value =
      this._ringAudio.ringerGainNode.gain.value * 1000;
    data.audiomixer.dtmf.value =
      this._notificationAudio.dtmfGainNode.gain.value * 1000;
    data.audiomixer.remote.value =
      this._remoteAudio.remoteGainNode.gain.value * 1000;
    data.audiomixer.microphone.value =
      this._inputAudio.volumeGainNode.gain.value * 1000;
    data.audiomixer.max = 1000;
    data.audiomixer.min = 0;

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
    if (this._inputAudio.sourceStream) {
      this._inputAudio.sourceStream.disconnect();
      this._inputAudio.sourceStream = null;
    }
    if (audioTrack) {
      this._inputAudio.sourceStream = this._audioContext.createMediaStreamSource(
        mediaStream
      );
      this._inputAudio.sourceStream.connect(this._inputAudio.volumeGainNode);
    }
    */
  }

  _ringTimer() {
    if (this._ringAudio.calls.length > 0) {
      if (this._ringAudio.carrierGain.gain.value < 0.5) {
        this._ringerUnmute();
      } else {
        this._ringerMute();
      }
      setTimeout(() => {
        this._ringTimer();
      }, 2000);
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

  _createMediaElementSource(mediaElement) {
    return this._audioContext.createMediaElementSource(mediaElement);
  }

  _setRemoteAudioSourceStream(sourceStream = null) {
    let previousSourceStream = this._remoteAudio.sourceStream;

    if (previousSourceStream) {
      previousSourceStream.disconnect();
      this._remoteAudio.sourceStream = null;
      this._emit("remote.audio.removed", this, previousSourceStream);
    }

    if (sourceStream) {
      this._remoteAudio.sourceStream = sourceStream;
      this._remoteAudio.sourceStream.connect(this._remoteAudio.remoteGainNode);

      this._emit("remote.audio.added", this, sourceStream);
    }
  }
}
