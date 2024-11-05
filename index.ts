import { API } from "@graf-research/adf-core";
import { TypescriptModel } from "@graf-research/adf-codegen-model-typescript";
import { TypescriptSchema } from "@graf-research/adf-codegen-schema-typescript";

export namespace ExpressJSAbstractAPI {
  export type MapExpressJSAAFilePath = {[key: string]: string};
  export interface CodegenFileOutput {
    filename: string
    content: string
  }
  
  export interface Output {
    files: CodegenFileOutput[]
    map: MapExpressJSAAFilePath
  }

  function getModelFileName(filename: string, extension?: string): string {
    return `./expressjs-aa/${filename}${extension ?? ''}`;
  }

  export function compile(list_api_specification: API.API[], map_ts_model_path: TypescriptModel.MapTSModelFilePath, map_ts_schema_path: TypescriptSchema.MapTSSchemaFilePath): Output {
    const list_api_endpoint: [Output, string, string][] = list_api_specification.map((api: API.API) => buildAPIEndpoint(api, map_ts_model_path, map_ts_schema_path));
    const utility_file: Output = buildUtilityFunction();
    const main_server_file: Output = buildMainServer(list_api_endpoint.map(oa => ({ interface_name: oa[1], path: oa[2] })))

    return {
      files: [
        ...list_api_endpoint.reduce((accumulator: CodegenFileOutput[], o: [Output, string, string]) => [...accumulator, ...o[0].files], []),
        ...utility_file.files,
        ...main_server_file.files
      ],
      map: {
        ...list_api_endpoint.reduce((accumulator: MapExpressJSAAFilePath, o: [Output, string, string]) => ({ ...accumulator, ...o[0].map }), {}),
        ...utility_file.map,
        ...main_server_file.map
      }
    };
  }

  function buildAPIBodyDependency(list_api_body: API.Body[], map_ts_model_path: TypescriptModel.MapTSModelFilePath, map_ts_schema_path: TypescriptSchema.MapTSSchemaFilePath): string[] {
    return list_api_body.filter((body: API.Body) => body.type.type !== 'native').map((body: API.Body) => {
      switch (body.type.type) {
        case "native":
          // never reach this statement
          return [];
        case "schema":
          const schema_path = map_ts_schema_path[body.type.schema_name];
          return [
            `import { ${body.type.schema_name} } from '../.${schema_path}'`
          ];
        case "table":
          const table_path = map_ts_model_path[body.type.table_name];
          return [
            `import { ${body.type.table_name} } from '../.${table_path}'`
          ];
        case "enum":
          const enum_path = map_ts_model_path[body.type.enum_name];
          return [
            `import { ${body.type.enum_name} } from '../.${enum_path}'`
          ];
      }
    }).reduce((acc: string[], curr: string[]) => [...acc, ...curr], []);
  }

  function buildAPIReturnTypeDependency(api_return_type: API.ReturnType, map_ts_model_path: TypescriptModel.MapTSModelFilePath, map_ts_schema_path: TypescriptSchema.MapTSSchemaFilePath): string[] {
    switch (api_return_type.type.type) {
      case "native":
        // never reach this statement
        return [];
      case "schema":
        const schema_path = map_ts_schema_path[api_return_type.type.schema_name];
        return [
          `import { ${api_return_type.type.schema_name} } from '../.${schema_path}'`
        ];
      case "table":
        const table_path = map_ts_model_path[api_return_type.type.table_name];
        return [
          `import { ${api_return_type.type.table_name} } from '../.${table_path}'`
        ];
      case "enum":
        const enum_path = map_ts_model_path[api_return_type.type.enum_name];
        return [
          `import { ${api_return_type.type.enum_name} } from '../.${enum_path}'`
        ];
    }
  }

  function buildBodyType(list_api_body?: API.Body[]): string[] {
    if (!list_api_body) { return ['// no body']; }
    return ['body: {',
      ...list_api_body.map((b: API.Body) => {
        let type: string = 'any';
        switch (b.type.type) {
          case "native":
            type = b.type.native_type;
            break;
          case "schema":
            type = b.type.schema_name;
            break;
          case "table":
            type = b.type.table_name;
            break;
          case "enum":
            type = b.type.enum_name;
            break;
        }
        return '  ' + `${b.key}${b.required ? '' : '?'}: ${type}${b.array ? '[]' : ''}`;
      }),
    '}']
  }

  function buildPathType(list_api_path?: API.Path[]): string[] {
    if (!list_api_path) { return ['// no paths'] };
    return ['paths: {',
      ...list_api_path.map((b: API.Path) => {
        return '  ' + `${b.key}: ${b.type}`;
      }),
    '}']
  }

  function buildQueryType(list_api_query?: API.Query[]): string[] {
    if (!list_api_query) { return ['// no query']; }
    return ['query: {',
      ...list_api_query.map((b: API.Query) => {
        return '  ' + `${b.key}${b.required ? '' : '?'}: ${b.type}${b.array ? '[]' : ''}`;
      }),
    '}']
  }

  function buildHeadersType(list_api_headers?: API.Headers[]): string[] {
    if (!list_api_headers) { return ['// no headers']; }
    return ['headers: {',
      ...list_api_headers.map((b: API.Headers) => {
        return '  ' + `${b.key}${b.required ? '' : '?'}: ${b.type}`;
      }),
    '}']
  }

  function buildReturnType(return_type: API.ReturnType): string {
    let type: string = 'any';
    switch (return_type.type.type) {
      case "native":
        type = return_type.type.native_type;
        break;
      case "schema":
        type = return_type.type.schema_name;
        break;
      case "table":
        type = return_type.type.table_name;
        break;
      case "enum":
        type = return_type.type.enum_name
        break;
    }
    return `${type}${return_type.array ? '[]' : ''}${return_type.required ? '' : ' | null'}`;
  }

  function buildAPIEndpoint(api: API.API, map_ts_model_path: TypescriptModel.MapTSModelFilePath, map_ts_schema_path: TypescriptSchema.MapTSSchemaFilePath): [Output, string, string] {
    const filename = 'api/' + api.method.toUpperCase() + api.path.replace(/[^\w]/g, '_');
    const api_interface_name = api.method.toUpperCase() + api.path.replace(/[^\w]/g, '_');
    const req_api_interface_name = api_interface_name + '_Req';
    return [{
      files: [{
        filename: getModelFileName(filename, '.ts'),
        content: [
          ...(api.method === 'post' || api.method === 'put' || api.method === 'patch' ? buildAPIBodyDependency(api.body ?? [], map_ts_model_path, map_ts_schema_path) : []),
          ...buildAPIReturnTypeDependency(api.return, map_ts_model_path, map_ts_schema_path),
          `import { Utility } from '../Utility';`,
          '',
          `export interface ${req_api_interface_name} {`,
          (api.method === 'post' || api.method === 'put' || api.method === 'patch' ? buildBodyType(api.body) : ['// body-less request']).map(line => '  ' + line).join('\n'),
          buildPathType(api.paths).map(line => '  ' + line).join('\n'),
          buildQueryType(api.queries).map(line => '  ' + line).join('\n'),
          buildHeadersType(api.headers).map(line => '  ' + line).join('\n'),
          `}`,
          `export interface ${api_interface_name} {`,
          `  endpoint: '${api.method.toUpperCase()} ${api.path}'`,
          `  fn: (param: ${req_api_interface_name}, Error: (param: Utility.ErrorParam<string>) => Utility.ErrorParam<string>) => Promise<${buildReturnType(api.return)}>`,
          `}\n`
        ].join('\n')
      }],
      map: {
        filename: getModelFileName(filename)
      }
    }, api_interface_name, getModelFileName(filename)];
  }

  function buildUtilityFunction(): Output {
    const filename = 'Utility';
    return {
      files: [{
        filename: getModelFileName(filename, '.ts'),
        content: `\
export namespace Utility {
  export class ErrorParam<T> {
    public code: number = 500;
    public message?: string
    public data!: T
  }
}\n`
      }],
      map: {
        filename: getModelFileName(filename)
      }
    }
  }

  interface APIInterfaceParam {
    interface_name: string
    path: string
  }
  function buildMainServer(list_api_interface_dependency: APIInterfaceParam[]): Output {
    const filename = 'ExpressAA';
    const list_import_api_interface_dependency = list_api_interface_dependency.map((aip: APIInterfaceParam) => `import { ${aip.interface_name} } from '.${aip.path}';`).join('\n');
    const list_api_interface_types = list_api_interface_dependency.map((aip: APIInterfaceParam) => aip.interface_name).join('\n  | ');

    return {
      files: [{
        filename: getModelFileName(filename, '.ts'),
        content: `\
import 'reflect-metadata';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { Utility } from './Utility';
${list_import_api_interface_dependency}

type Endpoints = ${list_api_interface_types};

export interface SystemParam {
  port?: number
  beforeStart?(): Promise<void>
}

export class ExpressAA {
  public express?: Express;

  public async init(param: SystemParam): Promise<ExpressAA> {
    if (param.beforeStart) {
      await param.beforeStart();
    }
    
    this.express = express();
    const port = param?.port ?? process.env.PORT ?? 3000;
    
    this.express.use(cors());
    this.express.use(express.json({limit: '5mb'}));
    this.express.set('trust proxy', true);
    this.express.listen(port, () => {
      console.log(\`⚡️[server]: Server is running at http://localhost:\${port}\`);
    });
    
    return this;
  }

  public async implement(endpoint: Endpoints) {
    if (!this.express) {
      throw new Error('ExpressJS has not been initialized yet');
    }

    const [method, url_path] = endpoint.endpoint.toLowerCase().split(' ');
    if (method === 'post' || method === 'put' || method === 'patch' || method === 'delete' || method === 'get') {
      this.express[method](url_path, async (req: Request, res: Response) => {
        try {
          const result = await endpoint.fn({
            body: req.body,
            paths: req.params,
            headers: req.headers,
            query: req.query
          } as any, x => x);
          res.status(200).json(result);
        } catch (err: any) {
          if (err instanceof Utility.ErrorParam) {
            res.status(err.code).json(err);
            return;
          }
          const err_msg = err.toString();
          if (/^\s*\d{3}\s*\:/.test(err_msg)) {
            const [err_code, msg] = err_msg.split(':');
            res.status(+err_code.trim()).send(msg);
            return;
          }
          res.status(500).send(err_msg);
        }
      });
    } else {
      throw new Error(\`Method "\${method} \${url_path}" unsupported.\`);
    }
  }
}\n`
      }],
      map: {
        filename: getModelFileName(filename)
      }
    }
  }
}
