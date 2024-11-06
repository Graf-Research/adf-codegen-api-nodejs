import { API, Schema } from "@graf-research/adf-core";
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
    const list_api_endpoint: [Output, string, string, string][] = list_api_specification.map((api: API.API) => buildAPIEndpoint(api, map_ts_model_path, map_ts_schema_path));
    const utility_file: Output = buildUtilityFunction();
    const main_server_file: Output = buildMainServer(list_api_endpoint.map(oa => ({ interface_name: oa[1], file_path: oa[2], method_url_path: oa[3] })))

    return {
      files: [
        ...list_api_endpoint.reduce((accumulator: CodegenFileOutput[], o: [Output, string, string, string]) => [...accumulator, ...o[0].files], []),
        ...utility_file.files,
        ...main_server_file.files
      ],
      map: {
        ...list_api_endpoint.reduce((accumulator: MapExpressJSAAFilePath, o: [Output, string, string, string]) => ({ ...accumulator, ...o[0].map }), {}),
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

  function buildBodyType(req_api_interface_name: string, list_api_body?: API.Body[]): string[] {
    if (!list_api_body) { return ['// no body']; }
    return [`class ${req_api_interface_name}_Body {`,
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
        return [
          ...TypescriptSchema.getDecorators(b),
          `${b.key}${b.required ? '!' : '?'}: ${type}${b.array ? '[]' : ''}`
        ].map(line => '  ' + line).join('\n');
      }),
    '}']
  }

  function buildPathType(req_api_interface_name: string, list_api_path?: API.Path[]): string[] {
    if (!list_api_path) { return ['// no paths'] };
    return [`class ${req_api_interface_name}_Paths {`,
      ...list_api_path.map((b: API.Path) => {
        return [
          ...TypescriptSchema.getDecorators({
            ...b,
            type: {
              type: 'native',
              native_type: b.type,
            }
          }),
          `${b.key}!: ${b.type}`
        ].map(line => '  ' + line).join('\n');
      }),
    '}']
  }

  function buildQueryType(req_api_interface_name: string, list_api_query?: API.Query[]): string[] {
    if (!list_api_query) { return ['// no query']; }
    return [`class ${req_api_interface_name}_Query {`,
      ...list_api_query.map((b: API.Query) => {
        return [
          ...TypescriptSchema.getDecorators({
            ...b,
            type: {
              type: 'native',
              native_type: b.type,
            }
          }),
          `${b.key}${b.required ? '!' : '?'}: ${b.type}${b.array ? '[]' : ''}`
        ].map(line => '  ' + line).join('\n');
      }),
    '}']
  }

  function buildHeadersType(req_api_interface_name: string, list_api_headers?: API.Headers[]): string[] {
    if (!list_api_headers) { return ['// no headers']; }
    return [`class ${req_api_interface_name}_Headers {`,
      ...list_api_headers.map((b: API.Headers) => {
        return [
          ...TypescriptSchema.getDecorators({
            ...b,
            type: {
              type: 'native',
              native_type: b.type,
            }
          }),
          `${b.key}${b.required ? '!' : '?'}: ${b.type}`
        ].map(line => '  ' + line).join('\n');
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

  function buildAPIEndpoint(api: API.API, map_ts_model_path: TypescriptModel.MapTSModelFilePath, map_ts_schema_path: TypescriptSchema.MapTSSchemaFilePath): [Output, string, string, string] {
    const filename = 'api/' + api.method.toUpperCase() + api.path.replace(/[^\w]/g, '_');
    const api_interface_name = api.method.toUpperCase() + api.path.replace(/[^\w]/g, '_');
    const req_api_interface_name = api_interface_name + '_Req';

    const has_paths = (api.paths ?? []).length > 0;
    const has_query = (api.queries ?? []).length > 0;
    const has_headers = (api.headers ?? []).length > 0;
    const has_body = (api.method === 'post' || api.method === 'put' || api.method === 'patch') && ((api.body ?? []).length > 0);

    const path_str_class: string[] = has_paths ? buildPathType(req_api_interface_name, api.paths) : [];
    const query_str_class: string[] = has_query ? buildQueryType(req_api_interface_name, api.queries) : [];
    const headers_str_class: string[] = has_headers ? buildHeadersType(req_api_interface_name, api.headers) : [];
    const body_str_class: string[] = has_body ? buildBodyType(req_api_interface_name, api.body) : [];

    return [
      {
        files: [{
          filename: getModelFileName(filename, '.ts'),
          content: [
            ...(api.method === 'post' || api.method === 'put' || api.method === 'patch' ? buildAPIBodyDependency(api.body ?? [], map_ts_model_path, map_ts_schema_path) : []),
            ...buildAPIReturnTypeDependency(api.return, map_ts_model_path, map_ts_schema_path),
            `import { Utility } from '../Utility';`,
            `import { ClassConstructor, Transform, Type, plainToInstance } from "class-transformer";`,
            `import { IsNotEmpty, IsNumber, IsObject, IsBoolean, IsOptional, IsISO8601, IsString, IsEnum, ValidateNested, IsArray, ValidationError, validateOrReject } from "class-validator";\n`,
            ...path_str_class,
            ...query_str_class,
            ...headers_str_class,
            ...body_str_class,
            ``,
            `export class ${req_api_interface_name} {`,
            ...[
              has_paths ? `  @Type(() => ${req_api_interface_name}_Paths)\n  paths!: ${req_api_interface_name}_Paths` : '',
              has_query ? `  @Type(() => ${req_api_interface_name}_Query)\n  query!: ${req_api_interface_name}_Query` : '',
              has_headers ? `  @Type(() => ${req_api_interface_name}_Headers)\n  headers!: ${req_api_interface_name}_Headers` : '',
              has_body ? `  @Type(() => ${req_api_interface_name}_Body)\n  body!: ${req_api_interface_name}_Body` : '',
            ].filter(Boolean),
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
      }, 
      api_interface_name, 
      getModelFileName(filename),
      `${api.method.toUpperCase()} ${api.path}`
    ];
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
    file_path: string
    method_url_path: string
  }
  function buildMainServer(list_api_interface_dependency: APIInterfaceParam[]): Output {
    const filename = 'ExpressAA';
    const list_import_api_interface_dependency = list_api_interface_dependency.map((aip: APIInterfaceParam) => `import { ${aip.interface_name} } from '.${aip.file_path}';`).join('\n');
    const list_import_class_map_api_interface_dependency = list_api_interface_dependency.map((aip: APIInterfaceParam) => `import { ${aip.interface_name}_Req } from '.${aip.file_path}';`).join('\n');
    const list_api_interface_types = list_api_interface_dependency.map((aip: APIInterfaceParam) => aip.interface_name).join('\n  | ');
    const class_map_api_interface_types = 'const classmap: any = {\n' + list_api_interface_dependency.map((aip: APIInterfaceParam) => `  '${aip.method_url_path}': ${aip.interface_name}_Req`).join(',\n') + '\n}';

    return {
      files: [{
        filename: getModelFileName(filename, '.ts'),
        content: `\
import 'reflect-metadata';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { Utility } from './Utility';
import { ClassConstructor, Transform, Type, plainToInstance } from "class-transformer";
import { IsNotEmpty, IsNumber, IsObject, IsBoolean, IsOptional, IsISO8601, IsString, IsEnum, ValidateNested, IsArray, ValidationError, validateOrReject } from "class-validator"
${list_import_api_interface_dependency}
${list_import_class_map_api_interface_dependency}

type Endpoints = ${list_api_interface_types};
${class_map_api_interface_types}

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

  private errorToString(list_error: ValidationError[]): string {
    return list_error.map(err => {
      const children: ValidationError[] | undefined = err.children;
      if (children && children.length > 0) {
        return this.errorToString(children);
      }
      const constrains: any = err.constraints;
      const keys = Object.keys(constrains);
      return keys.filter(key => constrains[key].length > 0).map(key => constrains[key]).join(', ');
    }).join(', ');
  }

  public async implement(endpoint: Endpoints) {
    if (!this.express) {
      throw new Error('ExpressJS has not been initialized yet');
    }

    const [method, url_path] = endpoint.endpoint.toLowerCase().split(' ');
    if (method === 'post' || method === 'put' || method === 'patch' || method === 'delete' || method === 'get') {
      this.express[method](url_path, async (req: Request, res: Response) => {

        const request_parameter: any = plainToInstance(classmap[method.toUpperCase() + ' ' + url_path], {
          body: req.body,
          headers: req.headers,
          paths: req.params,
          query: req.query
        });
        
        try {
          if (request_parameter.paths) {
            await validateOrReject(request_parameter.paths);
          }
          if (request_parameter.headers) {
            await validateOrReject(request_parameter.headers);
          }
          if (request_parameter.query) {
            await validateOrReject(request_parameter.query);
          }
          if (request_parameter.body) {
            await validateOrReject(request_parameter.body);
          }
        } catch (err_validation: any) {
          res.status(400).send(this.errorToString(err_validation));
          return;
        }

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
