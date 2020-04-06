"use strict";

import { merge, randomElementId } from "./lwpUtils";
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
    if (!element) {
      element = document.getElementById(this._fullScreenVideo.id);
    }

    if (!element) {
      element = document.body.appendChild(this._fullScreenVideo);
    }

    if (element.requestFullscreen) {
      element
        .requestFullscreen()
        .then(() => this.updateRenders())
        .catch((error) => {
          console.log(error),
            alert(
              `Error attempting to enable full-screen mode: ${error.message} (${error.name})`
            );
        });
    } else if (element.mozRequestFullScreen) {
      /* Firefox */
      element
        .mozRequestFullScreen()
        .then(() => this.updateRenders())
        .catch((error) => console.log(error));
    } else if (element.webkitRequestFullscreen) {
      /* Chrome, Safari and Opera */
      element
        .webkitRequestFullscreen()
        .then(() => this.updateRenders())
        .catch((error) => {
          console.log(error);
          alert(
            `Error attempting to enable full-screen mode: ${error.message} (${error.name})`
          );
        });
    } else if (element.msRequestFullscreen) {
      /* IE/Edge */
      element
        .msRequestFullscreen()
        .then(() => this.updateRenders())
        .catch((error) => console.log(error));
    }

    this._emit("fullscreen.start", this);
  }

  oldFullScreen() {
    /** TODO: figure out which canvas to fullscreen.. */
    let elementId = this._renders[0].by_id.canvas.elementId;
    element = document.getElementById(elementId);
    this._emit("remote.stream.fullscreen: ", element, this._renders[0]);

    if (!this._renders[0].data.canvasLoop.remoteCanvasContext.original) {
      this._renders[0].data.canvasLoop.remoteCanvasContext.original = {};
    }

    this._renders[0].data.canvasLoop.remoteCanvasContext.original.width =
      element.width;
    this._renders[0].data.canvasLoop.remoteCanvasContext.original.height =
      element.height;
    element.width = document.body.clientWidth;
    element.height = document.body.clientHeight;

    //element = this._remoteVideo;

    this._renders[0].enabled = false;

    console.log("startFullScreen: ", element);
    /*
    if (element) {
      return;
    }
    */

    if (element.requestFullscreen) {
      element
        .requestFullscreen()
        .then(() => this.updateRenders())
        .catch((error) => {
          console.log(error),
            alert(
              `Error attempting to enable full-screen mode: ${error.message} (${error.name})`
            );
        });
    } else if (element.mozRequestFullScreen) {
      /* Firefox */
      element
        .mozRequestFullScreen()
        .then(() => this.updateRenders())
        .catch((error) => console.log(error));
    } else if (element.webkitRequestFullscreen) {
      /* Chrome, Safari and Opera */
      element
        .webkitRequestFullscreen()
        .then(() => this.updateRenders())
        .catch((error) => {
          console.log(error);
          alert(
            `Error attempting to enable full-screen mode: ${error.message} (${error.name})`
          );
        });
    } else if (element.msRequestFullscreen) {
      /* IE/Edge */
      element
        .msRequestFullscreen()
        .then(() => this.updateRenders())
        .catch((error) => console.log(error));
    }

    this._emit("fullscreen.start", this);
  }

  stopFullScreen() {
    if (this._renders[0].data.canvasLoop.remoteCanvasContext.original) {
      element = this._renders[0].data.canvasLoop.remoteCanvasContext.canvas
        .element;

      element.width = this._renders[0].data.canvasLoop.remoteCanvasContext.original.width;
      element.height = this._renders[0].data.canvasLoop.remoteCanvasContext.original.height;
    }

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

    console.log("attempting screenshare");

    this._getScreenStream((screenStream) => {
      console.log("screenStream: ", screenStream);
      let newTrack = screenStream.getTracks().find((track) => {
        return track.kind == "video" && track.readyState == "live";
      });
      console.log("new track: ", newTrack);
      let call = this._libwebphone.getCallList().getCall();
      if (call) {
        call.updateRemoteVideoTrack({ track: newTrack });
      }
    });

    this._emit("screenshare.start", this);
  }

  _getScreenStream(callback) {
    if (navigator.getDisplayMedia) {
      navigator
        .getDisplayMedia({
          video: true,
        })
        .then((screenStream) => {
          callback(screenStream);
        });
    } else if (navigator.mediaDevices.getDisplayMedia) {
      navigator.mediaDevices
        .getDisplayMedia({
          video: true,
        })
        .then((screenStream) => {
          callback(screenStream);
        });
    } else {
      getScreenId(function (error, sourceId, screen_constraints) {
        navigator.mediaDevices
          .getUserMedia(screen_constraints)
          .then(function (screenStream) {
            callback(screenStream);
          });
      });
    }
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

      this._renders.forEach((render) => {
        this._rescalePip(render);
      });

      this._emit("pictureInPicture.ratio.change", this, ratio);
    }
  }

  changeCanvasFramesPerSecond(framesPerSecond) {
    this._config.canvasLoop.framesPerSecond = framesPerSecond;
    this._emit("canvas.framesPerSecond.change", this, framesPerSecond);
  }

  updateRenders() {
    this._pointerLockStop();
    this.render(
      (render) => {
        render.data = this._renderData(render.data);
        return render;
      },
      (render) => {
        Object.keys(render.by_id).forEach((key) => {
          if (render.by_id[key].canvas) {
            let element = render.by_id[key].element;
            if (element) {
              if (!render.by_id[key].canvasContext) {
                render.by_id[key].context = element.getContext("2d");
              }

              this._fullScreenVideoStream = element.captureStream(
                this._config.canvasLoop.framesPerSecond
              );
              this._fullScreenVideo.srcObject = this._fullScreenVideoStream;
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
        framespersecond: "Canvas Frames per Second",
        pipenable: "Enable",
        pipdisable: "Disable",
        fullscreen: "Full Screen",
        startfullscreen: "Start",
        stopfullscreen: "Exit",
        screenshare: "Screen Share",
        startscreenshare: "Start",
        stopscreenshare: "Stop",
      },
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("videoCanvas", resourceBundles);
  }

  _initProperties(config) {
    let defaults = {
      renderTargets: [],
      screenshare: {
        show: true,
      },
      fullscreen: {
        show: true,
        supported: !!(
          document.fullscreenEnabled ||
          document.mozFullScreenEnabled ||
          document.msFullscreenEnabled ||
          document.webkitSupportsFullscreen ||
          document.webkitFullscreenEnabled ||
          document.createElement("video").webkitRequestFullScreen
        ),
      },
      pictureInPicture: {
        enabled: true,
        show: true,
        ratio: 0.25,
      },
      canvasLoop: {
        show: true,
        framesPerSecond: 15,
        offset: {
          x: 0,
          y: 0,
        },
      },
    };
    this._config = merge(defaults, config);

    this._canvas = {};
    this._canvas.element = document.createElement("canvas");
    this._canvas.context = this._canvas.element.getContext("2d");

    this._remoteVideo = null;

    this._localVideo = null;

    this._fullscreen = false;
    this._fullScreenVideo = document.createElement("video");
    this._fullScreenVideo.muted = true;
    this._fullScreenVideo.id = randomElementId();

    this._screenshare = false;

    let updater = (event) => {
      this._pointerLockMoveHandler(event);
    };
    this._pointerLockContext = {
      canvas: null,
      renders: null,
      active: false,
      moveHandler: updater,
    };

    this._canvasLoop();
  }

  _initEventBindings() {
    this._libwebphone.on("videoCanvas.remote.video.added", () => {
      this.updateRenders();
    });
    this._libwebphone.on("videoCanvas.remote.video.removed", () => {
      this.updateRenders();
    });

    this._libwebphone.on("videoCanvas.local.video.added", () => {
      this.updateRenders();
    });
    this._libwebphone.on("videoCanvas.local.video.removed", () => {
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

    this._libwebphone.on("videoCanvas.remote.stream.playing", () => {
      this.updateRenders();
    });
    this._libwebphone.on("videoCanvas.local.stream.playing", () => {
      this.updateRenders();
    });

    document.addEventListener("fullscreenchange", (event) => {
      if (document.fullscreenElement) {
        this._fullscreen = true;
        this._renders[0].enabled = false;
        this.updateRenders();
        console.log(
          `Element: ${document.fullscreenElement.id} entered full-screen mode.`
        );
      } else {
        this._fullscreen = false;
        this._renders[0].enabled = true;
        this.updateRenders();
        this.stopFullScreen();
        console.log("Leaving full-screen mode.");
      }
    });
    document.addEventListener(
      "pointerlockchange",
      (...data) => {
        this._pointerLockHandler(...data);
      },
      false
    );
    document.addEventListener(
      "mozpointerlockchange",
      (...data) => {
        this._pointerLockHandler(...data);
      },
      false
    );
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
        pipratio: "libwebphone:videoCanvas.pipratio",
        pip: "libwebphone:videoCanvas.pip",
        pipenable: "libwebphone:videoCanvas.pipenable",
        pipdisable: "libwebphone:videoCanvas.pipdisable",
        framespersecond: "libwebphone:videoCanvas.framespersecond",
        fullscreen: "libwebphone:videoCanvas.fullscreen",
        startfullscreen: "libwebphone:videoCanvas.startfullscreen",
        stopfullscreen: "libwebphone:videoCanvas.stopfullscreen",
        screenshare: "libwebphone:videoCanvas.screenshare",
        startscreenshare: "libwebphone:videoCanvas.startscreenshare",
        stopscreenshare: "libwebphone:videoCanvas.stopscreenshare",
      },
      data: merge(this._renderData(), this._config),
      by_id: {
        canvas: {
          canvas: true,
          events: {
            onmousedown: (event, render) => {
              let canvas = event.srcElement;
              if (this._canvasLoop && this._canvasLoop.localCanvasContext) {
                let canvasContext = this._canvasLoop.localCanvasContext;
                let boundingRect = canvas.getBoundingClientRect();
                let videoWidth = canvasContext.destination.current.width;
                let videoHeight = canvasContext.destination.current.height;
                let offsetX = canvasContext.destination.current.x;
                let offsetY = canvasContext.destination.current.y;
                let mouseX = event.clientX - boundingRect.left;
                let mouseY = event.clientY - boundingRect.top;

                if (
                  mouseX >= offsetX &&
                  mouseX <= offsetX + videoWidth &&
                  mouseY >= offsetY &&
                  mouseY <= offsetY + videoHeight
                ) {
                  this._pointerLockContext.canvas = canvas;
                  this._pointerLockContext.render = render;
                  this._pointerLockContext.x =
                    canvasContext.destination.current.x + boundingRect.left;
                  this._pointerLockContext.y =
                    canvasContext.destination.current.y + boundingRect.top;

                  this._pointerLockStart(canvas);
                }
              }
            },
            onmouseup: (event) => {
              let canvas = event.srcElement;
              this._pointerLockStop(canvas);
            },
          },
        },
        pictureInPicture: {
          events: {
            onclick: (event) => {
              this.togglePictureInPicture();
            },
          },
        },
        pictureInPictureRatio: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changePictureInPictureRatio(element.value / 100);
            },
            oninput: (event) => {
              let element = event.srcElement;
              this.changePictureInPictureRatio(element.value / 100);
            },
          },
        },
        canvasframesPerSecond: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeCanvasFramesPerSecond(element.value);
            },
            oninput: (event) => {
              let element = event.srcElement;
              this.changeCanvasFramesPerSecond(element.value);
            },
          },
        },
        fullscreen: {
          events: {
            onclick: (event) => {
              this.toggleFullScreen();
            },
          },
        },
        screenshare: {
          events: {
            onclick: (event) => {
              this.toggleScreenShare();
            },
          },
        },
      },
    };
  }

  _renderDefaultTemplate() {
    return `
        <canvas id="{{by_id.canvas.elementId}}"></canvas>

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


        {{#data.canvasLoop.show}}
          <div>
            <label for="{{by_id.canvasframesPerSecond.elementId}}">
              {{i18n.framespersecond}}
            </label>
            <input type="range" min="1" max="30" value="{{data.canvasLoop.framesPerSecond}}" id="{{by_id.canvasframesPerSecond.elementId}}">
          </div>
        {{/data.canvasLoop.show}}

        {{#data.fullscreen.supported}}
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
        {{/data.fullscreen.supported}}

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

  _renderData(
    data = {
      pictureInPicture: {},
      canvasLoop: { remoteCanvasContext: null, localCanvasContext: null },
    }
  ) {
    data.isFullScreen = this.isFullScreen();
    data.isSharingScreen = this.isSharingScreen();
    data.pictureInPicture.enabled = this.isPictureInPicture();
    data.pictureInPicture.ratio = this._config.pictureInPicture.ratio * 100;
    data.canvasLoop.framesPerSecond = this._config.canvasLoop.framesPerSecond;
    return data;
  }

  /** Helper functions */

  _setRemoteVideo(remoteVideo = null) {
    if (remoteVideo) {
      this._remoteVideo = remoteVideo;
      let remoteCanvasContext = this._createCanvasContext(
        canvasContext,
        element,
        this._remoteVideo
      );
      this._canvasLoop.remoteCanvasContext = remoteCanvasContext;

      this._emit("remote.video.added", this, this._removeVideo);
      return;
    }

    this._pointerLockStop();

    this._remoteVideo = null;

    this._emit("remote.video.removed", this);
  }

  _setLocalVideo(localVideo = null) {
    if (localVideo) {
      this._localVideo = localVideo;
      let localCanvasContext = this._createCanvasContext(
        canvasContext,
        element,
        this._localVideo
      );
      this._canvasLoop.localCanvasContext = localCanvasContext;
      this._rescalePip(render);

      this._emit("local.video.added", this, this._localVideo);
      return;
    }

    this._pointerLockStop();

    this._localVideo = null;

    this._emit("local.video.removed", this);
  }

  _createCanvasContext(canvasContext, canvas, video) {
    let videoWidth = video.videoWidth || 640;
    let videoHeight = video.videoHeight || 480;
    let canvasWidth = videoWidth; //canvas.width || 640;
    let canvasHeight = videoHeight; //canvas.height || 480;
    let scale = Math.min(canvasWidth / videoWidth, canvasHeight / videoHeight);

    return {
      context: canvasContext,
      scale: scale,
      canvas: {
        element: canvas,
        width: canvasWidth,
        height: canvasHeight,
      },
      source: {
        stream: video,
        x: 0,
        y: 0,
        width: videoWidth,
        height: videoHeight,
      },
      destination: {
        original: {
          x: canvasWidth / 2 - (videoWidth / 2) * scale,
          y: canvasHeight / 2 - (videoHeight / 2) * scale,
          width: videoWidth * scale,
          height: videoHeight * scale,
        },
        current: {
          x: canvasWidth / 2 - (videoWidth / 2) * scale,
          y: canvasHeight / 2 - (videoHeight / 2) * scale,
          width: videoWidth * scale,
          height: videoHeight * scale,
        },
      },
    };
  }

  _canvasLoop() {
    this._renders.forEach((render) => {
      if (this._canvasLoop.remoteCanvasContext) {
        let canvasContext = this._canvasLoop.remoteCanvasContext;
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

      if (
        this._config.pictureInPicture.enabled &&
        this._canvasLoop.localCanvasContext
      ) {
        let canvasContext = this._canvasLoop.localCanvasContext;
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
    }, 1000 / this._config.canvasLoop.framesPerSecond);
  }

  _rescalePip(render) {
    let canvasContext = this._canvasLoop.localCanvasContext;
    if (!canvasContext) {
      return;
    }

    canvasContext.destination.current.width =
      canvasContext.destination.original.width *
      this._config.pictureInPicture.ratio;
    canvasContext.destination.current.height =
      canvasContext.destination.original.height *
      this._config.pictureInPicture.ratio;

    if (
      canvasContext.destination.current.width +
        canvasContext.destination.current.x >
      canvasContext.canvas.width
    ) {
      canvasContext.destination.current.x =
        canvasContext.canvas.width - canvasContext.destination.current.width;
    }

    if (
      canvasContext.destination.current.height +
        canvasContext.destination.current.y >
      canvasContext.canvas.height
    ) {
      canvasContext.destination.current.y =
        canvasContext.canvas.height - canvasContext.destination.current.height;
    }
  }

  _pointerLockStart(canvas) {
    if (!this._pointerLockContext.active) {
      canvas.requestPointerLock =
        canvas.requestPointerLock || canvas.mozRequestPointerLock;
      canvas.requestPointerLock();
    }
  }

  _pointerLockStop(canvas = null) {
    if (
      (!canvas ||
        document.pointerLockElement === canvas ||
        document.mozPointerLockElement === canvas) &&
      this._pointerLockContext.active
    ) {
      this._pointerLockStop.active = false;
      document.exitPointerLock =
        document.exitPointerLock || document.mozExitPointerLock;
      document.exitPointerLock();
    }
  }

  _pointerLockHandler() {
    if (
      document.pointerLockElement === this._pointerLockContext.canvas ||
      document.mozPointerLockElement === this._pointerLockContext.canvas
    ) {
      this._pointerLockContext.active = true;

      document.addEventListener(
        "mousemove",
        this._pointerLockContext.moveHandler,
        false
      );

      this._emit("pointer.locked", this);
    } else {
      this._pointerLockContext.active = false;

      document.removeEventListener(
        "mousemove",
        this._pointerLockContext.moveHandler,
        false
      );

      this._emit("pointer.unlocked", this);
    }
  }

  _pointerLockMoveHandler(event) {
    let render = this._pointerLockContext.render;
    if (
      this._canvasLoop.localCanvasContext &&
      this._pointerLockContext.active &&
      event.which
    ) {
      let canvas = this._pointerLockContext.canvas;
      let canvasContext = this._canvasLoop.localCanvasContext;
      let boundingRect = canvas.getBoundingClientRect();
      let videoWidth = canvasContext.destination.current.width;
      let videoHeight = canvasContext.destination.current.height;

      this._pointerLockContext.x += event.movementX;
      this._pointerLockContext.y += event.movementY;

      if (this._pointerLockContext.x < boundingRect.left) {
        this._pointerLockContext.x = boundingRect.left;
      }

      if (this._pointerLockContext.x + videoWidth > boundingRect.right) {
        this._pointerLockContext.x = boundingRect.right - videoWidth;
      }

      if (this._pointerLockContext.y < boundingRect.top) {
        this._pointerLockContext.y = boundingRect.top;
      }

      if (this._pointerLockContext.y + videoHeight > boundingRect.bottom) {
        this._pointerLockContext.y = boundingRect.bottom - videoHeight;
      }

      canvasContext.destination.current.x =
        this._pointerLockContext.x - boundingRect.left;
      canvasContext.destination.current.y =
        this._pointerLockContext.y - boundingRect.top;
    }
  }
}
