# @opina/widget

Embeddable Opina CSAT / feedback widget (IIFE).

## CDN / install

Prefer loading from your Opina host (API + widget share origin):

```html
<script
  src="https://your-opina.example/widget.js"
  data-key="pk_your_project_key"
  defer
></script>
```

If you load the script from npm/jsDelivr, set `data-base` to your Opina origin:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@opina/widget/dist/widget.js"
  data-key="pk_your_project_key"
  data-base="https://your-opina.example"
  defer
></script>
```

## npm

```bash
npm i @opina/widget
```

Built files are in `dist/widget.js` and `dist/capture.js`.
