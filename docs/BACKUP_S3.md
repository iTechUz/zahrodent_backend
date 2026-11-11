# Backup'ni S3 ga joylash — taklif va PoC

Trello: «Backupni S3 ga joylash». Talablar: har soatda avtomat backup S3 ga tushsin; tizim universal
(faqat Zahro emas); Well-Architected'ga mos; 3-2-1 bo'yicha taklif; DevOpsLabUz uchun post.

## 1. Qaror (qisqa)

- **Vosita: Bash + AWS CLI** (PoC — `scripts/s3-backup.sh`), bucket/IAM/lifecycle esa **Terraform** bilan (pastda).
  Sabab: bash serverda hech narsa o'rnatmasdan ishlaydi, bitta fayl, universal — «nima backup qilinadi» faqat
  bitta `BACKUP_CMD` buyrug'i bilan beriladi (pg_dump, mysqldump, tar, mongodump...).
- **Ansible** (Trello'dagi savol): bash skriptni ko'p serverga tarqatish uchun keyingi bosqichda `role` qilib
  o'rash mumkin (skript + cron/systemd timer + env fayl). Hozir 1 ta server uchun ortiqcha, shuning uchun PoC'da yo'q.
- Mavjud `scripts/backup-db.sh` (kunlik, lokal) o'rnini bosmaydi — u **lokal nusxa** sifatida qoladi (3-2-1 dagi 2-nusxa).

## 2. Qanday ishlaydi

```
cron (har soat) → s3-backup.sh → BACKUP_CMD | gzip → gzip -t, hajm tekshiruvi
                → aws s3 cp (SSE-KMS, STANDARD_IA, sha256 metadata) → head-object bilan hajm tekshiruvi
                → (ixtiyoriy) lokal nusxa + LOCAL_RETENTION_DAYS → (ixtiyoriy) heartbeat
```

Kalit: `backups/<nom>/<YYYY>/<MM>/<DD>/<nom>_<UTC vaqt>.gz`. Xato bo'lsa skript `exit 1` qiladi va hech narsani o'chirmaydi.

Zahro uchun misol `/etc/zahro-backup.env` (maxfiy kalitlar YOZILMAYDI — server IAM role/profile ishlatadi):

```
BACKUP_NAME=zahro_dental
BACKUP_CMD=docker exec zahro_db pg_dump -U postgres -d zahro_dental -Fc -Z0 --no-owner
S3_BUCKET=<kompaniya>-backups-prod
AWS_REGION=eu-central-1
LOCAL_DIR=/home/ubuntu/backups/zahro_dental/hourly
HEARTBEAT_URL=https://hc-ping.com/<uuid>
```

Cron (har soat, 5-daqiqada):

```
5 * * * * ENV_FILE=/etc/zahro-backup.env /home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/scripts/s3-backup.sh >> /var/log/s3-backup.log 2>&1
```

## 3. Terraform (bucket + IAM) — universal modul uchun asos

```hcl
resource "aws_s3_bucket" "backups" { bucket = "<kompaniya>-backups-prod" }

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule { apply_server_side_encryption_by_default { sse_algorithm = "aws:kms" } }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    id     = "hourly-retention"
    status = "Enabled"
    filter { prefix = "backups/" }
    transition { days = 30  storage_class = "GLACIER_IR" }
    expiration { days = 365 }
    noncurrent_version_expiration { noncurrent_days = 30 }
    abort_incomplete_multipart_upload { days_after_initiation = 2 }
  }
}

# Server faqat yuklay oladi (o'chira olmaydi) — ransomware/xato himoyasi
data "aws_iam_policy_document" "uploader" {
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.backups.arn}/backups/*"]
  }
  statement {
    actions   = ["s3:GetObject", "s3:ListBucket"]   # head-object va restore sinovi uchun
    resources = [aws_s3_bucket.backups.arn, "${aws_s3_bucket.backups.arn}/backups/*"]
  }
}
```

Soatlik backup 1 yilda ~8 760 ta fayl — shuning uchun lifecycle: 30 kundan keyin arzon klassga, 365 kundan keyin o'chirish
(muddatlar kelishiladi; kunlik/oylik «ota» nusxalarni saqlash uchun keyingi bosqichda alohida `daily/` prefiksi qo'shiladi).

## 4. Well-Architected bo'yicha

- **Security**: public access to'liq yopiq, SSE-KMS, minimal huquqli IAM (faqat `PutObject` + o'qish; `DeleteObject` yo'q), maxfiy kalit fayllarda saqlanmaydi (IAM role/profile), `umask 077`.
- **Reliability**: arxiv `gzip -t` + hajm + S3 `head-object` bilan tekshiriladi; versioning; cron overlap'ga qarshi `flock`; heartbeat (dead-man switch) — backup **to'xtab qolsa** xabar keladi.
- **Operational excellence**: bitta skript, bitta env fayl, log, Terraform bilan takrorlanadigan infra; restore sinovi (pastda) rejaga kiritilgan.
- **Performance efficiency**: oqim (stream) bilan ishlaydi — diskda katta oraliq fayl yo'q (faqat gzip qilingan arxiv temp'da).
- **Cost optimization**: STANDARD_IA → GLACIER_IR → expiration; multipart tozalash.
- **Sustainability**: eski nusxalar avtomat o'chadi, ortiqcha nusxa saqlanmaydi.

## 5. 3-2-1 bizning holatda

| Qoida | Hozir | Taklif |
|---|---|---|
| **3** nusxa | 1 ta (serverdagi `/home/ubuntu/backups`, kunlik) | ishchi DB + lokal backup + S3 backup = 3 |
| **2** xil muhit | faqat server diski | server diski + S3 (boshqa provayder/region) |
| **1** nusxa tashqarida | yo'q | S3 boshqa region/hisobda (cross-region replication yoki ikkinchi bucket) |

Tavsiya: asosiy bucket Frankfurt, nusxa boshqa regionda (S3 CRR) yoki boshqa provayderda (masalan, Backblaze B2/Wasabi,
`aws s3 --endpoint-url` bilan shu skript ishlaydi). Alohida «ransomware» himoya uchun bucket'ga **Object Lock** (Compliance, 7–30 kun) yoqish mumkin.

## 6. Restore sinovi (oyiga 1 marta)

```bash
aws s3 cp s3://<bucket>/backups/zahro_dental/<yyyy>/<mm>/<dd>/<fayl>.gz /tmp/r.gz
gunzip -c /tmp/r.gz | pg_restore --no-owner -d zahro_dental_restore_test
```

Backup restore qilib ko'rilmaguncha — backup hisoblanmaydi.

## 7. Ochiq savollar

1. AWS hisobi/region va bucket nomi (egasi tasdiqlaydi). 2. Saqlash muddati (taklif: 365 kun). 3. Heartbeat xizmati (healthchecks.io yoki Telegram bot).
4. Ikkinchi nusxa qayerda (boshqa region yoki boshqa provayder).

## 8. DevOpsLabUz uchun post (qoralama)

> **Backup — soatlik, S3 ga, bitta skript bilan 🛟**
> Yangi loyihamizdan birinchi vosita: universal backup runner. Nima backup qilinishini bitta buyruq bilan aytasiz
> (`pg_dump`, `mysqldump`, `tar`...), skript uni siqadi, tekshiradi, S3 ga SSE-KMS bilan yuklaydi va hajmini qayta tasdiqlaydi.
> ✅ Har soat (cron) ✅ Terraform bilan bucket: versioning, lifecycle, public yopiq ✅ Server faqat yuklaydi, o'chira olmaydi
> ✅ 3-2-1: server + S3 + boshqa region ✅ Heartbeat: backup to'xtasa xabar keladi
> Eslatma: restore sinab ko'rilmagan backup — backup emas. Skript va Terraform — repoda. 👇
> #devops #backup #aws #s3 #terraform
