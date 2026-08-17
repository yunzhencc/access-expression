import type { ExpressionSyntaxError, ExpressionSyntaxErrorCode } from '../src'
import { describe, expect, it } from 'vitest'
import { compile, hasPermission } from '../src'

const invalidExpressions = [
  ['', 'EMPTY_EXPRESSION', 0],
  ['   ', 'EMPTY_EXPRESSION', 3],
  ['document.read &', 'UNEXPECTED_END', 15],
  ['document.read)', 'UNMATCHED_CLOSING_PARENTHESIS', 13],
  ['(document.read', 'UNMATCHED_OPENING_PARENTHESIS', 0],
  ['document.read && document.write', 'UNEXPECTED_TOKEN', 15],
  [`${'!'.repeat(1001)}document.read`, 'EXPRESSION_TOO_DEEP', 1000],
] as const satisfies readonly (readonly [string, ExpressionSyntaxErrorCode, number])[]

describe('hasPermission', () => {
  it('allows an assigned permission', () => {
    expect(hasPermission('document.read', new Set(['document.read']))).toBe(true)
  })

  it.each([
    ['document.read & document.share', ['document.read', 'document.share'], true],
    ['document.read & document.share', ['document.read'], false],
    ['document.read | document.share', ['document.share'], true],
    ['!document.delete', ['document.read'], true],
    ['document.read | document.write & document.share', ['document.read'], true],
    ['(document.read | document.write) & document.share', ['document.read'], false],
    [' document.read  &  ! document.delete ', ['document.read'], true],
  ])('evaluates %s', (expression, permissions, expected) => {
    expect(hasPermission(expression, new Set(permissions))).toBe(expected)
  })

  it('evaluates a compiled expression', () => {
    const authority = compile('document.read & document.share')

    expect(hasPermission(authority, new Set(['document.read', 'document.share']))).toBe(true)
  })
})

describe('compile', () => {
  it('returns a serializable expression tree', () => {
    expect(compile('!document.delete | document.read')).toEqual({
      type: 'or',
      left: {
        type: 'not',
        expression: { type: 'permission', name: 'document.delete' },
      },
      right: { type: 'permission', name: 'document.read' },
    })
  })

  it('rejects a binary chain deeper than the supported limit', () => {
    const expression = Array.from({ length: 1001 }).fill('document.read').join('|')

    expect(() => compile(expression)).toThrow(expect.objectContaining({
      code: 'EXPRESSION_TOO_DEEP',
    } satisfies Partial<ExpressionSyntaxError>))
  })

  it.each(invalidExpressions)('rejects %j', (input, code, position) => {
    expect(() => compile(input)).toThrow(expect.objectContaining({
      code,
      position,
    } satisfies Partial<ExpressionSyntaxError>))
  })
})
