# =============================================================
# 出力：作り終わったあとに表示する値
#   IP や接続先は、人に見せるときは、隠す（スクリーンショット・画面録画・チャットに、映さない）
# =============================================================

output "public_ip" {
  description = "EC2 の、インターネットから見える IP アドレス"
  value       = aws_instance.main.public_ip
}

output "web_url" {
  description = "ブラウザで開く URL（自分の IP からだけ、届く）"
  value       = "http://${aws_instance.main.public_ip}"
}

output "ssh_command" {
  description = "EC2 に SSH でつなぐコマンド（秘密鍵は、公開鍵から .pub を除いた名前）"
  value       = "ssh -i ${trimsuffix(var.public_key_path, ".pub")} ec2-user@${aws_instance.main.public_ip}"
}

output "rds_endpoint" {
  description = "RDS の接続先の名前（EC2 の中からだけ、つながる）。RDS を作っていない間は、null。パスワードは、出力しない"
  value       = var.create_database ? aws_db_instance.main[0].address : null
}

output "database_url_template" {
  description = "バックエンドの環境変数 DATABASE_URL の、書き方の見本。<パスワード> のところに、自分で決めたパスワードを入れる（ここには、パスワードを出さない）"
  value       = var.create_database ? "mysql+pymysql://${var.db_username}:<パスワード>@${aws_db_instance.main[0].address}:3306/${var.db_name}?charset=utf8mb4" : null
}
