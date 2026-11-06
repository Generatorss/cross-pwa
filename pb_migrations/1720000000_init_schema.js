/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // ---- objects ----
  const objects = new Collection({
    name: "objects",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    schema: [
      { name: "name", type: "text", required: true },
      { name: "address", type: "text" },
      { name: "notes", type: "text" },
    ],
  });
  app.save(objects);

  // ---- cabinets ----
  const cabinets = new Collection({
    name: "cabinets",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    schema: [
      { name: "object", type: "relation", required: true, options: { collectionId: objects.id, maxSelect: 1 } },
      { name: "name", type: "text", required: true },
      { name: "location", type: "text" },
      { name: "notes", type: "text" },
    ],
  });
  app.save(cabinets);

  // ---- racks ----
  const racks = new Collection({
    name: "racks",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    schema: [
      { name: "cabinet", type: "relation", required: true, options: { collectionId: cabinets.id, maxSelect: 1 } },
      { name: "name", type: "text", required: true },
      { name: "position", type: "text" },
    ],
  });
  app.save(racks);

  // ---- boxes ----
  const boxes = new Collection({
    name: "boxes",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    schema: [
      { name: "rack", type: "relation", required: true, options: { collectionId: racks.id, maxSelect: 1 } },
      { name: "number", type: "text", required: true },
      { name: "type", type: "text" },
      { name: "notes", type: "text" },
    ],
  });
  app.save(boxes);

  // ---- plints ----
  const plints = new Collection({
    name: "plints",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    schema: [
      { name: "box", type: "relation", required: true, options: { collectionId: boxes.id, maxSelect: 1 } },
      { name: "number", type: "text", required: true },
      { name: "type", type: "text" },
      { name: "pair_count", type: "number", required: true, options: { min: 1, max: 100 } },
    ],
  });
  app.save(plints);

  // ---- pairs ----
  const pairs = new Collection({
    name: "pairs",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    schema: [
      { name: "plint", type: "relation", required: true, options: { collectionId: plints.id, maxSelect: 1 } },
      { name: "pair_number", type: "number", required: true, options: { min: 1, max: 100 } },
      { name: "label", type: "text" },
    ],
  });
  app.save(pairs);

  // ---- cables ----
  const cables = new Collection({
    name: "cables",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    schema: [
      { name: "name", type: "text", required: true },
      { name: "type", type: "text" },
      { name: "from_object", type: "relation", options: { collectionId: objects.id, maxSelect: 1 } },
      { name: "to_object", type: "relation", options: { collectionId: objects.id, maxSelect: 1 } },
      { name: "notes", type: "text" },
    ],
  });
  app.save(cables);

  // ---- cores ----
  const cores = new Collection({
    name: "cores",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    schema: [
      { name: "cable", type: "relation", required: true, options: { collectionId: cables.id, maxSelect: 1 } },
      { name: "core_number", type: "number", required: true },
      { name: "color", type: "text" },
    ],
  });
  app.save(cores);

  // ---- cross_connections ----
  const cross = new Collection({
    name: "cross_connections",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    schema: [
      { name: "from_pair", type: "relation", options: { collectionId: pairs.id, maxSelect: 1 } },
      { name: "from_core", type: "relation", options: { collectionId: cores.id, maxSelect: 1 } },
      { name: "to_pair", type: "relation", options: { collectionId: pairs.id, maxSelect: 1 } },
      { name: "to_core", type: "relation", options: { collectionId: cores.id, maxSelect: 1 } },
      { name: "connection_type", type: "text", required: true },
      { name: "description", type: "text" },
    ],
  });
  app.save(cross);

  // ---- local_equipment ----
  const localEquipment = new Collection({
    name: "local_equipment",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'editor' || @request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    schema: [
      { name: "object", type: "relation", required: true, options: { collectionId: objects.id, maxSelect: 1 } },
      { name: "name", type: "text", required: true },
      { name: "type", type: "text" },
      { name: "connected_pair", type: "relation", options: { collectionId: pairs.id, maxSelect: 1 } },
    ],
  });
  app.save(localEquipment);
}, (app) => {
  // down-миграция: удаляем коллекции в обратном порядке
  for (const name of [
    "local_equipment", "cross_connections", "cores", "cables",
    "pairs", "plints", "boxes", "racks", "cabinets", "objects",
  ]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (e) {}
  }
});