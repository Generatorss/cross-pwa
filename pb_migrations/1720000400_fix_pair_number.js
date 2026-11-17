/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // PocketBase считает 0 «пустым» значением для required-числовых полей,
  // поэтому пары с pair_number = 0 не проходили валидацию при push.
  // Снимаем required и разрешаем 0 (min: 0).
  const pairs = app.findCollectionByNameOrId("pairs");
  const field = pairs.fields.find((f) => f.name === "pair_number");
  if (field) {
    field.required = false;
    field.min = 0;
    app.save(pairs);
  }
}, (app) => {
  const pairs = app.findCollectionByNameOrId("pairs");
  const field = pairs.fields.find((f) => f.name === "pair_number");
  if (field) {
    field.required = true;
    field.min = 1;
    app.save(pairs);
  }
});
