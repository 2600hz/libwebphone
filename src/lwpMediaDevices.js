'use strict';

import EventEmitter from 'events';
import _ from 'lodash';
import i18next from 'i18next';
import Mustache from 'mustache';
import Tone from 'tone';
import AudioStreamMeter from 'audio-stream-meter';
import { Mutex } from 'async-mutex';
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
                if (this._config.startPreview) {
                    this.startPreviews();
                } else {
                    this.stopPreviews();
                }

                console.log('media device init complete', this);
                return this;
            });
    }

    startPreviews(show = true) {
        this._previewActive = true;

        if (show) {
            this._renders.forEach(render => {
                Object.keys(render.config.previews).forEach(deviceKind => {
                    let preview = render.config.previews[deviceKind];
                    if (preview.element && (!preview.element.style || preview.element.style.display == 'none')) {
                        preview.element.style.display = preview.displayValue || 'block';
                    }
                });
            });
        }

        // TODO: ensure this._outputStreams is active and 
        //   associated with the selected output

        return this._mediaStreamPromise.then(mediaStream => {
            return this._startInputStreams(mediaStream);
        });
    }

    stopPreviews(hide = true) {
        this._previewActive = false;

        if (hide) {
            this._renders.forEach(render => {
                Object.keys(render.config.previews).forEach(deviceKind => {
                    let preview = render.config.previews[deviceKind];                    
                    if (preview.element && (!preview.element.style || preview.element.style.display != 'none')) {
                        preview.displayValue = preview.element.style.display || 'block';
                        preview.element.style.display = 'none';
                    }
                });
            });
        }

        // TODO: stop all output sounds

        if (!this._inputActive) {
            this._stopAllInputs();
        }
    }

    startStreams() {
        this._inputActive = true;

        // TODO: ensure this._outputStreams is active and 
        //   associated with the selected output

        return this._mediaStreamPromise.then(mediaStream => {
            let startMuted = [];
            Object.keys(this._config).forEach(category => {
                if (this._config[category].startMuted) {
                    startMuted.push(this._deviceKindtoTrackKind(category));
                }
            });
            return this._startInputStreams(mediaStream, null, startMuted);
        });
    }

    stopStreams() {
        this._inputActive = false;

        if (!this._previewActive) {
            this._stopAllInputs();
        }
    }

    startPlayTone() {

    }

    stopPlayTone() {

    }

    startRinging() {

    }

    stopRinging() {

    }

    async changeDevice(deviceKind, deviceId) {
        const release = await this._changeStreamMutex.acquire();
        return new Promise((resolve, reject) => {
            let preferedDevice = this._findAvailableDevice(deviceKind, deviceId);

            if (!preferedDevice) {
                // TODO: create a meaningful return/error
                release();
                reject();
            }

            if (!preferedDevice.connected) {
                // TODO: create a meaningful return/error
                release();
                reject();
            }

            var maxPreference = this._availableDevices[deviceKind].reduce((max, availableDevice) => {
                if ((availableDevice.preference || 0)  > max && availableDevice.id != preferedDevice.id) {
                    return availableDevice.preference;
                }
                return max;
            }, 0);
            preferedDevice.preference = maxPreference + 1;
            this._sortAvailableDevices();

            switch(deviceKind) {
                case 'audiooutput':
                    return this._changeOutputDevice(preferedDevice).then(() => {
                        this._renders.forEach(render => this._renderUpdate(render));
                    }).then(() => {
                        release();
                        resolve();
                    });
                default:
                    return this._changeInputDevice(preferedDevice).then(() => {
                        this._renders.forEach(render => this._renderUpdate(render));
                    }).then(() => {
                        release();
                        resolve();
                    });
            }
        }).catch(error => {
            release();
            throw(error);
        });
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

    async refreshAvailableDevices() {
        const release = await this._changeStreamMutex.acquire();        
        var alteredTrackKinds = [];

        return this._shimEnumerateDevices().then(devices => {
            // NOTE: assume all devices are disconnected then transition
            //  each back to connected if enumerated
            this._forEachAvailableDevice(availableDevice => {
                if (availableDevice.id != 'none') {
                    availableDevice.connected = false;
                }
            });

            this._importInputDevices(devices);

            Object.keys(this._availableDevices).forEach(deviceKind => {
                let activeDevice = this._availableDevices[deviceKind].find(availableDevice =>{
                    return availableDevice.active;
                });
                let preferedDevice = this._availableDevices[deviceKind].find(availableDevice =>{
                    return availableDevice.connected && availableDevice.id != 'none';
                });
                let switchToPrefered = activeDevice && preferedDevice && activeDevice.preference < preferedDevice.preference;
                let activeDeviceDisconnected = activeDevice && !activeDevice.connected;

                if (switchToPrefered || activeDeviceDisconnected) {
                    activeDevice.active = false;
                    alteredTrackKinds.push(activeDevice.trackKind);

                    if (preferedDevice) {
                        preferedDevice.active = true;
                    }
                }
            });

            return this._mediaStreamPromise.then(mediaStream => {
                let startMuted = [];
                let constraints = this._createConstraints();
                let alteredConstraints = {};

                mediaStream.getTracks().forEach(track => {
                    let trackParameters = this._trackParameters(track);
                    let deviceKind = this._trackKindtoDeviceKind(track.kind);
                    let activeDevice = this._availableDevices[deviceKind].find(availableDevice => {
                        return availableDevice.active;
                    });
                    if (!track.enabled) {
                        startMuted.push(track.kind);
                    }

                    if (activeDevice) {
                        let differentId = activeDevice.id != trackParameters.settings.deviceId;
                        let differentLabel = activeDevice.label != track.label;
                        if (differentId || differentLabel) {
                            alteredTrackKinds.push(track.kind);
                            this._removeTrack(mediaStream, track);
                        }
                    } else if (track.readyState != 'live') {
                        alteredTrackKinds.push(track.kind);
                        this._removeTrack(mediaStream, track);
                    }
                });

                alteredTrackKinds.forEach(trackKind => {
                    if (constraints[trackKind]) {
                        alteredConstraints[trackKind] = constraints[trackKind];
                    }
                });

                return this._startInputStreams(mediaStream, alteredConstraints, startMuted);
            });
        }).then(() => {
            return this._sortAvailableDevices();
        }).then(() => {
            this._renders.forEach(render => this._renderUpdate(render));
            release();
        }).catch(error => {
            release();
            throw(error);
        });
    }
    
    render(config = {}) {
        return new Promise(resolve => {
            let template = config.template || this._defaultTemplate();
            let renderConfig = this._renderConfig(config);
            Object.keys(this._availableDevices).forEach(deviceKind => {
                let devices = this._availableDevices[deviceKind].slice(0);
                devices.sort((a, b) => {
                    return a.displayOrder - b.displayOrder;
                });
                renderConfig[deviceKind].devices = devices;
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
            startPreview: true,
            startStreams: false
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

        this._inputActive = false;
        this._previewActive = false;
        this._renders = [];
        this._availableDevices = {
            'audiooutput': [],
            'audioinput': [],
            'videoinput': [this._deviceParameters({deviceId: 'none', label: this._translator('libwebphone:mediaDevices.none'), kind: 'videoinput'})]
        };
        this._changeStreamMutex = new Mutex();

        return Promise.resolve();
    }

    _initInputStreams() {
        let constraints = {audio: this._config['audioinput'].enabled, video: this._config['audioinput'].enabled};

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
            let audioTrack = mediaStream.getTracks().find(track => {
                return track.kind == 'audio' && track.readyState == 'live';
            });

            if (this._previewAudioMeter) {
                this._previewAudioMeter.close();
            }
    
            if (audioTrack) {
                let previewAudioContext = new AudioContext();
                let previewMediaStream = previewAudioContext.createMediaStreamSource(mediaStream);
                this._previewAudioMeter = AudioStreamMeter.audioStreamProcessor(previewAudioContext, () => {
                    this._renders.forEach(render => {
                        if (render.config.previews.audioinput && render.config.previews.audioinput.element) {
                            let element = render.config.previews.audioinput.element.children[0];
                            element.style.width = this._previewAudioMeter.volume * 100 + '%';
                        }
                    });
                });
                previewMediaStream.connect(this._previewAudioMeter);
            }
        });
    }

    _initAvailableDevices() {
        return this._mediaStreamPromise.then(mediaStream => {
            return this._shimEnumerateDevices().then(devices => {
                this._importInputDevices(devices);
                this._sortAvailableDevices();
                return mediaStream;
            }).then(mediaStream => {
                mediaStream.getTracks().forEach(track => {
                    let trackParameters = this._trackParameters(track);
                    let deviceKind = trackParameters.deviceKind;
                    let deviceId = trackParameters.settings.deviceId;
                    let availableDevice = this._findAvailableDevice(deviceKind, deviceId);
                    
                    if (availableDevice) {
                        Object.assign(availableDevice, trackParameters, {active: true});
                    }
    
                    if (!this._config.startPreview && !this._config.startStreams) {
                        track.enabled = false;
                        track.stop();
                        mediaStream.removeTrack(track);
                    }
                });
                Object.keys(this._availableDevices).forEach(deviceKind => {
                    let activeDevice = this._availableDevices[deviceKind].find(availableDevice => {
                        return availableDevice.active;
                    })
                    if (!activeDevice) {
                        let availableDevice = this._availableDevices[deviceKind][0];
                        if (availableDevice) {
                            availableDevice.active = true;
                        }
                    }
                });
            });
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
                    track.enabled = false;
                    track.stop();
                    mediaStream.removeTrack(track);
                }
            });
            return mediaStream;
        });
    }

    _changeInputDevice(preferedDevice) {
        return this._mediaStreamPromise.then(mediaStream => {
            let trackKind = preferedDevice.trackKind;
            let trackConstraints = this._createConstraints(preferedDevice)[trackKind];
            let previousTrack = mediaStream.getTracks().find(track => {
                return track.kind == preferedDevice.trackKind && track.readyState == 'live';
            });

            let mutedInputs = [];

            if (previousTrack) {
                mutedInputs = previousTrack.enabled ? [] : [previousTrack.kind];
                this._removeTrack(mediaStream, previousTrack);
            } else {
                this._availableDevices[preferedDevice.deviceKind].forEach(availableDevice => {
                    if (availableDevice.id == preferedDevice.id) {
                        availableDevice.active = true;
                    } else {
                        availableDevice.active = false;
                    }
                });                
            }

            if (trackConstraints) {
                let constraints = {};
                constraints[trackKind] = trackConstraints;
                return this._startInputStreams(mediaStream, constraints, mutedInputs).then(() => {
                    if (!this._inputActive && !this._previewActive) {
                        this._stopAllInputs();
                    }
                });
            }
        });
    }

    _startInputStreams(mediaStream, constraints = null, mutedInputs = []) {        
        if (!constraints) {
            constraints = this._createConstraints();
        }

        return this._mediaStreamPromise.then(mediaStream => {
            mediaStream.getTracks().forEach(track => {
                if (track.readyState == 'live') {
                    delete constraints[track.kind];
                }
            });

            if (Object.keys(constraints).length == 0) {
                return Promise.resolve();
            } 

            return this._shimGetUserMedia(constraints).then(otherMediaStream => {
                otherMediaStream.getTracks().forEach(track => {
                    let startMuted = mutedInputs.indexOf(track.kind) >= 0;
                    if (!this._inputActive && !this._previewActive) {
                        startMuted = true;
                    }
                    track.enabled = !startMuted;
                    this._addTrack(mediaStream, track);               
                });
            });
        });
    }

    _createConstraints(...preferedDevices) {
        var constraints = {
            audio: this._config.audioinput.constraints || {},
            video: this._config.videoinput.constraints || {}
        };
        var preferedAudioDevice = this._availableDevices['audioinput'].find(availableAudioDevice => {
            return availableAudioDevice.active && availableAudioDevice.connected;
        });
        var preferedVideoDevice = this._availableDevices['videoinput'].find(availableVideoDevice => {
            return availableVideoDevice.active && availableVideoDevice.connected;
        });        

        preferedDevices.forEach(preferedDevice => {
            switch (preferedDevice.deviceKind) {
                case 'audioinput':
                    preferedAudioDevice = preferedDevice;
                    break;
                case 'videoinput':
                    preferedVideoDevice = preferedDevice;
                    break;
            }
        });

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

        if (!this._config.audioinput.enabled || (constraints.audio && constraints.audio.deviceId && constraints.audio.deviceId.exact == 'none')) {
            delete constraints.audio;
        }

        if (!this._config.videoinput.enabled || (constraints.video && constraints.video.deviceId && constraints.video.deviceId.exact == 'none')) {
            delete constraints.video;
        }

        return constraints;
    }

    _merge(...args) {
        return _.merge(...args);
    }

    /** MediaStream Helpers */

    _addTrack(mediaStream, track) {
        var trackParameters = this._trackParameters(track);

        mediaStream.addTrack(track);

        if (track.kind == 'audio') {
            this._initAudioPreviewMeter();
        }

        this._availableDevices[trackParameters.deviceKind].forEach(availableDevice => {
            if (availableDevice.id == trackParameters.settings.deviceId) {
                Object.assign(availableDevice, trackParameters, {active: true});
            } else {
                availableDevice.active = false;
            }
        });

        if (this._inputActive || this._previewActive) {
            this.emit('input.added', this, this._trackParameters(track));
            if (track.enabled) {
                this.emit(track.kind + '.input.unmuted', this, track);
            } else {
                this.emit(track.kind + '.input.muted', this, track);
            }
        }
    }

    _removeTrack(mediaStream, track) {
        var trackParameters = this._trackParameters(track);

        track.enabled = false;
        track.stop();

        mediaStream.removeTrack(track);

        this._availableDevices[trackParameters.deviceKind].forEach(availableDevice => {
            if (availableDevice.id == trackParameters.settings.deviceId) {
                Object.assign(availableDevice, trackParameters, {active: false});
            } else if (availableDevice.id == 'none') {
                availableDevice.active = true;
            } else {
                availableDevice.active = false;
            }
        });

        if (this._inputActive || this._previewActive) {
            this.emit('input.removed', this, this._trackParameters(track));
        }
    }

    _trackParameters(track) {
        if (typeof track.getCapabilities != 'function') {
            track.getCapabilities = () => {};
        }
        return {
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

    _importInputDevices(devices) {
        devices.forEach(device => {
            let enumeratedDevice = this._deviceParameters(device);
            let availableDevice = this._findAvailableDevice(device.kind, device.deviceId);

            if (availableDevice) {
                Object.assign(availableDevice, enumeratedDevice);
            } else {
                if (!this._availableDevices[device.kind]) {
                    this._availableDevices[device.kind] = [];
                }
                enumeratedDevice.displayOrder = this._availableDevices[device.kind].length;
                enumeratedDevice.preference = (this._config[device.kind].preferedDeviceIds || []).indexOf(enumeratedDevice.id) + 1,
                this._availableDevices[device.kind].push(enumeratedDevice);
            }
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
            let devices = this._availableDevices[deviceKind].slice(0);
            devices.sort((a, b) => {
                return a.displayOrder - b.displayOrder;
            });
            renderConfig[deviceKind].devices = devices;
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
                        <div id="{{previews.audioinput.elementId}}" style="width:300px;height:10px;background-color: lightgray;margin: 10px 0px;">
                            <div style="height:10px; background-color: #00aeef;"></div>
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