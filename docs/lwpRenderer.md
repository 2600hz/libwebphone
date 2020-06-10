# lwpRenderer

> NOTE! It is not expected that an instance of this class be created outside of the libwebphone interals. If you are unfamiliar with the structure of libwebphone its highly recommended you [start here](/README.md).

The library uses a bespoke solution to render HTML elements, implemented in [lwpRenderer.js](src/lwpRenderer.js). This render engine is simple, lightweight and functional. While suited to production environments larger implementations may choose to leave the `renderTargets` unconfigured and build deeper (more suited) integrations with their framework of choice. If you would like to share your implementation for your favorite framework we would welcome that pull-request! :)

To keep the render engine simple, every render fully replaces all elements previously rendered (`render.root.element.innerHTML = render.html;`). This can cause issues if external scripts or libraries are attempting to interact with the generated HTML elements. However, the most common use-cases for such interaction can be achieved via proper configuration of the built in render engine.

## Methods

Classes that extend this class have two additional methods detailed below and by convention have a `updateRenders()` function that will update the data available to the template then call the `render()` method.

#### renderAddTarget(config)

Will add a new render target which will be automatically updated based on the component and the provide configuration object (as described above).

#### render(premodifier, postmodifier)

Will re-render all render targets. Premodifer is a function that is provided with the render configuration of a render target prior to updating the root element. Postmodifier is a function that is provided with the render configuration after a root element is updated. This function returns an array of all render configurations updated.

## Configuration

Classes that extend this class have the common configuration option `renderTargets` which is expected to be a list of strings, assuming each to be the ID of a existing HTML element.

For advanced configuration rather than providing a renderTarget as a string, or when using the `renderAddTarget(config)` below, advanced functionality can be achieved by providing the following configuration:

| Name           | Type        | Description                                                                                                           |
| -------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| template       | string      | A [mustache](https://github.com/Mustache/Mustache) template.                                                          |
| i18n           | object      | A dictionary of names to be used in the template to namespaced i18n keys                                              |
| root.elementId | string      | The id of an existing element to be used as the root of the render (if no root.element is provided)                   |
| root.element   | HTMLElement | The HTML element used as the root of the render, found via `document.getElementById(root.elementId)` if not provided. |
| by_id          | object      | An object that provides parameters for elements in the template that work via element ids                             |
| by_name        | object      | An object that provides parameters for elements in the template that work via element names                           |

If no template is provide in a render configuration the default template of the component is used, these are detailed on the documentation for the component.

The `by_id` object properties will expose a pre-configured or uniquely generated if not provided, element id to the template. In addition, optional event handlers can be configured for each element and bound using the results of `getElementById(id)`

The `by_name` object works exactly as `by_id` except it uses `getElementsByName(name)`.

For example, consider the following render configuration:

```javascript
{
   "template":"{{^data.call.hasSession}} <button id=\"{{by_id.redial.elementId}}\"> {{i18n.redial}} ({{data.redial}}) </button> {{/data.call.hasSession}}",
   "root":{
      "elementId":"redial_button"
   },
   "by_id":{
      "redial":{
         "events":{
            onclick: (event) => {
              const element = event.srcElement;
              element.disabled = true;
              this.redial();
            },
         }
      }
   }
}
```

When rendered this will replace the inner HTML of an element on the document with the id "redial_button" with the result of rendering the template.

The `i18n` properties used in the template are the currently translated language strings for that component and provided automatically. By default each component has a unique list (see the component's i18n documentation) but can be changed in the render configuration. For example, if the configuration contained the following `'i18n': { 'foobar': 'libwebphone:callControl.foobar' }` the template could reference `{{i18n.foobar}}` and it would be the string from the i18n bundles in the current language. If a render config sets the i18n option those will be the only translated strings available to template altho it can redefine and extend the existing default dictionary if access to the default translations are required. Further, and non-default i18n keys will need to be added by external sources to the language bundles.

The `data` properties are similarly automatic and unique to the components. Each `data` property is a clone of the current configuration agumented with real-time data as required (see the component's documentation for template data definitions). In our example, we assume it the component will provide `data.call.hasSession` as a boolean determining if the current call has a session. This is used to hide the redial button when the call is active. Futher assumed the component is providing `data.redial` which is the last dialed number.

The template also uses `{{by_id.redial.elementId}}`. It is possible to configure the render with a static id for the redial button using the configuration `'by_id': { 'redial' : { 'elementId': 'static_id'}, 'events': { ...} }`. However, if missing a unquie id will be generated. For the element in the template that is using the id any events are bound. This is accomplished by using the property name of the events to add a callback function. In this example, it will add a 'onclick' handler to the element using the id generated for the "redial" object.

## Events

### Emitted

> NOTE! These will be prefixed with the class (component)! For example, `mediaDevices.render.ready`.

| Name            | Additional Parameters                                 | Description                                                |
| --------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| render.ready    |                                                       | Both the i18n and document are ready                       |
| render.new      | renderConfig (configuration of the new render target) | Emitted when a new render target is added                  |
| render.rendered | renderedConfigs (array of render configurations)      | Emitted when all render targets of a component are updated |
