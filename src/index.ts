export type PermissionExpression
  = | { type: 'permission', name: string }
    | { type: 'not', expression: PermissionExpression }
    | { type: 'and' | 'or', left: PermissionExpression, right: PermissionExpression }

export type Authority = string | PermissionExpression

// ponytail: cap nesting at 1000; use an iterative parser if real policies exceed it.
const maxExpressionDepth = 1000

export type ExpressionSyntaxErrorCode
  = | 'EXPRESSION_TOO_DEEP'
    | 'EMPTY_EXPRESSION'
    | 'UNEXPECTED_END'
    | 'UNEXPECTED_TOKEN'
    | 'UNMATCHED_CLOSING_PARENTHESIS'
    | 'UNMATCHED_OPENING_PARENTHESIS'

export class ExpressionSyntaxError extends SyntaxError {
  constructor(
    readonly code: ExpressionSyntaxErrorCode,
    readonly position: number,
  ) {
    super(`${code} at position ${position}`)
    this.name = 'ExpressionSyntaxError'
  }
}

export function compile(source: string): PermissionExpression {
  const parser = new Parser(source)
  parser.skipWhitespace()
  if (parser.isAtEnd()) {
    parser.fail('EMPTY_EXPRESSION')
  }

  const expression = parser.parseOr()

  parser.skipWhitespace()
  if (!parser.isAtEnd()) {
    parser.fail(parser.current() === ')' ? 'UNMATCHED_CLOSING_PARENTHESIS' : 'UNEXPECTED_TOKEN')
  }

  return expression
}

export function hasPermission(authority: Authority, permissions: ReadonlySet<string>): boolean {
  const expression = typeof authority === 'string' ? compile(authority) : authority

  switch (expression.type) {
    case 'permission':
      return permissions.has(expression.name)
    case 'not':
      return !hasPermission(expression.expression, permissions)
    case 'and':
      return hasPermission(expression.left, permissions) && hasPermission(expression.right, permissions)
    case 'or':
      return hasPermission(expression.left, permissions) || hasPermission(expression.right, permissions)
  }
}

class Parser {
  position = 0
  nesting = 0

  constructor(readonly source: string) {}

  parseOr(): PermissionExpression {
    let expression = this.parseAnd()

    while (this.take('|')) {
      expression = this.track({ type: 'or', left: expression, right: this.parseAnd() })
    }

    return expression
  }

  parseAnd(): PermissionExpression {
    let expression = this.parseUnary()

    while (this.take('&')) {
      expression = this.track({ type: 'and', left: expression, right: this.parseUnary() })
    }

    return expression
  }

  parseUnary(): PermissionExpression {
    this.nesting++
    try {
      if (this.nesting > maxExpressionDepth) {
        this.fail('EXPRESSION_TOO_DEEP')
      }

      this.skipWhitespace()

      if (this.isAtEnd()) {
        this.fail(this.position === 0 ? 'EMPTY_EXPRESSION' : 'UNEXPECTED_END')
      }

      if (this.take('!')) {
        return this.track({ type: 'not', expression: this.parseUnary() })
      }

      if (this.take('(')) {
        const openingPosition = this.position - 1
        const expression = this.parseOr()

        this.skipWhitespace()
        if (this.isAtEnd()) {
          this.fail('UNMATCHED_OPENING_PARENTHESIS', openingPosition)
        }
        if (!this.take(')')) {
          this.fail('UNEXPECTED_TOKEN')
        }

        return expression
      }

      if (this.current() === ')') {
        this.fail('UNMATCHED_CLOSING_PARENTHESIS')
      }

      return this.parsePermission()
    }
    finally {
      this.nesting--
    }
  }

  parsePermission(): PermissionExpression {
    const start = this.position

    while (!this.isAtEnd() && !/[\s!&|()]/.test(this.current())) {
      this.position++
    }

    if (start === this.position) {
      this.fail('UNEXPECTED_TOKEN')
    }

    return this.track({ type: 'permission', name: this.source.slice(start, this.position) })
  }

  take(token: string): boolean {
    this.skipWhitespace()
    if (this.current() !== token) {
      return false
    }

    this.position++
    return true
  }

  skipWhitespace(): void {
    while (!this.isAtEnd() && /\s/.test(this.current())) {
      this.position++
    }
  }

  isAtEnd(): boolean {
    return this.position >= this.source.length
  }

  current(): string {
    return this.source[this.position] ?? ''
  }

  fail(code: ExpressionSyntaxErrorCode, position = this.position): never {
    throw new ExpressionSyntaxError(code, position)
  }

  private track(expression: PermissionExpression): PermissionExpression {
    const depth = expression.type === 'permission'
      ? 1
      : expression.type === 'not'
        ? this.expressionDepths.get(expression.expression)! + 1
        : Math.max(this.expressionDepths.get(expression.left)!, this.expressionDepths.get(expression.right)!) + 1

    if (depth > maxExpressionDepth) {
      this.fail('EXPRESSION_TOO_DEEP')
    }

    this.expressionDepths.set(expression, depth)
    return expression
  }

  private expressionDepths = new WeakMap<PermissionExpression, number>()
}
