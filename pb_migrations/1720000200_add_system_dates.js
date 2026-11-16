/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const COLLECTIONS = [
    "objects", "cabinets", "racks", "boxes", "plints", "pairs",
    "cables", "cores", "cross_connections", "local_equipment",
  ];

  for (const name of COLLECTIONS) {
    const collection = app.findCollectionByNameOrId(name);

    // created — есть, пропускаем; нет — добавляем
    if (!collection.fields.find((f) => f.name === "created")) {
      collection.fields.add(new AutodateField({
        name: "created",
        onCreate: true,
        onUpdate: false,
      }));
    }

    // updated — есть, пропускаем; нет — добавляем
    if (!collection.fields.find((f) => f.name === "updated")) {
      collection.fields.add(new AutodateField({
        name: "updated",
        onCreate: true,
        onUpdate: true,
      }));
    }

    app.save(collection);
  }
}, (app) => {
  // Откат: убираем поля, если их не было бы до миграции
  const COLLECTIONS = [
    "objects", "cabinets", "racks", "boxes", "plints", "pairs",
    "cables", "cores", "cross_connections", "local_equipment",
  ];
  for (const name of COLLECTIONS) {
    const collection = app.findCollectionByNameOrId(name);
    const created = collection.fields.find((f) => f.name === "created");
    const updated = collection.fields.find((f) => f.name === "updated");
    if (created) collection.fields.removeById(created.id);
    if (updated) collection.fields.removeById(updated.id);
    app.save(collection);
  }
});
