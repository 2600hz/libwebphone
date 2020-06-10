# libwebphone

The libwebphone is the top level class that provides all access to the libraries functionality for an instance of a specific configuration. The funtionality is implemented by classes that encapsulated the logic for a particular component of a phone, those are:

- [lwpAudioContext](lwpAudioContext.md) : Provides audio generation (ringing, DTMF playback, ect) as well as audio routing / mixing options
- [lwpCallControl](lwpCallControl.md) : Provides all call control features such as hold, mute, transfer, redial, ect
- [lwpCallList](lwpCallList.md) : Provides a list of all active calls and allowes the user to switch between them
- [lwpDialpad](lwpDialpad.md) : Provides all features for collecting the target (dialed number) for new calls, transfers and in call DTMF
- [lwpMediaDevices](lwpMediaDevices.md) : Provides all features for discovering and selecting the media device (microphone, camera and audio output destination)
- [lwpUserAgent](lwpUserAgent.md) : Provides all features for managing connecting and maintaining the SIP connection over websockets.

Internally, all calls are represented as an instance of the [lwpCall](lwpCall.md) class.

> NOTE! Each of these classes is not expected to be created outside of the main libwebphone instance, and are accessable using methods of the main instance or by consuming events.

## Methods

#### getCallControl()

Provides access to the [lwpCallControl](lwpCallControl.md) instance.

#### getCallList()

Provides access to the [lwpCallList](lwpCallList.md) instance.

#### getDialpad()

Provides access to the [lwpDialpad](lwpDialpad.md) instance.

#### getUserAgent()

Provides access to the [lwpUserAgent](lwpUserAgent.md) instance.

#### getMediaDevices()

Provides access to the [lwpMediaDevices](lwpMediaDevices.md) instance.

#### getAudioContext()

Provides access to the [lwpAudioContext](lwpAudioContext.md) instance.

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
