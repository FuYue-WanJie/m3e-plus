# @wanjie/m3e-web/button-group

The `m3e-button-group` component arranges multiple into a unified, expressive layout, supporting both `standard` and `connected` variants. It enables seamless, accessible grouping of actions, adapts to various sizes, and ensures consistent spacing, shape, and alignment. Designed according to Material 3 principles, it empowers users to interact with related actions in a visually harmonious and intuitive way.

```ts
import "@wanjie/m3e-web/button-group";
```

## 🗂️ Elements

- `m3e-button-group` — Organizes buttons and adds interactions between them.

## 🧪 Examples

The following example illustrates a standard button group.

```html
<m3e-button-group>
  <m3e-icon-button variant="tonal" toggle><m3e-icon name="format_bold"></m3e-icon></m3e-icon-button>
  <m3e-icon-button variant="tonal" toggle><m3e-icon name="format_italic"></m3e-icon></m3e-icon-button>
  <m3e-icon-button variant="tonal" toggle><m3e-icon name="format_underlined"></m3e-icon></m3e-icon-button>
</m3e-button-group>
```

The next example illustrates a connected button group.

```html
<m3e-button-group variant="connected">
  <m3e-button variant="tonal" shape="square" toggle>Start</m3e-button>
  <m3e-button variant="tonal" shape="square" toggle>Directions</m3e-button>
  <m3e-button variant="tonal" shape="square" toggle>Share</m3e-button>
</m3e-button-group>
```

## 📖 API Reference

This section details the attributes, slots, and CSS custom properties available for the `m3e-button-group` component.

### ⚙️ Attributes

| Attribute | Type                                                               | Default      | Description                                      |
| --------- | ------------------------------------------------------------------ | ------------ | ------------------------------------------------ |
| `multi`   | `boolean`                                                          | `false`      | Whether multiple toggle buttons can be selected. |
| `overflow` | `boolean`                                                         | `false`      | Whether buttons that do not fit the group's width collapse into a trailing "more options" menu (an anchored `m3e-menu` behind a `more_vert` indicator). |
| `size`    | `"extra-small" \| "small" \| "medium" \| "large" \| "extra-large"` | `"small"`    | The size of the group.                           |
| `variant` | `"standard" \| "connected"`                                        | `"standard"` | The appearance variant of the group.             |

### 🧩 Slots

| Slot        | Description                       |
| ----------- | --------------------------------- |
| _(default)_ | Renders the buttons of the group. |

### 🎛️ CSS Custom Properties

| Property                                                       | Description                                       |
| -------------------------------------------------------------- | ------------------------------------------------- |
| `--m3e-standard-button-group-extra-small-spacing`              | Spacing between buttons in standard, extra-small. |
| `--m3e-standard-button-group-small-spacing`                    | Spacing between buttons in standard, small.       |
| `--m3e-standard-button-group-medium-spacing`                   | Spacing between buttons in standard, medium.      |
| `--m3e-standard-button-group-large-spacing`                    | Spacing between buttons in standard, large.       |
| `--m3e-standard-button-group-extra-large-spacing`              | Spacing between buttons in standard, extra-large. |
| `--m3e-connected-button-group-spacing`                         | Spacing between buttons in connected variant.     |
| `--m3e-connected-button-group-extra-small-inner-shape`         | Corner shape for connected, extra-small.          |
| `--m3e-connected-button-group-extra-small-inner-pressed-shape` | Pressed corner shape for connected, extra-small.  |
| `--m3e-connected-button-group-small-inner-shape`               | Corner shape for connected, small.                |
| `--m3e-connected-button-group-small-inner-pressed-shape`       | Pressed corner shape for connected, small.        |
| `--m3e-connected-button-group-medium-inner-shape`              | Corner shape for connected, medium.               |
| `--m3e-connected-button-group-medium-inner-pressed-shape`      | Pressed corner shape for connected, medium.       |
| `--m3e-connected-button-group-large-inner-shape`               | Corner shape for connected, large.                |
| `--m3e-connected-button-group-large-inner-pressed-shape`       | Pressed corner shape for connected, large.        |
| `--m3e-connected-button-group-extra-large-inner-shape`         | Corner shape for connected, extra-large.          |
| `--m3e-connected-button-group-extra-large-inner-pressed-shape` | Pressed corner shape for connected, extra-large.  |
| `--m3e-connected-button-group-[size]-outer-shape`              | Outer corner shape for the leading/trailing buttons in a connected group. |
| `--m3e-button-group-overflow-indicator-background`             | Overflow indicator background color.              |
| `--m3e-button-group-overflow-indicator-color`                  | Overflow indicator icon color.                    |
