# Backend ExpressJS+TypeORM - ADF Code Generator

Generator kode [ADF](https://github.com/Graf-Research/adf-core) untuk backend dengan framework ExpressJS + TypeORM.

**Modul ADF yang digunakan**

`Table` `Enum` `Schema` `API`

**Penggunaan CLI (Command Line)**

```bash
npx @graf-research/adf-codegen-api-nodejs <file/url ADF> <folder output>
```

## Instalasi

```bash
npm install --save @graf-research/adf-codegen-api-nodejs
```

## Fungsi

```typescript
import { Model, Schema } from "@graf-research/adf-core";
import { TypescriptModel } from "@graf-research/adf-codegen-model-typescript";

export type MapExpressJSAAFilePath = {[key: string]: string};

export interface CodegenFileOutput {
  filename: string
  content: string
}

export interface Output {
  files: CodegenFileOutput[]
  map: MapExpressJSAAFilePath
}

function ExpressJSAbstractAPI.compile(list_api_specification: API.API[], map_ts_model_path: TypescriptModel.MapTSModelFilePath, map_ts_schema_path: TypescriptSchema.MapTSSchemaFilePath): Output
```

Generator kode ini akan menghasilkan file dengan struktur folder sebagai berikut:

```
<folder output> --+-- expressjs-aa --+-- ExpressAA.ts
                  |                  |
                  |                  +-- Utility.ts
                  |                  |
                  |                  +-- api --+-- <api 1>.ts
                  |                            |
                  |                            +-- ...
                  |
                  +-- ts-schema --+-- Schema1.ts
                  |               |   
                  |               +-- ...
                  |
                  +-- model --+-- table --+-- Model1.ts
                  |           |           |   
                  |           |           +-- ...
                  |           |
                  |           +-- enum --+-- Enum1.ts
                  |                      |
                  |                      +-- ...
                  |
                  +-- ts-model --+-- table --+-- Model1.ts
                                 |           |   
                                 |           +-- ...
                                 |
                                 +-- enum --+-- Enum1.ts
                                            |
                                            +-- ...
```

## Panduan ExpressJS + TypeORM

### TypeORM

Panduan untuk TypeORM lihat di [https://github.com/Graf-Research/adf-codegen-model-typeorm](https://github.com/Graf-Research/adf-codegen-model-typeorm).

### ExpressJS

#### ExpressAA.ts

File `ExpressAA.ts` berisi sebuah kelas berikut:

```typescript
export interface SystemParam {
  port?: number
  beforeStart?(): Promise<void>
}

export class ExpressAA {
  public express?: Express;
  public async init(param: SystemParam): Promise<ExpressAA>
  public async implement(endpoint: Endpoints): Promise<void>
}
```

Untuk memulai backend, lakukan instansiasi kelas `ExpressAA` lalu inisialisasi parameter. Contoh sebuah file `server.ts`

```typescript
import 'reflect-metadata'
import { AppDataSource } from './data-source';
import { ExpressAA } from "./lib-api/expressjs-aa/ExpressAA";

new ExpressAA().init({
  port: 8888,
  async beforeStart() {
    await AppDataSource.initialize();
  }
}).then((engine: ExpressAA) => {
  // implementasi api disini
});
```

#### Folder api/*.ts

Pada folder `expressjs-aa` terdapat file-file yang berisi interface untuk mengimplementasikan fungsi api, misalnya jika terdapat file adf berikut:

```
api get /admin/product {
  headers {
    authorization string required
  }
  query {
    limit number
    offset number
    id_product_category number
    name string
    description string
    price number
  }
  return schema AdminProductResult {
    total number required
    data array table.Product required
  } required
}
```

maka akan terdapat sebuah file `expressjs-aa/api/GET_admin_product.ts` dengan isi file berikut:

```typescript
import { AdminProductResult } from '../../ts-schema/AdminProductResult'
import { Utility } from '../Utility';

export interface GET_admin_product_Req {
  // body-less request
  // no paths
  query: {
    limit?: number
    offset?: number
    id_product_category?: number
    name?: string
    description?: string
    price?: number
    id_user_seller?: number
  }
  headers: {
    authorization: string
  }
}
export interface GET_admin_product {
  endpoint: 'GET /admin/product'
  fn: (param: GET_admin_product_Req, Error: (param: Utility.ErrorParam<string>) => Utility.ErrorParam<string>) => Promise<AdminProductResult>
}
```

#### Contoh implementasi API

Berdasarkan contoh diatas berikut salah satu contoh implementasi API pada kelas `ExpressAA.ts`

```typescript
import 'reflect-metadata'
import { AppDataSource } from './data-source';
import { ExpressAA } from "./lib-api/expressjs-aa/ExpressAA";

new ExpressAA().init({
  port: 8888,
  async beforeStart() {
    await AppDataSource.initialize();
  }
}).then((engine: ExpressAA) => {
  engine.implement({
    endpoint: 'GET /admin/product'
    fn: (param: GET_admin_product_Req) => Promise<AdminProductResult> {
      return {
        total: 0,
        data: []
      }
    }
  });
});
```
