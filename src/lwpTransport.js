'use strict';

import EventEmitter from 'events';

class lwpTransport extends EventEmitter {
    constructor(libwebphone, config = {}, i18n = null) {
        // TODO: manage the websocket connection
        //   and render status elements
        super();
        this._libwebphone = libwebphone;
        return Promise.resolve();
    }
}

export default lwpTransport;