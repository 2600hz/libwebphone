# lwpMediaDevices

> NOTE! It is not expected that an instance of this class be created outside of the libwebphone interals. To access this instance use the libwebphone instance method `getCallList()`. If you are unfamiliar with the structure of libwebphone its highly recommended you [start here](/README.md).

The libwebphone media devices class contains all the functionality releated to selecting media devices (audio input, video input and audio output) as well as access to any required [MediaStreamTrack](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack). It does this by keeping a master [MediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream) instance with tracks that correspond to the device selections. When entities need access to the media devices if the master MediaStream currently does not have the required MediaStreamTrack(s) then they will be created on the master MediaStream. To fill requests to start streams all tracks in the master MediaStream are then cloned to a new and unique instance of a MediaStream created for that specific request. This allows each requestor to share access to the devices, rather than start multiple streams for that device which some browsers will not allow or limit. Further, by cloning the MediaStreamTracks each requestor can manipulate them (mute, ect) individually without impacting the other instances using that device. Once the last requestor has informed the instance that the streams are no longer required the master MediaStream tracks are stopped and removed until needed again.

When the instance is created it will first attempt to start the master MediaStream for all enabled input media kinds (audio and/or video), using the prefered device ids if provided. This is done to get permission from the user to use these devices prior to them being required. It also elevates the permissions of the instance to be able to get the device names when listing (without starting the MediaStream tracks first the browsers generally don't provide meaningful device names, usually just the device id). It will then stop any started device and maintain an internal representation of the available as well as connected devices. If the user selects a new device, or that device becomes unavailable, the new device will be started immediately to get permission from the user. If there are active instances consuming the streams the newly started device stream replaces any previous stream or removes access to previously active streams if a "null" device is selected (IE: the "None" option). However, if no active instances are consuming the streams the newly started device is immediately stopped after access is granted.

Additionally, the instance provides access to a [HTMLMediaElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement) that represents the different device kinds the instance manages (audio input, video input and audio output). It also provides a 'global' mute / unmute functionality that will impact any consumers of that device kind.

## Methods

#### startStreams(requestId)

When streams are required this function will start the [MediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream/MediaStream) if it isn't already active for another call. The provide request id, or null, will be pushed to an array and the streams will continue until that array is empty. This allows multiple calls or other functions to request streams start and end without causing duplicates.

| Name      | Type   | Default | Description                                             |
| --------- | ------ | ------- | ------------------------------------------------------- |
| requestId | string | null    | The reference / request id that requires a media stream |

> The request id is optional, but its good practice to use the call id.

Returns:

| Type                                                                                    | Description                                                    |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [MediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream/MediaStream) | A MediaStream with tracks cloned from the "master" MediaStream |

#### stopStreams(requestId)

When streams are no longer required, remove the request id from the array of requestors. If the array is empty after this operation, stop all streams.

| Name      | Type   | Default | Description                                             |
| --------- | ------ | ------- | ------------------------------------------------------- |
| requestId | string | null    | The reference / request id that requires a meida stream |

#### stopAllStreams()

Stops all active streams.

#### mute(deviceKind)

Mutes the stream for the provided device kind.

| Name       | Type   | Default | Description                                                   |
| ---------- | ------ | ------- | ------------------------------------------------------------- |
| deviceKind | string |         | The device kind to mute (audiooutput, audioinput, videoinput) |

> NOTE! This will mute the stream for all active calls.

#### unmute(deviceKind)

Unmutes the stream for the provided device kind.

| Name       | Type   | Default | Description                                                     |
| ---------- | ------ | ------- | --------------------------------------------------------------- |
| deviceKind | string |         | The device kind to unmute (audiooutput, audioinput, videoinput) |

> NOTE! This will unmute the stream for all active calls.

#### toggleMute(deviceKind)

If the provided device kind is already muted, unmute it. Otherwise if the device kind is already unmuted, mute it.

| Name       | Type   | Default | Description                                                          |
| ---------- | ------ | ------- | -------------------------------------------------------------------- |
| deviceKind | string |         | The device kind to toggle mute (audiooutput, audioinput, videoinput) |

#### startScreenCapture(options, useDisplayMedia)

Replaces the current video stream with the contents of a display or portion thereof (a window).

| Name            | Type                                                                                              | Default | Description                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| options         | [MediaStreamConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamConstraints) |         | Object specifying requirements for the returned MediaStream                                                                                                                                          |
| useDisplayMedia | boolean                                                                                           | true    | Use [getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) over [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) |

#### stopScreenCapture()

Stops Screen Capture and enables previously selected videoinput

#### getMediaElement(deviceKind)

Get the HTML media element linked to the provided device kind.

| Name       | Type   | Default | Description                                                                            |
| ---------- | ------ | ------- | -------------------------------------------------------------------------------------- |
| deviceKind | string |         | The device kind linked to the HTML media element (ringoutput, audiooutput, audioinput, videoinput) |

Returns:

| Type                                                                                  | Description                                               |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [HTMLMediaElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement) | The HTML media element linked to the provided device kind |

#### getPreferedDevice(deviceKind)

Get the prefered device for the given device kind.

| Name       | Type   | Default | Description                                                   |
| ---------- | ------ | ------- | ------------------------------------------------------------- |
| deviceKind | string |         | The device kind to get (ringoutput, audiooutput, audioinput, videoinput) |

Returns:

| Type                           | Description                            |
| ------------------------------ | -------------------------------------- |
| lwpMediaDevices.preferedDevice | The libwebphone prefered device object |

#### changeDevice(deviceKind, deviceId)

For the provided device kind attmpet to switch to the provided device id, updating all active calls.

| Name       | Type   | Default | Description                                                     |
| ---------- | ------ | ------- | --------------------------------------------------------------- |
| deviceKind | string |         | The device kind to switch (ringoutput, audiooutput, audioinput, videoinput) |
| deviceId   | string |         | The device id to switch to                                      |

#### refreshAvailableDevices()

Verify that all discovered devices are still conntect, remove any from the list that are not and add any newly connected device. If the active device is no longer connected will also automatically switch to the next connected prefered device.

#### updateRenders()

Re-paint / update all render targets.

## i18n

| Key         | Default (en)             | Description                                                                          |
| ----------- | ------------------------ | ------------------------------------------------------------------------------------ |
| none        | None                     | Used as the text for a 'null' selection that can be used to disable that device kind |
| ringoutput  | Speaker                  | Used to label the selector for the ring audio output device                          |
| audiooutput | Speaker                  | Used to label the selector for the audio output device                               |
| audioinput  | Microphone               | Used to label the selector for the audio input device                                |
| videoinput  | Camera                   | Used to lable the selector for the video input device                                |
| loading     | Finding media devices... | Used to label the inital loading screen when discovering available devices           |

## Configuration

| Name                                    | Type                                                                                              | Default                            | Description                                                                                                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ringoutput.enabled                     | boolean                                                                                           | true if sinkId in HtmlMediaElement | Enables ringing output device selection                                                                                                                                                                                                                   |
| ringoutput.show                        | boolean                                                                                           | true                               | Should the default template show the ringing output device selection                                                                                                                                                                                            |
| ringoutput.preferedDeviceIds           | array of strings                                                                                  | []                                 | The prefered device ids in order of precedence                                                                                                                                                                                                          |
| ringoutput.mediaElement.create         | boolean                                                                                           | true                               | Should a HTMLMediaElement be created                                                                                                                                                                                                                    |
| ringoutput.mediaElement.elementId      | string                                                                                            |                                    | The HTML id of an existing HTMLMediaElement to use                                                                                                                                                                                                      |
| ringoutput.mediaElement.element        | HTMLMediaElement                                                                                  |                                    | The HTMLMediaElement linked to the output device selection                                                                                                                                                                                              |
| ringoutput.mediaElement.initParameters | object                                                                                            | { muted: false }                   | Key - value pairs to apply to the HTMLMediaElement                                                                                                                                                                                                      |
| audiooutput.enabled                     | boolean                                                                                           | true if sinkId in HtmlMediaElement | Enables audio output device selection                                                                                                                                                                                                                   |
| audiooutput.show                        | boolean                                                                                           | true                               | Should the default template show the output device selection                                                                                                                                                                                            |
| audiooutput.preferedDeviceIds           | array of strings                                                                                  | []                                 | The prefered device ids in order of precedence                                                                                                                                                                                                          |
| audiooutput.mediaElement.create         | boolean                                                                                           | true                               | Should a HTMLMediaElement be created                                                                                                                                                                                                                    |
| audiooutput.mediaElement.elementId      | string                                                                                            |                                    | The HTML id of an existing HTMLMediaElement to use                                                                                                                                                                                                      |
| audiooutput.mediaElement.element        | HTMLMediaElement                                                                                  |                                    | The HTMLMediaElement linked to the output device selection                                                                                                                                                                                              |
| audiooutput.mediaElement.initParameters | object                                                                                            | { muted: false }                   | Key - value pairs to apply to the HTMLMediaElement                                                                                                                                                                                                      |
| audioinput.enabled                      | boolean                                                                                           | true                               | Enables audio input device selection                                                                                                                                                                                                                    |
| audioinput.show                         | boolean                                                                                           | true                               | Should the default template show the audio input device selection                                                                                                                                                                                       |
| audioinput.constraints                  | [MediaStreamConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamConstraints) | {}                                 | From the MDN web docs "The MediaStreamConstraints dictionary is used when calling getUserMedia() to specify what kinds of tracks should be included in the returned MediaStream, and, optionally, to establish constraints for those tracks' settings." |
| audioinput.preferedDeviceIds            | array of strings                                                                                  | []                                 | The prefered device ids in order of precedence                                                                                                                                                                                                          |
| audioinput.mediaElement.create          | boolean                                                                                           | true                               | Should a HTMLMediaElement be created                                                                                                                                                                                                                    |
| audioinput.mediaElement.elementId       | string                                                                                            |                                    | The HTML id of an existing HTMLMediaElement to use                                                                                                                                                                                                      |
| audioinput.mediaElement.element         | HTMLMediaElement                                                                                  |                                    | The HTMLMediaElement linked to the input device selection                                                                                                                                                                                               |
| audioinput.mediaElement.initParameters  | object                                                                                            | { muted: false }                   | Key - value pairs to apply to the HTMLMediaElement                                                                                                                                                                                                      |
| videoinput.enabled                      | boolean                                                                                           | true                               | Enables video input device selection                                                                                                                                                                                                                    |
| videoinput.show                         | boolean                                                                                           | true                               | Should the default template show the video input device selection                                                                                                                                                                                       |
| videoinput.constraints                  | [MediaStreamConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamConstraints) | {}                                 | From the MDN web docs "The MediaStreamConstraints dictionary is used when calling getUserMedia() to specify what kinds of tracks should be included in the returned MediaStream, and, optionally, to establish constraints for those tracks' settings." |
| videoinput.preferedDeviceIds            | array of strings                                                                                  | []                                 | The prefered device ids in order of precedence                                                                                                                                                                                                          |
| videoinput.mediaElement.create          | boolean                                                                                           | true                               | Should a HTMLMediaElement be created                                                                                                                                                                                                                    |
| videoinput.mediaElement.elementId       | string                                                                                            |                                    | The HTML id of an existing HTMLMediaElement to use                                                                                                                                                                                                      |
| videoinput.mediaElement.element         | HTMLMediaElement                                                                                  |                                    | The HTMLMediaElement linked to the input device selection                                                                                                                                                                                               |
| videoinput.mediaElement.initParameters  | object                                                                                            | { muted: false }                   | Key - value pairs to apply to the HTMLMediaElement                                                                                                                                                                                                      |
| detectDeviceChanges                     | boolean                                                                                           | true                               | Should it monitor for device changes, and switch when the active device is disconnected                                                                                                                                                                 |
| manageMediaElements                     | boolean                                                                                           | true                               | Should lwpMediaDevices manage the HTMLMediaElement parameters                                                                                                                                                                                           |
| renderTargets                           | array                                                                                             | []                                 | See [lwpRenderer](lwpRenderer.md)                                                                                                                                                                                                                       |

## Events

### Emitted

| Event                             | Additional Parameters                                                                 | Description                                     |
| --------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| mediaDevices.created              |                                                                                       | Emitted when the class is instantiated          |
| mediaDevices.streams.started      | [mediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream)           | Emitted when streams are started for a call     |
| mediaDevices.streams.stopped      |                                                                                       | Emitted when streams are stopped for a call     |
| mediaDevices.ring.output.element | [HTML Audio Element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio) | Emitted when the HTML audio element is created  |
| mediaDevices.audio.output.element | [HTML Audio Element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio) | Emitted when the HTML audio element is created  |
| mediaDevices.audio.input.element  | [HTML Audio Element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio) | Emitted when the HTML audio element is created  |
| mediaDevices.video.output.element | [HTML Video Element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video) | Emitted when the HTML audio element is created  |
| mediaDevices.getUserMedia.error   | error (exception)                                                                     | Emitted if getUserMedia() throws                |
| mediaDevices.ring.output.changed | preferedDevice                                                                        | Emitted when the ring output audio device is changed |
| mediaDevices.audio.output.changed | preferedDevice                                                                        | Emitted when the output audio device is changed |
| mediaDevices.audio.input.muted    | trackParameters (lwpUtil.trackParameters)                                             | Emitted when the input audio is muted           |
| mediaDevices.video.input.muted    | trackParameters (lwpUtil.trackParameters)                                             | Emitted when the input audio is muted           |
| mediaDevices.audio.input.unmuted  | trackParameters (lwpUtil.trackParameters)                                             | Emitted when the input audio is unmuted         |
| mediaDevices.video.input.unmuted  | trackParameters (lwpUtil.trackParameters)                                             | Emitted when the input audio is unmuted         |
| mediaDevices.audio.input.changed  | newTrack (lwpUtil.trackParameters), previousTrack (lwpUtil.trackParameters)           | Emitted when the input audio device is changed  |
| mediaDevices.video.input.changed  | newTrack (lwpUtil.trackParameters), previousTrack (lwpUtil.trackParameters)           | Emitted when the input video device is changed  |
| mediaDevices.audio.input.started  | trackParameters (lwpUtil.trackParameters)                                             | Emitted when the audio input is started         |
| mediaDevices.video.input.started  | trackParameters (lwpUtil.trackParameters)                                             | Emitted when the video input is started         |
| mediaDevices.audio.input.stopped  | trackParameters (lwpUtil.trackParameters)                                             | Emitted when the audio input is stopped         |
| mediaDevices.video.input.stopped  | trackParameters (lwpUtil.trackParameters)                                             | Emitted when the video input is stopped         |
| mediaDevices.loaded               | availableDevices                                                                      | Emitted when the devices are initialized        |
| mediaDevices.refreshed            | availableDevices                                                                      | Emitted when the devices are changed            |
> NOTE! All standard HTML media events for the audio ringing, audio output, audio input and video input elements are emitted as mediaDevices.{kind}.{direction}.{eventName} with the additional parameters: element (HTML element), event (HTML media event). For example, mediaDevices.audio.input.playing.

### Consumed

| Event                                 | Reason                         |
| ------------------------------------- | ------------------------------ |
| call.terminated                       | Invokes stopStreams()          |
| audioContext.preview.loopback.started | Invokes startStreams()         |
| audioContext.preview.loopback.stopped | Invokes stopStreams()          |
| audioContext.started                  | Invokes \_startMediaElements() |
| mediaDevices.streams.started          | Invokes updateRenders()        |
| mediaDevices.streams.stop             | Invokes updateRenders()        |
| mediaDevices.ring.output.changed      | Invokes updateRenders()        |
| mediaDevices.audio.output.changed     | Invokes updateRenders()        |
| mediaDevices.audio.input.changed      | Invokes updateRenders()        |
| mediaDevices.video.input.changed      | Invokes updateRenders()        |
| mediaDevices.getUserMedia.error       | Invokes updateRenders()        |

## Default Template

### Data

### HTML

## Future Consideration

Ideally, we would buffer/proxy the master MediaStream tracks via other means. For example, if the input audio went to a [MediaStreamTrackAudioSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrackAudioSourceNode) we could use the capabilities of the [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) to manipulate it as we wanted and return a [MediaStreamAudioDestinationNode](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamAudioDestinationNode) to all requestors. This has the added benifit that all the requestors are opaque to any changes to the MediaStreamTrackAudioSourceNode (switching audio inputs). More compatable approaches explored using [HTMLMediaElements](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement). However, oddities in the browsers, availability of some capabilities, and restrictions with using a HTMLMediaElement as both a sink and source in the [Web APIs](https://developer.mozilla.org/en-US/docs/Web/API) mean its not _yet_ pratical.
