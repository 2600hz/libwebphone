"use strict";

import lwpUtils from "./lwpUtils";
import lwpRenderer from "./lwpRenderer";
import { Mutex } from "async-mutex";
// eslint-disable-next-line no-unused-vars
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

  startStreams(requestId = null) {
    this._startMediaElements();

    if (this._inputActive) {
      return this._mediaStreamPromise.then((mediaStream) => {
        return this._createCallStream(mediaStream, requestId);
      });
    }

    return this._startInputStreams().then((mediaStream) => {
      this._inputActive = true;

      this._emit("streams.started", this, mediaStream);

      return this._createCallStream(mediaStream, requestId);
    });
  }

  stopStreams(requestId = null) {
    if (!requestId) {
      requestId = null;
    }

    const requestIndex = this._startedStreams.findIndex((request) => {
      return request.id == requestId;
    });

    if (requestIndex != -1) {
      this._startedStreams.splice(requestIndex, 1).forEach((request) => {
        if (request.mediaStream) {
          request.mediaStream.getTracks().forEach((track) => {
            track.enabled = false;
            track.stop();
          });
        }
      });
    }

    if (this._startedStreams.length == 0) {
      this.stopAllStreams();
    }
  }

  stopAllStreams() {
    this._startedStreams.forEach((request) => {
      if (request.mediaStream) {
        request.mediaStream.getTracks().forEach((track) => {
          track.enabled = false;
          track.stop();
        });
      }
    });
    this._startedStreams = [];

    return this._mediaStreamPromise.then((mediaStream) => {
      mediaStream.getTracks().forEach((track) => {
        this._removeTrack(mediaStream, track, false);
      });

      this._inputActive = false;
      this._emit("streams.stopped", this);
    });
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
        return this._toggleMuteOutput(deviceKind);
      default:
        return this._toggleMuteInput(deviceKind);
    }
  }

  /**
   * Start Screen Capture.
   * Screen Capture acts as a new videoinput device,
   * meaning that if you switch calls when screensharing
   * the new call will also be screensharing if video is unmuted.
   * @param {DisplayMediaStreamConstraints} [options] The source for screen capture.
   * @param {boolean} [useDisplayMedia] Use mediaDevices.getDisplayMedia over mediaDevices.getUserMedia
   */
  async startScreenCapture(options = {}, useDisplayMedia = true) {
    try {
      this._captureStream = useDisplayMedia
        ? await navigator.mediaDevices.getDisplayMedia(options)
        : await navigator.mediaDevices.getUserMedia(options);

      this._addScreenCaptureEventListeners();
      this._emit("screenCapture.started", this, this._captureStream);

      this._mediaStreamPromise.then((mediaStream) => {
        this._captureStream.getVideoTracks().forEach((track) => {
          const trackInformation = lwpUtils.trackParameters(mediaStream, track);
          this._emit("video.input.changed", this, trackInformation);
        });
      });
    } catch (error) {
      this._emit("screenCapture.error", this, error);
    }
  }

  /**
   * Stops Screen Capture and enables previously selected videoinput
   */
  stopScreenCapture() {
    if (!this._captureStream) {
      return;
    }

    const currentVideoDevice = this._availableDevices.videoinput.find(
      (device) => device.selected === true
    );

    this._captureStream.getTracks().forEach((track) => track.stop());
    this._captureStream = null;
    this.changeDevice("videoinput", currentVideoDevice.id);
    this._emit("screenCapture.stopped", this);
  }

  getMediaElement(deviceKind) {
    if (
      this._config[deviceKind] &&
      this._config[deviceKind].mediaElement.element
    ) {
      return this._config[deviceKind].mediaElement.element;
    }
  }

  getPreferedDevice(deviceKind) {
    return this._availableDevices[deviceKind].find((device) => {
      return device.selected;
    });
  }

  async changeDevice(deviceKind, deviceId) {
    const preferedDevice = this._findAvailableDevice(deviceKind, deviceId);

    if (!preferedDevice || !preferedDevice.connected) {
      // TODO: create a meaningful return/error
      return Promise.reject();
    }

    const release = await this._changeStreamMutex.acquire();
    this._preferDevice(preferedDevice);
    switch (deviceKind) {
      case "ringoutput":
        return this._changeRingOutputDevice(preferedDevice).then(() => {
          release();
        });
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
    return this._shimEnumerateDevices()
      .then(async (devices) => {
        const release = await this._changeStreamMutex.acquire();
        const alteredTrackKinds = [];

        // NOTE: assume all devices are disconnected then transition
        //  each back to connected if enumerated
        this._forEachAvailableDevice((availableDevice) => {
          if (availableDevice.id != "none") {
            availableDevice.connected = false;
          }
        });

        this._importInputDevices(devices);

        Object.keys(this._availableDevices).forEach((deviceKind) => {
          const selectedDevice = this._availableDevices[deviceKind].find(
            (availableDevice) => {
              return availableDevice.selected;
            }
          );
          const preferedDevice = this._availableDevices[deviceKind].find(
            (availableDevice) => {
              return availableDevice.connected && availableDevice.id != "none";
            }
          );
          const switchToPrefered =
            selectedDevice &&
            preferedDevice &&
            selectedDevice.preference < preferedDevice.preference;
          const selectedDeviceDisconnected =
            selectedDevice && !selectedDevice.connected;

          if (switchToPrefered || selectedDeviceDisconnected) {
            selectedDevice.selected = false;
            alteredTrackKinds.push(selectedDevice.trackKind);

            if (preferedDevice) {
              preferedDevice.selected = true;
            }
          }
        });

        return this._mediaStreamPromise.then((mediaStream) => {
          const constraints = this._createConstraints();
          const alteredConstraints = {};

          mediaStream.getTracks().forEach((track) => {
            const trackParameters = lwpUtils.trackParameters(
              mediaStream,
              track
            );
            const deviceKind = lwpUtils.trackKindtoDeviceKind(track.kind);
            const selectedDevice = this._availableDevices[deviceKind].find(
              (availableDevice) => {
                return availableDevice.selected;
              }
            );

            if (selectedDevice) {
              const differentId =
                selectedDevice.id != trackParameters.settings.deviceId;
              const differentLabel = selectedDevice.label != track.label;
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

          return this._startInputStreams(alteredConstraints);
        });
      })
      .then(() => {
        this._sortAvailableDevices();
        this._emit("devices.refreshed", this, this._availableDevices);
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
    const defaults = {
      en: {
        none: "None",
        screenCapture: "Screen Capture",
        ringoutput: "Ringing Device",
        audiooutput: "Speaker",
        audioinput: "Microphone",
        videoinput: "Camera",
        loading: "Finding media devices...",
      },
    };
    const resourceBundles = lwpUtils.merge(
      defaults,
      config.resourceBundles || {}
    );
    this._libwebphone.i18nAddResourceBundles("mediaDevices", resourceBundles);
  }

  _initProperties(config) {
    const defaults = {
      ringoutput: {
        enabled: "sinkId" in HTMLMediaElement.prototype,
        show: true,
        preferedDeviceIds: [],
        mediaElement: {
          create: true,
          elementId: null,
          element: null,
          initParameters: {
            muted: false,
          },
        },
      },
      audiooutput: {
        enabled: "sinkId" in HTMLMediaElement.prototype,
        show: true,
        preferedDeviceIds: [],
        mediaElement: {
          create: true,
          elementId: null,
          element: null,
          initParameters: {
            muted: false,
          },
        },
      },
      audioinput: {
        enabled: true,
        show: true,
        constraints: {},
        preferedDeviceIds: [],
        mediaElement: {
          create: false,
          elementId: null,
          element: null,
          initParameters: {
            muted: true,
          },
        },
      },
      videoinput: {
        enabled: true,
        show: true,
        constraints: {},
        preferedDeviceIds: [],
        screenCapture: false,
        mediaElement: {
          create: false,
          elementId: null,
          element: null,
          initParameters: {
            muted: true,
          },
        },
      },
      renderTargets: [],
      detectDeviceChanges: true,
      manageMediaElements: true,
    };
    this._config = lwpUtils.merge(defaults, config);

    this._loaded = false;

    this._changeStreamMutex = new Mutex();

    this._inputActive = false;

    this._startedStreams = [];

    this._availableDevices = {};

    this._captureStream = null;

    this._deviceKinds().forEach((deviceKind) => {
      if (
        !this._config[deviceKind].mediaElement.element &&
        this._config[deviceKind].mediaElement.elementId
      ) {
        this._config[deviceKind].mediaElement.element = document.getElementById(
          this._config[deviceKind].mediaElement.elementId
        );
      }

      if (
        !this._config[deviceKind].mediaElement.element &&
        this._config[deviceKind].mediaElement.create &&
        this._config[deviceKind].enabled
      ) {
        if (["audiooutput", "ringoutput"].includes(deviceKind)) {
          this._config[deviceKind].mediaElement.element = new Audio();
        } else {
          this._config[deviceKind].mediaElement.element =
            document.createElement(this._deviceKindtoTrackKind(deviceKind));
        }
      }

      if (this._config[deviceKind].mediaElement.element) {
        lwpUtils.mediaElementEvents().forEach((eventName) => {
          this._config[deviceKind].mediaElement.element.addEventListener(
            eventName,
            (event) => {
              this._emit(
                this._deviceKindtoEventKind(deviceKind) + "." + eventName,
                this,
                this._config[deviceKind].mediaElement.element,
                event
              );
            }
          );
        });

        this._config[deviceKind].mediaElement.element.preload = "none";

        if (this._config.manageMediaElements) {
          Object.keys(
            this._config[deviceKind].mediaElement.initParameters
          ).forEach((parameterName) => {
            this._config[deviceKind].mediaElement.element[parameterName] =
              this._config[deviceKind].mediaElement.initParameters[
                parameterName
              ];
          });
        }
      }

      if (this._config[deviceKind].mediaElement.element) {
        this._emit(
          this._deviceKindtoEventKind(deviceKind) + ".element",
          this,
          this._config[deviceKind].mediaElement.element
        );
      }

      this._availableDevices[deviceKind] = [];

      this._config[deviceKind].show =
        this._config[deviceKind].enabled && this._config[deviceKind].show;
    });

    this._availableDevices.videoinput = [
      this._deviceParameters({
        deviceId: "none",
        label: "libwebphone:mediaDevices.none",
        kind: "videoinput",
        displayOrder: 0,
      }),
      // Add screenCapture device if screenCapture is enabled in config
      ...(this._config.videoinput.screenCapture
        ? [
            this._deviceParameters({
              deviceId: "screenCapture",
              label: "libwebphone:mediaDevices.screenCapture",
              kind: "videoinput",
              displayOrder: 1,
            }),
          ]
        : []),
    ];
  }

  _initInputStreams() {
    const constraints = {
      audio: this._config["audioinput"].enabled,
      video: this._config["videoinput"].enabled,
    };

    if (
      constraints.audio &&
      this._config.audioinput.preferedDeviceIds.length > 0
    ) {
      constraints.audio = {};
      constraints.audio.deviceId = this._config.audioinput.preferedDeviceIds;
    }

    if (
      constraints.video &&
      this._config.videoinput.preferedDeviceIds.length > 0
    ) {
      constraints.video = {};
      constraints.video.deviceId = this._config.videoinput.preferedDeviceIds;
    }

    this._mediaStreamPromise = this._shimGetUserMedia(constraints)
      .then((mediaStream) => {
        this._updateMediaElements(mediaStream);
        return mediaStream;
      })
      .catch((error) => {
        this._emit("getUserMedia.error", this, error);
        if (constraints.video && constraints.audio) {
          delete constraints.video;
          return this._shimGetUserMedia(constraints).then((mediaStream) => {
            this._updateMediaElements(mediaStream);
            return mediaStream;
          });
        }
      });

    return this._mediaStreamPromise;
  }

  _initAvailableDevices() {
    this._mediaStreamPromise.then((mediaStream) => {
      this._shimEnumerateDevices().then((devices) => {
        this._importInputDevices(devices);
        mediaStream.getTracks().forEach((track) => {
          this._addTrack(mediaStream, track);
          this._removeTrack(mediaStream, track, false);
        });

        this._sortAvailableDevices();

        Object.keys(this._availableDevices).forEach((deviceKind) => {
          const selectedDevice = this._availableDevices[deviceKind].find(
            (availableDevice) => {
              return availableDevice.selected;
            }
          );

          if (!selectedDevice) {
            const availableDevice = this._availableDevices[deviceKind][0];
            if (availableDevice) {
              availableDevice.selected = true;
            }
          }
        });

        this._loaded = true;
        this._emit("devices.loaded", this, this._availableDevices);
        this.updateRenders();
      });
    });
  }

  _initEventBindings() {
    this._libwebphone.on("call.terminated", (lwp, call) => {
      this.stopStreams(call.getId());
    });

    if (this._config.detectDeviceChanges) {
      navigator.mediaDevices.addEventListener("devicechange", () => {
        this.refreshAvailableDevices();
      });
    }

    this._libwebphone.on("audioContext.preview.loopback.started", () => {
      this.startStreams("loopbackPreview");
    });
    this._libwebphone.on("audioContext.preview.loopback.stopped", () => {
      this.stopStreams("loopbackPreview");
    });
    this._libwebphone.on("audioContext.started", () => {
      this._startMediaElements();
    });

    this._libwebphone.on("mediaDevices.streams.started", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.streams.stop", () => {
      this.updateRenders();
    });
    this._libwebphone.on("mediaDevices.ring.output.changed", () => {
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
        screenCapture: "libwebphone:mediaDevices.screenCapture",
        ringoutput: "libwebphone:mediaDevices.ringoutput",
        audiooutput: "libwebphone:mediaDevices.audiooutput",
        audioinput: "libwebphone:mediaDevices.audioinput",
        videoinput: "libwebphone:mediaDevices.videoinput",
        loading: "libwebphone:mediaDevices.loading",
      },
      by_id: {
        ringoutput: {
          events: {
            onchange: (event) => {
              const element = event.srcElement;
              if (element.options) {
                const deviceId = element.options[element.selectedIndex].value;
                this.changeDevice("ringoutput", deviceId);
              }
            },
          },
        },
        audiooutput: {
          events: {
            onchange: (event) => {
              const element = event.srcElement;
              if (element.options) {
                const deviceId = element.options[element.selectedIndex].value;
                this.changeDevice("audiooutput", deviceId);
              }
            },
          },
        },
        audioinput: {
          events: {
            onchange: (event) => {
              const element = event.srcElement;
              if (element.options) {
                const deviceId = element.options[element.selectedIndex].value;
                this.changeDevice("audioinput", deviceId);
              }
            },
          },
        },
        videoinput: {
          events: {
            onchange: (event) => {
              const element = event.srcElement;
              if (element.options) {
                const deviceId = element.options[element.selectedIndex].value;
                this.changeDevice("videoinput", deviceId);
              }
            },
          },
        },
      },
      data: lwpUtils.merge({}, this._config, this._renderData()),
    };
  }

  _renderDefaultTemplate() {
    // TODO: render advanced settings from capabilities
    return `
        <div>
          {{#data.loaded}}
            {{#data.ringoutput.show}}
              <div>
                <label for="{{by_id.ringoutput.elementId}}">
                  {{i18n.ringoutput}}
                </label>
                <select id="{{by_id.ringoutput.elementId}}">
                  {{#data.ringoutput.devices}}
                    {{#connected}}
                      <option value="{{id}}" {{#selected}}selected{{/selected}}>{{name}}</option>
                    {{/connected}}
                  {{/data.ringoutput.devices}}
                </select>
              </div>
            {{/data.ringoutput.show}}
            
            {{#data.audiooutput.show}}
              <div>
                <label for="{{by_id.audiooutput.elementId}}">
                  {{i18n.audiooutput}}
                </label>
                <select id="{{by_id.audiooutput.elementId}}">
                  {{#data.audiooutput.devices}}
                    {{#connected}}
                      <option value="{{id}}" {{#selected}}selected{{/selected}}>{{name}}</option>
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
                      <option value="{{id}}" {{#selected}}selected{{/selected}}>{{name}}</option>
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
                        <option value="{{id}}" {{#selected}}selected{{/selected}}>{{name}}</option>
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

    Object.keys(this._availableDevices).forEach((deviceKind) => {
      const devices = this._availableDevices[deviceKind].slice(0);
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

  async _changeRingOutputDevice(preferedDevice) {
    if (this._config.ringoutput.mediaElement.element) {
      return this._config.ringoutput.mediaElement.element
        .setSinkId(preferedDevice.id)
        .then(() => {
          this._availableDevices["ringoutput"].forEach((availableDevice) => {
            if (availableDevice.id == preferedDevice.id) {
              availableDevice.selected = true;
            } else {
              availableDevice.selected = false;
            }
          });

          if (this._config.ringoutput.enabled) {
            this._emit("ring.output.changed", this, preferedDevice);
          }
        })
        .catch((error) => {
          this._emit("ring.output.error", error);
        });
    } else {
      this._availableDevices["ringoutput"].forEach((availableDevice) => {
        if (availableDevice.id == preferedDevice.id) {
          availableDevice.selected = true;
        } else {
          availableDevice.selected = false;
        }
      });

      if (this._config.ringoutput.enabled) {
        this._emit("ring.output.changed", this, preferedDevice);
      }

      return Promise.resolve();
    }
  }

  async _changeOutputDevice(preferedDevice) {
    if (this._config.audiooutput.mediaElement.element) {
      return this._config.audiooutput.mediaElement.element
        .setSinkId(preferedDevice.id)
        .then(() => {
          this._availableDevices[preferedDevice.deviceKind].forEach(
            (availableDevice) => {
              if (availableDevice.id == preferedDevice.id) {
                availableDevice.selected = true;
              } else {
                availableDevice.selected = false;
              }
            }
          );

          if (this._config.audiooutput.enabled) {
            this._emit("audio.output.changed", this, preferedDevice);
          }
        })
        .catch((error) => {
          this._emit("audio.output.error", error);
        });
    } else {
      this._availableDevices[preferedDevice.deviceKind].forEach(
        (availableDevice) => {
          if (availableDevice.id == preferedDevice.id) {
            availableDevice.selected = true;
          } else {
            availableDevice.selected = false;
          }
        }
      );

      if (this._config.audiooutput.enabled) {
        this._emit("audio.output.changed", this, preferedDevice);
      }

      return Promise.resolve();
    }
  }

  _muteInput(deviceKind = null) {
    return this._mediaStreamPromise.then((mediaStream) => {
      const trackKind = this._deviceKindtoTrackKind(deviceKind);

      mediaStream.getTracks().forEach((track) => {
        if (!trackKind || track.kind == trackKind) {
          const trackParameters = lwpUtils.trackParameters(mediaStream, track);

          track.enabled = false;

          this._emit(track.kind + ".input.muted", this, trackParameters);
        }
      });

      return mediaStream;
    });
  }

  _unmuteInput(deviceKind = null) {
    return this._mediaStreamPromise.then((mediaStream) => {
      const trackKind = this._deviceKindtoTrackKind(deviceKind);

      mediaStream.getTracks().forEach((track) => {
        if (!trackKind || track.kind == trackKind) {
          const trackParameters = lwpUtils.trackParameters(mediaStream, track);

          track.enabled = true;

          this._emit(track.kind + ".input.unmuted", this, trackParameters);
        }
      });

      return mediaStream;
    });
  }

  _toggleMuteInput(deviceKind = null) {
    return this._mediaStreamPromise.then((mediaStream) => {
      const trackKind = this._deviceKindtoTrackKind(deviceKind);

      mediaStream.getTracks().forEach((track) => {
        if (!trackKind || track.kind == trackKind) {
          const trackParameters = lwpUtils.trackParameters(mediaStream, track);

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

  _changeInputDevice(preferedDevice) {
    return this._mediaStreamPromise.then((mediaStream) => {
      let mutedInputs = [];

      const trackKind = preferedDevice.trackKind;
      const trackConstraints =
        this._createConstraints(preferedDevice)[trackKind];
      const previousTrack = mediaStream.getTracks().find((track) => {
        return track.kind == preferedDevice.trackKind;
      });
      const previousTrackParameters = lwpUtils.trackParameters(
        mediaStream,
        previousTrack
      );

      if (trackKind === "video" && preferedDevice.id === "screenCapture") {
        return this.startScreenCapture();
      }

      if (this._captureStream) {
        this.stopScreenCapture();
      }

      if (previousTrack) {
        mutedInputs = previousTrack.enabled ? [] : [previousTrack.kind];
        this._removeTrack(mediaStream, previousTrack);
      }

      if (trackKind === "video" && preferedDevice.id === "none") {
        // Disable video for all streams, do not replace track or media stream
        this._startedStreams.forEach((request) => {
          if (request.mediaStream) {
            request.mediaStream.getVideoTracks().forEach((track) => {
              track.enabled = false;
            });
          }
        });

        this._availableDevices[preferedDevice.deviceKind].forEach(
          (availableDevice) => {
            if (availableDevice.id === "none") {
              availableDevice.selected = true;
            } else {
              availableDevice.selected = false;
            }
          }
        );

        this._emit(
          trackKind + ".input.changed",
          this,
          null,
          previousTrackParameters
        );

        return;
      }

      if (trackConstraints) {
        const constraints = {};
        constraints[trackKind] = trackConstraints;
        return this._startInputStreams(constraints, mutedInputs).then(() => {
          const newTrack = mediaStream.getTracks().find((track) => {
            return track.kind == trackKind && track.readyState == "live";
          });

          if (this._startedStreams.length == 0) {
            this.stopAllStreams();
          }

          if (newTrack) {
            this._emit(
              trackKind + ".input.changed",
              this,
              lwpUtils.trackParameters(mediaStream, newTrack),
              previousTrackParameters
            );
          }
        });
      }
    });
  }

  _startInputStreams(constraints = null) {
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
          if (constraints.video && constraints.audio) {
            delete constraints.video;
            return this._shimGetUserMedia(constraints)
              .then((otherMediaStream) => {
                otherMediaStream.getTracks().forEach((track) => {
                  this._addTrack(mediaStream, track);
                });

                return mediaStream;
              })
              .then((mediaStream) => {
                this._updateMediaElements(mediaStream);
                return mediaStream;
              });
          }
        });
    });
  }

  _updateMediaElements(mediaStream) {
    lwpUtils.trackKinds().forEach((trackKind) => {
      const deviceKind = lwpUtils.trackKindtoDeviceKind(trackKind);
      const element = this._config[deviceKind].mediaElement.element;
      const track = mediaStream.getTracks().find((track) => {
        return track.kind == trackKind;
      });

      if (track) {
        if (
          element &&
          (!element.srcObject || element.srcObject.id != mediaStream.id)
        ) {
          element.srcObject = mediaStream;
        }

        if (this._config.manageMediaElements && element && element.paused) {
          // TODO: without the interaction history of my dev site, can we still
          //  issue a play this early?
          element.play().catch(() => {});
        }
      } else {
        if (this._config.manageMediaElements && element && !element.paused) {
          element.pause();
        }

        if (element) {
          element.srcObject = null;
        }
      }
    });
  }

  _createConstraints(...preferedDevices) {
    let preferedAudioDevice = this._availableDevices["audioinput"].find(
      (availableAudioDevice) => {
        return availableAudioDevice.selected && availableAudioDevice.connected;
      }
    );
    let preferedVideoDevice = this._availableDevices["videoinput"].find(
      (availableVideoDevice) => {
        return availableVideoDevice.selected && availableVideoDevice.connected;
      }
    );

    const constraints = {
      audio: this._config.audioinput.constraints || {},
      video: this._config.videoinput.constraints || {},
    };

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
      const preferedAudioConstraints = preferedAudioDevice.constraints || {};
      preferedAudioConstraints.deviceId = {};
      preferedAudioConstraints.deviceId.exact = preferedAudioDevice.id;
      constraints.audio = lwpUtils.merge(
        constraints.audio,
        preferedAudioConstraints
      );
    }

    if (preferedVideoDevice) {
      const preferedVideoConstraints = preferedVideoDevice.constraints || {};
      preferedVideoConstraints.deviceId = {};
      preferedVideoConstraints.deviceId.exact = preferedVideoDevice.id;
      constraints.video = lwpUtils.merge(
        constraints.video,
        preferedVideoConstraints
      );
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

  _preferDevice(preferedDevice, options = { sort: true, updateConfig: true }) {
    const maxPreference = this._availableDevices[
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

    if (options.sort) {
      this._sortAvailableDevices();
    }

    if (options.updateConfig && preferedDevice.id != "none") {
      const deviceKind = preferedDevice.deviceKind;
      const insertIndex = this._config[deviceKind].preferedDeviceIds.findIndex(
        (deviceId) => {
          const device = this._findAvailableDevice(deviceKind, deviceId);
          return deviceId != preferedDevice.id && device && device.connected;
        }
      );
      const removeIndex = this._config[deviceKind].preferedDeviceIds.indexOf(
        preferedDevice.id
      );

      if (removeIndex > -1) {
        this._config[deviceKind].preferedDeviceIds.splice(removeIndex, 1);
      }

      if (insertIndex == -1) {
        this._config[deviceKind].preferedDeviceIds.push(preferedDevice.id);
      } else {
        this._config[deviceKind].preferedDeviceIds.splice(
          insertIndex,
          0,
          preferedDevice.id
        );
      }
    }
  }

  _addScreenCaptureEventListeners() {
    this._captureStream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        this.stopScreenCapture();
      });
    });
  }

  _startMediaElements() {
    if (this._config.manageMediaElements) {
      this._deviceKinds().forEach((deviceKind) => {
        if (
          this._config[deviceKind].mediaElement.element &&
          this._config[deviceKind].mediaElement.element.paused
        ) {
          this._config[deviceKind].mediaElement.element.play();
        }
      });
    }
  }

  _createCallStream(mediaStream, requestId) {
    const newMediaStream = new MediaStream();

    /**
     * We need to clone the tracks here because
     * lwpCall will toggle track.enabled to mute
     * the call and if multiple calls share the
     * same track umuting the call you are on
     * unmutes you for all calls (possibly making
     * for a bad day...)
     *
     */
    mediaStream.getTracks().forEach((track) => {
      newMediaStream.addTrack(track.clone());
    });

    if (!requestId) {
      this._startedStreams.push({ id: null, mediaStream: newMediaStream });
    } else if (
      !this._startedStreams.find((request) => {
        return request.id == requestId;
      })
    ) {
      this._startedStreams.push({
        id: requestId,
        mediaStream: newMediaStream,
      });
    }

    return newMediaStream;
  }

  /** MediaStream Helpers */

  _addTrack(mediaStream, track) {
    const trackParameters = lwpUtils.trackParameters(mediaStream, track);

    mediaStream.addTrack(track);

    this._availableDevices[trackParameters.deviceKind].forEach(
      (availableDevice) => {
        if (availableDevice.id == trackParameters.settings.deviceId) {
          Object.assign(availableDevice, trackParameters, { selected: true });
        } else {
          availableDevice.selected = false;
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

  _removeTrack(mediaStream, track, updateSelected = true) {
    const trackParameters = lwpUtils.trackParameters(mediaStream, track);

    track.enabled = false;
    track.stop();

    mediaStream.removeTrack(track);

    if (updateSelected) {
      this._availableDevices[trackParameters.deviceKind].forEach(
        (availableDevice) => {
          if (availableDevice.id == trackParameters.settings.deviceId) {
            Object.assign(availableDevice, trackParameters, {
              selected: false,
            });
          } else if (availableDevice.id == "none") {
            availableDevice.selected = true;
          } else {
            availableDevice.selected = false;
          }
        }
      );
    }

    this._emit(track.kind + ".input.stopped", this, trackParameters);
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
      if (!device.deviceId || 0 === device.deviceId.length) {
        return;
      }

      const enumeratedDevice = this._deviceParameters(device);
      const availableDevice = this._findAvailableDevice(
        device.kind,
        device.deviceId
      );

      if (availableDevice) {
        Object.assign(availableDevice, enumeratedDevice);
      } else {
        if (!this._availableDevices[device.kind]) {
          this._availableDevices[device.kind] = [];
        }

        enumeratedDevice.displayOrder =
          this._availableDevices[device.kind].length;

        enumeratedDevice.preference =
          (this._config[device.kind].preferedDeviceIds || []).indexOf(
            enumeratedDevice.id
          ) + 1;

        this._availableDevices[device.kind].push(enumeratedDevice);
      }
    });
  }

  _deviceParameters(device) {
    return {
      id: device.deviceId,
      label: device.label,
      deviceKind: device.kind,
      name: this._getDeviceName(device),
      trackKind: this._deviceKindtoTrackKind(device.kind),
      connected: true,
      groupId: device.groupId,
    };
  }

  _getDeviceName(device) {
    const deviceKind = device.kind;
    const i18nKey = "libwebphone:mediaDevices." + deviceKind;
    return (
      device.label ||
      i18nKey + " " + (this._availableDevices[deviceKind].length + 1)
    );
  }

  _deviceKindtoTrackKind(deviceKind) {
    switch (deviceKind) {
      case "ringoutput":
      case "audiooutput":
      case "audioinput":
        return "audio";
      case "videoinput":
        return "video";
    }
  }

  _deviceKindtoEventKind(deviceKind) {
    switch (deviceKind) {
      case "ringoutput":
        return "ring.output";
      case "audiooutput":
        return "audio.output";
      case "audioinput":
        return "audio.input";
      case "videoinput":
        return "video.input";
    }
  }

  _deviceKinds() {
    return ["ringoutput", "audiooutput", "audioinput", "videoinput"];
  }

  /** Shims */

  async _shimEnumerateDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const ringoutputDevices = [];

    devices.forEach((device) => {
      if (device.kind !== "audiooutput") return;
      ringoutputDevices.push(this._outputDeviceToRingDevice(device));
    });

    return devices.concat(ringoutputDevices);
  }

  _outputDeviceToRingDevice(device) {
    return {
      deviceId: device.deviceId,
      groupId: device.groupId,
      kind: "ringoutput",
      label: device.label,
    };
  }

  _shimGetUserMedia(constraints) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }
}
