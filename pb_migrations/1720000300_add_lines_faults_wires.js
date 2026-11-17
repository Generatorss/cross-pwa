/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Коллекция lines
  const lines = new Collection({
    name: "lines", type: "base",
    listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    fields: [
      { name: "name", type: "text", required: true },
      { name: "notes", type: "text" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(lines);

  // 2. Коллекция fault_types (справочник)
  const faultTypes = new Collection({
    name: "fault_types", type: "base",
    listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    fields: [
      { name: "name", type: "text", required: true },
      { name: "notes", type: "text" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(faultTypes);

  // 3. Коллекция faults
  const pairs = app.findCollectionByNameOrId("pairs");
  const faults = new Collection({
    name: "faults", type: "base",
    listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    fields: [
      { name: "pair", type: "relation", required: true, collectionId: pairs.id, maxSelect: 1 },
      { name: "wire", type: "select", required: true, maxSelect: 1, values: ["A", "B"] },
      { name: "fault_type", type: "relation", required: true, collectionId: faultTypes.id, maxSelect: 1 },
      { name: "notes", type: "text" },
      { name: "status", type: "select", required: true, maxSelect: 1, values: ["active", "resolved"], },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(faults);

  // 4. pairs: line + cable_connected
  if (!pairs.fields.find((f) => f.name === "line")) {
    pairs.fields.add(new RelationField({ name: "line", required: false, collectionId: lines.id, maxSelect: 1 }));
  }
  if (!pairs.fields.find((f) => f.name === "cable_connected")) {
    pairs.fields.add(new BoolField({ name: "cable_connected", required: false }));
  }
  app.save(pairs);

  // 5. cross_connections: расширение
  const cross = app.findCollectionByNameOrId("cross_connections");
  const addField = (field) => {
    if (!cross.fields.find((f) => f.name === field.name)) cross.fields.add(field);
  };
  addField(new SelectField({ name: "from_wire", required: false, maxSelect: 1, values: ["A", "B"] }));
  addField(new SelectField({ name: "to_wire", required: false, maxSelect: 1, values: ["A", "B"] }));
  addField(new TextField({ name: "to_foreign_cable_name", required: false }));
  addField(new RelationField({ name: "line", required: false, collectionId: lines.id, maxSelect: 1 }));
  app.save(cross);
}, (app) => {
  // Откат (только для чистки на dev, не для prod)
  try {
    const cross = app.findCollectionByNameOrId("cross_connections");
    for (const n of ["from_wire", "to_wire", "to_foreign_cable_name", "line"]) {
      const f = cross.fields.find((x) => x.name === n);
      if (f) cross.fields.removeById(f.id);
    }
    app.save(cross);
    const pairs = app.findCollectionByNameOrId("pairs");
    for (const n of ["line", "cable_connected"]) {
      const f = pairs.fields.find((x) => x.name === n);
      if (f) pairs.fields.removeById(f.id);
    }
    app.save(pairs);
    for (const n of ["faults", "fault_types", "lines"]) {
      try { app.delete(app.findCollectionByNameOrId(n)); } catch (e) {}
    }
  } catch (e) {}
});