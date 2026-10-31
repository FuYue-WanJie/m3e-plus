# @wanjie/m3e-web/shape

The `m3e-shape` component allows you to use abstract shapes thoughtfully to add emphasis and decorative flair, including built-in shape morphing.

All shapes are sourced from the Material Shape library: `4-leaf-clover`, `4-sided-cookie`, `6-sided-cookie`, `7-sided-cookie`, `8-leaf-clover`, `9-sided-cookie`, `12-sided-cookie`, `arch`, `arrow`, `boom`, `bun`, `burst`, `circle`, `clamshell`, `diamond`, `fan`, `flower`, `gem`, `ghost-ish`, `heart`, `oval`, `pentagon`, `pill`, `pixel-circle`, `pixel-triangle`, `puffy`, `puffy-diamond`, `semicircle`, `slanted`, `soft-boom`, `soft-burst`, `square`, `sunny`, `triangle`, and `very-sunny`.

Refer to the Material Shape library for visual references and details.

```ts
import "@wanjie/m3e-web/shape";
```

## 🗂️ Elements

- `m3e-shape` — A shape used to add emphasis and decorative flair.

## 🧪 Examples

The following example illustrates using the `m3e-shape` component to present the `sunny` shape.

```html
<m3e-shape name="sunny"></m3e-shape>
```

## 📖 API Reference

This section details the attributes, slots and CSS custom properties available for the `m3e-shape` component.

### ⚙️ Attributes

| Attribute | Type                | Default | Description            |
| --------- | ------------------- | ------- | ---------------------- |
| `name`    | `ShapeName \| null` | `null`  | The name of the shape. |

### 🧩 Slots

| Slot        | Description                               |
| ----------- | ----------------------------------------- |
| _(default)_ | Renders the clipped content of the shape. |

### 🎛️ CSS Custom Properties

| Property                      | Description                                |
| ----------------------------- | ------------------------------------------ |
| `--m3e-shape-size`            | Default size of the shape.                 |
| `--m3e-shape-container-color` | Container (background) color of the shape. |
| `--m3e-shape-transition`      | Transition used to morph between shapes.   |
