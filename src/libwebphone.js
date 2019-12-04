'use strict';

import lwpTransport from './lwpTransport';
import lwpMediaDevices from './lwpMediaDevices';
import lwpDialpad from './lwpDialpad';

export default class {
    constructor(config = {}, i18n = null) {
        this._transportPromise = new lwpTransport(this, config, i18n);
        this._mediaDevicesPromise = new lwpMediaDevices(this, config, i18n);
        this._dialpadPromise = new lwpDialpad(this, config, i18n);

        // TODO: manage the registration, re-register when connection is lost
        //  and gained back, handle change creds, accept a lwpKazooDevice object
        //this._registrarPromise = new lwpRegistrar(this, config, i18n);

        // TODO: connect to Kazoo websockets and manage a list of parked calls
        //this._parkedCallsPromise = new lwpParkedCalls(this, config, i18n);

        // TODO: connect to Kazoo API and render a list of the users devices,
        //  when selected update lwpRegistrar to use those creds
        //this._kazooDevicePromise = new lwpKazooDevice(this, config, i18n);
    }

    getTransport() {
        return this._transportPromise;
    }

    getMediaDevices() {
        return this._mediaDevicesPromise;
    }

    getDialpad() {
        return this._dialpadPromise;
    }
}