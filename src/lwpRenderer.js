"use strict";

import Mustache from "mustache";
import { merge, randomElementId } from "./lwpUtils";

export default class {
  constructor(libwebphone) {
    this._renders = [];
    this._windowLoaded = false;
    this._i18nReady = false;
    this._renderReady = false;
    libwebphone.on("language.changed", () => {
      this._i18nReady = true;
      if (this._windowLoaded && this._i18nReady) {
        this._renderReady = true;
        this.render();
      }
    });
    window.addEventListener("load", () => {
      this._windowLoaded = true;
      if (this._windowLoaded && this._i18nReady) {
        this._renderReady = true;
        this.render();
      }
    });
  }

  renderAddTarget(config) {
    if (typeof config == "string") {
      config = {
        root: { elementId: config },
      };
    }

    let render = merge(this._renderDefaultConfig(), {
      data: config.data || {},
      i18n: config.i18n || {},
      template: config.template,
      root: config.root || {},
      by_id: config.by_id || {},
      by_name: config.by_name || {},
      enabled: true,
    });

    if (render.by_id) {
      Object.keys(render.by_id).forEach((index) => {
        let by_id = render.by_id[index];
        if (!by_id.elementId) {
          by_id.elementId = randomElementId();
        }
      });
    }

    if (render.by_name) {
      Object.keys(render.by_name).forEach((index) => {
        let by_name = render.by_name[index];
        if (!by_name.elementName) {
          by_name.elementName = randomElementId();
        }
      });
    }

    this._emit("render.new", this, render);

    if (this._renderReady) {
      this._render(render);
    }

    this._renders.push(render);
  }

  render(premodifier = (render) => render, postmodifier = (render) => render) {
    let renderPromises = [];
    this._renders.forEach((render) => {
      renderPromises.push(
        this._render(premodifier(render)).then((render) => postmodifier(render))
      );
    });
    return Promise.all(renderPromises).then((rendered) => {
      this._emit("render.rendered", this, rendered);
      return rendered;
    });
  }

  _render(render) {
    return new Promise((resolve) => {
      if (!this._renderReady) {
        resolve(render);
      } else {
        let renderConfig = {
          data: render.data,
          by_id: render.by_id,
          by_name: render.by_name,
          i18n: this._i18nTranslate(render.i18n),
        };

        render.html = Mustache.render(render.template, renderConfig);

        if (!render.root.element && render.root.elementId) {
          render.root.element = document.getElementById(render.root.elementId);
        }

        if (render.root.element && render.enabled) {
          render.root.element.innerHTML = render.html;
        }

        if (render.by_id) {
          Object.keys(render.by_id).forEach((index) => {
            let by_id = render.by_id[index];

            if (by_id.elementId) {
              by_id.element = document.getElementById(by_id.elementId);
            }

            if (by_id.element && by_id.events) {
              Object.keys(by_id.events).forEach((event) => {
                by_id.element[event] = (...data) => {
                  data.push(render);
                  by_id.events[event].apply(this, data);
                };
              });
            }
          });
        }

        if (render.by_name) {
          Object.keys(render.by_name).forEach((index) => {
            let by_name = render.by_name[index];

            if (by_name.elementName) {
              by_name.elements = document.getElementsByName(
                by_name.elementName
              );
            }

            if (by_name.elements && by_name.events) {
              by_name.elements.forEach((element) => {
                Object.keys(by_name.events).forEach((event) => {
                  element[event] = (...data) => {
                    data.push(render);
                    by_name.events[event].apply(this, data);
                  };
                });
              });
            }
          });
        }

        resolve(render);
      }
    });
  }

  _i18nTranslate(i18n) {
    let translator = this._libwebphone.i18nTranslator();
    let translations = {};
    for (let [key, value] of Object.entries(i18n)) {
      translations[key] = translator(value);
    }
    return translations;
  }
}
