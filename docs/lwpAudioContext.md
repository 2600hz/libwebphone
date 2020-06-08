# lwpAudioContext

The libwebphone audio context class contains all the functionality related to
the browsers
[AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext).
This is used to generate ringing audio, DTMF tones, and provide volume controls.

Ringing audio is created by modulating a generated sine wave, then cycling the
result between audible and muted.

Tones are created by creating an audio buffer containing the calculated values
of one or more sine wave frequencies provided as arguments at a sample rate of
8000 for the configured duration (channels.tone.duration). This audio buffer is
played then destroyed.

Volume controls are provided by controling a
[gain node](https://developer.mozilla.org/en-US/docs/Web/API/GainNode)
associated with each audio channel. The output of each channel can be connected
to a 'master' channel to provide a global volume control.

> There is no way to set the sinkId (destination device) of an AudioContext.
> Therefore, if we want to be able to change the output device we must pipe the
> AudioContext to an audio element, but maximum audio quality is achieved when
> directly outputing from the AudioContext. However, in chrome connecting the
> AudioContext to an audio html element causes a few audio issues. First if the
> sampleRate doesn't match it starts "detuning" the audio. Second it introduces
> weird timing slips (the remote stream as compared to playing in lwpCall audio
> elements drifts out of sync). Finally, despite the gain nodes multiplying by 1
> they seem to still clip audio that lwpCall audio elements don't. This
> implementation is a balance, non-critical audio will take the less ideal path
> to support output device selection and remote audio will be rendered in
> lwpCall (despite ideally handling it all in this audio graph).

This has been a very helpful page to getting better understanding of the
implementation details in the browsers: https://padenot.github.io/web-audio-perf

## Methods

#### startAudioContext()

For privacy and security browsers require users to interact with the document
before the AudioContext can be started. This method is automatically envoked
when audio is required (DTMF tones, ringing, ect) and starts the context as well
as the oscillators. It will do nothing if the AudioContext is already running.

#### startPreviewTone()

This method will start playing the configured preview tone
(channels.preview.tone). If the tone is already playing this method will do
nothing.

#### stopPreviewTone()

This method will stop playing the configured preview tone
(channels.preview.tone). If the tone is not already playing this method will do
nothing.

#### togglePreviewTone()

If the preview tone (channels.preview.tone) is playing this will stop the tone,
otherwise it will start the tone.

#### isPreviewToneActive()

Informs the invoker of the current preview tone playing status.

Return:

| Type    | Description                                   |
| ------- | --------------------------------------------- |
| boolean | If true the preview tone is currently playing |

#### startPreviewLoopback()

Starts playing any audio from the microphone back to the output device with a
delay (channels.preview.loopback). If the loopback audio is already playing this
method will do nothing.

#### stopPreviewLoopback()

This method will stop any loopback audio (channels.preview.loopback). If the
loopback audio is not already playing this method will do nothing.

#### togglePreviewLoopback()

If the loopback preview (channels.preview.loopback) is playing this will stop
it, otherwise the loopback audio will be started.

#### isPreviewLoopbackActive()

Informs the invoker of the current preview loopback playing status.

Return:

| Type    | Description                                       |
| ------- | ------------------------------------------------- |
| boolean | If true the preview loopback is currently playing |

#### stopPreviews()

Will stop all preview audio (loopback or tones) from playing.

#### getVolume(channel, options)

Informs the invoker of the current volume for a given channel.

| Name                     | Type    | Default | Description                                                                                  |
| ------------------------ | ------- | ------- | -------------------------------------------------------------------------------------------- |
| channel                  | string  |         | The name of the channel (master, ringer, tones, remote and preview)                          |
| options.scale            | boolean | true    | When true the returned volume is multipled by the volumeMax parameter to scale to an integer |
| options.relativeToMaster | boolean | false   | When true the returned volume reflects the channel as well as the current master volume      |

Return:

| Type             | Description                                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| float or integer | If the scale option is true an integer between volumeMin and volumeMax configuration properties is returned. If the scale option is false a float is returned between 0 and 1 |

#### changeVolume(channel, volume, options)

Sets the volume of the given channel.

| Name          | Type             | Default  | Description                                                                                                                                                                                                                            |
| ------------- | ---------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| channel       | string           |          | The name of the channel (master, ringer, tones, remote and preview)                                                                                                                                                                    |
| volume        | float or integer |          | If a float is provided it is expected to be between 0 and 1, options.scale should be false. If an integer is provided it is expected to be between the configured volumeMin and volumeMax parameters and options.scale should be true. |
| options.scale | boolean          | see note | When true the provided volume is divided by the volumeMax parameter to scale to a float                                                                                                                                                |

> options.scale defaults to true if its not provided and the volume is greater
> than 1, otherwise defaults to false.

#### playTones(...tones)

Generates and plays all provided frequencies (at the same time) for the
configured channels.tone.duration.

| Name  | Type    | Default | Description                                    |
| ----- | ------- | ------- | ---------------------------------------------- |
| tones | integer |         | The frequence of the tone to generate and play |

For example, a standard
[DTMF](https://en.wikipedia.org/wiki/Dual-tone_multi-frequency_signaling) for
the number 1 key would be:

```javascript
playTones(1209, 697);
```

#### startRinging(requestId)

When ringing is required this function will start the ringing audio. The provide
request id, or null, will be pushed to an array and ringing will continue until
that array is empty. This allows multiple calls or other functions to request
ringing start and end without causing overlapping ringing tones.

| Name      | Type   | Default | Description                                            |
| --------- | ------ | ------- | ------------------------------------------------------ |
| requestId | string | null    | The reference / request id that requires ringing audio |

> The request id is optional, but its good practice to use the call id.

#### stopRinging(requestId)

When ringing is no longer required, remove the request id from the array of
requestors. If the array is empty after this operation, stop all ringing audio.

| Name      | Type   | Default | Description                                            |
| --------- | ------ | ------- | ------------------------------------------------------ |
| requestId | string | null    | The reference / request id that requires ringing audio |

#### stopAllRinging()

Stops any ringing audio and resets the array of requestors.

#### getDestinationStream()

Get the output audio stream.

Returns:

| Type                                                                        | Description                           |
| --------------------------------------------------------------------------- | ------------------------------------- |
| [MediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream) | A MediaStream from the master channel |

media stream

#### updateRenders()

Re-paint / update all render targets.

## i18n

| Key           | Default (en)   | Description                                            |
| ------------- | -------------- | ------------------------------------------------------ |
| mastervolume  | Master Volume  | Used to label the master volume control element        |
| ringervolume  | Ringer Volume  | Used to label the ringing volume control element       |
| tonesvolume   | Tones Volume   | Used to label the DTMF (tones) volume control element  |
| previewvolume | Preview Volume | Used to label the preview volume control element       |
| remotevolume  | Call Volume    | Used to label the remote (call) volume control element |

## Configuration

| Name                                | Type     | Default | Description                                                                                                                                          |
| ----------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| channels.master.show                | boolean  | true    | Should the default template show the master volume control                                                                                           |
| channels.master.volume              | float    | 1.0     | The initial volume of the master audio, where 0 is muted and 1 is 100%                                                                               |
| channels.ringer.show                | boolean  | true    | Should the default template show the ringing volume control                                                                                          |
| channels.ringer.volume              | float    | 1.0     | The initial volume of the ringing audio, where 0 is muted and 1 is 100%                                                                              |
| channels.ringer.connectToMaster     | boolean  | true    | Should the ringing audio play through the master channel                                                                                             |
| channels.ringer.onTime              | float    | 1.5     | Duration, in seconds, the ringing sound should be audible each cycle                                                                                 |
| channels.ringer.offTime             | float    | 1.0     | Duration, in seconds, the ringing sound should be muted each cycle                                                                                   |
| channels.ringer.carrier.frequency   | float    | 440     | Frequency of the ringing sound generator carrier                                                                                                     |
| channels.ringer.modulator.frequency | float    | 10      | Frequency of the ring sound generator volume modulator                                                                                               |
| channels.ringer.modulator.amplitude | float    | 0.75    | The amount the modulator should change the carrier volume, where 0 is none and 1 is 100%                                                             |
| channels.tones.show                 | boolean  | true    | Should the default template show the DTMF playback tones volume control                                                                              |
| channels.tones.volume               | float    | 0.15    | The initial volume of the DTMF playback tones                                                                                                        |
| channels.tones.duration             | float    | 0.15    | Duration, in seconds, that the DTMF playback tones should be audible for                                                                             |
| channels.tones.connectToMaster      | boolean  | true    | Should the DTMF playback tones play through the master channel                                                                                       |
| channels.remote.show                | boolean  | true    | Should the default template show the remote (call) volume                                                                                            |
| channels.remote.volume              | float    | 1.0     | The initial volume of any remote audio (call)                                                                                                        |
| channels.remote.connectToMaster     | boolean  | false   | Should the remote audio (calls) play through the master channel                                                                                      |
| channels.preview.show               | boolean  | true    | Should the default template show the preview volume                                                                                                  |
| channels.preview.volume             | float    | 1.0     | The initial volume of any preview audio                                                                                                              |
| channels.preview.connectToMaster    | boolean  | false   | Should the preview audio play through the master channel                                                                                             |
| channels.preview.loopback.delay     | float    | 0.5     | Duration, in seconds, to delay the microphone audio when the loopback preview is playing                                                             |
| channels.preview.tone.frequency     | integer  | 440     | The frequency of the preview tone                                                                                                                    |
| channels.preview.tone.duration      | integer  | 1.5     | The duration, in seconds, to play the preview tone                                                                                                   |
| channels.preview.tone.type          | string   | sine    | The waveform type to generate (sine, square, sawtooth, triangle)                                                                                     |
| globalKeyShortcuts                  | boolean  | true    | Should the event listeners in the 'keys' property be added to the document                                                                           |
| keys.arrowup.enabled                | boolean  | true    | If true, and globalKeyShortcuts is also true, preform keys.arrowup.action if the up arrow is pressed when the body of the document has the focus     |
| keys.arrowup.action                 | function |         | By default this callback increases the master volume by 5% (0.05)                                                                                    |
| keys.arrowdown.enabled              | boolean  | true    | If true, and globalKeyShortcuts is also true, preform keys.arrowdown.action if the down arrow is pressed when the body of the document has the focus |
| keys.arrowdown.action               | function |         | By default this callback decreases the master volume by 5% (0.05)                                                                                    |
| volumeMax                           | integer  | 100     | The maximum value when converting the volume between floats and integers                                                                             |
| volumeMin                           | integer  | 0       | The minimum value when converting the volume between floats and integers                                                                             |
| renderTargets                       | array    | []      | See lwpRenderer                                                                                                                                      |

## Events

### Emitted

| Event                                 | Additional Parameters            | Description                                                            |
| ------------------------------------- | -------------------------------- | ---------------------------------------------------------------------- |
| audioContext.created                  |                                  | Emitted when the class is instantiated                                 |
| audioContext.started                  |                                  | Emitted when the AudioContext is started                               |
| audioContext.preview.tone.started     |                                  | Emitted when the preview tones are started                             |
| audioContext.preview.tone.stopped     |                                  | Emitted when the preview tones are stopped                             |
| audioContext.preview.loopback.started |                                  | Emitted when the preview loopback audio is started                     |
| audioContext.preview.loopback.stopped |                                  | Emitted when the preview loopback audio is stopped                     |
| audioContext.channel.master.volume    | volume (integer between 0 and 1) | Emitted when the master channel volume is updated                      |
| audioContext.channel.ringer.volume    | volume (integer between 0 and 1) | Emitted when the ringer channel volume is updated                      |
| audioContext.channel.tones.volume     | volume (integer between 0 and 1) | Emitted when the tones channel volume is updated                       |
| audioContext.channel.remote.volume    | volume (integer between 0 and 1) | Emitted when the remote channel volume is updated                      |
| audioContext.channel.preview.volume   | volume (integer between 0 and 1) | Emitted when the preview channel volume is updated                     |
| audioContext.stream.local.changed     | volume (integer between 0 and 1) | Emitted when the stream used for the preview loopback audio is updated |
| audioContext.stream.remote.changed    | volume (integer between 0 and 1) | Emitted when the stream used for the remote audio is updated           |

### Consumed

| Event                                   | Reason                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------- |
| call.ringing.started                    | Invokes startRinging() with the call's id                                 |
| call.ringing.stopped                    | Invokes stopRinging() with the call's id                                  |
| call.primary.remote.audio.added         | Updates the remote source stream                                          |
| call.primary.remote.mediaStream.connect | Updates the remote source stream                                          |
| dialpad.tones.play                      | Invokes playTones                                                         |
| mediaDevices.streams.started            | Updates the local source stream                                           |
| mediaDevices.streams.stopped            | Removes the local source stream                                           |
| mediaDevices.audio.input.changed        | Updates the local source stream                                           |
| keydown                                 | Used to detect key presses on the document for the shortcut functionality |
| audioContext.channel.master.volume      | Invokes updateRenders() to show the new value                             |
| audioContext.channel.ringer.volume      | Invokes updateRenders() to show the new value                             |
| audioContext.channel.tones.volume       | Invokes updateRenders() to show the new value                             |
| audioContext.channel.preview.volume     | Invokes updateRenders() to show the new value                             |
| audioContext.channel.remote.volume      | Invokes updateRenders() to show the new value                             |

## Default Template

### Data

### HTML
