"use strict";

import lwpUtils from "./lwpUtils";
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

  enableImage(name) {
    let configImage = this._configGetImage(name);
    let canvasImage = this._canvasGetImage(this._canvasRender, name);

    if (configImage) {
      configImage.enabled = true;
    }

    if (canvasImage) {
      canvasImage.enabled = true;
    }

    return canvasImage;
  }

  disableImage(name) {
    let configImage = this._configGetImage(name);
    let canvasImage = this._canvasGetImage(this._canvasRender, name);

    if (configImage) {
      configImage.enabled = false;
    }

    if (canvasImage) {
      canvasImage.enabled = false;
    }

    return canvasImage;
  }

  toggleImage(name) {
    if (this.isImageEnabled(name)) {
      return this.disableImage(name);
    } else {
      return this.enableImage(name);
    }
  }

  isImageEnabled(name) {
    let configImage = this._configGetImage(name);

    if (configImage) {
      return configImage.enabled || false;
    }

    return false;
  }

  rescaleImage(name, scale = null) {
    if (scale) {
      let configImage = this._configGetImage(name);

      if (configImage) {
        configImage.rescale = scale;
      }
    }

    let canvasImage = this._canvasGetImage(this._canvasRender, name);
    return this._rescaleCanvasImage(this._canvasRender, canvasImage, scale);
  }

  positionImage(name, mode = null, x = null, y = null) {
    let configImage = this._configGetImage(name);
    let canvasImage = this._canvasGetImage(this._canvasRender, name);
    let updatedImage = this._positionCanvasImage(
      this._canvasRender,
      canvasImage,
      mode,
      x,
      y
    );

    if (configImage) {
      if (updatedImage) {
        configImage.position = updatedImage.position;
      } else {
        if (!configImage.position) {
          configImage.position = { mode: "center" };
        }

        if (mode) {
          configImage.position.mode = mode;
        }

        if (x) {
          configImage.position.x = x;
        }

        if (y) {
          configImage.position.y = y;
        }
      }
    }

    return updatedImage;
  }

  changeFramesPerSecond(framesPerSecond) {
    this._config.canvasLoop.framesPerSecond = framesPerSecond;

    let canvasRender = this._canvasRender;
    if (!canvasRender) {
      return;
    }

    if (canvasRender.timer) {
      clearTimeout(canvasRender.timer);
      canvasRender.timer = null;
    }

    canvasRender.framesPerSecond = this._config.canvasLoop.framesPerSecond;
    canvasRender.timer = setInterval(() => {
      this._renderCanvas(canvasRender);
    }, 1000 / canvasRender.framesPerSecond);
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
        piprescale: "Preview Rescale",
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
    let resourceBundles = lwpUtils.merge(
      defaults,
      config.resourceBundles || {}
    );
    this._libwebphone.i18nAddResourceBundles("videoCanvas", resourceBundles);
  }

  _initProperties(config) {
    if (typeof config.canvas == "string") {
      config.canvas = {
        root: { elementId: config.canvas },
      };
    }

    let defaults = {
      renderTargets: [],
      canvas: {
        root: {
          elementId: null,
          element: null,
          defaultWidth: 640,
          defaultHeight: 480,
        },
      },
      fullscreen: {
        show: false,
        supported: !!(
          document.fullscreenEnabled ||
          document.mozFullScreenEnabled ||
          document.msFullscreenEnabled ||
          document.webkitSupportsFullscreen ||
          document.webkitFullscreenEnabled
        ),
      },
      localVideo: {
        name: "localVideo",
        enabled: true,
        show: true,
        rescale: 0.25,
        averageRGB: {
          threshold: 1,
        },
        position: {
          mode: "bottom-right",
        },
      },
      remoteVideo: {
        name: "remoteVideo",
        enabled: true,
        show: true,
        rescale: 1,
        averageRGB: {
          threshold: 1,
        },
        position: {
          mode: "center",
        },
      },
      canvasLoop: {
        show: true,
        framesPerSecond: 15,
      },
      strings: [
        {
          name: "dialpadTarget",
        },
        {
          name: "remoteIdentity",
        },
        {
          name: "callTimer",
        },
      ],
      images: [
        {
          name: "disconnected",
          enabled: true,
          rescale: 0.5,
          position: { mode: "center" },
          source:
            "data:image/svg+xml;base64,PHN2ZyBpZD0idGVzdCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB3aWR0aD0iNzAuNTQ2N21tIiBoZWlnaHQ9IjcwLjU0NjdtbSIgdmlld0JveD0iMCAwIDIwMCAyMDAiPgo8cGF0aCBpZD0iU2VsZWN0aW9uIiBmaWxsPSJ3aGl0ZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIxIiBkPSJNIDEwNC4wMCwxMjUuMDAmIzEwOyAgICAgICAgICAgQyAxMDQuMDAsMTI1LjAwIDExMS40Miw4NS4wMCAxMTEuNDIsODUuMDAmIzEwOyAgICAgICAgICAgICAxMTMuMjQsNzYuNzkgMTE5LjM5LDUzLjkzIDExOC45MCw0Ny4wMCYjMTA7ICAgICAgICAgICAgIDExNy40OSwyNi44MiA5MC45OCwyNS4wNyA4My4yMywzOC4wMiYjMTA7ICAgICAgICAgICAgIDc5LjUzLDQ0LjE5IDgxLjA1LDU0LjI2IDgyLjQwLDYxLjAwJiMxMDsgICAgICAgICAgICAgODIuNDAsNjEuMDAgOTIuMjUsMTA2LjAwIDkyLjI1LDEwNi4wMCYjMTA7ICAgICAgICAgICAgIDkyLjgwLDEwOS4xOSA5NC41OCwxMjIuNDEgOTYuNTksMTIzLjk4JiMxMDsgICAgICAgICAgICAgOTguMjIsMTI1LjI0IDEwMS45OCwxMjQuOTkgMTA0LjAwLDEyNS4wMCBaJiMxMDsgICAgICAgICAgIE0gNzQuMDAsNTEuMDAmIzEwOyAgICAgICAgICAgQyA3NC4wMCw0MS4wMSA3My40Nyw0Mi43NCA3Ni4wMCwzMy4wMCYjMTA7ICAgICAgICAgICAgIDU3LjY3LDMzLjQwIDMyLjQ0LDQ2LjUyIDE4LjAwLDU3LjM3JiMxMDsgICAgICAgICAgICAgMTQuNzksNTkuNzkgNS4yMiw2Ni41MyA2LjM0LDcxLjAwJiMxMDsgICAgICAgICAgICAgNi44MSw3Mi44OCA5LjYxLDc1LjYzIDExLjAwLDc2Ljk4JiMxMDsgICAgICAgICAgICAgMTIuMjQsNzguMTggMTQuMzEsODAuMjQgMTYuMDAsODAuNjYmIzEwOyAgICAgICAgICAgICAxOS40Myw4MS41MyAyOS43MSw3MS43OSAzMy4wMCw2OS40MyYjMTA7ICAgICAgICAgICAgIDQ1LjIxLDYwLjY3IDU5LjIxLDUzLjk4IDc0LjAwLDUxLjAwIFomIzEwOyAgICAgICAgICAgTSAxMjQuMDAsMzMuMDAmIzEwOyAgICAgICAgICAgQyAxMjUuMzIsNDIuMzkgMTI2LjgyLDQwLjg0IDEyNS4wMCw1MS4wMCYjMTA7ICAgICAgICAgICAgIDEzOS43MCw1Ni41MCAxNDcuMDUsNTcuOTEgMTYxLjAwLDY3LjA4JiMxMDsgICAgICAgICAgICAgMTY0LjgzLDY5LjYwIDE2OS40OCw3My4zMCAxNzMuMDAsNzYuMjgmIzEwOyAgICAgICAgICAgICAxNzQuNDcsNzcuNTMgMTc3LjE5LDgwLjIyIDE3OS4wMCw4MC42NiYjMTA7ICAgICAgICAgICAgIDE4Mi41Miw4MS41MyAxODkuNzUsNzQuMDYgMTkwLjgzLDcxLjAxJiMxMDsgICAgICAgICAgICAgMTkyLjQzLDY2LjUxIDE4MS4zNCw1OC44MyAxNzguMDAsNTYuNDMmIzEwOyAgICAgICAgICAgICAxNjIuODIsNDUuNTEgMTQyLjY3LDM1LjYzIDEyNC4wMCwzMy4wMCBaJiMxMDsgICAgICAgICAgIE0gMzIuMDAsOTguMDAmIzEwOyAgICAgICAgICAgQyAzMi4wMCw5OC4wMCA0NC4wMCwxMDkuMDAgNDQuMDAsMTA5LjAwJiMxMDsgICAgICAgICAgICAgNTIuOTIsMTAyLjY0IDU1Ljk5LDk4LjM5IDY3LjAwLDkzLjMxJiMxMDsgICAgICAgICAgICAgNjkuNjksOTIuMDcgNzkuODMsODguOTYgODAuOTcsODcuMzAmIzEwOyAgICAgICAgICAgICA4Mi4wNCw4NS43MyA4MC44OCw3MS40NCA3NC45NCw3MS42MSYjMTA7ICAgICAgICAgICAgIDY2LjQwLDcxLjg1IDQ3LjgyLDgyLjM4IDQxLjAwLDg3LjY2JiMxMDsgICAgICAgICAgICAgMzYuODcsOTAuODYgMzMuNTcsOTIuOTAgMzIuMDAsOTguMDAgWiYjMTA7ICAgICAgICAgICBNIDEyMS4wMCw3MS4wMCYjMTA7ICAgICAgICAgICBDIDEyMS4wMCw3MS4wMCAxMTcuMDAsODkuMDAgMTE3LjAwLDg5LjAwJiMxMDsgICAgICAgICAgICAgMTI2LjUzLDkwLjk0IDEzNC4wNSw5NC44NiAxNDIuMDAsMTAwLjM1JiMxMDsgICAgICAgICAgICAgMTQ0LjQ4LDEwMi4wNiAxNTAuNTcsMTA3LjgxIDE1My4wMCwxMDcuODAmIzEwOyAgICAgICAgICAgICAxNTYuMjMsMTA3LjgwIDE2My41NSw5OS40NSAxNjYuMDAsOTcuMDAmIzEwOyAgICAgICAgICAgICAxNTcuMTQsODQuODkgMTM1LjU4LDc0LjMyIDEyMS4wMCw3MS4wMCBaJiMxMDsgICAgICAgICAgIE0gNTguMDAsMTI0LjAwJiMxMDsgICAgICAgICAgIEMgNjAuODMsMTI2LjAyIDY3Ljk0LDEzMy4xNCA3MC4wMCwxMzMuNjYmIzEwOyAgICAgICAgICAgICA3Mi44NSwxMzQuMzkgNzUuNzYsMTMxLjM4IDc4LjAwLDEyOS45MSYjMTA7ICAgICAgICAgICAgIDgyLjA3LDEyNy4yNCA4NS4yMywxMjUuODcgOTAuMDAsMTI1LjAwJiMxMDsgICAgICAgICAgICAgOTAuMDAsMTI1LjAwIDg3LjAwLDEwNy4wMCA4Ny4wMCwxMDcuMDAmIzEwOyAgICAgICAgICAgICA3Ny40NywxMDguOTIgNjIuNTAsMTE0Ljk0IDU4LjAwLDEyNC4wMCBaJiMxMDsgICAgICAgICAgIE0gMTEyLjAwLDEwOC4wMCYjMTA7ICAgICAgICAgICBDIDExMi4wMCwxMDguMDAgMTA5LjAwLDEyNS4wMCAxMDkuMDAsMTI1LjAwJiMxMDsgICAgICAgICAgICAgMTEzLjU2LDEyNi41OSAxMTUuOTEsMTI3LjQ5IDEyMC4wMCwxMzAuMjImIzEwOyAgICAgICAgICAgICAxMjEuODUsMTMxLjQ1IDEyNC43MCwxMzMuOTUgMTI3LjAwLDEzMy44NCYjMTA7ICAgICAgICAgICAgIDEyOS45NywxMzMuNzEgMTM2Ljk1LDEyNi44MSAxMzcuNjYsMTI0LjAwJiMxMDsgICAgICAgICAgICAgMTM4LjA2LDEyMi40MiAxMzcuNTYsMTIxLjQyIDEzNi42MywxMjAuMTcmIzEwOyAgICAgICAgICAgICAxMzIuMzYsMTE0LjQ0IDExOS4xMiwxMDguNjUgMTEyLjAwLDEwOC4wMCBaJiMxMDsgICAgICAgICAgIE0gOTYuMDAsMTM1LjQ3JiMxMDsgICAgICAgICAgIEMgOTIuMDQsMTM2LjQ0IDg5LjMyLDEzNy4zNSA4Ni4zMywxNDAuMzMmIzEwOyAgICAgICAgICAgICA3My4zMiwxNTMuMjYgODUuMjMsMTc0Ljc0IDEwMy4wMCwxNzEuNTMmIzEwOyAgICAgICAgICAgICAxMTYuMTYsMTY5LjE1IDEyMy4yOSwxNTQuMjIgMTE1LjM1LDE0My4wMiYjMTA7ICAgICAgICAgICAgIDExMC42NiwxMzYuNDAgMTAzLjY5LDEzNC40MSA5Ni4wMCwxMzUuNDcgWiIvPgo8L3N2Zz4",
          predicate: () => {
            return (
              this._libwebphone.getUserAgent() &&
              !this._libwebphone.getUserAgent().isReady()
            );
          },
        },
        {
          name: "idle",
          enabled: true,
          rescale: 0.9,
          position: { mode: "center" },
          source:
            "data:image/svg+xml;base64,PHN2ZyBpZD0idGVzdCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2ZXJzaW9uPSIxLjEiIHg9IjAiIHk9IjAiIHdpZHRoPSIxNzUiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCAxNzUgNDkiIGNsYXNzPSJsb2dvIj4KPHBhdGggY2xhc3M9ImxvZ29fX3N5bWJvbCIgc3R5bGU9ImZpbGw6ICNmZjU5MzM7IiBkPSJNNDIuMSAwLjZjLTAuOC0wLjgtMi0wLjgtMi43IDAgLTAuOCAwLjgtMC44IDIgMCAyLjggMC44IDAuOCAyIDAuOCAyLjcgMEM0Mi45IDIuNiA0Mi45IDEuMyA0Mi4xIDAuNnpNMTEuNyAzMy45bDIyLTIyLjFjLTAuNC0wLjUtMC44LTEtMS4zLTEuNSAtMC41LTAuNS0wLjktMC45LTEuNC0xLjNMOSAzMS4yYy0wLjggMC44LTAuOCAyIDAgMi44QzkuOCAzNC43IDExIDM0LjcgMTEuNyAzMy45ek0zOCA3LjVjMC44LTAuOCAwLjgtMiAwLTIuOCAtMC44LTAuOC0yLTAuOC0yLjcgMGwtMiAyQzI2IDAuNyAxNS4yIDEuMiA4LjQgOGMtNS4xIDUuMS02LjYgMTIuNC00LjYgMTguOGwtMy4zIDMuM2MtMC44IDAuOC0wLjggMiAwIDIuOCAwLjggMC44IDIgMC44IDIuNyAwbDE1LjktMTZjMC44LTAuOCAwLjgtMiAwLTIuOCAtMC44LTAuOC0yLTAuOC0yLjcgMEw4IDIyLjdjLTAuOS00LjggMC41LTkuOSA0LjItMTMuNSA1LjktNiAxNS41LTYgMjEuNSAwIDUuOSA2IDUuOSAxNS42IDAgMjEuNiAtMy4xIDMuMS03LjIgNC42LTExLjMgNC41TDE4IDM5LjZjNS45IDEuMiAxMi4yLTAuNSAxNi44LTUuMSA2LjgtNi44IDcuMi0xNy43IDEuMy0yNUwzOCA3LjV6TTIzLjQgMjguOWMtMC44LTAuOC0yLTAuOC0yLjcgMEwxMCAzOS42Yy0wLjggMC44LTAuOCAyIDAgMi44IDAuOCAwLjggMiAwLjggMi43IDBsMTAuNy0xMC43QzI0LjIgMzAuOSAyNC4yIDI5LjcgMjMuNCAyOC45ek0yNC44IDI0LjhjLTAuOCAwLjgtMC44IDIgMCAyLjggMC44IDAuOCAyIDAuOCAyLjcgMCAwLjgtMC44IDAuOC0yIDAtMi44QzI2LjggMjQgMjUuNiAyNCAyNC44IDI0Ljh6TTIzLjMgMTIuN2MwLjgtMC44IDAuOC0yIDAtMi44IC0wLjgtMC44LTItMC44LTIuNyAwIC0wLjggMC44LTAuOCAyIDAgMi44QzIxLjMgMTMuNSAyMi41IDEzLjUgMjMuMyAxMi43eiIvPgo8cGF0aCBjbGFzcz0ibG9nb19fd29yZG1hcmsiIHN0eWxlPSJmaWxsOiAjRkZGRkZGOyIgZD0iTTc5LjQgMTYuNmwzLjktMy45YzAuOC0wLjggMC44LTIgMC0yLjcgLTAuNC0wLjQtMC45LTAuNi0xLjQtMC42IC0wLjMgMC0wLjcgMC4xLTEgMC4zbC0wLjEgMC4xYy0wLjEgMC0wLjEgMC4xLTAuMiAwLjFMNzkuNSAxMWwtMC4xIDAuMUw3MS40IDE5Yy0wLjggMC45LTEuMyAxLjctMS43IDIuNiAtMC40IDAuOS0wLjcgMi0wLjcgMy4xIDAgMC4xIDAgMC4yIDAgMC4zIDAgMC4xIDAgMC4yIDAgMC4zIDAgNC45IDMuOSA4LjkgOC44IDguOSA0LjkgMCA4LjgtNCA4LjgtOC45Qzg2LjcgMjAuOSA4My41IDE3LjMgNzkuNCAxNi42ek03Ny45IDMwLjNjLTIuNyAwLTUtMi4yLTUtNSAwLTIuNyAyLjItNSA1LTUgMi43IDAgNSAyLjIgNSA1QzgyLjggMjggODAuNiAzMC4zIDc3LjkgMzAuM3pNOTkuNyA5LjNDOTIuOSA5LjMgODggMTQuOSA4OCAyMS43YzAgNi44IDQuOSAxMi40IDExLjcgMTIuNCA2LjggMCAxMS43LTUuNSAxMS43LTEyLjRTMTA2LjUgOS4zIDk5LjcgOS4zek05OS43IDMwLjJjLTQuNyAwLTcuOS0zLjgtNy45LTguNSAwLTQuNyAzLjItOC41IDcuOS04LjUgNC43IDAgNy45IDMuOCA3LjkgOC41QzEwNy42IDI2LjQgMTA0LjQgMzAuMiA5OS43IDMwLjJ6TTEyNC40IDkuM2MtNi44IDAtMTEuNyA1LjYtMTEuNyAxMi40IDAgNi44IDQuOSAxMi40IDExLjcgMTIuNCA2LjggMCAxMS43LTUuNSAxMS43LTEyLjRTMTMxLjIgOS4zIDEyNC40IDkuM3pNMTI0LjQgMzAuMmMtNC43IDAtNy45LTMuOC03LjktOC41IDAtNC43IDMuMi04LjUgNy45LTguNSA0LjcgMCA3LjkgMy44IDcuOSA4LjVDMTMyLjMgMjYuNCAxMjkuMSAzMC4yIDEyNC40IDMwLjJ6TTUzLjEgMzIuN2MwLjIgMC42IDAuOCAxLjQgMS45IDEuNCAwIDAgMTEuMSAwIDExLjEgMCAxLjEgMCAxLjktMC45IDEuOS0xLjkgMC0xLjEtMC45LTItMS45LTIgMCAwLTkuOCAwLTkuOCAwIC0wLjQtMy41IDIuMi01LjUgNC40LTUuN2wwLjktMC4xYzMuNy0wLjUgNi40LTMuNyA2LjQtNy41IDAtNC4yLTMuNC03LjYtNy42LTcuNiAtMy41IDAtNi40IDIuNC03LjMgNS42bDAgMGMwIDAuMS0wLjEgMC4zLTAuMSAwLjUgMCAxLjEgMC45IDEuOSAxLjkgMS45IDAuOSAwIDEuNy0wLjYgMS45LTEuNWwwLTAuMWMwLjUtMS41IDEuOS0yLjYgMy41LTIuNiAyIDAgMy43IDEuNyAzLjcgMy43IDAgMS45LTEuMyAzLjQtMy4xIDMuNmwtMC4zIDBjLTQuNyAwLjMtOC4zIDQuMy04LjMgOC42QzUyLjYgMjkuMiA1Mi41IDMwLjkgNTMuMSAzMi43eiIvPgo8cGF0aCBjbGFzcz0ibG9nb19fd29yZG1hcmsiIHN0eWxlPSJmaWxsOiAjRkZGRkZGOyIgZD0iTTE1My42IDkuM2MtMS4xIDAtMS45IDAuOS0xLjkgMS45djUuNWgtOS45di01LjVjMC0xLjEtMC45LTEuOS0xLjktMS45IC0xLjEgMC0xLjkgMC45LTEuOSAxLjl2MjAuOWMwIDEuMSAwLjkgMS45IDEuOSAxLjkgMS4xIDAgMS45LTAuOSAxLjktMS45VjIwLjZoOS45djExLjVjMCAxLjEgMC45IDEuOSAxLjkgMS45czEuOS0wLjkgMS45LTEuOVYxMS4zQzE1NS41IDEwLjIgMTU0LjYgOS4zIDE1My42IDkuM3pNMTczLjEgMzAuMmgtOUwxNzQuMiAyMGMwLjgtMC44IDAuOC0yIDAtMi43IC0wLjQtMC40LTAuOS0wLjYtMS40LTAuNiAwIDAgMCAwIDAgMGgtMTMuNWMtMS4xIDAtMS45IDAuOS0xLjkgMiAwIDEuMSAwLjkgMS45IDEuOSAxLjloOC45TDE1OCAzMC44Yy0wLjggMC44LTAuOCAyIDAgMi43IDAuMyAwLjMgMC43IDAuNSAxLjEgMC41IDAuMSAwIDAuMSAwIDAuMiAwIDAgMCAwIDAgMCAwaDEzLjdjMS4xIDAgMS45LTAuOSAxLjktMS45QzE3NSAzMS4xIDE3NC4xIDMwLjIgMTczLjEgMzAuMnoiLz4KPC9zdmc+",
          predicate: () => {
            return !this._call || !this._call.hasSession();
          },
        },
        {
          name: "ringing",
          enabled: true,
          rescale: 0.5,
          position: { mode: "center" },
          source:
            "data:image/svg+xml;base64,PHN2ZyBpZD0ic3ZnIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBkPSJNMTEuNSA2TDE2IDEuNSAxNC41IDAgMTAgNC41VjFIOHY3aDdWNnoiLz48cGF0aCBkPSJNMTIuOSAxMi40Yy0uMS0uMS0uMy0uMi0uMy0uMmwtMi45LTEtMS44IDEuMWMtLjEuMS0xLjUtLjItMi42LTEuNGwtLjMtLjNDMy43IDkuNCAzLjQgOC4yIDMuNSA4bDEuMy0xLjctMS0yLjlzLS4xLS4zLS4yLS4zYy0uMS0uMS0xLjUtLjMtMi4yLjRDLS41IDUuNC0xIDcuNCAzLjYgMTIuMWwuMy4zYzQuNyA0LjYgNi43IDQuMSA4LjYgMi4yLjctLjcuNS0yLjEuNC0yLjJ6Ii8+PC9zdmc+",
          predicate: () => {
            return this._call && this._call.isRinging();
          },
        },
        {
          name: "muted",
          enabled: true,
          rescale: 0.5,
          position: { mode: "center" },
          source:
            "data:image/svg+xml;base64,PHN2ZyBpZD0ic3ZnIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyLDZsNC0ydjhsLTQtMnYyYzAsMC42LTAuNCwxLTEsMUg0bC0zLDNsLTEtMUwxNSwwbDEsMWwtNCw0VjZ6IE0xMCwzSDFDMC40LDMsMCwzLjUsMCw0djgmIzEwOyYjOTtjMCwwLjMsMC4xLDAuNSwwLjMsMC43TDEwLDN6Ii8+Cjwvc3ZnPg==",
          predicate: () => {
            return this._call && this._call.isMuted();
          },
        },
        {
          name: "held",
          enabled: true,
          rescale: 0.5,
          position: { mode: "center" },
          source:
            "data:image/svg+xml;base64,PHN2ZyBpZD0ic3ZnIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBkPSJNNSA1aDJ2Nkg1VjV6bTQgMGgydjZIOVY1eiIvPjxwYXRoIGQ9Ik04IDE2YzQuNCAwIDgtMy42IDgtOHMtMy42LTgtOC04LTggMy42LTggOCAzLjYgOCA4IDh6TTggMmMzLjMgMCA2IDIuNyA2IDZzLTIuNyA2LTYgNi02LTIuNy02LTYgMi43LTYgNi02eiIvPjwvc3ZnPg==",
          predicate: () => {
            return this._call && this._call.isOnHold();
          },
        },
        {
          name: "defaultAvatar",
          enabled: true,
          rescale: 0.1,
          position: { mode: "center" },
          source:
            "data:image/svg+xml;base64,PHN2ZyBpZD0ic3ZnIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBkPSJNMTIuNiA3Yy0xIDEuNS0yLjcgMi41LTQuNiAyLjVTNC40IDguNSAzLjQgN0MyLjkgNy4xIDAgOCAwIDEzYzAgMi43IDQgMyA4IDNzOC0uMyA4LTNjMC01LTIuOS01LjktMy40LTZ6Ii8+PGNpcmNsZSBjeD0iOCIgY3k9IjQiIHI9IjQiLz48L3N2Zz4=",
          predicate: () => {
            return this._call && this._call.hasSession();
          },
          arc: true,
        },
      ],
    };
    this._config = lwpUtils.merge(defaults, config);

    this._canvasRender = null;
  }

  _initEventBindings() {
    this._libwebphone.on("videoCanvas.render.ready", () => {
      this._createCanvasRender(this._config.canvas);
    });

    this._libwebphone.on("call.promoted", (lwp, call) => {
      this._callPromoted(call);
    });
    this._libwebphone.on(
      "call.primary.timeupdate",
      (lwp, call, start, duration, prettyDuration) => {
        this._callTimeupdate(call, prettyDuration);
      }
    );
    this._libwebphone.on(
      "call.primary.remote.video.playing",
      (lwp, call, element) => {
        this._setRemoteElement(element);
      }
    );
    this._libwebphone.on(
      "call.primary.remote.video.timeupdate",
      (lwp, call, element) => {
        this._setRemoteElement(element);
      }
    );
    this._libwebphone.on(
      "call.primary.local.video.playing",
      (lwp, call, element) => {
        this._setLocalElement(element);
      }
    );
    this._libwebphone.on(
      "call.primary.local.video.timeupdate",
      (lwp, call, element) => {
        this._setLocalElement(element);
      }
    );

    this._libwebphone.on("videoCanvas.localVideo.enabled.changed", () => {
      this.updateRenders();
    });
    this._libwebphone.on("videoCanvas.localVideo.rescale.changed", () => {
      this.updateRenders();
    });
    this._libwebphone.on("videoCanvas.localVideo.position.changed", () => {
      this.updateRenders();
    });

    this._libwebphone.on("videoCanvas.framesPerSecond.changed", () => {
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
    this._config.renderTargets.map((renderTarget) => {
      return this.renderAddTarget(renderTarget);
    });
  }

  /** Render Helpers */

  _renderDefaultConfig() {
    return {
      template: this._renderDefaultTemplate(),
      i18n: {
        localVideo: "libwebphone:videoCanvas.localVideo",
        remoteVideo: "libwebphone:videoCanvas.remoteVideo",
        video: "libwebphone:videoCanvas.video",
        show: "libwebphone:videoCanvas.show",
        hide: "libwebphone:videoCanvas.hide",
        rescale: "libwebphone:videoCanvas.rescale",
        position: "libwebphone:videoCanvas.position",
        x: "libwebphone:videoCanvas.x",
        y: "libwebphone:videoCanvas.y",

        center: "libwebphone:videoCanvas.center",
        topleft: "libwebphone:videoCanvas.topleft",
        topright: "libwebphone:videoCanvas.topright",
        bottomleft: "libwebphone:videoCanvas.bottomleft",
        bottomright: "libwebphone:videoCanvas.bottomright",
        absolute: "libwebphone:videoCanvas.absolute",
        relative: "libwebphone:videoCanvas.relative",

        framespersecond: "libwebphone:videoCanvas.framespersecond",
        fullscreen: "libwebphone:videoCanvas.fullscreen",
        startfullscreen: "libwebphone:videoCanvas.startfullscreen",
        stopfullscreen: "libwebphone:videoCanvas.stopfullscreen",
      },
      data: lwpUtils.merge({}, this._config, this._renderData()),
      by_id: {
        localVideoEnabled: {
          events: {
            onclick: (event) => {
              this.toggleImage(this._config.localVideo.name);
            },
          },
        },
        localVideoRescale: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.rescaleImage(
                this._config.localVideo.name,
                element.value / 100
              );
            },
          },
        },
        localVideoPosition: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.positionImage(this._config.localVideo.name, element.value);
            },
          },
        },
        localVideoRelativeX: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.positionImage(
                this._config.localVideo.name,
                "relative",
                element.value / 100
              );
            },
          },
        },
        localVideoRelativeY: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.positionImage(
                this._config.localVideo.name,
                "relative",
                null,
                element.value / 100
              );
            },
          },
        },
        localVideoAbsoluteX: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.positionImage(
                this._config.localVideo.name,
                "absolute",
                element.value
              );
            },
          },
        },
        localVideoAbsoluteY: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.positionImage(
                this._config.localVideo.name,
                "absolute",
                null,
                element.value / 100
              );
            },
          },
        },
        canvasframesPerSecond: {
          events: {
            onchange: (event) => {
              let element = event.srcElement;
              this.changeFramesPerSecond(element.value);
            },
          },
        },
      },
    };
  }

  _renderDefaultTemplate() {
    return `
        {{#data.localVideo.show}}          
          <div>
            <label for="{{by_id.localVideoEnabled.elementId}}">
                {{i18n.localVideo}}
            </label>
            <button id="{{by_id.localVideoEnabled.elementId}}">
                {{^data.localVideo.enabled}}
                    {{i18n.hide}}
                {{/data.localVideo.enabled}}

                {{#data.localVideo.enabled}}
                    {{i18n.show}}
                {{/data.localVideo.enabled}}
            </button>
          </div>

          <div>
            <label for="{{by_id.localVideoRescale.elementId}}">
              {{i18n.rescale}}
            </label>
            <input type="range" min="1" max="100" value="{{data.localVideo.rescale}}" id="{{by_id.localVideoRescale.elementId}}">
          </div>

          <div>
            <label for="{{by_id.localVideoPosition.elementId}}">
              {{i18n.position}}
            </label>
            <select id="{{by_id.localVideoPosition.elementId}}">
              <option value="center" {{#data.localVideo.position.center}}selected{{/data.localVideo.position.center}}>{{i18n.center}}</option>
              <option value="top-left" {{#data.localVideo.position.topleft}}selected{{/data.localVideo.position.topleft}}>{{i18n.topleft}}</option>
              <option value="top-right" {{#data.localVideo.position.topright}}selected{{/data.localVideo.position.topright}}>{{i18n.topright}}</option>
              <option value="bottom-left" {{#data.localVideo.position.bottomleft}}selected{{/data.localVideo.position.bottomleft}}>{{i18n.bottomleft}}</option>
              <option value="bottom-right" {{#data.localVideo.position.bottomright}}selected{{/data.localVideo.position.bottomright}}>{{i18n.bottomright}}</option>
              <option value="relative" {{#data.localVideo.position.relative}}selected{{/data.localVideo.position.relative}}>{{i18n.relative}}</option>
              <option value="absolute" {{#data.localVideo.position.absolute}}selected{{/data.localVideo.position.absolute}}>{{i18n.absolute}}</option>
            </select>
          </div>

          {{#data.localVideo.position.relative}}
            <div>
              <label for="{{by_id.localVideoRelativeX.elementId}}">
                {{i18n.x}}
              </label>
              <input type="range" min="0" max="{{data.localVideo.position.maximumX}}" value="{{data.localVideo.position.relativeX}}" id="{{by_id.localVideoRelativeX.elementId}}">
            </div>

            <div>
              <label for="{{by_id.localVideoRelativeY.elementId}}">
                {{i18n.y}}
              </label>
              <input type="range" min="0" max="{{data.localVideo.position.maximumY}}" value="{{data.localVideo.position.relativeY}}" id="{{by_id.localVideoRelativeY.elementId}}">
            </div>
          {{/data.localVideo.position.relative}}


          {{#data.localVideo.position.absolute}}
            <div>
              <label for="{{by_id.localVideoAbsoluteX.elementId}}">
                {{i18n.x}}
              </label>
              <input type="range" min="0" max="{{data.localVideo.position.maximumX}}" value="{{data.localVideo.position.absoluteX}}" id="{{by_id.localVideoAbsoluteX.elementId}}">
            </div>

            <div>
              <label for="{{by_id.localVideoAbsoluteY.elementId}}">
                {{i18n.y}}
              </label>
              <input type="range" min="0" max="{{data.localVideo.position.maximumY}}" value="{{data.localVideo.position.absoluteX}}" id="{{by_id.localVideoAbsoluteY.elementId}}">
            </div>
          {{/data.localVideo.position.absolute}}

        {{/data.localVideo.show}}

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
    `;
  }

  _renderData(
    data = {
      localVideo: {},
      remoteVideo: {},
      canvasLoop: {},
    }
  ) {
    let localVideo = this._canvasGetImage(
      this._canvasRender,
      this._config.localVideo.name
    );

    if (!localVideo) {
      localVideo = {};
    }

    if (!localVideo.position) {
      localVideo.position = this._config.localVideo.position;
    }

    data.localVideo.position = {
      mode: localVideo.position.mode,
      center: localVideo.position.mode == "center",
      topleft: localVideo.position.mode == "top-left",
      topright: localVideo.position.mode == "top-right",
      bottomleft: localVideo.position.mode == "bottom-left",
      bottomright: localVideo.position.mode == "bottom-right",
      relative: localVideo.position.mode == "relative",
      absolute: localVideo.position.mode == "absolute",
      maximumX: 0,
      maximumY: 0,
    };

    if (data.localVideo.position.relative) {
      data.localVideo.position.relativeX = (localVideo.position.x || 0) * 100;
      data.localVideo.position.relativeY = (localVideo.position.y || 0) * 100;
      data.localVideo.position.maximumX = 100;
      data.localVideo.position.maximumY = 100;
    } else if (data.localVideo.position.absolute) {
      data.localVideo.position.absoluteX = localVideo.position.x || 0;
      data.localVideo.position.absoluteY = localVideo.position.y || 0;
      if (this._canvasRender.element) {
        data.localVideo.position.maximumX = this._canvasRender.element.width;
        data.localVideo.position.maximumY = this._canvasRender.element.height;
      }
    }

    data.localVideo.rescale = this._config.localVideo.rescale * 100;

    data.canvasLoop.framesPerSecond = this._config.canvasLoop.framesPerSecond;

    return data;
  }

  /** Helper functions */
  _configGetImage(name) {
    switch (name) {
      case this._config.localVideo.name:
        return this._config.localVideo;
      case this._config.remoteVideo.name:
        return this._config.remoteVideo;
      default:
        return this._config.images.find((image) => {
          return image.name == name;
        });
    }
  }

  _callPromoted(call = null) {
    this._call = call;

    this._setCanvasImage(this._canvasRender, this._config.localVideo.name);
    this._setCanvasImage(this._canvasRender, this._config.remoteVideo.name);

    if (!call._statusLines) {
      call._statusLines = [];
    }

    if (call && call.hasSession()) {
      let line = call._statusLines.find((line) => {
        return line.type == "remoteIdentity";
      });

      if (line) {
        line.text = call.remoteIdentity();
      } else {
        let canvasRender = this._canvasRender;

        if (!canvasRender) {
          return;
        }

        call._statusLines.push(
          this._createStatusLine(canvasRender, {
            text: call.remoteIdentity(),
            type: "remoteIdentity",
          })
        );
      }
    }

    this.updateRenders();
  }

  _callTimeupdate(call, prettyDuration) {
    if (!call._statusLines) {
      call._statusLines = [];
    }

    let line = call._statusLines.find((line) => {
      return line.type == "duration";
    });

    if (line) {
      line.text = prettyDuration;
    } else {
      let canvasRender = this._canvasRender;

      if (!canvasRender) {
        return;
      }

      call._statusLines.push(
        this._createStatusLine(canvasRender, {
          text: prettyDuration,
          type: "duration",
        })
      );
    }
  }

  _setRemoteElement(element = null) {
    let name = this._config.remoteVideo.name;
    this._setElement(name, element, this._config.remoteVideo);
  }

  _setLocalElement(element = null) {
    let name = this._config.localVideo.name;
    this._setElement(name, element, this._config.localVideo);
  }

  _setElement(name, element = null, options = {}) {
    let canvasRender = this._canvasRender;

    if (!element) {
      this._setCanvasImage(canvasRender, name);
      return;
    }

    this._checkCanvasImage(canvasRender, name, element, options);
  }

  /** Canvas Image functions */
  _setCanvasImage(canvasRender, name, source = null, options = {}) {
    if (!canvasRender) {
      return;
    }

    let index = canvasRender.data.images.findIndex((image) => {
      return image.name == name;
    });

    if (index != -1) {
      canvasRender.data.images.splice(index, 1);
    }

    if (!source) {
      return;
    }

    let canvasWidth = canvasRender.root.element.width;
    let canvasHeight = canvasRender.root.element.height;
    let sourceWidth =
      options.sourceWidth || source.videoWidth || source.width || canvasWidth;
    let sourceHeight =
      options.sourceHeight ||
      source.videoHeight ||
      source.height ||
      canvasHeight;
    let scale = Math.min(
      canvasWidth / sourceWidth,
      canvasHeight / sourceHeight
    );
    let scaledWidth = sourceWidth * scale;
    let scaledHeight = sourceHeight * scale;
    let canvasImage = {
      enabled: true,
      source: {
        stream: source,
        x: 0,
        y: 0,
        width: sourceWidth,
        height: sourceHeight,
      },
      position: { mode: "center", x: null, y: null },
      destination: {
        original: {
          scale: scale,
          x: canvasWidth / 2 - scaledWidth / 2,
          y: canvasHeight / 2 - scaledHeight / 2,
          width: scaledWidth,
          height: scaledHeight,
        },
      },
    };

    canvasImage.name = name;
    canvasImage.destination.current = lwpUtils.merge(
      {},
      canvasImage.destination.original
    );

    if (options.rescale) {
      this._rescaleCanvasImage(canvasRender, canvasImage, options.rescale);
    }

    if (options.position) {
      this._positionCanvasImage(
        canvasRender,
        canvasImage,
        options.position.mode,
        options.position.x,
        options.position.y
      );
    }

    if (options.averageRGB) {
      this._averageCanvasImageRGB(
        canvasRender,
        canvasImage,
        options.averageRGB
      );
    }

    if (options.predicate) {
      canvasImage.predicate = options.predicate;
    } else {
      canvasImage.predicate = () => {
        return false;
      };
    }

    if (options.arc) {
      canvasImage.arc = true;
    }

    canvasRender.data.images.push(canvasImage);

    this.updateRenders();

    return canvasImage;
  }

  _checkCanvasImage(canvasRender, name, source = null, options = {}) {
    if (!canvasRender) {
      return;
    }

    let canvasImage = this._canvasGetImage(canvasRender, name);

    if (!canvasImage) {
      return this._setCanvasImage(canvasRender, name, source, options);
    }

    let canvasWidth = canvasRender.root.element.width;
    let canvasHeight = canvasRender.root.element.height;
    let sourceWidth =
      options.sourceWidth || source.videoWidth || source.width || canvasWidth;
    let sourceHeight =
      options.sourceHeight ||
      source.videoHeight ||
      source.height ||
      canvasHeight;
    let scale = Math.min(
      canvasWidth / sourceWidth,
      canvasHeight / sourceHeight
    );
    let rescaled = false;

    if (canvasImage.source.width != sourceWidth) {
      canvasImage.source.width = sourceWidth;
      rescaled = true;
    }

    if (canvasImage.source.height != sourceHeight) {
      canvasImage.source.height = sourceHeight;
      rescaled = true;
    }

    if (rescaled || canvasImage.destination.original.scale != scale) {
      canvasImage.destination.original.scale = scale;

      canvasImage.destination.original.x =
        canvasWidth / 2 - (canvasImage.source.width / 2) * scale;
      canvasImage.destination.original.width = canvasImage.source.width * scale;

      canvasImage.destination.original.y =
        canvasHeight / 2 - (canvasImage.source.height / 2) * scale;
      canvasImage.destination.original.height =
        canvasImage.source.height * scale;

      rescaled = true;
    }

    if (rescaled) {
      this._rescaleCanvasImage(canvasRender, canvasImage);
    }

    if (canvasImage.averageRGB) {
      this._averageCanvasImageRGB(canvasRender, canvasImage);
    }

    return canvasImage;
  }

  _rescaleCanvasImage(canvasRender, canvasImage, scale = null) {
    if (!canvasRender || !canvasImage) {
      return;
    }

    if (scale) {
      canvasImage.destination.current.scale = scale;
    }

    canvasImage.destination.current.width =
      canvasImage.destination.original.width *
      canvasImage.destination.current.scale;
    canvasImage.destination.current.height =
      canvasImage.destination.original.height *
      canvasImage.destination.current.scale;

    return this._positionCanvasImage(canvasRender, canvasImage);
  }

  _positionCanvasImage(
    canvasRender,
    canvasImage,
    mode = null,
    x = null,
    y = null
  ) {
    if (!canvasRender || !canvasImage) {
      return;
    }

    let canvasWidth = canvasRender.root.element.width;
    let canvasHeight = canvasRender.root.element.height;

    if (!canvasImage.position) {
      canvasImage.position = {};
    }

    if (mode) {
      canvasImage.position.mode = mode;
    }

    switch (canvasImage.position.mode) {
      case "delta":
        canvasImage.position.x = canvasImage.destination.current.x;
        canvasImage.position.y = canvasImage.destination.current.y;

        if (x !== null) {
          canvasImage.position.x += x;
        }

        if (y !== null) {
          canvasImage.position.y += y;
        }

        canvasImage.position.mode = "absolute";
        break;
      case "absolute":
        canvasImage.position.x = canvasImage.destination.current.x;
        canvasImage.position.y = canvasImage.destination.current.y;

        if (x !== null) {
          canvasImage.position.x = x;
        }

        if (y !== null) {
          canvasImage.position.y = y;
        }
        break;
      case "relative":
        canvasImage.position.x =
          (canvasImage.destination.current.x +
            canvasImage.destination.current.width / 2) /
          canvasWidth;
        canvasImage.position.y =
          (canvasImage.destination.current.y +
            canvasImage.destination.current.height / 2) /
          canvasHeight;

        if (x !== null) {
          canvasImage.position.x = x;
        }

        if (y !== null) {
          canvasImage.position.y = y;
        }
        break;
    }

    switch (canvasImage.position.mode) {
      case "absolute":
        canvasImage.destination.current.x = canvasImage.position.x;
        canvasImage.destination.current.y = canvasImage.position.y;
        break;
      case "relative":
        canvasImage.destination.current.x =
          canvasWidth * canvasImage.position.x -
          canvasImage.destination.current.width / 2;
        canvasImage.destination.current.y =
          canvasHeight * canvasImage.position.y -
          canvasImage.destination.current.height / 2;
        break;
      case "top-left":
        canvasImage.destination.current.x = 0;
        canvasImage.destination.current.y = 0;
        break;
      case "top-right":
        canvasImage.destination.current.x =
          canvasWidth - canvasImage.destination.current.width;
        canvasImage.destination.current.y = 0;
        break;
      case "bottom-left":
        canvasImage.destination.current.x = 0;
        canvasImage.destination.current.y =
          canvasHeight - canvasImage.destination.current.height;
        break;
      case "bottom-right":
        canvasImage.destination.current.x =
          canvasWidth - canvasImage.destination.current.width;
        canvasImage.destination.current.y =
          canvasHeight - canvasImage.destination.current.height;
        break;
      case "center":
      default:
        canvasImage.position.mode = "center";

        canvasImage.destination.current.x =
          canvasWidth / 2 - canvasImage.destination.current.width / 2;
        canvasImage.destination.current.y =
          canvasHeight / 2 - canvasImage.destination.current.height / 2;
        break;
    }

    return this._constrainCanvasImage(canvasRender, canvasImage);
  }

  _constrainCanvasImage(canvasRender, canvasImage) {
    if (!canvasRender || !canvasImage) {
      return;
    }

    let left = canvasImage.destination.current.x;
    let right =
      canvasImage.destination.current.x + canvasImage.destination.current.width;
    let top = canvasImage.destination.current.y;
    let bottom =
      canvasImage.destination.current.y +
      canvasImage.destination.current.height;
    let canvasWidth = canvasRender.root.element.width;
    let canvasHeight = canvasRender.root.element.height;

    if (left < 0) {
      canvasImage.destination.current.x = 0;
    } else if (right > canvasWidth) {
      canvasImage.destination.current.x =
        canvasWidth - canvasImage.destination.current.width;
    }

    if (top < 0) {
      canvasImage.destination.current.y = 0;
    } else if (bottom > canvasHeight) {
      canvasImage.destination.current.y =
        canvasHeight - canvasImage.destination.current.height;
    }
    this.updateRenders();

    return canvasImage;
  }

  _averageCanvasImageRGB(canvasRender, canvasImage, options = {}) {
    if (!canvasImage) {
      return;
    }

    let stepSize = 10 * 4; // every 10th pixel of the RGBA (4 elements) 2d array

    if (!canvasImage.averageRGB) {
      canvasImage.averageRGB = {
        canvas: document.createElement("canvas"),
        red: 0,
        green: 0,
        blue: 0,
        distance: 0,
        threshold: 0,
      };
    }

    if (!canvasImage.averageRGB.context) {
      canvasImage.averageRGB.context = canvasImage.averageRGB.canvas.getContext(
        "2d"
      );
    }

    canvasImage.averageRGB.context.drawImage(canvasImage.source.stream, 0, 0);
    let imageData = canvasImage.averageRGB.context.getImageData(
      0,
      0,
      canvasImage.averageRGB.canvas.width,
      canvasImage.averageRGB.canvas.height
    );

    canvasImage.averageRGB.red = 0;
    canvasImage.averageRGB.green = 0;
    canvasImage.averageRGB.blue = 0;

    for (let index = 0; index < imageData.data.length; index += stepSize) {
      canvasImage.averageRGB.red += imageData.data[index];
      canvasImage.averageRGB.green += imageData.data[index + 1];
      canvasImage.averageRGB.blue += imageData.data[index + 2];
      /// ignore alpha (imageData.data[index + 3])
    }

    // ~~ used to floor values
    let count = imageData.data.length / stepSize;
    canvasImage.averageRGB.red = ~~(canvasImage.averageRGB.red / count);
    canvasImage.averageRGB.green = ~~(canvasImage.averageRGB.green / count);
    canvasImage.averageRGB.blue = ~~(canvasImage.averageRGB.blue / count);

    // how far are we from a solid color (such as all black)
    canvasImage.averageRGB.distance =
      Math.abs(canvasImage.averageRGB.red - canvasImage.averageRGB.green) +
      Math.abs(canvasImage.averageRGB.red - canvasImage.averageRGB.blue) +
      Math.abs(canvasImage.averageRGB.green - canvasImage.averageRGB.blue);

    if (options.threshold) {
      canvasImage.averageRGB.threshold = options.threshold;
    }

    return canvasImage;
  }

  /** Canvas Text functions */
  _createStatusLine(canvasRender, line) {
    let defaults = {
      font: "14px sans-serif",
      fillStyle: "#ffffff",
      textAlign: "left",
      textBaseline: "top",
      type: "undefined",
      x: canvasRender.root.element.width / 2,
      y: canvasRender.root.element.height / 2,
    };

    line = lwpUtils.merge(defaults, line);

    if (!line.canvas) {
      line.canvas = document.createElement("canvas");
    }

    if (!line.context) {
      line.context = line.canvas.getContext("2d");
    }

    line.measurements = line.context.measureText(line.text);

    line.expectedHeight =
      (line.measurements.actualBoundingBoxAscent || 12) +
      (line.measurements.actualBoundingBoxDescent || 12);

    return line;
  }

  /** Canvas Render functions */
  _createCanvasRender(config) {
    let defaults = {
      root: {
        elementId: null,
        element: null,
      },
      context: null,
      data: {
        images: [],
        strings: [],
        fills: {
          background: "#2e2e32",
          avatar: "#909099",
        },
        strokes: {
          debug: "white",
        },
      },
      timer: null,
      framesPerSecond: null,
    };
    let canvasRender = lwpUtils.merge(defaults, config);

    if (!canvasRender.root.element && canvasRender.root.elementId) {
      canvasRender.root.element = document.getElementById(
        canvasRender.root.elementId
      );
    }

    if (!canvasRender.root.element) {
      canvasRender.root.element = document.createElement("canvas");
      canvasRender.root.element.width = this._config.canvas.defaultWidth;
      canvasRender.root.element.height = this._config.canvas.defaultHeight;
    }

    if (!canvasRender.context && canvasRender.root.element) {
      canvasRender.context = canvasRender.root.element.getContext("2d");
    }

    this._config.images.forEach((options) => {
      let element = document.createElement("img");
      element.onload = () => {
        this._setCanvasImage(canvasRender, options.name, element, options);
      };
      if (options.source) {
        element.src = options.source;
      }
    });

    this._dialpadStatusLine = this._createStatusLine(canvasRender, {
      text: "",
      type: "dialpadTarget",
    });

    canvasRender.framesPerSecond = this._config.canvasLoop.framesPerSecond;
    canvasRender.timer = setInterval(() => {
      this._renderCanvas(canvasRender);
    }, 1000 / canvasRender.framesPerSecond);

    this._canvasRender = canvasRender;
  }

  _renderCanvas(canvasRender) {
    let padding = 15;
    let totalHeight = 0;
    let currentHeight = 0;
    let statusLines = [];
    let canvasWidth = canvasRender.root.element.width;
    let canvasHeight = canvasRender.root.element.height;

    canvasRender.context.fillStyle = canvasRender.data.fills.background;
    canvasRender.context.fillRect(0, 0, canvasWidth, canvasHeight);

    if (canvasRender.debug) {
      canvasRender.context.beginPath();
      canvasRender.context.moveTo(canvasWidth / 2, 0);
      canvasRender.context.lineTo(canvasWidth / 2, canvasHeight);
      canvasRender.context.strokeStyle = canvasRender.data.strokes.debug;
      canvasRender.context.stroke();

      canvasRender.context.beginPath();
      canvasRender.context.moveTo(0, canvasHeight / 2);
      canvasRender.context.lineTo(canvasWidth, canvasHeight / 2);
      canvasRender.context.strokeStyle = canvasRender.data.strokes.debug;
      canvasRender.context.stroke();
    }

    if (
      this._config.remoteVideo.enabled &&
      this._canvasHasImage(canvasRender, this._config.remoteVideo.name, {
        checkShouldShow: true,
      })
    ) {
      this._renderCanvasImage(
        canvasRender,
        this._canvasGetImage(canvasRender, this._config.remoteVideo.name)
      );

      return;
    }

    if (this._config.localVideo.enabled) {
      this._renderCanvasImage(
        canvasRender,
        this._canvasGetImage(canvasRender, this._config.localVideo.name, {
          checkShouldShow: true,
        })
      );
    }

    let image = this._canvasRender.data.images.find((image) => {
      return image.predicate() && image.enabled && image.source.stream;
    });

    if (image) {
      if (image.arc) {
        let radius = Math.hypot(
          image.destination.current.width,
          image.destination.current.height
        );
        totalHeight += radius;
        currentHeight = canvasHeight / 2 - totalHeight / 2;

        canvasRender.context.beginPath();
        canvasRender.context.fillStyle = canvasRender.data.fills.avatar; // Perhaps just average the avatar RGB?
        canvasRender.context.arc(
          image.destination.current.x + image.destination.current.width / 2,
          currentHeight + image.destination.current.height / 2,
          radius / 2,
          0,
          2 * Math.PI
        );
        canvasRender.context.fill();

        this._renderCanvasImage(canvasRender, image, currentHeight);

        currentHeight += radius;
      } else {
        totalHeight += image.destination.current.height;

        currentHeight = canvasHeight / 2 - totalHeight / 2;
        currentHeight += this._renderCanvasImage(
          canvasRender,
          image,
          currentHeight
        );
      }
    }

    statusLines.forEach((line) => {
      currentHeight += padding;
      this._renderStatusLine(canvasRender, line, currentHeight);
      currentHeight += line.expectedHeight;
    });
  }

  _canvasGetImage(canvasRender, name, options = { checkShouldShow: false }) {
    if (!canvasRender) {
      return;
    }

    let canvasImage = canvasRender.data.images.find((image) => {
      return image.name == name;
    });

    if (!canvasImage) {
      return;
    }

    if (
      options.checkShouldShow &&
      (!canvasImage.enabled ||
        !canvasImage.source ||
        (canvasImage.averageRGB &&
          canvasImage.averageRGB.distance <= canvasImage.averageRGB.threshold))
    ) {
      return;
    }

    return canvasImage;
  }

  _canvasHasImage(canvasRender, name, options = {}) {
    return !!this._canvasGetImage(canvasRender, name, options);
  }

  _renderCanvasImage(canvasRender, image, y = null, x = null) {
    if (!canvasRender || !image) {
      return 0;
    }

    if (x) {
      image.destination.current.x = x;
    }

    if (y) {
      image.destination.current.y = y;
    }

    canvasRender.context.drawImage(
      image.source.stream,
      image.source.x,
      image.source.y,
      image.source.width,
      image.source.height,
      image.destination.current.x,
      image.destination.current.y,
      image.destination.current.width,
      image.destination.current.height
    );

    if (canvasRender.debug) {
      canvasRender.context.beginPath();
      canvasRender.context.strokeStyle = canvasRender.data.strokes.debug;
      canvasRender.context.strokeRect(
        image.destination.current.x,
        image.destination.current.y,
        image.destination.current.width,
        image.destination.current.height
      );
      canvasRender.context.stroke();
    }

    return image.destination.current.height;
  }

  _renderStatusLine(canvasRender, line, y = null, x = null) {
    if (!canvasRender || !line) {
      return;
    }

    if (!x) {
      x = line.x;
    }

    if (!y) {
      y = line.y;
    }

    line.measurements = canvasRender.context.measureText(line.text);

    canvasRender.context.font = line.font;
    canvasRender.context.fillStyle = line.fillStyle;
    canvasRender.context.textAlign = line.textAlign;
    canvasRender.context.textBaseline = line.textBaseline;

    canvasRender.context.fillText(
      line.text,
      x - line.measurements.width / 2,
      y
    );
  }
}
