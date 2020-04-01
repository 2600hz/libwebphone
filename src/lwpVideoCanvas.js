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
    this._emit("created", this);
    return this;
  }

  startFullScreen(element = null) {
    /** TODO: figure out which canvas to fullscreen.. */
    element = this._renders[0].remoteCanvasContext.canvas.element;
    console.log("fullscreen: ", element, this._renders[0]);

    /*
    if (element) {
      return;
    }
    */

    //    this._fullscreen = true;

    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.mozRequestFullScreen) {
      /* Firefox */
      element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
      /* Chrome, Safari and Opera */
      element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
      /* IE/Edge */
      element.msRequestFullscreen();
    }

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

  startPictureInPicture() {
    this._config.pictureInPicture.enabled = true;

    this._emit("pictureInPicture.start", this);
  }

  stopPictureInPicture() {
    this._config.pictureInPicture.enabled = false;

    this._emit("pictureInPicture.stop", this);
  }

  togglePictureInPicture() {
    if (this.isPictureInPicture()) {
      return this.stopPictureInPicture();
    } else {
      return this.startPictureInPicture();
    }
  }

  isPictureInPicture() {
    return this._config.pictureInPicture.enabled;
  }

  changePictureInPictureRatio(ratio) {
    ratio = ratio.toFixed(2);
    if (ratio > 0 && ratio <= 1) {
      this._config.pictureInPicture.ratio = ratio;

      this._renders.forEach(render => {
        this._rescalePip(render);
      });

      this._emit("pictureInPicture.ratiochange", this, ratio);
    }
  }

  updateRenders() {
    this.render(
      render => {
        render.data = this._renderData(render.data);
        return render;
      },
      render => {
        render.remoteCanvasContext = null;
        render.localCanvasContext = null;

        Object.keys(render.by_id).forEach(key => {
          if (render.by_id[key].canvas) {
            let element = render.by_id[key].element;
            if (element) {
              if (this._remoteVideo && !this._remoteVideo.paused) {
                let remoteCanvasContext = this._createCanvasContext(
                  element,
                  this._remoteVideo
                );
                render.remoteCanvasContext = remoteCanvasContext;

                if (this._localVideo && !this._localVideo.paused) {
                  let localCanvasContext = this._createCanvasContext(
                    element,
                    this._localVideo
                  );
                  render.localCanvasContext = localCanvasContext;
                  this._rescalePip(render);
                }
              }
            }
          }
        });
      }
    );
  }

  /** Init functions */

  _initInternationalization(config) {
    let defaults = {
      en: {
        pipratio: "Preview Ratio",
        pip: "Preview PIP",
        pipenable: "Enable",
        pipdisable: "Disable",
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
      },
      pictureInPicture: {
        enabled: true,
        show: true,
        ratio: 0.25
      },
      width: 640,
      height: 480
    };
    this._config = merge(defaults, config);

    this._remoteVideoStream = null;
    this._remoteVideo = document.createElement("video");
    this._remoteVideo.mute = true;
    //this._remoteVideo = document.getElementById("remoteVideo");

    this._localVideoStream = null;
    this._localVideo = document.createElement("video");
    this._localVideo.mute = true;
    //this._localVideo = document.getElementById("localVideo");

    this._fullscreen = false;
    this._screenshare = false;
  }

  _initEventBindings() {
    this._libwebphone.on("videoCanvas.remote.stream.added", () => {
      this.updateRenders();
    });
    this._libwebphone.on("videoCanvas.remote.stream.removed", () => {
      this.updateRenders();
    });

    this._libwebphone.on("videoCanvas.local.stream.added", () => {
      this.updateRenders();
    });
    this._libwebphone.on("videoCanvas.local.stream.removed", () => {
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

    this._libwebphone.on("videoCanvas.pictureInPicture.start", () => {
      this.updateRenders();
    });
    this._libwebphone.on("videoCanvas.pictureInPicture.stop", () => {
      this.updateRenders();
    });
  }

  _initRenderTargets() {
    this._config.renderTargets.map(renderTarget => {
      return this.renderAddTarget(renderTarget);
    });
    this._canvasLoop();
  }

  /** Render Helpers */

  _renderDefaultConfig() {
    return {
      template: this._renderDefaultTemplate(),
      i18n: {
        pipratio: "libwebphone:videoCanvas.pipratio",
        pip: "libwebphone:videoCanvas.pip",
        pipenable: "libwebphone:videoCanvas.pipenable",
        pipdisable: "libwebphone:videoCanvas.pipdisable",
        fullscreen: "libwebphone:videoCanvas.fullscreen",
        startfullscreen: "libwebphone:videoCanvas.startfullscreen",
        stopfullscreen: "libwebphone:videoCanvas.stopfullscreen",
        screenshare: "libwebphone:videoCanvas.screenshare",
        startscreenshare: "libwebphone:videoCanvas.startscreenshare",
        stopscreenshare: "libwebphone:videoCanvas.stopscreenshare"
      },
      data: merge(this._renderData(), this._config),
      by_id: {
        pictureInPicture: {
          events: {
            onclick: event => {
              this.togglePictureInPicture();
            }
          }
        },
        pictureInPictureRatio: {
          events: {
            onchange: event => {
              let element = event.srcElement;
              this.changePictureInPictureRatio(element.value / 100);
            }
          }
        },
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
        <canvas id="{{by_id.canvas.elementId}}" width="{{data.width}}" height="{{data.height}}"></canvas>

        {{#data.pictureInPicture.show}}
          <div>
            <label for="{{by_id.pictureInPicture.elementId}}">
                {{i18n.pip}}
            </label>
            <button id="{{by_id.pictureInPicture.elementId}}">
                {{^data.pictureInPicture.enabled}}
                    {{i18n.pipenable}}
                {{/data.pictureInPicture.enabled}}

                {{#data.pictureInPicture.enabled}}
                    {{i18n.pipdisable}}
                {{/data.pictureInPicture.enabled}}
            </button>
          </div>

          {{#data.pictureInPicture.enabled}}
            <div>
              <label for="{{by_id.pictureInPictureRatio.elementId}}">
                {{i18n.pipratio}}
              </label>
              <input type="range" min="1" max="100" value="{{data.pictureInPicture.ratio}}" id="{{by_id.pictureInPictureRatio.elementId}}">
            </div>
          {{/data.pictureInPicture.enabled}}

        {{/data.pictureInPicture.show}}


        {{#data.fullscreen.show}}
          <div>
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
          </div>
        {{/data.fullscreen.show}}

        {{#data.screenshare.show}}
          <div>
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
          </div>
        {{/data.screenshare.show}}
    `;
  }

  _renderData(data = { pictureInPicture: {} }) {
    data.isFullScreen = this.isFullScreen();
    data.isSharingScreen = this.isSharingScreen();
    data.pictureInPicture.enabled = this.isPictureInPicture();
    data.pictureInPicture.ratio = this._config.pictureInPicture.ratio * 100;

    return data;
  }

  /** Helper functions */

  _setRemoteVideoSourceStream(remoteStream = null) {
    this._remoteVideoStream = remoteStream;

    if (remoteStream) {
      this._remoteVideo.srcObject = this._remoteVideoStream;
      this._remoteVideo.play();

      this._emit("remote.stream.added", this, remoteStream);
    } else {
      this._remoteVideo.pause();

      this._emit("remote.stream.removed", this);
    }
  }

  _getRemoteVideoSourceStream() {
    return this._remoteVideoStream;
  }

  _setLocalVideoSourceStream(localStream = null) {
    this._localVideoStream = localStream;

    if (localStream) {
      this._localVideo.srcObject = this._localVideoStream;
      this._localVideo.play();

      this._emit("local.stream.added", this, localStream);
    } else {
      this._localVideo.pause();

      this._emit("local.stream.removed", this);
    }
  }

  _getLocalVideoSourceStream() {
    return this._localVideoStream;
  }

  _createCanvasContext(canvas, video) {
    let canvasWidth = canvas.width || 640;
    let canvasHeight = canvas.height || 480;
    let videoWidth = video.videoWidth || 640;
    let videoHeight = video.videoHeight || 480;
    let scale = Math.min(canvasWidth / videoWidth, canvasHeight / videoHeight);

    return {
      context: canvas.getContext("2d"),
      scale: scale,
      canvas: {
        element: canvas,
        width: canvasWidth,
        height: canvasHeight
      },
      source: {
        stream: video,
        x: 0,
        y: 0,
        width: videoWidth,
        height: videoHeight
      },
      destination: {
        original: {
          x: canvasWidth / 2 - (videoWidth / 2) * scale,
          y: canvasHeight / 2 - (videoHeight / 2) * scale,
          width: videoWidth * scale,
          height: videoHeight * scale
        },
        current: {
          x: canvasWidth / 2 - (videoWidth / 2) * scale,
          y: canvasHeight / 2 - (videoHeight / 2) * scale,
          width: videoWidth * scale,
          height: videoHeight * scale
        }
      }
    };
  }

  _canvasLoop() {
    this._renders.forEach(render => {
      if (render.remoteCanvasContext) {
        let canvasContext = render.remoteCanvasContext;
        canvasContext.context.fillStyle = "#black";
        canvasContext.context.fillRect(
          0,
          0,
          canvasContext.canvas.width,
          canvasContext.canvas.height
        );
        canvasContext.context.drawImage(
          canvasContext.source.stream,
          canvasContext.source.x,
          canvasContext.source.y,
          canvasContext.source.width,
          canvasContext.source.height,
          canvasContext.destination.current.x,
          canvasContext.destination.current.y,
          canvasContext.destination.current.width,
          canvasContext.destination.current.height
        );
      }

      if (this._config.pictureInPicture.enabled && render.localCanvasContext) {
        let canvasContext = render.localCanvasContext;
        canvasContext.context.drawImage(
          canvasContext.source.stream,
          canvasContext.source.x,
          canvasContext.source.y,
          canvasContext.source.width,
          canvasContext.source.height,
          canvasContext.destination.current.x,
          canvasContext.destination.current.y,
          canvasContext.destination.current.width,
          canvasContext.destination.current.height
        );
      }
    });

    setTimeout(() => {
      this._canvasLoop();
    }, 1000 / 15); // drawing at 30fps
  }

  _rescalePip(render) {
    let canvasContext = render.localCanvasContext;
    if (!canvasContext) {
      return;
    }

    canvasContext.destination.current.width =
      canvasContext.destination.original.width *
      this._config.pictureInPicture.ratio;
    canvasContext.destination.current.height =
      canvasContext.destination.original.height *
      this._config.pictureInPicture.ratio;
    canvasContext.destination.current.x =
      canvasContext.canvas.width - canvasContext.destination.current.width;
    canvasContext.destination.current.y =
      canvasContext.canvas.height - canvasContext.destination.current.height;
  }
}
