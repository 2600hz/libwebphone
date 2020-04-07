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
    this._emit("created", this);
    return this;
  }

  dial(digit, tones = true) {
    let call = this._getCall();

    if (tones === true) {
      tones = this._charToTone(digit);
    }

    if (tones) {
      this._playTones(...tones);
    }

    if (call && !call.isInTransfer()) {
      call.sendDTMF(digit);
    } else {
      this._digits.push(digit);
    }

    this._emit("digits.updated", this, this.getTarget(), digit);
  }

  backspace() {
    this._digits.pop();

    this._emit("digits.backspace", this, this.getTarget());
  }

  clear() {
    this._digits = [];

    this._emit("digits.clear", this, this.getTarget());
  }

  getTarget(clear = false, join = true) {
    let digits = this._digits;

    if (clear) {
      this.clear();
    }

    if (join) {
      digits = digits.join("");
    }
    return digits;
  }

  hasDigits() {
    let digits = this.getTarget(false, false);

    if (digits.length > 0) {
      return true;
    }

    return false;
  }

  answer() {
    let call = this._getCall();

    if (!call) {
      return;
    }

    call.answer();
  }

  call(redial = true) {
    let userAgent = this._libwebphone.getUserAgent();
    let target = this.getTarget(true, false);

    if (!userAgent) {
      return;
    }

    if (redial && !target.length) {
      target = userAgent.getRedial();
    } else {
      target = target.join("");
    }

    userAgent.call(target);

    this._emit("call", this, target);
  }

  redial() {
    let userAgent = this._libwebphone.getUserAgent();

    if (!userAgent) {
      return;
    }

    userAgent.call();

    this._emit("redial", this);
  }

  transfer() {
    let call = this._getCall();

    if (call) {
      call.transfer(this.getTarget());
      this.clear();
    }
  }

  terminate() {
    let call = this._getCall();

    if (!call) {
      return;
    }

    call.terminate();
  }

  autoAction(options) {
    let defaultOptions = {
      answer: true,
      redial: true,
      call: true,
      transfer: true,
      terminate: true,
    };
    options = merge(defaultOptions, options);
    switch (this.getAutoAction()) {
      case "answer":
        if (options.answer) this.answer();
        break;
      case "redial":
        if (options.redial) this.redial();
        break;
      case "call":
        if (options.call) this.call();
        break;
      case "transfer":
        if (options.call) this.transfer();
        break;
      case "terminate":
        if (options.call) this.terminate();
        break;
    }
  }

  getAutoAction() {
    let call = this._getCall();

    if (!call) {
      if (!this.hasDigits()) {
        return "redial";
      }
      return "call";
    } else if (call.isInTransfer()) {
      return "transfer";
    } else {
      if (call.getDirection() == "terminating" && !call.isEstablished()) {
        return "answer";
      } else {
        return "terminate";
      }
    }
  }

  updateRenders(postrender = (render) => render) {
    this.render((render) => {
      render.data = this._renderData(render.data);
      return render;
    }, postrender);
  }

  /** Init functions */

  _initInternationalization(config) {
    let defaults = {
      en: {
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
        pound: "#",
        clear: "clear",
        backspace: "<-",
        call: "Call",
        transfer: "Transfer",
      },
    };
    let resourceBundles = merge(defaults, config.resourceBundles || {});
    this._libwebphone.i18nAddResourceBundles("dialpad", resourceBundles);
  }

  _initProperties(config) {
    let defaults = {
      renderTargets: [],
      dialed: {
        show: true,
        delete: {
          show: true,
        },
        clear: {
          show: true,
        },
      },
      controls: {
        show: true,
        call: {
          show: true,
        },
        transfer: {
          show: true,
        },
      },
      dialpad: {
        show: true,
      },
      tones: {
        one: [1209, 697],
        two: [1336, 697],
        three: [1477, 697],
        four: [1209, 770],
        five: [1336, 770],
        six: [1477, 697],
        seven: [1209, 852],
        eight: [1336, 852],
        nine: [1477, 852],
        astrisk: [1209, 941],
        zero: [1336, 941],
        pound: [1477, 941],
      },
    };
    this._config = merge(defaults, config);
    this._digits = [];
  }

  _initEventBindings() {
    this._libwebphone.on("call.primary.transfer.collecting", () => {
      this.clear();
    });
    this._libwebphone.on("call.primary.transfer.complete", () => {
      this.clear();
    });
    this._libwebphone.on("call.primary.transfer.failed", () => {
      this.clear();
    });

    this._libwebphone.on("callList.calls.switched", () => {
      this.updateRenders();
    });

    this._libwebphone.on("dialpad.digits.updated", () => {
      this.updateRenders();
    });
    this._libwebphone.on("dialpad.digits.backspace", () => {
      this.updateRenders();
    });
    this._libwebphone.on("dialpad.digits.clear", () => {
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
        call: "libwebphone:dialpad.call",
        transfer: "libwebphone:dialpad.transfer",
      },
      data: merge(this._renderData(), this._config),
      by_id: {
        dialed: {
          events: {
            oninput: (event) => {
              this._syncElementValue(event);
            },
            onkeypress: (event) => {
              // On enter...
              if (event.keyCode == 13) {
                this.autoAction({ terminate: false });
              }
            },
          },
        },
        one: {
          events: {
            onclick: (event) => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        two: {
          events: {
            onclick: (event) => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        three: {
          events: {
            onclick: (event) => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        four: {
          events: {
            onclick: (event) => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        five: {
          events: {
            onclick: (event) => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        six: {
          events: {
            onclick: (event) => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        seven: {
          events: {
            onclick: (event) => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        eight: {
          events: {
            onclick: (event) => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        nine: {
          events: {
            onclick: (event) => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        astrisk: {
          events: {
            onclick: (event) => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        zero: {
          events: {
            onclick: (event) => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        pound: {
          events: {
            onclick: (event) => {
              let element = event.srcElement;
              let value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        clear: {
          events: {
            onclick: (event) => {
              this.clear();
            },
          },
        },
        backspace: {
          events: {
            onclick: (event) => {
              this.backspace();
            },
          },
        },
        call: {
          events: {
            onclick: (event) => {
              let element = event.srcElement;
              element.disabled = true;
              this.call();
            },
          },
        },
        transfer: {
          events: {
            onclick: (event) => {
              let element = event.srcElement;
              element.disabled = true;
              this.transfer();
            },
          },
        },
      },
    };
  }

  _renderDefaultTemplate() {
    return `
    <div>
      {{#data.dialed.show}}
        <div>
          <input type="text" id="{{by_id.dialed.elementId}}" value="{{data.digits}}" />

          {{#data.dialed.delete.show}}
            <button id="{{by_id.backspace.elementId}}" {{^data.digits}}disabled{{/data.digits}}>{{i18n.backspace}}</button>
          {{/data.dialed.delete.show}}

          {{#data.dialed.clear.show}}
            <button id="{{by_id.clear.elementId}}" {{^data.digits}}disabled{{/data.digits}}>{{i18n.clear}}</button>
          {{/data.dialed.clear.show}}
        </div>
      {{/data.dialed.show}}

      {{#data.dialpad.show}}
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
      {{/data.dialpad.show}}

      {{#data.controls.show}}

        {{#data.controls.call.show}}
        {{^data.call}}
          <div>
            <button id="{{by_id.call.elementId}}" {{^data.digits}}disabled{{/data.digits}}>{{i18n.call}}</button>
          </div>
        {{/data.call}}
        {{/data.controls.call.show}}

        {{#data.controls.transfer.show}}
        {{#data.call.inTransfer}}
          <div>
            <button id="{{by_id.transfer.elementId}}" {{^data.digits}}disabled{{/data.digits}}>{{i18n.transfer}}</button>
          </div>
        {{/data.call.inTransfer}}
        {{/data.controls.transfer.show}}

      {{/data.controls.show}}
	  </div>
    `;
  }

  _renderData(data = {}) {
    let call = this._getCall();

    if (call) {
      data.call = call.summary();
    }

    data.digits = this.getTarget();

    return data;
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
      pound: "#",
    };
  }

  _syncElementValue(event) {
    let element = event.srcElement;
    let tones = this._charToTone(event.data);
    let call = this._getCall();

    if (tones) {
      this._playTones(...tones);
    }

    if (call && !call.isInTransfer()) {
      call.sendDTMF(event.data);
    } else {
      this._digits = element.value.split("");
    }

    this.updateRenders((render) => {
      if (element.id == render.by_id.dialed.elementId) {
        let position = element.selectionStart;
        render.by_id.dialed.element.focus();
        render.by_id.dialed.element.setSelectionRange(position, position);
      }
    });

    this._emit("digits.updated", this, this.getTarget(), event.data);
  }

  _playTones(...tones) {
    let audioMixer = this._libwebphone.getAudioMixer();

    if (audioMixer) {
      audioMixer.playTones(...tones);
    }
  }

  _getCall() {
    let callList = this._libwebphone.getCallList();

    if (callList) {
      return callList.getCall();
    }
  }
}
