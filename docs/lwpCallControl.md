# lwpCallControl

> NOTE! It is not expected that an instance of this class be created outside of the libwebphone interals. To access this instance use the libwebphone instance method `getCallControl()`. If you are unfamiliar with the structure of libwebphone its highly recommended you [start here](/README.md).

Provides call controls such as redial, answer, cancel, hangup, hold/unhold,
mute/unmute and transfer.

## Methods

#### redial()

Starts a new call to the last dialed number.

#### cancel()

Ends the primary call attempt (used for calls not yet established).

#### hangup()

Ends the primary call (used for established calls).

#### hold()

Places the primary call on hold.

#### unhold()

Resumes the primary call if on hold.

#### mute()

Mutes audio being transmitted on the primary call.

#### unmute()

Unmutes audio being transmitted on the primary call.

### muteVideo()

Mutes video being transmitted on the primary call.

### unmuteVideo()

Unmutes video being transmitted on the primary call.

#### transfer()

Starts or completes a started transfer on the primary call.

#### answer()

Answers the primary call.

#### updateRenders(call)

| Name | Type    | Description                                                  |
| ---- | ------- | ------------------------------------------------------------ |
| call | lwpCall | The call to consider the primary when rendering the elements |

Re-paint / update all render targets.

## i18n

| Key              | Default (en)        | Description                                             |
| ---------------- | ------------------- | ------------------------------------------------------- |
| answer           | Answer              | Used as the text for the answer action                  |
| redial           | Redial              | Used as the text for the redial action                  |
| cancel           | Cancel              | Used as the text for the cancel action                  |
| hangup           | Hung Up             | Used as the text for the hang up action                 |
| hold             | Hold                | Used as the text for the hold action                    |
| unhold           | Resume              | Used as the text for the unhold action                  |
| mute             | Mute Audio          | Used as the text for the mute action                    |
| unmute           | Unmute Audio        | Used as the text for the unmute action                  |
| muteVideo        | Mute Video          | Used as the text for the mute video action              |
| unmuteVideo      | Unmute Video        | Used as the text for the unmute video action            |
| transferblind    | Blind Transfer      | Used as the text for the start blind transfer action    |
| transferattended | Attended Transfer   | Used as the text for the start attended transfer action |
| transfercomplete | Transfer (complete) | Used as the text for the complete transfer action       |

## Configuration

| Name          | Type  | Default | Description                       |
| ------------- | ----- | ------- | --------------------------------- |
| renderTargets | array | []      | See [lwpRenderer](lwpRenderer.md) |

## Events

### Emitted

| Event               | Additional Parameters | Description                            |
| ------------------- | --------------------- | -------------------------------------- |
| callControl.created |                       | Emitted when the class is instantiated |

### Consumed

| Event                            | Reason                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------ |
| call.promoted                    | Invokes updateRenders() to show call controls relevant to the new primary call |
| call.primary.progress            | Invokes updateRenders() to show call controls relevant to the new call state   |
| call.primary.established         | Invokes updateRenders() to show call controls relevant to the new call state   |
| call.primary.hold                | Invokes updateRenders() to show call controls relevant to the new call state   |
| call.primary.unhold              | Invokes updateRenders() to show call controls relevant to the new call state   |
| call.primary.muted               | Invokes updateRenders() to show call controls relevant to the new call state   |
| call.primary.unmuted             | Invokes updateRenders() to show call controls relevant to the new call state   |
| call.primary.transfer.collecting | Invokes updateRenders() to show call controls relevant to the new call state   |
| call.primary.transfer.completed  | Invokes updateRenders() to show call controls relevant to the new call state   |
| call.primary.terminated          | Invokes updateRenders() to show call controls relevant to the new call state   |
| userAgent.call.failed            | Invokes updateRenders() re-enable any disable HTML elements                    |

## Default Template

### Data

### HTML
