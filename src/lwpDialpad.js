"use strict";

import lwpUtils from "./lwpUtils";
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

  dial(char, tones = true) {
    const call = this._getCall();

    if (typeof char !== "string" && !(char instanceof String)) {
      char = char.toString();
    }

    if (tones === true) {
      tones = this._charToTone(char);
    }

    if (tones !== false) {
      this._emit("tones.play", this, tones);
    }

    if (call && !call.isInTransfer()) {
      call.sendDTMF(char);
    } else {
      this._target.push(char);
    }

    this._emit("target.updated", this, this.getTarget(), char);
  }

  backspace() {
    this._target.pop();

    this._emit("target.backspace", this, this.getTarget());
  }

  clear() {
    this._target = [];

    this._emit("target.clear", this, this.getTarget());
  }

  enableFilter() {
    if (this._config.dialed.filter.enabled) {
      return;
    }

    this._config.dialed.filter.enabled = true;
    this._emit("filter.enabled", this);
  }

  disableFilter() {
    if (!this._config.dialed.filter.enabled) {
      return;
    }

    this._config.dialed.filter.enabled = false;
    this._emit("filter.disabled", this);
  }

  toggleFilter() {
    if (this._config.dialed.filter.enabled) {
      this.disableFilter();
    } else {
      this.enableFilter();
    }
  }

  enableConvertion() {
    if (this._config.dialed.convert.enabled) {
      return;
    }

    this._config.dialed.convert.enabled = true;
    this._emit("convert.enabled", this);
  }

  disableConvertion() {
    if (!this._config.dialed.convert.enabled) {
      return;
    }

    this._config.dialed.convert.enabled = false;
    this._emit("convert.disabled", this);
  }

  toggleConvertion() {
    if (this._config.dialed.convert.enabled) {
      this.disableConvertion();
    } else {
      this.enableConvertion();
    }
  }

  getTarget(clear = false, join = true) {
    let target = this._target;
    const options = this._config.dialed;

    if (options.convert.enabled) {
      target = target.map((char) => {
        char = char.toLowerCase();
        switch (true) {
          case /[abc]/.test(char):
            return "1";
          case /[def]/.test(char):
            return "2";
          case /[ghi]/.test(char):
            return "4";
          case /[jkl]/.test(char):
            return "5";
          case /[mno]/.test(char):
            return "6";
          case /[pqrs]/.test(char):
            return "7";
          case /[tuv]/.test(char):
            return "8";
          case /[wxyz]/.test(char):
            return "9";
          default:
            return char;
        }
      });
    }

    if (options.filter.enabled) {
      target = target.filter((char) => {
        return /[0-9*#]/.test(char);
      });
    }

    if (clear) {
      this.clear();
    }

    if (join) {
      target = target.join("");
    }

    return target;
  }

  hasTarget() {
    const target = this.getTarget(false, false);

    if (target.length > 0) {
      return true;
    }

    return false;
  }

  answer() {
    const call = this._getCall();

    if (!call) {
      return;
    }

    call.answer();
  }

  call(redial = true) {
    let target = this.getTarget(true, false);
    const userAgent = this._libwebphone.getUserAgent();

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
    const userAgent = this._libwebphone.getUserAgent();

    if (!userAgent) {
      return;
    }

    userAgent.call();

    this._emit("redial", this);
  }

  transfer() {
    const call = this._getCall();

    if (call) {
      call.transfer(this.getTarget());
      this.clear();
    }
  }

  terminate() {
    const call = this._getCall();

    if (!call) {
      return;
    }

    call.terminate();
  }

  autoAction(options) {
    const defaultOptions = {
      answer: true,
      redial: true,
      call: true,
      transfer: true,
      terminate: true,
    };
    options = lwpUtils.merge(defaultOptions, options);
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
        if (options.transfer) this.transfer();
        break;
      case "terminate":
        if (options.terminate) this.terminate();
        break;
    }
  }

  getAutoAction() {
    const call = this._getCall();

    if (!call) {
      if (!this.hasTarget()) {
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
    const defaults = {
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
        enableconvert: "A -> #",
        disableconvert: "A -> A",
        enablefilter: "# Only",
        disablefilter: "Any",
      },
    };
    const resourceBundles = lwpUtils.merge(
      defaults,
      config.resourceBundles || {}
    );
    this._libwebphone.i18nAddResourceBundles("dialpad", resourceBundles);
  }

  _initProperties(config) {
    const defaults = {
      renderTargets: [],
      dialed: {
        show: true,
        backspace: {
          show: true,
        },
        clear: {
          show: true,
        },
        filter: {
          show: true,
          enabled: true,
        },
        convert: {
          show: true,
          enabled: false,
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
      globalKeyShortcuts: true,
      keys: {
        enter: {
          enabled: true,
          action: () => {
            if (
              this._libwebphone.getUserAgent() &&
              !this._libwebphone.getUserAgent().isStarted()
            ) {
              this._libwebphone.getUserAgent().start();
            } else {
              this.autoAction({ terminate: false });
            }
          },
        },
        escape: {
          enabled: true,
          action: () => {
            if (this._getCall()) {
              this.terminate();
            } else {
              this.clear();
            }
          },
        },
        backspace: {
          enabled: true,
          action: () => {
            this.backspace();
          },
        },
        dtmf: {
          enabled: true,
          action: (event) => {
            if (!this._getCall() || /^[0-9#*]$/.test(event.key)) {
              this.dial(event.key);
            }
          },
        },
      },
    };
    this._config = lwpUtils.merge(defaults, config);
    this._target = [];
  }

  _initEventBindings() {
    this._libwebphone.on("call.primary.transfer.collecting", () => {
      this.clear();
    });
    this._libwebphone.on("call.primary.transfer.complete", () => {
      this.clear();
    });

    this._libwebphone.on("callList.calls.changed", () => {
      this.updateRenders();
    });

    this._libwebphone.on("dialpad.target.updated", () => {
      this.updateRenders();
    });
    this._libwebphone.on("dialpad.target.backspace", () => {
      this.updateRenders();
    });
    this._libwebphone.on("dialpad.target.clear", () => {
      this.updateRenders();
    });
    this._libwebphone.on("dialpad.convert.enabled", () => {
      this.updateRenders();
    });
    this._libwebphone.on("dialpad.convert.disabled", () => {
      this.updateRenders();
    });
    this._libwebphone.on("dialpad.filter.enabled", () => {
      this.updateRenders();
    });
    this._libwebphone.on("dialpad.filter.disabled", () => {
      this.updateRenders();
    });

    if (this._config.globalKeyShortcuts) {
      document.addEventListener("keydown", (event) => {
        const key = event.key;
        if (event.target != document.body) {
          return;
        }

        switch (key) {
          case "Enter":
            if (this._config.keys["enter"].enabled) {
              this._config.keys["enter"].action(event, this);
            }
            break;
          case "Escape":
            if (this._config.keys["escape"].enabled) {
              this._config.keys["escape"].action(event, this);
            }
            break;
          case "Backspace":
            if (this._config.keys["backspace"].enabled) {
              this._config.keys["backspace"].action(event, this);
            }
            break;
          default:
            if (key.length == 1) {
              if (this._config.keys["dtmf"].enabled) {
                this._config.keys["dtmf"].action(event, this);
              }
            }
        }
      });
    }
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
        enableconvert: "libwebphone:dialpad.enableconvert",
        disableconvert: "libwebphone:dialpad.disableconvert",
        enablefilter: "libwebphone:dialpad.enablefilter",
        disablefilter: "libwebphone:dialpad.disablefilter",
      },
      data: lwpUtils.merge({}, this._config, this._renderData()),
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
              const element = event.srcElement;
              const value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        two: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              const value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        three: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              const value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        four: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              const value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        five: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              const value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        six: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              const value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        seven: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              const value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        eight: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              const value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        nine: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              const value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        astrisk: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              const value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        zero: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              const value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        pound: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              const value = element.dataset.value;
              this.dial(this._valueToChar(value), this._valueToTone(value));
            },
          },
        },
        clear: {
          events: {
            onclick: () => {
              this.clear();
            },
          },
        },
        convert: {
          events: {
            onclick: () => {
              this.toggleConvertion();
            },
          },
        },
        filter: {
          events: {
            onclick: () => {
              this.toggleFilter();
            },
          },
        },
        backspace: {
          events: {
            onclick: () => {
              this.backspace();
            },
          },
        },
        call: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.call();
            },
          },
        },
        transfer: {
          events: {
            onclick: (event) => {
              const element = event.srcElement;
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
          <input type="text" id="{{by_id.dialed.elementId}}" value="{{data.target}}" />

          {{#data.dialed.backspace.show}}
            <button id="{{by_id.backspace.elementId}}" {{^data.target}}disabled{{/data.target}}>{{i18n.backspace}}</button>
          {{/data.dialed.backspace.show}}

          {{#data.dialed.clear.show}}
            <button id="{{by_id.clear.elementId}}" {{^data.target}}disabled{{/data.target}}>{{i18n.clear}}</button>
          {{/data.dialed.clear.show}}

          {{#data.dialed.convert.show}}
            <button id="{{by_id.convert.elementId}}">
              {{#data.convert}}{{i18n.disableconvert}}{{/data.convert}}
              {{^data.convert}}{{i18n.enableconvert}}{{/data.convert}}
            </button>
          {{/data.dialed.convert.show}}

          {{#data.dialed.filter.show}}
            <button id="{{by_id.filter.elementId}}">
              {{#data.filter}}{{i18n.disablefilter}}{{/data.filter}}
              {{^data.filter}}{{i18n.enablefilter}}{{/data.filter}}
            </button>
          {{/data.dialed.filter.show}}

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
            <button id="{{by_id.call.elementId}}" {{^data.target}}disabled{{/data.target}}>{{i18n.call}}</button>
          </div>
        {{/data.call}}
        {{/data.controls.call.show}}

        {{#data.controls.transfer.show}}
        {{#data.call.inTransfer}}
          <div>
            <button id="{{by_id.transfer.elementId}}" {{^data.target}}disabled{{/data.target}}>{{i18n.transfer}}</button>
          </div>
        {{/data.call.inTransfer}}
        {{/data.controls.transfer.show}}

      {{/data.controls.show}}
	  </div>
    `;
  }

  _renderData(data = {}) {
    const call = this._getCall();

    if (call) {
      data.call = call.summary();
    }

    data.target = this.getTarget();

    data.convert = this._config.dialed.convert.enabled;

    data.filter = this._config.dialed.filter.enabled;

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
    const dictionary = this._charDictionary();
    const flipped = Object.keys(dictionary).reduce((flipped, key) => {
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
    const element = event.srcElement;
    const tones = this._charToTone(event.data);
    const call = this._getCall();

    if (tones) {
      this._emit("tones.play", this, tones);
    }

    if (call && !call.isInTransfer()) {
      call.sendDTMF(event.data);
    } else {
      this._target = element.value.split("");
    }

    this.updateRenders((render) => {
      render.data = this._renderData(render.data);
      if (element.id == render.by_id.dialed.elementId) {
        const position = element.selectionStart;
        render.by_id.dialed.element.focus();
        render.by_id.dialed.element.setSelectionRange(position, position);
      }
    });

    this._emit("target.updated", this, this.getTarget(), event.data);
  }

  _getCall() {
    const callList = this._libwebphone.getCallList();

    if (callList) {
      return callList.getCall();
    }
  }
}
