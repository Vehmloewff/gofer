use crate::error::{CliError, Result};
use decompress::{Decompress, ExtractOptsBuilder};
use std::{path::PathBuf, thread};
use tokio::sync::oneshot;

pub struct Writer {
	dir: PathBuf,
	decompressor: Decompress,
}

impl Writer {
	pub fn new(dir: PathBuf) -> Writer {
		Writer {
			dir,
			decompressor: Decompress::default(),
		}
	}

	async fn decompress(&self, id: String, from: PathBuf, to: PathBuf) -> Result<()> {
		let (sender, receiver) = oneshot::channel::<Result<()>>();

		thread::spawn(move || {
			let result = Decompress::default().decompress(from, to, &ExtractOptsBuilder::default().strip(1).build().unwrap());

			sender.send(match result {
				Ok(_) => Ok(()),
				Err(error) => Err(CliError::DecompressError {
					id,
					message: format!("{}", error),
				}),
			});
		});

		receiver.await.unwrap()
	}

	/// Adds a bundle to the
	pub async fn add_bundle(&self, id: String, bundle_path: PathBuf) -> Result<()> {
		let destination_dir = self.dir.join(id.clone());

		self.decompress(id, bundle_path, destination_dir).await
	}

	pub async fn stash_bundle(&self, id: String, bundle_path: PathBuf) -> Result<()> {}

	pub fn remove(&self, id: String) -> Result<()> {
		Ok(())
	}
}
