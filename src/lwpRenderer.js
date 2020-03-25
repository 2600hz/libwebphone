"use strict";

import Mustache from "mustache";
import { merge, randomElementId } from "./lwpUtils";

export default class {
  constructor(libwebphone) {
    this._renders = [];
    this._loaded = false;
    libwebphone.on("language.changed", () => {
      this._loaded = true;
      this.render();
    });
    /*
    window.addEventListener("load", () => {
      this._loaded = true;
    });
    */
  }

  renderAddTarget(config) {
    if (typeof config == "string") {
      config = {
        root: { elementId: config }
      };
    }

    let render = merge(this._renderDefaultConfig(), {
      data: config.data || {},
      i18n: config.i18n || {},
      template: config.template,
      root: config.root || {},
      by_id: config.by_id || {},
      by_name: config.by_name || {}
    });

    if (render.by_id) {
      Object.keys(render.by_id).forEach(index => {
        let by_id = render.by_id[index];
        if (!by_id.elementId) {
          by_id.elementId = randomElementId();
        }
      });
    }

    if (render.by_name) {
      Object.keys(render.by_name).forEach(index => {
        let by_name = render.by_name[index];
        if (!by_name.elementName) {
          by_name.elementName = randomElementId();
        }
      });
    }

    if (this._loaded) {
      this.render(render);
    }

    this._renders.push(render);
  }

  render(render = null) {
    if (!render) {
      this._renders.forEach(render => {
        this._render(render);
      });
    } else {
      this._render(render);
    }
  }

  renderUpdates(modifier = render => render) {
    this._renders.forEach(render => {
      modifier(render);
    });
  }

  _render(render) {
    let renderConfig = {
      data: render.data,
      by_id: render.by_id,
      by_name: render.by_name,
      i18n: this._i18nTranslate(render.i18n)
    };

    console.log(renderConfig);

    render.html = Mustache.render(render.template, renderConfig);

    if (!render.root.element && render.root.elementId) {
      render.root.element = document.getElementById(render.root.elementId);
    }

    if (render.root.element) {
      render.root.element.innerHTML = render.html;
    }

    if (render.by_id) {
      Object.keys(render.by_id).forEach(index => {
        let by_id = render.by_id[index];

        if (by_id.elementId) {
          by_id.element = document.getElementById(by_id.elementId);
        }

        if (by_id.element && by_id.events) {
          Object.keys(by_id.events).forEach(event => {
            by_id.element[event] = by_id.events[event];
          });
        }
      });
    }

    if (render.by_name) {
      Object.keys(render.by_name).forEach(index => {
        let by_name = render.by_name[index];

        if (by_name.elementName) {
          by_name.elements = document.getElementsByName(by_name.elementName);
        }

        if (by_name.elements && by_name.events) {
          by_name.elements.forEach(element => {
            Object.keys(by_name.events).forEach(event => {
              element[event] = by_name.events[event];
            });
          });
        }
      });
    }

    return render;
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
