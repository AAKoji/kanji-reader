"""
Daily Web Push reminder.
Sends "today's article" to every row in push_subscriptions and prunes expired ones.
Run via GitHub Actions (daily-push.yml); requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
VAPID_PRIVATE_KEY and VAPID_SUBJECT env vars. Optional SUPABASE_SCHEMA (default "public").

Test against the dev schema and only your own devices:
    SUPABASE_SCHEMA=dev python scripts/send_push.py --user-id <your auth user uuid>
"""

import argparse
import json
import os
import sys
from pathlib import Path

import requests
from pywebpush import WebPushException, webpush

# Resolved from this file so the script works regardless of the caller's cwd.
REPO_ROOT = Path(__file__).resolve().parent.parent
ARTICLE_PATH = REPO_ROOT / "src" / "article.json"

NOTIFICATION_TITLE = "今日の記事"
# A reminder that arrives a day late is noise; let the push service drop it after 12 h.
TTL_SECONDS = 12 * 60 * 60
# Push services answer 404/410 when the browser has dropped the subscription for good.
EXPIRED_STATUS_CODES = {404, 410}

REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]


def supabase_headers(service_key: str, schema: str) -> dict:
    headers = {
        "apikey": service_key,
        # PostgREST picks the schema from these; "public" is the default either way.
        "Accept-Profile": schema,
        "Content-Profile": schema,
    }
    # Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys must not.
    if service_key.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {service_key}"
    return headers


def fetch_subscriptions(base_url: str, headers: dict, user_id: str | None) -> list[dict]:
    params = {"select": "id,endpoint,p256dh,auth"}
    if user_id:
        params["user_id"] = f"eq.{user_id}"
    response = requests.get(f"{base_url}/rest/v1/push_subscriptions", headers=headers, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def delete_subscriptions(base_url: str, headers: dict, ids: list[int]) -> None:
    id_list = ",".join(str(i) for i in ids)
    response = requests.delete(
        f"{base_url}/rest/v1/push_subscriptions",
        headers=headers,
        params={"id": f"in.({id_list})"},
        timeout=30,
    )
    response.raise_for_status()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--user-id", help="only send to this auth user's devices (for testing)")
    args = parser.parse_args()

    missing = [name for name in REQUIRED_ENV if not os.environ.get(name)]
    if missing:
        print(f"Error: missing env vars: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    base_url = os.environ["SUPABASE_URL"].rstrip("/")
    schema = os.environ.get("SUPABASE_SCHEMA") or "public"
    headers = supabase_headers(os.environ["SUPABASE_SERVICE_ROLE_KEY"], schema)
    vapid_private_key = os.environ["VAPID_PRIVATE_KEY"]
    vapid_claims = {"sub": os.environ["VAPID_SUBJECT"]}

    article = json.loads(ARTICLE_PATH.read_text(encoding="utf-8"))
    payload = json.dumps({"title": NOTIFICATION_TITLE, "body": article["title"], "url": "/"}, ensure_ascii=False)

    subscriptions = fetch_subscriptions(base_url, headers, args.user_id)
    print(f"Sending to {len(subscriptions)} subscription(s) in schema '{schema}'")
    if not subscriptions:
        return

    sent_count = 0
    expired_ids = []
    failed_count = 0
    for row in subscriptions:
        subscription_info = {"endpoint": row["endpoint"], "keys": {"p256dh": row["p256dh"], "auth": row["auth"]}}
        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims=dict(vapid_claims),  # webpush adds "aud" to the dict it gets
                ttl=TTL_SECONDS,
            )
            sent_count += 1
        except WebPushException as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in EXPIRED_STATUS_CODES:
                expired_ids.append(row["id"])
            else:
                failed_count += 1
                print(f"Subscription {row['id']} failed: {exc}", file=sys.stderr)

    if expired_ids:
        delete_subscriptions(base_url, headers, expired_ids)

    print(f"Sent {sent_count}, pruned {len(expired_ids)} expired, {failed_count} failed")
    # One dead phone shouldn't fail the job; only flag a run where nothing got through.
    if sent_count == 0 and failed_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
