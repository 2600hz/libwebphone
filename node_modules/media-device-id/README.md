# media-device-id

Assure retrieving your correct media device ID using browser's WebRTC API
(very useful to handle Safari issue which changes the devices IDs after route transitions or page reloadings).

## Use case

In WebRTC related apps, it's common to ask the user for which media devices it wants to use and
developers store the id of the selected device. On Safari, however, such id outdates when the
browser route changes. So, basically, if you store the selected id now, then on the next page it
will be useless.

> Read more about this and other Safari issues at: https://webrtchacks.com/guide-to-safari-webrtc/

This lib is simply to assure that such behaviour is not an issue for you.

## Usage example

Make sure you store the user selected device **label** (not only the **id**).

```js
import { assureMediaInputId } from 'media-device-id';

const constantLabel = 'FaceTime HD Camera';
const outdatedId = '2060bf50ab9c29c12598bf4eafeafa71d4837c667c7c172bb4407ec6c5150206';

assureMediaInputId(constantLabel, outdatedId).then((currentId) => {
  console.log('the current device id for', constantLabel, 'is now', currentId);
});
```

## Some expected behaviours

All tested by [./media-device-id.test.js](./media-device-id.test.js):
- if both error is throwed if both label and ids are useless to assure a correct id
- when labels are unavailable, throws error if id fails
- only input devices shall be returned
- if provided, the default parameter will be returned instead of throwing an error

## Interface

```js
async function assureMediaInputId(label, possibleId, fallbackId) {
  // ...
}
```
