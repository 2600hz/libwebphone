"use strict";

import EventEmitter from "events";
import i18next from "i18next";
import _ from "lodash";

export default class extends EventEmitter {
  constructor(libwebphone, config = {}, i18n = null) {
    super();
    this._libwebphone = libwebphone;
    this._sockets = [];
    return this._initInternationalization(config.i18n, i18n)
      .then(() => {
        return this._initProperties(config.userAgent);
      })
      .then(() => {
        return this;
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
      dialpad: {}
    });

    return i18nPromise.then(translator => (this._translator = translator));
  }

  _initProperties(config) {
    var defaults = {};

    this._config = this._merge(defaults, config);

    

    return Promise.resolve();
  }

  


  /** Util Functions */
  _merge(...args) {
    return _.merge(...args);
  }


  getlwpdtmftonegenerator() {
    return this._lwpdtmftonegeneratorPromise;
  }
} //end class

export function eventfordialpadbutton(val)
{
   console.log('DTMF tone for: ' + val);
    if (window.__pushed__) return
  
    const context = window.__context__ || new AudioContext()
    const sampleRate = 7000
    const buffer = context.createBuffer(2, sampleRate, sampleRate)
    const data = buffer.getChannelData(0)
    const data1 = buffer.getChannelData(1)
    let currentTime = 0
       
    //same frequency for same button
    const keymaps = {
      '1': [1336, 697],
      '2': [1336, 697],
      '3': [1336, 697],
      'A': [1336, 697],
      '4': [1336, 697],
      '5': [1336, 697],
      '6': [1336, 697],
      'B': [1336, 697],
      '7': [1336, 697],
      '8': [1336, 697],
      '9': [1336, 697],
      'C': [1336, 697],
      '*': [1336, 697],
      '0': [1336, 697],
      '#': [1336, 697],
      'D': [1336, 697]
    }
  
    if (!keymaps[val]) return
  
    for (let i = 0; i < 0.5 * sampleRate; i++) {
      data[i] = Math.sin((2 * Math.PI) * keymaps[val][0] * (i / sampleRate))
    }
  
    for (let i = 0; i < 0.5 * sampleRate; i++) {
      data1[i] = Math.sin((2 * Math.PI) * keymaps[val][1] * (i / sampleRate))
    }
  
    const gainNode = context.createGain()
    gainNode.connect(context.destination)
  
    const src = context.createBufferSource()
    src.buffer = buffer
    src.connect(gainNode)
    src.start(currentTime)
  
    window.__pushed__ = true
    setTimeout(() => {
      window.__pushed__ = false
    }, 100)
    if (!window.__context__) window.__context__ = context
  return Promise.resolve();
} //End of eventfordialpadbutton



