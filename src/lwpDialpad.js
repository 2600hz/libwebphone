'use strict';

import EventEmitter from 'events';

class lwpDialpad extends EventEmitter {
    constructor(libwebphone, config = {}, i18n = null) {
        // TODO: render a dialpad and produce events
        //  when clicked, trigger playback of DTMF
        //  via lwpMediaDevices, and collect the dialed number
        //  when not in-call
        super();
        this._libwebphone = libwebphone;
        return Promise.resolve();
    }
}

export default lwpDialpad;