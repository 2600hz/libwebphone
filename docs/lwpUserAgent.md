# lwpUserAgent

> NOTE! It is not expected that an instance of this class be created outside of the libwebphone interals. To access this instance use the libwebphone instance method `getUserAgent()`. If you are unfamiliar with the structure of libwebphone its highly recommended you [start here](/README.md).

The libwebphone user agent class provides all the functionality to start and manage a [SIP User Agent](https://en.wikipedia.org/wiki/Session_Initiation_Protocol#User_agent).

## Methods

#### start(username, password, realm)

| Name     | Type   | Default | Description                               |
| -------- | ------ | ------- | ----------------------------------------- |
| username | string |         | Override the configured username (if any) |
| password | string |         | Override the configured password (if any) |
| realm    | string |         | Override the configured realm (if any)    |

This will configure and start the jssip user agent.

#### stop()

This will terminate all active calls for this user agent, attemp to unregister,
then stop the jssip user agent if its running.

#### isStarted()

Informs the invoker if the jssip user agent is running.

Returns:

| Type    | Description                                               |
| ------- | --------------------------------------------------------- |
| boolean | If true the jssip user agent is runnning, otherwise false |

#### isConnected()

Informs the invoker if the jssip user agent is connected to the SIP websocket.

Returns:

| Type    | Description                                                |
| ------- | ---------------------------------------------------------- |
| boolean | If true the jssip user agent is connected, otherwise false |

#### startDebug()

Configures the instance to start logging debug information on the console. This
will include all libwebphone events and their payloads as well as jssip
debugging (which includes the SIP packets).

#### stopDebug()

Configures the instance to stop logging debug information on the console.

#### toggleDebug()

If debugging is already enabled, disable it. If debugging is already disabled,
enabled.

#### isDebugging()

Informs the invoker if the debugging is enabled.

Returns:

| Type    | Description                                       |
| ------- | ------------------------------------------------- |
| boolean | If true the debugging is enabled, otherwise false |

#### register()

Request jssip user agent attempt a registration.

#### unregister()

Request jssip user agent attempt to unregister.

#### toggleRegistration()

If the jssip user agent is registered, attempt to unregister. If the user agent
is unregistered, attempt to register.

#### isRegistered()

Informs the invoker if the jssip user agent is registered.

Returns:

| Type    | Description                                                 |
| ------- | ----------------------------------------------------------- |
| boolean | If true the jssip user agent is registered, otherwise false |

#### redial()

This will start a new call to the last number dialed by this user agent (or set
using setRedial()).

#### getRedial()

Informs the invoker the last number dialed by this user agent (or set using
setRedial()).

Returns:

| Type   | Description                                                          |
| ------ | -------------------------------------------------------------------- |
| string | The last number dialed by this user agent (or set using setRedial()) |

#### setRedial(target)

| Name   | Type   | Default | Description                           |
| ------ | ------ | ------- | ------------------------------------- |
| target | string |         | The value to set the redial target to |

Updates the redial target.

#### call(target, custom_headers, anonymous | options)

| Name                      |  Type   | Default | Description                                                                                         |
| ------------------------- | ------- | ------- | --------------------------------------------------------------------------------------------------- |
| target                    | string  |                                                           | The target for the new call                       |
| custom_headers            | array   | []                                                        | A list of strings to add to the INVITE            |
| anonymous                 | boolean | false                                                     | Whether the call should be done anonymously       |
| options              | object  | `{receive_video: false, anonymous: false}`                 | additional call options                           |
| options.anonymous    | boolean | false                                                     | Whether the call should be done anonymously       |
| options.receive_video | boolean | false                                                     | Wheter the call should accept remote video stream |

Attempts to create a new call to target, or the redial target if non is provided
as an argument.

If the lwpMediaDevices is available it will use that to create the local media
streams, otherwise it will be left up to jssip internals.

Additionally, if lwpCallList is not available this will terminate any active
calls first ensuring only one call is active at a time.

If custom_headers are provided they will be merged with any configured headers.  The
format of each string should be the full, valid SIP header.  For example: "X-Foo: bar"

#### hangupAll()

Terminates all active calls for this user agent.

#### isReady()

Informs the invoker if the jssip user agent is started, connected and
registered.

> NOTE! You can make outbound (originating) calls if the user agent is started
> and connected.

Returns:

| Type    | Description                                            |
| ------- | ------------------------------------------------------ |
| boolean | If true the jssip user agent is ready, otherwise false |

#### updateRenders()

Re-paint / update all render targets.

## i18n

| Key        | Default (en) | Description                                      |
| ---------- | ------------ | ------------------------------------------------ |
| agentstart | Start        | Used as the text for the start user agent action |
| agentstop  | Stop         | Used as the text for the stop user agent action  |
| debug      | Debug        | Used as the label for the debug element          |
| debugstart | Start        | Used as the text for the start debug action      |
| debugstop  | Stop         | Used as the text for the stop debug action       |
| username   | Username     | Used as the label for username input element     |
| password   | Password     | Used as the label for password input element     |
| realm      | Realm        | Used as the label for realm input element        |
| registrar  | Registrar    | Used as the label for the registrar element      |
| register   | Register     | Used as the text for the register action         |
| unregister | Unregister   | Used as the text for the unregister action       |

## Configuration

| Name                            | Type                                                                                                      | Default                | Description                                                                                                                                                                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| transport.sockets               | [jssip sockets](https://jssip.net/documentation/3.4.x/api/ua_configuration_parameters/#parameter_sockets) | []                     | Configuration for one or more SIP websocket connections, required                                                                                                                                                                                                                                    |
| transport.recovery_max_interval | integer                                                                                                   | 30                     | From jssip documentation "Maximum interval (Number) in seconds between WebSocket reconnection attemps."                                                                                                                                                                                              |
| transport.recovery_min_interval | integer                                                                                                   | 2                      | From jssip documentation "Minimum interval (Number) in seconds between WebSocket reconnection attempts."                                                                                                                                                                                             |
| authentication.username         | string                                                                                                    |                        | The SIP username                                                                                                                                                                                                                                                                                     |
| authentication.password         | string                                                                                                    |                        | The SIP password                                                                                                                                                                                                                                                                                     |
| authentication.jwt         | string                                                                                                    |                        | A Kazoo JWT used to authenticate the client, if set authentication.username and authentication.password                                                                                                                                                                                                                                                                                     |
| authentication.realm            | string                                                                                                    |                        | The SIP realm                                                                                                                                                                                                                                                                                        |
| user_agent.contact_uri          | string                                                                                                    |                        | From jssip documentation "String indicating the contact URI to be used in the Contact header field. The given URI host will be used as the Via header host parameter."                                                                                                                               |
| user_agent.display_name         | string                                                                                                    |                        | From jssip documentation "Descriptive name (String) to be shown to the called party when calling or sending IM messages. It must NOT be enclosed between double quotes even if the given name contains multi-byte symbols (JsSIP will always enclose the display_name value between double quotes)." |
| user_agent.instance_id          | string                                                                                                    |                        | From jssip documentation "String indicating the UUID URI to be used as instance ID to identify the UA instance when using GRUU."                                                                                                                                                                     |
| user_agent.no_answer_timeout    | integer                                                                                                   | 60                     | From jssip documentation "Time (in seconds) (Integer) after which an incoming call is rejected if not answered. Default value is 60."                                                                                                                                                                |
| user_agent.register             | boolean                                                                                                   | true                   | From jssip documentation "Indicate if JsSIP User Agent should register automatically when starting. Valid values are true and false (Boolean). "                                                                                                                                                     |
| user_agent.register_expires     | integer                                                                                                   | 300                    | From jssip documentation "Registration expiry time (in seconds) (Integer). "                                                                                                                                                                                                                         |
| user_agent.user_agent           | string                                                                                                    | 2600Hz libwebphone 2.x | From jssip documentation "User-Agent header field value (String) present in SIP messages."                                                                                                                                                                                                           |
| user_agent.redial               | string                                                                                                    | \*97                   | The initial value for the redial target                                                                                                                                                                                                                                                              |
| user_agent.custom_headers.establish_call               | array                                                                                                    | []                   | A list of strings to add to every INVITE when establishing a call target                                                                                                                                                                                                                                                              |
| user_agent.custom_headers.register               | array                                                                                                    | []                   | A list of strings to add to every REGISTER request |
| user_agent.custom_parameters.contact_uri            | object                                                                                                    | []                   | Object with keys representing the header param name and values representing the Contact header param values. |
| debug                           | boolean                                                                                                   | false                  | The inital value for the debugging option                                                                                                                                                                                                                                                            |
| renderTargets                   | array                                                                                                     | []                     | See [lwpRenderer](lwpRenderer.md)                                                                                                                                                                                                                                                                    |

## Events

### Emitted

| Event                               | Additional Parameters                                                                                          | Description                                                                                                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| userAgent.created                   |                                                                                                                | Emitted when the class is instantiated                                                                                                                                                                              |
| userAgent.connected                 | event ([jssip connected](https://jssip.net/documentation/3.4.x/api/ua/#event_connected))                       | As defined by jssip "Fired when the transport connection is established."                                                                                                                                           |
| userAgent.disconnected              | event ([jssip disconnected](https://jssip.net/documentation/3.4.x/api/ua/#event_disconnected))                 | As defined by jssip "Fired when the transport connection attempt (or automatic re-attempt) fails."                                                                                                                  |
| userAgent.registration.registered   | event ([jssip registered](https://jssip.net/documentation/3.4.x/api/ua/#event_registered))                     | As defined by jssip "Fired for a successfull registration."                                                                                                                                                         |
| userAgent.registration.unregistered | event ([jssip unregistered](https://jssip.net/documentation/3.4.x/api/ua/#event_unregistered))                 | As defined by jssip "Fired for an unregistration. This event is fired in the following scenarios: As a result of a unregistration request. UA.unregister(). If being registered, a periodic re-registration fails." |
| userAgent.registration.failed       | event ([jssip registrationFailed](https://jssip.net/documentation/3.4.x/api/ua/#event_registrationFailed))     | As defined by jssip "Fired for a registration failure."                                                                                                                                                             |
| userAgent.registration.expiring     | event ([jssip registrationExpiring](https://jssip.net/documentation/3.4.x/api/ua/#event_registrationExpiring)) | As defined by jssip "Fired a few seconds before the registration expires."                                                                                                                                          |
| userAgent.recieved.message          | event ([jssip newMessage](https://jssip.net/documentation/3.4.x/api/ua/#event_newMessage))                     | As defined by jssip "Fired for an incoming or outgoing MESSAGE request."                                                                                                                                            |
| userAgent.recieved.notify           | event ([jssip sipEvent](https://jssip.net/documentation/3.4.x/api/ua/#event_sipEvent))                         | As defined by jssip "Fired for an incoming out of dialog NOTIFY request."                                                                                                                                           |
| userAgent.started                   |                                                                                                                | Emitted when the user agent has started                                                                                                                                                                             |
| userAgent.configuration.error       | error (exception)                                                                                              | Emitted if the jssip user agent is unable to start                                                                                                                                                                  |
| userAgent.stopped                   |                                                                                                                | Emitted when the user agent is stopped                                                                                                                                                                              |
| userAgent.debug.start               |                                                                                                                | Emitted when debug enabled                                                                                                                                                                                          |
| userAgent.debug.stop                |                                                                                                                | Emitted when debug disable                                                                                                                                                                                          |
| userAgent.redial.started            | redialTarget (string)                                                                                          | Emitted when starting a redial attempt.                                                                                                                                                                             |
| userAgent.redial.update             | redialTarget (string)                                                                                          | Emitted when the redial target is updated or set                                                                                                                                                                    |
| userAgent.call.failed               | error (exception)                                                                                              | Emitted if a call attempt failes or throws an exception                                                                                                                                                             |
| userAgent.call.started              | target (string)                                                                                                | Emitted if a call attempt is successful                                                                                                                                                                             |

### Consumed

| Event                 | Reason                                                     |
| --------------------- | ---------------------------------------------------------- |
| userAgent.debug.start | Invokes updateRenders() to show the debug status           |
| userAgent.debug.stop  | Invokes updateRenders() to show the debug status           |
| userAgent.call.failed | Invokes updateRenders() to re-enable any disabled elements |

## Default Template

### Data

### HTML
