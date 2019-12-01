import { assureMediaInputId } from './media-device-id';

describe('when the main function for input id assurance is called', () => {
  const resolvedEnumeratedMediaDevicesWithoutLabels = [
    {"deviceId":"default","kind":"audioinput","label":"","groupId":"4b198c199061233e5598cedd756d9ee8283ada51251c1496867d5638357e45da"},
    {"deviceId":"9f1496a1a513f585ff31c905d4c6d7e2e3666ff4549c02737f8e3b50c78f6f07","kind":"audioinput","label":"","groupId":"4b198c199061233e5598cedd756d9ee8283ada51251c1496867d5638357e45da"},
    {"deviceId":"19e6d0cf78bdd143bd2e44552c14ee2ade1caa57065b9ee84c8b1d62d42a6f40","kind":"audioinput","label":"","groupId":"11fc9f46617fb20733dcbb7f9376735ea690673eaa696637ffd975c448936acc"},
    {"deviceId":"b81a871b37a252b3bd328cd34f2c3c6894b5c974bcac7d9c1b16b9ae70057e56","kind":"videoinput","label":"","groupId":"c75938422f365906c44ec2c694184c4c0c7bb0602de2831827abe1e822cadd60"},
    {"deviceId":"74d73f02908d48383ea6693d38965df28ddfd13f577a9a817263fa76699008de","kind":"videoinput","label":"","groupId":"11fc9f46617fb20733dcbb7f9376735ea690673eaa696637ffd975c448936acc"},
    {"deviceId":"default","kind":"audiooutput","label":"","groupId":"4b198c199061233e5598cedd756d9ee8283ada51251c1496867d5638357e45da"},
    {"deviceId":"b6ceafa281fb2f90ddfc778661ed8fd45433ecef972a6ceb54cbc9cc13c7a43b","kind":"audiooutput","label":"","groupId":"4b198c199061233e5598cedd756d9ee8283ada51251c1496867d5638357e45da"},
  ];

  const resolvedEnumeratedMediaDevices = [
    {"deviceId":"default","kind":"audioinput","label":"Default - External Microphone (Built-in)","groupId":"83ef347b97d14abd837e8c6dbb819c5be84cfe0756dd41455b375cfd4c0ddb4f"},
    {"deviceId":"c3d0a4cb47f5efd7af14c2c3860d12f0199042db6cbdf0c690c38644a24a6ba7","kind":"audioinput","label":"External Microphone (Built-in)","groupId":"83ef347b97d14abd837e8c6dbb819c5be84cfe0756dd41455b375cfd4c0ddb4f"},
    {"deviceId":"9835a03c796ae6c6bf81164414340357334bf9545a87e9ec4c25f6896338a4fb","kind":"audioinput","label":"Unknown USB Audio Device (046d:0825)","groupId":"67a612f4ac80c6c9854b50d664348e69b5a11421a0ba8d68e2c00f3539992b4c"},
    {"deviceId":"2060bf50ab9c29c12598bf4eafeafa71d4837c667c7c172bb4407ec6c5150206","kind":"videoinput","label":"FaceTime HD Camera","groupId":"72e8ab9444144c3f8e04276a5801e520e83fc801702a6ef68e9e344083f6f6ce"},
    {"deviceId":"91429d45c2acf42ebd0f2c208aaed929517b20a57421a778cfbd7c065750b239","kind":"videoinput","label":"USB Camera (046d:0825)","groupId":"67a612f4ac80c6c9854b50d664348e69b5a11421a0ba8d68e2c00f3539992b4c"},
    {"deviceId":"default","kind":"audiooutput","label":"Default - Headphones (Built-in)","groupId":"83ef347b97d14abd837e8c6dbb819c5be84cfe0756dd41455b375cfd4c0ddb4f"},
    {"deviceId":"45a9a69e28bcf77ab14092ccff118379930d4ae1c064321a8dbd30bc7d0482f5","kind":"audiooutput","label":"Headphones (Built-in)","groupId":"83ef347b97d14abd837e8c6dbb819c5be84cfe0756dd41455b375cfd4c0ddb4f"}, 
  ];

  beforeAll(() => {
    if (!navigator || !navigator.mediaDevices) {
      global.navigator = {};
      global.navigator.mediaDevices = {};
    }
  });

  test('video device id is being assured even if id fails', () => {
    navigator
      .mediaDevices
      .enumerateDevices
      = jest.fn(() => Promise.resolve(resolvedEnumeratedMediaDevices));
    const realLabel = 'FaceTime HD Camera';
    const invalidId = 'an-invalid-id-here';
    const realId = '2060bf50ab9c29c12598bf4eafeafa71d4837c667c7c172bb4407ec6c5150206';
    expect(assureMediaInputId(realLabel, invalidId))
      .resolves.toEqual(realId);
  });

  test('error is throwed if both label and ids are useless to assure', () => {
    navigator
      .mediaDevices
      .enumerateDevices
      = jest.fn(() => Promise.resolve(resolvedEnumeratedMediaDevices));
    const invalidLabel = 'Not a real device';
    const invalidId = 'an-also-invalid-id';
    expect(assureMediaInputId(invalidLabel, invalidId))
      .rejects.toEqual('Could not assure device, not found by label nor id');
  });

  test('when labels are unavailable, throws error if id fails', () => {
    navigator
      .mediaDevices
      .enumerateDevices
      = jest.fn(() => Promise.resolve(resolvedEnumeratedMediaDevicesWithoutLabels));
    const realLabel = 'FaceTime HD Camera';
    const invalidId = 'an-invalid-id-again';
    expect(assureMediaInputId(realLabel, invalidId))
      .rejects.toEqual('Could not assure device, id is wrong and labels are unavailable');
  });

  test('when labels are unavailable, but can assure if id is ok', () => {
    navigator
      .mediaDevices
      .enumerateDevices
      = jest.fn(() => Promise.resolve(resolvedEnumeratedMediaDevicesWithoutLabels));
    const noLabel = '';
    const realId = 'b81a871b37a252b3bd328cd34f2c3c6894b5c974bcac7d9c1b16b9ae70057e56';
    expect(assureMediaInputId(noLabel, realId))
      .resolves.toEqual(realId);
  });

  test('only input devices shall be returned', () => {
    navigator.mediaDevices.enumerateDevices = jest.fn(() => Promise.resolve([
      { deviceId: 'fake-id', kind: 'audiooutput', label: '' },
      { deviceId: 'fake-id', kind: 'crazyio', label: '' },
    ]));
    expect(assureMediaInputId('', 'fake-id'))
      .rejects.toEqual('Could not assure device, not found by label nor id');
  });

  test('dont silence navigator original errors', () => {
    const errorFromNavigator = new Error('Mocked error from navigator');
    navigator
      .mediaDevices
      .enumerateDevices
      = jest.fn(() => Promise.reject(errorFromNavigator));
    expect(assureMediaInputId('no-op', 'no-op'))
      .rejects.toEqual(String(errorFromNavigator));
  });

  test('if provided, the default param will be returned instead of throwing an error', () => {
    navigator
      .mediaDevices
      .enumerateDevices
      = jest.fn(() => Promise.resolve(resolvedEnumeratedMediaDevices));
    expect(assureMediaInputId('no-op', 'no-op', 'none'))
      .resolves.toEqual('none');
  });
});

