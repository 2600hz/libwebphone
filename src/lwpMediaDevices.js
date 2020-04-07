"use strict";

import { merge } from "./lwpUtils";
import lwpRenderer from "./lwpRenderer";
import AudioStreamMeter from "audio-stream-meter";
import { Mutex } from "async-mutex";
import adapter from "webrtc-adapter";

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

  startPreviews() {
    if (this._inputActive) {
      return;
    }

    this.startAudioContext();

    if (this._config.audiooutput.preview.loopback.startOnPreview) {
      this.startPreviewOutputLoopback();
    }

    this._startInputStreams().then(() => {
      this._previewActive = true;
      this._emit("preview.started", this);
    });
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

    if (!this._inputActive) {
      this._stopAllInputs();
    }

    this._previewActive = false;
    this._emit("preview.stop", this);
  }

  startStreams() {
    if (this._previewActive) {
      // NOTE:: technically we only need to do this for firefox...
      this.stopPreviews();
    }

    this.startAudioContext();

    let startMuted = [];
    Object.keys(this._config).forEach((category) => {
      if (this._config[category].startMuted) {
        startMuted.push(this._deviceKindtoTrackKind(category));
      }
    });

    return this._startInputStreams(null, startMuted).then((mediaStream) => {
      this._inputActive = true;

      let stream = this._audioContext.createMediaStreamDestination();
      this._inputAudio.volumeGainNode.connect(stream);

      mediaStream.getTracks().forEach((track) => {
        if (track.readyState == "live" && track.kind != "audio") {
          stream.stream.addTrack(track);
        }
      });

      this._emit("streams.started", this, mediaStream, stream);
      return stream.stream;
    });
  }

  stopStreams() {
    if (!this._previewActive) {
      this._stopAllInputs();
    }

    this._inputActive = false;
    this._emit("streams.stop", this);
  }

  changeMasterVolume(volume) {
    volume = volume.toFixed(2);
    this._outputAudio.volumeGainNode.gain.value = volume;
    this._emit("audiomixer.master.change", this, volume);
  }

  changeRingerVolume(volume) {
    volume = volume.toFixed(2);
    this._ringAudio.ringerGainNode.gain.value = volume;
    this._emit("audiomixer.ringer.change", this, volume);
  }

  changeDTMFVolume(volume) {
    volume = volume.toFixed(2);
    this._notificationAudio.dtmfGainNode.gain.value = volume;
    this._emit("audiomixer.dtmf.change", this, volume);
  }

  changeRemoteVolume(volume) {
    volume = volume.toFixed(2);
    this._remoteAudio.remoteGainNode.gain.value = volume;
    this._emit("audiomixer.remote.change", this, volume);
  }

  changeMicrophoneVolume(volume) {
    volume = volume.toFixed(2);
    this._inputAudio.volumeGainNode.gain.value = volume;
    this._emit("audiomixer.microphone.change", this, volume);
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

  stopPlayTone(tone) {
    console.log("stop playing tone " + tone);
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

  async changeDevice(deviceKind, deviceId) {
    let preferedDevice = this._findAvailableDevice(deviceKind, deviceId);

    if (!preferedDevice || !preferedDevice.connected) {
      // TODO: create a meaningful return/error
      return Promise.reject();
    }

    let release = await this._changeStreamMutex.acquire();
    this._preferDevice(preferedDevice);
    switch (deviceKind) {
      case "audiooutput":
        return this._changeOutputDevice(preferedDevice).then(() => {
          release();
        });
      default:
        return this._changeInputDevice(preferedDevice).then(() => {
          release();
        });
    }
  }

  async refreshAvailableDevices() {
    /** TODO: optimize */
    return this._shimEnumerateDevices()
      .then(async (devices) => {
        let release = await this._changeStreamMutex.acquire();
        let alteredTrackKinds = [];

        // NOTE: assume all devices are disconnected then transition
        //  each back to connected if enumerated
        this._forEachAvailableDevice((availableDevice) => {
          if (availableDevice.id != "none") {
            availableDevice.connected = false;
          }
        });

        this._importInputDevices(devices);

        Object.keys(this._availableDevices).forEach((deviceKind) => {
          let activeDevice = this._availableDevices[deviceKind].find(
            (availableDevice) => {
              return availableDevice.active;
            }
          );
          let preferedDevice = this._availableDevices[deviceKind].find(
            (availableDevice) => {
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

        return this._mediaStreamPromise.then((mediaStream) => {
          let startMuted = [];
          let constraints = this._createConstraints();
          let alteredConstraints = {};

          mediaStream.getTracks().forEach((track) => {
            let trackParameters = this._trackParameters(mediaStream, track);
            let deviceKind = this._trackKindtoDeviceKind(track.kind);
            let activeDevice = this._availableDevices[deviceKind].find(
              (availableDevice) => {
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

          alteredTrackKinds.forEach((trackKind) => {
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
    this.render((render) => {
      render.data = this._renderData(render.data);
      return render;
    }).then((rendered) => {
      this._mediaStreamPromise.then((mediaStream) => {
        let audioInputPreviews = [];
        rendered.forEach((render) => {
          Object.keys(render.by_id).forEach((key) => {
            if (render.by_id[key].preview == "audioinput") {
              let element = render.by_id[key].element;
              if (element) {
                element.srcObject = mediaStream;
                audioInputPreviews.push(element.children[0]);
              }
            }
          });

          Object.keys(render.by_name).forEach((key) => {
            if (render.by_name[key].preview == "audioinput") {
              let element = render.by_name[key].element;
              if (element) {
                element.srcObject = mediaStream;
                audioInputPreviews.push(element.children[0]);
              }
            }
          });

          Object.keys(render.by_id).forEach((key) => {
            if (render.by_id[key].preview == "videoinput") {
              let element = render.by_id[key].element;
              if (element) {
                element.srcObject = mediaStream;
              }
            }
          });

          Object.keys(render.by_name).forEach((key) => {
            if (render.by_name[key].preview == "videoinput") {
              let element = render.by_name[key].element;
              if (element) {
                element.srcObject = mediaStream;
              }
            }
          });
        });
        this._previewAudioMeter.audioProcessCallback = this._audioProcessCallback(
          this._previewAudioMeter,
          audioInputPreviews
        );
      });
    });
  }

  /** Init functions */

  _initInternationalization(config) {
    let defaults = {
      en: {
        none: "None",
        audiooutput: "Speaker",
        audiooutputpreview: "Preview Options",
        audioinput: "Microphone",
        audioinputpreview: "Preview",
        videoinput: "Camera",
        videoinputpreview: "Preview",
        loading: "Finding media devices...",
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
      audiomixer: {
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
        microphone: {
          type: "input",
          show: true,
          default: 0.25,
        },
      },
      audiooutput: {
        show: "sinkId" in HTMLMediaElement.prototype,
        startMuted: false,
        preferedDeviceIds: [],
        livePreview: true,
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
      },
      audioinput: {
        enabled: true,
        show: true,
        startMuted: false,
        constraints: {},
        preferedDeviceIds: [],
        livePreview: true,
      },
      videoinput: {
        enabled: true,
        show: true,
        startMuted: true,
        constraints: {},
        preferedDeviceIds: [],
        livePreview: true,
      },
      renderTargets: [],
      detectDeviceChanges: true,
      startPreview: false,
      startStreams: false,
    };
    this._config = merge(defaults, config);

    // NOTE: it makes more sense if configured with highest priority to
    //   lowest, but we use the index number to represent that so flip it
    this._config.audiooutput.preferedDeviceIds.reverse();
    this._config.audioinput.preferedDeviceIds.reverse();
    this._config.videoinput.preferedDeviceIds.reverse();

    this._inputActive = false;
    this._previewActive = false;

    this._availableDevices = {
      audiooutput: [],
      audioinput: [],
      videoinput: [
        this._deviceParameters({
          deviceId: "none",
          label: "libwebphone:mediaDevices.none",
          kind: "videoinput",
          displayOrder: 0,
        }),
      ],
    };

    this._loaded = false;
    this._changeStreamMutex = new Mutex();
    this._audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
  }

  _initInputStreams() {
    this._inputAudio = {
      sourcStream: null,
      volumeGainNode: this._audioContext.createGain(),
      destinationStream: this._audioContext.createMediaStreamDestination(),
    };

    this._inputAudio.volumeGainNode.gain.value = this._config.audiomixer.microphone.default;
    this._previewAudioMeter = AudioStreamMeter.audioStreamProcessor(
      this._audioContext,
      () => {}
    );
    this._inputAudio.volumeGainNode.connect(this._previewAudioMeter);

    let constraints = {
      audio: this._config["audioinput"].enabled,
      video: this._config["videoinput"].enabled,
    };

    this._mediaStreamPromise = this._shimGetUserMedia(constraints)
      .then((mediaStream) => {
        this._updateInputChain(mediaStream);
        return mediaStream;
      })
      .catch((error) => {
        this._emit("getUserMedia.error", this, error);
        if (constraints.video && constraints.audio) {
          delete constraints.video;
          return this._shimGetUserMedia(constraints);
        }
      });

    return this._mediaStreamPromise;
  }

  _initOutputStreams() {
    this._previewAudio = {
      loopbackDelayNode: this._audioContext.createDelay(
        this._config.audiooutput.preview.loopback.delay + 1.5
      ),
      loopbackGainNode: this._audioContext.createGain(),
      oscillatorNode: this._audioContext.createOscillator(),
      oscillatorGainNode: this._audioContext.createGain(),
    };
    this._previewAudio.loopbackDelayNode.delayTime.value = this._config.audiooutput.preview.loopback.delay;
    this._inputAudio.volumeGainNode.connect(
      this._previewAudio.loopbackDelayNode
    );
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

    this._remoteAudio = {
      sourcStream: null,
      remoteGainNode: this._audioContext.createGain(),
    };
    this._remoteAudio.remoteGainNode.gain.value = this._config.audiomixer.remote.default;

    this._notificationAudio = {
      dtmfGainNode: this._audioContext.createGain(),
    };
    this._notificationAudio.dtmfGainNode.gain.value = this._config.audiomixer.dtmf.default;

    this._outputAudio = {
      volumeGainNode: this._audioContext.createGain(),
      destinationStream: this._audioContext.createMediaStreamDestination(),
      element: document.createElement("audio"),
    };
    this._outputAudio.volumeGainNode.gain.value = this._config.audiomixer.master.default;

    this._previewAudio.loopbackGainNode.connect(
      this._outputAudio.volumeGainNode
    );
    this._previewAudio.oscillatorGainNode.connect(
      this._outputAudio.volumeGainNode
    );

    this._outputAudio.volumeGainNode.connect(
      this._outputAudio.destinationStream
    );
    this._outputAudio.element.srcObject = this._outputAudio.destinationStream.stream;

    this._remoteAudio.remoteGainNode.connect(this._outputAudio.volumeGainNode);
    this._ringAudio.ringerGainNode.connect(this._outputAudio.volumeGainNode);
    this._notificationAudio.dtmfGainNode.connect(
      this._outputAudio.volumeGainNode
    );
  }

  _initAvailableDevices() {
    this._mediaStreamPromise.then((mediaStream) => {
      this._shimEnumerateDevices().then((devices) => {
        this._importInputDevices(devices);
        this._sortAvailableDevices();
        mediaStream.getTracks().forEach((track) => {
          this._addTrack(mediaStream, track);
          this._removeTrack(mediaStream, track, false);
        });

        Object.keys(this._availableDevices).forEach((deviceKind) => {
          let activeDevice = this._availableDevices[deviceKind].find(
            (availableDevice) => {
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
      navigator.mediaDevices.ondevicechange = (event) => {
        this.refreshAvailableDevices();
      };
    }

    this._libwebphone.on("mediaDevices.preview.started", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.preview.tone.started", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.preview.tone.stop", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.preview.loopback.started", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.preview.loopback.stop", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.preview.stop", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.streams.started", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.streams.stop", () => {
      this.updateRenders();
    });
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
    this._libwebphone.on("mediaDevices.getUserMedia.error", () => {
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
        none: "libwebphone:mediaDevices.none",
        audiooutput: "libwebphone:mediaDevices.audiooutput",
        audiooutputpreview: "libwebphone:mediaDevices.audiooutputpreview",
        audioinput: "libwebphone:mediaDevices.audioinput",
        audioinputpreview: "libwebphone:mediaDevices.audioinputpreview",
        videoinput: "libwebphone:mediaDevices.videoinput",
        videoinputpreview: "libwebphone:mediaDevices.videoinputpreview",
        loading: "libwebphone:mediaDevices.loading",
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
        audiooutput: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              if (element.options) {
                let deviceId = element.options[element.selectedIndex].value;
                this.changeDevice("audiooutput", deviceId);
              }
            },
          },
        },
        startpreviewtone: {
          preview: "audiooutput",
          events: {
            onclick: (event) => {
              this.startPreviewOutputTone();
            },
          },
        },
        stoppreviewtone: {
          preview: "audiooutput",
          events: {
            onclick: (event) => {
              this.stopPreviewOutputTone();
            },
          },
        },
        startpreviewloopback: {
          preview: "audiooutput",
          events: {
            onclick: (event) => {
              this.startPreviewOutputLoopback();
            },
          },
        },
        stoppreviewloopback: {
          preview: "audiooutput",
          events: {
            onclick: (event) => {
              this.stopPreviewOutputLoopback();
            },
          },
        },
        audioinput: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              if (element.options) {
                let deviceId = element.options[element.selectedIndex].value;
                this.changeDevice("audioinput", deviceId);
              }
            },
          },
        },
        audioinputpreview: {
          preview: "audioinput",
        },
        videoinput: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              if (element.options) {
                let deviceId = element.options[element.selectedIndex].value;
                this.changeDevice("videoinput", deviceId);
              }
            },
          },
        },
        videoinputpreview: {
          preview: "videoinput",
        },
        masteraudiomixer: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeMasterVolume(element.value / 1000);
            },
          },
        },
        ringeraudiomixer: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeRingerVolume(element.value / 1000);
            },
          },
        },
        dtmfaudiomixer: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeDTMFVolume(element.value / 1000);
            },
          },
        },
        remoteaudiomixer: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeRemoteVolume(element.value / 1000);
            },
          },
        },
        microphoneaudiomixer: {
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
          {{#data.loaded}}
          {{#data.audiooutput.show}}
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
            </div>

            <div>
              {{#data.preview}}
              {{#data.audiooutput.livePreview}}
                <label for="{{by_id.audiooutput.elementId}}">
                  {{i18n.audiooutputpreview}}
                </label>
                {{#data.audiooutput.preview.tone.show}}
                  {{^data.audiooutput.preview.tone.active}}
                    <a id="{{by_id.startpreviewtone.elementId}}" href="#">{{i18n.starttone}}</a>
                  {{/data.audiooutput.preview.tone.active}}

                  {{#data.audiooutput.preview.tone.active}}
                    <a id="{{by_id.stoppreviewtone.elementId}}" href="#">{{i18n.stoptone}}</a>
                  {{/data.audiooutput.preview.tone.active}}
                {{/data.audiooutput.preview.tone.show}}
                

                {{#data.audiooutput.preview.loopback.show}}
                  {{#data.audiooutput.preview.tone.show}}
                  |
                  {{/data.audiooutput.preview.tone.show}}

                  {{^data.audiooutput.preview.loopback.active}}
                    <a id="{{by_id.startpreviewloopback.elementId}}" href="#">{{i18n.startloopback}}</a>
                  {{/data.audiooutput.preview.loopback.active}}

                  {{#data.audiooutput.preview.loopback.active}}
                    <a id="{{by_id.stoppreviewloopback.elementId}}" href="#">{{i18n.stoploopback}}</a>
                  {{/data.audiooutput.preview.loopback.active}}
                {{/data.audiooutput.preview.loopback.show}}
              {{/data.audiooutput.livePreview}}
              {{/data.preview}}
            </div>
          {{/data.audiooutput.show}}

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

          {{#data.audioinput.show}}
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
                <label for="{{by_id.audioinputpreview.elementId}}">
                  {{i18n.audioinputpreview}}
                </label> 
                <span id="{{by_id.audioinputpreview.elementId}}" style="width:300px;height:10px;background-color:lightgray;display:inline-block;">
                  <div style="height:10px; background-color: #00aeef;"></div>
                </span>
              {{/data.audioinput.livePreview}}   
              {{/data.preview}}                 
            </div>
          {{/data.audioinput.show}}

          {{#data.audiomixer.microphone.show}}
            <div>
              <label for="{{by_id.microphoneaudiomixer.elementId}}">
                {{i18n.microphonevolume}}
              </label>
              <input type="range" min="{{data.audiomixer.min}}" max="{{data.audiomixer.max}}" value="{{data.audiomixer.microphone.value}}" id="{{by_id.microphoneaudiomixer.elementId}}">
            </div>
          {{/data.audiomixer.microphone.show}}

          {{#data.videoinput.show}}          
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
            </div>

            <div>
              {{#data.preview}}
              {{#data.videoinput.livePreview}}
                <label for="{{by_id.videoinputpreview.elementId}}">
                  {{i18n.videoinputpreview}}
                </label> 
                <video id="{{by_id.videoinputpreview.elementId}}" width="{{videoinput.preference.settings.width}}" height="{{videoinput.preference.settings.height}}" autoplay muted style="width: 500px;"></video>
              {{/data.videoinput.livePreview}}
              {{/data.preview}} 
            </div>
          {{/data.videoinput.show}}
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

  _renderData(
    data = {
      audiomixer: {
        master: {},
        ringer: {},
        dtmf: {},
        remote: {},
        microphone: {},
      },
      audiooutput: {
        preview: {
          loopback: {},
          tone: {},
        },
      },
    }
  ) {
    data.loaded = this._loaded;
    data.active = this._inputActive;
    data.preview = this._previewActive;

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

    data.audiooutput.preview.loopback.active = this.isPreviewOutputLoopbackActive();
    data.audiooutput.preview.tone.active = this.isPreviewOutputToneActive();

    Object.keys(this._availableDevices).forEach((deviceKind) => {
      let devices = this._availableDevices[deviceKind].slice(0);
      devices.sort((a, b) => {
        return (a.displayOrder || 0) - (b.displayOrder || 0);
      });
      if (!data[deviceKind]) {
        data[deviceKind] = {};
      }
      data[deviceKind].devices = devices;
    });

    return data;
  }

  /** Helper functions */

  async _changeOutputDevice(preferedDevice) {
    return this._outputAudio.element.setSinkId(preferedDevice.id).then(() => {
      this._availableDevices[preferedDevice.deviceKind].forEach(
        (availableDevice) => {
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
    return this._mediaStreamPromise.then((mediaStream) => {
      let trackKind = this._deviceKindtoTrackKind(deviceKind);

      mediaStream.getTracks().forEach((track) => {
        if (!trackKind || track.kind == trackKind) {
          let trackParameters = this._trackParameters(mediaStream, track);

          track.enabled = false;

          this._emit(track.kind + ".input.muted", this, trackParameters);
        }
      });

      return mediaStream;
    });
  }

  _unmuteInput(deviceKind = null) {
    return this._mediaStreamPromise.then((mediaStream) => {
      let trackKind = this._deviceKindtoTrackKind(deviceKind);

      mediaStream.getTracks().forEach((track) => {
        if (!trackKind || track.kind == trackKind) {
          let trackParameters = this._trackParameters(mediaStream, track);

          track.enabled = true;

          this._emit(track.kind + ".input.unmuted", this, trackParameters);
        }
      });

      return mediaStream;
    });
  }

  _toggleMuteInput(deviceKind = null) {
    return this._mediaStreamPromise.then((mediaStream) => {
      let trackKind = this._deviceKindtoTrackKind(deviceKind);

      mediaStream.getTracks().forEach((track) => {
        if (!trackKind || track.kind == trackKind) {
          let trackParameters = this._trackParameters(mediaStream, track);

          track.enabled = !track.enabled;

          if (track.enabled) {
            this._emit(track.kind + ".input.unmuted", this, trackParameters);
          } else {
            this._emit(track.kind + ".input.muted", this, trackParameters);
          }
        }
      });

      return mediaStream;
    });
  }

  _stopAllInputs(deviceKind = null) {
    return this._mediaStreamPromise.then((mediaStream) => {
      let trackKind = this._deviceKindtoTrackKind(deviceKind);

      mediaStream.getTracks().forEach((track) => {
        if (!trackKind || track.kind == trackKind) {
          this._removeTrack(mediaStream, track, false);
        }
      });

      return mediaStream;
    });
  }

  _changeInputDevice(preferedDevice) {
    return this._mediaStreamPromise.then((mediaStream) => {
      let trackKind = preferedDevice.trackKind;
      let trackConstraints = this._createConstraints(preferedDevice)[trackKind];
      let previousTrack = mediaStream.getTracks().find((track) => {
        return track.kind == preferedDevice.trackKind;
      });
      let previousTrackParameters = this._trackParameters(
        mediaStream,
        previousTrack
      );
      let mutedInputs = [];

      if (previousTrack) {
        mutedInputs = previousTrack.enabled ? [] : [previousTrack.kind];
        this._removeTrack(mediaStream, previousTrack);
      }

      if (trackConstraints) {
        let constraints = {};
        constraints[trackKind] = trackConstraints;
        return this._startInputStreams(constraints, mutedInputs).then(() => {
          let newTrack = mediaStream.getTracks().find((track) => {
            return track.kind == trackKind && track.readyState == "live";
          });

          if (!this._inputActive && !this._previewActive) {
            this._stopAllInputs();
          }

          if (newTrack) {
            this._emit(
              trackKind + ".input.changed",
              this,
              this._trackParameters(mediaStream, newTrack),
              previousTrackParameters
            );
          }
        });
      } else {
        if (trackKind == "audio" && this._inputAudio.sourceStream) {
          this._inputAudio.sourceStream.disconnect();
          this._inputAudio.sourceStream = null;
        }
        this._availableDevices[preferedDevice.deviceKind].forEach(
          (availableDevice) => {
            if (availableDevice.id == "none") {
              availableDevice.active = true;
            } else {
              availableDevice.active = false;
            }
          }
        );
        this._emit(
          trackKind + ".input.changed",
          this,
          null,
          previousTrackParameters
        );
      }
    });
  }

  _startInputStreams(constraints = null, mutedInputs = []) {
    if (!constraints) {
      constraints = this._createConstraints();
    }

    return this._mediaStreamPromise.then((mediaStream) => {
      mediaStream.getTracks().forEach((track) => {
        if (track.readyState == "live") {
          delete constraints[track.kind];
        } else {
          this._removeTrack(mediaStream, track);
        }
      });

      if (Object.keys(constraints).length == 0) {
        return Promise.resolve(mediaStream);
      }

      return this._shimGetUserMedia(constraints)
        .then((otherMediaStream) => {
          otherMediaStream.getTracks().forEach((track) => {
            let startMuted = mutedInputs.indexOf(track.kind) >= 0;
            track.enabled = !startMuted;
            this._addTrack(mediaStream, track);
          });

          return mediaStream;
        })
        .then((mediaStream) => {
          this._updateInputChain(mediaStream);
          return mediaStream;
        })
        .catch((error) => {
          this._emit("getUserMedia.error", this, error);
        });
    });
  }

  _updateInputChain(mediaStream) {
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
  }

  _createConstraints(...preferedDevices) {
    var constraints = {
      audio: this._config.audioinput.constraints || {},
      video: this._config.videoinput.constraints || {},
    };
    var preferedAudioDevice = this._availableDevices["audioinput"].find(
      (availableAudioDevice) => {
        return availableAudioDevice.active && availableAudioDevice.connected;
      }
    );
    var preferedVideoDevice = this._availableDevices["videoinput"].find(
      (availableVideoDevice) => {
        return availableVideoDevice.active && availableVideoDevice.connected;
      }
    );

    preferedDevices.forEach((preferedDevice) => {
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

  /** MediaStream Helpers */

  _addTrack(mediaStream, track) {
    var trackParameters = this._trackParameters(mediaStream, track);

    mediaStream.addTrack(track);

    this._availableDevices[trackParameters.deviceKind].forEach(
      (availableDevice) => {
        if (availableDevice.id == trackParameters.settings.deviceId) {
          Object.assign(availableDevice, trackParameters, { active: true });
        } else {
          availableDevice.active = false;
        }
      }
    );

    this._emit(track.kind + ".input.started", this, trackParameters);

    if (track.enabled) {
      this._emit(track.kind + ".input.unmuted", this, trackParameters);
    } else {
      this._emit(track.kind + ".input.muted", this, trackParameters);
    }
  }

  _removeTrack(mediaStream, track, updateActive = true) {
    var trackParameters = this._trackParameters(mediaStream, track);

    track.enabled = false;
    track.stop();

    mediaStream.removeTrack(track);

    if (updateActive) {
      this._availableDevices[trackParameters.deviceKind].forEach(
        (availableDevice) => {
          if (availableDevice.id == trackParameters.settings.deviceId) {
            Object.assign(availableDevice, trackParameters, { active: false });
          } else if (availableDevice.id == "none") {
            availableDevice.active = true;
          } else {
            availableDevice.active = false;
          }
        }
      );
    }

    this._emit(track.kind + ".input.stopped", this, trackParameters);
  }

  _trackParameters(mediaStream, track) {
    if (!mediaStream || !track) {
      return;
    }

    if (typeof track.getCapabilities != "function") {
      track.getCapabilities = () => {};
    }

    return {
      trackKind: track.kind,
      active: track.readyState == "live",
      deviceKind: this._trackKindtoDeviceKind(track.kind),
      settings: track.getSettings(),
      constraints: track.getConstraints(),
      capabilities: track.getCapabilities(),
      track: track,
      mediaStream: mediaStream,
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

  _audioProcessCallback(previewAudioMeter, audioInputPreviews) {
    return () => {
      let width = previewAudioMeter.volume * 100 + "%";
      audioInputPreviews.forEach((element) => {
        element.style.width = width;
      });
    };
  }

  _createMediaStreamSource(mediaStream) {
    let track = mediaStream.getTracks().find((track) => {
      return track.kind == "audio";
    });
    if (track) {
      return this._audioContext.createMediaStreamSource(mediaStream);
    }
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

  /** Device Helpers */

  _findAvailableDevice(deviceKind, deviceId) {
    return this._availableDevices[deviceKind].find((availableDevice) => {
      return availableDevice.id == deviceId;
    });
  }

  _forEachAvailableDevice(callbackfn) {
    Object.keys(this._availableDevices).forEach((deviceKind) => {
      this._availableDevices[deviceKind].forEach(callbackfn);
    });
  }

  _sortAvailableDevices() {
    Object.keys(this._availableDevices).forEach((deviceKind) => {
      this._availableDevices[deviceKind].sort((a, b) => {
        return (b.preference || 0) - (a.preference || 0);
      });
    });
  }

  _importInputDevices(devices) {
    devices.forEach((device) => {
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
      connected: true,
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
    return navigator.mediaDevices.getUserMedia(constraints);
  }
}
