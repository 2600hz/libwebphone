# lwpDialpad

> NOTE! It is not expected that an instance of this class be created outside of the libwebphone interals. To access this instance use the libwebphone instance method `getCallList()`. If you are unfamiliar with the structure of libwebphone its highly recommended you [start here](/README.md).

The libwebphone dialpad class is responsisble for collecting a target for either
a new call or transfer. In addition, when appropriate the dialed characters are
sent as DTMF on the primary call. Additionally, the class provides a means to
have a single button (autoAction) that executes the minimum call control
features.

The filter can be enabled to remove any non-number characters when executing a
new call or transfer. Further, the convert option can be enabled to convert any
letters to numbers as they would map on a standard dialpad.

## Methods

#### dial(char, tones)

| Name  | Type                         | Default | Description                                                                                                                                                   |
| ----- | ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| char  | character or integer         |         | The dialed character                                                                                                                                          |
| tones | array of integers or boolean | true    | If true, and the char has a corresponding tone in the configuration play that tone. If false, don't play any tones. If an array use that as the tones to play |

Add a character to the end of the target if there is no primary call or the
primary call is preforming a transfer. Otherwise the char is sent as DTMF on the
active call and not added to the target.

#### backspace()

Remove the last character of the current target.

#### clear()

Remove all characters in the current target.

#### enableFilter()

Set the configuration option to enable the filter feature.

#### disableFilter()

Clear the configuration option to disable the filter feature.

#### toggleFilter()

If the filter feature is currently enabled, disable it. If the filter feature is
currently disabled, enabled it.

#### enableConvertion()

Set the configuration option to enable the convertion feature.

#### disableConvertion()

Clear the configuration option to disable the convertion feature.

#### toggleConvertion()

If the convertion feature is currently enabled, disable it. If the convertion
feature is currently disabled, enabled it.

#### getTarget(clear, join)

| Name  | Type    | Default | Description                                                                      |
| ----- | ------- | ------- | -------------------------------------------------------------------------------- |
| clear | boolean | false   | If true, clears the current target and returns the value                         |
| join  | boolean | true    | If true, returns the target as a string otherwise returns an array of characters |

If the dialpad convertion is enabled any letters that correspond to a standard
dialpad are first converted to numbers. Then, if the filter feature is enabled
any non-number characters in the target are removed. This value is returned as a
string or array depending on the value of the join argument, and the current
target cleared depending on the clear argument.

Returns:

| Type                          | Description                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| string or array of characters | If the join argument is true, a string is returned otherwise an array of characters representing the current target |

#### hasTarget()

Informs the invoker if there is one or more elements in the current target.

Returns:

| Type    | Description                                     |
| ------- | ----------------------------------------------- |
| boolean | True when the target array one or more elements |

#### answer()

Answers the primary call.

#### call(redial)

| Name   | Type    | Default | Description                                                                                                                 |
| ------ | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| redial | boolean | true    | If true and there isn't currently a target execute a redial. If false and there isn't currently a target ignore the request |

Starts a new call to the current target or optionally a redial if no target has
been collected.

#### redial()

Starts a new call to the last dialed number.

#### transer()

Start collecting a transfer target or complete a transfer to the collected
target.

#### terminate()

Terminate the primary call.

#### autoAction(options)

| Name              | Type    | Default | Description                                         |
| ----------------- | ------- | ------- | --------------------------------------------------- |
| options.answer    | boolean | true    | If true, allow the autoAction to answer the call    |
| options.redial    | boolean | true    | If true, allow the autoAction to redial the call    |
| options.call      | boolean | true    | If true, allow the autoAction to call the call      |
| options.transfer  | boolean | true    | If true, allow the autoAction to transfer the call  |
| options.terminate | boolean | true    | If true, allow the autoAction to terminate the call |

This will determine the most logical action to take on the primary call using
getAutoAction, and if that action has not been disabled by the options argument
then execute it.

#### getAutoAction()

Determines the most logical action to take on the primary call.

If there is no primary call and no target has been collected the action will be
redial.

If there is no primary call and the target has one or more elemenets the action
will be to call.

If the primary call is in a transfer the action will be to transfer.

If the primary call is not established and its direction is terminating the
action will be to answer.

Any other condition will be to terminate.

| Type   | Description                                                                              |
| ------ | ---------------------------------------------------------------------------------------- |
| string | The autoAction to take on the primary call (redial, call, transfer, answer or terminate) |

#### updateRenders()

Re-paint / update all render targets.

## i18n

| Key           | Default (en) | Description                                     |
| ------------- | ------------ | ----------------------------------------------- |
| one           | 1            | Used as the text for the dialpad one button     |
| two           | 2            | Used as the text for the dialpad two button     |
| three         | 3            | Used as the text for the dialpad three button   |
| four          | 4            | Used as the text for the dialpad four button    |
| five          | 5            | Used as the text for the dialpad five button    |
| six           | 6            | Used as the text for the dialpad six button     |
| seven         | 7            | Used as the text for the dialpad seven button   |
| eight         | 8            | Used as the text for the dialpad eight button   |
| nine          | 9            | Used as the text for the dialpad nine button    |
| astrisk       | \*           | Used as the text for the dialpad astrisk button |
| zero          | 0            | Used as the text for the dialpad zero button    |
| pound         | #            | Used as the text for the dialpad pound button   |
| clear         | clear        | Used as the text for the clear action           |
| backspace     | <-           | Used as the text for the backspace action       |
| call          | Call         | Used as the text for the call action            |
| transfer      | Transfer     | Used as the text for the transfer action        |
| enableconvert | A -> #       | Used as the text for the enable convert action  |
| disableconvre | A -> A       | Used as the text for the disable convert action |
| enablefilter  | # Only       | Used as the text for the enable filter action   |
| disablefilter | Any          | Used as the text for the disable filter action  |

## Configuration

| Name                   | Type     | Default     | Description                                                                                                                                                     |
| ---------------------- | -------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dialed.show            | boolean  | true        | Should the default template show the current target                                                                                                             |
| dialed.backspace.show  | boolean  | true        | Should the default template show the backspace action (requires dialed.show)                                                                                    |
| dialed.clear.show      | boolean  | true        | Should the default template show the clear action (requires dialed.show)                                                                                        |
| dialed.filter.show     | boolean  | true        | Should the default template show the enable/disable filter action (requires dialed.show)                                                                        |
| dialed.filter.enabled  | boolean  | true        | Should the filter initially be enabled                                                                                                                          |
| dialed.convert.show    | boolean  | true        | Should the default template show the enable/disable convert action (requires dialed.show)                                                                       |
| dialed.convert.enabled | boolean  | false       | Should the converter initially be enabled                                                                                                                       |
| controls.show          | boolean  | true        | Should the default template show the call controls                                                                                                              |
| controls.call.show     | boolean  | true        | Should the default template show the autoAction action                                                                                                          |
| controls.transfer.show | boolean  | true        | Should the default template show the transfer action                                                                                                            |
| dialpad.show           | boolean  | true        | Should the default template show the dialpad                                                                                                                    |
| tones.one              | array    | [1209, 697] | Frequencies to use as the DTMF playback when 1 is dialed                                                                                                        |
| tones.two              | array    | [1336, 697] | Frequencies to use as the DTMF playback when 2 is dialed                                                                                                        |
| tones.three            | array    | [1477, 697] | Frequencies to use as the DTMF playback when 3 is dialed                                                                                                        |
| tones.four             | array    | [1209, 770] | Frequencies to use as the DTMF playback when 4 is dialed                                                                                                        |
| tones.five             | array    | [1336, 770] | Frequencies to use as the DTMF playback when 5 is dialed                                                                                                        |
| tones.six              | array    | [1477, 697] | Frequencies to use as the DTMF playback when 6 is dialed                                                                                                        |
| tones.seven            | array    | [1209, 852] | Frequencies to use as the DTMF playback when 7 is dialed                                                                                                        |
| tones.eight            | array    | [1336, 852] | Frequencies to use as the DTMF playback when 8 is dialed                                                                                                        |
| tones.nine             | array    | [1477, 852] | Frequencies to use as the DTMF playback when 9 is dialed                                                                                                        |
| tones.astrisk          | array    | [1209, 941] | Frequencies to use as the DTMF playback when \* is dialed                                                                                                       |
| tones.zero             | array    | [1336, 941] | Frequencies to use as the DTMF playback when 0 is dialed                                                                                                        |
| tones.pound            | array    | [1477, 941] | Frequencies to use as the DTMF playback when # is dialed                                                                                                        |
| globalKeyShortcuts     | boolean  | true        | Should the event listeners in the 'keys' property be added to the document                                                                                      |
| keys.enter.enabled     | boolean  | true        | If true, and globalKeyShortcuts is also true, preform keys.enter.action if the enter key is pressed when the body of the document has the focus                 |
| keys.enter.action      | function |             | By default this callback executes the current autoAction except for terminate                                                                                   |
| keys.escape.enabled    | boolean  | true        | If true, and globalKeyShortcuts is also true, preform keys.escape.action if the escape key is pressed when the body of the document has the focus               |
| keys.escape.action     | function |             | By default this callback terminates the primary call                                                                                                            |
| keys.backspace.enabled | boolean  | true        | If true, and globalKeyShortcuts is also true, preform keys.backspace.action if the backspace key is pressed when the body of the document has the focus         |
| keys.backspace.action  | function |             | By default this callback removes one character from the end of the current target                                                                               |
| keys.dtmf.enabled      | boolean  | true        | If true, and globalKeyShortcuts is also true, preform keys.dtmf.action if a dtmf character key is pressed ([0-9#*]) when the body of the document has the focus |
| keys.dtmf.action       | function |             | By default this callback adds the pressed character to the target                                                                                               |
| renderTargets          | array    | []          | See [lwpRenderer](lwpRenderer.md)                                                                                                                               |

## Events

### Emitted

| Event                    | Additional Parameters                       | Description                                          |
| ------------------------ | ------------------------------------------- | ---------------------------------------------------- |
| dialpad.created          |                                             | Emitted when the class is instantiated               |
| dialpad.tones.play       | tones (array of integers)                   | Emitted when DTMF playback tones should be generated |
| dialpad.target.updated   | target (array of strings), char (character) | Emitted when a new character is added to the target  |
| dialpad.target.backspace | target (array of strings)                   | Emitted when a character is removed from the target  |
| dialpad.target.clear     | target (array of strings)                   | Emitted when the target is cleared / reset           |
| dialpad.filter.enabled   |                                             | Emitted when the filter is enabled                   |
| dialpad.filter.disabled  |                                             | Emitted when the filter is disabled                  |
| dialpad.convert.enabled  |                                             | Emitted when the converter is enabled                |
| dialpad.convert.disabled |                                             | Emitted when the converter is disabled               |
| dialpad.call             | target (string)                             | Emitted when the dialpad call action is invoked      |
| dialpad.redial           |                                             | Emitted when the dialpad redial action is invoked    |

### Consumed

| Event                            | Reason                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| call.primary.transfer.collecting | Invokes the clear() method to reset the target and start collecting the transfer target |
| call.primary.transfer.complete   | Invokes the clear() to clear the target now that the transfer is complete               |
| callList.calls.changed           | Invokes updateRenders() to update the autoAction button                                 |

## Default Template

### Data

### HTML
