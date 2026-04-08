import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
import { MinioClient, MinioService } from 'nestjs-minio-client'
import { BufferedFile } from './file.model'
import * as mammoth from 'mammoth'
const configService = new ConfigService()

@Injectable()
export class MinioClientService {
	private readonly logger: Logger
	private readonly baseBucket = configService.get<string>('MINIO_BUCKET')

	public get client(): MinioClient {
		return this.minio.client
	}

	constructor(private readonly minio: MinioService) {
		this.logger = new Logger('MinioStorageService')
	}

	public async upload(
		file: BufferedFile,
		baseBucket: string = this.baseBucket
	) {
		
		if (
			!(
				file.mimetype.includes('jpeg') ||
				file.mimetype.includes('png') ||
				file.mimetype.includes('jpg') ||
				file.mimetype.includes('webp') ||
				file.mimetype.includes('gif') ||
				file.mimetype.includes('svg+xml') ||
				file.mimetype.includes('tiff') ||
				file.mimetype.includes('bmp') ||
				file.mimetype.includes('x-icon') ||
				file.mimetype.includes('mp4') ||
				file.mimetype.includes('webm') ||
				file.mimetype.includes('mov')||
				file.mimetype.includes('application/msword')
			)
		) {
			throw new HttpException('Invalid file type', HttpStatus.BAD_REQUEST)
		}
		const temp_filename = Date.now().toString()
		const hashedFileName = crypto
			.createHash('md5')
			.update(temp_filename)
			.digest('hex')
		const ext = file.originalname.substring(
			file.originalname.lastIndexOf('.'),
			file.originalname.length
		)
		const metaData = {
			'Content-Type': file.mimetype
		}
		const filename = hashedFileName + ext
		const fileName: string = `${filename}`
		const fileBuffer = file.buffer

		try {
			this.logger.log(`Attempting to upload file to ${baseBucket}/${fileName}`)
			this.logger.log(`MinIO endpoint: ${configService.get('MINIO_ENDPOINT')}`)
			this.logger.log(`MinIO port: ${configService.get('MINIO_PORT')}`)

			await new Promise((resolve, reject) => {
				this.client.putObject(
					baseBucket,
					fileName,
					fileBuffer,
					metaData as any,
					err => {
						if (err) {
							this.logger.error(`Error uploading file: ${err.message}`)
							this.logger.error(`Error details: ${JSON.stringify(err)}`)
							reject(
								new HttpException(
									`Error uploading file: ${err.message}`,
									HttpStatus.INTERNAL_SERVER_ERROR
								)
							)
						}
						resolve(null)
					}
				)
			})

			return {
				url: `https://${configService.get<string>('MINIO_ENDPOINT')}/${configService.get<string>('MINIO_BUCKET')}/${filename}`
			}
		} catch (error) {
			this.logger.error(`Failed to upload file: ${error.message}`)
			throw new HttpException(
				`Failed to upload file: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			)
		}
	}
	public async uploadFile(
		file: BufferedFile,
		baseBucket: string = this.baseBucket
	) {
		
		if (
			!(
				file.mimetype.includes('jpeg') ||
				file.mimetype.includes('png') ||
				file.mimetype.includes('jpg') ||
				file.mimetype.includes('webp') ||
				file.mimetype.includes('gif') ||
				file.mimetype.includes('svg+xml') ||
				file.mimetype.includes('tiff') ||
				file.mimetype.includes('bmp') ||
				file.mimetype.includes('x-icon') ||
				file.mimetype.includes('mp4') ||
				file.mimetype.includes('webm') ||
				file.mimetype.includes('mov')||
				file.mimetype.includes('application/octet-stream')||
				file.mimetype.includes('pdf')||
				file.mimetype.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
			)
		) {
			throw new HttpException('Invalid file type', HttpStatus.BAD_REQUEST)
		}
		const temp_filename = Date.now().toString()
		const hashedFileName = crypto
			.createHash('md5')
			.update(temp_filename)
			.digest('hex')
		const ext = file.originalname.substring(
			file.originalname.lastIndexOf('.'),
			file.originalname.length
		)
		const metaData = {
			'Content-Type': file.mimetype
		}
		const filename = hashedFileName + ext
		const fileName: string = `${filename}`
		const fileBuffer = file.buffer

		try {
			this.logger.log(`Attempting to upload file to ${baseBucket}/${fileName}`)
			this.logger.log(`MinIO endpoint: ${configService.get('MINIO_ENDPOINT')}`)
			this.logger.log(`MinIO port: ${configService.get('MINIO_PORT')}`)

			await new Promise((resolve, reject) => {
				this.client.putObject(
					baseBucket,
					fileName,
					fileBuffer,
					metaData as any,
					err => {
						if (err) {
							this.logger.error(`Error uploading file: ${err.message}`)
							this.logger.error(`Error details: ${JSON.stringify(err)}`)
							reject(
								new HttpException(
									`Error uploading file: ${err.message}`,
									HttpStatus.INTERNAL_SERVER_ERROR
								)
							)
						}
						resolve(null)
					}
				)
			})

			return {
				url: `${filename}`
			}
		} catch (error) {
			this.logger.error(`Failed to upload file: ${error.message}`)
			throw new HttpException(
				`Failed to upload file: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			)
		}
	}

	async delete(objetName: string, baseBucket: string = this.baseBucket) {
		try {
			await new Promise((resolve, reject) => {
				this.client.removeObject(baseBucket, objetName, err => {
					if (err) {
						this.logger.error(`Error deleting file: ${err}`)
						reject(
							new HttpException(
								`Error deleting file: ${err}`,
								HttpStatus.INTERNAL_SERVER_ERROR
							)
						)
					}
					resolve(null)
				})
			})
		} catch (error) {
			this.logger.error(`Failed to delete file: ${error.message}`)
			throw new HttpException(
				`Failed to delete file: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			)
		}
	}


    async readFile (file: string): Promise<Buffer> {
		try {
			const stream =  await this.client.getObject(this.baseBucket, file)
			return new Promise((resolve, reject) => {
				const chunks: Buffer[] = [];
				stream.on('data', (chunk) => chunks.push(chunk));
				stream.on('error', (err) => reject(err));
				stream.on('end', () => resolve(Buffer.concat(chunks)));
			  });
		} catch (error) {
			this.logger.error(`Failed to read file: ${error.message}`)
			throw new HttpException(
				`Failed to read file: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			)
		}
	}


	async getDocxText(fileName: string): Promise<string> {
		const fileBuffer = await this.readFile(fileName)
		const { value: text } = await mammoth.extractRawText({ buffer: fileBuffer })
		return text
	  }


	  async statObject(key: string) {

		try {
			const stats = await this.client.statObject(this.baseBucket, key)
			return true
		} catch (error) {
			this.logger.error(`Failed to get file stats: ${error.message}`)
			throw new HttpException(
				`Failed to get file stats: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			)


			return false
		}
	  }


}
