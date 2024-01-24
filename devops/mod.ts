import { pathUtils } from '../deps.ts'
import { archiveUtils } from './deps.ts'
import { ioUtils } from './deps.ts'
import { streamUtils } from './deps.ts'
import { dtils } from './deps.ts'

export async function ci(): Promise<void> {
	await dtils.check({ permissions: 'all' })
}

export async function build(args: string[]): Promise<void> {
	const [ref] = args
	if (!ref) throw new Error('Expected to receive a git ref as the first argument')

	const prefix = 'refs/tags/'
	if (!ref.startsWith(prefix)) throw new Error(`Expected a tag ref (${prefix}*), but found "${ref}"`)
	const tag = ref.slice(prefix.length)

	const targets = ['x86_64-unknown-linux-gnu', 'x86_64-apple-darwin', 'aarch64-apple-darwin']
	const distDir = await Deno.makeTempDir()

	for (const target of targets) {
		console.log(`Building for target "${target}"...`)

		const targetFilePath = pathUtils.join(distDir, `gofer-${target}.tar.gz`)
		const archive = new archiveUtils.Tar()

		const binFilePath = pathUtils.join(distDir, crypto.randomUUID())
		await dtils.sh(`deno compile -A --target ${target} --output ${binFilePath} cli/main.ts version=${tag}`)

		const binFileStat = await Deno.stat(binFilePath)
		const binFile = await Deno.open(binFilePath, { read: true })

		const readmeBytes = await dtils.readBytes('readme.md') || new Uint8Array()

		archive.append('gofer', { reader: binFile, contentSize: binFileStat.size })
		archive.append('readme.md', { reader: streamUtils.readerFromIterable([readmeBytes]), contentSize: readmeBytes.byteLength })

		const targetFile = await Deno.open(targetFilePath, { create: true, write: true })

		const compressedStream = streamUtils.readableStreamFromReader(archive.getReader()).pipeThrough(new CompressionStream('gzip'))
		const compressedReader = streamUtils.readerFromStreamReader(compressedStream.getReader())
		await ioUtils.copy(compressedReader, targetFile)
	}

	console.log(`Uploading assets to github release for tag "${tag}"...`)

	const files = await dtils.recursiveReadDir(distDir).then((files) => files.filter((file) => file.endsWith('.tar.gz')))
	await dtils.sh(`gh release upload ${tag} ${files.join(' ')} --clobber`, { env: Deno.env.toObject() })
}
