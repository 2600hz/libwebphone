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

  call() {
    let numbertocall = this._digits.join("");
    this.clear();

    this._libwebphone.getUserAgent().call(numbertocall);

    this._emit("call", this, numbertocall);
  }

  dial(digit, tones) {
    let call = this._libwebphone.getCallList().getCall();

    if (call.hasSession()) {
      call.sendDTMF(digit);
    } else {
      this._digits.push(digit);
    }

    if (tones) {
      this._libwebphone.getMediaDevices().startPlayTone(...tones);
    }

    this.updateRenders();

    this._emit("digits.updated", this, this._digits);
  }

  backspace() {
    this._digits.pop();
    this.updateRenders();
    this._emit("digits.backspace", this, this._digits);
  }

  clear() {
    this._digits = [];
    this.updateRenders();
    this._emit("digits.clear", this);
  }

  digits() {
    return this._digits;
  }

  updateRenders(postrender = render => render) {
    this.render(render => {
      render.data.digits = this._digits.join("");
      return render;
    }, postrender);
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
        clear: "clear",
        backspace: "<-",
        call: "Call"
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
        one: "libwebphone:dialpad.one",
        two: "libwebphone:dialpad.two",
        three: "libwebphone:dialpad.three",
        four: "libwebphone:dialpad.four",
        five: "libwebphone:dialpad.five",
        six: "libwebphone:dialpad.six",
        seven: "libwebphone:dialpad.seven",
        eight: "libwebphone:dialpad.eight",
        nine: "libwebphone:dialpad.nine",
        astrisk: "libwebphone:dialpad.astrisk",
        zero: "libwebphone:dialpad.zero",
        pound: "libwebphone:dialpad.pound",
        clear: "libwebphone:dialpad.clear",
        backspace: "libwebphone:dialpad.backspace",
        call: "libwebphone:dialpad.call"
      },
      data: {},
      by_id: {
        dialed: {
          events: {
            oninput: event => {
              this._syncElementValue(event);
            },
            onkeypress: event => {
              // On enter...
              if (event.keyCode == 13) {
                if (this._digits.length > 0) {
                  this.call();
                }
              }
            }
          }
        },
        one: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            }
          }
        },
        two: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            }
          }
        },
        three: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            }
          }
        },
        four: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            }
          }
        },
        five: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            }
          }
        },
        six: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            }
          }
        },
        seven: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            }
          }
        },
        eight: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            }
          }
        },
        nine: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            }
          }
        },
        astrisk: {
          events: {
            onclick: event => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            }
          }
        },
        zero: {
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
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            }
          }
        },
        clear: {
          events: {
            onclick: event => {
              this.clear();
            }
          }
        },
        backspace: {
          events: {
            onclick: event => {
              this.backspace();
            }
          }
        },
        call: {
          events: {
            onclick: event => {
              this.call();
            }
          }
        }
      }
    };
  }

  _renderDefaultTemplate() {
    return `
    <div>
      <div>
      <input type="text" id="{{by_id.dialed.elementId}}" value="{{data.digits}}" />        
        <button id="{{by_id.backspace.elementId}}" {{^data.digits}}disabled{{/data.digits}}>{{i18n.backspace}}</button>
        <button id="{{by_id.clear.elementId}}" {{^data.digits}}disabled{{/data.digits}}>{{i18n.clear}}</button>
      </div>

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
      <button id="{{by_id.call.elementId}}" {{^data.digits}}disabled{{/data.digits}}>{{i18n.call}}</button>
      </div>
	  </div>
    `;
  }

  /** Helper functions */

  _valueToChar(value) {
    return this._charDictionary()[value];
  }

  _valueToTone(value) {
    return this._config.tones[value];
  }

  _charToValue(char) {
    let dictionary = this._charDictionary();
    let flipped = Object.keys(dictionary).reduce((flipped, key) => {
      flipped[dictionary[key]] = key;
      return flipped;
    }, {});
    return flipped[char];
  }

  _charToTone(char) {
    return this._valueToTone(this._charToValue(char));
  }

  _charDictionary() {
    return {
      one: "1",
      two: "2",
      three: "3",
      four: "4",
      five: "5",
      six: "6",
      seven: "7",
      eight: "8",
      nine: "9",
      astrisk: "*",
      zero: "0",
      pound: "#"
    };
  }

  _syncElementValue(event) {
    let element = event.srcElement;
    let tones = this._charToTone(event.data);
    let call = this._libwebphone.getCallList().getCall();

    if (call.hasSession()) {
      if (event.data) {
        call.sendDTMF(event.data);
      }
    } else {
      this._digits = element.value.split("");
    }

    if (tones) {
      this._libwebphone.getMediaDevices().startPlayTone(...tones);
    }

    this.updateRenders(render => {
      if (element.id == render.by_id.dialed.elementId) {
        let position = element.selectionStart;
        render.by_id.dialed.element.focus();
        render.by_id.dialed.element.setSelectionRange(position, position);
      }
    });

    this._emit("digits.updated", this, event.data);
  }
}
