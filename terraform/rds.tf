# =============================================================
# RDS（AWS が管理してくれるデータベース。ここでは MySQL）
#   - create_database = true のときだけ作る（段階ごとに確認するため。最初は、作らない）
#   - EC2 からだけ、つなげる（セキュリティグループで、EC2 の SG からの 3306 番だけ許可）
#   - インターネットには公開しない（publicly_accessible = false）
#   - 「開発環境向け」の設定：1台だけ（Multi-AZ は有料になるので使わない）、
#     バックアップは残さない、消すときの記録（スナップショット）も取らない
# =============================================================

# DB サブネットグループ：RDS を置いてよいサブネットの一覧。
# 2 つ以上の区画（AZ）のサブネットを、登録する決まり（DB が動くのは、そのうち 1 台だけ）
resource "aws_db_subnet_group" "main" {
  count = var.create_database ? 1 : 0

  name       = "${var.project_name}-db-subnets"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_c.id]

  tags = { Name = "${var.project_name}-db-subnets" }
}

resource "aws_db_instance" "main" {
  count = var.create_database ? 1 : 0

  identifier = "${var.project_name}-db"

  engine         = "mysql"
  engine_version = "8.4.11" # アプリ（docker compose の mysql:8.4）と同じ 8.4 系。AWS が既定にしている版
  instance_class = var.db_instance_class

  allocated_storage = 20    # GB
  storage_type      = "gp3" # SSD の種類
  storage_encrypted = true  # ディスクを暗号化する

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password # 値は terraform.tfvars から（sensitive なので、表示では隠れる）

  db_subnet_group_name   = aws_db_subnet_group.main[0].name
  vpc_security_group_ids = [aws_security_group.rds[0].id]
  publicly_accessible    = false # インターネットから見える IP を付けない

  # 開発環境向けの設定
  multi_az                   = false # true にすると、DB が 2 台分になり、有料
  backup_retention_period    = 0     # 自動バックアップを残さない
  skip_final_snapshot        = true  # 消すときに、最後の記録を取らない（取ると、残って、お金がかかる）
  deletion_protection        = false # すぐ destroy できるように
  auto_minor_version_upgrade = false # 動かしている間に、勝手に版が上がらないように

  tags = { Name = "${var.project_name}-db" }
}
