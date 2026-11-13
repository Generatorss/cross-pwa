/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  
  // Добавляем поле role, если его ещё нет
  const exists = users.fields.find((f) => f.name === "role");
  if (!exists) {
    users.fields.add(new SelectField({
      name: "role",
      required: true,
      maxSelect: 1,
      values: ["viewer", "editor", "admin"],
    }));
    app.save(users);
  }
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  const field = users.fields.find((f) => f.name === "role");
  if (field) {
    users.fields.removeById(field.id);
    app.save(users);
  }
});
