'use strict';

import EventEmitter from 'events';
import _ from 'lodash';
import i18next from 'i18next';
import Mustache from 'mustache';
import Tone from 'tone';
import AudioStreamMeter from 'audio-stream-meter';
import adapter from 'webrtc-adapter';

class lwpMediaDevices extends EventEmitter {
    constructor(config = {}, i18n = null) {
        super();
        return this._initInternationalization(config.i18n, i18n).then(() => {
                return this._initProperties(config.mediaDevices);
            }).then(() => {
                return this._initInputStreams(); 
            }).then(() => {
                return this._initOutputStreams();
            }).then(() => {
                return this._initAudioPreviewMeter();
            }).then(() => {
                return this._initAvailableDevices();
            }).then(() => {                
                return this._initEventBindings();
            }).then(() => {
                return Promise.all(this._config.renderTargets.map(renderConfig => {
                    return this.render(renderConfig);
                }));
            }).then(() => {
                console.log('media device init complete', this);
                return this;
            });
    }

    startPreviews(hide = true) {
        // TODO: ensure this._inputStreams has active tracks
        //   for the selected inputs
        // TODO: ensure this._outputStreams is active and 
        //   associated with the selected output
        // TODO: conditionally, show all rendered preview elements
    }

    stopPreviews(hide = true) {
        // TODO: conditionally, hide all rendered preview elements
        // TODO: stop all output sounds
        this._stopAllInputs();
    }

    startStreams() {
        // TODO: ensure this._inputStreams has active tracks
        //   for the selected inputs
        // TODO: ensure this._outputStreams is active and 
        //   associated with the selected output
    }

    stopStreams() {
        this._stopAllInputs();
    }

    startPlayTone() {

    }

    stopPlayTone() {

    }

    startRinging() {

    }

    stopRinging() {

    }

    changeDevice(deviceKind, deviceId) {
        return new Promise((resolve, reject) => {
            let availableDevice = this._findAvailableDevice(deviceKind, deviceId);
            if (!availableDevice) {
                // TODO: create a meaningful return/error
                reject();
            }
            switch(deviceKind) {
                case 'audiooutput':
                    return this._changeOutputDevice(availableDevice).then(() => {
                        this._renders.forEach(render => this._renderUpdate(render));
                    }).then((...results) => resolve(...results));
                default:
                    return this._changeInputDevice(availableDevice).then(() => {
                        this._renders.forEach(render => this._renderUpdate(render));
                    }).then((...results) => resolve(...results));
            }
        }).catch(error => console.log(error));
    }

    mute(deviceKind = null) {
        switch(deviceKind) {
            case 'audiooutput':
                return this._muteOutput(deviceKind);
            default: 
                return this._muteInput(deviceKind);
        }
    }

    unmute(deviceKind = null) {
        switch(deviceKind) {
            case 'audiooutput':
                return this._unmuteOutput(deviceKind);
            default: 
                return this._unmuteInput(deviceKind);
        }        
    }

    toggleMute(deviceKind = null) {
        switch(deviceKind) {
            case 'audiooutput':
                return this._toggleUuteOutput(deviceKind);
            default: 
                return this._toggleMuteInput(deviceKind);
        }
    }

    refreshAvailableDevices() {
        return this._shimEnumerateDevices().then(devices => {
            // NOTE: assume all devices are disconnected then transition
            //  each back to connected if enumerated
            this._forEachAvailableDevice(availableDevice => {
                if (availableDevice.id) {
                    availableDevice.connected = false;
                }
            });

            devices.forEach(device => {
                let enumeratedDevice = this._deviceParameters(device);
                let availableDevice = this._findAvailableDevice(device.kind, device.deviceId);

                if (availableDevice) {
                    Object.assign(availableDevice, enumeratedDevice, {connected: true});
                } else {
                    this._availableDevices[device.kind].push(enumeratedDevice);
                }
            });
        }).then(() => {
            return this._sortAvailableDevices();
        }).then(() => {
            return this._mediaStreamPromise.then(mediaStream => {
                mediaStream.getTracks().forEach(track => {
                    let deviceKind = this._trackKindtoDeviceKind(track.kind);
                    let removedDevice = this._availableDevices[deviceKind].find(device =>{
                        return !device.connected && device.active;
                    });
                    let activeDevice = this._availableDevices[deviceKind].find(device => {
                        return device.active;
                    });               
                    let availableDevice = this._availableDevices[deviceKind].find(device => {
                        return device.connected;
                    });
    
                    if (availableDevice && (removedDevice || track.label != activeDevice.label)) {
                        this.changeDevice(availableDevice.deviceKind, availableDevice.id);
                    }
                });
            });
        }).then(() => {
            return this._syncAvailableDevicesWithTracks();
        }).then(() => {
            this._renders.forEach(render => this._renderUpdate(render));
        });
    }
    
    render(config = {}) {
        return new Promise(resolve => {
            let template = config.template || this._defaultTemplate();
            let renderConfig = this._renderConfig(config);
            Object.keys(this._availableDevices).forEach(deviceKind => {
                renderConfig[deviceKind].devices = this._availableDevices[deviceKind];
            });
            let render = {
                html: Mustache.render(template, renderConfig),
                template: template,
                config: renderConfig
            }
            resolve(render);
        }).then(render => {
            let selectors = render.config.selectors;
            let previews = render.config.previews;

            if (!render.config.root.element && render.config.root.elementId) {
                render.config.root.element = document.getElementById(render.config.root.elementId);
            }

            render.config.root.element.innerHTML = render.html;

            Object.keys(selectors).forEach(selector => {
                let elementId = selectors[selector].elementId;
                let element = document.getElementById(elementId);
                selectors[selector].element = element;

                if (element) {
                    Object.keys(selectors[selector].events || {}).forEach(event => {
                        let callback = selectors[selector].events[event];
                        element[event] = callback;
                    });
                }

            });

            Object.keys(previews).forEach(preview => {
                let elementId = previews[preview].elementId;
                let element = document.getElementById(elementId);
                previews[preview].element = element;

                if (element) {
                    Object.keys(previews[preview].events || {}).forEach(event => {
                        let callback = previews[preview].events[event];
                        element[event] = callback;
                    });
                }
            });

            if (previews.videoinput.element) {
                this._mediaStreamPromise.then(mediaStream => {
                    previews.videoinput.element.srcObject = mediaStream;
                });
            }

            this._renders.push(render);
        });
    }

    /** Init functions */

    _initInternationalization(config = {fallbackLng: 'en'}, i18n = null) {
        if (i18n) {
            this._translator = i18n;
            return Promise.resolve();
        }

        var i18nPromise = i18next.init(config);
        i18next.addResourceBundle('en', 'libwebphone', {
            mediaDevices: {
                legend: 'Select your devices',
                none: 'None',
                audiooutput: 'Speaker',
                audioinput: 'Microphone',
                videoinput: 'Camera'
            }
        });

        return i18nPromise.then(translator => this._translator = translator);
    }

    _initProperties(config) {
        var defaults = {
            audiooutput: {
                enabled: ('sinkId' in HTMLMediaElement.prototype),
                startMuted: false,
                preferedDeviceIds: [],
                livePreview: true                
            },
            audioinput: {
                enabled: true,
                startMuted: false,
                constraints: {
                },
                preferedDeviceIds: [],
                livePreview: true                
            },
            videoinput: {
                enabled: true,
                startMuted: true,
                constraints: {
                },
                preferedDeviceIds: [],
                livePreview: true                
            },
            renderTargets: [],
            detectDeviceChanges: true,
            showPreview: true
        };
        this._config = this._merge(defaults, config);
        this._config.renderTargets.forEach((target, index) => {
            if (typeof target == 'string') {     
                this._config.renderTargets[index] = {
                    root: {
                        elementId: target,
                        element: document.getElementById(target)
                    }
                };
            }
        });

        // NOTE: it makes more since if configured with highest priority to
        //   lowest, but we use the index number to represent that so flip it
        this._config.audiooutput.preferedDeviceIds.reverse();
        this._config.audioinput.preferedDeviceIds.reverse();
        this._config.videoinput.preferedDeviceIds.reverse();

        // TODO: support preferedDevices
        // TODO: support startMuted
        // TODO: suport showPreview

        this._renders = [];
        this._availableDevices = {
            'audiooutput': [],
            'audioinput': [],
            'videoinput': [this._deviceParameters({deviceId: 'none', label: this._translator('libwebphone:mediaDevices.none'), kind: 'videoinput'})]
        };

        return Promise.resolve();
    }

    _initInputStreams() {
        var constraints = {audio: this._config.audioinput.enabled, video: this._config.videoinput.enabled};

        this._mediaStreamPromise = this._shimGetUserMedia(constraints);

        return this._mediaStreamPromise;
    }

    _initOutputStreams() {
        // NOTE: work in progress
        return Promise.resolve();
    }    

    _initAudioPreviewMeter() {
        // TODO: there is likely something cleaner we can do with the
        //   Tone library, maybe https://tonejs.github.io/examples/mic.html
        return this._mediaStreamPromise.then(mediaStream => {
            let audioTrack = mediaStream.getTracks().find(track => track.kind == 'audio');

            if (this._previewAudioMeter) {
                this._previewAudioMeter.close();
            }
    
            if (audioTrack) {
                let previewAudioContext = new AudioContext();
                let previewMediaStream = previewAudioContext.createMediaStreamSource(mediaStream);
                this._previewAudioMeter = AudioStreamMeter.audioStreamProcessor(previewAudioContext, () => {
                    this._renders.forEach(render => {
                        if (render.config.previews.audioinput && render.config.previews.audioinput.element) {
                            let element = render.config.previews.audioinput.element;
                            element.style.width = this._previewAudioMeter.volume * 100 + '%';
                        }
                    });
                });
                previewMediaStream.connect(this._previewAudioMeter);
            }
        });
    }

    _initAvailableDevices() {
        return this._shimEnumerateDevices().then(devices => {
            devices.forEach(device => {
                let enumeratedDevice = this._deviceParameters(device);
                this._availableDevices[device.kind].push(enumeratedDevice);
            });
        }).then(() => {
            return this._syncAvailableDevicesWithTracks().then(mediaStream => {
                mediaStream.getTracks().forEach(track => {
                    track.enabled = false;
                    track.stop();
                    mediaStream.removeTrack(track);
                });
            });
        }).then(() => {
            this._sortAvailableDevices();
        });
    }    

    _initEventBindings() {
        return new Promise(resolve => {

            if (this._config.detectDeviceChanges) {
                this._shimOnDeviceChange = event => {
                    this.refreshAvailableDevices();
                };
            }

            resolve();
        });
    }

    /** Util Functions */

    _changeOutputDevice(deviceKind, deviceId) {
        // TODO: clean this up...
        return new Promise(resolve => {
            this._availableDevices['audiooutput'].forEach(device => {
                if (device.id == deviceId) {
                    device.prefered = true;
                } else {
                    device.prefered = false;
                }
            })
            this._previewOutputAudio.setSinkId(deviceId).then(() => {
                this._renders.forEach(render => this._renderUpdate(render));
            });

            resolve();
        });
    }

    _changeInputDevice(availableDevice) {
        return this._mediaStreamPromise.then(mediaStream => {
            let constraints = {};
            let previousTrack = mediaStream.getTracks().find(track => {
                return track.kind == availableDevice.trackKind && track.readyState == 'live';
            });

            switch(availableDevice.deviceKind) {
                case 'audioinput':
                    constraints.audio = this._createConstraints(availableDevice).audio;
                    break;
                case 'videoinput':
                    constraints.video = this._createConstraints(null, availableDevice).video;
                    break;
            }

            if (previousTrack) {
                this._removeTrack(mediaStream, previousTrack);
            }

            return this._shimGetUserMedia(constraints).then(otherMediaStream => {
                otherMediaStream.getTracks().forEach(track => {
                    if (previousTrack) {
                        track.enabled = previousTrack.enabled;
                    }
                    this._addTrack(mediaStream, track);
                    this._syncAvailableDevicesWithTracks([availableDevice.deviceKind]).then(() => {
                        if (!previousTrack) {
                            track.enabled = false;
                            track.stop();
                            mediaStream.removeTrack(track);
                        }
                    });
                });
            });
        });
    }

    _muteInput(deviceKind = null) {
        return this._mediaStreamPromise.then(mediaStream => {
            let trackKind = this._deviceKindtoTrackKind(deviceKind);
            mediaStream.getTracks().forEach(track => {
                if (!trackKind || track.kind == trackKind) {
                    track.enabled = false;
                    this.emit(track.kind + '.input.muted', this, track);
                }
            });
            return mediaStream;
        });
    }

    _unmuteInput(deviceKind = null) {
        return this._mediaStreamPromise.then(mediaStream => {
            let trackKind = this._deviceKindtoTrackKind(deviceKind);
            mediaStream.getTracks().forEach(track => {
                if (!trackKind || track.kind == trackKind) {
                    track.enabled = true;
                    this.emit(track.kind + '.input.unmuted', this, track);
                }
            });
            return mediaStream;
        });
    }

    _toggleMuteInput(deviceKind = null) {
        return this._mediaStreamPromise.then(mediaStream => {
            let trackKind = this._deviceKindtoTrackKind(deviceKind);
            mediaStream.getTracks().forEach(track => {
                if (!trackKind || track.kind == trackKind) {                
                    track.enabled = !track.enabled;
                    if (track.enabled) {
                        this.emit(track.kind + '.input.unmuted', this, track);
                    } else {
                        this.emit(track.kind + '.input.muted', this, track);
                    }
                }
            });
            return mediaStream;
        });
    }

    _stopAllInputs(deviceKind = null) {
        return this._mediaStreamPromise.then(mediaStream => {
            var trackKind = this._deviceKindtoTrackKind(deviceKind);
            mediaStream.getTracks().forEach(track => {
                if (!trackKind || track.kind == trackKind) {
                    this._removeTrack(mediaStream, track);
                }
            });
            return mediaStream;
        });
    }

    _createConstraints(preferedAudioDevice = null, preferedVideoDevice = null) {
        var constraints = {
            audio: this._config.audioinput.constraints || {},
            video: this._config.videoinput.constraints || {}
        };

        if (!preferedAudioDevice) {
            preferedAudioDevice = this._availableDevices['audioinput'].find(availableAudioDevice => {
                return availableAudioDevice.connected && availableAudioDevice.id;
            });
        }

        if (!preferedVideoDevice) {
            preferedVideoDevice = this._availableDevices['videoinput'].find(availableVideoDevice => {
                return availableVideoDevice.connected && availableVideoDevice.id;
            });
        }

        if (preferedAudioDevice) {
            let preferedAudioConstraints = preferedAudioDevice.constraints || {};
            preferedAudioConstraints.deviceId = {};
            preferedAudioConstraints.deviceId.exact = preferedAudioDevice.id;
            constraints.audio = this._merge(constraints.audio, preferedAudioConstraints);
        }

        if (preferedVideoDevice) {
            let preferedVideoConstraints = preferedVideoDevice.constraints || {};
            preferedVideoConstraints.deviceId = {};
            preferedVideoConstraints.deviceId.exact = preferedVideoDevice.id;
            constraints.video = this._merge(constraints.video, preferedVideoConstraints);
        }

        if (!this._config.audioinput.enabled) {
            delete constraints.audio;
        }

        if (!this._config.videoinput.enabled) {
            delete constraints.video;
        }

        return constraints;
    }

    _merge(...args) {
        return _.merge(...args);
    }

    /** MediaStream Helpers */

    _addTrack(mediaStream, track) {
        mediaStream.addTrack(track);

        if (track.kind == 'audio') {
            this._initAudioPreviewMeter();
        }

        this._syncAvailableDevicesWithTracks();
        this.emit('input.added', this, this._trackParameters(track));
    }

    _removeTrack(mediaStream, track) {
        track.enabled = false;
        track.stop();

        mediaStream.removeTrack(track);

        this._syncAvailableDevicesWithTracks();
        this.emit('input.removed', this, this._trackParameters(track));
    }

    _syncAvailableDevicesWithTracks(deviceKinds = null) {
        return this._mediaStreamPromise.then(mediaStream => {
            let activeTracks = {audioinput: [], videoinput: []};

            mediaStream.getTracks().forEach(track => {
                let trackParameters = this._trackParameters(track);

                if (trackParameters.active) {
                    let deviceKind = trackParameters.deviceKind;                 
                    activeTracks[deviceKind].push(trackParameters);
                }
            });

            if (!deviceKinds) {
                deviceKinds = Object.keys(activeTracks);
            }

            deviceKinds.forEach(deviceKind => {
                let inputTracks = activeTracks[deviceKind];
                let isInputActive = inputTracks.length > 0;
    
                this._availableDevices[deviceKind].forEach(availableDevice => {
                    let trackParameters = inputTracks.find(parameters => {
                        return availableDevice.id == parameters.settings.deviceId;
                    });
    
                    if (trackParameters) {
                        availableDevice = this._merge(availableDevice, trackParameters, {active: true});
                    } else if (availableDevice.active) {
                        // NOTE: ensure no available device is left with a stale
                        //   active flag
                        availableDevice.active = false;
                        delete availableDevice.trackId;
                    }
                });
            });

            return mediaStream;
        });
    }

    _trackParameters(track) {
        if (typeof track.getCapabilities != 'function') {
            track.getCapabilities = () => {};
        }
        return {
            trackId: track.id,
            trackKind: track.kind,
            active: track.readyState == 'live',
            deviceKind: this._trackKindtoDeviceKind(track.kind),
            settings: track.getSettings(),
            constraints: track.getConstraints(),
            capabilities: track.getCapabilities()
        };
    }

    _trackKindtoDeviceKind(trackKind) {
        switch(trackKind) {
            case 'audio':
                return 'audioinput';
            case 'video':
                return 'videoinput';
        }
    }

    /** Device Helpers */

    _findAvailableDevice(deviceKind, deviceId) {
        return this._availableDevices[deviceKind].find(availableDevice => {
            return availableDevice.id == deviceId;
        });
    }

    _forEachAvailableDevice(callbackfn) {
        Object.keys(this._availableDevices).forEach(deviceKind => {
            this._availableDevices[deviceKind].forEach(callbackfn);
        });
    }

    _sortAvailableDevices() {
        Object.keys(this._availableDevices).forEach(deviceKind => {
            this._availableDevices[deviceKind].sort((a, b) => {
                return b.preference - a.preference;
            });
        });
    }

    _deviceParameters(device) {
        var deviceId = device.deviceId;
        var deviceKind = device.kind;
        return {
            id: deviceId,
            label: device.label,
            deviceKind: device.kind,
            name: this._getDeviceName(device),            
            trackKind: this._deviceKindtoTrackKind(device.kind),
            preference: (this._config[deviceKind].preferedDeviceIds || []).indexOf(deviceId) + 1,
            connected: true
        };
    }

    _getDeviceName(device) {
        var i18n = this._translator;
        var deviceKind = device.kind;
        var i18nKey = 'libwebphone:mediaDevices.' + deviceKind;
        return device.label || i18n(i18nKey) + ' ' + (this._availableDevices[deviceKind].length + 1);
    }

    _deviceKindtoTrackKind(deviceKind) {
        switch (deviceKind) {
            case 'audiooutput':
                return 'audio';
            case 'audioinput':
                return 'audio';
            case 'videoinput':
                return 'video';
        }
    }

    /** Render Helpers */

    _renderUpdate(render) {
        var renderConfig = render.config;
        var selectors = render.config.selectors;

        Object.keys(this._availableDevices).forEach(deviceKind => {
            renderConfig[deviceKind].devices = this._availableDevices[deviceKind];
        });

        render.html = Mustache.render(render.template, renderConfig),

        // NOTE: copy the html fragements into each selector
        //   so that we don't loose the even callbacks
        Object.keys(selectors).forEach(selector => {
            let elementId = selectors[selector].elementId;
            let element = selectors[selector].element;
            let renderedElements = document.createElement('div');
            let fragment = document.createDocumentFragment();
            renderedElements.innerHTML = render.html;
            fragment.appendChild(renderedElements);

            if (element) {
                element.innerHTML = fragment.getElementById(elementId).innerHTML;
            }
        });
    }

    _renderConfig(config = {}) {
        let i18n = this._translator;
        var randomElementId = () => {
            return 'lwp' + Math.random().toString(36).substr(2, 9);    
        };
        var defaults = {
            i18n: {
                legend: i18n('libwebphone:mediaDevices.legend'),
                none: i18n('libwebphone:mediaDevices.none'),
                audiooutput: i18n('libwebphone:mediaDevices.audiooutput'),
                audioinput: i18n('libwebphone:mediaDevices.audioinput'),
                videoinput: i18n('libwebphone:mediaDevices.videoinput')
            },
            selectors: {
                audiooutput: {
                    elementId: randomElementId(),
                    events: {
                        onchange: event => {
                            let element = event.srcElement;
                            if (element.options) {
                                let deviceId = element.options[element.selectedIndex].value;
                                this.changeDevice('audiooutput', deviceId);
                            }
                        }
                    }
                },               
                audioinput: {
                    elementId: randomElementId(),
                    events: {
                        onchange: event => {
                            let element = event.srcElement;
                            if (element.options) {
                                let deviceId = element.options[element.selectedIndex].value;
                                this.changeDevice('audioinput', deviceId);
                            }
                        }
                    }                    
                },
                videoinput: {
                    elementId: randomElementId(),
                    events: {
                        onchange: event => {
                            let element = event.srcElement;
                            if (element.options) {
                                let deviceId = element.options[element.selectedIndex].value;
                                this.changeDevice('videoinput', deviceId);
                            }
                        }
                    }                    
                }
            },
            previews: {
                audiooutput: {
                    elementId: randomElementId(),
                    events: {
                        onclick: event => {
                            let synth = new Tone.Synth().toMaster();
                            synth.triggerAttackRelease("C4", "8n");
                        }
                    }
                },
                audioinput: {
                    elementId: randomElementId()
                },
                videoinput: {
                    elementId: randomElementId()
                }
            },
            audiooutput: this._config.audiooutput,
            audioinput: this._config.audioinput,
            videoinput: this._config.videoinput
        };

        return this._merge(defaults, config);
    }

    _defaultTemplate() {
        // TODO: render advanced settings from capabilities
        return `
        <div>
            <legend>{{i18n.legend}}</legend>

            {{#audiooutput.enabled}}
                <div>
                    <label for="{{selectors.audiooutput.elementId}}">
                        {{i18n.audiooutput}}
                    </label>
                    <select id="{{selectors.audiooutput.elementId}}">
                        {{#audiooutput.devices}}
                            {{#connected}}
                                <option value="{{id}}" {{#active}}selected{{/active}}>{{name}}</option>
                            {{/connected}}
                        {{/audiooutput.devices}}
                    </select>
                    {{#audiooutput.livePreview}}
                        <a id="{{previews.audiooutput.elementId}}" href="#">Test</a>
                    {{/audiooutput.livePreview}}
                </div>
            {{/audiooutput.enabled}}

            {{#audioinput.enabled}}
                <div>
                    <label for="{{selectors.audioinput.elementId}}">
                        {{i18n.audioinput}}
                    </label>
                    <select id="{{selectors.audioinput.elementId}}">
                        {{#audioinput.devices}}
                            {{#connected}}
                                <option value="{{id}}" {{#active}}selected{{/active}}>{{name}}</option>
                            {{/connected}}    
                        {{/audioinput.devices}}
                    </select>
                    {{#audioinput.livePreview}}

                        <tone-oscilloscope></tone-oscilloscope>

                        <div style="width:300px;height:10px;background-color: lightgray;margin: 10px 0px;">
                            <div id="{{previews.audioinput.elementId}}" style="height:10px; background-color: #00aeef;"></div>
                        </div>
                    {{/audioinput.livePreview}}                    
                </div>
            {{/audioinput.enabled}}

            {{#videoinput.enabled}}
                {{#videoinput.livePreview}}
                    <div>
                        <video id="{{previews.videoinput.elementId}}" width="{{videoinput.preference.settings.width}}" height="{{videoinput.preference.settings.height}}" autoplay></video>
                    </div>
                {{/videoinput.livePreview}}               
                <div>
                    <label for="{{selectors.videoinput.elementId}}">
                        {{i18n.videoinput}}
                    </label>                
                    <select id="{{selectors.videoinput.elementId}}">
                        {{#videoinput.devices}}
                            {{#connected}}
                                <option value="{{id}}" {{#active}}selected{{/active}}>{{name}}</option>
                            {{/connected}}
                        {{/videoinput.devices}}
                    </select>
                </div>
            {{/videoinput.enabled}}
        </div>
        `;
    }

    /** Shims */

    _shimEnumerateDevices() {
        return navigator.mediaDevices.enumerateDevices();
    }

    _shimGetUserMedia(constraints) {
        return navigator.mediaDevices.getUserMedia(constraints);    
    }

    set _shimOnDeviceChange(value) {
        return navigator.mediaDevices.ondevicechange = value;
    }
}

export default lwpMediaDevices;