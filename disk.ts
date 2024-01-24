import { archiveUtils, ioUtils, pathUtils, streamUtils, zip } from './deps.ts'
import { dtils } from './deps.ts'

export async function saveToDisk(stream: ReadableStream<Uint8Array>, path: string, destinationPath: string): Promise<void> {
	let decompress = false
	let writeStrategy: 'tar' | 'zip' | 'plain' = 'plain'

	if (/\.gz$/.test(path)) decompress = true
	if (/\.tar(.[a-z]+)?$/.test(path)) writeStrategy = 'tar'
	if (/\.zip$/.test(path)) writeStrategy = 'zip'

	const body = decompress ? stream.pipeThrough(new DecompressionStream('gzip')) : stream

	if (writeStrategy === 'tar') {
		const files = new archiveUtils.Untar(streamUtils.readerFromStreamReader(body.getReader()))

		for await (const entry of files) {
			const path = pathUtils.join(destinationPath, entry.fileName)
			const dir = pathUtils.dirname(path)

			if (!await dtils.exists(dir)) await Deno.mkdir(dir, { recursive: true })
			if (entry.type === 'directory') continue

			const file = await Deno.open(path, { create: true, write: true })
			await ioUtils.copy(entry, file)
		}
	} else if (writeStrategy === 'zip') {
		const tempFilePath = await Deno.makeTempFile()
		const tempFile = await Deno.open(tempFilePath, { write: true })

		await ioUtils.copy(streamUtils.readerFromStreamReader(body.getReader()), tempFile)
		const destinationDirName = pathUtils.dirname(destinationPath)

		if (!await dtils.exists(destinationDirName)) await Deno.mkdir(destinationDirName, { recursive: true })
		await zip.decompress(tempFilePath, destinationPath)
	} else {
		const entryName = path === '/' ? 'unknown' : pathUtils.basename(path)
		const fileName = pathUtils.join(destinationPath, entryName)
		const dirName = pathUtils.dirname(fileName)

		if (!await dtils.exists(dirName)) await Deno.mkdir(dirName, { recursive: true })
		const file = await Deno.open(fileName, { create: true, write: true })

		await ioUtils.copy(streamUtils.readerFromStreamReader(body.getReader()), file)
	}
}
