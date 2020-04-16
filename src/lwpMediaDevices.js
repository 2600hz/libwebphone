"use strict";

import { merge, audioEvents } from "./lwpUtils";
import lwpRenderer from "./lwpRenderer";
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
    this._initAvailableDevices();
    this._initEventBindings();
    this._initRenderTargets();
    this._emit("created", this);
    return this;
  }

  startOutputAudio() {
    let element = this._config.audiooutput.mediaElement.element;
    if (element.paused && element.srcObject) {
      element.play();
    }
  }

  startStreams() {
    let mediaPreviews = this._libwebphone.getMediaPreviews();
    if (mediaPreviews) {
      mediaPreviews.stopPreviews();
    }

    let startMuted = [];
    Object.keys(this._config).forEach((category) => {
      if (this._config[category].startMuted) {
        startMuted.push(this._deviceKindtoTrackKind(category));
      }
    });

    return this._startInputStreams(null, startMuted).then((mediaStream) => {
      this._inputActive = true;

      this.startOutputAudio();

      this._emit("streams.started", this, mediaStream);
      return mediaStream;
    });
  }

  stopStreams() {
    let mediaPreviews = this._libwebphone.getMediaPreviews();
    if (!mediaPreviews || !mediaPreviews.previewActive()) {
      this._stopAllInputs();
    }

    this._inputActive = false;
    this._emit("streams.stop", this);
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

  getAudioOutputElement() {
    return this._config.audiooutput.mediaElement.element;
  }

  getAudioInputElement() {
    return this._config.audioinput.mediaElement.element;
  }

  getVideoInputElement() {
    return this._config.videoinput.mediaElement.element;
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
    });
  }

  /** Init functions */

  _initInternationalization(config) {
    let defaults = {
      en: {
        none: "None",
        audiooutput: "Speaker",
        audioinput: "Microphone",
        videoinput: "Camera",
        loading: "Finding media devices...",
      },
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("mediaDevices", resourceBundles);
  }

  _initProperties(config) {
    let defaults = {
      audiooutput: {
        show: "sinkId" in HTMLMediaElement.prototype,
        startMuted: false,
        preferedDeviceIds: [],
        mediaElement: {
          elementId: null,
          element: null,
        },
      },
      audioinput: {
        enabled: true,
        show: true,
        startMuted: false,
        constraints: {},
        preferedDeviceIds: [],
        mediaElement: {
          elementId: null,
          element: null,
        },
      },
      videoinput: {
        enabled: true,
        show: true,
        startMuted: true,
        constraints: {},
        preferedDeviceIds: [],
        mediaElement: {
          elementId: null,
          element: null,
        },
      },
      renderTargets: [],
      detectDeviceChanges: true,
      startPreview: false,
      startStreams: false,
    };
    this._config = merge(defaults, config);

    this._loaded = false;

    this._changeStreamMutex = new Mutex();

    this._inputActive = false;

    this._availableDevices = {};

    this._deviceKinds().forEach((deviceKind) => {
      if (
        !this._config[deviceKind].mediaElement.element &&
        this._config[deviceKind].mediaElement.elementId
      ) {
        this._config[deviceKind].mediaElement.element = document.getElementById(
          this._config[deviceKind].mediaElement.elementId
        );
      }

      if (!this._config[deviceKind].mediaElement.element) {
        this._config[deviceKind].mediaElement.element = document.createElement(
          this._deviceKindtoTrackKind(deviceKind)
        );
      }

      this._config[deviceKind].mediaElement.element.muted = true;

      audioEvents().forEach((eventName) => {
        this._config[deviceKind].mediaElement.element.addEventListener(
          eventName,
          (event) => {
            console.log(deviceKind, eventName, event);
          }
        );
      });

      // NOTE: it makes more sense if configured with highest priority to
      //   lowest, but we use the index number to represent that so flip it
      this._config[deviceKind].preferedDeviceIds.reverse();

      this._availableDevices[deviceKind] = [];
    });

    this._availableDevices.videoinput = [
      this._deviceParameters({
        deviceId: "none",
        label: "libwebphone:mediaDevices.none",
        kind: "videoinput",
        displayOrder: 0,
      }),
    ];
  }

  _initInputStreams() {
    let constraints = {
      audio: this._config["audioinput"].enabled,
      video: this._config["videoinput"].enabled,
    };

    this._mediaStreamPromise = this._shimGetUserMedia(constraints)
      .then((mediaStream) => {
        this._updateMediaElements(mediaStream);
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
    let callList = this._libwebphone.getCallList();

    if (callList) {
      this._libwebphone.on(
        "callList.calls.switched",
        (lwp, callList, newCall) => {
          if (!newCall) {
            this.stopStreams();
          }
        }
      );
    } else {
      this._libwebphone.on("call.terminated", () => {
        this.stopStreams();
      });
    }

    this._libwebphone.on("audioMixer.audio.context.started", () => {
      this.startOutputAudio();
    });

    if (this._config.detectDeviceChanges) {
      navigator.mediaDevices.ondevicechange = (event) => {
        this.refreshAvailableDevices();
      };
    }

    this._libwebphone.on("mediaDevices.streams.started", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.streams.stop", () => {
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
        audioinput: "libwebphone:mediaDevices.audioinput",
        videoinput: "libwebphone:mediaDevices.videoinput",
        loading: "libwebphone:mediaDevices.loading",
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
            {{/data.audiooutput.show}}

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
              </div>
            {{/data.audioinput.show}}

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

  _renderData(data = {}) {
    data.loaded = this._loaded;
    data.active = this._inputActive;

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
    return this._config.audiooutput.mediaElement.element
      .setSinkId(preferedDevice.id)
      .then(() => {
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

          if (!this._inputActive) {
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
        let audioMixer = this._libwebphone.getAudioMixer();
        if (audioMixer) {
          /*
                  let audioTrack = mediaStream.getTracks().find((track) => {
          return track.kind == "audio" && track.readyState == "live";
        });
        if (this._inputAudio.sourceStream) {
          this._inputAudio.sourceStream.disconnect();
          this._inputAudio.sourceStream = null;
        } */
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
          this._updateMediaElements(mediaStream);
          return mediaStream;
        })
        .catch((error) => {
          this._emit("getUserMedia.error", this, error);
        });
    });
  }

  _updateMediaElements(mediaStream) {
    this._trackKinds().forEach((trackKind) => {
      let deviceKind = this._trackKindtoDeviceKind(trackKind);
      let element = this._config[deviceKind].mediaElement.element;
      let track = mediaStream.getTracks().find((track) => {
        return track.kind == trackKind;
      });

      if (track) {
        if (!element.srcObject || element.srcObject.id != mediaStream.id) {
          element.srcObject = mediaStream;
        }

        if (element.paused) {
          audioElement.play();
        }
      } else {
        if (!element.paused) {
          element.pause();
        }
        element.srcObject = null;
      }
    });
  }

  _createConstraints(...preferedDevices) {
    let constraints = {
      audio: this._config.audioinput.constraints || {},
      video: this._config.videoinput.constraints || {},
    };
    let preferedAudioDevice = this._availableDevices["audioinput"].find(
      (availableAudioDevice) => {
        return availableAudioDevice.active && availableAudioDevice.connected;
      }
    );
    let preferedVideoDevice = this._availableDevices["videoinput"].find(
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

  /** MediaStream Helpers */

  _addTrack(mediaStream, track) {
    let trackParameters = this._trackParameters(mediaStream, track);

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
    let trackParameters = this._trackParameters(mediaStream, track);

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

  _trackKinds() {
    return ["audio", "video"];
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

  _deviceKinds() {
    return ["audiooutput", "audioinput", "videoinput"];
  }

  /** Shims */

  _shimEnumerateDevices() {
    return navigator.mediaDevices.enumerateDevices();
  }

  _shimGetUserMedia(constraints) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }
}
