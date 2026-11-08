"""seed categories

最初から入れておく、7つの業務カテゴリーと、それぞれの作業テンプレート（初期データ）。
内容は docs/functional-requirements.md の 7。

- 同じ名前のカテゴリーが、すでにあれば、何もしない（名前も、テンプレートの中身も、そのまま残す）。
  すでにデータのある DB でも、安全に実行できる。
- 元に戻す（downgrade）ときは、何も消さない。依頼が使っているかもしれず、
  管理画面で直した内容も、消えてしまうため。

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# マイグレーションは、あとから変えない記録なので、データはここに直接書く（モデルや設定を読まない）
SEED: list[tuple[str, list[str]]] = [
    (
        "HP",
        [
            "原稿の確認",
            "素材の収集",
            "修正・追加",
            "プレビューチェック",
            "依頼者等の確認",
            "確認後の修正",
            "承認後の公開",
            "管理表記入",
        ],
    ),
    (
        "動画",
        [
            "企画の打ち合わせ",
            "絵コンテ作成",
            "素材の収集",
            "映像の編集",
            "テロップ原稿作成（翻訳）",
            "テロップ挿入",
            "SE・BGM挿入",
            "オープニング作成",
            "書き出し・チェック",
            "依頼者等の確認",
            "確認後の修正",
            "納品",
        ],
    ),
    (
        "研究倫理委員会",
        [
            "日程連絡・参加の回答",
            "資料の受け取り",
            "資料の内容確認",
            "想定問答集の確認",
            "会議参加",
        ],
    ),
    (
        "通関",
        [
            "取引内容の情報収集",
            "非該当証明用のチェックリスト発行",
            "非該当証明書作成・押印",
            "インボイス作成",
            "パッキングリスト作成",
            "危険物証明書発行",
            "輸出証明書発行",
            "代行用のパスポートコピー取得",
            "ダブルチェック",
            "通関書類一式と荷物の突合せ",
            "通関書類の格納",
        ],
    ),
    (
        "取扱説明書",
        [
            "依頼内容の詳細聞き取り",
            "画像の用意",
            "文章作成",
            "Wordへの清書",
            "変更履歴の反映",
            "依頼者等への確認",
            "確認後の修正",
            "納品",
            "表への記入",
        ],
    ),
    (
        "AIアカウント発行",
        [
            "依頼者のアドレス確認",
            "日割り価格の確認",
            "購買申請",
            "承認後にアカウント追加",
            "ユーザーへメール連絡",
            "カード利用申請",
        ],
    ),
    (
        # まだ経験していない業務のため、仮の項目（架空のサンプル）。経験したら見直す
        "引っ越し",
        [
            "見積もり依頼",
            "業者の選定",
            "現状の備品の確認",
            "レイアウト図の作成",
            "各種届出",
            "当日の段取りの確認",
        ],
    ),
]

category = sa.table("category", sa.column("id", sa.Integer), sa.column("name", sa.String))
template_item = sa.table(
    "template_item",
    sa.column("category_id", sa.Integer),
    sa.column("name", sa.String),
    sa.column("sort_order", sa.Integer),
)


def upgrade() -> None:
    """名前がまだないカテゴリーだけ、カテゴリーとテンプレートを入れる。"""
    connection = op.get_bind()
    for name, items in SEED:
        exists = connection.execute(sa.select(category.c.id).where(category.c.name == name)).first()
        if exists is not None:
            continue
        connection.execute(sa.insert(category).values(name=name))
        category_id = connection.execute(
            sa.select(category.c.id).where(category.c.name == name)
        ).scalar_one()
        connection.execute(
            sa.insert(template_item),
            [
                {"category_id": category_id, "name": item, "sort_order": position}
                for position, item in enumerate(items, start=1)
            ],
        )


def downgrade() -> None:
    """何もしない（初期データは、消さない）。"""
