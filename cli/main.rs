mod add;
mod error;
mod remove;
mod resolver;

use clap::{Parser, Subcommand};
use error::{CliError, Result};
use std::{env, path::PathBuf, str::FromStr};

#[derive(Debug, Parser)]
#[command(name = "yapm")]
#[command(about = "Yet Another Package Manager", long_about = None)]
struct Cli {
	/// The resolver executable to use. Must be a valid path, or in the $PATH env variable.
	#[arg(long, default_value_t = String::from("yapm_resolver_github"))]
	resolver: String,

	#[command(subcommand)]
	command: CliSubCommand,
}

#[derive(Debug, Subcommand)]
enum CliSubCommand {
	/// Install a package
	#[command()]
	Add {
		/// The name of the package to install
		name: String,
	},
	/// Remove a package
	#[command()]
	Remove {
		/// The name of the package to remove
		name: String,
	},
}

fn main() {
	match parse_and_run() {
		Ok(_) => (),
		Err(error) => println!("{} {}", "error:", error),
	};
}

fn parse_and_run() -> Result<()> {
	let args = Cli::parse();

	let yapm_dir = match env::var("YAPM_DIR") {
		Ok(dir) => PathBuf::from_str(&dir).map_err(|_| CliError::InvalidPath(dir))?,
		Err(_) => {
			let home = env::var("HOME").map_err(|_| CliError::CannotInferYapmDir)?;
			let user_home = PathBuf::from_str(&home).map_err(|_| CliError::InvalidPath(home))?;

			user_home.join(".yapm")
		}
	};

	Ok(())
}
