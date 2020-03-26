"use strict";

import { merge } from "./lwpUtils";
import lwpRenderer from "./lwpRenderer";

export default class extends lwpRenderer {
  constructor(libwebphone, config = {}) {
    super(libwebphone);
    this._libwebphone = libwebphone;
    this._emit = this._libwebphone._dialpadEvent;
    this._initProperties(config);
    this._initInternationalization(config.i18n || {});
    this._initEventBindings();
    this._initRenderTargets();
    this._emit("started", this);
    return this;
  }

  dial(value) {
    let digit = this._valueToDigit(value);
    let call = this._libwebphone.getCallList().getCall();
    if (call.hasSession()) {
      call.sendDTMF(digit);
    } else {
      this._digits.push(digit);
    }
    let tones = this._config.tones[value];
    if (tones) {
      this._libwebphone.getMediaDevices().startPlayTone(tones);
    }
    this._emit("dial", this, digit);
  }

  clear() {
    this._digits = [];
    this._emit("clear", this);
  }

  digits() {
    return this._digits;
  }

  /** Init functions */

  _initInternationalization(config) {
    let defaults = {
      en: {
        zero: "0",
        one: "1",
        two: "2",
        three: "3",
        four: "4",
        five: "5",
        six: "6",
        seven: "7",
        eight: "8",
        nine: "9",
        pound: "#",
        astrisk: "*",
        clear: "clear"
      }
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("dialpad", resourceBundles);
  }

  _initProperties(config) {
    let defaults = {
      renderTargets: [],
      tones: {
        zero: [1336, 941],
        one: [1209, 697],
        two: [1336, 697],
        three: [1477, 697],
        four: [1209, 770],
        five: [1336, 770],
        six: [1477, 697],
        seven: [1209, 852],
        eight: [1336, 852],
        nine: [1477, 852],
        pound: [1477, 941],
        astrisk: [1209, 941]
      }
    };
    this._config = merge(defaults, config);
    this._digits = [];
  }

  _initEventBindings() {}

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
        zero: "libwebphone:dialpad.zero",
        one: "libwebphone:dialpad.one",
        two: "libwebphone:dialpad.two",
        three: "libwebphone:dialpad.three",
        four: "libwebphone:dialpad.four",
        five: "libwebphone:dialpad.five",
        six: "libwebphone:dialpad.six",
        seven: "libwebphone:dialpad.seven",
        eight: "libwebphone:dialpad.eight",
        nine: "libwebphone:dialpad.nine",
        pound: "libwebphone:dialpad.pound",
        astrisk: "libwebphone:dialpad.astrisk",
        clear: "libwebphone:dialpad.clear"
      },
      by_id: {
        zero: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              this.dial(element.dataset.value);
            }
          }
        },
        one: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              this.dial(element.dataset.value);
            }
          }
        },
        two: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              this.dial(element.dataset.value);
            }
          }
        },
        three: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              this.dial(element.dataset.value);
            }
          }
        },
        four: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              this.dial(element.dataset.value);
            }
          }
        },
        five: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              this.dial(element.dataset.value);
            }
          }
        },
        six: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              this.dial(element.dataset.value);
            }
          }
        },
        seven: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              this.dial(element.dataset.value);
            }
          }
        },
        eight: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              this.dial(element.dataset.value);
            }
          }
        },
        nine: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              this.dial(element.dataset.value);
            }
          }
        },
        pound: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              this.dial(element.dataset.value);
            }
          }
        },
        astrisk: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              this.dial(element.dataset.value);
            }
          }
        },
        clear: {
          events: {
            onclick: event => {
              this.clear();
            }
          }
        }
      }
    };
  }

  _renderDefaultTemplate() {
    return `
    <div>
      <input type="text" id="{{by_id.dialed}}" />
      <div>
      <button id="{{by_id.one.elementId}}" data-value="one">{{i18n.one}}</button>
      <button id="{{by_id.two.elementId}}" data-value="two">{{i18n.two}}</button>
      <button id="{{by_id.three.elementId}}" data-value="three">{{i18n.three}}</button>
      </div>

      <div>
      <button id="{{by_id.four.elementId}}" data-value="four">{{i18n.four}}</button>
      <button id="{{by_id.five.elementId}}" data-value="five">{{i18n.five}}</button>
      <button id="{{by_id.six.elementId}}" data-value="six">{{i18n.six}}</button>
      </div>

      <div>
      <button id="{{by_id.seven.elementId}}" data-value="seven">{{i18n.seven}}</button>
      <button id="{{by_id.eight.elementId}}" data-value="eight">{{i18n.eight}}</button> 
      <button id="{{by_id.nine.elementId}}" data-value="nine">{{i18n.nine}}</button>
      </div>

      <div>
      <button id="{{by_id.astrisk.elementId}}" data-value="astrisk">{{i18n.astrisk}}</button>
      <button id="{{by_id.zero.elementId}}" data-value="zero">{{i18n.zero}}</button>
      <button id="{{by_id.pound.elementId}}" data-value="pound">{{i18n.pound}}</button>
      </div>

      <div>
      <button id="{{by_id.clear.elementId}}" data-value="clear">{{i18n.clear}}</button>
      </div>
	  </div>
    `;
  }

  /** Helper functions */

  _valueToDigit(key) {
    let dictionary = {
      zero: "0",
      one: "1",
      two: "2",
      three: "3",
      four: "4",
      five: "5",
      six: "6",
      seven: "7",
      eight: "8",
      nine: "9",
      pound: "#",
      astrisk: "*"
    };
    return dictionary[key];
  }
}
