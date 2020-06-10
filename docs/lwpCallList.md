# lwpCallList

> NOTE! It is not expected that an instance of this class be created outside of the libwebphone interals. To access this instance use the libwebphone instance method `getCallList()`. If you are unfamiliar with the structure of libwebphone its highly recommended you [start here](/README.md).

Provides the necessary functionality to handle multiple calls at once, if this class is disabled libwebphone will only be able to make a single call at once.

## Methods

#### getCalls()

Provides the invoker with a list of all calls, includes a lwpCall without a
session used to denote a new call.

Returns:

| Type      | Description                   |
| --------- | ----------------------------- |
| [lwpCall] | An array of lwpCall instances |

#### getCall(callId)

Provides the invoker with the current primary call instance, if the primary call
has a session.

Returns:

| Type            | Description                                                           |
| --------------- | --------------------------------------------------------------------- |
| lwpCall or null | A lwpCall instance or null if there is no primary call with a session |

#### addCall(newCall)

| Name    | Type    | Default | Description                                      |
| ------- | ------- | ------- | ------------------------------------------------ |
| newCall | lwpCall |         | The new lwpCall instance to add to the call list |

Adds a call to the call list and makes it the primary if there isn't currently a
primary call with a session.

#### switchCall(callId)

| Name   | Type   | Default | Description                                   |
| ------ | ------ | ------- | --------------------------------------------- |
| callId | string |         | The lwpCall id to promote to the primary call |

If the callId matches a lwpCall instance that instance will be promoted to
primary and any current primary call (with a session) will be demoted.

#### removeCall(callId)

| Name   | Type   | Default | Description                                 |
| ------ | ------ | ------- | ------------------------------------------- |
| callId | string |         | The lwpCall id to remote from the call list |

If the callId matches a lwpCall instance that instance is removed from the call
list. Additionally, if the removed call is currently the primary and another
call exists in the list that has a session, the first occurance is promoted to
the new primary.

#### updateRenders()

Re-paint / update all render targets.

## i18n

| Key | Default (en) | Description                                                |
| --- | ------------ | ---------------------------------------------------------- |
| new | New Call     | Used as the label for the new call option in the call list |

## Configuration

| Name          | Type  | Default | Description                       |
| ------------- | ----- | ------- | --------------------------------- |
| renderTargets | array | []      | See [lwpRenderer](lwpRenderer.md) |

## Events

### Emitted

| Event                  | Additional Parameters                                     | Description                                  |
| ---------------------- | --------------------------------------------------------- | -------------------------------------------- |
| callList.created       |                                                           | Emitted when the class is instantiated       |
| calllist.calls.added   | newCall (lwpCall)                                         | Emitted when a new call is added to the list |
| calllist.calls.changed | newCall (lwpCall or null), previousCall (lwpCall or null) | Emitted when the primary call is changed     |
| calllist.calls.removed | terminatedCall (lwpCall)                                  | Emitted when a call is removed from the list |

### Consumed

| Event                    | Reason                                                    |
| ------------------------ | --------------------------------------------------------- |
| call.created             | Invokes addCall()                                         |
| call.terminated          | Invokes removeCall()                                      |
| callList.calls.added     | Invokes updateRenders() to show the new call in the list  |
| callList.calls.changed   | Invokes updateRenders() to show the changed the selection |
| call.promoted            | Invokes updateRenders() to update the shown call status   |
| call.progress            | Invokes updateRenders() to update the shown call status   |
| call.established         | Invokes updateRenders() to update the shown call status   |
| call.hold                | Invokes updateRenders() to update the shown call status   |
| call.unhold              | Invokes updateRenders() to update the shown call status   |
| call.muted               | Invokes updateRenders() to update the shown call status   |
| call.unmuted             | Invokes updateRenders() to update the shown call status   |
| call.transfer.collecting | Invokes updateRenders() to update the shown call status   |
| call.transfer.completed  | Invokes updateRenders() to update the shown call status   |
| call.ended               | Invokes updateRenders() to update the shown call status   |
| call.failed              | Invokes updateRenders() to update the shown call status   |

## Default Template

### Data

### HTML
