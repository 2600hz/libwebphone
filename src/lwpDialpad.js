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

  dial(digit) {
    let call = this._libwebphone.getCallList().getCall();
    if (call.hasSession()) {
      call.sendDTMF(digit);
    } else {
      this._digits.push(digit);
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
        zero: [1336, 697],
        one: [1336, 697],
        two: [1336, 697],
        three: [1336, 697],
        four: [1336, 697],
        five: [1336, 697],
        six: [1336, 697],
        seven: [1336, 697],
        eight: [1336, 697],
        nine: [1336, 697],
        pound: [1336, 697],
        astrisk: [1336, 697]
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
              let digit = this._valueToDigit(element.dataset.value);
              this.dial(digit);
            }
          }
        },
        one: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = this._valueToDigit(element.dataset.value);
              this.dial(digit);
            }
          }
        },
        two: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = this._valueToDigit(element.dataset.value);
              this.dial(digit);
            }
          }
        },
        three: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = this._valueToDigit(element.dataset.value);
              this.dial(digit);
            }
          }
        },
        four: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = this._valueToDigit(element.dataset.value);
              this.dial(digit);
            }
          }
        },
        five: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = this._valueToDigit(element.dataset.value);
              this.dial(digit);
            }
          }
        },
        six: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = this._valueToDigit(element.dataset.value);
              this.dial(digit);
            }
          }
        },
        seven: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = this._valueToDigit(element.dataset.value);
              this.dial(digit);
            }
          }
        },
        eight: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = this._valueToDigit(element.dataset.value);
              this.dial(digit);
            }
          }
        },
        nine: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = this._valueToDigit(element.dataset.value);
              this.dial(digit);
            }
          }
        },
        pound: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = this._valueToDigit(element.dataset.value);
              this.dial(digit);
            }
          }
        },
        astrisk: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = this._valueToDigit(element.dataset.value);
              this.dial(digit);
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

  eventfordialpadbutton(val) {
    if (window.__pushed__) return;

    const context = window.__context__ || new AudioContext();
    const sampleRate = 3000;
    const buffer = context.createBuffer(2, sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    const data1 = buffer.getChannelData(1);
    let currentTime = 0;

    //same frequency for same button
    const keymaps = {
      "1": [1336, 697],
      "2": [1336, 697],
      "3": [1336, 697],
      A: [1336, 697],
      "4": [1336, 697],
      "5": [1336, 697],
      "6": [1336, 697],
      B: [1336, 697],
      "7": [1336, 697],
      "8": [1336, 697],
      "9": [1336, 697],
      C: [1336, 697],
      "*": [1336, 697],
      "0": [1336, 697],
      "#": [1336, 697],
      D: [1336, 697]
    };

    if (!keymaps[val]) return;

    for (let i = 0; i < 0.5 * sampleRate; i++) {
      data[i] = Math.sin(2 * Math.PI * keymaps[val][0] * (i / sampleRate));
    }

    for (let i = 0; i < 0.5 * sampleRate; i++) {
      data1[i] = Math.sin(2 * Math.PI * keymaps[val][1] * (i / sampleRate));
    }

    const gainNode = context.createGain();
    gainNode.connect(context.destination);

    const src = context.createBufferSource();
    src.buffer = buffer;
    src.connect(gainNode);
    src.start(currentTime);

    window.__pushed__ = true;
    setTimeout(() => {
      window.__pushed__ = false;
    }, 100);
    if (!window.__context__) window.__context__ = context;
    return Promise.resolve();
  } //End of eventfordialpadbutton
}
