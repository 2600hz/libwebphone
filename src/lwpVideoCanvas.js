"use strict";

import { merge } from "./lwpUtils";
import lwpRenderer from "./lwpRenderer";

export default class extends lwpRenderer {
  constructor(libwebphone, config = {}) {
    super(libwebphone);
    this._libwebphone = libwebphone;
    this._emit = this._libwebphone._videoCanvasEvent;
    this._initProperties(config);
    this._initInternationalization(config.i18n || {});
    this._initEventBindings();
    this._initRenderTargets();
    this._emit("started", this);
    return this;
  }

  startFullScreen() {
    this._fullscreen = true;

    this._emit("fullscreen.start", this);
  }

  stopFullScreen() {
    this._fullscreen = false;

    this._emit("fullscreen.stop", this);
  }

  toggleFullScreen() {
    if (this.isFullScreen()) {
      return this.stopFullScreen();
    } else {
      return this.startFullScreen();
    }
  }

  isFullScreen() {
    return this._fullscreen;
  }

  startScreenShare() {
    this._screenshare = true;

    this._emit("screenshare.start", this);
  }

  stopScreenShare() {
    this._screenshare = false;

    this._emit("screenshare.stop", this);
  }

  toggleScreenShare() {
    if (this.isSharingScreen()) {
      return this.stopScreenShare();
    } else {
      return this.startScreenShare();
    }
  }

  isSharingScreen() {
    return this._screenshare;
  }

  updateRenders() {
    this.render(
      render => {
        render.data = this._renderData(render.data);
        return render;
      },
      render => {
        Object.keys(render.by_id).forEach(key => {
          if (render.by_id[key].canvas) {
            let element = render.by_id[key].element;
            if (element) {
              //if (!render.by_id[key].canvasContext) {
              if (!this._localVideo.paused) {
                let canvasContext = {};
                canvasContext.context = element.getContext("2d");
                canvasContext.scale = Math.min(
                  element.width / this._localVideo.videoWidth,
                  element.height / this._localVideo.videoHeight
                );
                canvasContext.element = element;
                canvasContext.context.clearRect(
                  0,
                  0,
                  element.width,
                  element.height
                );

                canvasContext.localVideo = {};
                canvasContext.localVideo.video = this._localVideo;
                canvasContext.localVideo.scale = Math.min(
                  element.width / canvasContext.localVideo.video.videoWidth,
                  element.height / canvasContext.localVideo.video.videoHeight
                );
                canvasContext.localVideo.scale = canvasContext.localVideo.scale;
                canvasContext.localVideo.vidH =
                  canvasContext.localVideo.video.videoHeight;
                canvasContext.localVideo.vidW =
                  canvasContext.localVideo.video.videoWidth;
                canvasContext.localVideo.top =
                  canvasContext.element.height / 2 -
                  (canvasContext.localVideo.vidH / 2) *
                    canvasContext.localVideo.scale;
                canvasContext.localVideo.left =
                  canvasContext.element.width / 2 -
                  (canvasContext.localVideo.vidW / 2) *
                    canvasContext.localVideo.scale;

                canvasContext.remoteVideo = {};
                canvasContext.remoteVideo.video = this._remoteVideo;
                canvasContext.remoteVideo.scale = Math.min(
                  element.width / canvasContext.remoteVideo.video.videoWidth,
                  element.height / canvasContext.remoteVideo.video.videoHeight
                );
                canvasContext.remoteVideo.scale =
                  canvasContext.remoteVideo.scale;
                canvasContext.remoteVideo.vidH =
                  canvasContext.remoteVideo.video.videoHeight;
                canvasContext.remoteVideo.vidW =
                  canvasContext.remoteVideo.video.videoWidth;
                canvasContext.remoteVideo.top =
                  canvasContext.element.height / 2 -
                  (canvasContext.remoteVideo.vidH / 2) *
                    canvasContext.remoteVideo.scale;
                canvasContext.remoteVideo.left =
                  canvasContext.element.width / 2 -
                  (canvasContext.remoteVideo.vidW / 2) *
                    canvasContext.remoteVideo.scale;

                // now just draw the video the correct size
                canvasContext.loop = this._createCanvasLoop(canvasContext);
                canvasContext.loop();
                console.log(canvasContext);
                //render.by_id[key].canvasContext = canvasContext;
              }
            }
          }
        });
      }
    );
  }

  _createCanvasLoop(canvasContext) {
    return () => {
      //      canvasContext.context.drawImage(canvasContext.video, 0, 0);
      canvasContext.context.drawImage(
        canvasContext.localVideo.video,
        canvasContext.localVideo.left,
        canvasContext.localVideo.top,
        canvasContext.localVideo.vidW * canvasContext.localVideo.scale,
        canvasContext.localVideo.vidH * canvasContext.localVideo.scale
      );

      canvasContext.context.drawImage(
        canvasContext.remoteVideo.video,
        canvasContext.remoteVideo.left,
        canvasContext.remoteVideo.top + 100,
        canvasContext.remoteVideo.vidW * canvasContext.remoteVideo.scale,
        canvasContext.remoteVideo.vidH * canvasContext.remoteVideo.scale
      );
      setTimeout(canvasContext.loop, 1000 / 30); // drawing at 30fps
    };
  }

  /** Init functions */

  _initInternationalization(config) {
    let defaults = {
      en: {
        fullscreen: "Full Screen",
        startfullscreen: "Start",
        stopfullscreen: "Exit",
        screenshare: "Screen Share",
        startscreenshare: "Start",
        stopscreenshare: "Stop"
      }
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("videoCanvas", resourceBundles);
  }

  _initProperties(config) {
    let defaults = {
      renderTargets: [],
      screenshare: {
        show: true
      },
      fullscreen: {
        show: true
      }
    };
    this._config = merge(defaults, config);

    this._remoteVideoStream = null;
    this._remoteVideo = document.createElement("video");

    this._localVideoStream = null;
    this._localVideo = document.createElement("video");

    this._fullscreen = false;
    this._screenshare = false;
  }

  _initEventBindings() {
    this._libwebphone.on("videoCanvas.remote.stream.added", () => {
      this.updateRenders();
    });
    this._libwebphone.on("videoCanvas.local.stream.added", () => {
      this.updateRenders();
    });

    this._libwebphone.on("videoCanvas.screenshare.start", () => {
      this.updateRenders();
    });
    this._libwebphone.on("videoCanvas.screenshare.stop", () => {
      this.updateRenders();
    });
    this._libwebphone.on("videoCanvas.fullscreen.start", () => {
      this.updateRenders();
    });
    this._libwebphone.on("videoCanvas.fullscreen.stop", () => {
      this.updateRenders();
    });
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
        fullscreen: "libwebphone:videoCanvas.fullscreen",
        startfullscreen: "libwebphone:videoCanvas.startfullscreen",
        stopfullscreen: "libwebphone:videoCanvas.stopfullscreen",
        screenshare: "libwebphone:videoCanvas.screenshare",
        startscreenshare: "libwebphone:videoCanvas.startscreenshare",
        stopscreenshare: "libwebphone:videoCanvas.stopscreenshare"
      },
      data: merge(this._config, this._renderData()),
      by_id: {
        canvas: {
          canvas: true
        },
        fullscreen: {
          events: {
            onclick: event => {
              this.toggleFullScreen();
            }
          }
        },
        screenshare: {
          events: {
            onclick: event => {
              this.toggleScreenShare();
            }
          }
        }
      }
    };
  }

  _renderDefaultTemplate() {
    return `
        <canvas id="{{by_id.canvas.elementId}}"></canvas>

        <div>
        {{#data.fullscreen.show}}
            <label for="{{by_id.fullscreen.elementId}}">
                {{i18n.fullscreen}}
            </label>
            <button id="{{by_id.fullscreen.elementId}}">
                {{^data.isFullScreen}}
                    {{i18n.startfullscreen}}
                {{/data.isFullScreen}}

                {{#data.isFullScreen}}
                    {{i18n.stopfullscreen}}
                {{/data.isFullScreen}}
            </button>
        {{/data.fullscreen.show}}
        </div>

        <div>
        {{#data.screenshare.show}}
            <label for="{{by_id.screenshare.elementId}}">
                {{i18n.screenshare}}
            </label>
            <button id="{{by_id.screenshare.elementId}}">
                {{^data.isSharingScreen}}
                    {{i18n.startscreenshare}}
                {{/data.isSharingScreen}}

                {{#data.isSharingScreen}}
                    {{i18n.stopscreenshare}}
                {{/data.isSharingScreen}}
            </button>
        {{/data.screenshare.show}}
        </div>
    `;
  }

  _renderData(data = {}) {
    data.isFullScreen = this.isFullScreen();
    data.isSharingScreen = this.isSharingScreen();

    return data;
  }

  /** Helper functions */

  _setRemoteVideoSourceStream(remoteStream) {
    this._remoteVideoStream = remoteStream;
    this._remoteVideo.srcObject = this._remoteVideoStream;
    this._remoteVideo.play();

    console.log(remoteStream.getTracks());
    this._emit("remote.stream.added", this, remoteStream);
  }

  _getRemoteVideoSourceStream() {
    return this._remoteVideoStream;
  }

  _setLocalVideoSourceStream(localStream) {
    this._localVideoStream = localStream;
    this._localVideo.srcObject = this._localVideoStream;
    this._localVideo.play();

    this.updateRenders();
    this._emit("local.stream.added", this, localStream);
  }

  _getLocalVideoSourceStream() {
    return this._localVideoStream;
  }
}
