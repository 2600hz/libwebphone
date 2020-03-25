"use strict";

import { merge } from "./lwpUtils";
import lwpRenderer from "./lwpRenderer";
import Tone from "tone";
import AudioStreamMeter from "audio-stream-meter";
import { Mutex } from "async-mutex";
import adapter from "webrtc-adapter";

class lwpMediaDevices extends lwpRenderer {
  constructor(libwebphone, config = {}) {
    super(libwebphone);
    this._libwebphone = libwebphone;
    this._initProperties(config);
    this._initInternationalization(config.i18n || {});
    this._initInputStreams();
    this._initOutputStreams();
    this._initAvailableDevices();
    this._initEventBindings();
    this._initRenderTargets();
    if (this._config.startPreview) {
      this.startPreviews();
    } else {
      this.stopPreviews();
    }
    return this;
  }

  startPreviews(show = true) {
    this._previewActive = true;

    if (show) {
      this._renders.forEach(render => {
        Object.keys(render.by_id).forEach(deviceKind => {
          if (render.by_id[deviceKind].preview) {
            let preview = render.by_id[deviceKind];
            if (
              preview.element &&
              (!preview.element.style ||
                preview.element.style.display == "none")
            ) {
              preview.element.style.display = preview.displayValue || "block";
            }
          }
        });
      });
    }

    // TODO: ensure this._outputStreams is active and
    //   associated with the selected output

    this._startInputStreams();
  }

  stopPreviews(hide = true) {
    this._previewActive = false;

    if (hide) {
      this._renders.forEach(render => {
        Object.keys(render.by_id).forEach(deviceKind => {
          if (render.by_id[deviceKind].preview) {
            let preview = render.by_id[deviceKind];
            if (
              preview.element &&
              (!preview.element.style ||
                preview.element.style.display != "none")
            ) {
              preview.displayValue = preview.element.style.display || "block";
              preview.element.style.display = "none";
            }
          }
        });
      });
    }

    // TODO: stop all output sounds

    if (!this._inputActive) {
      this._stopAllInputs();
    }
  }

  startStreams() {
    this._inputActive = true;

    // TODO: ensure this._outputStreams is active and
    //   associated with the selected output

    let startMuted = [];
    Object.keys(this._config).forEach(category => {
      if (this._config[category].startMuted) {
        startMuted.push(this._deviceKindtoTrackKind(category));
      }
    });

    return this._startInputStreams(null, startMuted);
  }

  stopStreams() {
    this._inputActive = false;

    if (!this._previewActive) {
      this._stopAllInputs();
    }
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

  startPlayTone(tone) {
    console.log("start playing tone " + tone);
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
    let maxPreference = this._availableDevices[deviceKind].reduce(
      (max, availableDevice) => {
        if (
          (availableDevice.preference || 0) > max &&
          availableDevice.id != preferedDevice.id
        ) {
          return availableDevice.preference;
        }
        return max;
      },
      0
    );
    preferedDevice.preference = maxPreference + 1;

    this._sortAvailableDevices();

    switch (deviceKind) {
      case "audiooutput":
        this._changeOutputDevice(preferedDevice).then(() => {
          this.renderUpdates(render => this.updateRender(render));
          this.render();
          release();
        });
      default:
        return this._changeInputDevice(preferedDevice).then(() => {
          this.renderUpdates(render => this.updateRender(render));
          this.render();
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
        this.renderUpdates(render => this.updateRender(render));
        this.render();
      });
  }

  updateRender(render) {
    render.data.loaded = this._loaded;

    Object.keys(this._availableDevices).forEach(deviceKind => {
      let devices = this._availableDevices[deviceKind].slice(0);
      devices.sort((a, b) => {
        return a.displayOrder - b.displayOrder;
      });
      render.data[deviceKind].devices = devices;
    });

    this._mediaStreamPromise.then(mediaStream => {
      let audioTrack = mediaStream.getTracks().find(track => {
        return track.kind == "audio" && track.readyState == "live";
      });

      if (render.previewAudioMeter) {
        render.previewAudioMeter.close();
      }

      if (audioTrack) {
        let previewAudioContext = new AudioContext();
        let previewMediaStream = previewAudioContext.createMediaStreamSource(
          mediaStream
        );
        render.previewAudioMeter = AudioStreamMeter.audioStreamProcessor(
          previewAudioContext,
          () => {
            if (
              render.by_id.audioinputpreview &&
              render.by_id.audioinputpreview.element
            ) {
              let element = render.by_id.audioinputpreview.element.children[0];

              element.style.width = render.previewAudioMeter.volume * 100 + "%";
            }
          }
        );
        previewMediaStream.connect(render.previewAudioMeter);
      }
    });
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
        loading: "Finding media devices..."
      }
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("mediaDevices", resourceBundles);
  }

  _initProperties(config) {
    var defaults = {
      audiooutput: {
        enabled: "sinkId" in HTMLMediaElement.prototype,
        startMuted: false,
        preferedDeviceIds: [],
        livePreview: true
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
      startPreview: true,
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

    (this._loaded = false), (this._changeStreamMutex = new Mutex());
  }

  _initInputStreams() {
    let constraints = {
      audio: this._config["audioinput"].enabled,
      video: this._config["videoinput"].enabled
    };

    this._mediaStreamPromise = this._shimGetUserMedia(constraints);
    console.log("here 1.1", this._mediaStreamPromise);

    return this._mediaStreamPromise;
  }

  _initOutputStreams() {
    this._outputAudio = document.createElement("audio");
  }

  _initAvailableDevices() {
    this._mediaStreamPromise.then(mediaStream => {
      this._shimEnumerateDevices().then(devices => {
        console.log("here 1");
        this._importInputDevices(devices);
        console.log("here 2");
        this._sortAvailableDevices();
        console.log("here 3");
        mediaStream.getTracks().forEach(track => {
          console.log("here 4");
          let trackParameters = this._trackParameters(track);
          let deviceKind = trackParameters.deviceKind;
          let deviceId = trackParameters.settings.deviceId;
          let availableDevice = this._findAvailableDevice(deviceKind, deviceId);
          console.log("here 5");
          if (availableDevice) {
            Object.assign(availableDevice, trackParameters, { active: true });
          }
          console.log("here 6");
          if (!this._config.startPreview && !this._config.startStreams) {
            track.enabled = false;
            track.stop();
            mediaStream.removeTrack(track);
          }
        });

        console.log("here 7");
        Object.keys(this._availableDevices).forEach(deviceKind => {
          let activeDevice = this._availableDevices[deviceKind].find(
            availableDevice => {
              return availableDevice.active;
            }
          );
          console.log("here 8");
          if (!activeDevice) {
            let availableDevice = this._availableDevices[deviceKind][0];
            if (availableDevice) {
              availableDevice.active = true;
            }
          }
        });
        console.log("here 9");
        this._loaded = true;
        this.renderUpdates(render => this.updateRender(render));
        this.render();
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
        loading: "libwebphone:mediaDevices.loading"
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
        audiooutputpreview: {
          preview: "audiooutput",
          events: {
            onclick: event => {
              let synth = new Tone.Synth().toMaster();
              synth.triggerAttackRelease("C4", "8n");
            }
          }
        },
        audioinputpreview: {
          preview: "audioinput"
        },
        videoinputpreview: {
          preview: "videoinput"
        }
      },
      data: {
        loaded: this._loaded,
        audiooutput: this._config.audiooutput,
        audioinput: this._config.audioinput,
        videoinput: this._config.videoinput
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
                    {{#data.audiooutput.livePreview}}
                        <a id="{{by_id.audiooutputpreview.elementId}}" href="#">Test</a>
                    {{/data.audiooutput.livePreview}}
                </div>
            {{/data.audiooutput.enabled}}

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
                    {{#data.audioinput.livePreview}}
                        <div id="{{by_id.audioinputpreview.elementId}}" style="width:300px;height:10px;background-color: lightgray;margin: 10px 0px;">
                            <div style="height:10px; background-color: #00aeef;"></div>
                        </div>
                    {{/data.audioinput.livePreview}}                    
                </div>
            {{/data.audioinput.enabled}}

            {{#data.videoinput.enabled}}
                {{#data.videoinput.livePreview}}
                    <div>
                        <video id="{{videoinputpreview.elementId}}" width="{{videoinput.preference.settings.width}}" height="{{videoinput.preference.settings.height}}" autoplay muted></video>
                    </div>
                {{/data.videoinput.livePreview}}               
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

  _changeOutputDevice(deviceKind, deviceId) {
    // TODO: clean this up...
    this._availableDevices["audiooutput"].forEach(device => {
      if (device.id == deviceId) {
        device.prefered = true;
      } else {
        device.prefered = false;
      }
    });

    this._libwebphone._mediaDevicesEvent(
      "audio.output.changed",
      this,
      deviceId
    );
  }

  _muteInput(deviceKind = null) {
    return this._mediaStreamPromise.then(mediaStream => {
      let trackKind = this._deviceKindtoTrackKind(deviceKind);

      mediaStream.getTracks().forEach(track => {
        if (!trackKind || track.kind == trackKind) {
          track.enabled = false;
          this._libwebphone._mediaDevicesEvent(
            track.kind + ".input.muted",
            this,
            track
          );
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
          this._libwebphone._mediaDevicesEvent(
            track.kind + ".input.unmuted",
            this,
            track
          );
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
            this._libwebphone._mediaDevicesEvent(
              track.kind + ".input.unmuted",
              this,
              track
            );
          } else {
            this._libwebphone._mediaDevicesEvent(
              track.kind + ".input.muted",
              this,
              track
            );
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
      } else {
        this._availableDevices[preferedDevice.deviceKind].forEach(
          availableDevice => {
            if (availableDevice.id == preferedDevice.id) {
              availableDevice.active = true;
            } else {
              availableDevice.active = false;
            }
          }
        );
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

      this._libwebphone._mediaDevicesEvent(
        trackKind + ".input.changed",
        this,
        preferedDevice
      );
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
        return Promise.resolve().then(() => {
          return mediaStream;
        });
      }

      return this._shimGetUserMedia(constraints).then(otherMediaStream => {
        otherMediaStream.getTracks().forEach(track => {
          let startMuted = mutedInputs.indexOf(track.kind) >= 0;
          if (!this._inputActive && !this._previewActive) {
            startMuted = true;
          }
          track.enabled = !startMuted;
          this._addTrack(mediaStream, track);
        });

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

  /** MediaStream Helpers */

  _addTrack(mediaStream, track) {
    var trackParameters = this._trackParameters(track);

    mediaStream.addTrack(track);

    if (track.kind == "audio") {
      this._initAudioPreviewMeter();
    }

    this._availableDevices[trackParameters.deviceKind].forEach(
      availableDevice => {
        if (availableDevice.id == trackParameters.settings.deviceId) {
          Object.assign(availableDevice, trackParameters, { active: true });
        } else {
          availableDevice.active = false;
        }
      }
    );

    this._libwebphone._mediaDevicesEvent(
      track.kind + ".input.added",
      this,
      this._trackParameters(track)
    );

    if (track.enabled) {
      this._libwebphone._mediaDevicesEvent(
        track.kind + ".input.unmuted",
        this,
        track
      );
    } else {
      this._libwebphone._mediaDevicesEvent(
        track.kind + ".input.muted",
        this,
        track
      );
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

    this._libwebphone._mediaDevicesEvent(
      track.kind + ".input.removed",
      this,
      track
    );
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
        (enumeratedDevice.preference =
          (this._config[device.kind].preferedDeviceIds || []).indexOf(
            enumeratedDevice.id
          ) + 1),
          this._availableDevices[device.kind].push(enumeratedDevice);
      }
    });
  }

  _deviceParameters(device) {
    var deviceId = device.deviceId;
    var deviceKind = device.kind;
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
    var i18n = this._translator;
    var deviceKind = device.kind;
    var i18nKey = "libwebphone:mediaDevices." + deviceKind;
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
    console.log(constraints);
    return navigator.mediaDevices.getUserMedia(constraints).catch(error => {
      if (this._config.videoinput.enabled) {
        this._config.videoinput.enabled = false;
        delete constraints.video;
        console.log(error);
        console.log(constraints);
        return navigator.mediaDevices.getUserMedia(constraints);
      } else {
        throw error;
      }
    });
  }
}

export default lwpMediaDevices;
