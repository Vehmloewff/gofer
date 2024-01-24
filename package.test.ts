import { asserts } from './deps.ts'
import { parsePackageName } from './package.ts'

Deno.test('parsePackageName', () => {
	asserts.assertEquals(parsePackageName('github.com/Vehmloewff/gofer'), {
		host: 'github.com',
		version: null,
		sections: ['vehmloewff', 'gofer'],
		normalized: 'github.com/vehmloewff/gofer',
	})
	asserts.assertEquals(parsePackageName('github.com/Vehmloewff/gofer@version'), {
		host: 'github.com',
		version: 'version',
		sections: ['vehmloewff', 'gofer'],
		normalized: 'github.com/vehmloewff/gofer',
	})
})
