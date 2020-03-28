"use strict";

import { merge as _merge, cloneDeep as _cloneDeep } from "lodash";

export function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function merge(...args) {
  return _merge(...args);
}

export function cloneDeep(...args) {
  return _cloneDeep(...args);
}

export function randomElementId() {
  return (
    "lwp" +
    Math.random()
      .toString(36)
      .substr(2, 9)
  );
}
