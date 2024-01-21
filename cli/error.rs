use thiserror::Error;

#[derive(Error, Debug)]
pub enum CliError {
	#[error("The Yapm directory was not set, and it cannot be inferred to it's default, `~/.yapm`, because the `$HOME` env variable is not set. To resolve, set either the $YAPM_DIR or $HOME environment variables.")]
	CannotInferYapmDir,

	#[error("Invalid path: \"{0}\"")]
	InvalidPath(String),

	#[error("Resolver could not be spawned from {0}")]
	InvalidResolver(String),

	#[error("Subprocess \"{program}\" encountered an unexpected error: {message}")]
	UnexpectedProcessFailure { program: String, message: String },

	#[error("Failed to resolve using resolver \"{0}\"")]
	ResolverErrored(String),

	#[error("Failed to decompress \"{id}\": {message}")]
	DecompressError { id: String, message: String },
}

pub type Result<T> = std::result::Result<T, CliError>;
