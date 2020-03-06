"use strict";

import EventEmitter from "events";
import i18next from "i18next";
import _ from "lodash";
import Mustache from "mustache";
import {eventfordialpadbutton} from "./lwpdtmftonegenerator";


export default class extends EventEmitter {
  constructor(libwebphone, config = {}, i18n = null) {
    super();
    this._libwebphone = libwebphone;
    this._digits = [];
    return this._initInternationalization(config.i18n, i18n)
      .then(() => {
        return this._initProperties(config.dialpad);
      })
      .then(() => {
        return Promise.all(
          this._config.renderTargets.map(renderConfig => {
            return this.render(renderConfig);
          })
        );
      })
      .then(() => {
        return this;
      });
  }

  dial(digit) {
    this._digits.push(digit);
    this.emit("digits", this._digits);
    console.log("Dial pad button pressed: " + digit);
    eventfordialpadbutton(digit);
    console.log("DTMF Tone Played For: " + digit); 
    console.log("Dialed so far: " + this._digits);
  }

  clear() {
    this._digits = [];
  }

  digits() {
    return this._digits;
  }

  render(config = {}) {
    return new Promise(resolve => {
      let template = config.template || this._defaultTemplate();
      let renderConfig = this._renderConfig(config);
      let render = {
        html: Mustache.render(template, renderConfig),
        template: template,
        config: renderConfig
      };
      resolve(render);
    }).then(render => {
      console.log(render);
      let buttons = render.config.buttons;

      if (!render.config.root.element && render.config.root.elementId) {
        render.config.root.element = document.getElementById(
          render.config.root.elementId
        );
      }

      render.config.root.element.innerHTML = render.html;

      Object.keys(buttons).forEach(button => {
        let elementId = buttons[button].elementId;
        let element = document.getElementById(elementId);
        buttons[button].element = element;

        if (element) {
          Object.keys(buttons[button].events || {}).forEach(event => {
            let callback = buttons[button].events[event];
            element[event] = callback;
          });
        }
      });

      this._renders.push(render);
    });
  }

  /** Init functions */

  _initInternationalization(config = { fallbackLng: "en" }, i18n = null) {
    if (i18n) {
      this._translator = i18n;
      return Promise.resolve();
    }

    var i18nPromise = i18next.init(config);
    i18next.addResourceBundle("en", "libwebphone", {
      dialpad: {
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
      }
    });

    return i18nPromise.then(translator => (this._translator = translator));
  }

  _initProperties(config) {
    var defaults = {
      tones: {
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
      }
    };
    this._config = this._merge(defaults, config);

    this._config.renderTargets.forEach((target, index) => {
      if (typeof target == "string") {
        this._config.renderTargets[index] = {
          root: {
            elementId: target,
            element: document.getElementById(target)
          }
        };
      }
    });

    this._renders = [];

    return Promise.resolve();
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

  /** Util Functions */
  _merge(...args) {
    return _.merge(...args);
  }

  _renderConfig(config = {}) {
    let i18n = this._translator;
    var randomElementId = () => {
      return (
        "lwp" +
        Math.random()
          .toString(36)
          .substr(2, 9)
      );
    };
    var defaults = {
      i18n: {
        zero: i18n("libwebphone:dialpad.zero"),
        one: i18n("libwebphone:dialpad.one"),
        two: i18n("libwebphone:dialpad.two"),
        three: i18n("libwebphone:dialpad.three"),
        four: i18n("libwebphone:dialpad.four"),
        five: i18n("libwebphone:dialpad.five"),
        six: i18n("libwebphone:dialpad.six"),
        seven: i18n("libwebphone:dialpad.seven"),
        eight: i18n("libwebphone:dialpad.eight"),
        nine: i18n("libwebphone:dialpad.nine"),
        pound: i18n("libwebphone:dialpad.pound"),
        astrisk: i18n("libwebphone:dialpad.astrisk")
      },
      buttons: {
        zero: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this.dial(digit);
            },
            onmousedown: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this._libwebphone.getMediaDevices().then(mediaDevices => {
                mediaDevices.startPlayTone(this._config.tones[digit]);
              });
            },
            onmouseup: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this._libwebphone.getMediaDevices().then(mediaDevices => {
                mediaDevices.stopPlayTone(this._config.tones[digit]);
              });
            }
          }
        },
        one: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this.dial(digit);
            },
            onmousedown: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this._libwebphone.getMediaDevices().then(mediaDevices => {
                mediaDevices.startPlayTone(this._config.tones[digit]);
              });
            },
            onmouseup: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this._libwebphone.getMediaDevices().then(mediaDevices => {
                mediaDevices.stopPlayTone(this._config.tones[digit]);
              });
            }
          }
        },
        two: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this.dial(digit);
            }
          }
        },
        three: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this.dial(digit);
            }
          }
        },
        four: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this.dial(digit);
            }
          }
        },
        five: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this.dial(digit);
            }
          }
        },
        six: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this.dial(digit);
            }
          }
        },
        seven: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this.dial(digit);
            }
          }
        },
        eight: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this.dial(digit);
            }
          }
        },
        nine: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this.dial(digit);
            }
          }
        },
        pound: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this.dial(digit);
            }
          }
        },
        astrisk: {
          elementId: randomElementId(),
          events: {
            onclick: event => {
              let element = event.srcElement;
              let digit = element.dataset.value;
              this.dial(digit);
            }
          }
        }
      }
    };

    return this._merge(defaults, config);
  }

  _defaultTemplate() {
    return `
    <div>
      <button id="{{buttons.one.elementId}}" data-value="1">{{i18n.one}}</button>
      <button id="{{buttons.two.elementId}}" data-value="2">{{i18n.two}}</button>
      <button id="{{buttons.three.elementId}}" data-value="3">{{i18n.three}}</button>
      <button id="{{buttons.four.elementId}}" data-value="4">{{i18n.four}}</button>
      <button id="{{buttons.five.elementId}}" data-value="5">{{i18n.five}}</button>
      <button id="{{buttons.six.elementId}}" data-value="6">{{i18n.six}}</button>
      <button id="{{buttons.seven.elementId}}" data-value="7">{{i18n.seven}}</button>
      <button id="{{buttons.eight.elementId}}" data-value="8">{{i18n.eight}}</button> 
      <button id="{{buttons.nine.elementId}}" data-value="9">{{i18n.nine}}</button>
      <button id="{{buttons.astrisk.elementId}}" data-value="*">{{i18n.astrisk}}</button>
      <button id="{{buttons.zero.elementId}}" data-value="0">{{i18n.zero}}</button>
      <button id="{{buttons.pound.elementId}}" data-value="#">{{i18n.pound}}</button>
	  </div>
    `;
  }
}
