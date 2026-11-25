#!/usr/bin/env bash
# Sends email over SMTP with curl (mail_send) and the operator notifications
# built on it (notify_failure, notify_success). Sourced by the scripts that send
# mail.
set -euo pipefail

# shellcheck source=lib.sh
. /usr/local/lib/backup/lib.sh

# The SMTP envelope sender for an EMAIL_FROM: the address inside <...> when
# there is one ('Name <addr>'), otherwise the whole value.
mail_envelope_sender() {
  local from=$1
  if [[ $from =~ \<([^\<\>]+)\>[[:space:]]*$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  else
    printf '%s\n' "$from"
  fi
}

# Turns LF line ends into the CRLF SMTP wants.
mail_crlf() { awk '{ printf "%s\r\n", $0 }'; }

# Writes the message to stdout as CRLF-terminated lines. The text part and the
# attachment are base64, so the body and the attachment can hold any bytes.
# mail_build <to> <subject> <body> [<attachment-file> <attachment-name>]
mail_build() {
  local to=$1 subject=$2 body=$3 attach=${4:-} attach_name=${5:-}
  local boundary
  boundary="=_bagheera_$(date -u +%s)_$$"

  {
    printf 'From: %s\n' "$EMAIL_FROM"
    printf 'To: %s\n' "$to"
    printf 'Subject: %s\n' "$subject"
    printf 'Date: %s\n' "$(date -u '+%a, %d %b %Y %H:%M:%S +0000')"
    printf 'Message-ID: <%s.%s@bagheera-backup>\n' "$(date -u +%s)" "$$"
    printf 'MIME-Version: 1.0\n'
    printf 'Content-Type: multipart/mixed; boundary="%s"\n' "$boundary"
    printf '\n--%s\n' "$boundary"
    printf 'Content-Type: text/plain; charset=utf-8\n'
    printf 'Content-Transfer-Encoding: base64\n\n'
    printf '%s\n' "$body" | base64 -w 76
    if [ -n "$attach" ]; then
      printf '\n--%s\n' "$boundary"
      printf 'Content-Type: application/octet-stream; name="%s"\n' "$attach_name"
      printf 'Content-Disposition: attachment; filename="%s"\n' "$attach_name"
      printf 'Content-Transfer-Encoding: base64\n\n'
      base64 -w 76 <"$attach"
    fi
    printf '\n--%s--\n' "$boundary"
  } | mail_crlf
}

# mail_send --to <addr> --subject <text> --body <text>
#           [--attach <file> --attach-name <name>]
# Returns 0 when the SMTP server accepted the message, 1 otherwise. Reads
# EMAIL_SMTP_URL (credentials in its userinfo), EMAIL_FROM and
# BACKUP_SMTP_ALLOW_PLAINTEXT. STARTTLS is required unless the latter is
# `true`, which only the tests set: production's compose does not pass it on,
# so no deployment can turn TLS off. The URL is never printed: it is handed to curl through a config file
# descriptor, and curl's own output is scrubbed of it.
mail_send() {
  local to="" subject="" body="" attach="" attach_name=""
  while [ "$#" -gt 0 ]; do
    case $1 in
      --to) to=${2-}; shift 2 || return 1 ;;
      --subject) subject=${2-}; shift 2 || return 1 ;;
      --body) body=${2-}; shift 2 || return 1 ;;
      --attach) attach=${2-}; shift 2 || return 1 ;;
      --attach-name) attach_name=${2-}; shift 2 || return 1 ;;
      *)
        log error "mail_send: unknown option $1"
        return 1
        ;;
    esac
  done

  if [ -z "$to" ] || [ -z "$subject" ]; then
    log error "mail_send: --to and --subject are required"
    return 1
  fi
  if [ -z "${EMAIL_SMTP_URL:-}" ] || [ -z "${EMAIL_FROM:-}" ]; then
    log error "EMAIL_SMTP_URL and EMAIL_FROM are required to send email"
    return 1
  fi
  if [ -n "$attach" ] && { [ ! -f "$attach" ] || [ -z "$attach_name" ]; }; then
    log error "mail_send: --attach needs an existing file and --attach-name"
    return 1
  fi
  # A line break in a header value would let it inject headers.
  case $to$subject$attach_name$EMAIL_FROM in
    *$'\n'* | *$'\r'*)
      log error "mail_send: header values must be single-line"
      return 1
      ;;
  esac

  local message out status=0 tls=(--ssl-reqd) sender
  message=$(mktemp)
  # Callers use this function in a `||` list, where `set -e` is off.
  if ! mail_build "$to" "$subject" "$body" "$attach" "$attach_name" >"$message"; then
    rm -f "$message"
    log error "mail_send: could not build the message"
    return 1
  fi
  sender=$(mail_envelope_sender "$EMAIL_FROM")
  if [ "${BACKUP_SMTP_ALLOW_PLAINTEXT:-}" = "true" ]; then
    tls=()
  fi

  # `url = "..."` in a config read from a descriptor keeps the credentials off
  # the command line (`ps`). Inside the quotes, \ and " are escapes.
  local url=${EMAIL_SMTP_URL//\\/\\\\}
  url=${url//\"/\\\"}
  # A capped dump is about 14 MB on the wire: rather than one short overall
  # limit, give up on a server that does not answer or a transfer that stalls
  # (under 1 KiB/s for 2 minutes), with a generous ceiling over everything.
  out=$(curl --silent --show-error --connect-timeout 30 --speed-limit 1024 --speed-time 120 --max-time 900 "${tls[@]}" \
    --mail-from "$sender" --mail-rcpt "$to" --upload-file "$message" \
    --config <(printf 'url = "%s"\n' "$url") 2>&1) || status=$?
  rm -f "$message"

  if [ "$status" -ne 0 ]; then
    log error "sending the email failed (curl exit status $status): ${out//"$EMAIL_SMTP_URL"/<EMAIL_SMTP_URL>}"
    return 1
  fi
}

# Prints stdin with the secrets of the environment replaced by <redacted>: the
# SMTP URL, the restic and Postgres passwords, the S3 secret key, the SFTP
# private key, and the credentials of any user:password@ URL. A multi-line
# secret is also redacted line by line, since the quoted log may hold only part
# of it.
redact_secrets() {
  local text secret line
  text=$(cat)
  for secret in "${EMAIL_SMTP_URL:-}" "${RESTIC_PASSWORD:-}" "${POSTGRES_PASSWORD:-}" \
    "${AWS_SECRET_ACCESS_KEY:-}" "${BACKUP_SFTP_PRIVATE_KEY:-}"; do
    [ -n "$secret" ] || continue
    text=${text//"$secret"/<redacted>}
    case $secret in
      *$'\n'*)
        while IFS= read -r line; do
          line=${line%$'\r'}
          # Not the -----BEGIN/END ...----- markers: they are not secret, and
          # every key has the same ones.
          case $line in "" | -----*) continue ;; esac
          text=${text//"$line"/<redacted>}
        done <<<"$secret"
        ;;
    esac
  done
  printf '%s' "$text" | sed -E 's#(://[^/:@[:space:]]*):[^/@[:space:]]*@#\1:<redacted>@#g'
}

# notify_email <subject> <headline>: emails $BACKUP_ALERT_EMAIL the headline and
# the last 20 lines of $ALERT_LOG (default: the run log), secrets redacted.
# Never fails: a message that cannot be sent is only logged, so notifying can
# neither change a run's exit status nor loop.
notify_email() {
  local subject=$1 headline=$2 log=${ALERT_LOG:-/tmp/backup/run.log} tail_text body
  tail_text=$(tail -n 20 "$log" 2>/dev/null | redact_secrets) || tail_text=""
  [ -n "$tail_text" ] || tail_text="(the log is empty)"
  body=$(printf '%s\n\nLast 20 log lines:\n\n%s' "$headline" "$tail_text")
  mail_send --to "$BACKUP_ALERT_EMAIL" --subject "$subject" --body "$body" ||
    log error "could not send the '$subject' notification to $BACKUP_ALERT_EMAIL"
  return 0
}

# notify_failure <failure...>: tells $BACKUP_ALERT_EMAIL which destinations or
# steps failed. Does nothing without BACKUP_ALERT_EMAIL.
notify_failure() {
  alert_enabled || return 0
  local failures
  printf -v failures '%s, ' "$@"
  notify_email "[Bagheera backup] FAILED" "The Bagheera backup failed: ${failures%, }."
}

# notify_success: reports a finished run to $BACKUP_ALERT_EMAIL, only when
# BACKUP_REPORT=always.
notify_success() {
  [ "$(cfg BACKUP_REPORT failure)" = "always" ] || return 0
  alert_enabled || return 0
  notify_email "[Bagheera backup] OK" "The Bagheera backup finished successfully."
}
