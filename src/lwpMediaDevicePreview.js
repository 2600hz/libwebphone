"use strict";

import EventEmitter from "events";
import { merge } from "./lwpUtils";
import AudioStreamMeter from "audio-stream-meter";

class lwpMediaDevices extends EventEmitter {
  constructor(libwebphone, config = {}, i18n = null) {
    super();
    this._libwebphone = libwebphone;
    this._initProperties(config);
    this._initInternationalization(config.i18n || {});
    this._initAudioPreviewMeter();
    this._initEventBindings();

    this._initRenderTargets();

    if (this._config.startPreview) {
      this.startPreviews();
    } else {
      this.stopPreviews();
    }

    console.log("media device init complete", this);

    return this;
  }

  _initInternationalization(config) {
    let defaults = {
      en: {
        legend: "Select your devices",
        none: "None",
        audiooutput: "Speaker",
        audioinput: "Microphone",
        videoinput: "Camera"
      }
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("mediaDevices", resourceBundles);
  }

  _initProperties(config) {
    var defaults = {
      audiooutput: {
        livePreview: true
      },
      audioinput: {
        livePreview: true
      },
      videoinput: {
        livePreview: true
      },
      renderTargets: [],
      startPreview: true
    };
    this._config = this._merge(defaults, config);

    this._previewActive = false;
  }

  _initAudioPreviewMeter() {
    // TODO: there is likely something cleaner we can do with the
    //   Tone library, maybe https://tonejs.github.io/examples/mic.html
    return this._mediaStreamPromise.then(mediaStream => {
      let audioTrack = mediaStream.getTracks().find(track => {
        return track.kind == "audio" && track.readyState == "live";
      });

      if (this._previewAudioMeter) {
        this._previewAudioMeter.close();
      }

      if (audioTrack) {
        let previewAudioContext = new AudioContext();
        let previewMediaStream = previewAudioContext.createMediaStreamSource(
          mediaStream
        );
        this._previewAudioMeter = AudioStreamMeter.audioStreamProcessor(
          previewAudioContext,
          () => {
            this._renders.forEach(render => {
              if (
                render.config.previews.audioinput &&
                render.config.previews.audioinput.element
              ) {
                let element =
                  render.config.previews.audioinput.element.children[0];
                element.style.width =
                  this._previewAudioMeter.volume * 100 + "%";
              }
            });
          }
        );
        previewMediaStream.connect(this._previewAudioMeter);
      }
    });
  }
}
