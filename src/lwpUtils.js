"use strict";

import { assign as _assign, merge as _merge } from "lodash";

export function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function assign(...args) {
  return _assign(...args);
}

export function merge(...args) {
  return _merge(...args);
}

export function randomElementId() {
  return "lwp" + Math.random().toString(36).substr(2, 9);
}

export function mediaElementEvents() {
  return [];
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

export function _trackParameters(mediaStream, track) {
  if (!mediaStream || !track) {
    return;
  }

  if (typeof track.getCapabilities != "function") {
    track.getCapabilities = () => {};
  }

  return {
    trackKind: track.kind,
    selected: track.readyState == "live",
    deviceKind: _trackKindtoDeviceKind(track.kind),
    settings: track.getSettings(),
    constraints: track.getConstraints(),
    capabilities: track.getCapabilities(),
    track: track,
    mediaStream: mediaStream,
  };
}

export function _trackKindtoDeviceKind(trackKind) {
  switch (trackKind) {
    case "audio":
      return "audioinput";
    case "video":
      return "videoinput";
  }
}

export function _trackKinds() {
  return ["audio", "video"];
}
