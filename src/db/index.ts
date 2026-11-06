import Dexie, { type Table } from 'dexie'

export interface OutboxItem {
  id?: number
  collection: string
  recordId: string
  operation: 'create' | 'update' | 'delete'
  payload: any
  clientUpdatedAt: string
  status: 'pending' | 'synced' | 'conflicted'
}

export class CrossDB extends Dexie {
  objects!: Table<any>
  cabinets!: Table<any>
  racks!: Table<any>
  boxes!: Table<any>
  plints!: Table<any>
  pairs!: Table<any>
  cables!: Table<any>
  cores!: Table<any>
  cross_connections!: Table<any>
  local_equipment!: Table<any>
  outbox!: Table<OutboxItem, number>
  meta!: Table<{ key: string; value: any }>

  constructor() {
    super('CrossDB')
    this.version(1).stores({
      objects: 'id, name, updated',
      cabinets: 'id, object, name, updated',
      racks: 'id, cabinet, name, updated',
      boxes: 'id, rack, number, updated',
      plints: 'id, box, number, updated',
      pairs: 'id, plint, pair_number, updated',
      cables: 'id, name, from_object, to_object, updated',
      cores: 'id, cable, core_number, updated',
      cross_connections: 'id, from_pair, to_pair, updated',
      local_equipment: 'id, object, connected_pair, updated',
      outbox: '++id, collection, recordId, status, clientUpdatedAt',
      meta: 'key',
    })
  }
}

export const db = new CrossDB()