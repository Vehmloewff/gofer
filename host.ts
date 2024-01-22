import { GithubHost } from './github.ts'
import { PackageName } from './package.ts'

export interface ArtifactDownload {
	stream: ReadableStream<Uint8Array>
	name: string
}

export interface Host {
	getLatestVersion(name: PackageName): Promise<string | null>
	download(name: PackageName, version: string): Promise<ArtifactDownload>
}

export function selectHost(name: PackageName): Host | null {
	if (name.host === 'github.com') return new GithubHost()

	return null
}
