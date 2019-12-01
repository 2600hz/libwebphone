'use strict';

import _ from 'lodash';
import i18next from 'i18next';
import Mustache from 'mustache';
import AudioStreamMeter from 'audio-stream-meter';
import Tone from 'tone';
import adapter from 'webrtc-adapter';

class lwpMediaDevices {
    constructor(config = {}, i18n = null) {
        return this._initInternationalization(config.i18n, i18n).then(() => {
                return this._initProperties(config.mediaDevices);
            }). then(() => {
                return this._initMediaStream();
            }).then(initMediaTracks => {
                return this._initMediaDevices(initMediaTracks); 
            }).then(() => {
                return this._initAudioContext();
            }).then(() => {
                return this._initEventBindings();
            }).then(() => {
                return this.render({root: this._config.root});
            }).then(() => {
                console.log('media device init complete', this);
                return this;
            }).catch(error => console.log(error));
    }

    changeOutputDevice(deviceKind, deviceId) {
        // TODO: clean this up...
        this._availabelDevices['audiooutput'].forEach(device => {
            if (device.id == deviceId) {
                device.active = true;
            } else {
                device.active = false;
            }
        })
        this._previewOutputAudio.setSinkId(deviceId).then(() => {
            this._renders.forEach(render => this._renderUpdate(render));
        });
    }

    changeInputDevice(deviceKind, deviceId = null) {
        var constraints = {};

        if (!deviceId) {
            this.stopAllInputs(deviceKind);
            return Promise.resolve();
        } else {
            var typeConstraints = {};
            typeConstraints.deviceId = {};
            typeConstraints.deviceId.exact = deviceId;
        }

        switch (deviceKind) {
            case 'audioinput':
                constraints = this._createConstraints(typeConstraints, false);
                break;
            case 'videoinput':
                constraints = this._createConstraints(false, typeConstraints);
                break;
        }

        return new Promise((resolve, reject) => {
            let currentTrack  = this._getTrackByKind(deviceKind);
            if (currentTrack) {
                this._removeTrack(currentTrack);
            }

            this._shimGetUserMedia(constraints).then(stream => {
                this._getTracks(stream).forEach(track => {
                    let settings = track.getSettings();
                    if (settings.deviceId == deviceId) {
                        resolve(track);
                    }
                });
            });
            //reject();
        }).then(track => {
            this._addTrack(track);
        }).then(() => {
            this._renders.forEach(render => this._renderUpdate(render));
        });        
    }

    mute(deviceKind = null) {
        return new Promise(resolve => {
            let trackKind = this._deviceKindtoTrackKind(deviceKind);

            this._getTracks().forEach(track => {
                if (!trackKind || track.kind == trackKind) {
                    // TODO: emit mute event
                    track.enabled = false;
                }
            });

            resolve();
        });
    }

    unmute(deviceKind = null) {
        return new Promise(resolve => {
            let trackKind = this._deviceKindtoTrackKind(deviceKind);

            this._getTracks().forEach(track => {
                if (!trackKind || track.kind == trackKind) {
                    // TODO: emit mute event
                    track.enabled = true;
                }
            });

            resolve();
        });
    }

    toggleMute(deviceKind = null) {
        return new Promise(resolve => {
            let trackKind = this._deviceKindtoTrackKind(deviceKind);

            this._getTracks().forEach(track => {
                if (!trackKind || track.kind == trackKind) {
                    // TODO: emit mute event
                    track.enabled = !track.enabled;
                }
            });
        
            resolve();
        });
    }

    stopAllInputs(deviceKind = null) {
        return new Promise(resolve => {
            var trackKind = this._deviceKindtoTrackKind(deviceKind);

            this._getTracks().forEach(track => {
                if (!trackKind || track.kind == trackKind) {
                    this._removeTrack(track);
                }
            });

            resolve();
        });
    }

    refreshAvailabelDevices() {
        this._forEachAvailabelDevice(availabelDevice => {
            if (availabelDevice.id) {
                availabelDevice.connected = false;
            }
        });

        return this._shimEnumerateDevices().then(devices => {
            devices.forEach(device => {
                let enumeratedDevice = this._createAvailabelDevice(device);
                let availabelDevice = this._findAvailabelDevice(device.kind, device.deviceId);

                if (availabelDevice) {
                    delete enumeratedDevice.active;
                    Object.assign(availabelDevice, enumeratedDevice, {connected: true});
                } else {
                    this._availabelDevices[device.kind].push(enumeratedDevice);
                }
            });
        }).then(() => {
            this._getTracks().forEach(track => {
                let deviceKind = this._trackKindtoDeviceKind(track.kind);
                let removedDevice = this._availabelDevices[deviceKind].find(device =>{
                    return !device.connected && device.active;
                });
                let activeDevice = this._availabelDevices[deviceKind].find(device => {
                    return device.active;
                });                
                let availabelDevice = this._availabelDevices[deviceKind].find(device => {
                    // TODO: this should honor some kind of user previous selection preference
                    //   so that we switch back to a prefered removed device when re-added
                    return device.connected;
                });

                if (availabelDevice && (removedDevice || track.label != activeDevice.label)) {
                    this.changeInputDevice(availabelDevice.deviceKind, availabelDevice.id);
                }
            });

            /*
            let outputDevice = this._availabelDevices['audiooutput'].find(device => {
                return device.active;
            });

            if (outputDevice) {
                this._previewOutputAudio.setSinkId(outputDevice.id);
            }
            */

            this._renders.forEach(render => this._renderUpdate(render));
        });
    }

    /** Presentation */
    
    render(config = {}) {
        return new Promise(resolve => {
            let template = config.template || this._defaultTemplate();
            let renderConfig = this._renderConfig(config);
            Object.keys(this._availabelDevices).forEach(deviceKind => {
                renderConfig[deviceKind].devices = this._availabelDevices[deviceKind];
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

            if (!render.config.root.element && render.config.root.element_id) {
                render.config.root.element = document.getElementById(render.config.root.element_id);
            }

            render.config.root.element.innerHTML = render.html;

            Object.keys(selectors).forEach(selector => {
                let element_id = selectors[selector].element_id;
                let element = document.getElementById(element_id);
                selectors[selector].element = element;

                if (element) {
                    Object.keys(selectors[selector].events || {}).forEach(event => {
                        let callback = selectors[selector].events[event];
                        element[event] = callback;
                    });
                }

            });

            Object.keys(previews).forEach(preview => {
                let element_id = previews[preview].element_id;
                let element = document.getElementById(element_id);
                previews[preview].element = element;

                if (element) {
                    Object.keys(previews[preview].events || {}).forEach(event => {
                        let callback = previews[preview].events[event];
                        element[event] = callback;
                    });
                }
            });            

            if (this._mediaStream && previews.videoinput.element) {
                previews.videoinput.element.srcObject = this._mediaStream;
            }            

            //new Audio().srcObject = mediaStream;

            this._renders.push(render);
        });
    }

    _renderUpdate(render) {
        var renderConfig = render.config;
        var selectors = render.config.selectors;

        Object.keys(this._availabelDevices).forEach(deviceKind => {
            renderConfig[deviceKind].devices = this._availabelDevices[deviceKind];
        });

        render.html = Mustache.render(render.template, renderConfig),

        Object.keys(selectors).forEach(selector => {
            let element_id = selectors[selector].element_id;
            let element = selectors[selector].element;
            let renderedElements = document.createElement('div');
            let fragment = document.createDocumentFragment();
            renderedElements.innerHTML = render.html;
            fragment.appendChild(renderedElements);

            if (element) {
                element.innerHTML = fragment.getElementById(element_id).innerHTML;
            }
        });
    }

    _renderConfig(config = {}) {
        let i18n = this._translator;
        var randomElementId = () => {
            return 'lwp_' + Math.random().toString(36).substr(2, 9);    
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
                    element_id: randomElementId(),
                    events: {
                        onchange: event => {
                            let element = event.srcElement;
                            if (element.options) {
                                let device_id = element.options[element.selectedIndex].value;
                                this.changeOutputDevice('audiooutput', device_id);
                            }
                        }
                    }
                },               
                audioinput: {
                    element_id: randomElementId(),
                    events: {
                        onchange: event => {
                            let element = event.srcElement;
                            if (element.options) {
                                let device_id = element.options[element.selectedIndex].value;
                                this.changeInputDevice('audioinput', device_id);
                            }
                        }
                    }                    
                },
                videoinput: {
                    element_id: randomElementId(),
                    events: {
                        onchange: event => {
                            let element = event.srcElement;
                            if (element.options) {
                                let device_id = element.options[element.selectedIndex].value;
                                this.changeInputDevice('videoinput', device_id);
                            }
                        }
                    }                    
                }
            },
            previews: {
                audiooutput: {
                    element_id: randomElementId(),
                    events: {
                        onclick: event => {
                            let synth = new Tone.Synth().toMaster();
                            synth.triggerAttackRelease("C4", "8n");
                        }
                    }
                },
                audioinput: {
                    element_id: randomElementId()
                },
                videoinput: {
                    element_id: randomElementId()
                }
            },
            audiooutput: this._config.audiooutput,
            audioinput: this._config.audioinput,
            videoinput: this._config.videoinput
        };

        return this._merge(defaults, config);
    }

    _defaultTemplate() {
        // TODO: render avanced settings from capabilities
        return `
        <div>
            <legend>{{i18n.legend}}</legend>

            {{#audiooutput.enabled}}
                <div>
                    <label for="{{selectors.audiooutput.element_id}}">
                        {{i18n.audiooutput}}
                    </label>
                    <select id="{{selectors.audiooutput.element_id}}">
                        {{#audiooutput.devices}}
                            {{#connected}}
                                <option value="{{id}}" {{#active}}selected{{/active}}>{{name}}</option>
                            {{/connected}}
                        {{/audiooutput.devices}}
                    </select>
                    {{#audiooutput.live_preview}}
                        <a id="{{previews.audiooutput.element_id}}" href="#">Test</a>
                    {{/audiooutput.live_preview}}
                </div>
            {{/audiooutput.enabled}}

            {{#audioinput.enabled}}
                <div>
                    <label for="{{selectors.audioinput.element_id}}">
                        {{i18n.audioinput}}
                    </label>
                    <select id="{{selectors.audioinput.element_id}}">
                        {{#audioinput.devices}}
                            {{#connected}}
                                <option value="{{id}}" {{#active}}selected{{/active}}>{{name}}</option>
                            {{/connected}}    
                        {{/audioinput.devices}}
                    </select>
                    {{#audioinput.live_preview}}

                        <tone-oscilloscope></tone-oscilloscope>

                        <div style="width:300px;height:10px;background-color: lightgray;margin: 10px 0px;">
                            <div id="{{previews.audioinput.element_id}}" style="height:10px; background-color: #00aeef;"></div>
                        </div>
                    {{/audioinput.live_preview}}                    
                </div>
            {{/audioinput.enabled}}

            {{#videoinput.enabled}}
                {{#videoinput.live_preview}}
                    <div>
                        <video id="{{previews.videoinput.element_id}}" width="{{videoinput.preference.settings.width}}" height="{{videoinput.preference.settings.height}}" autoplay muted></video>
                    </div>
                {{/videoinput.live_preview}}               
                <div>
                    <label for="{{selectors.videoinput.element_id}}">
                        {{i18n.videoinput}}
                    </label>                
                    <select id="{{selectors.videoinput.element_id}}">
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
                live_preview: true                
            },
            audioinput: {
                enabled: true,
                constraints: {
                },
                live_preview: true                
            },
            videoinput: {
                enabled: true,
                constraints: {
                },
                live_preview: true                
            },
            root: {
                element_id: null
            },
            detect_device_change: true
        };
        
        this._renders = [];
        this._availabelDevices = {
            'audiooutput': [],
            'audioinput': [],
            'videoinput': [this._createAvailabelDevice({label: this._translator('libwebphone:mediaDevices.none'), deviceKind: 'video'})]
        };
        this._config = this._merge(defaults, config);

        return Promise.resolve();
    }

    _initMediaStream() {
        var constraints = this._createConstraints();

        return this._shimGetUserMedia(constraints).then(stream => {
            let initMediaTracks = {};

            this._getTracks(stream).forEach(track => {
                let trackParameters = this._trackParameters(track);
                let deviceKind = trackParameters.deviceKind;

                if (!this._config[deviceKind].live_preview) {
                    this._removeTrack(track);
                    trackParameters.active = false;
                }

                if (!initMediaTracks[track.kind]) {
                    initMediaTracks[track.kind] = [];
                }

                initMediaTracks[track.kind].push(trackParameters);
            });

            this._mediaStream = stream;

            return initMediaTracks;
        });
    }

    _initMediaDevices(initMediaTracks) {
        return this._shimEnumerateDevices().then(devices => {
            devices.forEach(device => {
                let availabelDevice = this._createAvailabelDevice(device);
                this._availabelDevices[device.kind].push(availabelDevice);
            });

            Object.keys(initMediaTracks).forEach(trackKind => {
                (initMediaTracks[trackKind] || []).forEach(initMediaTrack => {
                    let deviceKind = initMediaTrack.deviceKind;
                    let deviceId = initMediaTrack.settings.deviceId;
                    let availabelDevice = this._findAvailabelDevice(deviceKind, deviceId);

                    if (availabelDevice) {                        
                        Object.assign(availabelDevice, initMediaTrack, {active: true});
                    }
                });
            });

            // TODO: just for demo purposes until the audiooutput (AudioContext) helpers are coded
            if (this._availabelDevices['audiooutput'].length > 0) {
                this._availabelDevices['audiooutput'][0].active = true;
            }
        });
    }

    _initAudioContext() {
        return new Promise(resolve => {
            this._startAudioPreviewMeter();

            this._previewOutputAudio = new Audio();
            this._previewOutputAudio.srcObject = this._mediaStream;

            let outputDevice = this._availabelDevices['audiooutput'].find(device => {
                return device.active;
            });

            if (outputDevice) {
                this._previewOutputAudio.setSinkId(outputDevice.id);
            }

            // TODO: toggle on and off with preview...
            //this._previewOutputAudio.play();
            
            resolve();
        });
    }

    _initEventBindings() {
        return new Promise(resolve => {

            if (this._config.detect_device_change) {
                this._shimOnDeviceChange = event => {
                    this.refreshAvailabelDevices();
                };
            }

            //TODO: figure out why these don't work then expose away to bind to them
            //   from this class
            this._mediaStream.onaddtrack = event => {
                console.log('track added: ', event);
            };

            this._mediaStream.onaddtrack = event => {
                console.log('track added: ', event);
            };

            this._mediaStream.addEventListener('addtrack', (event) => {
                console.log(`New ${event.track.kind} track added`);
              });

            this._mediaStream.onremovetrack = event => {
                console.log('track removed: ', event);
            };

            this._mediaStream.addEventListener('removetrack', (event) => {
                console.log(`${event.track.kind} track removed`);
              });

            resolve();
        });
    }

    /** Util Functions */

    _startAudioPreviewMeter() {
        // TODO: there is likely something cleaner we can do with the
        //   Tone library, maybe https://tonejs.github.io/examples/mic.html
        var audioTrack = this._getTracks().find(track => track.kind == 'audio');

        if (this._previewAudioMeter) {
            this._previewAudioMeter.close();
        }

        if (audioTrack) {
            this._previewAudioContext = new AudioContext();
            this._previewMediaStream = this._previewAudioContext.createMediaStreamSource(this._mediaStream);
            this._previewAudioMeter = AudioStreamMeter.audioStreamProcessor(this._previewAudioContext, () => {
                this._renders.forEach(render => {
                    if (render.config.previews.audioinput && render.config.previews.audioinput.element) {
                        let element = render.config.previews.audioinput.element;
                        element.style.width = this._previewAudioMeter.volume * 100 + '%';
                    }
                });
            });
            this._previewMediaStream.connect(this._previewAudioMeter);
        }
    }

    _createConstraints(audioConstraints = {}, videoConstraints = {}, includeConfig = true) {
        var constraints = {
            audio: this._config.audioinput.constraints || {},
            video: this._config.videoinput.constraints || {}
        };

        if (includeConfig) {
            constraints.audio = this._merge(constraints.audio, audioConstraints);
            constraints.video = this._merge(constraints.video, videoConstraints);
        } else  {
            constraints.audio = audioConstraints;
            constraints.video = videoConstraints;
        }

        if (!this._config.audioinput.enabled || audioConstraints === false) {
            delete constraints.audio;
        }

        if (!this._config.videoinput.enabled || videoConstraints === false) {
            delete constraints.video;
        }
        
        return constraints;
    }

    _getTracks(mediaStream = null) {
        if (!mediaStream) {
            mediaStream = this._mediaStream;
        }

        return mediaStream.getTracks();
    }

    _getTrackByKind(deviceKind, mediaStream = null) {      
        var trackKind = this._deviceKindtoTrackKind(deviceKind);
        return this._getTracks(mediaStream).find(track => {
            return track.kind == trackKind;
        });
    }

    _addTrack(track, mediaStream = null) {
        if (!mediaStream) {
            let trackParameters = this._trackParameters(track);
            let deviceKind = trackParameters.deviceKind;

            this._availabelDevices[deviceKind].forEach(availabelDevice => {
                if (availabelDevice.id == trackParameters.settings.deviceId) {
                    Object.assign(availabelDevice, trackParameters);
                    availabelDevice.active = true;
                } else if (!availabelDevice.id) {
                    availabelDevice.active = false;
                }
            });

            mediaStream = this._mediaStream;
        }

        mediaStream.addTrack(track);

        if (track.kind == 'audio') {
            this._startAudioPreviewMeter();
        } 
    }

    _removeTrack(track, mediaStream = null) {
        if (!mediaStream) {
            let trackParameters = this._trackParameters(track);
            let deviceKind = trackParameters.deviceKind;
            
            this._availabelDevices[deviceKind].forEach(availabelDevice => {
                if (availabelDevice.id == trackParameters.settings.deviceId) {
                    availabelDevice.active = false;
                } else if (!availabelDevice.id) {
                    availabelDevice.active = true;
                }
            });

            mediaStream = this._mediaStream;
        }

        track.enabled = false;
        track.stop();
        mediaStream.removeTrack(track);
    }

    _trackParameters(track) {
        if (typeof track.getCapabilities != 'function') {
            track.getCapabilities = () => {};
        }
        return {
            trackId: track.id,
            trackKind: track.kind,
            deviceKind: track.kind + 'input',
            active: track.readyState == 'live',
            settings: track.getSettings(),
            constraints: track.getConstraints(),
            capabilities: track.getCapabilities()
        };
    }

    _findAvailabelDevice(deviceKind, deviceId) {
        return this._availabelDevices[deviceKind].find(availabelDevice => {
            return availabelDevice.id == deviceId;
        });
    }

    _forEachAvailabelDevice(callbackfn) {
        Object.keys(this._availabelDevices).forEach(deviceKind => {
            this._availabelDevices[deviceKind].forEach(callbackfn);
        });
    }

    _addAvailabelDevice(device) {
        var availabelDevice = this._createAvailabelDevice(device);
        this._availabelDevices[device.kind].push(availabelDevice);
    }

    _createAvailabelDevice(device) {
        var availabelDevice = {id: device.deviceId, label: device.label, deviceKind: device.kind};
        availabelDevice.name = this._getDeviceName(device);
        availabelDevice.trackKind = this._deviceKindtoTrackKind(device.kind);
        availabelDevice.connected = true;
        availabelDevice.active = false;
        return availabelDevice;
    }

    _getDeviceName(device) {
        var i18n = this._translator;
        var deviceKind = device.kind;
        var i18nKey = 'libwebphone:mediaDevices.' + deviceKind;
        // TODO: the count could lead to duplicates during refresh (IE: two "Camera 1" devices if removing and adding USB devices)
        return device.label || i18n(i18nKey) + ' ' + (this._availabelDevices[deviceKind].length + 1);
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

    _trackKindtoDeviceKind(trackKind) {
        switch(trackKind) {
            case 'audio':
                return 'audioinput';
            case 'video':
                return 'videoinput';
        }
    }

    _merge(...args) {
        return _.merge(...args);
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