'use strict';

import lwpMediaDevices from './lwpMediaDevices';

export default class {
    constructor(config = {}) {
        this._mediaDevicesPromise = new lwpMediaDevices(config);
    }

    getMediaDevices() {
        return this._mediaDevicesPromise;
    }
}