# Kazoo Webphone library v2.0

The goal of this library is to turn the browser in a softphone, using the correct protocol depending on the browser used by the client. On supported browsers, the goal is to allow calls using WebRTC, ~~and to fall back on the RTMP
protocol if WebRTC is not supported by the browser.~~

The libwebphone is the top level class that provides all access to the libraries functionality for an instance of a specific configuration. The funtionality is implemented by classes that encapsulated the logic for a particular component of a phone, those are:

- [lwpUserAgent](docs/lwpUserAgent.md) : Provides all features for managing connecting and maintaining the SIP connection over websockets.
- [lwpMediaDevices](docs/lwpMediaDevices.md) : Provides all features for discovering and selecting the media device (microphone, camera and audio output destination)
- [lwpAudioContext](docs/lwpAudioContext.md) : Provides audio generation (ringing, DTMF playback, ect) as well as audio routing / mixing options
- [lwpCallList](docs/lwpCallList.md) : Provides a list of all active calls and allowes the user to switch between them
- [lwpDialpad](docs/lwpDialpad.md) : Provides all features for collecting the target (dialed number) for new calls, transfers and in call DTMF
- [lwpCallControl](docs/lwpCallControl.md) : Provides all call control features such as hold, mute, transfer, redial, ect

Each of these clases can be disabled via configuration (or modified build) if the provided functionality is not required or desired.

Internally, all calls are represented as an instance of the [lwpCall](docs/lwpCall.md) class.

> NOTE! Each of these classes is not expected to be created outside of the main libwebphone instance, and are accessable using methods of the main instance or by consuming events.

## Methods

#### getCallControl()

Returns:

| Type                                             | Description                                                |
| ------------------------------------------------ | ---------------------------------------------------------- |
| null or [lwpCallControl](docs/lwpCallControl.md) | Provides access to the lwpCallControl instance if enabled. |

#### getCallList()

Returns:

| Type                                       | Description                                             |
| ------------------------------------------ | ------------------------------------------------------- |
| null or [lwpCallList](docs/lwpCallList.md) | Provides access to the lwpCallList instance if enabled. |

#### getDialpad()

Returns:

| Type                                     | Description                                            |
| ---------------------------------------- | ------------------------------------------------------ |
| null or [lwpDialpad](docs/lwpDialpad.md) | Provides access to the lwpDialpad instance if enabled. |

#### getUserAgent()

Returns:

| Type                                         | Description                                              |
| -------------------------------------------- | -------------------------------------------------------- |
| null or [lwpUserAgent](docs/lwpUserAgent.md) | Provides access to the lwpUserAgent instance if enabled. |

#### getMediaDevices()

Returns:

| Type                                               | Description                                                 |
| -------------------------------------------------- | ----------------------------------------------------------- |
| null or [lwpMediaDevices](docs/lwpMediaDevices.md) | Provides access to the lwpMediaDevices instance if enabled. |

#### getAudioContext()

Returns:

| Type                                               | Description                                                 |
| -------------------------------------------------- | ----------------------------------------------------------- |
| null or [lwpAudioContext](docs/lwpAudioContext.md) | Provides access to the lwpAudioContext instance if enabled. |

#### geti18n()

Provides direct access to the current i18n library or i18n instance.

Returns:

| Type                                | Description         |
| ----------------------------------- | ------------------- |
| [i18next](https://www.i18next.com/) | The i18next library |

#### i18nAddResourceBundles(className, resources)

Addes language resources namespaced to the provided module name.

| Name      | Type   | Description                                                                                                                       |
| --------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| className | string | The name of the class, used to namespace the resources                                                                            |
| resources | object | A dictionary with keys representing the language name and values that are themselfs dictionaries of keys to the translated string |

Example resources object:

```javascript
{
   "en":{
      "answer":"Anwser",
      "redial":"Redial",
      "cancel":"Cancel",
      "hangup":"Hang Up",
      "hold":"Hold",
      "unhold":"Resume",
      "mute":"Mute",
      "unmute":"Unmute"
   },
   "fr":{
      "answer":"Répondre",
      "redial":"Recomposer",
      "cancel":"Annuler",
      "hangup":"Raccrocher",
      "hold":"Attente",
      "unhold":"Reprendre",
      "mute":"Muter",
      "unmute":"Rétablir"
   }
}
```

#### i18nAddResourceBundle(className, language, resource)

Addes language resources namespaced to the provided module name.

| Name      | Type   | Description                                            |
| --------- | ------ | ------------------------------------------------------ |
| className | string | The name of the class, used to namespace the resources |
| language  | string | The name of the lanuage                                |
| resource  | object | A dictionary of keys to the translated string          |

Example resource object (in this case `language` would be "en"):

```javascript
{
   "answer":"Anwser",
   "redial":"Redial",
   "cancel":"Cancel",
   "hangup":"Hang Up",
   "hold":"Hold",
   "unhold":"Resume",
   "mute":"Mute",
   "unmute":"Unmute"
}
```

#### i18nTranslator()

Provides a function, when ready, that given a i18n key returns the translated string from the loaded language bundles.

Returns:

| Type          | Description                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| function(key) | From the i18next documentation "You can specify either one key as a String or multiple keys as an Array of String. The first one that resolves will be returned." |

## i18n

Internationalization of the built in templates, or optionally utilized by custom templates, are loaded with language 'bundles' by each class instance during startup. These bundles are loaded with a namespace for that class. The default library used is [i18next](https://www.i18next.com/) but it is hoped that then implementation is generic enough to allow replacment with a prefered library or an existing on an a website.

For details of what translations are currently available see the individual class documentation "i18n" section.

## Configuration

| Name         | Type   | Default | Description                                                                |
| ------------ | ------ | ------- | -------------------------------------------------------------------------- |
| userAgent    | object | {}      | See [lwpUserAgent configuration](docs/lwpUserAgent.md#configuration)       |
| mediaDevices | object | {}      | See [lwpMediaDevices configuration](docs/lwpMediaDevices.md#configuration) |
| audioContext | object | {}      | See [lwpAudioContext configuration](docs/lwpAudioContext.md#configuration) |
| callList     | object | {}      | See [lwpCallList configuration](docs/lwpCallList.md#configuration)         |
| dialpad      | object | {}      | See [lwpDialpad configuration](docs/lwpDialpad.md#configuration)           |
| callControl  | object | {}      | See [lwpCallControl configuration](docs/lwpCallControl.md#configuration)   |
| call         | object | {}      | See [lwpCall configuration](docs/lwpCall.md#configuration)                 |

## Events

All events produced by libwebphone are emitted with a minimum of two parameters. The first is always the instance of libwebphone and the second is the instance of the class producing the event. For example, the first two parameters of the event "mediaDevices.created" are the libwebphone instance and the lwpMediaDevices instance. Further, all events are in dot notation beginning with the emitting class "name". In the above example, "mediaDevices.created" was emitted by lwpMediaDevices.

Some events provide more parameters and are detailed on the corresponding documents as "Additional Parameters". This column is a comma sepearted list of arguments that are present after the libwebphone and producing class instance parameters.

At any given time only one instance of a call (lwpCall) will be the primary (current user selected call). When the primary lwpCall instance emits events they will be published with the normal prefix "call." as well as with "call.primary.".

Further, all events are emitted using [EventEmitter2](https://github.com/EventEmitter2/EventEmitter2) which according to their documentation:

> In addition to having a better benchmark performance than EventEmitter and being browser-compatible, it also extends the interface of EventEmitter with many additional non-breaking features.

Some of these additional features include events when listeners are added / removed, wildcard bindings and functions such as `waitFor(event, timeout)` or `onAny(listener)`. See the documentation for EventEmitter2 for details.

### Emitted

| Event                 | Additional Parameters        | Description                                              |
| --------------------- | ---------------------------- | -------------------------------------------------------- |
| created               |                              | Emitted when all required classes have been instantiated |
| language.bundle.added | language (string), bundle () | Emitted when a new language bundle is added              |
| language.changed      | translator (function)        | Emitted when the translator function is ready or changed |

## Todo

- Standardize default templates and add default CSS classes
- lwpVideoCanvas : Nearly complete class to render and control video aspects of calls
- Support multiple instances of lwpUserAgent to provide "multi-line" functionality.
- lwpKazoo : Base class for all classes interacting with Kazoo as well as maintaining Kazoo websocket connections
- lwpKazooDevices : Select a device to use in lwpUserAgent from a filtered list of available devices as well as optional create when missing
- lwpKazooParked: Maintains a list of all parked calls, allow rapid retrieval / parking as well as annotate parked calls
- lwpKazooConferences : Maintains a list of confernences, current conference status, rapid conference access
- lwpKazooConferenceControls : In conference controls (similar to lwpCallControls but specific to Kazoo conferences)
- lwpKazooVoicemails : Provides MWI, rapid voicemail access and rapid voicemail message callback
- lwpKazooUsers : Create a filtered list of Kazoo users and presence status as well as quick dial options
- lwpKazooCDRs : Used to list and rapidly redial previous calls

## Contact

If you have any question or remark about the library or its documentation, feel free to come talk to us on IRC #2600hz on FreeNode.
