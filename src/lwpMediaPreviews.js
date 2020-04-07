startPreviews() {
    if (this._inputActive) {
      return;
    }

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


  _initProperties(config) {
    var defaults = {
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