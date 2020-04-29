"use strict";

import { assign as _assign, merge as _merge } from "lodash";

export default class {
  static uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (
      c
    ) {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  static assign(...args) {
    return _assign(...args);
  }

  static merge(...args) {
    return _merge(...args);
  }

  static randomElementId() {
    return "lwp" + Math.random().toString(36).substr(2, 9);
  }

  static mediaElementEvents() {
    return [
      "abort",
      "canplay",
      "canplaythrough",
      "durationchange",
      "emptied",
      "ended",
      "error",
      "loadeddata",
      "loadedmetadata",
      "loadstart",
      "pause",
      "play",
      "playing",
      //"progress",
      "ratechange",
      "seeked",
      "seeking",
      "stalled",
      "suspend",
      //"timeupdate",
      "volumechange",
      "waiting",
    ];
  }

  static trackParameters(mediaStream, track) {
    if (!mediaStream || !track) {
      return;
    }

    if (typeof track.getCapabilities != "function") {
      track.getCapabilities = () => {};
    }

    return {
      trackKind: track.kind,
      selected: track.readyState == "live",
      deviceKind: this.trackKindtoDeviceKind(track.kind),
      settings: track.getSettings(),
      constraints: track.getConstraints(),
      capabilities: track.getCapabilities(),
      track: track,
      mediaStream: mediaStream,
    };
  }

  static trackKindtoDeviceKind(trackKind) {
    switch (trackKind) {
      case "audio":
        return "audioinput";
      case "video":
        return "videoinput";
    }
  }

  static trackKinds() {
    return ["audio", "video"];
  }
}
