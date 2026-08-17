<h1 align="center">
  @yunzhen/permission-expression
</h1>

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

零依赖的 TypeScript 权限表达式解析与判断库

## 安装

```bash
pnpm add @yunzhen/permission-expression
```

## 使用

```ts
import { hasPermission } from '@yunzhen/permission-expression'

const permissions = new Set([
  'document.read',
  'document.share',
])

hasPermission('document.read & document.share', permissions) // true
hasPermission('document.read & !document.delete', permissions) // true
hasPermission('document.delete | document.share', permissions) // true
```

空表达式和不合法表达式会抛出 `ExpressionSyntaxError`，不会默认放行。

## 表达式语法

| 语法 | 含义 | 示例 |
| --- | --- | --- |
| `!` | 非 | `!document.delete` |
| `&` | 与 | `document.read & document.share` |
| `\|` | 或 | `document.read \| document.share` |
| `()` | 分组 | `(document.read \| document.write) & document.share` |

优先级固定为 `! > & > |`。空白会被忽略；权限码不能包含空白、`!`、`&`、`|`、`(` 或 `)`。

## 编译与复用 AST

`compile` 会将表达式转换为可序列化 AST。可在多个权限集合上复用，避免重复解析。

```ts
import { compile, hasPermission } from '@yunzhen/permission-expression'

const authority = compile('document.read & !document.delete')

hasPermission(authority, new Set(['document.read'])) // true
hasPermission(authority, new Set(['document.read', 'document.delete'])) // false
```

## 输出表达式

`stringify` 会将 AST 输出为可再次 `compile` 的表达式，并保留原有的分组结构。

```ts
import { compile, stringify } from '@yunzhen/permission-expression'

const authority = compile('document.read & (document.write & document.share)')

stringify(authority) // 'document.read & (document.write & document.share)'
```

## 错误处理

```ts
import { compile, ExpressionSyntaxError } from '@yunzhen/permission-expression'

try {
  compile('document.read &')
}
catch (error) {
  if (error instanceof ExpressionSyntaxError) {
    console.log(error.code) // UNEXPECTED_END
    console.log(error.position) // 15
  }
}
```

| 错误码 | 含义 |
| --- | --- |
| `EMPTY_EXPRESSION` | 表达式为空或仅包含空白 |
| `UNEXPECTED_END` | 运算符或 `!` 后缺少表达式 |
| `UNEXPECTED_TOKEN` | 出现不符合当前位置的符号 |
| `UNMATCHED_CLOSING_PARENTHESIS` | 存在多余的右括号 |
| `UNMATCHED_OPENING_PARENTHESIS` | 左括号未闭合 |
| `EXPRESSION_TOO_DEEP` | 嵌套或 AST 深度超过 1000 层 |

## 开发

```bash
pnpm test
pnpm run typecheck
pnpm run lint
```

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/@yunzhen/permission-expression?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmx.dev/package/@yunzhen/permission-expression
[npm-downloads-src]: https://img.shields.io/npm/dm/@yunzhen/permission-expression?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmx.dev/package/@yunzhen/permission-expression
[bundle-src]: https://img.shields.io/bundlephobia/minzip/@yunzhen/permission-expression?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=@yunzhen/permission-expression
[license-src]: https://img.shields.io/github/license/yunzhencc/permission-expression.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/yunzhencc/permission-expression/blob/main/LICENSE.md
