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
    if (ratio > 0 && ratio <= 1) {
      this._config.pictureInPicture.ratio = ratio;
      this._rescale(this._localVideo, this._config.pictureInPicture.ratio);
      this._emit("pictureInPicture.ratio.change", this, ratio);
    }
  }

  changeCanvasFramesPerSecond(framesPerSecond) {
    this._config.canvasLoop.framesPerSecond = framesPerSecond;

    if (this._canvasRender) {
      clearInterval(this._canvasRender);
    }

    this._canvasRender = setInterval(() => {
      this._renderCanvas();
    }, 1000 / this._config.canvasLoop.framesPerSecond);

    this._emit("canvas.framesPerSecond.change", this, framesPerSecond);
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
    let resourceBundles = lwpUtils.merge(
      defaults,
      config.resourceBundles || {}
    );
    this._libwebphone.i18nAddResourceBundles("videoCanvas", resourceBundles);
  }

  _initProperties(config) {
    if (config.canvas && typeof config.canvas == "string") {
      config.canvas = { elementId: config.canvas };
    }

    let defaults = {
      renderTargets: [],
      canvas: {
        elementId: null,
        element: null,
        context: null,
      },
      screenshare: {
        show: false,
      },
      fullscreen: {
        show: false,
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
      },
      backgrounds: {
        disconnected:
          "data:image/svg+xml;base64,PHN2ZyBpZD0idGVzdCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB3aWR0aD0iNzAuNTQ2N21tIiBoZWlnaHQ9IjcwLjU0NjdtbSIgdmlld0JveD0iMCAwIDIwMCAyMDAiPgo8cGF0aCBpZD0iU2VsZWN0aW9uIiBmaWxsPSJ3aGl0ZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIxIiBkPSJNIDEwNC4wMCwxMjUuMDAmIzEwOyAgICAgICAgICAgQyAxMDQuMDAsMTI1LjAwIDExMS40Miw4NS4wMCAxMTEuNDIsODUuMDAmIzEwOyAgICAgICAgICAgICAxMTMuMjQsNzYuNzkgMTE5LjM5LDUzLjkzIDExOC45MCw0Ny4wMCYjMTA7ICAgICAgICAgICAgIDExNy40OSwyNi44MiA5MC45OCwyNS4wNyA4My4yMywzOC4wMiYjMTA7ICAgICAgICAgICAgIDc5LjUzLDQ0LjE5IDgxLjA1LDU0LjI2IDgyLjQwLDYxLjAwJiMxMDsgICAgICAgICAgICAgODIuNDAsNjEuMDAgOTIuMjUsMTA2LjAwIDkyLjI1LDEwNi4wMCYjMTA7ICAgICAgICAgICAgIDkyLjgwLDEwOS4xOSA5NC41OCwxMjIuNDEgOTYuNTksMTIzLjk4JiMxMDsgICAgICAgICAgICAgOTguMjIsMTI1LjI0IDEwMS45OCwxMjQuOTkgMTA0LjAwLDEyNS4wMCBaJiMxMDsgICAgICAgICAgIE0gNzQuMDAsNTEuMDAmIzEwOyAgICAgICAgICAgQyA3NC4wMCw0MS4wMSA3My40Nyw0Mi43NCA3Ni4wMCwzMy4wMCYjMTA7ICAgICAgICAgICAgIDU3LjY3LDMzLjQwIDMyLjQ0LDQ2LjUyIDE4LjAwLDU3LjM3JiMxMDsgICAgICAgICAgICAgMTQuNzksNTkuNzkgNS4yMiw2Ni41MyA2LjM0LDcxLjAwJiMxMDsgICAgICAgICAgICAgNi44MSw3Mi44OCA5LjYxLDc1LjYzIDExLjAwLDc2Ljk4JiMxMDsgICAgICAgICAgICAgMTIuMjQsNzguMTggMTQuMzEsODAuMjQgMTYuMDAsODAuNjYmIzEwOyAgICAgICAgICAgICAxOS40Myw4MS41MyAyOS43MSw3MS43OSAzMy4wMCw2OS40MyYjMTA7ICAgICAgICAgICAgIDQ1LjIxLDYwLjY3IDU5LjIxLDUzLjk4IDc0LjAwLDUxLjAwIFomIzEwOyAgICAgICAgICAgTSAxMjQuMDAsMzMuMDAmIzEwOyAgICAgICAgICAgQyAxMjUuMzIsNDIuMzkgMTI2LjgyLDQwLjg0IDEyNS4wMCw1MS4wMCYjMTA7ICAgICAgICAgICAgIDEzOS43MCw1Ni41MCAxNDcuMDUsNTcuOTEgMTYxLjAwLDY3LjA4JiMxMDsgICAgICAgICAgICAgMTY0LjgzLDY5LjYwIDE2OS40OCw3My4zMCAxNzMuMDAsNzYuMjgmIzEwOyAgICAgICAgICAgICAxNzQuNDcsNzcuNTMgMTc3LjE5LDgwLjIyIDE3OS4wMCw4MC42NiYjMTA7ICAgICAgICAgICAgIDE4Mi41Miw4MS41MyAxODkuNzUsNzQuMDYgMTkwLjgzLDcxLjAxJiMxMDsgICAgICAgICAgICAgMTkyLjQzLDY2LjUxIDE4MS4zNCw1OC44MyAxNzguMDAsNTYuNDMmIzEwOyAgICAgICAgICAgICAxNjIuODIsNDUuNTEgMTQyLjY3LDM1LjYzIDEyNC4wMCwzMy4wMCBaJiMxMDsgICAgICAgICAgIE0gMzIuMDAsOTguMDAmIzEwOyAgICAgICAgICAgQyAzMi4wMCw5OC4wMCA0NC4wMCwxMDkuMDAgNDQuMDAsMTA5LjAwJiMxMDsgICAgICAgICAgICAgNTIuOTIsMTAyLjY0IDU1Ljk5LDk4LjM5IDY3LjAwLDkzLjMxJiMxMDsgICAgICAgICAgICAgNjkuNjksOTIuMDcgNzkuODMsODguOTYgODAuOTcsODcuMzAmIzEwOyAgICAgICAgICAgICA4Mi4wNCw4NS43MyA4MC44OCw3MS40NCA3NC45NCw3MS42MSYjMTA7ICAgICAgICAgICAgIDY2LjQwLDcxLjg1IDQ3LjgyLDgyLjM4IDQxLjAwLDg3LjY2JiMxMDsgICAgICAgICAgICAgMzYuODcsOTAuODYgMzMuNTcsOTIuOTAgMzIuMDAsOTguMDAgWiYjMTA7ICAgICAgICAgICBNIDEyMS4wMCw3MS4wMCYjMTA7ICAgICAgICAgICBDIDEyMS4wMCw3MS4wMCAxMTcuMDAsODkuMDAgMTE3LjAwLDg5LjAwJiMxMDsgICAgICAgICAgICAgMTI2LjUzLDkwLjk0IDEzNC4wNSw5NC44NiAxNDIuMDAsMTAwLjM1JiMxMDsgICAgICAgICAgICAgMTQ0LjQ4LDEwMi4wNiAxNTAuNTcsMTA3LjgxIDE1My4wMCwxMDcuODAmIzEwOyAgICAgICAgICAgICAxNTYuMjMsMTA3LjgwIDE2My41NSw5OS40NSAxNjYuMDAsOTcuMDAmIzEwOyAgICAgICAgICAgICAxNTcuMTQsODQuODkgMTM1LjU4LDc0LjMyIDEyMS4wMCw3MS4wMCBaJiMxMDsgICAgICAgICAgIE0gNTguMDAsMTI0LjAwJiMxMDsgICAgICAgICAgIEMgNjAuODMsMTI2LjAyIDY3Ljk0LDEzMy4xNCA3MC4wMCwxMzMuNjYmIzEwOyAgICAgICAgICAgICA3Mi44NSwxMzQuMzkgNzUuNzYsMTMxLjM4IDc4LjAwLDEyOS45MSYjMTA7ICAgICAgICAgICAgIDgyLjA3LDEyNy4yNCA4NS4yMywxMjUuODcgOTAuMDAsMTI1LjAwJiMxMDsgICAgICAgICAgICAgOTAuMDAsMTI1LjAwIDg3LjAwLDEwNy4wMCA4Ny4wMCwxMDcuMDAmIzEwOyAgICAgICAgICAgICA3Ny40NywxMDguOTIgNjIuNTAsMTE0Ljk0IDU4LjAwLDEyNC4wMCBaJiMxMDsgICAgICAgICAgIE0gMTEyLjAwLDEwOC4wMCYjMTA7ICAgICAgICAgICBDIDExMi4wMCwxMDguMDAgMTA5LjAwLDEyNS4wMCAxMDkuMDAsMTI1LjAwJiMxMDsgICAgICAgICAgICAgMTEzLjU2LDEyNi41OSAxMTUuOTEsMTI3LjQ5IDEyMC4wMCwxMzAuMjImIzEwOyAgICAgICAgICAgICAxMjEuODUsMTMxLjQ1IDEyNC43MCwxMzMuOTUgMTI3LjAwLDEzMy44NCYjMTA7ICAgICAgICAgICAgIDEyOS45NywxMzMuNzEgMTM2Ljk1LDEyNi44MSAxMzcuNjYsMTI0LjAwJiMxMDsgICAgICAgICAgICAgMTM4LjA2LDEyMi40MiAxMzcuNTYsMTIxLjQyIDEzNi42MywxMjAuMTcmIzEwOyAgICAgICAgICAgICAxMzIuMzYsMTE0LjQ0IDExOS4xMiwxMDguNjUgMTEyLjAwLDEwOC4wMCBaJiMxMDsgICAgICAgICAgIE0gOTYuMDAsMTM1LjQ3JiMxMDsgICAgICAgICAgIEMgOTIuMDQsMTM2LjQ0IDg5LjMyLDEzNy4zNSA4Ni4zMywxNDAuMzMmIzEwOyAgICAgICAgICAgICA3My4zMiwxNTMuMjYgODUuMjMsMTc0Ljc0IDEwMy4wMCwxNzEuNTMmIzEwOyAgICAgICAgICAgICAxMTYuMTYsMTY5LjE1IDEyMy4yOSwxNTQuMjIgMTE1LjM1LDE0My4wMiYjMTA7ICAgICAgICAgICAgIDExMC42NiwxMzYuNDAgMTAzLjY5LDEzNC40MSA5Ni4wMCwxMzUuNDcgWiIvPgo8L3N2Zz4",
        idle:
          "data:image/svg+xml;base64,PHN2ZyBpZD0idGVzdCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2ZXJzaW9uPSIxLjEiIHg9IjAiIHk9IjAiIHdpZHRoPSIxNzUiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCAxNzUgNDkiIGNsYXNzPSJsb2dvIj4KPHBhdGggY2xhc3M9ImxvZ29fX3N5bWJvbCIgc3R5bGU9ImZpbGw6ICNmZjU5MzM7IiBkPSJNNDIuMSAwLjZjLTAuOC0wLjgtMi0wLjgtMi43IDAgLTAuOCAwLjgtMC44IDIgMCAyLjggMC44IDAuOCAyIDAuOCAyLjcgMEM0Mi45IDIuNiA0Mi45IDEuMyA0Mi4xIDAuNnpNMTEuNyAzMy45bDIyLTIyLjFjLTAuNC0wLjUtMC44LTEtMS4zLTEuNSAtMC41LTAuNS0wLjktMC45LTEuNC0xLjNMOSAzMS4yYy0wLjggMC44LTAuOCAyIDAgMi44QzkuOCAzNC43IDExIDM0LjcgMTEuNyAzMy45ek0zOCA3LjVjMC44LTAuOCAwLjgtMiAwLTIuOCAtMC44LTAuOC0yLTAuOC0yLjcgMGwtMiAyQzI2IDAuNyAxNS4yIDEuMiA4LjQgOGMtNS4xIDUuMS02LjYgMTIuNC00LjYgMTguOGwtMy4zIDMuM2MtMC44IDAuOC0wLjggMiAwIDIuOCAwLjggMC44IDIgMC44IDIuNyAwbDE1LjktMTZjMC44LTAuOCAwLjgtMiAwLTIuOCAtMC44LTAuOC0yLTAuOC0yLjcgMEw4IDIyLjdjLTAuOS00LjggMC41LTkuOSA0LjItMTMuNSA1LjktNiAxNS41LTYgMjEuNSAwIDUuOSA2IDUuOSAxNS42IDAgMjEuNiAtMy4xIDMuMS03LjIgNC42LTExLjMgNC41TDE4IDM5LjZjNS45IDEuMiAxMi4yLTAuNSAxNi44LTUuMSA2LjgtNi44IDcuMi0xNy43IDEuMy0yNUwzOCA3LjV6TTIzLjQgMjguOWMtMC44LTAuOC0yLTAuOC0yLjcgMEwxMCAzOS42Yy0wLjggMC44LTAuOCAyIDAgMi44IDAuOCAwLjggMiAwLjggMi43IDBsMTAuNy0xMC43QzI0LjIgMzAuOSAyNC4yIDI5LjcgMjMuNCAyOC45ek0yNC44IDI0LjhjLTAuOCAwLjgtMC44IDIgMCAyLjggMC44IDAuOCAyIDAuOCAyLjcgMCAwLjgtMC44IDAuOC0yIDAtMi44QzI2LjggMjQgMjUuNiAyNCAyNC44IDI0Ljh6TTIzLjMgMTIuN2MwLjgtMC44IDAuOC0yIDAtMi44IC0wLjgtMC44LTItMC44LTIuNyAwIC0wLjggMC44LTAuOCAyIDAgMi44QzIxLjMgMTMuNSAyMi41IDEzLjUgMjMuMyAxMi43eiIvPgo8cGF0aCBjbGFzcz0ibG9nb19fd29yZG1hcmsiIHN0eWxlPSJmaWxsOiAjRkZGRkZGOyIgZD0iTTc5LjQgMTYuNmwzLjktMy45YzAuOC0wLjggMC44LTIgMC0yLjcgLTAuNC0wLjQtMC45LTAuNi0xLjQtMC42IC0wLjMgMC0wLjcgMC4xLTEgMC4zbC0wLjEgMC4xYy0wLjEgMC0wLjEgMC4xLTAuMiAwLjFMNzkuNSAxMWwtMC4xIDAuMUw3MS40IDE5Yy0wLjggMC45LTEuMyAxLjctMS43IDIuNiAtMC40IDAuOS0wLjcgMi0wLjcgMy4xIDAgMC4xIDAgMC4yIDAgMC4zIDAgMC4xIDAgMC4yIDAgMC4zIDAgNC45IDMuOSA4LjkgOC44IDguOSA0LjkgMCA4LjgtNCA4LjgtOC45Qzg2LjcgMjAuOSA4My41IDE3LjMgNzkuNCAxNi42ek03Ny45IDMwLjNjLTIuNyAwLTUtMi4yLTUtNSAwLTIuNyAyLjItNSA1LTUgMi43IDAgNSAyLjIgNSA1QzgyLjggMjggODAuNiAzMC4zIDc3LjkgMzAuM3pNOTkuNyA5LjNDOTIuOSA5LjMgODggMTQuOSA4OCAyMS43YzAgNi44IDQuOSAxMi40IDExLjcgMTIuNCA2LjggMCAxMS43LTUuNSAxMS43LTEyLjRTMTA2LjUgOS4zIDk5LjcgOS4zek05OS43IDMwLjJjLTQuNyAwLTcuOS0zLjgtNy45LTguNSAwLTQuNyAzLjItOC41IDcuOS04LjUgNC43IDAgNy45IDMuOCA3LjkgOC41QzEwNy42IDI2LjQgMTA0LjQgMzAuMiA5OS43IDMwLjJ6TTEyNC40IDkuM2MtNi44IDAtMTEuNyA1LjYtMTEuNyAxMi40IDAgNi44IDQuOSAxMi40IDExLjcgMTIuNCA2LjggMCAxMS43LTUuNSAxMS43LTEyLjRTMTMxLjIgOS4zIDEyNC40IDkuM3pNMTI0LjQgMzAuMmMtNC43IDAtNy45LTMuOC03LjktOC41IDAtNC43IDMuMi04LjUgNy45LTguNSA0LjcgMCA3LjkgMy44IDcuOSA4LjVDMTMyLjMgMjYuNCAxMjkuMSAzMC4yIDEyNC40IDMwLjJ6TTUzLjEgMzIuN2MwLjIgMC42IDAuOCAxLjQgMS45IDEuNCAwIDAgMTEuMSAwIDExLjEgMCAxLjEgMCAxLjktMC45IDEuOS0xLjkgMC0xLjEtMC45LTItMS45LTIgMCAwLTkuOCAwLTkuOCAwIC0wLjQtMy41IDIuMi01LjUgNC40LTUuN2wwLjktMC4xYzMuNy0wLjUgNi40LTMuNyA2LjQtNy41IDAtNC4yLTMuNC03LjYtNy42LTcuNiAtMy41IDAtNi40IDIuNC03LjMgNS42bDAgMGMwIDAuMS0wLjEgMC4zLTAuMSAwLjUgMCAxLjEgMC45IDEuOSAxLjkgMS45IDAuOSAwIDEuNy0wLjYgMS45LTEuNWwwLTAuMWMwLjUtMS41IDEuOS0yLjYgMy41LTIuNiAyIDAgMy43IDEuNyAzLjcgMy43IDAgMS45LTEuMyAzLjQtMy4xIDMuNmwtMC4zIDBjLTQuNyAwLjMtOC4zIDQuMy04LjMgOC42QzUyLjYgMjkuMiA1Mi41IDMwLjkgNTMuMSAzMi43eiIvPgo8cGF0aCBjbGFzcz0ibG9nb19fd29yZG1hcmsiIHN0eWxlPSJmaWxsOiAjRkZGRkZGOyIgZD0iTTE1My42IDkuM2MtMS4xIDAtMS45IDAuOS0xLjkgMS45djUuNWgtOS45di01LjVjMC0xLjEtMC45LTEuOS0xLjktMS45IC0xLjEgMC0xLjkgMC45LTEuOSAxLjl2MjAuOWMwIDEuMSAwLjkgMS45IDEuOSAxLjkgMS4xIDAgMS45LTAuOSAxLjktMS45VjIwLjZoOS45djExLjVjMCAxLjEgMC45IDEuOSAxLjkgMS45czEuOS0wLjkgMS45LTEuOVYxMS4zQzE1NS41IDEwLjIgMTU0LjYgOS4zIDE1My42IDkuM3pNMTczLjEgMzAuMmgtOUwxNzQuMiAyMGMwLjgtMC44IDAuOC0yIDAtMi43IC0wLjQtMC40LTAuOS0wLjYtMS40LTAuNiAwIDAgMCAwIDAgMGgtMTMuNWMtMS4xIDAtMS45IDAuOS0xLjkgMiAwIDEuMSAwLjkgMS45IDEuOSAxLjloOC45TDE1OCAzMC44Yy0wLjggMC44LTAuOCAyIDAgMi43IDAuMyAwLjMgMC43IDAuNSAxLjEgMC41IDAuMSAwIDAuMSAwIDAuMiAwIDAgMCAwIDAgMCAwaDEzLjdjMS4xIDAgMS45LTAuOSAxLjktMS45QzE3NSAzMS4xIDE3NC4xIDMwLjIgMTczLjEgMzAuMnoiLz4KPC9zdmc+",
        muted:
          "data:image/svg+xml;base64,PHN2ZyBpZD0ic3ZnIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyLDZsNC0ydjhsLTQtMnYyYzAsMC42LTAuNCwxLTEsMUg0bC0zLDNsLTEtMUwxNSwwbDEsMWwtNCw0VjZ6IE0xMCwzSDFDMC40LDMsMCwzLjUsMCw0djgmIzEwOyYjOTtjMCwwLjMsMC4xLDAuNSwwLjMsMC43TDEwLDN6Ii8+Cjwvc3ZnPg==",
        hold:
          "data:image/svg+xml;base64,PHN2ZyBpZD0ic3ZnIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBkPSJNNSA1aDJ2Nkg1VjV6bTQgMGgydjZIOVY1eiIvPjxwYXRoIGQ9Ik04IDE2YzQuNCAwIDgtMy42IDgtOHMtMy42LTgtOC04LTggMy42LTggOCAzLjYgOCA4IDh6TTggMmMzLjMgMCA2IDIuNyA2IDZzLTIuNyA2LTYgNi02LTIuNy02LTYgMi43LTYgNi02eiIvPjwvc3ZnPg==",
        ringing:
          "data:image/svg+xml;base64,PHN2ZyBpZD0ic3ZnIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBkPSJNMTEuNSA2TDE2IDEuNSAxNC41IDAgMTAgNC41VjFIOHY3aDdWNnoiLz48cGF0aCBkPSJNMTIuOSAxMi40Yy0uMS0uMS0uMy0uMi0uMy0uMmwtMi45LTEtMS44IDEuMWMtLjEuMS0xLjUtLjItMi42LTEuNGwtLjMtLjNDMy43IDkuNCAzLjQgOC4yIDMuNSA4bDEuMy0xLjctMS0yLjlzLS4xLS4zLS4yLS4zYy0uMS0uMS0xLjUtLjMtMi4yLjRDLS41IDUuNC0xIDcuNCAzLjYgMTIuMWwuMy4zYzQuNyA0LjYgNi43IDQuMSA4LjYgMi4yLjctLjcuNS0yLjEuNC0yLjJ6Ii8+PC9zdmc+",
        defaultAvatar:
          "data:image/svg+xml;base64,PHN2ZyBpZD0ic3ZnIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBkPSJNMTIuNiA3Yy0xIDEuNS0yLjcgMi41LTQuNiAyLjVTNC40IDguNSAzLjQgN0MyLjkgNy4xIDAgOCAwIDEzYzAgMi43IDQgMyA4IDNzOC0uMyA4LTNjMC01LTIuOS01LjktMy40LTZ6Ii8+PGNpcmNsZSBjeD0iOCIgY3k9IjQiIHI9IjQiLz48L3N2Zz4=",
      },
      averageRGB: {
        threshold: 1,
      },
    };
    this._config = lwpUtils.merge(defaults, config);

    this._remoteVideo = null;
    this._localVideo = null;
  }

  _initEventBindings() {
    window.addEventListener("load", () => {
      this._initCanvasConfig();
    });

    this._libwebphone.on("call.promoted", (lwp, call) => {
      this._call = call;

      if (!call._statusLines) {
        call._statusLines = [];
      }

      if (call.hasSession()) {
        let line = call._statusLines.find((line) => {
          return line.type == "remoteIdentity";
        });

        if (line) {
          line.text = call.remoteIdentity();
        } else {
          call._statusLines.push(
            this._createStatusLine({
              text: call.remoteIdentity(),
              type: "remoteIdentity",
            })
          );
        }
      }
    });
    this._libwebphone.on(
      "call.primary.timeupdate",
      (lwp, call, start, duration, prettyDuration) => {
        if (!call._statusLines) {
          call._statusLines = [];
        }

        let line = call._statusLines.find((line) => {
          return line.type == "duration";
        });

        if (line) {
          line.text = prettyDuration;
        } else {
          call._statusLines.push(
            this._createStatusLine({
              text: prettyDuration,
              type: "duration",
            })
          );
        }
      }
    );
    this._libwebphone.on(
      "call.primary.remote.video.playing",
      (lwp, call, element) => {
        this._setRemoteVideo(element);
      }
    );
    this._libwebphone.on(
      "call.primary.remote.video.timeupdate",
      (lwp, call, element) => {
        this._checkCanvasSource(
          this._remoteVideo,
          element,
          element.videoWidth,
          element.videoHeight
        );
      }
    );
    this._libwebphone.on(
      "call.primary.local.video.playing",
      (lwp, call, element) => {
        this._setLocalVideo(element);
      }
    );
    this._libwebphone.on(
      "call.primary.local.video.timeupdate",
      (lwp, call, element) => {
        if (
          this._checkCanvasSource(
            this._localVideo,
            element,
            element.videoWidth,
            element.videoHeight
          )
        ) {
          this._rescale(this._localVideo, this._config.pictureInPicture.ratio);
        }
      }
    );

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

  _initCanvasConfig() {
    this._backgrounds = {};
    if (!this._config.canvas.element && this._config.canvas.elementId) {
      this._config.canvas.element = document.getElementById(
        this._config.canvas.elementId
      );
    }

    if (!this._config.canvas.element) {
      this._config.canvas.element = document.createElement("canvas");
    }

    if (!this._config.canvas.context && this._config.canvas.element) {
      this._config.canvas.context = this._config.canvas.element.getContext(
        "2d"
      );
    }

    let backgrounds = [
      { name: "disconnected", type: "background.disconnected", scale: 0.5 },
      { name: "idle", type: "background.idle", scale: 0.9 },
      { name: "ringing", type: "background.ringing", scale: 0.5 },
      { name: "muted", type: "background.muted", scale: 0.5 },
      { name: "hold", type: "background.hold", scale: 0.5 },
      { name: "defaultAvatar", type: "background.avatar.default", scale: 0.1 },
    ];

    backgrounds.forEach((background) => {
      if (this._config.backgrounds[background.name]) {
        let image = document.createElement("img");
        image.onload = () => {
          this._backgrounds[background.name] = this._createCanvasSource(
            image,
            image.width,
            image.height,
            { scale: background.scale }
          );
          this._backgrounds.disconnected.type = background.type;
        };
        image.src = this._config.backgrounds[background.name];
      }
    });

    this._dialpadStatusLine = this._createStatusLine({
      text: "",
      type: "dialpadTarget",
    });

    this._canvasRender = setInterval(() => {
      this._renderCanvas();
    }, 1000 / this._config.canvasLoop.framesPerSecond);
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
      data: lwpUtils.merge({}, this._config, this._renderData()),
      by_id: {
        pictureInPicture: {
          events: {
            onclick: (event) => {
              this.togglePictureInPicture();
            },
          },
        },
        pictureInPictureRatio: {
          events: {
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
          },
        },
      },
    };
  }

  _renderDefaultTemplate() {
    return `
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
      canvasLoop: {},
    }
  ) {
    data.pictureInPicture.enabled = this.isPictureInPicture();
    data.pictureInPicture.ratio = this._config.pictureInPicture.ratio * 100;
    data.canvasLoop.framesPerSecond = this._config.canvasLoop.framesPerSecond;
    return data;
  }

  /** Helper functions */

  _setRemoteVideo(remoteVideo = null) {
    if (remoteVideo) {
      this._remoteVideo = this._createCanvasSource(
        remoteVideo,
        remoteVideo.videoWidth,
        remoteVideo.videoHeight
      );
      this._remoteVideo.type = "remote.video";
      this._emit("remote.video.added", this, this._removeVideo);
    } else {
      this._remoteVideo = null;
      this._emit("remote.video.removed", this);
    }
  }

  _setLocalVideo(localVideo = null) {
    if (localVideo) {
      this._localVideo = this._createCanvasSource(
        localVideo,
        localVideo.videoWidth,
        localVideo.videoHeight
      );
      this._localVideo.type = "local.video";
      this._rescale(this._localVideo, this._config.pictureInPicture.ratio);
      this._emit("local.video.added", this, this._localVideo);
    } else {
      this._localVideo = null;
      this._emit("local.video.removed", this);
    }
  }

  _checkCanvasSource(context, source, sourceWidth = 640, sourceHeight = 480) {
    let canvasWidth = this._config.canvas.element.width || 640;
    let canvasHeight = this._config.canvas.element.height || 480;
    let scale = Math.min(
      canvasWidth / sourceWidth,
      canvasHeight / sourceHeight
    );
    let rescaled = false;

    if (!context) {
      return rescaled;
    }

    if (context.source.width != sourceWidth) {
      context.source.width = sourceWidth;
      context.destination.original.x =
        canvasWidth / 2 - (sourceWidth / 2) * scale;
      context.destination.original.width = sourceWidth * scale;
      context.destination.current.x = context.destination.original.x;
      context.destination.current.width = context.destination.original.width;
      rescaled = true;
    }

    if (context.source.height != sourceHeight) {
      context.source.height = sourceHeight;
      context.destination.original.y =
        canvasHeight / 2 - (sourceHeight / 2) * scale;
      context.destination.original.height = sourceHeight * scale;
      context.destination.current.y = context.destination.original.y;
      context.destination.current.height = context.destination.original.height;
      rescaled = true;
    }

    if (rescaled && context.type) {
      this._emit(context.type + ".rescaled", this, context);
    }

    this._averageRGB(context);

    return rescaled;
  }

  _createCanvasSource(
    source,
    sourceWidth = 640,
    sourceHeight = 480,
    options = { scale: 1 }
  ) {
    let canvasWidth = this._config.canvas.element.width || 640;
    let canvasHeight = this._config.canvas.element.height || 480;
    let scale =
      Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight) *
      options.scale;
    let scaledWidth = sourceWidth * scale;
    let scaledHeight = sourceHeight * scale;
    let context = {
      scale: scale,
      source: {
        stream: source,
        x: 0,
        y: 0,
        width: sourceWidth,
        height: sourceHeight,
      },
      destination: {
        original: {
          x: canvasWidth / 2 - scaledWidth / 2,
          y: canvasHeight / 2 - scaledHeight / 2,
          width: scaledWidth,
          height: scaledHeight,
        },
      },
      averageRGB: {
        canvas: document.createElement("canvas"),
        red: 0,
        green: 0,
        blue: 0,
        distance: 0,
      },
    };

    context.averageRGB.context = context.averageRGB.canvas.getContext("2d");
    context.destination.current = lwpUtils.merge(
      {},
      context.destination.original
    );

    this._averageRGB(context);

    return context;
  }

  _averageRGB(context) {
    let stepSize = 10 * 4; // every 10th pixel of the RGBA (4 elements) 2d array

    context.averageRGB.context.drawImage(context.source.stream, 0, 0);
    let imageData = context.averageRGB.context.getImageData(
      0,
      0,
      context.averageRGB.canvas.width,
      context.averageRGB.canvas.height
    );

    context.averageRGB.red = 0;
    context.averageRGB.green = 0;
    context.averageRGB.blue = 0;

    for (let index = 0; index < imageData.data.length; index += stepSize) {
      context.averageRGB.red += imageData.data[index];
      context.averageRGB.green += imageData.data[index + 1];
      context.averageRGB.blue += imageData.data[index + 2];
      /// ignore alpha (imageData.data[index + 3])
    }

    // ~~ used to floor values
    let count = imageData.data.length / stepSize;
    context.averageRGB.red = ~~(context.averageRGB.red / count);
    context.averageRGB.green = ~~(context.averageRGB.green / count);
    context.averageRGB.blue = ~~(context.averageRGB.blue / count);

    // how far are we from a solid color (such as all black)
    context.averageRGB.distance =
      Math.abs(context.averageRGB.red - context.averageRGB.green) +
      Math.abs(context.averageRGB.red - context.averageRGB.blue) +
      Math.abs(context.averageRGB.green - context.averageRGB.blue);
  }

  _rescale(context, ratio) {
    if (!context) {
      return;
    }

    context.destination.current.width =
      context.destination.original.width * ratio;
    context.destination.current.height =
      context.destination.original.height * ratio;

    if (
      context.destination.current.width + context.destination.current.x >
      this._config.canvas.element.width
    ) {
      context.destination.current.x =
        this._config.canvas.element.width - context.destination.current.width;
    }

    if (
      context.destination.current.height + context.destination.current.y >
      this._config.canvas.element.height
    ) {
      context.destination.current.y =
        this._config.canvas.element.height - context.destination.current.height;
    }
  }

  _createStatusLine(line) {
    let defaults = {
      font: "14px sans-serif",
      fillStyle: "#ffffff",
      textAlign: "left",
      textBaseline: "top",
      type: "undefined",
      x: this._config.canvas.element.width / 2,
      y: this._config.canvas.element.height / 2,
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

  _renderCanvas() {
    let padding = 15;
    let totalHeight = 0;
    let currentHeight = 0;
    let hasRemoteVideo =
      this._remoteVideo &&
      this._remoteVideo.averageRGB.distance > this._config.averageRGB.threshold;
    let hasLocalVideo =
      this._config.pictureInPicture.enabled &&
      this._localVideo &&
      this._localVideo.averageRGB.distance > this._config.averageRGB.threshold;
    let statusLines = [];

    this._config.canvas.context.fillStyle = "#2e2e32";
    this._config.canvas.context.fillRect(
      0,
      0,
      this._config.canvas.element.width,
      this._config.canvas.element.height
    );

    if (false) {
      this._config.canvas.context.beginPath();
      this._config.canvas.context.moveTo(
        this._config.canvas.element.width / 2,
        0
      );
      this._config.canvas.context.lineTo(
        this._config.canvas.element.width / 2,
        this._config.canvas.element.height
      );
      this._config.canvas.context.strokeStyle = "white";
      this._config.canvas.context.stroke();

      this._config.canvas.context.beginPath();
      this._config.canvas.context.moveTo(
        0,
        this._config.canvas.element.height / 2
      );
      this._config.canvas.context.lineTo(
        this._config.canvas.element.width,
        this._config.canvas.element.height / 2
      );
      this._config.canvas.context.strokeStyle = "white";
      this._config.canvas.context.stroke();
    }

    if (hasRemoteVideo) {
      this._renderCanvasSource(this._remoteVideo);
      if (hasLocalVideo) {
        this._renderCanvasSource(this._localVideo);
      }
      return;
    }

    if (this._libwebphone.getUserAgent()) {
      if (!this._libwebphone.getUserAgent().isReady()) {
        this._renderCanvasSource(this._backgrounds.disconnected);
        return;
      }
    }

    if (!this._call || !this._call.hasSession()) {
      let digits = null;
      if (this._libwebphone.getDialpad()) {
        digits = this._libwebphone.getDialpad().getTarget();
        this._dialpadStatusLine.text = digits;
      }
      totalHeight =
        this._backgrounds.idle.destination.current.height +
        this._dialpadStatusLine.expectedHeight;

      currentHeight = this._config.canvas.element.height / 2 - totalHeight / 2;
      this._renderCanvasSource(this._backgrounds.idle, currentHeight);
      currentHeight +=
        this._backgrounds.idle.destination.current.height + padding;

      this._renderStatusLine(this._dialpadStatusLine, currentHeight);

      return;
    }

    if (this._call && this._call._statusLines) {
      statusLines = this._call._statusLines;
    }

    totalHeight = statusLines.reduce((total, line) => {
      return total + line.expectedHeight + padding;
    }, 0);
    currentHeight = this._config.canvas.element.height / 2 - totalHeight / 2;

    if (this._call && this._call.isRinging()) {
      if (this._backgrounds.ringing) {
        totalHeight += this._backgrounds.ringing.destination.current.height;
        currentHeight =
          this._config.canvas.element.height / 2 - totalHeight / 2;
        this._renderCanvasSource(this._backgrounds.ringing, currentHeight);
        currentHeight += this._backgrounds.ringing.destination.current.height;
      }
    } else if (this._call && this._call.isOnHold()) {
      if (this._backgrounds.hold) {
        totalHeight += this._backgrounds.hold.destination.current.height;
        currentHeight =
          this._config.canvas.element.height / 2 - totalHeight / 2;
        this._renderCanvasSource(this._backgrounds.hold, currentHeight);
        currentHeight += this._backgrounds.hold.destination.current.height;
      }
    } else if (this._call && this._call.isMuted()) {
      if (this._backgrounds.muted) {
        totalHeight += this._backgrounds.muted.destination.current.height;
        currentHeight =
          this._config.canvas.element.height / 2 - totalHeight / 2;
        this._renderCanvasSource(this._backgrounds.muted, currentHeight);
        currentHeight += this._backgrounds.muted.destination.current.height;
      }
    } else if (this._backgrounds.defaultAvatar) {
      let radius = Math.hypot(
        this._backgrounds.defaultAvatar.destination.current.width,
        this._backgrounds.defaultAvatar.destination.current.height
      );
      totalHeight += radius;
      currentHeight = this._config.canvas.element.height / 2 - totalHeight / 2;

      this._config.canvas.context.beginPath();
      this._config.canvas.context.arc(
        this._backgrounds.defaultAvatar.destination.current.x +
          this._backgrounds.defaultAvatar.destination.current.width / 2,
        currentHeight +
          this._backgrounds.defaultAvatar.destination.current.height / 2,
        radius / 2,
        0,
        2 * Math.PI
      );
      this._config.canvas.context.fillStyle = "#909099";
      this._config.canvas.context.fill();

      this._renderCanvasSource(this._backgrounds.defaultAvatar, currentHeight);

      currentHeight += radius;
    }

    statusLines.forEach((line) => {
      currentHeight += padding;
      this._renderStatusLine(line, currentHeight);
      currentHeight += line.expectedHeight;
    });
  }

  _renderCanvasSource(source, y = null, x = null) {
    if (!source) {
      return;
    }

    if (!x) {
      x = source.destination.current.x;
    }

    if (!y) {
      y = source.destination.current.y;
    }

    this._config.canvas.context.drawImage(
      source.source.stream,
      source.source.x,
      source.source.y,
      source.source.width,
      source.source.height,
      x,
      y,
      source.destination.current.width,
      source.destination.current.height
    );
  }

  _renderStatusLine(line, y = null, x = null) {
    if (!line) {
      return;
    }

    if (!x) {
      x = line.x;
    }

    if (!y) {
      y = line.y;
    }

    line.measurements = this._config.canvas.context.measureText(line.text);

    this._config.canvas.context.font = line.font;
    this._config.canvas.context.fillStyle = line.fillStyle;
    this._config.canvas.context.textAlign = line.textAlign;
    this._config.canvas.context.textBaseline = line.textBaseline;

    this._config.canvas.context.fillText(
      line.text,
      x - line.measurements.width / 2,
      y
    );
  }
}
