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
    this._emit("remote.stream.fullscreen: ", element, this._renders[0]);

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
      render => {
        render.data = this._renderData(render.data);
        return render;
      },
      render => {
        Object.keys(render.by_id).forEach(key => {
          if (render.by_id[key].canvas) {
            let element = render.by_id[key].element;
            if (element) {
              if (!render.by_id[key].canvasContext) {
                render.by_id[key].context = element.getContext("2d");
              }
              this.linkCanvas(render, render.by_id[key].context, element);
            }
          }
        });
      }
    );
  }

  linkCanvas(render, canvasContext, element) {
    if (this._remoteVideo && !this._remoteVideo.paused) {
      let remoteCanvasContext = this._createCanvasContext(
        canvasContext,
        element,
        this._remoteVideo
      );
      render.data.canvasLoop.remoteCanvasContext = remoteCanvasContext;
    }
    if (this._localVideo && !this._localVideo.paused) {
      let localCanvasContext = this._createCanvasContext(
        canvasContext,
        element,
        this._localVideo
      );
      render.data.canvasLoop.localCanvasContext = localCanvasContext;
      this._rescalePip(render);
    }
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
        show: true,
        supported: !!(
          document.fullscreenEnabled ||
          document.mozFullScreenEnabled ||
          document.msFullscreenEnabled ||
          document.webkitSupportsFullscreen ||
          document.webkitFullscreenEnabled ||
          document.createElement("video").webkitRequestFullScreen
        )
      },
      pictureInPicture: {
        enabled: true,
        show: true,
        ratio: 0.25
      },
      width: 640,
      height: 480,
      canvasLoop: {
        show: true,
        framesPerSecond: 15,
        offset: {
          x: 0,
          y: 0
        }
      }
    };
    this._config = merge(defaults, config);

    this._remoteVideoStream = null;
    this._remoteVideo = document.createElement("video");
    this._remoteVideo.muted = true;

    this._localVideoStream = null;
    this._localVideo = document.createElement("video");
    this._localVideo.muted = true;

    this._fullscreen = false;
    this._screenshare = false;

    let updater = event => {
      this._pointerLockMoveHandler(event);
    };
    this._pointerLockContext = {
      canvas: null,
      renders: null,
      active: false,
      moveHandler: updater
    };
  }

  _initEventBindings() {
    this._remoteVideo.oncanplay = event => {
      this._emit("remote.stream.canplay", this, event);
    };
    this._remoteVideo.oncanplaythrough = event => {
      this._emit("remote.stream.canplaythrough", this, event);
    };
    this._remoteVideo.oncomplete = event => {
      this._emit("remote.stream.complete", this, event);
    };
    this._remoteVideo.durationchange = event => {
      this._emit("remote.stream.durationchange", this, event);
    };
    this._remoteVideo.onemptied = event => {
      this._emit("remote.stream.emptied", this, event);
    };
    this._remoteVideo.onended = event => {
      this._emit("remote.stream.ended", this, event);
    };
    this._remoteVideo.onloadeddata = event => {
      this._emit("remote.stream.loadeddata", this, event);
    };
    this._remoteVideo.onloadedmetadata = event => {
      this._emit("remote.stream.loadedmetadata", this, event);
    };
    this._remoteVideo.onpause = event => {
      this._emit("remote.stream.pause", this, event);
    };
    this._remoteVideo.onplay = event => {
      this._emit("remote.stream.play", this, event);
    };
    this._remoteVideo.onplaying = event => {
      this._emit("remote.stream.playing", this, event);
    };
    this._remoteVideo.onprogress = event => {
      this._emit("remote.stream.progress", this, event);
    };
    this._remoteVideo.onratechange = event => {
      this._emit("remote.stream.ratechange", this, event);
    };
    this._remoteVideo.onseeked = event => {
      this._emit("remote.stream.seeked", this, event);
    };
    this._remoteVideo.onseeking = event => {
      this._emit("remote.stream.seeking", this, event);
    };
    this._remoteVideo.onstalled = event => {
      this._emit("remote.stream.stalled", this, event);
    };
    this._remoteVideo.onsuspend = event => {
      this._emit("remote.stream.suspend", this, event);
    };
    this._remoteVideo.ontimeupdate = event => {
      this._emit("remote.stream.timeupdate", this, event);
    };
    this._remoteVideo.onvolumechange = event => {
      this._emit("remote.stream.volumechange", this, event);
    };
    this._remoteVideo.onwaiting = event => {
      this._emit("remote.stream.waiting", this, event);
    };

    this._localVideo.oncanplay = event => {
      this._emit("local.stream.canplay", this, event);
    };
    this._localVideo.oncanplaythrough = event => {
      this._emit("local.stream.canplaythrough", this, event);
    };
    this._localVideo.oncomplete = event => {
      this._emit("local.stream.complete", this, event);
    };
    this._localVideo.durationchange = event => {
      this._emit("local.stream.durationchange", this, event);
    };
    this._localVideo.onemptied = event => {
      this._emit("local.stream.emptied", this, event);
    };
    this._localVideo.onended = event => {
      this._emit("local.stream.ended", this, event);
    };
    this._localVideo.onloadeddata = event => {
      this._emit("local.stream.loadeddata", this, event);
    };
    this._localVideo.onloadedmetadata = event => {
      this._emit("local.stream.loadedmetadata", this, event);
    };
    this._localVideo.onpause = event => {
      this._emit("local.stream.pause", this, event);
    };
    this._localVideo.onplay = event => {
      this._emit("local.stream.play", this, event);
    };
    this._localVideo.onplaying = event => {
      this._emit("local.stream.playing", this, event);
    };
    this._localVideo.onprogress = event => {
      this._emit("local.stream.progress", this, event);
    };
    this._localVideo.onratechange = event => {
      this._emit("local.stream.ratechange", this, event);
    };
    this._localVideo.onseeked = event => {
      this._emit("local.stream.seeked", this, event);
    };
    this._localVideo.onseeking = event => {
      this._emit("local.stream.seeking", this, event);
    };
    this._localVideo.onstalled = event => {
      this._emit("local.stream.stalled", this, event);
    };
    this._localVideo.onsuspend = event => {
      this._emit("local.stream.suspend", this, event);
    };
    this._localVideo.ontimeupdate = event => {
      this._emit("local.stream.timeupdate", this, event);
    };
    this._localVideo.onvolumechange = event => {
      this._emit("local.stream.volumechange", this, event);
    };
    this._localVideo.onwaiting = event => {
      this._emit("local.stream.waiting", this, event);
    };

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

    this._libwebphone.on("videoCanvas.remote.stream.playing", () => {
      this.updateRenders();
    });
    this._libwebphone.on("videoCanvas.local.stream.playing", () => {
      this.updateRenders();
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
        framespersecond: "libwebphone:videoCanvas.framespersecond",
        fullscreen: "libwebphone:videoCanvas.fullscreen",
        startfullscreen: "libwebphone:videoCanvas.startfullscreen",
        stopfullscreen: "libwebphone:videoCanvas.stopfullscreen",
        screenshare: "libwebphone:videoCanvas.screenshare",
        startscreenshare: "libwebphone:videoCanvas.startscreenshare",
        stopscreenshare: "libwebphone:videoCanvas.stopscreenshare"
      },
      data: merge(this._renderData(), this._config),
      by_id: {
        canvas: {
          canvas: true,
          events: {
            onmousedown: (event, render) => {
              let canvas = event.srcElement;
              if (
                render.data.canvasLoop &&
                render.data.canvasLoop.localCanvasContext
              ) {
                let canvasContext = render.data.canvasLoop.localCanvasContext;
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
            onmouseup: event => {
              let canvas = event.srcElement;
              this._pointerLockStop(canvas);
            }
          }
        },
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
            },
            oninput: event => {
              let element = event.srcElement;
              this.changePictureInPictureRatio(element.value / 100);
            }
          }
        },
        canvasframesPerSecond: {
          events: {
            onchange: event => {
              let element = event.srcElement;
              this.changeCanvasFramesPerSecond(element.value);
            },
            oninput: event => {
              let element = event.srcElement;
              this.changeCanvasFramesPerSecond(element.value);
            }
          }
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
      canvasLoop: { remoteCanvasContext: null, localCanvasContext: null }
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

  _setRemoteVideoSourceStream(remoteStream = null) {
    this._remoteVideoStream = remoteStream;

    if (remoteStream) {
      this._remoteVideo.srcObject = this._remoteVideoStream;
      this._remoteVideo.play();

      this._emit("remote.stream.added", this, remoteStream);
    } else if (this._remoteVideoStream) {
      this._pointerLockStop();

      this._remoteVideo.pause();
      this._remoteVideoStream = null;

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
    } else if (this._localVideoStream) {
      this._pointerLockStop();

      this._localVideo.pause();
      this._localVideoStream = null;

      this._emit("local.stream.removed", this);
    }
  }

  _getLocalVideoSourceStream() {
    return this._localVideoStream;
  }

  _createCanvasContext(canvasContext, canvas, video) {
    let canvasWidth = canvas.width || 640;
    let canvasHeight = canvas.height || 480;
    let videoWidth = video.videoWidth || 640;
    let videoHeight = video.videoHeight || 480;
    let scale = Math.min(canvasWidth / videoWidth, canvasHeight / videoHeight);

    return {
      context: canvasContext,
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
      if (render.data.canvasLoop.remoteCanvasContext) {
        let canvasContext = render.data.canvasLoop.remoteCanvasContext;
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
        render.data.canvasLoop.localCanvasContext
      ) {
        let canvasContext = render.data.canvasLoop.localCanvasContext;
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
    let canvasContext = render.data.canvasLoop.localCanvasContext;
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

      this._emit("pointer.lock", this);
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
      render.data.canvasLoop.localCanvasContext &&
      this._pointerLockContext.active &&
      event.which
    ) {
      let canvas = this._pointerLockContext.canvas;
      let canvasContext = render.data.canvasLoop.localCanvasContext;
      let boundingRect = canvas.getBoundingClientRect();
      let videoWidth =
        render.data.canvasLoop.localCanvasContext.destination.current.width;
      let videoHeight =
        render.data.canvasLoop.localCanvasContext.destination.current.height;

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
