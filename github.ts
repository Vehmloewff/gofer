import { ArtifactDownload, Host } from './host.ts'
import { OsTargetMatcher } from './os_target.ts'
import { PackageName } from './package.ts'

interface SimpleUser {
	name: string | null
	email: string | null
	login: string
	id: number
	node_id: string
	avatar_url: string
	gravatar_id: string | null
	url: string
	html_url: string
	followers_url: string
	following_url: string
	gists_url: string
	starred_url: string
	subscriptions_url: string
	organizations_url: string
	repos_url: string
	events_url: string
	received_events_url: string
	type: string
	site_admin: boolean
	starred_at: string
}

interface ReleaseAsset {
	url: string
	browser_download_url: string
	id: number
	node_id: string
	name: string
	label: string | null
	state: 'uploaded' | 'open'
	content_type: string
	size: number
	download_count: number
	created_at: string
	updated_at: string
	uploader: SimpleUser | null
}

interface ReactionRollup {
	url: string
	total_count: number
	'+1': number
	'-1': number
	laugh: number
	confused: number
	heart: number
	hooray: number
	eyes: number
	rocket: number
}

interface Release {
	url: string
	html_url: string
	assets_url: string
	upload_url: string
	tarball_url: string | null
	zipball_url: string | null
	id: number
	node_id: string
	tag_name: string
	target_commitish: string
	name: string | null
	body: string | null
	draft: boolean
	prerelease: boolean
	created_at: string
	published_at: string | null
	author: SimpleUser
	assets: ReleaseAsset[]
	body_html: string
	body_text: string
	mentions_count: number
	discussion_url: string
	reactions: ReactionRollup
}

export class GithubHost implements Host {
	#stashedToken: string | null = null
	#didCheckForToken = false

	#getAuthToken() {
		if (this.#didCheckForToken) return this.#stashedToken

		const token = Deno.env.get('GOFER_GITHUB_TOKEN') || null

		this.#didCheckForToken = true
		this.#stashedToken = token

		if (!token) {
			console.log(
				'sending unauthenticated request to api.github.com. To access private repos and increase rate limit, set the `GOFER_GITHUB_TOKEN` env variable.',
			)

			return null
		}

		console.log(`sending authenticated request to api.github.com with token: ${mostlyObscure(6, token)}`)

		return token
	}

	async #sendRequestBasic(method: string, path: string, body?: unknown, binary = false): Promise<Response | null> {
		const headers = new Headers()
		headers.append('Accept', binary ? 'application/octet-stream' : 'application/vnd.github+json')
		headers.append('X-GitHub-Api-Version', '2022-11-28')

		const token = this.#getAuthToken()
		if (token) headers.append('Authorization', `Bearer ${token}`)

		const response = await fetch(`https://api.github.com${path}`, { method, body: body ? JSON.stringify(body) : null })
		if (response.status === 404) return null

		return response
	}

	async #sendRequest<T>(method: string, path: string, body?: unknown): Promise<T | null> {
		const response = await this.#sendRequestBasic(method, path, body)
		if (!response) return null

		if (!response.ok) throw new Error(`failed to send github request (${response.statusText}): ${await response.text()}`)
		return await response.json()
	}

	#parseSections(packageName: PackageName) {
		const user = packageName.sections[0]
		const repo = packageName.sections[1]

		if (!repo) throw new Error(`github user was inferred to be "${user}", but no repo name was found`)

		return { user, repo }
	}

	async getLatestVersion(packageName: PackageName): Promise<string | null> {
		const { user, repo } = this.#parseSections(packageName)

		const release = await this.#sendRequest<Release>('GET', `/repos/${user}/${repo}/releases/latest`)
		if (!release) return null

		return release.tag_name
	}

	async download(packageName: PackageName, version: string): Promise<ArtifactDownload> {
		const { user, repo } = this.#parseSections(packageName)

		const release = await this.#sendRequest<Release>('GET', `/repos/${user}/${repo}/releases/tags/${version}`)
		if (!release) throw new Error(`no release was found for tag, "${version}"`)

		const targetMatcher = new OsTargetMatcher(Deno.build.os, Deno.build.arch)
		for (const asset of release.assets) targetMatcher.match(asset.id.toString(), asset.name)

		const matchedReleaseId = targetMatcher.getHighestRanked()
		if (!matchedReleaseId) throw new Error('no generic release assets were found')

		const response = await this.#sendRequestBasic('GET', `/repos/${user}/${repo}/releases/assets/${matchedReleaseId}`)
		if (!response) throw new Error('internal error occurred because release asset just listed was not found')
		if (!response.body) throw new Error('expected to find a response body from asset request')

		const stream = response.body
		const name = release.assets.find(({ id }) => matchedReleaseId === id.toString())!.name

		return { stream, name }
	}
}

function mostlyObscure(visibleStartCharacters: number, secret: string) {
	const visibleChars = secret.slice(0, visibleStartCharacters)
	const obscuredChars = secret.slice(visibleStartCharacters).replace(/./g, '*')

	return `${visibleChars}${obscuredChars}`
}
