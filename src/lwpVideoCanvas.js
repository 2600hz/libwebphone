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

  updateRenders() {
    this.render((render) => {
      render.data = this._renderData(render.data);
      return render;
    });
  }

  /** Init functions */

  _initInternationalization(config) {
    const defaults = {
      en: {},
    };
    const resourceBundles = lwpUtils.merge(
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

    const defaults = {
      renderTargets: [],
      canvas: {
        defaultWidth: 640,
        defaultHeight: 480,
        root: {
          elementId: null,
          element: null,
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
        averageRGB: {
          threshold: 1,
        },
      },
      remoteVideo: {
        name: "remoteVideo",
        enabled: true,
        averageRGB: {
          threshold: 1,
        },
      },
      canvasLoop: {
        show: true,
        framesPerSecond: 15,
      },
      layouts: [
        {
          name: "disconnected",
          elements: [{ type: "image", name: "disconnected", rescale: 0.5 }],
          predicate: () => {
            return (
              this._libwebphone.getUserAgent() &&
              !this._libwebphone.getUserAgent().isReady()
            );
          },
          exclusive: true,
        },

        {
          name: "idle",
          elements: [
            { type: "image", name: "idle", rescale: 0.9 },
            { type: "string", name: "test", source: "This is a test!" },
          ],
          predicate: () => {
            return !this._call || !this._call.hasSession();
          },
        },

        {
          name: "terminating",
          elements: [{ type: "image", name: "ringing", rescale: 0.9 }],
          predicate: () => {
            return this._call && this._call.isRinging();
          },
        },

        {
          name: "muted",
          elements: [{ type: "image", name: "muted", rescale: 0.5 }],
          predicate: () => {
            return this._call && this._call.isMuted();
          },
        },

        {
          name: "held",
          elements: [{ type: "image", name: "held", rescale: 0.5 }],
          predicate: () => {
            return this._call && this._call.isOnHold();
          },
        },

        {
          name: "videoCall",
          elements: [{ type: "remoteVideo" }, { type: "localVideo" }],
          predicate: () => {
            return this._call && this._call.hasSession();
          },
        },

        {
          name: "audioCall",
          elements: [{ type: "image", name: "defaultAvatar", rescale: 0.1 }],
          predicate: () => {
            return this._call && this._call.hasSession();
          },
        },
      ],
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
          source:
            "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ij4NCjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+DQoJLnN0MHtmaWxsOiM2NDY0NkM7fQ0KPC9zdHlsZT4NCjxnPg0KCTxjaXJjbGUgY2xhc3M9InN0MCIgY3g9IjgiIGN5PSIxMi41IiByPSIxLjUiLz4NCgk8cG9seWdvbiBjbGFzcz0ic3QwIiBwb2ludHM9IjcuMywxMCA4LjgsMTAgOS41LDEgNi41LDEgCSIvPg0KCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik01LjIsMy40QzMuNCw0LDEuOCw1LjEsMC43LDYuNWwxLjQsMS40YzAuOC0xLjEsMi0xLjksMy4zLTIuNEw1LjIsMy40eiIvPg0KCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xMC44LDMuNGwtMC4yLDJjMS4zLDAuNSwyLjQsMS4zLDMuMywyLjRsMS40LTEuNEMxNC4yLDUuMSwxMi42LDQsMTAuOCwzLjR6Ii8+DQoJPHBhdGggY2xhc3M9InN0MCIgZD0iTTMuNSw5LjNMNSwxMC44YzAuMi0wLjQsMC41LTAuNywwLjgtMC45TDUuNiw3LjZDNC43LDgsNCw4LjYsMy41LDkuM3oiLz4NCgk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMTAuNSw3LjZsLTAuMiwyLjNjMC4zLDAuMywwLjYsMC42LDAuOCwwLjlsMS41LTEuNUMxMiw4LjYsMTEuMyw4LDEwLjUsNy42eiIvPg0KPC9nPg0KPC9zdmc+DQo=",
        },
        {
          name: "idle",
          enabled: true,
          source:
            "data:image/svg+xml;base64,PHN2ZyBpZD0idGVzdCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2ZXJzaW9uPSIxLjEiIHg9IjAiIHk9IjAiIHdpZHRoPSIxNzUiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCAxNzUgNDkiIGNsYXNzPSJsb2dvIj4KPHBhdGggY2xhc3M9ImxvZ29fX3N5bWJvbCIgc3R5bGU9ImZpbGw6ICNmZjU5MzM7IiBkPSJNNDIuMSAwLjZjLTAuOC0wLjgtMi0wLjgtMi43IDAgLTAuOCAwLjgtMC44IDIgMCAyLjggMC44IDAuOCAyIDAuOCAyLjcgMEM0Mi45IDIuNiA0Mi45IDEuMyA0Mi4xIDAuNnpNMTEuNyAzMy45bDIyLTIyLjFjLTAuNC0wLjUtMC44LTEtMS4zLTEuNSAtMC41LTAuNS0wLjktMC45LTEuNC0xLjNMOSAzMS4yYy0wLjggMC44LTAuOCAyIDAgMi44QzkuOCAzNC43IDExIDM0LjcgMTEuNyAzMy45ek0zOCA3LjVjMC44LTAuOCAwLjgtMiAwLTIuOCAtMC44LTAuOC0yLTAuOC0yLjcgMGwtMiAyQzI2IDAuNyAxNS4yIDEuMiA4LjQgOGMtNS4xIDUuMS02LjYgMTIuNC00LjYgMTguOGwtMy4zIDMuM2MtMC44IDAuOC0wLjggMiAwIDIuOCAwLjggMC44IDIgMC44IDIuNyAwbDE1LjktMTZjMC44LTAuOCAwLjgtMiAwLTIuOCAtMC44LTAuOC0yLTAuOC0yLjcgMEw4IDIyLjdjLTAuOS00LjggMC41LTkuOSA0LjItMTMuNSA1LjktNiAxNS41LTYgMjEuNSAwIDUuOSA2IDUuOSAxNS42IDAgMjEuNiAtMy4xIDMuMS03LjIgNC42LTExLjMgNC41TDE4IDM5LjZjNS45IDEuMiAxMi4yLTAuNSAxNi44LTUuMSA2LjgtNi44IDcuMi0xNy43IDEuMy0yNUwzOCA3LjV6TTIzLjQgMjguOWMtMC44LTAuOC0yLTAuOC0yLjcgMEwxMCAzOS42Yy0wLjggMC44LTAuOCAyIDAgMi44IDAuOCAwLjggMiAwLjggMi43IDBsMTAuNy0xMC43QzI0LjIgMzAuOSAyNC4yIDI5LjcgMjMuNCAyOC45ek0yNC44IDI0LjhjLTAuOCAwLjgtMC44IDIgMCAyLjggMC44IDAuOCAyIDAuOCAyLjcgMCAwLjgtMC44IDAuOC0yIDAtMi44QzI2LjggMjQgMjUuNiAyNCAyNC44IDI0Ljh6TTIzLjMgMTIuN2MwLjgtMC44IDAuOC0yIDAtMi44IC0wLjgtMC44LTItMC44LTIuNyAwIC0wLjggMC44LTAuOCAyIDAgMi44QzIxLjMgMTMuNSAyMi41IDEzLjUgMjMuMyAxMi43eiIvPgo8cGF0aCBjbGFzcz0ibG9nb19fd29yZG1hcmsiIHN0eWxlPSJmaWxsOiAjRkZGRkZGOyIgZD0iTTc5LjQgMTYuNmwzLjktMy45YzAuOC0wLjggMC44LTIgMC0yLjcgLTAuNC0wLjQtMC45LTAuNi0xLjQtMC42IC0wLjMgMC0wLjcgMC4xLTEgMC4zbC0wLjEgMC4xYy0wLjEgMC0wLjEgMC4xLTAuMiAwLjFMNzkuNSAxMWwtMC4xIDAuMUw3MS40IDE5Yy0wLjggMC45LTEuMyAxLjctMS43IDIuNiAtMC40IDAuOS0wLjcgMi0wLjcgMy4xIDAgMC4xIDAgMC4yIDAgMC4zIDAgMC4xIDAgMC4yIDAgMC4zIDAgNC45IDMuOSA4LjkgOC44IDguOSA0LjkgMCA4LjgtNCA4LjgtOC45Qzg2LjcgMjAuOSA4My41IDE3LjMgNzkuNCAxNi42ek03Ny45IDMwLjNjLTIuNyAwLTUtMi4yLTUtNSAwLTIuNyAyLjItNSA1LTUgMi43IDAgNSAyLjIgNSA1QzgyLjggMjggODAuNiAzMC4zIDc3LjkgMzAuM3pNOTkuNyA5LjNDOTIuOSA5LjMgODggMTQuOSA4OCAyMS43YzAgNi44IDQuOSAxMi40IDExLjcgMTIuNCA2LjggMCAxMS43LTUuNSAxMS43LTEyLjRTMTA2LjUgOS4zIDk5LjcgOS4zek05OS43IDMwLjJjLTQuNyAwLTcuOS0zLjgtNy45LTguNSAwLTQuNyAzLjItOC41IDcuOS04LjUgNC43IDAgNy45IDMuOCA3LjkgOC41QzEwNy42IDI2LjQgMTA0LjQgMzAuMiA5OS43IDMwLjJ6TTEyNC40IDkuM2MtNi44IDAtMTEuNyA1LjYtMTEuNyAxMi40IDAgNi44IDQuOSAxMi40IDExLjcgMTIuNCA2LjggMCAxMS43LTUuNSAxMS43LTEyLjRTMTMxLjIgOS4zIDEyNC40IDkuM3pNMTI0LjQgMzAuMmMtNC43IDAtNy45LTMuOC03LjktOC41IDAtNC43IDMuMi04LjUgNy45LTguNSA0LjcgMCA3LjkgMy44IDcuOSA4LjVDMTMyLjMgMjYuNCAxMjkuMSAzMC4yIDEyNC40IDMwLjJ6TTUzLjEgMzIuN2MwLjIgMC42IDAuOCAxLjQgMS45IDEuNCAwIDAgMTEuMSAwIDExLjEgMCAxLjEgMCAxLjktMC45IDEuOS0xLjkgMC0xLjEtMC45LTItMS45LTIgMCAwLTkuOCAwLTkuOCAwIC0wLjQtMy41IDIuMi01LjUgNC40LTUuN2wwLjktMC4xYzMuNy0wLjUgNi40LTMuNyA2LjQtNy41IDAtNC4yLTMuNC03LjYtNy42LTcuNiAtMy41IDAtNi40IDIuNC03LjMgNS42bDAgMGMwIDAuMS0wLjEgMC4zLTAuMSAwLjUgMCAxLjEgMC45IDEuOSAxLjkgMS45IDAuOSAwIDEuNy0wLjYgMS45LTEuNWwwLTAuMWMwLjUtMS41IDEuOS0yLjYgMy41LTIuNiAyIDAgMy43IDEuNyAzLjcgMy43IDAgMS45LTEuMyAzLjQtMy4xIDMuNmwtMC4zIDBjLTQuNyAwLjMtOC4zIDQuMy04LjMgOC42QzUyLjYgMjkuMiA1Mi41IDMwLjkgNTMuMSAzMi43eiIvPgo8cGF0aCBjbGFzcz0ibG9nb19fd29yZG1hcmsiIHN0eWxlPSJmaWxsOiAjRkZGRkZGOyIgZD0iTTE1My42IDkuM2MtMS4xIDAtMS45IDAuOS0xLjkgMS45djUuNWgtOS45di01LjVjMC0xLjEtMC45LTEuOS0xLjktMS45IC0xLjEgMC0xLjkgMC45LTEuOSAxLjl2MjAuOWMwIDEuMSAwLjkgMS45IDEuOSAxLjkgMS4xIDAgMS45LTAuOSAxLjktMS45VjIwLjZoOS45djExLjVjMCAxLjEgMC45IDEuOSAxLjkgMS45czEuOS0wLjkgMS45LTEuOVYxMS4zQzE1NS41IDEwLjIgMTU0LjYgOS4zIDE1My42IDkuM3pNMTczLjEgMzAuMmgtOUwxNzQuMiAyMGMwLjgtMC44IDAuOC0yIDAtMi43IC0wLjQtMC40LTAuOS0wLjYtMS40LTAuNiAwIDAgMCAwIDAgMGgtMTMuNWMtMS4xIDAtMS45IDAuOS0xLjkgMiAwIDEuMSAwLjkgMS45IDEuOSAxLjloOC45TDE1OCAzMC44Yy0wLjggMC44LTAuOCAyIDAgMi43IDAuMyAwLjMgMC43IDAuNSAxLjEgMC41IDAuMSAwIDAuMSAwIDAuMiAwIDAgMCAwIDAgMCAwaDEzLjdjMS4xIDAgMS45LTAuOSAxLjktMS45QzE3NSAzMS4xIDE3NC4xIDMwLjIgMTczLjEgMzAuMnoiLz4KPC9zdmc+",
        },
        {
          name: "ringing",
          enabled: true,
          source:
            "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ij4NCjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+DQoJLnN0MHtmaWxsOiM2NDY0NkM7fQ0KPC9zdHlsZT4NCjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xMS41LDZMMTYsMS41TDE0LjUsMEwxMCw0LjVWMUg4djdoN1Y2SDExLjV6Ii8+DQo8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMTIuOSwxMi40Yy0wLjEtMC4xLTAuMy0wLjItMC4zLTAuMmwtMi45LTFsLTEuOCwxLjFjLTAuMSwwLjEtMS41LTAuMi0yLjYtMS40TDUsMTAuNkMzLjcsOS40LDMuNCw4LjIsMy41LDgNCglsMS4zLTEuN2wtMS0yLjljMCwwLTAuMS0wLjMtMC4yLTAuM0MzLjUsMywyLjEsMi44LDEuNCwzLjVDLTAuNSw1LjQtMSw3LjQsMy42LDEyLjFsMC4zLDAuM2M0LjcsNC42LDYuNyw0LjEsOC42LDIuMg0KCUMxMy4yLDEzLjksMTMsMTIuNSwxMi45LDEyLjR6Ii8+DQo8L3N2Zz4NCg==",
        },
        {
          name: "muted",
          enabled: true,
          source:
            "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ij4NCjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+DQoJLnN0MHtmaWxsLXJ1bGU6ZXZlbm9kZDtjbGlwLXJ1bGU6ZXZlbm9kZDtmaWxsOiM2NDY0NkM7fQ0KPC9zdHlsZT4NCjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xMiw2bDQtMnY4bC00LTJ2MmMwLDAuNi0wLjQsMS0xLDFINGwtMywzbC0xLTFMMTUsMGwxLDFsLTQsNFY2eiBNMTAsM0gxQzAuNCwzLDAsMy41LDAsNHY4DQoJYzAsMC4zLDAuMSwwLjUsMC4zLDAuN0wxMCwzeiIvPg0KPC9zdmc+DQo=",
        },
        {
          name: "held",
          enabled: true,
          source:
            "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ij4NCjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+DQoJLnN0MHtmaWxsOiM2NDY0NkM7fQ0KPC9zdHlsZT4NCjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik04LDBDMy42LDAsMCwzLjYsMCw4czMuNiw4LDgsOHM4LTMuNiw4LThTMTIuNCwwLDgsMHogTTcsMTFINVY1aDJWMTF6IE0xMSwxMUg5VjVoMlYxMXoiLz4NCjwvc3ZnPg0K",
        },
        {
          name: "defaultAvatar",
          enabled: true,
          source:
            "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ij4NCjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+DQoJLnN0MHtmaWxsOiM2NDY0NkM7fQ0KPC9zdHlsZT4NCjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik04LDBDMy42LDAsMCwzLjYsMCw4czMuNiw4LDgsOHM4LTMuNiw4LThTMTIuNCwwLDgsMHogTTgsM2MxLjEsMCwyLDAuOSwyLDJTOSw3LDgsN0M2LjksNyw2LDYuMSw2LDVTNi45LDMsOCwzDQoJeiBNOCwxMmMtMiwwLTQtMC4xLTQtMS43QzQsOCw0LjksNy4zLDUuNCw3bDAuMi0wLjFDNi4zLDcuNSw3LjEsOCw4LDhzMS43LTAuNSwyLjMtMS4xTDEwLjUsN0MxMSw3LjMsMTIsNy45LDEyLDEwLjMNCglDMTIsMTEuOSwxMCwxMiw4LDEyeiIvPg0KPC9zdmc+DQo=",
        },
      ],
    };
    this._config = lwpUtils.merge(defaults, config);

    this._canvasRender = null;
  }

  _initEventBindings() {
    this._libwebphone.on("videoCanvas.render.ready", () => {
      this._canvasCreateRender(this._config.canvas);
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
      i18n: {},
      data: lwpUtils.merge({}, this._config, this._renderData()),
    };
  }

  _renderDefaultTemplate() {
    return ``;
  }

  _renderData(data = {}) {
    return data;
  }

  /** Layout functions */
  _layoutPositionDefaults() {
    return {
      width: 0,
      height: 0,
      placement: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
    };
  }

  _layoutCreate(canvasRender, config) {
    const layout = lwpUtils.merge(
      {
        elements: [],
        position: { mode: "center" },
        direction: "column",
        predicate: () => {
          return false;
        },
      },
      this._layoutPositionDefaults(),
      config
    );

    this._layoutAssignCanvas(canvasRender, layout);

    layout.elements.forEach((config, index) => {
      switch (config.type) {
        case "image":
          layout.elements[index] = this._layoutLoadImage(
            canvasRender,
            layout,
            config
          );
          break;
        case "string":
          layout.elements[index] = this._layoutLoadString(
            canvasRender,
            layout,
            config
          );
          break;
      }
    });

    this._layoutRecalculate(canvasRender, layout);

    return layout;
  }

  _layoutAssignCanvas(canvasRender, layout) {
    const canvasWidth = canvasRender.root.element.width;
    const canvasHeight = canvasRender.root.element.height;

    layout.width = canvasWidth;
    layout.height = canvasHeight;
  }

  _layoutLoadImage(canvasRender, layout, config) {
    const element = lwpUtils.merge(
      {
        source: null,
      },
      this._layoutPositionDefaults(),
      config
    );

    const source = this._config.images.find((image) => {
      return image.name == element.name;
    });

    if (!source.source) {
      return;
    }

    const img = document.createElement("img");

    img.onload = () => {
      element.source = img;
      element.width = img.width;
      element.height = img.height;

      this._layoutRecalculate(canvasRender, layout);
    };

    img.src = source.source;

    return element;
  }

  _layoutLoadString(canvasRender, layout, config) {
    const element = lwpUtils.merge(
      {
        font: "14px sans-serif",
        fillStyle: "#ffffff",
        textAlign: "left",
        textBaseline: "top",
        source: "",
      },
      this._layoutPositionDefaults(),
      config
    );

    //this._layoutRecalculate(canvasRender, layout);

    return element;
  }

  _layoutRecalculate(canvasRender, layout) {
    layout.placement.width = 0;
    layout.placement.height = 0;

    switch (layout.direction) {
      case "column":
        layout.elements.forEach((element) => {
          if (!element.placement) {
            return;
          }
          this._layoutRecalculateElement(canvasRender, layout, element);
          if (element.width > layout.placement.width) {
            layout.placement.width = element.placement.width;
          }
          layout.placement.height += element.placement.height;
        });
        break;
      case "row":
      default:
        layout.elements.forEach((element) => {
          if (!element.placement) {
            return;
          }
          this._layoutRecalculateElement(canvasRender, layout, element);
          layout.placement.width += element.placement.width;
          if (element.height > layout.placement.height) {
            layout.placement.height = element.placement.height;
          }
        });
        break;
    }

    this._layoutPosition(canvasRender, layout);

    const position = { x: layout.placement.x, y: layout.placement.y };
    layout.elements.forEach((element) => {
      if (!element.placement) {
        return;
      }

      element.placement.width =
        (element.placement.width / layout.placement.width) *
        layout.placement.width;
      element.placement.height =
        (element.placement.height / layout.placement.height) *
        layout.placement.height;

      element.placement.x = position.x;
      element.placement.y = position.y;

      switch (layout.direction) {
        case "column":
          position.y += element.placement.height;
          break;
        case "row":
        default:
          position.x += element.placement.width;
          break;
      }
    });
  }

  _layoutRecalculateElement(canvasRender, layout, element) {
    switch (element.type) {
      case "image":
        this._layoutScale(canvasRender, layout, element, element.rescale || 1);
        break;
      case "string":
        this._layoutMeasureText(canvasRender, layout, element);
        break;
    }
  }

  _layoutMeasureText(canvasRender, layout, element) {
    element.width = 0;
    element.height = 0;

    element.measurements = canvasRender.context.measureText(element.source);
    element.width = element.measurements.width;
    element.height =
      (element.measurements.actualBoundingBoxAscent || 12) +
      (element.measurements.actualBoundingBoxDescent || 12);
    element.placement.width = element.width;
    element.placement.height = element.height;
  }

  _layoutScale(canvasRender, layout, element, rescale = null) {
    const canvasWidth = canvasRender.root.element.width;
    const canvasHeight = canvasRender.root.element.height;
    const elementWidth = element.width;
    const elementHeight = element.height;
    let scale = Math.min(
      canvasWidth / elementWidth,
      canvasHeight / elementHeight
    );

    if (rescale) {
      scale *= rescale;
    }

    element.placement.scale = scale;
    element.placement.width = elementWidth * scale;
    element.placement.height = elementHeight * scale;
  }

  _layoutPosition(canvasRender, layout, mode = null, x = null, y = null) {
    const canvasWidth = canvasRender.root.element.width;
    const canvasHeight = canvasRender.root.element.height;

    if (mode) {
      layout.position.mode = mode;
    }

    switch (layout.position.mode) {
      case "delta":
        if (x !== null) {
          layout.placement.x += x;
        }

        if (y !== null) {
          layout.placement.y += y;
        }

        break;
      case "absolute":
        if (x !== null) {
          layout.placement.x = x;
        }

        if (y !== null) {
          layout.placement.y = y;
        }

        layout.placement.x = layout.position.x;
        layout.placement.y = layout.position.y;
        break;
      case "relative":
        if (x !== null) {
          layout.placement.x = canvasWidth * x - layout.placement.width / 2;
        }

        if (y !== null) {
          layout.placement.y = canvasHeight * y - layout.placement.height / 2;
        }
        break;
      case "top-left":
        layout.placement.x = 0;
        layout.placement.y = 0;
        break;
      case "top-right":
        layout.placement.x = canvasWidth - layout.placement.width;
        layout.placement.y = 0;
        break;
      case "bottom-left":
        layout.placement.x = 0;
        layout.placement.y = canvasHeight - layout.placement.height;
        break;
      case "bottom-right":
        layout.placement.x = canvasWidth - layout.placement.width;
        layout.placement.y = canvasHeight - layout.placement.height;
        break;
      case "center":
      default:
        layout.position.mode = "center";

        layout.placement.x = canvasWidth / 2 - layout.placement.width / 2;
        layout.placement.y = canvasHeight / 2 - layout.placement.height / 2;
        break;
    }
  }

  _layoutFindActive(canvasRender) {
    let continueCollecting = true;
    return canvasRender.layouts.filter((layout) => {
      if (layout.predicate()) {
        if (layout.exclusive) {
          continueCollecting = false;
          return true;
        }
        return continueCollecting;
      }
      return false;
    });
  }

  _layoutFindByElement(canvasRender, name, type = null) {
    return canvasRender.layouts.filter((layout) => {
      return layout.elements.some((element) => {
        return element.name == name && (!type || element.type == type);
      });
    });
  }

  /** Canvas Render functions */
  _canvasCreateRender(config) {
    const canvasRender = lwpUtils.merge(
      {
        defaultWidth: 640,
        defaultHeight: 480,
        root: { elementId: null, element: null },
        context: null,
        framesPerSecond: 1,
        timer: null,
        layouts: [],
        styles: {
          fills: {
            background: "#2e2e32",
          },
          strokes: {
            debug: {
              crosshairs: "white",
              layoutBorder: "red",
              imageBorder: "green",
              stringBorder: "blue",
            },
          },
        },
        debug: true,
      },
      config
    );

    if (!canvasRender.root.element && canvasRender.root.elementId) {
      canvasRender.root.element = document.getElementById(
        config.root.elementId
      );
    }

    if (!canvasRender.root.element) {
      canvasRender.root.element = document.createElement("canvas");
      canvasRender.root.element.width = canvasRender.canvas.defaultWidth;
      canvasRender.root.element.height = canvasRender.canvas.defaultHeight;
    }

    canvasRender.width = canvasRender.root.element.width;
    canvasRender.height = canvasRender.root.element.height;

    if (!canvasRender.context && canvasRender.root.element) {
      canvasRender.context = canvasRender.root.element.getContext("2d");
    }

    this._config.layouts.forEach((layout) => {
      canvasRender.layouts.push(this._layoutCreate(canvasRender, layout));
    });

    canvasRender.timer = setInterval(() => {
      this._canvasUpdate(canvasRender);
    }, 1000 / canvasRender.framesPerSecond);

    this._canvasRender = canvasRender;
  }

  _canvasUpdate(canvasRender) {
    if (!canvasRender.root.element || !canvasRender.context) {
      return;
    }

    canvasRender.context.fillStyle = canvasRender.styles.fills.background;
    canvasRender.context.fillRect(
      0,
      0,
      canvasRender.width,
      canvasRender.height
    );

    if (canvasRender.debug) {
      canvasRender.context.beginPath();
      canvasRender.context.moveTo(canvasRender.width / 2, 0);
      canvasRender.context.lineTo(canvasRender.width / 2, canvasRender.height);
      canvasRender.context.strokeStyle =
        canvasRender.styles.strokes.debug.crosshairs;
      canvasRender.context.stroke();

      canvasRender.context.beginPath();
      canvasRender.context.moveTo(0, canvasRender.height / 2);
      canvasRender.context.lineTo(canvasRender.width, canvasRender.height / 2);
      canvasRender.context.strokeStyle =
        canvasRender.styles.strokes.debug.crosshairs;
      canvasRender.context.stroke();
    }

    this._layoutFindActive(canvasRender).forEach((layout) => {
      this._canvasRenderLayout(canvasRender, layout);
    });
  }

  _canvasRenderLayout(canvasRender, layout) {
    if (canvasRender.debug) {
      canvasRender.context.beginPath();
      canvasRender.context.strokeStyle =
        canvasRender.styles.strokes.debug.layoutBorder;
      canvasRender.context.strokeRect(
        layout.placement.x,
        layout.placement.y,
        layout.placement.width,
        layout.placement.height
      );
      canvasRender.context.stroke();
    }

    layout.elements.forEach((element) => {
      if (element.placement) {
        switch (element.type) {
          case "image":
            this._canvasRenderImage(canvasRender, element);
            break;
          case "string":
            this._canvasRenderString(canvasRender, element);
            break;
        }
      }
    });
  }

  _canvasRenderImage(canvasRender, element) {
    if (canvasRender.debug) {
      canvasRender.context.beginPath();
      canvasRender.context.strokeStyle =
        canvasRender.styles.strokes.debug.imageBorder;
      canvasRender.context.strokeRect(
        element.placement.x,
        element.placement.y,
        element.placement.width,
        element.placement.height
      );
      canvasRender.context.stroke();
    }

    canvasRender.context.drawImage(
      element.source,
      0,
      0,
      element.source.width,
      element.source.height,
      element.placement.x,
      element.placement.y,
      element.placement.width,
      element.placement.height
    );
  }

  _canvasRenderString(canvasRender, element) {
    if (canvasRender.debug) {
      canvasRender.context.beginPath();
      canvasRender.context.strokeStyle =
        canvasRender.styles.strokes.debug.stringBorder;
      canvasRender.context.strokeRect(
        element.placement.x,
        element.placement.y,
        element.placement.width,
        element.placement.height
      );
      canvasRender.context.stroke();
    }

    canvasRender.context.font = element.font;
    canvasRender.context.fillStyle = element.fillStyle;
    canvasRender.context.textAlign = element.textAlign;
    canvasRender.context.textBaseline = element.textBaseline;

    canvasRender.context.fillText(
      element.source,
      element.placement.x,
      element.placement.y
    );
  }
}
