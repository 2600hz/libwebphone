"use strict";

import { merge } from "./lwpUtils";
import lwpRenderer from "./lwpRenderer";
import AudioStreamMeter from "audio-stream-meter";
import { Mutex } from "async-mutex";
import adapter from "webrtc-adapter";

class lwpMediaDevices extends lwpRenderer {
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
    this._emit("started", this);
    return this;
  }

  startAudioContext() {
    if (!this._started) {
      this._started = true;
      console.log("audio context started!!!");
      this._outputAudio.context.resume();
      this._previewAudio.oscillatorNode.start();
      this._outputAudio.element.play();
      console.log("outputAudio: ", this._outputAudio);
      console.log("previewAudio: ", this._previewAudio);
    }
  }

  startPreviews() {
    this.startAudioContext();
    this._previewActive = true;

    if (this._config.audiooutput.preview.loopback.startOnPreview) {
      this.startPreviewOutputLoopback();
    }

    this._startInputStreams().then(() => {
      this.updateRenders();
      this._emit("preview.start", this);
    });
  }

  startPreviewOutputTone() {
    this._previewAudio.oscillatorGainNode.gain.value = 1;

    this.updateRenders();

    this._emit("preview.tone.start", this);
  }

  stopPreviewOutputTone() {
    this._previewAudio.oscillatorGainNode.gain.value = 0;

    this.updateRenders();

    this._emit("preview.tone.stop", this);
  }

  isPreviewOutputToneActive() {
    return this._previewAudio.oscillatorGainNode.gain.value > 0;
  }

  startPreviewOutputLoopback() {
    this._previewAudio.loopbackGainNode.gain.value = 1;

    this.updateRenders();

    this._emit("preview.loopback.start", this);
  }

  stopPreviewOutputLoopback() {
    this._previewAudio.loopbackGainNode.gain.value = 0;

    this.updateRenders();

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
    // six foot air hug
    return this._previewAudio.loopbackGainNode.gain.value > 0;
  }

  stopPreviews() {
    this._previewActive = false;

    this.stopPreviewOutputLoopback();
    this.stopPreviewOutputTone();

    if (!this._inputActive) {
      this._stopAllInputs();
    }

    this.updateRenders();

    this._emit("preview.stop", this);
  }

  startStreams() {
    this.startAudioContext();

    this._inputActive = true;

    let startMuted = [];
    Object.keys(this._config).forEach(category => {
      if (this._config[category].startMuted) {
        startMuted.push(this._deviceKindtoTrackKind(category));
      }
    });

    return this._startInputStreams(null, startMuted).then(() => {
      this.updateRenders();
      this._emit("streams.start", this);
    });
  }

  createRemoteAudio(mediaStream) {
    return this._outputAudio.context.createMediaStreamSource(mediaStream);
  }

  setRemoteAudio(mediaStreamSource) {
    this._remoteAudio.sourceStream = mediaStreamSource;
    this._remoteAudio.sourceStream.connect(this._remoteAudio.remoteGainNode);
  }

  stopStreams() {
    this._inputActive = false;

    if (!this._previewActive) {
      this._stopAllInputs();
    }

    this.updateRenders();

    this._emit("streams.stop", this);
  }

  changeMasterVolume(volume) {
    volume = volume.toFixed(2);
    this._emit("volume.master.change", this, volume);

    this._outputAudio.volumeGainNode.gain.value = volume;

    this.updateRenders();
  }

  changeRingerVolume(volume) {
    volume = volume.toFixed(2);
    this._emit("volume.ringer.change", this, volume);

    this._notificationAudio.ringerGainNode.gain.value = volume;

    this.updateRenders();
  }

  changeDTMFVolume(volume) {
    volume = volume.toFixed(2);
    this._emit("volume.dtmf.change", this, volume);

    this._notificationAudio.dtmfGainNode.gain.value = volume;

    this.updateRenders();
  }

  changeRemoteVolume(volume) {
    volume = volume.toFixed(2);
    this._emit("volume.remote.change", this, volume);

    this._remoteAudio.remoteGainNode.gain.value = volume;

    this.updateRenders();
  }

  mute(deviceKind = null) {
    switch (deviceKind) {
      case "audiooutput":
        return this._muteOutput(deviceKind);
      default:
        return this._muteInput(deviceKind);
    }
  }

  unmute(deviceKind = null) {
    switch (deviceKind) {
      case "audiooutput":
        return this._unmuteOutput(deviceKind);
      default:
        return this._unmuteInput(deviceKind);
    }
  }

  toggleMute(deviceKind = null) {
    switch (deviceKind) {
      case "audiooutput":
        return this._toggleUuteOutput(deviceKind);
      default:
        return this._toggleMuteInput(deviceKind);
    }
  }

  startPlayTone(...tones) {
    this.startAudioContext();

    let duration = 0.15;
    let sampleRate = this._outputAudio.context.sampleRate;
    let buffer = this._outputAudio.context.createBuffer(
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

    let src = this._outputAudio.context.createBufferSource();
    src.buffer = buffer;
    src.connect(this._notificationAudio.dtmfGainNode);
    src.start();
  }

  stopPlayTone(tone) {
    console.log("stop playing tone " + tone);
  }

  startRinging() {}

  stopRinging() {}

  async changeDevice(deviceKind, deviceId) {
    let preferedDevice = this._findAvailableDevice(deviceKind, deviceId);

    if (!preferedDevice) {
      // TODO: create a meaningful return/error
      return;
    }

    if (!preferedDevice.connected) {
      // TODO: create a meaningful return/error
      return;
    }

    let release = await this._changeStreamMutex.acquire();
    this._preferDevice(preferedDevice);
    switch (deviceKind) {
      case "audiooutput":
        this._changeOutputDevice(preferedDevice).then(() => {
          this.updateRenders();
          release();
        });
      default:
        return this._changeInputDevice(preferedDevice).then(() => {
          this.updateRenders();
          release();
        });
    }
  }

  async refreshAvailableDevices() {
    return this._shimEnumerateDevices()
      .then(async devices => {
        let release = await this._changeStreamMutex.acquire();
        let alteredTrackKinds = [];

        // NOTE: assume all devices are disconnected then transition
        //  each back to connected if enumerated
        this._forEachAvailableDevice(availableDevice => {
          if (availableDevice.id != "none") {
            availableDevice.connected = false;
          }
        });

        this._importInputDevices(devices);

        Object.keys(this._availableDevices).forEach(deviceKind => {
          let activeDevice = this._availableDevices[deviceKind].find(
            availableDevice => {
              return availableDevice.active;
            }
          );
          let preferedDevice = this._availableDevices[deviceKind].find(
            availableDevice => {
              return availableDevice.connected && availableDevice.id != "none";
            }
          );
          let switchToPrefered =
            activeDevice &&
            preferedDevice &&
            activeDevice.preference < preferedDevice.preference;
          let activeDeviceDisconnected =
            activeDevice && !activeDevice.connected;

          if (switchToPrefered || activeDeviceDisconnected) {
            activeDevice.active = false;
            alteredTrackKinds.push(activeDevice.trackKind);

            if (preferedDevice) {
              preferedDevice.active = true;
            }
          }
        });

        return this._mediaStreamPromise.then(mediaStream => {
          let startMuted = [];
          let constraints = this._createConstraints();
          let alteredConstraints = {};

          mediaStream.getTracks().forEach(track => {
            let trackParameters = this._trackParameters(track);
            let deviceKind = this._trackKindtoDeviceKind(track.kind);
            let activeDevice = this._availableDevices[deviceKind].find(
              availableDevice => {
                return availableDevice.active;
              }
            );
            if (!track.enabled) {
              startMuted.push(track.kind);
            }

            if (activeDevice) {
              let differentId =
                activeDevice.id != trackParameters.settings.deviceId;
              let differentLabel = activeDevice.label != track.label;
              if (differentId || differentLabel) {
                alteredTrackKinds.push(track.kind);
                this._removeTrack(mediaStream, track);
              }
            } else if (track.readyState != "live") {
              alteredTrackKinds.push(track.kind);
              this._removeTrack(mediaStream, track);
            }
          });

          alteredTrackKinds.forEach(trackKind => {
            if (constraints[trackKind]) {
              alteredConstraints[trackKind] = constraints[trackKind];
            }
          });

          release();

          return this._startInputStreams(alteredConstraints, startMuted);
        });
      })
      .then(() => {
        this._sortAvailableDevices();
        this.updateRenders();
      });
  }

  updateRenders() {
    this.render(
      render => {
        render.data.loaded = this._loaded;
        render.data.active = this._inputActive;
        render.data.preview = this._previewActive;
        render.data.volume.master.value =
          this._outputAudio.volumeGainNode.gain.value * 1000;
        render.data.volume.ringer.value =
          this._notificationAudio.ringerGainNode.gain.value * 1000;
        render.data.volume.dtmf.value =
          this._notificationAudio.dtmfGainNode.gain.value * 1000;
        render.data.volume.remote.value =
          this._remoteAudio.remoteGainNode.gain.value * 1000;
        render.data.volume.max = 1000;
        render.data.volume.min = 0;
        render.data.audiooutput.preview.loopback.active = this.isPreviewOutputLoopbackActive();
        render.data.audiooutput.preview.tone.active = this.isPreviewOutputToneActive();

        Object.keys(this._availableDevices).forEach(deviceKind => {
          let devices = this._availableDevices[deviceKind].slice(0);
          devices.sort((a, b) => {
            return a.displayOrder - b.displayOrder;
          });
          render.data[deviceKind].devices = devices;
        });

        return render;
      },
      render => {
        if (this._previewAudio.sourceStream) {
          let previewMediaStream = this._previewAudio.sourceStream;
          let audioTrack = previewMediaStream.mediaStream
            .getTracks()
            .find(track => {
              return track.kind == "audio" && track.readyState == "live";
            });

          if (!audioTrack) {
            return;
          }

          if (!render.previewAudioMeter) {
            render.previewAudioMeter = AudioStreamMeter.audioStreamProcessor(
              this._outputAudio.context,
              this._audioProcessCallback(render)
            );
          } else {
            render.previewAudioMeter.audioProcessCallback = this._audioProcessCallback(
              render
            );
          }

          if (
            !render.previewAudioMeter.trackId ||
            render.previewAudioMeter.trackId != audioTrack.id
          ) {
            render.previewAudioMeter.trackId = audioTrack.id;
            previewMediaStream.connect(render.previewAudioMeter);
          }
        }
      }
    );
  }

  /** Init functions */

  _initInternationalization(config) {
    let defaults = {
      en: {
        legend: "Select your devices",
        none: "None",
        audiooutput: "Speaker",
        audioinput: "Microphone",
        videoinput: "Camera",
        loading: "Finding media devices...",
        starttone: "Play Tone",
        stoptone: "Stop Tone",
        startloopback: "Start Loopback",
        stoploopback: "Stop Loopback",
        mastervolume: "Master Volume",
        ringervolume: "Ringer Volume",
        dtmfvolume: "DTMF Volume",
        remotevolume: "Call Volume"
      }
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("mediaDevices", resourceBundles);
  }

  _initProperties(config) {
    var defaults = {
      volume: {
        master: {
          enabled: true,
          default: 1
        },
        ringer: {
          enabled: true,
          default: 1
        },
        dtmf: {
          enabled: true,
          default: 1
        },
        remote: {
          enabled: true,
          default: 1
        }
      },
      audiooutput: {
        enabled: "sinkId" in HTMLMediaElement.prototype,
        startMuted: false,
        preferedDeviceIds: [],
        livePreview: true,
        preview: {
          loopback: {
            enabled: true,
            delay: 0.5,
            startOnPreview: false
          },
          tone: {
            enabled: true,
            frequency: 440,
            duration: 1.5,
            type: "sine",
            startOnPreview: false
          }
        }
      },
      audioinput: {
        enabled: true,
        startMuted: false,
        constraints: {},
        preferedDeviceIds: [],
        livePreview: true
      },
      videoinput: {
        enabled: true,
        startMuted: true,
        constraints: {},
        preferedDeviceIds: [],
        livePreview: true
      },
      renderTargets: [],
      detectDeviceChanges: true,
      startPreview: false,
      startStreams: false
    };
    this._config = merge(defaults, config);

    // NOTE: it makes more since if configured with highest priority to
    //   lowest, but we use the index number to represent that so flip it
    this._config.audiooutput.preferedDeviceIds.reverse();
    this._config.audioinput.preferedDeviceIds.reverse();
    this._config.videoinput.preferedDeviceIds.reverse();

    this._inputActive = false;
    this._previewActive = false;
    this.__previewAudioActive = false;

    this._availableDevices = {
      audiooutput: [],
      audioinput: [],
      videoinput: [
        this._deviceParameters({
          deviceId: "none",
          label: "libwebphone:mediaDevices.none",
          kind: "videoinput"
        })
      ]
    };

    this._loaded = false;
    this._changeStreamMutex = new Mutex();
  }

  _initInputStreams() {
    let constraints = {
      audio: this._config["audioinput"].enabled,
      video: this._config["videoinput"].enabled
    };

    this._mediaStreamPromise = this._shimGetUserMedia(constraints);
    return this._mediaStreamPromise;
  }

  _initOutputStreams() {
    let audioContext = new AudioContext();
    this._previewAudio = {
      loopbackDelayNode: audioContext.createDelay(5.0),
      loopbackGainNode: audioContext.createGain(),
      oscillatorNode: audioContext.createOscillator(),
      oscillatorGainNode: audioContext.createGain()
    };
    this._previewAudio.loopbackDelayNode.delayTime.value = this._config.audiooutput.preview.loopback.delay;
    this._previewAudio.loopbackDelayNode.connect(
      this._previewAudio.loopbackGainNode
    );
    this._previewAudio.loopbackGainNode.gain.value = 0;
    this._previewAudio.oscillatorNode.frequency.value = this._config.audiooutput.preview.tone.frequency;
    this._previewAudio.oscillatorNode.type = this._config.audiooutput.preview.tone.type;
    this._previewAudio.oscillatorNode.connect(
      this._previewAudio.oscillatorGainNode
    );
    this._previewAudio.oscillatorGainNode.gain.value = 0;

    this._remoteAudio = {
      remoteGainNode: audioContext.createGain()
    };
    this._remoteAudio.remoteGainNode.gain.value = this._config.volume.remote.default;

    this._notificationAudio = {
      ringerGainNode: audioContext.createGain(),
      dtmfGainNode: audioContext.createGain()
    };
    this._notificationAudio.ringerGainNode.gain.value = this._config.volume.ringer.default;
    this._notificationAudio.dtmfGainNode.gain.value = this._config.volume.dtmf.default;

    this._outputAudio = {
      context: audioContext,
      merger: audioContext.createChannelMerger(5),
      volumeGainNode: audioContext.createGain(),
      destinationStream: audioContext.createMediaStreamDestination(),
      element: document.createElement("audio")
    };
    this._outputAudio.merger.connect(this._outputAudio.volumeGainNode);
    this._outputAudio.volumeGainNode.gain.value = this._config.volume.master.default;
    this._outputAudio.volumeGainNode.connect(
      this._outputAudio.destinationStream
    );
    this._outputAudio.element.srcObject = this._outputAudio.destinationStream.stream;

    this._previewAudio.loopbackGainNode.connect(this._outputAudio.merger, 0, 0);
    this._previewAudio.loopbackGainNode.connect(this._outputAudio.merger, 0, 1);

    this._previewAudio.oscillatorGainNode.connect(
      this._outputAudio.merger,
      0,
      0
    );
    this._previewAudio.oscillatorGainNode.connect(
      this._outputAudio.merger,
      0,
      1
    );

    this._remoteAudio.remoteGainNode.connect(this._outputAudio.merger, 0, 0);
    this._remoteAudio.remoteGainNode.connect(this._outputAudio.merger, 0, 1);

    this._notificationAudio.ringerGainNode.connect(
      this._outputAudio.merger,
      0,
      0
    );
    this._notificationAudio.ringerGainNode.connect(
      this._outputAudio.merger,
      0,
      1
    );

    this._notificationAudio.dtmfGainNode.connect(
      this._outputAudio.merger,
      0,
      0
    );
    this._notificationAudio.dtmfGainNode.connect(
      this._outputAudio.merger,
      0,
      1
    );

    this._mediaStreamPromise.then(mediaStream => {
      this._previewAudio.sourceStream = this._outputAudio.context.createMediaStreamSource(
        mediaStream
      );
      this._previewAudio.sourceStream.connect(
        this._previewAudio.loopbackDelayNode
      );
    });
  }

  _initAvailableDevices() {
    this._mediaStreamPromise.then(mediaStream => {
      this._shimEnumerateDevices().then(devices => {
        this._importInputDevices(devices);
        this._sortAvailableDevices();
        mediaStream.getTracks().forEach(track => {
          let trackParameters = this._trackParameters(track);
          let deviceKind = trackParameters.deviceKind;
          let deviceId = trackParameters.settings.deviceId;
          let availableDevice = this._findAvailableDevice(deviceKind, deviceId);

          if (availableDevice) {
            Object.assign(availableDevice, trackParameters, { active: true });
          }

          if (!this._config.startPreview && !this._config.startStreams) {
            track.enabled = false;
            track.stop();
            mediaStream.removeTrack(track);
          }
        });

        Object.keys(this._availableDevices).forEach(deviceKind => {
          let activeDevice = this._availableDevices[deviceKind].find(
            availableDevice => {
              return availableDevice.active;
            }
          );

          if (!activeDevice) {
            let availableDevice = this._availableDevices[deviceKind][0];
            if (availableDevice) {
              availableDevice.active = true;
            }
          }
        });

        this._loaded = true;
        this.updateRenders();
      });
    });
  }

  _initEventBindings() {
    if (this._config.detectDeviceChanges) {
      navigator.mediaDevices.ondevicechange = event => {
        this.refreshAvailableDevices();
      };
    }
  }

  _initRenderTargets() {
    this._config.renderTargets.map(renderTarget => {
      return this.renderAddTarget(renderTarget);
    });
  }

  /** Render Helpers */

  _renderDefaultConfig() {
    return {
      template: this._renderDefaultTemplate(),
      i18n: {
        legend: "libwebphone:mediaDevices.legend",
        none: "libwebphone:mediaDevices.none",
        audiooutput: "libwebphone:mediaDevices.audiooutput",
        audioinput: "libwebphone:mediaDevices.audioinput",
        videoinput: "libwebphone:mediaDevices.videoinput",
        loading: "libwebphone:mediaDevices.loading",
        starttone: "libwebphone:mediaDevices.starttone",
        stoptone: "libwebphone:mediaDevices.stoptone",
        startloopback: "libwebphone:mediaDevices.startloopback",
        stoploopback: "libwebphone:mediaDevices.stoploopback",
        mastervolume: "libwebphone:mediaDevices.mastervolume",
        ringervolume: "libwebphone:mediaDevices.ringervolume",
        dtmfvolume: "libwebphone:mediaDevices.dtmfvolume",
        remotevolume: "libwebphone:mediaDevices.remotevolume"
      },
      by_id: {
        audiooutput: {
          events: {
            onchange: event => {
              let element = event.srcElement;
              if (element.options) {
                let deviceId = element.options[element.selectedIndex].value;
                this.changeDevice("audiooutput", deviceId);
              }
            }
          }
        },
        startpreviewtone: {
          preview: "audiooutput",
          events: {
            onclick: event => {
              this.startPreviewOutputTone();
            }
          }
        },
        stoppreviewtone: {
          preview: "audiooutput",
          events: {
            onclick: event => {
              this.stopPreviewOutputTone();
            }
          }
        },
        startpreviewloopback: {
          preview: "audiooutput",
          events: {
            onclick: event => {
              this.startPreviewOutputLoopback();
            }
          }
        },
        stoppreviewloopback: {
          preview: "audiooutput",
          events: {
            onclick: event => {
              this.stopPreviewOutputLoopback();
            }
          }
        },
        audioinput: {
          events: {
            onchange: event => {
              let element = event.srcElement;
              if (element.options) {
                let deviceId = element.options[element.selectedIndex].value;
                this.changeDevice("audioinput", deviceId);
              }
            }
          }
        },
        audioinputpreview: {
          preview: "audioinput"
        },
        videoinput: {
          events: {
            onchange: event => {
              let element = event.srcElement;
              if (element.options) {
                let deviceId = element.options[element.selectedIndex].value;
                this.changeDevice("videoinput", deviceId);
              }
            }
          }
        },
        videoinputpreview: {
          preview: "videoinput"
        },
        mastervolume: {
          events: {
            onchange: event => {
              let element = event.srcElement;
              this.changeMasterVolume(element.value / 1000);
            }
          }
        },
        ringervolume: {
          events: {
            onchange: event => {
              let element = event.srcElement;
              this.changeRingerVolume(element.value / 1000);
            }
          }
        },
        dtmfvolume: {
          events: {
            onchange: event => {
              let element = event.srcElement;
              this.changeDTMFVolume(element.value / 1000);
            }
          }
        },
        remotevolume: {
          events: {
            onchange: event => {
              let element = event.srcElement;
              this.changeRemoteVolume(element.value / 1000);
            }
          }
        }
      },
      data: {
        loaded: this._loaded,
        audiooutput: this._config.audiooutput,
        audioinput: this._config.audioinput,
        videoinput: this._config.videoinput,
        volume: this._config.volume
      }
    };
  }

  _renderDefaultTemplate() {
    // TODO: render advanced settings from capabilities
    return `
        <div>
            <legend>{{i18n.legend}}</legend>

            {{#data.loaded}}
            {{#data.audiooutput.enabled}}
              <div>
                <label for="{{by_id.audiooutput.elementId}}">
                  {{i18n.audiooutput}}
                </label>
                <select id="{{by_id.audiooutput.elementId}}">
                  {{#data.audiooutput.devices}}
                    {{#connected}}
                      <option value="{{id}}" {{#active}}selected{{/active}}>{{name}}</option>
                    {{/connected}}
                  {{/data.audiooutput.devices}}
                </select>

                {{#data.preview}}
                {{#data.audiooutput.livePreview}}
                  <div>
                    {{#data.audiooutput.preview.tone.enabled}}
                      {{^data.audiooutput.preview.tone.active}}
                        <a id="{{by_id.startpreviewtone.elementId}}" href="#">{{i18n.starttone}}</a>
                      {{/data.audiooutput.preview.tone.active}}

                      {{#data.audiooutput.preview.tone.active}}
                        <a id="{{by_id.stoppreviewtone.elementId}}" href="#">{{i18n.stoptone}}</a>
                      {{/data.audiooutput.preview.tone.active}}
                    {{/data.audiooutput.preview.tone.enabled}}
                    

                    {{#data.audiooutput.preview.loopback.enabled}}
                      {{#data.audiooutput.preview.tone.enabled}}
                      |
                      {{/data.audiooutput.preview.tone.enabled}}

                      {{^data.audiooutput.preview.loopback.active}}
                        <a id="{{by_id.startpreviewloopback.elementId}}" href="#">{{i18n.startloopback}}</a>
                      {{/data.audiooutput.preview.loopback.active}}

                      {{#data.audiooutput.preview.loopback.active}}
                        <a id="{{by_id.stoppreviewloopback.elementId}}" href="#">{{i18n.stoploopback}}</a>
                      {{/data.audiooutput.preview.loopback.active}}
                    {{/data.audiooutput.preview.loopback.enabled}}

                  </div>
                {{/data.audiooutput.livePreview}}
                {{/data.preview}}
              </div>
            {{/data.audiooutput.enabled}}

            {{#data.volume.master.enabled}}    
            <div>
              <label for="{{by_id.mastervolume.elementId}}">
                {{i18n.mastervolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.volume.master.value}}" id="{{by_id.mastervolume.elementId}}">
            </div>
            {{/data.volume.master.enabled}}

            {{#data.volume.ringer.enabled}}
            <div>
              <label for="{{by_id.ringervolume.elementId}}">
                {{i18n.ringervolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.volume.ringer.value}}" id="{{by_id.ringervolume.elementId}}">
            </div>
            {{/data.volume.ringer.enabled}}

            {{#data.volume.dtmf.enabled}}
            <div>
              <label for="{{by_id.dtmfvolume.elementId}}">
                {{i18n.dtmfvolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.volume.dtmf.value}}" id="{{by_id.dtmfvolume.elementId}}">
            </div>
            {{/data.volume.dtmf.enabled}}

            {{#data.volume.remote.enabled}}
            <div>
              <label for="{{by_id.remotevolume.elementId}}">
                {{i18n.remotevolume}}
              </label>
              <input type="range" min="{{data.volume.min}}" max="{{data.volume.max}}" value="{{data.volume.remote.value}}" id="{{by_id.remotevolume.elementId}}">
            </div>
            {{/data.volume.remote.enabled}}

            {{#data.audioinput.enabled}}
              <div>
                <label for="{{by_id.audioinput.elementId}}">
                  {{i18n.audioinput}}
                </label>
                <select id="{{by_id.audioinput.elementId}}">
                  {{#data.audioinput.devices}}
                    {{#connected}}
                      <option value="{{id}}" {{#active}}selected{{/active}}>{{name}}</option>
                    {{/connected}}    
                  {{/data.audioinput.devices}}
                </select>

                {{#data.preview}}
                {{#data.audioinput.livePreview}}
                  <div id="{{by_id.audioinputpreview.elementId}}" style="width:300px;height:10px;background-color: lightgray;margin: 10px 0px;">
                    <div style="height:10px; background-color: #00aeef;"></div>
                  </div>
                {{/data.audioinput.livePreview}}   
                {{/data.preview}}                 
              </div>
            {{/data.audioinput.enabled}}

            {{#data.videoinput.enabled}}          
              <div>
                  <label for="{{by_id.videoinput.elementId}}">
                    {{i18n.videoinput}}
                  </label>                
                  <select id="{{by_id.videoinput.elementId}}">
                    {{#data.videoinput.devices}}
                        {{#connected}}
                          <option value="{{id}}" {{#active}}selected{{/active}}>{{name}}</option>
                        {{/connected}}
                    {{/data.videoinput.devices}}
                  </select>

                  {{#data.preview}}
                  {{#data.videoinput.livePreview}}
                    <div>
                      <video id="{{videoinputpreview.elementId}}" width="{{videoinput.preference.settings.width}}" height="{{videoinput.preference.settings.height}}" autoplay muted></video>
                    </div>
                  {{/data.videoinput.livePreview}}
                  {{/data.preview}} 
              </div>
            {{/data.videoinput.enabled}}
            {{/data.loaded}}

            {{^data.loaded}}
              <div style="margin: 50px 5px;">
                <div class="spinner">
                  <div class="bounce1"></div>
                  <div class="bounce2"></div>
                  <div class="bounce3"></div>
                </div>
                <div style="text-align: center;">{{i18n.loading}}</div>
              </div>
            {{/data.loaded}}
        </div>
        `;
  }

  /** Helper functions */

  async _changeOutputDevice(preferedDevice) {
    return this._outputAudio.element.setSinkId(preferedDevice.id).then(() => {
      this._availableDevices[preferedDevice.deviceKind].forEach(
        availableDevice => {
          if (availableDevice.id == preferedDevice.id) {
            availableDevice.active = true;
          } else {
            availableDevice.active = false;
          }
        }
      );
      this._emit("audio.output.changed", this, preferedDevice);
    });
  }

  _muteInput(deviceKind = null) {
    return this._mediaStreamPromise.then(mediaStream => {
      let trackKind = this._deviceKindtoTrackKind(deviceKind);

      mediaStream.getTracks().forEach(track => {
        if (!trackKind || track.kind == trackKind) {
          track.enabled = false;
          this._emit(track.kind + ".input.muted", this, track);
        }
      });

      return mediaStream;
    });
  }

  _unmuteInput(deviceKind = null) {
    return this._mediaStreamPromise.then(mediaStream => {
      let trackKind = this._deviceKindtoTrackKind(deviceKind);

      mediaStream.getTracks().forEach(track => {
        if (!trackKind || track.kind == trackKind) {
          track.enabled = true;
          this._emit(track.kind + ".input.unmuted", this, track);
        }
      });

      return mediaStream;
    });
  }

  _toggleMuteInput(deviceKind = null) {
    return this._mediaStreamPromise.then(mediaStream => {
      let trackKind = this._deviceKindtoTrackKind(deviceKind);

      mediaStream.getTracks().forEach(track => {
        if (!trackKind || track.kind == trackKind) {
          track.enabled = !track.enabled;

          if (track.enabled) {
            this._emit(track.kind + ".input.unmuted", this, track);
          } else {
            this._emit(track.kind + ".input.muted", this, track);
          }
        }
      });

      return mediaStream;
    });
  }

  _stopAllInputs(deviceKind = null) {
    return this._mediaStreamPromise.then(mediaStream => {
      let trackKind = this._deviceKindtoTrackKind(deviceKind);

      mediaStream.getTracks().forEach(track => {
        if (!trackKind || track.kind == trackKind) {
          track.enabled = false;
          track.stop();
          mediaStream.removeTrack(track);
        }
      });

      return mediaStream;
    });
  }

  _changeInputDevice(preferedDevice) {
    return this._mediaStreamPromise.then(mediaStream => {
      let trackKind = preferedDevice.trackKind;
      let trackConstraints = this._createConstraints(preferedDevice)[trackKind];
      let previousTrack = mediaStream.getTracks().find(track => {
        return (
          track.kind == preferedDevice.trackKind && track.readyState == "live"
        );
      });
      let mutedInputs = [];

      if (previousTrack) {
        mutedInputs = previousTrack.enabled ? [] : [previousTrack.kind];
        this._removeTrack(mediaStream, previousTrack);
      }

      if (trackConstraints) {
        let constraints = {};
        constraints[trackKind] = trackConstraints;
        return this._startInputStreams(constraints, mutedInputs).then(() => {
          if (!this._inputActive && !this._previewActive) {
            this._stopAllInputs();
          }
        });
      }

      this._emit(trackKind + ".input.changed", this, preferedDevice);
    });
  }

  _startInputStreams(constraints = null, mutedInputs = []) {
    if (!constraints) {
      constraints = this._createConstraints();
    }

    return this._mediaStreamPromise.then(mediaStream => {
      mediaStream.getTracks().forEach(track => {
        if (track.readyState == "live") {
          delete constraints[track.kind];
        }
      });

      if (Object.keys(constraints).length == 0) {
        return Promise.resolve(mediaStream);
      }

      return this._shimGetUserMedia(constraints)
        .then(otherMediaStream => {
          otherMediaStream.getTracks().forEach(track => {
            let startMuted = mutedInputs.indexOf(track.kind) >= 0;
            if (!this._inputActive && !this._previewActive) {
              startMuted = true;
            }
            track.enabled = !startMuted;
            this._addTrack(mediaStream, track);
          });

          return mediaStream;
        })
        .then(mediaStream => {
          this._previewAudio.sourceStream = this._outputAudio.context.createMediaStreamSource(
            mediaStream
          );
          this._previewAudio.sourceStream.connect(
            this._previewAudio.loopbackDelayNode
          );

          return mediaStream;
        });
    });
  }

  _createConstraints(...preferedDevices) {
    var constraints = {
      audio: this._config.audioinput.constraints || {},
      video: this._config.videoinput.constraints || {}
    };
    var preferedAudioDevice = this._availableDevices["audioinput"].find(
      availableAudioDevice => {
        return availableAudioDevice.active && availableAudioDevice.connected;
      }
    );
    var preferedVideoDevice = this._availableDevices["videoinput"].find(
      availableVideoDevice => {
        return availableVideoDevice.active && availableVideoDevice.connected;
      }
    );

    preferedDevices.forEach(preferedDevice => {
      switch (preferedDevice.deviceKind) {
        case "audioinput":
          preferedAudioDevice = preferedDevice;
          break;
        case "videoinput":
          preferedVideoDevice = preferedDevice;
          break;
      }
    });

    if (preferedAudioDevice) {
      let preferedAudioConstraints = preferedAudioDevice.constraints || {};
      preferedAudioConstraints.deviceId = {};
      preferedAudioConstraints.deviceId.exact = preferedAudioDevice.id;
      constraints.audio = merge(constraints.audio, preferedAudioConstraints);
    }

    if (preferedVideoDevice) {
      let preferedVideoConstraints = preferedVideoDevice.constraints || {};
      preferedVideoConstraints.deviceId = {};
      preferedVideoConstraints.deviceId.exact = preferedVideoDevice.id;
      constraints.video = merge(constraints.video, preferedVideoConstraints);
    }

    if (
      !this._config.audioinput.enabled ||
      (constraints.audio &&
        constraints.audio.deviceId &&
        constraints.audio.deviceId.exact == "none")
    ) {
      delete constraints.audio;
    }

    if (
      !this._config.videoinput.enabled ||
      (constraints.video &&
        constraints.video.deviceId &&
        constraints.video.deviceId.exact == "none")
    ) {
      delete constraints.video;
    }

    return constraints;
  }

  _preferDevice(preferedDevice) {
    let maxPreference = this._availableDevices[
      preferedDevice.deviceKind
    ].reduce((max, availableDevice) => {
      if (
        (availableDevice.preference || 0) > max &&
        availableDevice.id != preferedDevice.id
      ) {
        return availableDevice.preference;
      }
      return max;
    }, 0);

    preferedDevice.preference = maxPreference + 1;

    this._sortAvailableDevices();
  }

  /** MediaStream Helpers */

  _addTrack(mediaStream, track) {
    var trackParameters = this._trackParameters(track);

    mediaStream.addTrack(track);

    this._availableDevices[trackParameters.deviceKind].forEach(
      availableDevice => {
        if (availableDevice.id == trackParameters.settings.deviceId) {
          Object.assign(availableDevice, trackParameters, { active: true });
        } else {
          availableDevice.active = false;
        }
      }
    );

    this._emit(track.kind + ".input.added", this, this._trackParameters(track));

    if (track.enabled) {
      this._emit(track.kind + ".input.unmuted", this, track);
    } else {
      this._emit(track.kind + ".input.muted", this, track);
    }
  }

  _removeTrack(mediaStream, track) {
    var trackParameters = this._trackParameters(track);

    track.enabled = false;
    track.stop();

    mediaStream.removeTrack(track);

    this._availableDevices[trackParameters.deviceKind].forEach(
      availableDevice => {
        if (availableDevice.id == trackParameters.settings.deviceId) {
          Object.assign(availableDevice, trackParameters, { active: false });
        } else if (availableDevice.id == "none") {
          availableDevice.active = true;
        } else {
          availableDevice.active = false;
        }
      }
    );

    this._emit(track.kind + ".input.removed", this, track);
  }

  _trackParameters(track) {
    if (typeof track.getCapabilities != "function") {
      track.getCapabilities = () => {};
    }
    return {
      trackKind: track.kind,
      active: track.readyState == "live",
      deviceKind: this._trackKindtoDeviceKind(track.kind),
      settings: track.getSettings(),
      constraints: track.getConstraints(),
      capabilities: track.getCapabilities()
    };
  }

  _trackKindtoDeviceKind(trackKind) {
    switch (trackKind) {
      case "audio":
        return "audioinput";
      case "video":
        return "videoinput";
    }
  }

  _audioProcessCallback(render) {
    return () => {
      Object.keys(render.by_id).forEach(key => {
        if (render.by_id[key].preview == "audioinput") {
          let element = render.by_id[key].element;
          if (element) {
            element.children[0].style.width =
              render.previewAudioMeter.volume * 100 + "%";
          }
        }
      });
    };
  }

  /** Device Helpers */

  _findAvailableDevice(deviceKind, deviceId) {
    return this._availableDevices[deviceKind].find(availableDevice => {
      return availableDevice.id == deviceId;
    });
  }

  _forEachAvailableDevice(callbackfn) {
    Object.keys(this._availableDevices).forEach(deviceKind => {
      this._availableDevices[deviceKind].forEach(callbackfn);
    });
  }

  _sortAvailableDevices() {
    Object.keys(this._availableDevices).forEach(deviceKind => {
      this._availableDevices[deviceKind].sort((a, b) => {
        return b.preference - a.preference;
      });
    });
  }

  _importInputDevices(devices) {
    devices.forEach(device => {
      let enumeratedDevice = this._deviceParameters(device);
      let availableDevice = this._findAvailableDevice(
        device.kind,
        device.deviceId
      );

      if (availableDevice) {
        Object.assign(availableDevice, enumeratedDevice);
      } else {
        if (!this._availableDevices[device.kind]) {
          this._availableDevices[device.kind] = [];
        }

        enumeratedDevice.displayOrder = this._availableDevices[
          device.kind
        ].length;

        enumeratedDevice.preference =
          (this._config[device.kind].preferedDeviceIds || []).indexOf(
            enumeratedDevice.id
          ) + 1;

        this._availableDevices[device.kind].push(enumeratedDevice);
      }
    });
  }

  _deviceParameters(device) {
    let deviceId = device.deviceId;
    return {
      id: deviceId,
      label: device.label,
      deviceKind: device.kind,
      name: this._getDeviceName(device),
      trackKind: this._deviceKindtoTrackKind(device.kind),
      connected: true
    };
  }

  _getDeviceName(device) {
    let deviceKind = device.kind;
    let i18nKey = "libwebphone:mediaDevices." + deviceKind;
    return (
      device.label ||
      i18nKey + " " + (this._availableDevices[deviceKind].length + 1)
    );
  }

  _deviceKindtoTrackKind(deviceKind) {
    switch (deviceKind) {
      case "audiooutput":
        return "audio";
      case "audioinput":
        return "audio";
      case "videoinput":
        return "video";
    }
  }

  /** Shims */

  _shimEnumerateDevices() {
    return navigator.mediaDevices.enumerateDevices();
  }

  _shimGetUserMedia(constraints) {
    return navigator.mediaDevices.getUserMedia(constraints).catch(error => {
      if (this._config.videoinput.enabled) {
        this._config.videoinput.enabled = false;
        delete constraints.video;
        return navigator.mediaDevices.getUserMedia(constraints);
      } else {
        throw error;
      }
    });
  }
}

export default lwpMediaDevices;
