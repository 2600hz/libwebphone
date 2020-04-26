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
    this._initOutputAudio();
    this._initLocalAudio();
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
      this._started = true;
      this._audioContext.resume();
      /*
      this._outputAudio.context.resume();
      this._localAudio.context.resume();
      this._remoteAudio.context.resume();
      this._previewAudio.context.resume();
      this._tonesAudio.context.resume();
      this._ringAudio.context.resume();
      */
      this._previewAudio.oscillatorNode.start();
      this._ringAudio.carrierNode.start();
      this._ringAudio.modulatorNode.start();
      if (this._config.manageMediaElements) {
        if (
          this._config.output.master.mediaElement.element &&
          this._config.output.master.mediaElement.element.srcObject
        ) {
          this._config.output.master.mediaElement.element.play();
        }

        if (
          this._config.output.remote.mediaElement.element &&
          this._config.output.remote.mediaElement.element.srcObject
        ) {
          this._config.output.remote.mediaElement.element.play();
        }

        if (
          this._config.output.preview.mediaElement.element &&
          this._config.output.preview.mediaElement.element.srcObject
        ) {
          this._config.output.preview.mediaElement.element.play();
        }

        if (
          this._config.output.tones.mediaElement.element &&
          this._config.output.tones.mediaElement.element.srcObject
        ) {
          this._config.output.tones.mediaElement.element.play();
        }

        if (
          this._config.output.ringer.mediaElement.element &&
          this._config.output.ringer.mediaElement.element.srcObject
        ) {
          this._config.output.ringer.mediaElement.element.play();
        }
      }
      this._emit("started", this);
    }
  }

  startPreviewTone() {
    if (this.isPreviewToneActive()) {
      return;
    }

    this.startAudioContext();

    this._previewAudio.oscillatorGainNode.gain.value = 1.0;
    this._emit("preview.tone.started", this);
  }

  stopPreviewTone() {
    if (!this.isPreviewToneActive()) {
      return;
    }

    this._previewAudio.oscillatorGainNode.gain.value = this._config.volumeMin;
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
    return this._previewAudio.oscillatorGainNode.gain.value > 0;
  }

  startPreviewLoopback() {
    if (this.isPreviewLoopbackActive()) {
      return;
    }

    this.startAudioContext();

    this._previewAudio.loopbackGainNode.gain.value = 1.0;
    this._localAudio.volumeGainNode.connect(
      this._previewAudio.loopbackDelayNode
    );

    this._emit("preview.loopback.started", this);
  }

  stopPreviewLoopback() {
    if (!this.isPreviewLoopbackActive()) {
      return;
    }

    this._previewAudio.loopbackGainNode.gain.value = this._config.volumeMin;
    this._localAudio.volumeGainNode.disconnect(
      this._previewAudio.loopbackDelayNode
    );

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
    return this._previewAudio.loopbackGainNode.gain.value > 0;
  }

  stopPreviews() {
    this.stopPreviewTone();
    this.stopPreviewLoopback();
  }

  changeOutputVolume(channel, volume) {
    this.startAudioContext();

    volume = volume.toFixed(5);
    switch (channel) {
      case "master":
        this._outputAudio.volumeGainNode.gain.value = volume;
        break;
      case "ringer":
        this._ringAudio.volumeGainNode.gain.value = volume;
        break;
      case "tones":
        this._tonesAudio.volumeGainNode.gain.value = volume;
        break;
      case "remote":
        this._remoteAudio.volumeGainNode.gain.value = volume;
        break;
      case "preview":
        this._previewAudio.volumeGainNode.gain.value = volume;
        break;
    }

    this._emit(channel + ".output.volume", this, volume);
  }

  changeInputVolume(channel, volume) {
    this.startAudioContext();

    volume = volume.toFixed(5);
    switch (channel) {
      case "local":
        this._localAudio.volumeGainNode.gain.value = volume;
        break;
    }

    this._emit(channel + ".input.volume", this, volume);
  }

  playTones(...tones) {
    this.startAudioContext();

    let duration = this._config.tones.duration;
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
    bufferSource.connect(this._tonesAudio.volumeGainNode);
    bufferSource.start();

    setTimeout(() => {
      bufferSource.stop();
      bufferSource.disconnect();
    }, (duration + 0.5) * 1000);
  }

  startRinging(requestId = null) {
    this.startAudioContext();

    if (!requestId) {
      this._ringAudio.calls.push(null);
    } else if (!this._ringAudio.calls.includes(requestId)) {
      this._ringAudio.calls.push(requestId);
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
    this._ringAudio.calls = [];
    this._ringerMute();
  }

  getMediaElement(channel) {
    if (
      this._config.manageMediaElements &&
      this._config.output[channel] &&
      this._config.output[channel].mediaElement.element
    ) {
      return this._config.output[channel].mediaElement.element;
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
        mastervolume: "Master Volume",
        ringervolume: "Ringer Volume",
        tonesvolume: "Tones Volume",
        remotevolume: "Call Volume",
        previewvolume: "Preview Volume",
        localvolume: "Microphone Volume",
      },
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("audioContext", resourceBundles);
  }

  _initProperties(config) {
    let defaults = {
      input: {
        local: {
          show: true,
          default: 1.0,
        },
      },
      output: {
        master: {
          show: true,
          default: 1.0,
          mediaElement: {
            create: true,
            elementId: null,
            element: null,
            initParameters: {
              muted: false,
            },
          },
        },
        ringer: {
          show: true,
          default: 1.0,
          connectToMaster: false,
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
          show: true,
          default: 0.25,
          connectToMaster: false,
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
          show: true,
          default: 1.0,
          connectToMaster: false,
          mediaElement: {
            create: true,
            elementId: null,
            element: null,
            initParameters: {
              muted: false,
            },
          },
        },
        preview: {
          show: true,
          default: 1.0,
          connectToMaster: false,
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
      preview: {
        loopback: {
          show: true,
          delay: 0.5,
        },
        tone: {
          show: true,
          frequency: 440,
          duration: 1.5,
          type: "sine",
        },
      },
      tones: {
        duration: 0.15,
      },
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
      },
      renderTargets: [],
      manageMediaElements: true,
      volumeMax: 100,
      volumeMin: 0,
    };
    this._config = merge(defaults, config);

    this._audioContext = this._shimAudioContext();

    this._ringingTimer = null;

    Object.keys(this._config.output).forEach((channel) => {
      if (
        !this._config.output[channel].mediaElement.element &&
        this._config.output[channel].mediaElement.elementId
      ) {
        this._config.output[
          channel
        ].mediaElement.element = document.getElementById(
          this._config.output[channel].mediaElement.elementId
        );
      }

      if (
        !this._config.output[channel].mediaElement.element &&
        this._config.output[channel].mediaElement.create
      ) {
        this._config.output[
          channel
        ].mediaElement.element = document.createElement("audio");
      }

      if (this._config.manageMediaElements) {
        Object.keys(
          this._config.output[channel].mediaElement.initParameters
        ).forEach((parameterName) => {
          this._config.output[channel].mediaElement.element[
            parameterName
          ] = this._config.output[channel].mediaElement.initParameters[
            parameterName
          ];
        });
      }

      if (this._config.output[channel].mediaElement.element) {
        mediaElementEvents().forEach((eventName) => {
          this._config.output[channel].mediaElement.element.addEventListener(
            eventName,
            (event) => {
              this._emit(channel + "." + eventName, this, event);
            }
          );
        });
      }
    });
  }

  _initOutputAudio() {
    let mediaDevices = this._libwebphone.getMediaDevices();

    this._outputAudio = {};

    this._outputAudio.context = this._shimAudioContext(); //this._audioContext;

    this._outputAudio.volumeGainNode = this._outputAudio.context.createGain();
    this._outputAudio.volumeGainNode.gain.value = this._config.output.master.default;

    this._outputAudio.destinationStream = this._createMediaStreamDestination(
      this._outputAudio.context
    );
    this._outputAudio.volumeGainNode.connect(
      this._outputAudio.destinationStream
    );

    if (this._config.output.master.mediaElement.element) {
      this._config.output.master.mediaElement.element.srcObject = this._outputAudio.destinationStream.stream;
    }

    if (mediaDevices && mediaDevices.getMediaElement("audiooutput")) {
      mediaDevices.getMediaElement(
        "audiooutput"
      ).srcObject = this._outputAudio.destinationStream.stream;
    }
  }

  _initLocalAudio() {
    this._localAudio = {};

    this._localAudio.context = this._shimAudioContext(); //this._audioContext;

    this._localAudio.sourceStream = null;

    this._localAudio.volumeGainNode = this._localAudio.context.createGain();
    this._localAudio.volumeGainNode.gain.value = this._config.input.local.default;

    this._localAudio.destinationStream = this._createMediaStreamDestination(
      this._localAudio.context
    );
    this._localAudio.volumeGainNode.connect(this._localAudio.destinationStream);
  }

  _initRemoteAudio() {
    this._remoteAudio = {};

    this._remoteAudio.context = this._shimAudioContext(); //this._audioContext;

    this._remoteAudio.sourceStream = null;

    this._remoteAudio.volumeGainNode = this._remoteAudio.context.createGain();
    this._remoteAudio.volumeGainNode.gain.value = this._config.output.remote.default;

    this._remoteAudio.destinationStream = this._createMediaStreamDestination(
      this._remoteAudio.context
    );
    /*
    this._remoteAudio.volumeGainNode.connect(
      this._remoteAudio.destinationStream
    );
    */

    if (this._config.output.remote.connectToMaster) {
      this._remoteAudio.volumeGainNode.connect(
        this._outputAudio.volumeGainNode
      );
    }

    if (this._config.output.remote.mediaElement.element) {
      this._config.output.remote.mediaElement.element.srcObject = this._remoteAudio.destinationStream.stream;
    }
  }

  _initPreviewAudio() {
    this._previewAudio = {};

    this._previewAudio.context = this._shimAudioContext(); //this._audioContext;

    this._previewAudio.volumeGainNode = this._previewAudio.context.createGain();
    this._previewAudio.volumeGainNode.gain.value = this._config.output.preview.default;

    this._previewAudio.oscillatorGainNode = this._previewAudio.context.createGain();
    this._previewAudio.oscillatorGainNode.gain.value = this._config.volumeMin;
    this._previewAudio.oscillatorGainNode.connect(
      this._previewAudio.volumeGainNode
    );

    this._previewAudio.oscillatorNode = this._previewAudio.context.createOscillator();
    this._previewAudio.oscillatorNode.frequency.value = this._config.preview.tone.frequency;
    this._previewAudio.oscillatorNode.type = this._config.preview.tone.type;
    this._previewAudio.oscillatorNode.connect(
      this._previewAudio.oscillatorGainNode
    );

    this._previewAudio.loopbackGainNode = this._previewAudio.context.createGain();
    this._previewAudio.loopbackGainNode.gain.value = this._config.volumeMin;
    this._previewAudio.loopbackGainNode.connect(
      this._previewAudio.volumeGainNode
    );

    this._previewAudio.loopbackDelayNode = this._previewAudio.context.createDelay(
      this._config.preview.loopback.delay + 1.5
    );
    this._previewAudio.loopbackDelayNode.delayTime.value = this._config.preview.loopback.delay;
    this._previewAudio.loopbackDelayNode.connect(
      this._previewAudio.loopbackGainNode
    );

    this._previewAudio.destinationStream = this._createMediaStreamDestination(
      this._previewAudio.context
    );
    this._previewAudio.volumeGainNode.connect(
      this._previewAudio.destinationStream
    );

    if (this._config.output.preview.connectToMaster) {
      this._previewAudio.volumeGainNode.connect(
        this._outputAudio.volumeGainNode
      );
    }

    if (this._config.output.preview.mediaElement.element) {
      this._config.output.preview.mediaElement.element.srcObject = this._previewAudio.destinationStream.stream;
    }
  }

  _initTonesAudio() {
    this._tonesAudio = {};

    this._tonesAudio.context = this._shimAudioContext(); //this._audioContext;

    this._tonesAudio.volumeGainNode = this._tonesAudio.context.createGain();
    this._tonesAudio.volumeGainNode.gain.value = this._config.output.tones.default;

    this._tonesAudio.destinationStream = this._createMediaStreamDestination(
      this._tonesAudio.context
    );
    this._tonesAudio.volumeGainNode.connect(this._tonesAudio.destinationStream);

    if (this._config.output.tones.connectToMaster) {
      this._tonesAudio.volumeGainNode.connect(this._outputAudio.volumeGainNode);
    }

    if (this._config.output.tones.mediaElement.element) {
      this._config.output.tones.mediaElement.element.srcObject = this._tonesAudio.destinationStream.stream;
    }
  }

  _initRingAudio() {
    this._ringAudio = {};

    this._ringAudio.context = this._shimAudioContext(); //this._audioContext;

    this._ringAudio.calls = [];

    this._ringAudio.volumeGainNode = this._ringAudio.context.createGain();
    this._ringAudio.volumeGainNode.gain.value = this._config.output.ringer.default;

    this._ringAudio.carrierGain = this._ringAudio.context.createGain();
    this._ringAudio.carrierGain.gain.value = this._config.volumeMin;
    this._ringAudio.carrierGain.connect(this._ringAudio.volumeGainNode);

    this._ringAudio.modulatorGain = this._ringAudio.context.createGain();
    this._ringAudio.modulatorGain.gain.value = this._config.volumeMin;
    this._ringAudio.modulatorGain.connect(this._ringAudio.carrierGain.gain);

    this._ringAudio.carrierNode = this._ringAudio.context.createOscillator();
    this._ringAudio.carrierNode.frequency.value = this._config.ringer.carrier.frequency;
    this._ringAudio.carrierNode.connect(this._ringAudio.carrierGain);

    this._ringAudio.modulatorNode = this._ringAudio.context.createOscillator();
    this._ringAudio.modulatorNode.frequency.value = this._config.ringer.modulator.frequency;
    this._ringAudio.modulatorNode.connect(this._ringAudio.modulatorGain);

    this._ringAudio.destinationStream = this._createMediaStreamDestination(
      this._ringAudio.context
    );
    this._ringAudio.volumeGainNode.connect(this._ringAudio.destinationStream);

    if (this._config.output.ringer.connectToMaster) {
      this._ringAudio.volumeGainNode.connect(this._outputAudio.volumeGainNode);
    }

    if (this._config.output.ringer.mediaElement.element) {
      this._config.output.ringer.mediaElement.element.srcObject = this._ringAudio.destinationStream.stream;
    }
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
        this._createRemoteSourceStream(call, track.mediaStream);
      }
    );

    this._libwebphone.on(
      "call.primary.remote.mediaStream.connect",
      (lwp, call, mediaStream) => {
        this._createRemoteSourceStream(call, mediaStream);
      }
    );

    this._libwebphone.on("dialpad.tones.play", (lwp, dialpad, tones) => {
      this.playTones.apply(this, tones);
    });

    this._libwebphone.on("audioContext.master.output.volume", () => {
      this.updateRenders();
    });
    this._libwebphone.on("audioContext.ringer.output.volume", () => {
      this.updateRenders();
    });
    this._libwebphone.on("audioContext.tones.output.volume", () => {
      this.updateRenders();
    });
    this._libwebphone.on("audioContext.remote.output.volume", () => {
      this.updateRenders();
    });
    this._libwebphone.on("audioContext.preview.output.volume", () => {
      this.updateRenders();
    });
    this._libwebphone.on("audioContext.local.output.volume", () => {
      this.updateRenders();
    });

    this._libwebphone.on(
      "mediaDevices.streams.started",
      (lwp, mediaDevices, mediaStream) => {
        this._createLocalSourceStream(mediaDevices, mediaStream);
      }
    );

    this._libwebphone.on(
      "mediaDevices.audio.input.changed",
      (lwp, mediaDevices, track) => {
        this._createLocalSourceStream(mediaDevices, track.mediaStream);
      }
    );
    this._libwebphone.on("mediaDevices.streams.stopped", () => {
      this._connectLocalSourceStream();
    });
    /*
    this._libwebphone.on(
      "mediaDevices.audio.output.changed",
      (lwp, mediaDevices, preferedDevice) => {
        Object.keys(this._config.output).forEach((channel) => {
          if (this._config.output[channel].mediaElement.element) {
            this._config.output[channel].mediaElement.element.setSinkId(
              preferedDevice.id
            );
          }
        });
      }      
    );
    */
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
        mastervolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeOutputVolume(
                "master",
                element.value / this._config.volumeMax
              );
            },
          },
        },
        ringervolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeOutputVolume(
                "ringer",
                element.value / this._config.volumeMax
              );
            },
          },
        },
        tonesvolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeOutputVolume(
                "tones",
                element.value / this._config.volumeMax
              );
            },
          },
        },
        remotevolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeOutputVolume(
                "remote",
                element.value / this._config.volumeMax
              );
            },
          },
        },
        previewvolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeOutputVolume(
                "preview",
                element.value / this._config.volumeMax
              );
            },
          },
        },
        localvolume: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeInputVolume(
                "local",
                element.value / this._config.volumeMax
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

          {{#data.output.tones.show}}
            <div>
              <label for="{{by_id.tonesvolume.elementId}}">
                {{i18n.tonesvolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.output.tones.value}}" id="{{by_id.tonesvolume.elementId}}">
            </div>
          {{/data.output.tones.show}}

          {{#data.output.remote.show}}
            <div>
              <label for="{{by_id.remotevolume.elementId}}">
                {{i18n.remotevolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.output.remote.value}}" id="{{by_id.remotevolume.elementId}}">
            </div>
          {{/data.output.remote.show}}

          {{#data.output.preview.show}}
            <div>
              <label for="{{by_id.previewvolume.elementId}}">
                {{i18n.previewvolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.output.preview.value}}" id="{{by_id.previewvolume.elementId}}">
            </div>
          {{/data.output.preview.show}}          

          {{#data.input.local.show}}
            <div>
              <label for="{{by_id.localvolume.elementId}}">
                {{i18n.localvolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.input.local.value}}" id="{{by_id.localvolume.elementId}}">
            </div>
          {{/data.input.local.show}}

        </div>
        `;
  }

  _renderData(
    data = {
      output: { master: {}, ringer: {}, tones: {}, remote: {}, preview: {} },
      input: { local: {} },
      volume: {},
    }
  ) {
    data.input.local.value =
      this._localAudio.volumeGainNode.gain.value * this._config.volumeMax;

    data.output.master.value =
      this._outputAudio.volumeGainNode.gain.value * this._config.volumeMax;

    data.output.ringer.value =
      this._ringAudio.volumeGainNode.gain.value * this._config.volumeMax;

    data.output.tones.value =
      this._tonesAudio.volumeGainNode.gain.value * this._config.volumeMax;

    data.output.remote.value =
      this._remoteAudio.volumeGainNode.gain.value * this._config.volumeMax;

    data.output.preview.value =
      this._previewAudio.volumeGainNode.gain.value * this._config.volumeMax;

    data.volume.max = this._config.volumeMax;
    data.volume.min = this._config.volumeMin;

    return data;
  }

  /** Helper functions */

  _ringTimer() {
    if (this._ringAudio.calls.length > 0) {
      if (this._ringAudio.carrierGain.gain.value < 0.5) {
        this._ringerUnmute();
        this._ringingTimer = setTimeout(() => {
          this._ringTimer();
        }, this._config.ringer.onTime * 1000);
      } else {
        this._ringerMute();
        this._ringingTimer = setTimeout(() => {
          this._ringTimer();
        }, this._config.ringer.offTime * 1000);
      }
    } else {
      if (this._ringingTimer) {
        clearTimeout(this._ringingTimer);
        this._ringingTimer = null;
      }
      this._ringAudio.carrierGain.gain.value = this._config.volumeMin;
      this._ringAudio.modulatorGain.gain.value = this._config.volumeMin;
    }
  }

  _ringerMute() {
    let timestamp =
      this._ringAudio.context.currentTime + this._config.ringer.onTime * 0.2;
    this._ringAudio.modulatorGain.gain.cancelScheduledValues(0);
    this._ringAudio.modulatorGain.gain.exponentialRampToValueAtTime(
      0.00001,
      timestamp
    );

    this._ringAudio.carrierGain.gain.cancelScheduledValues(0);
    this._ringAudio.carrierGain.gain.exponentialRampToValueAtTime(
      0.00001,
      timestamp
    );
  }

  _ringerUnmute() {
    let timestamp =
      this._ringAudio.context.currentTime + this._config.ringer.offTime * 0.2;
    this._ringAudio.carrierGain.gain.cancelScheduledValues(0);
    this._ringAudio.carrierGain.gain.exponentialRampToValueAtTime(
      1.0,
      timestamp
    );

    this._ringAudio.modulatorGain.gain.cancelScheduledValues(0);
    this._ringAudio.modulatorGain.gain.exponentialRampToValueAtTime(
      this._config.ringer.modulator.amplitude,
      timestamp
    );
  }

  _createMediaStreamDestination(context) {
    return context.createMediaStreamDestination();
  }

  _createLocalMediaStreamSource(mediaStream) {
    return this._localAudio.context.createMediaStreamSource(mediaStream);
  }

  _createRemoteMediaStreamSource(mediaStream) {
    return this._remoteAudio.context.createMediaStreamSource(mediaStream);
  }

  _getMediaStream(channel) {
    switch (channel) {
      case "master":
        return this._outputAudio.destinationStream.stream;
      case "ringer":
        return this._ringAudio.destinationStream.stream;
      case "tones":
        return this._tonesAudio.destinationStream.stream;
      case "remote":
        return this._remoteAudio.destinationStream.stream;
      case "preview":
        return this._previewAudio.destinationStream.stream;
      case "local":
        return this._localAudio.destinationStream.stream;
    }
  }

  _connectLocalSourceStream(sourceStream = null) {
    let previousSourceStream = this._localAudio.sourceStream;

    if (previousSourceStream) {
      previousSourceStream.disconnect();
      this._localAudio.sourceStream = null;
    }

    if (sourceStream) {
      this._localAudio.sourceStream = sourceStream;
      this._localAudio.sourceStream.connect(this._localAudio.volumeGainNode);
    }

    this._emit(
      "local.stream.changed",
      this,
      sourceStream,
      previousSourceStream
    );
  }

  _createLocalSourceStream(source, mediaStream) {
    let audioTrack = mediaStream.getTracks().find((track) => {
      return track.kind == "audio";
    });

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
      //this._remoteAudio.sourceStream.connect(this._remoteAudio.volumeGainNode);
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

  _createRemoteSourceStream(source, mediaStream) {
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
    return new (window.AudioContext || window.webkitAudioContext)();
  }
}
