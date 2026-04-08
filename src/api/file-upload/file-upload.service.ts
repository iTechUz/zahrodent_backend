import { readFile } from 'fs/promises';

import { Injectable } from '@nestjs/common'
import { BufferedFile } from 'src/api/minio/file.model'
import { MinioClientService } from 'src/api/minio/minio-client.service'

@Injectable()
export class FileUploadService {
	constructor(private minioClientService: MinioClientService) {}

	async upload(
		file: BufferedFile | BufferedFile[]
	): Promise<string | string[]> {
		if (Array.isArray(file)) {
			return this.uploadMultiple(file)
		}
		return await this.uploadSingle(file)
	}

	private async uploadSingle(file: BufferedFile): Promise<string> {

		
		const uploadResult = await this.minioClientService.upload(file)
		return uploadResult.url
	}

	private async uploadMultiple(files: BufferedFile[]): Promise<string[]> {
		const uploadPromises = files.map(file =>
			this.minioClientService.upload(file)
		)
		const uploadResults = await Promise.all(uploadPromises)
		return uploadResults.map(result => result.url)
	}

    async uploadFile(file: BufferedFile): Promise<{fileUrl: string}> {
        const uploadResult = await this.minioClientService.uploadFile(file)
        return {fileUrl: uploadResult.url}
    }

	async readFile(file: string): Promise<string> {

		const data = await this.minioClientService.getDocxText(file)
		return data
	}


	async hasFile(key: string): Promise<boolean> {
		try {
		  await this.minioClientService.statObject(key);
		  return true; // Fayl mavjud
		} catch (error) {
		  if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
			return false; // Fayl mavjud emas
		  }
		  throw error; // Boshqa xato - tashlaymiz
		}
	  }
}
