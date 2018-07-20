export class Buffer {
  constructor(public id:number) {
  }
}

export class Window {
  constructor(public id:number) {
  }
}

export class Tabpage {
  constructor(public id:number) {
  }
}

export interface ExtTypeConstructor<T> {
  new (...args: any[]): T
}

export interface MetadataType   {
  constructor: ExtTypeConstructor<Buffer | Tabpage | Window>
  name: string
}

export const Metadata: MetadataType[] = [
  {
    constructor: Buffer,
    name: 'Buffer'
  },
  {
    constructor: Window,
    name: 'Window'
  },
  {
    constructor: Tabpage,
    name: 'Tabpage'
  },
]

