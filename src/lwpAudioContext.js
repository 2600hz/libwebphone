"use strict";

import lwpUtils from "./lwpUtils";
import lwpRenderer from "./lwpRenderer";

export default class extends lwpRenderer {
  constructor(libwebphone, config = {}) {
    super(libwebphone);
    this._libwebphone = libwebphone;
    this._emit = this._libwebphone._audioContextEvent;
    this._initProperties(config);
    this._initInternationalization(config.i18n || {});
    this._initOutputAudio();
    this._initRingAudio();
    this._initTonesAudio();
    this._initPreviewAudio();
    this._initRemoteAudio();
    this._initEventBindings();
    this._initRenderTargets();
    this._emit("created", this);
    return this;
  }

  startAudioContext() {
    if (!this._started) {
      this._audioContext.resume();
      this._previewAudio.oscillatorNode.start();

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
      this._getOutputGainNode("preview")
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
      this._getOutputGainNode("preview")
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

  getVolume(channel, options = { scale: true, relativeToMaster: false }) {
    let volume = 0;

    if (this._config.channels[channel]) {
      volume = this._config.channels[channel].volume;
    }

    if (options.relativeToMaster) {
      volume *= this._config.channels.master.volume;
    }

    if (options.scale) {
      volume *= this._config.volumeMax;
    }

    return volume;
  }

  changeVolume(channel, volume, options = {}) {
    const gainNode = this._getOutputGainNode(channel);

    this.startAudioContext();

    if (!Object.prototype.hasOwnProperty.call(options, "scale")) {
      if (volume > 1) {
        options.scale = true;
      } else {
        options.scale = false;
      }
    }

    if (options.scale) {
      volume = volume / this._config.volumeMax;
    }

    if (volume < 0) {
      volume = 0;
    }

    if (volume > 1) {
      volume = 1;
    }

    if (this._config.channels[channel]) {
      this._config.channels[channel].volume = volume;
      this._emit("channel." + channel + ".volume", this, volume);
    }

    if (gainNode) {
      gainNode.gain.value = volume;
    }
  }

  playTones(...tones) {
    if (!tones.length) {
      return;
    }

    this.startAudioContext();

    const duration = this._config.channels.tones.duration;
    const sampleRate = this._tonesAudio.context.sampleRate;
    const buffer = this._shimCreateBuffer(
      this._tonesAudio.context,
      tones.length,
      sampleRate,
      sampleRate
    );

    for (let index = 0; index < tones.length; index++) {
      const channel = buffer.getChannelData(index);
      for (let i = 0; i < duration * sampleRate; i++) {
        channel[i] = Math.sin(2 * Math.PI * tones[index] * (i / sampleRate));
      }
    }

    const bufferSource = this._shimCreateBufferSource(this._tonesAudio.context);
    bufferSource.buffer = buffer;
    bufferSource.connect(this._getOutputGainNode("tones"));
    bufferSource.start();

    setTimeout(() => {
      bufferSource.disconnect();
      bufferSource.stop();
    }, (duration + 0.5) * 1000);
  }

    /**
   * Updates the ringtone buffer based on primary call status
   * Switches between default ringtone and call waiting tone
   * @param {Object} call - Optional call object to check status
   */
  updateRingtone(call = null) {
    // Get primary call if none provided
    const primaryCall = call || this._libwebphone.getCallList().getCall();
    
    // Determine if there's an active call = established and not on hold
    const hasActiveCall = primaryCall && primaryCall.isEstablished() && !primaryCall.isOnHold();
    
    // Select appropriate ringtone buffer
    const newBuffer = hasActiveCall 
      ? this._ringerAudio.callWaitingToneBuffer 
      : this._ringerAudio.defaultRingToneBuffer;
    
    // Log the change
    console.log(`AudioContext: switching ring tone to ${hasActiveCall ? 'call waiting' : 'default'} tone`);
    
    // Check if ringtone is actively playing
    const wasActive = this._ringerAudio.isActive;
    
    // Update the ringtone buffer
    this._ringerAudio.ringToneBuffer = newBuffer;
    
    // If ringtone is currently active, restart it with new buffer
    if (wasActive && this._ringerAudio.calls.length > 0) {
      // Stop current playback
      if (this._ringerAudio.source) {
        this._ringerAudio.source.stop();
      }
      
      // Create and start new source with updated buffer
      this._ringerAudio.source = new AudioBufferSourceNode(this._audioContext, {
        buffer: this._ringerAudio.ringToneBuffer,
        loop: true,
      });
      
      // Connect to output chain
      this._ringerAudio.source
        .connect(this._ringerAudio.ringerGain)
        .connect(this._getOutputGainNode("ringer"));
      
      this._ringerAudio.source.start();
    }
    
    // Emit event for the ringtone change
    this._emit("ringtone.updated", this, hasActiveCall ? "callWaiting" : "default");
  }

  startRinging(requestId = null) {
    if (!requestId) {
      this._ringerAudio.calls.push(null);
    } else if (!this._ringerAudio.calls.includes(requestId)) {
      this._ringerAudio.calls.push(requestId);
    }


    if (this._libwebphone.getCallList().getCall() && this._libwebphone.getCallList().getCall().isEstablished()) {
      console.log('AudioContext: switching ring tone to call waiting tone');
      this._ringerAudio.ringToneBuffer = this._ringerAudio.callWaitingToneBuffer;
    } else {
      console.log("AudioContext: switching ring tone to default tone");
      this._ringerAudio.ringToneBuffer = this._ringerAudio.defaultRingToneBuffer;
    }
    if (!this._ringerAudio.isActive) {
      
      this.startAudioContext();

      this._ringerAudio.source = new AudioBufferSourceNode(this._audioContext, {
        buffer: this._ringerAudio.ringToneBuffer,
        loop: true,
      });
      this._ringerAudio.source
        .connect(this._ringerAudio.ringerGain)
        .connect(this._getOutputGainNode("ringer"));
      this._ringerAudio.source.start();
      this._ringerAudio.isActive = true;
    }
  }

  stopRinging(requestId = null) {
    if (!requestId) {
      requestId = null;
    }

    const requestIndex = this._ringerAudio.calls.indexOf(requestId);

    if (requestIndex != -1) {
      this._ringerAudio.calls.splice(requestIndex, 1);
    }

    if (this._ringerAudio.calls.length == 0) {
      this.stopAllRinging();
    }
  }

  stopAllRinging() {
    this._ringerAudio.ringerGain.disconnect();
    this._ringerAudio.isActive = false;
    
    if(this._ringerAudio.source) {
      this._ringerAudio.source.stop();
    }

    this._ringerAudio.calls = [];
  }

  getDestinationStream() {
    return this._outputAudio.destinationStream.stream;
  }

  updateRenders() {
    this.render((render) => {
      render.data = this._renderData(render.data);
      return render;
    });
  }

  /** Init functions */

  _initInternationalization(config) {
    const defaults = {
      en: {
        mastervolume: "Master Volume",
        ringervolume: "Ringer Volume",
        tonesvolume: "Tones Volume",
        previewvolume: "Preview Volume",
        remotevolume: "Call Volume",
      },
    };
    const resourceBundles = lwpUtils.merge(
      defaults,
      config.resourceBundles || {}
    );
    this._libwebphone.i18nAddResourceBundles("audioContext", resourceBundles);
  }

  _initProperties(config) {
    const defaults = {
      channels: {
        master: {
          show: true,
          volume: 1.0,
        },
        ringer: {
          default: {
            onTime: 2,
            sequenceDuration: 6,
            oscilator_1: {
              frequency: 440,
            },
            oscilator_2: {
              frequency: 480,
            }
          },
          callWaiting: {
            onTime: .3,
            sequenceDuration: 10,
            oscilator: {
              frequency: 440,
            }
          },
          show: true,
          volume: 1.0,
          connectToMaster: true,
        },
        tones: {
          duration: 0.15,
          show: true,
          volume: 0.15,
          connectToMaster: true,
        },
        remote: {
          show: true,
          volume: 1.0,
          connectToMaster: false,
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
          connectToMaster: true,
        },
      },
      globalKeyShortcuts: true,
      keys: {
        arrowup: {
          enabled: true,
          action: () => {
            this.changeVolume(
              "master",
              this._config.channels.master.volume + 0.05,
              { scale: false }
            );
          },
        },
        arrowdown: {
          enabled: true,
          action: () => {
            this.changeVolume(
              "master",
              this._config.channels.master.volume - 0.05,
              { scale: false }
            );
          },
        },
      },
      renderTargets: [],
      volumeMax: 100,
      volumeMin: 0,
    };
    this._config = lwpUtils.merge(defaults, config);

    this._audioContext = this._shimAudioContext();

    this._ringingTimer = null;
  }

  _initOutputAudio() {
    const mediaDevices = this._libwebphone.getMediaDevices();

    this._outputAudio = {};

    this._outputAudio.context = this._audioContext;

    this._outputAudio.masterGain = this._shimCreateGain(
      this._outputAudio.context
    );
    this._outputAudio.masterGain.gain.value =
      this._config.channels.master.volume;

    this._outputAudio.ringerGain = this._shimCreateGain(
      this._outputAudio.context
    );
    this._outputAudio.ringerGain.gain.value =
      this._config.channels.ringer.volume;
    if (this._config.channels.ringer.connectToMaster) {
      this._outputAudio.ringerGain.connect(this._outputAudio.masterGain);
    }

    this._outputAudio.tonesGain = this._shimCreateGain(
      this._outputAudio.context
    );
    this._outputAudio.tonesGain.gain.value = this._config.channels.tones.volume;
    if (this._config.channels.tones.connectToMaster) {
      this._outputAudio.tonesGain.connect(this._outputAudio.masterGain);
    }

    this._outputAudio.remoteGain = this._shimCreateGain(
      this._outputAudio.context
    );
    this._outputAudio.remoteGain.gain.value =
      this._config.channels.remote.volume;
    if (
      this._config.channels.remote.connectToMaster &&
      this._libwebphone._config.call.useAudioContext
    ) {
      this._outputAudio.remoteGain.connect(this._outputAudio.masterGain);
    }

    this._outputAudio.previewGain = this._shimCreateGain(
      this._outputAudio.context
    );
    this._outputAudio.previewGain.gain.value =
      this._config.channels.preview.volume;
    if (this._config.channels.preview.connectToMaster) {
      this._outputAudio.previewGain.connect(this._outputAudio.masterGain);
    }

    this._outputAudio.destinationStream =
      this._shimCreateMediaStreamDestination(this._outputAudio.context);
    this._outputAudio.masterGain.connect(this._outputAudio.destinationStream);

    if (mediaDevices && mediaDevices.getMediaElement("ringoutput")) {
      const element = mediaDevices.getMediaElement("ringoutput");
      element.srcObject = this._outputAudio.destinationStream.stream;
      this._outputAudio.usingAudioElement = true;
    } else {
      this._outputAudio.masterGain.connect(
        this._outputAudio.context.destination
      );
      this._outputAudio.usingAudioElement = false;
    }
  }

  async _initRingAudio() {
    this._ringerAudio = {};

    var context = this._audioContext;
    this._ringerAudio.context = context;
    this._ringerAudio.calls = [];
    this._ringerAudio.isActive = false;
    this._ringerAudio.ringerGain = this._shimCreateGain(context);

    await this.generateDefaultRingTone();
    await this.generateCallWaitingTone();

    this._ringerAudio.ringToneBuffer = this._ringerAudio.defaultRingToneBuffer;
  }

  generateDefaultRingTone() {
    const offlineCtx = new OfflineAudioContext(
      2
      ,44100 * this._config.channels.ringer.default.sequenceDuration
      ,44100
    );

    const osc_1 = new OscillatorNode(offlineCtx, {
      frequency: this._config.channels.ringer.default.oscilator_1.frequency,
    });
    const gain_1 = new GainNode(offlineCtx);
    gain_1.gain.value = 0.5;
    osc_1.connect(gain_1);

    const osc_2 = new OscillatorNode(offlineCtx, {
      frequency: this._config.channels.ringer.default.oscilator_2.frequency,
    });
    const gain_2 = new GainNode(offlineCtx);
    gain_2.gain.value = 0.5;
    osc_2.connect(gain_2);

    const merger = new ChannelMergerNode(offlineCtx);
    gain_1.connect(merger, 0, 0);
    gain_2.connect(merger, 0, 1);
    merger.connect(offlineCtx.destination);
    osc_1.start(offlineCtx.currentTime);
    osc_2.start(offlineCtx.currentTime);
    osc_1.stop(offlineCtx.currentTime + this._config.channels.ringer.default.onTime);
    osc_2.stop(offlineCtx.currentTime + this._config.channels.ringer.default.onTime);

    return offlineCtx.startRendering().then(
      (renderedBuffer) => {
        console.log("AudioContext: default ringer tone rendering completed successfully.");
        this._ringerAudio.defaultRingToneBuffer = renderedBuffer;
      })
      .catch((err) => {
        console.error(`Error encountered: ${err}`);
      });
  }

  generateCallWaitingTone() {
    const offlineCtx = new OfflineAudioContext(
      2
      ,44100 * this._config.channels.ringer.callWaiting.sequenceDuration
      ,44100
    );

    // code commented out allows to add a second beep to the call waiting tone
    const osc = new OscillatorNode(offlineCtx, {
      frequency: this._config.channels.ringer.callWaiting.oscilator.frequency,
    });
    
    const gain = new GainNode(offlineCtx);
    gain.gain.value = 1;
    osc.connect(gain);
    gain.connect(offlineCtx.destination, 0, 0);
    osc.start(offlineCtx.currentTime);
    osc.stop(offlineCtx.currentTime + this._config.channels.ringer.callWaiting.onTime);
    return offlineCtx.startRendering().then(
      (renderedBuffer) => {
        console.log("AudioContext: call wait tone rendering completed successfully.");
        this._ringerAudio.callWaitingToneBuffer = renderedBuffer;
      })
      .catch((err) => {
        console.error(`Error encountered: ${err}`);
      });
  }

  _initTonesAudio() {
    this._tonesAudio = {};

    this._tonesAudio.context = this._audioContext;
  }

  _initRemoteAudio() {
    this._remoteAudio = {};

    this._remoteAudio.context = this._audioContext;

    this._remoteAudio.sourceStream = null;
  }

  _initPreviewAudio() {
    this._previewAudio = {};

    this._previewAudio.context = this._audioContext;

    this._previewAudio.sourceStream = null;

    this._previewAudio.toneActive = false;

    this._previewAudio.oscillatorNode = this._shimCreateOscillator(
      this._previewAudio.context
    );
    this._previewAudio.oscillatorNode.frequency.value =
      this._config.channels.preview.tone.frequency;
    this._previewAudio.oscillatorNode.type =
      this._config.channels.preview.tone.type;

    this._previewAudio.loopbackActive = false;

    this._previewAudio.loopbackDelayNode = this._shimCreateDelay(
      this._previewAudio.context,
      this._config.channels.preview.loopback.delay + 1.5
    );
    this._previewAudio.loopbackDelayNode.delayTime.value =
      this._config.channels.preview.loopback.delay;
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

    this._libwebphone.on("call.primary.established", (lwp, call) => {
      this.updateRingtone(call);
    });
    this._libwebphone.on("call.primary.hold", (lwp, call) => {
      this.updateRingtone(call);
    });
    this._libwebphone.on("call.primary.unhold", (lwp, call) => {
      this.updateRingtone(call);
    });
    this._libwebphone.on("call.primary.terminated", (lwp, call) => {
      this.updateRingtone(call);
    });

    this._libwebphone.on("dialpad.tones.play", (lwp, dialpad, tones) => {
      this.playTones.apply(this, tones);
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

    if (this._config.globalKeyShortcuts) {
      document.addEventListener("keydown", (event) => {
        if (event.target != document.body) {
          return;
        }

        switch (event.key) {
          case "ArrowUp":
            if (this._config.keys["arrowup"].enabled) {
              this._config.keys["arrowup"].action(event, this);
            }
            break;
          case "ArrowDown":
            if (this._config.keys["arrowdown"].enabled) {
              this._config.keys["arrowdown"].action(event, this);
            }
            break;
        }
      });
    }

    this._libwebphone.on("audioContext.channel.master.volume", () => {
      this.updateRenders();
    });
    this._libwebphone.on("audioContext.channel.ringer.volume", () => {
      this.updateRenders();
    });
    this._libwebphone.on("audioContext.channel.tones.volume", () => {
      this.updateRenders();
    });
    this._libwebphone.on("audioContext.channel.preview.volume", () => {
      this.updateRenders();
    });
    this._libwebphone.on("audioContext.channel.remote.volume", () => {
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
        mastervolume: "libwebphone:audioContext.mastervolume",
        ringervolume: "libwebphone:audioContext.ringervolume",
        tonesvolume: "libwebphone:audioContext.tonesvolume",
        previewvolume: "libwebphone:audioContext.previewvolume",
        remotevolume: "libwebphone:audioContext.remotevolume",
      },
      by_id: {
        mastervolume: {
          events: {
            onchange: (event) => {
              const element = event.srcElement;
              this.changeVolume("master", element.value);
            },
          },
        },
        ringervolume: {
          events: {
            onchange: (event) => {
              const element = event.srcElement;
              this.changeVolume("ringer", element.value);
            },
          },
        },
        tonesvolume: {
          events: {
            onchange: (event) => {
              const element = event.srcElement;
              this.changeVolume("tones", element.value);
            },
          },
        },
        previewvolume: {
          events: {
            onchange: (event) => {
              const element = event.srcElement;
              this.changeVolume("preview", element.value);
            },
          },
        },
        remotevolume: {
          events: {
            onchange: (event) => {
              const element = event.srcElement;
              this.changeVolume("remote", element.value);
            },
          },
        },
      },
      data: lwpUtils.merge({}, this._config, this._renderData()),
    };
  }

  _renderDefaultTemplate() {
    return `
        <div>
          {{#data.channels.master.show}}
            <div>
              <label for="{{by_id.mastervolume.elementId}}">
                {{i18n.mastervolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.volumes.master}}" id="{{by_id.mastervolume.elementId}}">
            </div>
          {{/data.channels.master.show}}

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

          {{#data.channels.preview.show}}
            <div>
              <label for="{{by_id.previewvolume.elementId}}">
                {{i18n.previewvolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.volumes.preview}}" id="{{by_id.previewvolume.elementId}}">
            </div>
          {{/data.channels.preview.show}}          

          {{#data.channels.remote.show}}
            <div>
              <label for="{{by_id.remotevolume.elementId}}">
                {{i18n.remotevolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.volumes.remote}}" id="{{by_id.remotevolume.elementId}}">
            </div>
          {{/data.channels.remote.show}}

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

  _createLocalMediaStreamSource(mediaStream) {
    return this._shimCreateMediaStreamSource(
      this._previewAudio.context,
      mediaStream
    );
  }

  _createRemoteMediaStreamSource(mediaStream) {
    return this._shimCreateMediaStreamSource(
      this._remoteAudio.context,
      mediaStream
    );
  }

  _connectLocalSourceStream(sourceStream = null) {
    const previousSourceStream = this._previewAudio.sourceStream;

    if (previousSourceStream) {
      previousSourceStream.disconnect();
      this._previewAudio.sourceStream = null;
    }

    if (sourceStream) {
      this.startAudioContext();
      this._previewAudio.sourceStream = sourceStream;
      this._previewAudio.sourceStream.connect(
        this._previewAudio.loopbackDelayNode
      );
    }

    this._emit(
      "stream.local.changed",
      this,
      sourceStream,
      previousSourceStream
    );
  }

  _createLocalSourceStream(mediaStream) {
    const audioTrack = mediaStream.getTracks().find((track) => {
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
    const previousSourceStream = this._remoteAudio.sourceStream;

    if (previousSourceStream) {
      previousSourceStream.disconnect();
      this._remoteAudio.sourceStream = null;
    }

    if (sourceStream) {
      this.startAudioContext();
      this._remoteAudio.sourceStream = sourceStream;
      this._remoteAudio.sourceStream.connect(this._getOutputGainNode("remote"));
    }

    this._emit(
      "stream.remote.changed",
      this,
      sourceStream,
      previousSourceStream
    );
  }

  _createRemoteSourceStream(mediaStream) {
    const audioTrack = mediaStream.getTracks().find((track) => {
      return track.kind == "audio";
    });

    if (!audioTrack) {
      return this._connectRemoteSourceStream();
    }

    this._connectRemoteSourceStream(
      this._createRemoteMediaStreamSource(mediaStream)
    );
  }

  _getOutputGainNode(channel) {
    switch (channel) {
      case "master":
        return this._outputAudio.masterGain;
      case "ringer":
        return this._outputAudio.ringerGain;
      case "tones":
        return this._outputAudio.tonesGain;
      case "preview":
        return this._outputAudio.previewGain;
      case "remote":
        return this._outputAudio.remoteGain;
    }
  }

  /** Shims */

  _shimCreateBuffer(context, ...args) {
    return (context.createBuffer || context.webkitCreateBuffer).apply(
      context,
      args
    );
  }

  _shimCreateBufferSource(context, ...args) {
    return (
      context.createBufferSource || context.webkitCreateBufferSource
    ).apply(context, args);
  }

  _shimCreateDelay(context, ...args) {
    return (context.createDelay || context.webkitCreateDelay).apply(
      context,
      args
    );
  }

  _shimCreateGain(context, ...args) {
    return (context.createGain || context.webkitCreateGain).apply(
      context,
      args
    );
  }

  _shimCreateOscillator(context, ...args) {
    return (context.createOscillator || context.webkitCreateOscillator).apply(
      context,
      args
    );
  }

  _shimCreateChannelMerger(context, ...args) {
    return (context.createChannelMerger || context.webkitCreateChannelMerger).apply(
      context,
      args
    );
  }

  _shimCreateMediaStreamDestination(context, ...args) {
    return (
      context.createMediaStreamDestination ||
      context.webkitCreateMediaStreamDestination
    ).apply(context, args);
  }

  _shimCreateMediaStreamSource(context, ...args) {
    return (
      context.createMediaStreamSource || context.webkitCreateMediaStreamSource
    ).apply(context, args);
  }

  _shimAudioContext() {
    if (lwpUtils.isChrome()) {
      return new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: "interactive",
        sampleRate: 44100,
      });
    } else {
      return new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: "interactive",
      });
    }
  }
}
