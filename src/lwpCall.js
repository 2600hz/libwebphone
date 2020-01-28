"use strict";

import EventEmitter from "events";
import i18next from "i18next";
import _ from "lodash";

export default class extends EventEmitter {
  constructor(libwebphone, target, options = {}) {
    super();
    this._libwebphone = libwebphone;
    this._target = target;

    /** 
    await mediaDevices = this._libwebphone.getMediaDevices();
    await mediaStream = mediaDevices.startStreams();

    if (!options.mediaConstraints && !options.mediaStream) {
          options.mediaStream = mediaStream;                
    }
    */

    this._options = options;

    /** TODO */
    return Promise.resolve();
  }

  /** Init functions */

  /** Util Functions */

  _merge(...args) {
    return _.merge(...args);
  }
}
